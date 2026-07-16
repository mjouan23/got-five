import crypto from 'crypto';
import { env } from '../config/env.js';
import { sessionRepository } from '../repositories/sessionRepository.js';
import { playerRepository } from '../repositories/playerRepository.js';
import { generateSessionCode, generateToken } from '../utils/generate.js';
import {
  requireNonEmptyString,
  sanitizeNickname,
  validateSessionCode
} from '../utils/validation.js';
import { AppError } from '../utils/errors.js';
import { GAME_STATUS } from '../../../shared/game-status.js';

const expirationDate = () => {
  const expires = new Date();
  expires.setHours(expires.getHours() + env.SESSION_EXPIRATION_HOURS);
  return expires.toISOString();
};

const createJoinUrl = (code) => `${env.PUBLIC_APP_URL.replace(/\/$/, '')}/join/${code}`;

const getSessionAndPlayers = (session) => {
  const players = playerRepository.listBySession(session.id).map((player) => ({
    ...player,
    connected: Boolean(player.connected)
  }));
  return {
    sessionCode: session.code,
    status: session.status,
    createdAt: session.created_at,
    updatedAt: session.updated_at,
    players,
    maxPlayers: env.MAX_PLAYERS_PER_SESSION
  };
};

const ensureSessionByCode = (sessionCode) => {
  const code = validateSessionCode(sessionCode);
  const session = sessionRepository.findByCode(code);
  if (!session) {
    throw new AppError('Session introuvable', 404);
  }
  return session;
};

export const sessionService = {
  createSession(rawNickname) {
    const nickname = sanitizeNickname(rawNickname);
    const now = new Date().toISOString();

    let code;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const candidate = generateSessionCode();
      if (!sessionRepository.findByCode(candidate)) {
        code = candidate;
        break;
      }
    }

    if (!code) {
      throw new AppError('Impossible de générer un code de session', 500);
    }

    const sessionId = crypto.randomUUID();
    const hostPlayerId = crypto.randomUUID();
    const hostToken = generateToken();

    sessionRepository.create({
      id: sessionId,
      code,
      status: GAME_STATUS.LOBBY,
      hostPlayerId: null,
      hostToken,
      createdAt: now,
      updatedAt: now,
      expiresAt: expirationDate()
    });

    playerRepository.create({
      id: hostPlayerId,
      sessionId,
      nickname,
      reconnectToken: hostToken,
      role: 'HOST',
      connected: 0,
      socketId: null,
      createdAt: now,
      updatedAt: now
    });

    sessionRepository.attachHostPlayer(sessionId, hostPlayerId, now);

    return {
      sessionCode: code,
      playerId: hostPlayerId,
      playerToken: hostToken,
      role: 'HOST',
      joinUrl: createJoinUrl(code)
    };
  },

  getPublicSession(sessionCode) {
    const session = ensureSessionByCode(sessionCode);
    return {
      sessionCode: session.code,
      status: session.status,
      createdAt: session.created_at,
      updatedAt: session.updated_at,
      playersCount: playerRepository.countBySession(session.id)
    };
  },

  getSessionById(sessionId) {
    return sessionRepository.findById(sessionId);
  },

  joinSession(sessionCode, rawNickname) {
    const session = ensureSessionByCode(sessionCode);
    if (session.status !== GAME_STATUS.LOBBY) {
      throw new AppError('La session n\'accepte plus de nouveaux joueurs', 409);
    }

    const currentPlayers = playerRepository.countBySession(session.id);
    if (currentPlayers >= env.MAX_PLAYERS_PER_SESSION) {
      throw new AppError('La session est complète', 409);
    }

    const nickname = sanitizeNickname(rawNickname);
    const nicknameUsed = playerRepository.findBySessionAndNickname(session.id, nickname);
    if (nicknameUsed) {
      throw new AppError('Ce pseudonyme est déjà utilisé dans la session', 409);
    }

    const now = new Date().toISOString();
    const playerId = crypto.randomUUID();
    const playerToken = generateToken();

    playerRepository.create({
      id: playerId,
      sessionId: session.id,
      nickname,
      reconnectToken: playerToken,
      role: 'PLAYER',
      connected: 0,
      socketId: null,
      createdAt: now,
      updatedAt: now
    });

    sessionRepository.touch(session.id, now, expirationDate());

    return {
      sessionCode: session.code,
      playerId,
      playerToken,
      role: 'PLAYER'
    };
  },

  reconnect(sessionCode, playerId, playerToken) {
    const session = ensureSessionByCode(sessionCode);
    const safePlayerId = requireNonEmptyString(playerId, 'playerId');
    const safePlayerToken = requireNonEmptyString(playerToken, 'playerToken');
    const player = playerRepository.findByIdAndToken(safePlayerId, safePlayerToken);
    if (!player || player.session_id !== session.id) {
      throw new AppError('Jeton de reconnexion invalide', 401);
    }
    sessionRepository.touch(session.id, new Date().toISOString(), expirationDate());

    return {
      sessionCode: session.code,
      playerId: player.id,
      playerToken: safePlayerToken,
      role: player.role,
      nickname: player.nickname
    };
  },

  leaveSession(sessionCode, playerId, playerToken) {
    const session = ensureSessionByCode(sessionCode);
    const safePlayerId = requireNonEmptyString(playerId, 'playerId');
    const safePlayerToken = requireNonEmptyString(playerToken, 'playerToken');
    const player = playerRepository.findByIdAndToken(safePlayerId, safePlayerToken);

    if (!player || player.session_id !== session.id) {
      throw new AppError('Requête de sortie invalide', 401);
    }

    playerRepository.remove(player.id);
    sessionRepository.touch(session.id, new Date().toISOString(), expirationDate());

    return {
      removedPlayerId: player.id,
      sessionCode: session.code
    };
  },

  startGame(sessionCode, playerId, playerToken) {
    const session = ensureSessionByCode(sessionCode);
    const safePlayerId = requireNonEmptyString(playerId, 'playerId');
    const safePlayerToken = requireNonEmptyString(playerToken, 'playerToken');
    const player = playerRepository.findByIdAndToken(safePlayerId, safePlayerToken);

    if (!player || player.session_id !== session.id || player.role !== 'HOST' || player.reconnect_token !== session.host_token) {
      throw new AppError('Seul l\'organisateur peut démarrer la partie', 403);
    }

    const now = new Date().toISOString();
    sessionRepository.updateStatus(session.id, GAME_STATUS.PLAYING, now);
    sessionRepository.touch(session.id, now, expirationDate());

    return {
      sessionCode: session.code,
      status: GAME_STATUS.PLAYING
    };
  },

  getSessionState(sessionCode) {
    const session = ensureSessionByCode(sessionCode);
    return getSessionAndPlayers(session);
  },

  attachSocket(sessionCode, playerId, playerToken, socketId) {
    const session = ensureSessionByCode(sessionCode);
    const safePlayerId = requireNonEmptyString(playerId, 'playerId');
    const safePlayerToken = requireNonEmptyString(playerToken, 'playerToken');
    const player = playerRepository.findByIdAndToken(safePlayerId, safePlayerToken);

    if (!player || player.session_id !== session.id) {
      throw new AppError('Authentification socket invalide', 401);
    }

    const now = new Date().toISOString();
    playerRepository.setConnection(player.id, true, socketId, now);
    sessionRepository.touch(session.id, now, expirationDate());

    return {
      session,
      player,
      state: this.getSessionState(session.code)
    };
  },

  detachSocketBySocketId(socketId) {
    const player = playerRepository.findBySocketId(socketId);
    if (!player) {
      return null;
    }

    const now = new Date().toISOString();
    playerRepository.setConnection(player.id, false, null, now);

    const session = sessionRepository.findById(player.session_id);
    const sessions = playerRepository.listBySession(player.session_id);
    return {
      playerId: player.id,
      sessionId: player.session_id,
      sessionCode: session?.code,
      players: sessions.map((entry) => ({
        ...entry,
        connected: Boolean(entry.connected)
      }))
    };
  },

  cleanupExpiredSessions() {
    return sessionRepository.deleteExpired(new Date().toISOString());
  }
};

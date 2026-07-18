import crypto from 'crypto';
import { readFileSync } from 'fs';
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
const tilesData = JSON.parse(
  readFileSync(new URL('../data/tiles.json', import.meta.url), 'utf-8')
);

const sessionTilesByPlayer = new Map();

const shuffle = (items) => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
};

const buildPlayerTiles = (players) => {
  const tilesByColor = new Map();
  for (const tile of tilesData) {
    const color = tile.couleur;
    const bucket = tilesByColor.get(color) || [];
    bucket.push(tile);
    tilesByColor.set(color, bucket);
  }

  const colors = [...tilesByColor.keys()];
  if (colors.length < 5) {
    throw new AppError('Configuration des tuiles invalide', 500);
  }

  const playerCount = players.length;
  for (const color of colors) {
    if ((tilesByColor.get(color) || []).length < playerCount) {
      throw new AppError('Pas assez de tuiles pour démarrer la partie', 409);
    }
  }

  const shuffledByColor = new Map();
  for (const [color, bucket] of tilesByColor.entries()) {
    shuffledByColor.set(color, shuffle(bucket));
  }

  const assignments = {};
  for (const player of players) {
    assignments[player.id] = [];
  }

  for (const color of colors) {
    const bucket = shuffledByColor.get(color);
    for (const player of players) {
      const tile = bucket.pop();
      assignments[player.id].push({
        chiffre: tile.chiffre,
        couleur: tile.couleur,
        nombrePoints: tile.nombrePoints
      });
    }
  }

  return assignments;
};

const toHiddenTileBacksByPlayer = (tilesByPlayer) => {
  const hidden = {};
  for (const [playerId, tiles] of Object.entries(tilesByPlayer || {})) {
    hidden[playerId] = (tiles || []).map((tile, index) => ({
      id: `${playerId}-${index + 1}`,
      couleur: tile.couleur
    }));
  }
  return hidden;
};

const expirationDate = () => {
  const expires = new Date();
  expires.setHours(expires.getHours() + env.SESSION_EXPIRATION_HOURS);
  return expires.toISOString();
};

const createJoinUrl = (code) => `${env.PUBLIC_APP_URL.replace(/\/$/, '')}/join/${code}`;

const getSessionAndPlayers = (session) => {
  const playerTilesById = toHiddenTileBacksByPlayer(sessionTilesByPlayer.get(session.id) || {});
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
    playerTilesById,
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
    const tiles = sessionTilesByPlayer.get(session.id);
    if (tiles && tiles[player.id]) {
      delete tiles[player.id];
      sessionTilesByPlayer.set(session.id, tiles);
    }

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

    const players = playerRepository.listBySession(session.id);
    if (players.length < 2) {
      throw new AppError('Au moins 2 joueurs sont nécessaires pour démarrer', 409);
    }

    const assignedTiles = buildPlayerTiles(players);
    sessionTilesByPlayer.set(session.id, assignedTiles);

    const now = new Date().toISOString();
    sessionRepository.updateStatus(session.id, GAME_STATUS.PLAYING, now);
    sessionRepository.touch(session.id, now, expirationDate());

    return {
      sessionCode: session.code,
      status: GAME_STATUS.PLAYING,
      state: this.getSessionState(session.code)
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

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
const tileColors = ['vert', 'rouge', 'bleu', 'rose', 'orange'];

const sessionTilesByPlayer = new Map();
const sessionSharedFaceUpTiles = new Map();
const sessionDrawHistoryTiles = new Map();
const sessionTurnByState = new Map();

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
    hidden[playerId] = [...(tiles || [])]
      .sort((first, second) => first.chiffre - second.chiffre)
      .map((tile, index) => ({
      id: `${playerId}-${index + 1}`,
      couleur: tile.couleur
      }));
  }
  return hidden;
};

const buildSharedFaceUpTiles = (tilesByPlayer) => {
  const assignedNumbers = new Set();
  for (const tiles of Object.values(tilesByPlayer || {})) {
    for (const tile of tiles || []) {
      assignedNumbers.add(tile.chiffre);
    }
  }

  const distinctByNumber = [];
  const seenNumbers = new Set();

  for (const color of tileColors) {
    const candidates = shuffle(
      tilesData.filter(
        (tile) => tile.couleur === color
          && !assignedNumbers.has(tile.chiffre)
          && !seenNumbers.has(tile.chiffre)
      )
    );

    const chosen = candidates[0];
    if (!chosen) {
      throw new AppError(
        'Pas assez de tuiles visibles communes disponibles pour couvrir toutes les couleurs',
        409
      );
    }

    seenNumbers.add(chosen.chiffre);
    distinctByNumber.push({
      id: `shared-${chosen.couleur}-${chosen.chiffre}`,
      chiffre: chosen.chiffre,
      couleur: chosen.couleur,
      nombrePoints: chosen.nombrePoints
    });
  }

  return distinctByNumber.sort((first, second) => first.chiffre - second.chiffre);
};

const buildRemainingTilesByColor = (tilesByPlayer, sharedFaceUpTiles) => {
  const remaining = Object.fromEntries(tileColors.map((color) => [color, 0]));

  for (const tile of tilesData) {
    if (tile.couleur in remaining) {
      remaining[tile.couleur] += 1;
    }
  }

  for (const tiles of Object.values(tilesByPlayer || {})) {
    for (const tile of tiles || []) {
      if (tile.couleur in remaining) {
        remaining[tile.couleur] = Math.max(0, remaining[tile.couleur] - 1);
      }
    }
  }

  for (const tile of sharedFaceUpTiles || []) {
    if (tile.couleur in remaining) {
      remaining[tile.couleur] = Math.max(0, remaining[tile.couleur] - 1);
    }
  }

  return remaining;
};

const buildRemainingTilesByColorWithHistory = (tilesByPlayer, sharedFaceUpTiles, drawHistoryTiles) => {
  return buildRemainingTilesByColor(tilesByPlayer, [...(sharedFaceUpTiles || []), ...(drawHistoryTiles || [])]);
};

const pickFirstTurn = (players) => {
  const candidates = shuffle(players || []);
  return candidates[0]?.id || null;
};

const getCurrentTurnPlayerId = (sessionId) => {
  const turnState = sessionTurnByState.get(sessionId);
  if (!turnState || !Array.isArray(turnState.order) || turnState.order.length === 0) {
    return null;
  }

  return turnState.order[turnState.currentIndex] || null;
};

const advanceTurn = (sessionId) => {
  const turnState = sessionTurnByState.get(sessionId);
  if (!turnState || !Array.isArray(turnState.order) || turnState.order.length === 0) {
    return;
  }

  turnState.currentIndex = (turnState.currentIndex + 1) % turnState.order.length;
  sessionTurnByState.set(sessionId, turnState);
};

const removePlayerFromTurnOrder = (sessionId, playerId) => {
  const turnState = sessionTurnByState.get(sessionId);
  if (!turnState || !Array.isArray(turnState.order) || turnState.order.length === 0) {
    return;
  }

  const removedIndex = turnState.order.indexOf(playerId);
  if (removedIndex === -1) {
    return;
  }

  turnState.order.splice(removedIndex, 1);

  if (turnState.order.length === 0) {
    sessionTurnByState.delete(sessionId);
    return;
  }

  if (removedIndex < turnState.currentIndex) {
    turnState.currentIndex -= 1;
  } else if (removedIndex === turnState.currentIndex) {
    turnState.currentIndex = turnState.currentIndex % turnState.order.length;
  }

  sessionTurnByState.set(sessionId, turnState);
};

const buildCrossedNumbersByPlayer = (tilesByPlayer, sharedFaceUpTiles) => {
  const entries = Object.entries(tilesByPlayer || {});
  const sharedNumbers = new Set((sharedFaceUpTiles || []).map((tile) => tile.chiffre));
  const crossed = {};

  for (const [playerId] of entries) {
    const numbers = new Set(sharedNumbers);

    for (const [otherPlayerId, otherTiles] of entries) {
      if (otherPlayerId === playerId) {
        continue;
      }

      for (const tile of otherTiles || []) {
        numbers.add(tile.chiffre);
      }
    }

    crossed[playerId] = [...numbers].sort((first, second) => first - second);
  }

  return crossed;
};

const expirationDate = () => {
  const expires = new Date();
  expires.setHours(expires.getHours() + env.SESSION_EXPIRATION_HOURS);
  return expires.toISOString();
};

const createJoinUrl = (code) => `${env.PUBLIC_APP_URL.replace(/\/$/, '')}/join/${code}`;

const getSessionAndPlayers = (session) => {
  const sourceTilesByPlayer = sessionTilesByPlayer.get(session.id) || {};
  const playerTilesById = toHiddenTileBacksByPlayer(sourceTilesByPlayer);
  const sharedFaceUpTiles = sessionSharedFaceUpTiles.get(session.id) || [];
  const drawHistoryTiles = sessionDrawHistoryTiles.get(session.id) || [];
  const crossedNumbersByPlayer = buildCrossedNumbersByPlayer(sourceTilesByPlayer, sharedFaceUpTiles);
  const remainingTilesByColor = buildRemainingTilesByColorWithHistory(
    sourceTilesByPlayer,
    sharedFaceUpTiles,
    drawHistoryTiles
  );
  const currentTurnPlayerId = getCurrentTurnPlayerId(session.id);
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
    sharedFaceUpTiles,
    crossedNumbersByPlayer,
    remainingTilesByColor,
    currentTurnPlayerId,
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
    removePlayerFromTurnOrder(session.id, player.id);

    return {
      removedPlayerId: player.id,
      sessionCode: session.code
    };
  },

  drawSharedTile(sessionCode, playerId, playerToken, color) {
    const session = ensureSessionByCode(sessionCode);
    const safePlayerId = requireNonEmptyString(playerId, 'playerId');
    const safePlayerToken = requireNonEmptyString(playerToken, 'playerToken');
    const safeColor = requireNonEmptyString(color, 'color').toLowerCase();
    const player = playerRepository.findByIdAndToken(safePlayerId, safePlayerToken);

    if (!player || player.session_id !== session.id) {
      throw new AppError('Authentification invalide', 401);
    }

    if (session.status !== GAME_STATUS.PLAYING) {
      throw new AppError('La partie doit être en cours pour piocher', 409);
    }

    if (!tileColors.includes(safeColor)) {
      throw new AppError('Couleur de pioche invalide', 400);
    }

    const currentTurnPlayerId = getCurrentTurnPlayerId(session.id);
    if (!currentTurnPlayerId || currentTurnPlayerId !== player.id) {
      throw new AppError('Ce n\'est pas votre tour', 409);
    }

    const assignedTiles = sessionTilesByPlayer.get(session.id) || {};
    const sharedFaceUpTiles = sessionSharedFaceUpTiles.get(session.id) || [];
    const drawHistoryTiles = sessionDrawHistoryTiles.get(session.id) || [];

    const usedTileKeys = new Set();
    for (const tiles of Object.values(assignedTiles)) {
      for (const tile of tiles || []) {
        usedTileKeys.add(`${tile.couleur}-${tile.chiffre}`);
      }
    }
    for (const tile of sharedFaceUpTiles) {
      usedTileKeys.add(`${tile.couleur}-${tile.chiffre}`);
    }
    for (const tile of drawHistoryTiles) {
      usedTileKeys.add(`${tile.couleur}-${tile.chiffre}`);
    }

    const candidates = shuffle(
      tilesData.filter(
        (tile) => tile.couleur === safeColor && !usedTileKeys.has(`${tile.couleur}-${tile.chiffre}`)
      )
    );

    const drawnTile = candidates[0];
    if (!drawnTile) {
      throw new AppError('Plus de tuiles disponibles pour cette couleur', 409);
    }

    const drawnEntry = {
      id: `shared-${drawnTile.couleur}-${drawnTile.chiffre}-${drawHistoryTiles.length + 1}`,
      chiffre: drawnTile.chiffre,
      couleur: drawnTile.couleur,
      nombrePoints: drawnTile.nombrePoints
    };

    const nextSharedTiles = [...sharedFaceUpTiles];
    if (nextSharedTiles.length < 6) {
      nextSharedTiles.push(drawnEntry);
    } else {
      nextSharedTiles[5] = drawnEntry;
    }

    sessionSharedFaceUpTiles.set(session.id, nextSharedTiles);
    sessionDrawHistoryTiles.set(session.id, [...drawHistoryTiles, drawnEntry]);
    advanceTurn(session.id);

    sessionRepository.touch(session.id, new Date().toISOString(), expirationDate());

    return {
      sessionCode: session.code,
      status: GAME_STATUS.PLAYING,
      state: this.getSessionState(session.code)
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
    const sharedFaceUpTiles = buildSharedFaceUpTiles(assignedTiles);
    const firstTurnPlayerId = pickFirstTurn(players);
    sessionTilesByPlayer.set(session.id, assignedTiles);
    sessionSharedFaceUpTiles.set(session.id, sharedFaceUpTiles);
    sessionDrawHistoryTiles.set(session.id, []);
    sessionTurnByState.set(session.id, {
      order: players.map((entry) => entry.id),
      currentIndex: Math.max(0, players.findIndex((entry) => entry.id === firstTurnPlayerId))
    });

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

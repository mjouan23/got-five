import { db } from '../database/db.js';

const insertPlayerStmt = db.prepare(`
  INSERT INTO players (id, session_id, nickname, reconnect_token, role, connected, socket_id, created_at, updated_at)
  VALUES (@id, @sessionId, @nickname, @reconnectToken, @role, @connected, @socketId, @createdAt, @updatedAt)
`);

const selectByIdStmt = db.prepare('SELECT * FROM players WHERE id = ?');
const selectByIdAndTokenStmt = db.prepare('SELECT * FROM players WHERE id = ? AND reconnect_token = ?');
const findBySessionAndNicknameStmt = db.prepare(
  'SELECT * FROM players WHERE session_id = ? AND LOWER(nickname) = LOWER(?) LIMIT 1'
);
const selectBySessionStmt = db.prepare(
  'SELECT id, session_id, nickname, role, connected, created_at, updated_at FROM players WHERE session_id = ? ORDER BY created_at ASC'
);
const countBySessionStmt = db.prepare('SELECT COUNT(*) AS total FROM players WHERE session_id = ?');
const updateConnectionStmt = db.prepare(`
  UPDATE players
  SET connected = @connected, socket_id = @socketId, updated_at = @updatedAt
  WHERE id = @id
`);
const deletePlayerStmt = db.prepare('DELETE FROM players WHERE id = ?');
const findBySocketStmt = db.prepare('SELECT * FROM players WHERE socket_id = ?');

export const playerRepository = {
  create(player) {
    insertPlayerStmt.run(player);
  },
  findById(id) {
    return selectByIdStmt.get(id);
  },
  findByIdAndToken(id, token) {
    return selectByIdAndTokenStmt.get(id, token);
  },
  findBySessionAndNickname(sessionId, nickname) {
    return findBySessionAndNicknameStmt.get(sessionId, nickname);
  },
  listBySession(sessionId) {
    return selectBySessionStmt.all(sessionId);
  },
  countBySession(sessionId) {
    return countBySessionStmt.get(sessionId).total;
  },
  setConnection(id, connected, socketId, updatedAt) {
    updateConnectionStmt.run({ id, connected: connected ? 1 : 0, socketId, updatedAt });
  },
  remove(id) {
    deletePlayerStmt.run(id);
  },
  findBySocketId(socketId) {
    return findBySocketStmt.get(socketId);
  }
};

import { db } from '../database/db.js';

const insertSessionStmt = db.prepare(`
  INSERT INTO sessions (id, code, status, host_player_id, host_token, created_at, updated_at, expires_at)
  VALUES (@id, @code, @status, @hostPlayerId, @hostToken, @createdAt, @updatedAt, @expiresAt)
`);

const updateHostPlayerStmt = db.prepare(
  'UPDATE sessions SET host_player_id = @hostPlayerId, updated_at = @updatedAt WHERE id = @sessionId'
);

const selectByCodeStmt = db.prepare('SELECT * FROM sessions WHERE code = ?');
const selectByIdStmt = db.prepare('SELECT * FROM sessions WHERE id = ?');

const touchSessionStmt = db.prepare(
  'UPDATE sessions SET updated_at = ?, expires_at = ? WHERE id = ?'
);

const updateSessionStatusStmt = db.prepare(
  'UPDATE sessions SET status = ?, updated_at = ? WHERE id = ?'
);

const deleteExpiredStmt = db.prepare('DELETE FROM sessions WHERE expires_at < ?');

export const sessionRepository = {
  create(session) {
    insertSessionStmt.run(session);
  },
  attachHostPlayer(sessionId, hostPlayerId, updatedAt) {
    updateHostPlayerStmt.run({ sessionId, hostPlayerId, updatedAt });
  },
  findByCode(code) {
    return selectByCodeStmt.get(code);
  },
  findById(id) {
    return selectByIdStmt.get(id);
  },
  touch(sessionId, updatedAt, expiresAt) {
    touchSessionStmt.run(updatedAt, expiresAt, sessionId);
  },
  updateStatus(sessionId, status, updatedAt) {
    updateSessionStatusStmt.run(status, updatedAt, sessionId);
  },
  deleteExpired(nowIso) {
    return deleteExpiredStmt.run(nowIso).changes;
  }
};

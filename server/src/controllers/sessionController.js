import { sessionService } from '../services/sessionService.js';

export const sessionController = {
  create(req, res, next) {
    try {
      const payload = sessionService.createSession(req.body.nickname);
      res.status(201).json(payload);
    } catch (error) {
      next(error);
    }
  },

  getPublic(req, res, next) {
    try {
      const payload = sessionService.getPublicSession(req.params.sessionCode);
      res.json(payload);
    } catch (error) {
      next(error);
    }
  },

  join(req, res, next) {
    try {
      const payload = sessionService.joinSession(req.params.sessionCode, req.body.nickname);
      res.status(201).json(payload);
    } catch (error) {
      next(error);
    }
  },

  reconnect(req, res, next) {
    try {
      const payload = sessionService.reconnect(
        req.params.sessionCode,
        req.body.playerId,
        req.body.playerToken
      );
      res.json(payload);
    } catch (error) {
      next(error);
    }
  },

  start(req, res, next) {
    try {
      const payload = sessionService.startGame(
        req.params.sessionCode,
        req.body.playerId,
        req.body.playerToken
      );
      res.json(payload);
    } catch (error) {
      next(error);
    }
  },

  leave(req, res, next) {
    try {
      const payload = sessionService.leaveSession(
        req.params.sessionCode,
        req.body.playerId,
        req.body.playerToken
      );
      res.json(payload);
    } catch (error) {
      next(error);
    }
  }
};

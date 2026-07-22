import { SOCKET_EVENTS } from '../../../shared/socket-events.js';
import { sessionService } from '../services/sessionService.js';

const roomName = (code) => `game:${code}`;

export const registerSocketHandlers = (io, socket) => {
  socket.on(SOCKET_EVENTS.SESSION_JOIN, (payload) => {
    try {
      const { sessionCode, playerId, playerToken } = payload || {};
      const result = sessionService.attachSocket(sessionCode, playerId, playerToken, socket.id);
      const code = result.session.code;

      socket.join(roomName(code));
      socket.emit(SOCKET_EVENTS.SESSION_STATE, result.state);
      socket.to(roomName(code)).emit(SOCKET_EVENTS.PLAYER_JOINED, {
        playerId: result.player.id,
        nickname: result.player.nickname,
        role: result.player.role
      });
      io.to(roomName(code)).emit(SOCKET_EVENTS.PLAYER_CONNECTED, {
        playerId: result.player.id
      });
      io.to(roomName(code)).emit(
        SOCKET_EVENTS.SESSION_STATE,
        sessionService.getSessionState(code)
      );
    } catch (error) {
      socket.emit(SOCKET_EVENTS.SESSION_ERROR, { message: error.message });
    }
  });

  socket.on(SOCKET_EVENTS.SESSION_LEAVE, (payload) => {
    try {
      const { sessionCode, playerId, playerToken } = payload || {};
      const result = sessionService.leaveSession(sessionCode, playerId, playerToken);
      socket.leave(roomName(result.sessionCode));
      io.to(roomName(result.sessionCode)).emit(SOCKET_EVENTS.PLAYER_LEFT, {
        playerId: result.removedPlayerId
      });
      io.to(roomName(result.sessionCode)).emit(
        SOCKET_EVENTS.SESSION_STATE,
        sessionService.getSessionState(result.sessionCode)
      );
    } catch (error) {
      socket.emit(SOCKET_EVENTS.SESSION_ERROR, { message: error.message });
    }
  });

  socket.on(SOCKET_EVENTS.GAME_START, (payload) => {
    try {
      const { sessionCode, playerId, playerToken } = payload || {};
      const started = sessionService.startGame(sessionCode, playerId, playerToken);
      io.to(roomName(started.sessionCode)).emit(SOCKET_EVENTS.GAME_STARTED, started);
      io.to(roomName(started.sessionCode)).emit(
        SOCKET_EVENTS.SESSION_STATE,
        sessionService.getSessionState(started.sessionCode)
      );
    } catch (error) {
      socket.emit(SOCKET_EVENTS.SESSION_ERROR, { message: error.message });
    }
  });

  socket.on(SOCKET_EVENTS.GAME_DRAW, (payload) => {
    try {
      const { sessionCode, playerId, playerToken, color } = payload || {};
      const drawn = sessionService.drawSharedTile(sessionCode, playerId, playerToken, color);
      io.to(roomName(drawn.sessionCode)).emit(SOCKET_EVENTS.GAME_DRAWN, drawn);
      io.to(roomName(drawn.sessionCode)).emit(
        SOCKET_EVENTS.SESSION_STATE,
        sessionService.getSessionState(drawn.sessionCode)
      );
    } catch (error) {
      socket.emit(SOCKET_EVENTS.SESSION_ERROR, { message: error.message });
    }
  });

  socket.on('disconnect', () => {
    const detached = sessionService.detachSocketBySocketId(socket.id);
    if (!detached) {
      return;
    }

    const sessionCode = detached.sessionCode;

    if (!sessionCode) {
      return;
    }

    io.to(roomName(sessionCode)).emit(SOCKET_EVENTS.PLAYER_DISCONNECTED, {
      playerId: detached.playerId
    });
    io.to(roomName(sessionCode)).emit(
      SOCKET_EVENTS.SESSION_STATE,
      sessionService.getSessionState(sessionCode)
    );
  });
};

import { defineStore } from 'pinia';
import { sessionApi } from '../services/api';
import { storageService } from '../services/storageService';

export const useSessionStore = defineStore('session', {
  state: () => ({
    sessionCode: '',
    playerId: '',
    playerToken: '',
    nickname: '',
    role: '',
    status: 'idle',
    players: [],
    gameStatus: 'LOBBY',
    error: ''
  }),
  getters: {
    isHost: (state) => state.role === 'HOST',
    hasIdentity: (state) => Boolean(state.sessionCode && state.playerId && state.playerToken)
  },
  actions: {
    setError(message) {
      this.error = message || '';
    },
    setIdentity(payload) {
      this.sessionCode = payload.sessionCode;
      this.playerId = payload.playerId;
      this.playerToken = payload.playerToken;
      this.nickname = payload.nickname;
      this.role = payload.role;
      storageService.saveSession({
        sessionCode: this.sessionCode,
        playerId: this.playerId,
        playerToken: this.playerToken,
        nickname: this.nickname,
        role: this.role
      });
    },
    hydrateFromStorage() {
      const saved = storageService.getSession();
      if (saved) {
        this.sessionCode = saved.sessionCode || '';
        this.playerId = saved.playerId || '';
        this.playerToken = saved.playerToken || '';
        this.nickname = saved.nickname || '';
        this.role = saved.role || '';
      }
    },
    clearIdentity() {
      this.sessionCode = '';
      this.playerId = '';
      this.playerToken = '';
      this.nickname = '';
      this.role = '';
      this.players = [];
      this.gameStatus = 'LOBBY';
      storageService.clear();
    },
    updateSessionState(payload) {
      this.sessionCode = payload.sessionCode;
      this.players = payload.players || [];
      this.gameStatus = payload.status;
    },
    async ensureSessionExists(code) {
      return sessionApi.getSession(code);
    }
  }
});

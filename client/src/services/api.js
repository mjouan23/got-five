import axios from 'axios';

const apiBaseUrl = import.meta.env.VITE_API_URL || '';

export const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 10000,
  withCredentials: true
});

export const sessionApi = {
  async createSession(nickname) {
    const { data } = await api.post('/api/sessions', { nickname });
    return data;
  },
  async getSession(sessionCode) {
    const { data } = await api.get(`/api/sessions/${sessionCode}`);
    return data;
  },
  async joinSession(sessionCode, nickname) {
    const { data } = await api.post(`/api/sessions/${sessionCode}/join`, { nickname });
    return data;
  },
  async reconnect(sessionCode, playerId, playerToken) {
    const { data } = await api.post(`/api/sessions/${sessionCode}/reconnect`, {
      playerId,
      playerToken
    });
    return data;
  },
  async startSession(sessionCode, playerId, playerToken) {
    const { data } = await api.post(`/api/sessions/${sessionCode}/start`, {
      playerId,
      playerToken
    });
    return data;
  },
  async leaveSession(sessionCode, playerId, playerToken) {
    const { data } = await api.post(`/api/sessions/${sessionCode}/leave`, {
      playerId,
      playerToken
    });
    return data;
  }
};

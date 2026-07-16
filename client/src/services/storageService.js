const KEY = 'gotfive:player';

export const storageService = {
  saveSession(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  },
  getSession() {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw);
    } catch (_error) {
      localStorage.removeItem(KEY);
      return null;
    }
  },
  clear() {
    localStorage.removeItem(KEY);
  }
};

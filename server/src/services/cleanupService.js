import { sessionService } from './sessionService.js';

export const startCleanupJob = () => {
  const intervalMs = 60 * 60 * 1000;
  return setInterval(() => {
    sessionService.cleanupExpiredSessions();
  }, intervalMs);
};

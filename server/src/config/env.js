import dotenv from 'dotenv';

dotenv.config();

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export const env = {
  PORT: toInt(process.env.PORT, 3000),
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  PUBLIC_APP_URL: process.env.PUBLIC_APP_URL || 'http://localhost:5173',
  SQLITE_PATH: process.env.SQLITE_PATH || './data/got-five.sqlite',
  SESSION_EXPIRATION_HOURS: toInt(process.env.SESSION_EXPIRATION_HOURS, 24),
  MAX_PLAYERS_PER_SESSION: toInt(process.env.MAX_PLAYERS_PER_SESSION, 10)
};

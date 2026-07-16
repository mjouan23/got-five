import { AppError } from './errors.js';

const NICKNAME_REGEX = /^[\p{L}\p{N}_\- ]+$/u;
const SESSION_CODE_REGEX = /^[A-HJ-NP-Z2-9]{6}$/;

export const normalizeSessionCode = (value) => String(value || '').trim().toUpperCase();

export const validateSessionCode = (value) => {
  const code = normalizeSessionCode(value);
  if (!SESSION_CODE_REGEX.test(code)) {
    throw new AppError('Code de session invalide', 400);
  }
  return code;
};

export const requireNonEmptyString = (value, label) => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw new AppError(`${label} manquant`, 400);
  }
  return normalized;
};

export const sanitizeNickname = (value) => {
  const nickname = String(value || '').replace(/\s+/g, ' ').trim();

  if (nickname.length < 2 || nickname.length > 20) {
    throw new AppError('Le pseudonyme doit contenir entre 2 et 20 caractères', 400);
  }

  if (!NICKNAME_REGEX.test(nickname)) {
    throw new AppError('Le pseudonyme contient des caractères non autorisés', 400);
  }

  return nickname;
};

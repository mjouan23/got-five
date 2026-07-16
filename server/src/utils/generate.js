import crypto from 'crypto';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const generateSessionCode = () => {
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    const idx = crypto.randomInt(0, CODE_ALPHABET.length);
    code += CODE_ALPHABET[idx];
  }
  return code;
};

export const generateToken = () => crypto.randomUUID();

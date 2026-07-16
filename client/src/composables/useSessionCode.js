export const normalizeSessionCode = (code) => String(code || '').trim().toUpperCase();

const SESSION_CODE_REGEX = /^[A-HJ-NP-Z2-9]{6}$/;

export const extractSessionCode = (value) => {
  const normalized = normalizeSessionCode(value);
  if (SESSION_CODE_REGEX.test(normalized)) {
    return normalized;
  }
  return '';
};

export const extractCodeFromUrl = (url) => {
  const directCode = extractSessionCode(url);
  if (directCode) {
    return directCode;
  }

  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length >= 2 && parts[0].toLowerCase() === 'join') {
      return extractSessionCode(parts[1]);
    }
    return '';
  } catch (_error) {
    return '';
  }
};

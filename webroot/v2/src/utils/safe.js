export const asArray = value => Array.isArray(value) ? value : [];

export const asObject = value => (
  value && typeof value === 'object' && !Array.isArray(value) ? value : {}
);

export const safeJSON = (value, fallback = []) => {
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

export const errorMessage = (error, fallback = 'The system is temporarily unavailable. Please try again later.') => {
  if (typeof error === 'string' && error.trim()) return error;
  if (error && typeof error.message === 'string' && error.message.trim()) return error.message;
  return fallback;
};

export const isMounted = root => Boolean(root && root.isConnected);

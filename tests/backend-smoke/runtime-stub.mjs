export const secrets = { get: (k) => globalThis.__secrets?.[k] ?? '' };

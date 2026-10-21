export const AVATAR_COLORS = ['#166534', '#1d4ed8', '#7e22ce', '#be185d', '#b45309', '#0e7490', '#4338ca', '#9f1239', '#0f766e', '#334155', '#6d28d9', '#a21caf'];

export const normalizeAvatarColor = (value) => {
  const color = String(value || '').toLowerCase();
  return AVATAR_COLORS.includes(color) ? color : null;
};

export function randomAvatarColor() {
  const values = new Uint32Array(1);
  globalThis.crypto.getRandomValues(values);
  return AVATAR_COLORS[values[0] % AVATAR_COLORS.length];
}

/** @param {{avatar_color?: string, id?: string, email?: string, full_name?: string}} user */
export function avatarColor(user = {}) {
  const saved = normalizeAvatarColor(user.avatar_color);
  if (saved) return saved;
  // Stable fallback for old cached sessions until their persisted color is loaded.
  let hash = 0;
  for (const letter of String(user.id || user.email || user.full_name || 'U')) hash = (hash * 31 + letter.codePointAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export const avatarInitial = (name) => Array.from(String(name || '').trim())[0]?.toLocaleUpperCase('pt-BR') || 'U';

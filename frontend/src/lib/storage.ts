// Thin persistence layer over localStorage so a page refresh doesn't lose
// the session — this is a test console, so "survives a reload" matters more
// than it would in a production SPA with stricter token-storage requirements.
const KEYS = {
  accessToken: "taskflow.accessToken",
  refreshToken: "taskflow.refreshToken",
  organizationId: "taskflow.organizationId",
  user: "taskflow.user",
} as const;

export const storage = {
  getAccessToken: () => localStorage.getItem(KEYS.accessToken),
  getRefreshToken: () => localStorage.getItem(KEYS.refreshToken),
  getOrganizationId: () => localStorage.getItem(KEYS.organizationId),
  getUser: <T,>(): T | null => {
    const raw = localStorage.getItem(KEYS.user);
    return raw ? (JSON.parse(raw) as T) : null;
  },
  setSession(tokens: { accessToken: string; refreshToken: string }) {
    localStorage.setItem(KEYS.accessToken, tokens.accessToken);
    localStorage.setItem(KEYS.refreshToken, tokens.refreshToken);
  },
  setUser(user: unknown) {
    localStorage.setItem(KEYS.user, JSON.stringify(user));
  },
  setOrganizationId(id: string) {
    localStorage.setItem(KEYS.organizationId, id);
  },
  clear() {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
  },
};

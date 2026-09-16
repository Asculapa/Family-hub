// Web is not an MVP target. Browser storage with the PKCE flow (spec section 8);
// guarded because static rendering runs without `window`.
const store = () => (typeof window === 'undefined' ? undefined : window.localStorage);

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    return store()?.getItem(key) ?? null;
  },
  async setItem(key: string, value: string): Promise<void> {
    store()?.setItem(key, value);
  },
  async removeItem(key: string): Promise<void> {
    store()?.removeItem(key);
  },
};

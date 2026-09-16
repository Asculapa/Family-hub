import * as SecureStore from 'expo-secure-store';

// SecureStore values should stay under ~2 KB; a Supabase session is larger,
// so values are split into chunks stored under `<key>.0`, `<key>.1`, ...
const CHUNK_SIZE = 1800;

async function chunkCount(key: string): Promise<number> {
  const n = await SecureStore.getItemAsync(`${key}.n`);
  return n === null ? 0 : Number(n);
}

/** Key-value storage in Keychain / Keystore (FR-1.4). */
export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    const n = await chunkCount(key);
    if (n === 0) return null;
    const parts = await Promise.all(
      Array.from({ length: n }, (_, i) => SecureStore.getItemAsync(`${key}.${i}`)),
    );
    return parts.some((p) => p === null) ? null : parts.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    await secureStorage.removeItem(key);
    const chunks = value.match(new RegExp(`[\\s\\S]{1,${CHUNK_SIZE}}`, 'g')) ?? [''];
    await Promise.all(chunks.map((c, i) => SecureStore.setItemAsync(`${key}.${i}`, c)));
    await SecureStore.setItemAsync(`${key}.n`, String(chunks.length));
  },

  async removeItem(key: string): Promise<void> {
    const n = await chunkCount(key);
    await Promise.all(
      Array.from({ length: n }, (_, i) => SecureStore.deleteItemAsync(`${key}.${i}`)),
    );
    await SecureStore.deleteItemAsync(`${key}.n`);
  },
};

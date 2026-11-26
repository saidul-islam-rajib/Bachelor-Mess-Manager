import type { KeyValueStore } from './index';

export { STORAGE_KEYS } from './index';

const mem = new Map<string, string>();

export const storage: KeyValueStore = {
  get: async (key) => mem.get(key) ?? null,
  set: async (key, value) => {
    mem.set(key, value);
  },
  remove: async (key) => {
    mem.delete(key);
  },
};

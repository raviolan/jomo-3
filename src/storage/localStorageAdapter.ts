export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export const localStorageAdapter: KeyValueStorage = {
  async getItem(key: string) {
    if (!isStorageAvailable()) {
      return null;
    }

    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string) {
    if (!isStorageAvailable()) {
      return;
    }

    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Treat storage as optional so schedule browsing still works offline.
    }
  }
};

function isStorageAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

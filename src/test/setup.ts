import "@testing-library/jest-dom";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key: string) {
      return values.has(key) ? values.get(key) ?? null : null;
    },
    key(index: number) {
      return Array.from(values.keys())[index] ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      values.set(key, String(value));
    },
  };
}

function ensureGlobalStorage(name: "localStorage" | "sessionStorage") {
  let storage: Storage;

  try {
    storage = window[name];
    storage.setItem("__bathos_test_storage_probe__", "1");
    storage.removeItem("__bathos_test_storage_probe__");
  } catch {
    storage = createMemoryStorage();
    Object.defineProperty(window, name, {
      configurable: true,
      value: storage,
    });
  }

  Object.defineProperty(globalThis, name, {
    configurable: true,
    value: storage,
  });
}

ensureGlobalStorage("localStorage");
ensureGlobalStorage("sessionStorage");

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

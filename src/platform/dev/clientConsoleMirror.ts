const CLIENT_LOG_ENDPOINT = "/__bathos_dev/client-log";
const MAX_SERIALIZED_LENGTH = 5_000;

type ConsoleLevel = "log" | "info" | "warn" | "error" | "debug";
type ConsoleMethod = (...args: unknown[]) => void;

declare global {
  interface Window {
    __bathosClientConsoleMirrorInstalled?: boolean;
  }
}

function truncate(value: string): string {
  return value.length <= MAX_SERIALIZED_LENGTH ? value : `${value.slice(0, MAX_SERIALIZED_LENGTH)}...`;
}

function stringifyValue(value: unknown, seen = new WeakSet<object>()): string {
  if (typeof value === "string") {
    return value;
  }

  if (value instanceof Error) {
    return value.stack || value.message || value.name;
  }

  if (value === undefined) {
    return "undefined";
  }

  if (typeof value === "function") {
    return `[Function ${value.name || "anonymous"}]`;
  }

  if (typeof value === "symbol") {
    return value.toString();
  }

  if (typeof value === "bigint") {
    return `${value.toString()}n`;
  }

  if (typeof value === "object" && value !== null) {
    try {
      return JSON.stringify(value, (_, currentValue) => {
        if (typeof currentValue === "bigint") {
          return `${currentValue.toString()}n`;
        }
        if (typeof currentValue === "symbol") {
          return currentValue.toString();
        }
        if (typeof currentValue === "function") {
          return `[Function ${currentValue.name || "anonymous"}]`;
        }
        if (currentValue && typeof currentValue === "object") {
          if (seen.has(currentValue)) {
            return "[Circular]";
          }
          seen.add(currentValue);
        }
        return currentValue;
      });
    } catch {
      return Object.prototype.toString.call(value);
    }
  }

  return String(value);
}

function sendClientLog(level: ConsoleLevel, args: unknown[]): void {
  try {
    const body = JSON.stringify({
      level,
      message: truncate(args.map((arg) => stringifyValue(arg)).join(" ")),
      path: `${window.location.pathname}${window.location.search}`,
      timestamp: new Date().toISOString(),
    });

    if (typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(CLIENT_LOG_ENDPOINT, blob);
      return;
    }

    void fetch(CLIENT_LOG_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Avoid throwing from console patching.
  }
}

export function installClientConsoleMirror(): void {
  if (typeof window === "undefined" || window.__bathosClientConsoleMirrorInstalled) {
    return;
  }
  window.__bathosClientConsoleMirrorInstalled = true;

  const methods: ConsoleLevel[] = ["log", "info", "warn", "error", "debug"];
  for (const method of methods) {
    const original = console[method].bind(console) as ConsoleMethod;
    (console[method] as ConsoleMethod) = (...args: unknown[]) => {
      original(...args);
      sendClientLog(method, args);
    };
  }

  window.addEventListener("error", (event) => {
    sendClientLog("error", [event.message, event.error]);
  });

  window.addEventListener("unhandledrejection", (event) => {
    sendClientLog("error", ["Unhandled promise rejection", event.reason]);
  });
}

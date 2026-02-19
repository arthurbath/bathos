import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const CLIENT_LOG_ENDPOINT = "/__bathos_dev/client-log";

function clientConsoleMirrorPlugin(): Plugin {
  return {
    name: "bathos-client-console-mirror",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith(CLIENT_LOG_ENDPOINT)) {
          next();
          return;
        }

        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end();
          return;
        }

        let raw = "";
        req.on("data", (chunk) => {
          raw += String(chunk);
        });
        req.on("end", () => {
          try {
            const payload = JSON.parse(raw) as {
              level?: string;
              message?: string;
              path?: string;
              timestamp?: string;
            };
            const level = typeof payload.level === "string" ? payload.level : "log";
            const message = typeof payload.message === "string" ? payload.message : "";
            const path = typeof payload.path === "string" ? payload.path : "";
            const timestamp = typeof payload.timestamp === "string" ? payload.timestamp : new Date().toISOString();
            const source = path ? ` ${path}` : "";
            const line = `[client:${level}] ${timestamp}${source} ${message}`;

            if (level === "error") {
              console.error(line);
            } else if (level === "warn") {
              console.warn(line);
            } else if (level === "debug") {
              console.debug(line);
            } else {
              console.log(line);
            }
          } catch {
            console.warn("[client-log] Failed to parse client log payload");
          }

          res.statusCode = 204;
          res.end();
        });
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), clientConsoleMirrorPlugin(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));

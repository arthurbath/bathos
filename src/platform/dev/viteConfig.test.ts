// @vitest-environment node

import { readFileSync } from "node:fs";
import type { ConfigEnv, Plugin, UserConfig } from "vite";
import viteConfig from "../../../vite.config";

function resolveUserConfig(command: ConfigEnv["command"], mode: string): UserConfig {
  if (typeof viteConfig !== "function") {
    return viteConfig;
  }

  return viteConfig({
    command,
    mode,
    isSsrBuild: false,
    isPreview: false,
  });
}

function readPackageScripts(): Record<string, string> {
  const packageJson = JSON.parse(
    readFileSync(new URL("../../../package.json", import.meta.url), "utf8"),
  ) as { scripts?: Record<string, string> };

  return packageJson.scripts ?? {};
}

describe("Vite development exposure", () => {
  it("binds ordinary development to IPv4 loopback", () => {
    const config = resolveUserConfig("serve", "development");

    expect(config.server?.host).toBe("127.0.0.1");
    expect(config.server?.port).toBe(8080);
  });

  it("requires an explicit command to bind development to all interfaces", () => {
    const scripts = readPackageScripts();

    expect(scripts.dev).not.toContain("--host");
    expect(scripts["dev:lan"]).toMatch(/vite\s+--host\s+0\.0\.0\.0(?:\s|$)/);
  });

  it("limits the client-console endpoint plugin to the development server", () => {
    const config = resolveUserConfig("build", "production");
    const mirrorPlugin = config.plugins
      ?.flat()
      .find((plugin): plugin is Plugin => Boolean(plugin) && typeof plugin === "object" && plugin.name === "bathos-client-console-mirror");

    expect(mirrorPlugin).toBeDefined();
    expect(mirrorPlugin?.apply).toBe("serve");
  });
});

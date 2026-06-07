import { describe, expect, it } from "vitest";
import { isIgnorableBrowserAbort, PRODUCTION_SENTRY_HOSTS, shouldEnableSentry } from "@/platform/sentry";

describe("shouldEnableSentry", () => {
  it("enables Sentry on production BathOS hosts", () => {
    PRODUCTION_SENTRY_HOSTS.forEach((host) => {
      expect(shouldEnableSentry("https://example@sentry.io/123", host)).toBe(true);
    });
  });

  it("disables Sentry when the DSN is missing", () => {
    expect(shouldEnableSentry(undefined, "os.bath.garden")).toBe(false);
  });

  it("disables Sentry on non-production hosts", () => {
    expect(shouldEnableSentry("https://example@sentry.io/123", "localhost")).toBe(false);
    expect(shouldEnableSentry("https://example@sentry.io/123", "budget.bath.garden")).toBe(false);
    expect(shouldEnableSentry("https://example@sentry.io/123", "preview.lovableproject.com")).toBe(false);
  });
});

describe("isIgnorableBrowserAbort", () => {
  it("drops Sentry events for browser abort errors", () => {
    expect(
      isIgnorableBrowserAbort({
        exception: {
          values: [
            {
              type: "Error",
              value: "AbortError: The operation was aborted.",
            },
          ],
        },
      }),
    ).toBe(true);
  });

  it("drops aborts from the original exception", () => {
    expect(
      isIgnorableBrowserAbort(
        {},
        {
          originalException: new DOMException("The operation was aborted.", "AbortError"),
        },
      ),
    ).toBe(true);
  });

  it("keeps ordinary application errors", () => {
    expect(
      isIgnorableBrowserAbort({
        exception: {
          values: [
            {
              type: "Error",
              value: "Missing household id.",
            },
          ],
        },
      }),
    ).toBe(false);
  });
});

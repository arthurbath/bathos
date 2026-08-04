import { Fragment } from "react";
import { describe, expect, it } from "vitest";

import {
  estimateToastTextLines,
  getToastDurationMs,
  TOAST_APPROXIMATE_CHARACTERS_PER_LINE,
} from "@/lib/toastDuration";

describe("toast duration", () => {
  it("uses the one-second minimum when a toast has no readable text", () => {
    expect(getToastDurationMs()).toBe(1_000);
  });

  it("shows one short text block for one second", () => {
    expect(getToastDurationMs("Saved")).toBe(1_000);
    expect(getToastDurationMs(undefined, "The task now appears in Upcoming.")).toBe(1_000);
  });

  it("counts a title and description as separate visible lines", () => {
    expect(getToastDurationMs("Operation Failed", "Please try again.")).toBe(2_000);
  });

  it("adds a line when text crosses the approximate mobile line capacity", () => {
    expect(estimateToastTextLines("a".repeat(TOAST_APPROXIMATE_CHARACTERS_PER_LINE))).toBe(1);
    expect(estimateToastTextLines("a".repeat(TOAST_APPROXIMATE_CHARACTERS_PER_LINE + 1))).toBe(2);
  });

  it("counts explicit line breaks independently", () => {
    expect(estimateToastTextLines("First line\nSecond line\r\nThird line")).toBe(3);
  });

  it("combines wrapped title and description estimates", () => {
    const wrappedTitle = "a".repeat(TOAST_APPROXIMATE_CHARACTERS_PER_LINE + 1);
    expect(getToastDurationMs(wrappedTitle, "One description line")).toBe(3_000);
  });

  it("reads structured React content and line breaks", () => {
    const content = (
      <Fragment>
        First
        <strong> structured</strong>
        <br />
        Second
      </Fragment>
    );

    expect(estimateToastTextLines(content)).toBe(2);
    expect(getToastDurationMs(content)).toBe(2_000);
  });

  it("reads deferred toast content", () => {
    expect(getToastDurationMs(() => "Deferred title", () => "Deferred description")).toBe(2_000);
  });
});

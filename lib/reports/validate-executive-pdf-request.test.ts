import { describe, expect, it } from "vitest";
import { parseExecutivePdfRequestBody } from "@/lib/reports/validate-executive-pdf-request";

describe("parseExecutivePdfRequestBody", () => {
  it("accepts an empty body for default export settings", () => {
    expect(parseExecutivePdfRequestBody({})).toEqual({
      valid: true,
      body: {},
    });
  });

  it("rejects invalid request bodies", () => {
    expect(parseExecutivePdfRequestBody("invalid")).toEqual({
      valid: false,
      error: "Request body must be a JSON object.",
    });
  });

  it("rejects invalid threshold values", () => {
    expect(
      parseExecutivePdfRequestBody({ heldOpenThresholdSeconds: 0 }),
    ).toEqual({
      valid: false,
      error: "heldOpenThresholdSeconds must be a positive number.",
    });
  });

  it("requires custom dates when period is custom", () => {
    expect(parseExecutivePdfRequestBody({ period: "custom" })).toEqual({
      valid: false,
      error: "Custom reporting periods require customStart and customEnd.",
    });
  });

  it("accepts a valid custom period request", () => {
    expect(
      parseExecutivePdfRequestBody({
        period: "custom",
        customStart: "2026-07-01",
        customEnd: "2026-07-07",
        heldOpenThresholdSeconds: 30,
      }),
    ).toEqual({
      valid: true,
      body: {
        period: "custom",
        customStart: "2026-07-01",
        customEnd: "2026-07-07",
        heldOpenThresholdSeconds: 30,
      },
    });
  });
});

import { describe, expect, it } from "vitest";
import { normalizeNumber, unavailable } from "@/lib/sources/common";

describe("source helpers", () => {
  it("normalizes ArcGIS sentinel values to null", () => {
    expect(normalizeNumber(-999999)).toBeNull();
    expect(normalizeNumber("-9999")).toBeNull();
    expect(normalizeNumber("8.52")).toBe(8.52);
  });

  it("creates unavailable source results", () => {
    const result = unavailable({ name: "Layer", url: "https://example.com" }, "down");

    expect(result.status).toBe("unavailable");
    expect(result.data).toBeNull();
    expect(result.reason).toBe("down");
  });
});

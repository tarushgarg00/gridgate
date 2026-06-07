import { describe, expect, it } from "vitest";
import { deterministicNarrative } from "@/lib/ai/narrative";
import type { SiteBrief } from "@/types/site-brief";

describe("narrative", () => {
  it("uses deterministic values and preserves recommendation", () => {
    const text = deterministicNarrative({
      name: "Test Site",
      recommendation: "Conditional",
      score: { total: 60 },
      keyRisks: ["Queue risk"],
      power: {
        nearestHvLine: null,
        nearestSubstation: null,
        queue: {
          status: "unavailable",
          data: null,
          source: { name: "Queue", url: "https://example.com" },
          reason: "missing",
        },
      },
    } as SiteBrief);

    expect(text).toContain("Conditional");
    expect(text).toContain("60");
    expect(text).toContain("Queue risk");
  });
});

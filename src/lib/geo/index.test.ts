import { describe, expect, it } from "vitest";
import {
  createBBox,
  distanceMiles,
  nearestHvTransmissionLine,
} from "@/lib/geo";
import type { TransmissionLine } from "@/types/site-brief";

describe("geo helpers", () => {
  it("creates a bbox around a coordinate", () => {
    const box = createBBox({ lat: 40, lng: -83 }, 10);

    expect(box.west).toBeLessThan(-83);
    expect(box.east).toBeGreaterThan(-83);
    expect(box.south).toBeLessThan(40);
    expect(box.north).toBeGreaterThan(40);
  });

  it("computes distance in miles", () => {
    const value = distanceMiles(
      { lat: 40.0817, lng: -82.8088 },
      { lat: 40.116491, lng: -83.001985 },
    );

    expect(value).toBeGreaterThan(9);
    expect(value).toBeLessThan(12);
  });

  it("filters nearest HV transmission line by voltage", () => {
    const lines: TransmissionLine[] = [
      line("low", 138, 1),
      line("high", 345, 4),
      line("closer-high", 230, 2),
    ];

    expect(nearestHvTransmissionLine(lines)?.id).toBe("closer-high");
  });
});

function line(id: string, voltageKv: number, distanceMiles: number): TransmissionLine {
  return {
    id,
    voltageKv,
    voltageClass: null,
    owner: null,
    status: null,
    type: null,
    distanceMiles,
    sourceSubstation: null,
    targetSubstation: null,
  };
}

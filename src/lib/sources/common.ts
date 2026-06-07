import type { BBox, Coordinates, SourceRef, SourceResult } from "@/types/site-brief";

export type SourceContext = {
  coordinates: Coordinates;
  bbox: BBox;
  state: string;
  region: string;
};

export function ok<T>(data: T, source: SourceRef): SourceResult<T> {
  return {
    status: "ok",
    data,
    source: withAccessedAt(source),
  };
}

export function unavailable<T>(
  source: SourceRef,
  reason: string,
): SourceResult<T> {
  return {
    status: "unavailable",
    data: null,
    source: withAccessedAt(source),
    reason,
  };
}

export async function safeJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "User-Agent": "GridGate site screener",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

export function source(name: string, url: string): SourceRef {
  return { name, url };
}

export function endpointWithParams(base: string, params: Record<string, string>) {
  const search = new URLSearchParams(params);
  return `${base}?${search.toString()}`;
}

export function normalizeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= -9999) {
    return null;
  }

  return numberValue;
}

function withAccessedAt(ref: SourceRef): SourceRef {
  return {
    ...ref,
    accessedAt: ref.accessedAt ?? new Date().toISOString(),
  };
}

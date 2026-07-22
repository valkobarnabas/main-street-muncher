import type { LatLng, ViewBounds } from "../types";
import { validateViewSize } from "../maze/validate";

const cache = new Map<string, LatLng[][]>();
const inflight = new Map<string, Promise<LatLng[][]>>();

/** Cancels the previous best-effort prefetch when the view changes. */
let prefetchAbort: AbortController | null = null;

/** Dev-only Vite proxy (custom UA). Not available on GitHub Pages. */
const DEV_PROXY = "/api/overpass";

/**
 * Public Overpass mirrors that accept browser requests + CORS.
 * overpass-api.de is omitted — it often returns 406 for stock browser UAs.
 */
const MIRRORS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

function overpassEndpoints(): string[] {
  return import.meta.env.DEV ? [DEV_PROXY, ...MIRRORS] : [...MIRRORS];
}

function bboxKey(b: ViewBounds): string {
  return [b.south, b.west, b.north, b.east]
    .map((n) => n.toFixed(4))
    .join(",");
}

function buildQuery(bounds: ViewBounds): string {
  const highways = [
    "motorway",
    "trunk",
    "primary",
    "secondary",
    "tertiary",
    "unclassified",
    "residential",
    "living_street",
  ].join("|");

  return `
[out:json][timeout:12];
way["highway"~"^(${highways})$"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
out geom;
`.trim();
}

function parseWays(data: {
  elements?: Array<{
    type: string;
    tags?: Record<string, string>;
    geometry?: Array<{ lat: number; lon: number }>;
  }>;
}): LatLng[][] {
  const ways: LatLng[][] = [];
  for (const el of data.elements ?? []) {
    if (el.type !== "way" || !el.geometry || el.geometry.length < 2) continue;
    ways.push(el.geometry.map((g) => ({ lat: g.lat, lon: g.lon })));
  }
  return ways;
}

async function postOverpass(
  url: string,
  query: string,
  signal: AbortSignal,
): Promise<LatLng[][]> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: `data=${encodeURIComponent(query)}`,
    signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as {
    elements?: Array<{
      type: string;
      tags?: Record<string, string>;
      geometry?: Array<{ lat: number; lon: number }>;
    }>;
  };
  if (!data.elements) throw new Error("unexpected response");
  return parseWays(data);
}

async function fetchStreetsUncached(
  bounds: ViewBounds,
  outerSignal?: AbortSignal,
): Promise<LatLng[][]> {
  const query = buildQuery(bounds);
  const endpoints = overpassEndpoints();
  const ac = new AbortController();
  const onAbort = () => ac.abort();
  outerSignal?.addEventListener("abort", onAbort);
  if (outerSignal?.aborted) {
    ac.abort();
  }

  const attempts = endpoints.map((url) =>
    postOverpass(url, query, ac.signal),
  );

  try {
    const ways = await Promise.any(attempts);
    ac.abort();
    await Promise.allSettled(attempts);
    return ways;
  } catch {
    ac.abort();
    await Promise.allSettled(attempts);
    throw new Error("All Overpass endpoints failed");
  } finally {
    outerSignal?.removeEventListener("abort", onAbort);
  }
}

export async function fetchStreets(
  bounds: ViewBounds,
  signal?: AbortSignal,
): Promise<LatLng[][]> {
  const size = validateViewSize(bounds);
  if (!size.ok) {
    throw new Error(size.reason);
  }

  const key = bboxKey(bounds);
  const hit = cache.get(key);
  if (hit) return hit;

  const pending = inflight.get(key);
  if (pending) return pending;

  const req = fetchStreetsUncached(bounds, signal)
    .then((ways) => {
      cache.set(key, ways);
      return ways;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, req);
  return req;
}

/**
 * Prefetch only playable views. Cancels the previous attempt and never shares
 * an abortable in-flight promise with GO (so canceling prefetch can't stall play).
 */
export function prefetchStreets(bounds: ViewBounds): void {
  prefetchAbort?.abort();
  prefetchAbort = null;

  if (!validateViewSize(bounds).ok) return;

  const key = bboxKey(bounds);
  if (cache.has(key)) return;

  const ac = new AbortController();
  prefetchAbort = ac;
  void fetchStreetsUncached(bounds, ac.signal)
    .then((ways) => {
      if (!ac.signal.aborted) cache.set(key, ways);
    })
    .catch(() => {
      /* prefetch is best-effort */
    });
}

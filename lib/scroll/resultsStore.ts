import { SCROLL_BENCHMARK, SCROLL_COMMUNITY_THRESHOLD, SCROLL_REGIONS, type ScrollRegion, normalPercentile } from "./campaign";
import type { ParseOutcome, ScreenTimeLayout } from "./ocrSanitizer";

export type ScrollResult = {
  hours: number;
  region: ScrollRegion;
  ts: number;
};

type GlobalScrollStore = {
  results: ScrollResult[];
  rateLimits: Map<string, number[]>;
  telemetry: Map<string, number>;
};

const globalStore = globalThis as typeof globalThis & {
  __neuralfinScrollStore?: GlobalScrollStore;
};

export const scrollStore =
  globalStore.__neuralfinScrollStore ??
  (globalStore.__neuralfinScrollStore = {
    results: [],
    rateLimits: new Map<string, number[]>(),
    telemetry: new Map<string, number>(),
  });
scrollStore.telemetry ??= new Map<string, number>();

const HOUR_MS = 60 * 60 * 1000;
const MAX_RESULTS = 5000;

export function checkRateLimit(key: string, now = Date.now()) {
  const recent = (scrollStore.rateLimits.get(key) ?? []).filter((ts) => now - ts < HOUR_MS);
  if (recent.length >= 60) {
    scrollStore.rateLimits.set(key, recent);
    return false;
  }
  recent.push(now);
  scrollStore.rateLimits.set(key, recent);
  return true;
}

export function addScrollResult(result: ScrollResult) {
  scrollStore.results.push(result);
  if (scrollStore.results.length > MAX_RESULTS) {
    scrollStore.results.splice(0, scrollStore.results.length - MAX_RESULTS);
  }
}

// Aggregate-only telemetry: one counter per {layout, outcome} pair plus one
// per degradation event. No timestamps, no IPs, no rows — nothing that
// could identify a user.
//
// Counters go through a swappable storage interface so the durable-store
// migration (Vercel KV, the queued BUILD_SPEC task) can drop in a backend
// without touching call sites. Until then the in-memory backend applies and
// counters reset on serverless instance recycling. All writes are
// fire-and-forget: telemetry failure can never fail a parse or a request.
export interface ScrollTelemetryStorage {
  increment(key: string): void | Promise<void>;
  snapshot(): Record<string, number> | Promise<Record<string, number>>;
}

const inMemoryTelemetryStorage: ScrollTelemetryStorage = {
  increment(key) {
    scrollStore.telemetry.set(key, (scrollStore.telemetry.get(key) ?? 0) + 1);
  },
  snapshot() {
    return Object.fromEntries(scrollStore.telemetry);
  },
};

let telemetryStorage: ScrollTelemetryStorage = inMemoryTelemetryStorage;

// Drop-in point for the durable backend (KV) when the migration lands.
export function setScrollTelemetryStorage(storage: ScrollTelemetryStorage) {
  telemetryStorage = storage;
}

function fireAndForget(operation: () => void | Promise<void>) {
  try {
    void Promise.resolve(operation()).catch(() => undefined);
  } catch {
    // telemetry must never propagate a failure
  }
}

export function recordScrollTelemetry(layout: ScreenTimeLayout, outcome: ParseOutcome) {
  fireAndForget(() => telemetryStorage.increment(`${layout}:${outcome}`));
}

export function recordScrollTelemetryEvent(event: string) {
  fireAndForget(() => telemetryStorage.increment(`event:${event}`));
}

// Which in-app browser a parse ran in (enum only) — tells us which webview
// environments degrade and need attention. Same anonymity contract.
export function recordScrollWebviewTelemetry(env: string, outcome: ParseOutcome) {
  fireAndForget(() => telemetryStorage.increment(`webview:${env}:${outcome}`));
}

export async function buildScrollTelemetrySummary(): Promise<Record<string, number>> {
  try {
    return await telemetryStorage.snapshot();
  } catch {
    return {};
  }
}

function percentileFromDistribution(hours: number, distribution: ScrollResult[]) {
  if (distribution.length === 0) {
    return normalPercentile(hours);
  }
  const atOrBelow = distribution.filter((result) => result.hours <= hours).length;
  return Math.round((atOrBelow / distribution.length) * 100);
}

export function buildScrollSummary() {
  const results = scrollStore.results;
  const useCommunity = results.length >= SCROLL_COMMUNITY_THRESHOLD;
  const percentiles = Object.fromEntries(
    SCROLL_REGIONS.map((region) => {
      const distribution = results.filter((result) => region === "ww" || result.region === region);
      return [
        region,
        {
          source: useCommunity && distribution.length > 0 ? "community" : "benchmark",
          label: useCommunity && distribution.length > 0 ? SCROLL_BENCHMARK.communityLabel : SCROLL_BENCHMARK.label,
          p50: useCommunity && distribution.length > 0 ? percentileFromDistribution(4.2, distribution) : 50,
          p75: useCommunity && distribution.length > 0 ? percentileFromDistribution(5.6, distribution) : normalPercentile(5.6),
          p90: useCommunity && distribution.length > 0 ? percentileFromDistribution(7.0, distribution) : normalPercentile(7.0),
        },
      ];
    }),
  );

  return {
    count: results.length,
    threshold: SCROLL_COMMUNITY_THRESHOLD,
    percentiles,
    recent: results
      .slice(-12)
      .reverse()
      .map((result) => ({
        hours: result.hours,
        region: result.region,
        ts: result.ts,
      })),
  };
}

import { NextRequest, NextResponse } from "next/server";
import { buildScrollTelemetrySummary, checkRateLimit, recordScrollTelemetry, recordScrollTelemetryEvent, recordScrollWebviewTelemetry } from "@/lib/scroll/resultsStore";
import { PARSE_FLAGS, PARSE_OUTCOMES, SCREEN_TIME_LAYOUTS, type ParseFlag, type ParseOutcome, type ScreenTimeLayout } from "@/lib/scroll/ocrSanitizer";
import { WEBVIEW_ENVS, type WebviewEnv } from "@/lib/scroll/webview";

export const runtime = "nodejs";

// Anonymous, aggregate-only parse telemetry: enum fields only — a layout
// guess, an outcome, and optional degradation-event names from a fixed
// list. No image data, no OCR text, no app names ever reach this endpoint.

function isLayout(value: unknown): value is ScreenTimeLayout {
  return typeof value === "string" && SCREEN_TIME_LAYOUTS.includes(value as ScreenTimeLayout);
}

function isOutcome(value: unknown): value is ParseOutcome {
  return typeof value === "string" && PARSE_OUTCOMES.includes(value as ParseOutcome);
}

function isEvent(value: unknown): value is ParseFlag {
  return typeof value === "string" && PARSE_FLAGS.includes(value as ParseFlag);
}

function isWebviewEnv(value: unknown): value is WebviewEnv {
  return typeof value === "string" && WEBVIEW_ENVS.includes(value as WebviewEnv);
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";

  if (!checkRateLimit(`telemetry:${ip}`)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { layout, outcome, events, env } = body as { layout?: unknown; outcome?: unknown; events?: unknown; env?: unknown };

  if (!isLayout(layout) || !isOutcome(outcome)) {
    return NextResponse.json({ error: "Invalid telemetry" }, { status: 400 });
  }
  if (events !== undefined && (!Array.isArray(events) || events.length > PARSE_FLAGS.length || !events.every(isEvent))) {
    return NextResponse.json({ error: "Invalid telemetry" }, { status: 400 });
  }
  if (env !== undefined && !isWebviewEnv(env)) {
    return NextResponse.json({ error: "Invalid telemetry" }, { status: 400 });
  }

  recordScrollTelemetry(layout, outcome);
  for (const event of events ?? []) recordScrollTelemetryEvent(event);
  if (env !== undefined && env !== "none") recordScrollWebviewTelemetry(env, outcome);
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json(await buildScrollTelemetrySummary());
}

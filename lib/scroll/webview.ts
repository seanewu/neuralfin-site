// In-app browser (webview) detection, UA-based. Used to pick save-flow
// fallbacks (WeChat's webview ignores programmatic blob downloads and has
// no file share) and to tag anonymous parse telemetry with an environment
// enum — no new data categories, just which webview a parse ran in.
export const WEBVIEW_ENVS = ["wechat", "line", "instagram", "facebook", "none"] as const;
export type WebviewEnv = (typeof WEBVIEW_ENVS)[number];

export function detectWebviewEnv(userAgent: string): WebviewEnv {
  const ua = userAgent.toLowerCase();
  if (ua.includes("micromessenger")) return "wechat";
  if (/(?:^|[\s;(])line\/\d/.test(ua)) return "line";
  if (ua.includes("instagram")) return "instagram";
  if (ua.includes("fban") || ua.includes("fbav") || ua.includes("fb_iab")) return "facebook";
  return "none";
}

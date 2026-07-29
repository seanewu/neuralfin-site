# Scroll Calculator Build Spec

> Note: sections below marked "(reconstructed)" were rebuilt from the shipped
> codebase after the original handoff spec was lost. Items marked TODO-CONFIRM
> could not be verified against an original requirement and need human
> confirmation.

## Parser Product Decisions

- Scroll time is category-based when a screenshot exposes category tiles. Included categories are Social, Video, Entertainment, and Games, plus localized zh/thai equivalents.
- Messaging apps counted inside the platform's Social category are included by design. The parser counts the platform category, not individual messaging intent.
- Productivity & Finance, Travel/Navigation, Creativity, Information & Reading, Utilities, and Communication-as-category are excluded from scroll-time category sums.
- TODO: source scroll-specific benchmarks. For now, scroll-time results compare against the existing published screen-time benchmark set.
- iOS taxonomy maps into the same category config as the Android labels:
  Social + Entertainment + Games count as scroll; Creativity,
  Productivity & Finance, Travel, Information & Reading, Education,
  Utilities, and Other are excluded. Both platforms' label sets carry
  zh (社交/娛樂/遊戲) and Thai equivalents.
- Day vs week scoping: an average or weekly headline drives the slider and
  badge, but the scroll-of-total ratio is computed only from same-scoped
  values. On a WEEK view (detected from weekly labels, 每周/每週 tab text,
  or an average headline — iOS only shows "daily average"/日均 on week
  views), categories and the grand total (总屏幕时间/Total Screen Time —
  scope-dependent: weekly on week views, day total on day views) share the
  week scope: the ratio pairs weekly scroll with the weekly grand total
  (`ratioScope: "week"`) while the slider keeps the daily average. Without
  a confidently anchored grand total the ratio is suppressed (total-only);
  day-scoped totals keep the day ratio.
- Update-timestamp metadata lines (更新于/更新於/Updated…) are inert: their
  day words must not anchor scopes and their clock times ("09:51") must
  never parse as durations — a real device promoted 更新于：今天 09:51 to a
  9h51m day headline before this guard.
- Chart furniture can never become a value. Anchoring trust order for a
  label: same-line value → zip-paired value → a composite value LEADING the
  adjacent line (headline values are often polluted by delta text —
  "5h 20m ⬇ 25% from last week" — and fail the duration-only check) → a
  composite duration-only line in the window. Bare tokens (axis ticks
  "10h"/"12小时", "0") are never composite so never eligible; "avg"/平均
  dashed-line labels carry no value; lines containing a percentage
  (comparison furniture) are disqualified from label duty. If no anchored
  pair exists, the parse fails to manual — a floating fragment is never
  promoted, and the verified badge can only ever fire on an anchored
  average/weekly value. Known tradeoff: a bare-minutes headline on its own
  line ("45m") without a same-line/zip anchor is not promotable either.
- iOS "Limits" rows duplicate app names ("Instagram 1 hr"); duplicate
  canonical apps keep the LARGEST minutes so a limit row never shadows the
  usage row.
- Category taxonomy (audited across Apple + Android in en/zh-Hant/zh-Hans/
  th): scroll = Social, Video, Entertainment, Games. Excluded, with joined
  names as single units: Productivity & Finance (效率与财务/生產力與財務/
  ประสิทธิภาพและการเงิน), Information & Reading (信息与阅读/資訊與閱讀/
  ข้อมูลและการอ่าน), Shopping & Food (购物与美食/購物與美食/
  ช็อปปิ้งและอาหาร), Health & Fitness (健康与健身/健康與健身/
  สุขภาพและฟิตเนส), Creativity, Education, Travel (旅行/旅遊), Utilities,
  Communication, Other.
- Duration token tolerance (headlines, app rows, and category values alike):
  "N h M m", "N hr M min", "N hr, M min", "Nh Mm", "N:MM",
  "N 小時 M 分鐘", and Thai equivalents.
- Two-pass OCR (`lib/scroll/ocrPipeline.ts`): the full eng+chi_tra+tha
  worker reads names/labels; duration regions (whole values lines, and the
  trailing duration words of app rows via word-level bboxes) are
  re-recognized by an eng-only worker with a 0-9/h/m whitelist in
  single-line mode. Resolution order per region: restricted-pass result →
  multilingual text with the ท confusion-form fallback → drop. Any pipeline
  failure degrades to single-pass; it never fails a parse.
- Real-OCR tolerance (validated against tesseract output from the app's own
  workers on Samsung uploads — the fallback layer under the restricted
  pass): latin h/m misread as Thai ท is accepted in composite "N ท M ท"
  tokens; a single stray character on a value line is OCR noise; tile
  names/values rows pair positionally as units.
- Never guess a plausible wrong number: magnitude caps are view-gated
  (day 24h / week 168h, from the weekly labels); composite tokens reject
  minutes > 59; a lone ambiguous bare token (1-24 in day view, anything in
  week view) drops its tile and marks the read unverified
  (`ambiguous_duration_dropped`). Tile-run pairing bails entirely on a
  name↔value count mismatch (`tile_count_mismatch`, counted before
  exclusion filtering), and category sums exceeding a surviving headline
  drop the scroll ratio (`category_total_exceeds_headline`). A cropped
  headline with parseable categories degrades to scroll-derived hours,
  flagged `headline_crop_unrecoverable` — usable, never verified.
- Fixtures: the verbatim raw-OCR text fixture drives deterministic parser
  tests in CI; `lib/scroll/__fixtures__/samsung-tiles.png` +
  `npm run test:e2e` run the real workers end-to-end (nightly lane — the
  only test class that catches OCR-model behavior).
- Unknown-layout degrade order (never a hard fail when data is extractable):
  (a) label-anchored total → total-only mode; (b) no anchored total → the
  "couldn't read" path with the manual slider. `sanitizeParsedResult` gates
  every value that reaches the UI or the share card.

## In-App Browser (Webview) Support Matrix

Detection is UA-based (`lib/scroll/webview.ts`): `wechat` (MicroMessenger),
`line`, `instagram`, `facebook` (FBAN/FBAV/FB_IAB), else `none`. Critical
paths and their behavior per environment:

| Path | Regular browser | WeChat | LINE / IG / FB in-app |
|---|---|---|---|
| File input / upload | native picker | works (photo library) | works |
| tesseract WASM OCR | works | works (WKWebView/X5 support WASM); on failure → manual slider + notice, telemetry `outcome=failed` with env tag — never a crash | same |
| Card PNG export (html-to-image) | works | works (same-renderer SVG foreignObject) | works |
| `navigator.share` with files | used when available | unavailable — skipped | unreliable — skipped |
| Blob `<a download>` | fallback path | **not reliably supported** | unreliable |
| Save flow | share → download + caption to clipboard | **full-screen `<img>` overlay + "长按保存图片" (long-press to save — the standard WeChat pattern), localized ×4** | same overlay fallback |

No "open in browser" hint is shown: every path works in-place (the overlay
makes saving work without leaving the webview), which is the preference —
WeChat users don't leave WeChat. Revisit only if telemetry shows a webview
where OCR consistently fails.

Partial-parse guidance: when app rows parse but no headline/average anchors,
the UI shows a specific state ("Found your app list — but not your total.
Scroll to the top of Screen Time and screenshot the daily average", ×4
locales) with catalog-gated roasts populated, manual slider, no badge —
headline promotion rules unchanged.

## Layout Telemetry — OEM Expansion Mechanism

One anonymous, aggregate-only report per parse attempt:
`{ layout_guess: samsung|pixel|ios|unknown, outcome: full|total_only|failed,
events?: [...] }`, sent to `POST /api/scroll-telemetry`. Events come from a
fixed enum of degradation flags: `ambiguous_duration_dropped`,
`tile_count_mismatch`, `headline_crop_unrecoverable`,
`category_total_exceeds_headline`, `restricted_pass_failed`. The endpoint
accepts these enum fields and nothing else — no image data, no OCR text, no
app names — and the store keeps only counters (no rows, timestamps, or
IPs). An optional `env` field (webview enum: wechat|line|instagram|
facebook|none) tags which in-app browser a parse ran in — counters only,
no new data categories. Counters go through `ScrollTelemetryStorage`
(`lib/scroll/resultsStore.ts`), a swappable interface whose in-memory
backend resets on serverless recycling; the durable-store migration swaps
in the KV backend at `setScrollTelemetryStorage` without touching call
sites. All writes are fire-and-forget — telemetry failure can never fail a
parse. This is the mechanism for deciding which OEM wellbeing layouts
(Xiaomi/OPPO/vivo/Huawei skins) get dedicated fixtures post-launch, and
which degradation paths fire most in the wild.

## Routes (reconstructed)

- `/scroll` — the calculator page (`app/scroll/page.tsx` →
  `components/scroll/ScrollCalculator.tsx`). Client component; four locales
  (EN / 繁 zh-Hant / 简 zh-Hans / ไทย th) toggled in-page, `?lang=` query
  param (`en|zh-Hant|zh-Hans|th`, legacy `zh` → zh-Hant), persisted to
  `localStorage` (`scroll-calc-lang`). Locale defaults: URL param → stored
  manual choice → browser detection (`th`/`th-TH` → Thai; Chinese browser
  tags pick their script: zh-HK/zh-TW/zh-MO → Hant, zh-CN/zh-SG → Hans;
  bare `zh` follows detected region — HK → Hant, SG → Hans, elsewhere Hans;
  detected region Thailand with no recognized language preference → Thai).
  Manual toggle always wins and persists. Region (`ww|hk|sg|th`)
  auto-detects from `navigator.language` and is user-switchable.
- **Rule (confirmed): language beats region.** Detected region only ever
  selects which variant wins for a language the browser actually expresses
  (bare `zh` → Hant/Hans), or fills in when the browser expresses no
  recognized preference at all (Thailand → th). It never overrides an
  explicit browser language — an en-HK or en-TH browser stays English. Do
  not "fix" this the other way.
- There is intentionally no separate `/zh/scroll` route (unlike the rest of
  the site, which mirrors pages under `/zh/`) — the in-page language toggle
  is the intended design.
- Future: when the `calculator.neuralfin.ai` subdomain is attached, re-add
  a host-based rewrite (all paths → `/scroll`) via `vercel.json`. The file
  was deliberately removed for zero-config Next.js deploys — re-adding it
  should contain only the rewrite, no build-setting overrides.
- `POST /api/scroll-results` — submit an anonymous result.
- `GET /api/scroll-results/summary` — aggregate stats for the tape/percentiles.
- `GET /api/health` — health check.

## Results API Spec (reconstructed)

`POST /api/scroll-results` (runtime: nodejs)

- Body: `{ hours: number, region: "ww"|"hk"|"sg"|"th" }`.
- Validation: `hours` must be a finite number in [0.5, 12] (400 otherwise);
  `region` must be a supported region (400 otherwise); invalid JSON → 400.
- Rate limit: 60 requests per rolling hour per IP (from `x-forwarded-for` /
  `x-real-ip`), 429 when exceeded. IPs live only in the in-memory rate-limit
  map (pruned on a rolling 1-hour window) and are never persisted with
  results.
- Stored record: `{ hours, region, ts }` only — nothing else (hard rule).
- Store: in-memory global (`lib/scroll/resultsStore.ts`), capped at 5,000
  most-recent results. Not durable across restarts/instances. **This is a
  placeholder — a durable store is required for launch.** Planned migration:
  Vercel KV (or the project's existing durable option), keeping the exact
  `{hours, region, ts}` anonymity contract and converting the 5,000-cap into
  a KV retention policy. Scheduled as the next task after the parser
  regression — spec'd here, not yet built.
- Client behavior: the page POSTs a result when the user taps the share-card
  download button; failures are swallowed silently.

`GET /api/scroll-results/summary`

- Returns `{ count, threshold: 500, percentiles, recent }`.
- `percentiles`: per region `{ source: "community"|"benchmark", label,
  p50, p75, p90 }`. Community distribution activates at ≥ 500 total results
  (`SCROLL_COMMUNITY_THRESHOLD`); until then percentiles come from a normal
  approximation over the published benchmark (mean 4.2 h/day, SD 2.1).
- `recent`: last 12 results (`{ hours, region, ts }`), newest first — feeds
  the "tape" section (falls back to demo tape rows when empty).

## OG / Meta (reconstructed)

- Title: "Your Scroll Has a P&L | NeuralFin"; description: "Audit your daily
  screen time, see your scroll P&L, and flip ten minutes a day into financial
  learning."
- Canonical: `https://www.neuralfin.ai/scroll`; `metadataBase`
  `https://www.neuralfin.ai`.
- OpenGraph + Twitter `summary_large_image`; image is currently the NeuralFin
  logo (`/assets/neuralfin-logo-transparent-cropped.png`) as a placeholder.
  Planned: a static 1200×630 OG card derived from the share-card design;
  dynamic per-result OG via `@vercel/og` is a stretch goal. Queued after the
  durable-store migration.
- iOS Smart App Banner: `apple-itunes-app` with `app-id=6751037382` and
  `app-argument=https://www.neuralfin.ai/scroll`.

## UTM / Deep-Link Params (reconstructed)

Defined in `lib/scroll/campaign.ts`; appended to both store links
(App Store / Google Play) on the card and sticky footer:

- UTM: `utm_source=scroll-calculator`, `utm_medium=web`,
  `utm_campaign=scroll-audit`.
- Deep-link params: `sc_hours` (slider value), `sc_region` (`ww|hk|sg|th`),
  `sc_verified` (`1|0` — whether hours came from a validated screenshot
  parse), `sc_lang` (`en|zh-Hant|zh-Hans|th`; the pre-three-locale value
  `zh` is still accepted inbound and maps to `zh-Hant`).
- The `sc_*` params are a stable, documented contract: the app team consumes
  them in the Phase 2 claim flow. Keep names and value formats stable;
  nothing to build web-side now.

## Performance / A11y Budgets (restored to spec)

- LCP < 1.5 s on mid-tier mobile.
- Page JS < 120 KB gzip, excluding the OCR bundle (current 87.3 kB shared
  first-load JS is within budget).
- tesseract.js loads only via dynamic `import()` on user action — never in
  the initial bundle; OCR workers are terminated after each parse.
- Lighthouse accessibility score ≥ 95.
- Touch targets ≥ 44 px.
- `prefers-reduced-motion` fully respected (e.g. auto-flip animation delay
  drops to 0).
- Implemented a11y baseline: dropzone is a real `<button>`
  (keyboard-operable, Enter/Space); slider is a native range input with
  label; scan status uses `role="status"` + `aria-live="polite"`;
  region/language switchers are grouped with `aria-label`s; store links carry
  `aria-label`s.

## Acceptance Criteria (reconstructed — TODO-CONFIRM as the original list)

- Upload → parse → slider lands on parsed hours, `verified` badge set, and
  the user is scrolled/focused to the hours control; Day-view screenshots set
  hours but not verified, with copy prompting for the Week view; unreadable
  screenshots fail soft into manual slider mode.
- Manual slider drag within ±0.5 h of the parsed value keeps verified status;
  beyond that it clears.
- Share card renders as 1080×1740 PNG via canvas, uses Web Share API where
  available, otherwise downloads + copies the caption to clipboard.
- Tape shows real community results once any exist, demo rows otherwise;
  standings are demo data until launch aggregates exist (copy discloses
  this).
- All three compliance footer lines render on the page in both languages.
- `npm run build`, `npx tsc --noEmit`, and `npm run test` pass.

## Roadmap: Phases 2–3 (reconstructed — TODO-CONFIRM details)

- **Phase 2 — app deep-link claim flow.** The app team consumes the `sc_*`
  params from the store/deep link so a user's scroll audit (hours, region,
  verified flag, language) is claimed in-app and seeds their flip streak.
  Claim UX is owned by the app team; the web-side obligation is keeping the
  `sc_*` params stable and documented. Nothing to build web-side now.
- **Phase 3 — in-app flip leagues.** Region-level leagues ranked by flip
  rate (% of users converting scroll minutes into lessons), the live version
  of the demo "Market standings" section. TODO-CONFIRM: league mechanics,
  seasons, and rewards.
- **Constraint (firm, all phases): no trading-performance leaderboards.**
  Leagues and standings rank engagement with learning (flip rate) only —
  never rank identified users by trading performance or returns.

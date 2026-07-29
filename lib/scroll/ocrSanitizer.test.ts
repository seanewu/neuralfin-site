import assert from "node:assert/strict";
import test from "node:test";
import { classifyParseOutcome, guessScreenTimeLayout, parseScreenTimeText, sanitizeParsedResult } from "./ocrSanitizer";

test("clean app list renders canonical names and plausible minutes", () => {
  const parsed = parseScreenTimeText(
    [
      "Screen Time",
      "Daily Average 3h 20m",
      "Tik Tok 1h 05m",
      "You Tube 42m",
      "Instagram 30m",
    ].join("\n"),
    88,
  );

  assert.equal(parsed.source, "average");
  assert.equal(Math.round((parsed.hours ?? 0) * 10) / 10, 3.3);
  assert.deepEqual(parsed.apps, [
    { name: "TikTok", minutes: 65 },
    { name: "YouTube", minutes: 42 },
    { name: "Instagram", minutes: 30 },
  ]);
});

test("partial garbage is dropped while valid fuzzy matches survive", () => {
  const sanitized = sanitizeParsedResult({
    hours: 2.5,
    source: "average",
    confidence: 80,
    apps: [
      { rawName: "ๅ ๕6 ๑ Nf 75% ol ED", minutes: 1018 },
      { rawName: "Settime", minutes: 137 },
      { rawName: "Instagrarn", minutes: 44 },
      { rawName: "We Chat", minutes: 31 },
    ],
  });

  assert.deepEqual(sanitized.apps, [
    { name: "Instagram", minutes: 44 },
    { name: "WeChat", minutes: 31 },
  ]);
});

test("only garbage yields no app roasts", () => {
  const sanitized = sanitizeParsedResult({
    hours: 2,
    source: "average",
    confidence: 70,
    apps: [
      { rawName: "©) Settime", minutes: 137 },
      { rawName: "ๅ ๕6 ๑ Nf 75% ol ED", minutes: 25 },
    ],
  });

  assert.deepEqual(sanitized.apps, []);
});

test("per-app duration exceeding total or hard cap is dropped", () => {
  const withTotal = sanitizeParsedResult({
    hours: 2,
    source: "average",
    confidence: 70,
    apps: [
      { rawName: "TikTok", minutes: 130 },
      { rawName: "WeChat", minutes: 90 },
    ],
  });
  assert.deepEqual(withTotal.apps, [{ name: "WeChat", minutes: 90 }]);

  const withoutTotal = sanitizeParsedResult({
    hours: null,
    source: null,
    confidence: 70,
    apps: [
      { rawName: "YouTube", minutes: 500 },
      { rawName: "Chrome", minutes: 120 },
    ],
  });
  assert.deepEqual(withoutTotal.apps, [{ name: "Chrome", minutes: 120 }]);
});

test("zh localized screenshot matches catalog", () => {
  const parsed = parseScreenTimeText("每日平均 2小時30分鐘\n抖音 45分鐘\n微信 31分鐘\n小红书 20分鐘", 91);

  assert.equal(parsed.source, "average");
  assert.equal(parsed.hours, 2.5);
  assert.deepEqual(parsed.apps, [
    { name: "TikTok", minutes: 45 },
    { name: "WeChat", minutes: 31 },
    { name: "Xiaohongshu", minutes: 20 },
  ]);
});

test("thai localized screenshot matches catalog", () => {
  const parsed = parseScreenTimeText("เฉลี่ยต่อวัน 3 ชั่วโมง 0 นาที\nไลน์ 40 นาที\nยูทูบ 35 นาที\nเฟซบุ๊ก 20 นาที", 86);

  assert.equal(parsed.source, "average");
  assert.equal(parsed.hours, 3);
  assert.deepEqual(parsed.apps, [
    { name: "LINE", minutes: 40 },
    { name: "YouTube", minutes: 35 },
    { name: "Facebook", minutes: 20 },
  ]);
});

test("total without categories falls back to total and emits no scroll chip metadata", () => {
  const parsed = parseScreenTimeText("Screen time today\n6 h 2 m\nYouTube 3 h 16 m", 83);

  assert.equal(parsed.source, "day-total");
  assert.equal(Math.round((parsed.hours ?? 0) * 100) / 100, 6.03);
  assert.equal(parsed.scrollHours, null);
  assert.equal(Math.round((parsed.totalHours ?? 0) * 100) / 100, 6.03);
});

// iOS Screen Time fixture — category legend under the usage chart, ordered
// by usage (an excluded category first), values day-scoped.
const IOS_DAY_FIXTURE = [
  "SCREEN TIME",
  "Today",
  "2h 2m",
  "Creativity 44m · Social 32m · Travel 9m",
  "Show Categories",
].join("\n");

test("iOS legend counts only scroll categories, per segment", () => {
  const parsed = parseScreenTimeText(IOS_DAY_FIXTURE, 88);

  assert.equal(parsed.source, "day-total");
  assert.equal(Math.round((parsed.totalHours ?? 0) * 60), 122); // 2h 2m
  assert.equal(Math.round((parsed.scrollHours ?? 0) * 60), 32); // Social only, not Creativity's 44m
  assert.equal(Math.round((parsed.hours ?? 0) * 60), 32);
});

test("iOS week view never mixes weekly category values into a daily scroll ratio", () => {
  const parsed = parseScreenTimeText(
    ["SCREEN TIME", "Daily Average 5h 6m", "Social 6h 40m · Entertainment 3h 2m", "Show Categories"].join("\n"),
    88,
  );

  assert.equal(parsed.source, "average");
  assert.equal(Math.round((parsed.hours ?? 0) * 60), 306); // 5h 6m daily average drives the slider
  assert.equal(parsed.scrollHours, null); // scope mismatch → total-only, no ratio
});

// Stock Android (Pixel) Digital Wellbeing — "hr"/"min" word tokens with a
// comma, per-app list, no category tiles.
const PIXEL_FIXTURE = [
  "Digital Wellbeing",
  "Screen time",
  "4 hr, 12 min",
  "Chrome 1 hr 2 min",
  "YouTube 58 min",
  "Instagram 44 min",
].join("\n");

test("Pixel comma-separated hr/min tokens parse as total-only with app roasts", () => {
  const parsed = parseScreenTimeText(PIXEL_FIXTURE, 85);

  assert.equal(parsed.source, "day-total");
  assert.equal(Math.round((parsed.totalHours ?? 0) * 60), 252); // 4h 12m
  assert.equal(parsed.scrollHours, null); // no categories visible → total-only
  assert.equal(Math.round((parsed.hours ?? 0) * 60), 252);
  assert.deepEqual(parsed.apps, [
    { name: "Chrome", minutes: 62 },
    { name: "YouTube", minutes: 58 },
    { name: "Instagram", minutes: 44 },
  ]);
});

test("duration token formats all resolve to the same value", () => {
  const cases = [
    "3 h 20 m",
    "3 hr 20 min",
    "3 hr, 20 min",
    "3h 20m",
    "3:20",
    "3 小時 20 分鐘",
    "3 ชั่วโมง 20 นาที",
  ];
  for (const token of cases) {
    const parsed = parseScreenTimeText(`Daily Average ${token}`, 90);
    assert.equal(Math.round((parsed.hours ?? 0) * 60), 200, `token "${token}"`);
  }
  const minutesOnly = parseScreenTimeText("Daily Average 45 m", 90);
  assert.equal(Math.round((minutesOnly.hours ?? 0) * 60), 45);
});

test("garbage OCR yields no hours, no apps, and a failed outcome", () => {
  const parsed = parseScreenTimeText("ๅ ๕6 ๑ Nf 75% ol ED\n©) qwerty 999\n???\n@@##", 22);

  assert.equal(parsed.hours, null);
  assert.equal(parsed.source, null);
  assert.equal(parsed.scrollHours, null);
  assert.deepEqual(parsed.apps, []);
  assert.equal(classifyParseOutcome(parsed), "failed");
});

test("unknown OEM layout with an anchored total degrades to total-only, not failure", () => {
  const parsed = parseScreenTimeText("การใช้งานอุปกรณ์\nเวลาหน้าจอ 5 ชั่วโมง 12 นาที\nแอปที่ใช้บ่อย", 70);

  assert.equal(parsed.source, "day-total");
  assert.equal(Math.round((parsed.hours ?? 0) * 60), 312);
  assert.equal(parsed.scrollHours, null);
  assert.equal(classifyParseOutcome(parsed), "total_only");
  assert.equal(guessScreenTimeLayout("การใช้งานอุปกรณ์\nเวลาหน้าจอ 5 ชั่วโมง 12 นาที"), "unknown");
});

test("layout guess separates samsung, pixel, and ios", () => {
  assert.equal(guessScreenTimeLayout(SAMSUNG_REAL_OCR_FIXTURE), "samsung");
  assert.equal(guessScreenTimeLayout(PIXEL_FIXTURE), "pixel");
  assert.equal(guessScreenTimeLayout(IOS_DAY_FIXTURE), "ios");
});

test("cropped Samsung category dashboard still guesses samsung", () => {
  assert.equal(guessScreenTimeLayout(SAMSUNG_REAL_OCR_FIXTURE), "samsung");
});

test("parse outcome classification covers full, total_only, failed", () => {
  assert.equal(classifyParseOutcome(parseScreenTimeText(SAMSUNG_REAL_OCR_FIXTURE, 91)), "full");
  assert.equal(classifyParseOutcome(parseScreenTimeText(PIXEL_FIXTURE, 85)), "total_only");
  assert.equal(classifyParseOutcome(parseScreenTimeText("nothing useful here", 10)), "failed");
});

test("parser category labels match both Traditional and Simplified scripts", () => {
  const hant = parseScreenTimeText(
    ["今日螢幕使用時間", "6 小時 2 分鐘", "影片 3 小時 16 分鐘", "社交 2 小時 35 分鐘", "生產力 5 分鐘"].join("\n"),
    85,
  );
  const hans = parseScreenTimeText(
    ["今日屏幕使用时间", "6 小时 2 分钟", "视频 3 小时 16 分钟", "社交 2 小时 35 分钟", "生产力 5 分钟"].join("\n"),
    85,
  );

  for (const parsed of [hant, hans]) {
    assert.equal(parsed.source, "day-total");
    assert.equal(Math.round((parsed.totalHours ?? 0) * 60), 362);
    assert.equal(Math.round((parsed.scrollHours ?? 0) * 60), 351); // Video + Social; Productivity excluded
  }
});

test("entertainment and games categories count in both scripts", () => {
  const hant = parseScreenTimeText("今天\n5 小時 0 分鐘\n娛樂 2 小時 0 分鐘\n遊戲 1 小時 0 分鐘\n創意 30 分鐘", 85);
  const hans = parseScreenTimeText("今天\n5 小时 0 分钟\n娱乐 2 小时 0 分钟\n游戏 1 小时 0 分钟\n创意 30 分钟", 85);

  for (const parsed of [hant, hans]) {
    assert.equal(Math.round((parsed.scrollHours ?? 0) * 60), 180); // Entertainment + Games; Creativity excluded
    assert.equal(Math.round((parsed.totalHours ?? 0) * 60), 300);
  }
});

test("Thai headline and category labels parse with full-word duration units", () => {
  const parsed = parseScreenTimeText(
    ["เวลาหน้าจอวันนี้", "6 ชั่วโมง 2 นาที", "วิดีโอ 3 ชั่วโมง 16 นาที", "โซเชียล 2 ชั่วโมง 35 นาที", "การเงิน 5 นาที"].join("\n"),
    85,
  );

  assert.equal(parsed.source, "day-total");
  assert.equal(Math.round((parsed.totalHours ?? 0) * 60), 362);
  assert.equal(Math.round((parsed.scrollHours ?? 0) * 60), 351); // Video + Social; Finance excluded
});

test("Thai abbreviated duration units (ชม.) parse for headline and categories", () => {
  const parsed = parseScreenTimeText(
    ["เวลาหน้าจอวันนี้", "6 ชม. 2 นาที", "ความบันเทิง 2 ชม. 0 นาที", "เกม 1 ชม. 0 นาที", "สร้างสรรค์ 30 นาที"].join("\n"),
    85,
  );

  assert.equal(parsed.source, "day-total");
  assert.equal(Math.round((parsed.totalHours ?? 0) * 60), 362);
  assert.equal(Math.round((parsed.scrollHours ?? 0) * 60), 180); // Entertainment + Games; Creativity excluded
});

// Verbatim tesseract output (eng+chi_tra+tha worker, the app's exact
// pipeline) for a real Samsung "Most used app categories" screenshot with
// the headline cropped: latin h/m misread as Thai ท, tile names emitted as
// one line with a wrap, tile values as one line with stray "า" noise.
const SAMSUNG_REAL_OCR_FIXTURE =
  "onZm\n@ YouTube 3 ท 16 ท\n圖 WhatsApp 1h21m\n圖 Instagram 45 m\nMost used app categories\nVideo Social Productivity and\nfinance\n3h16m 2 ท 35 ท 5 ท า\nApp timers\nIf you're using certain apps more than you'd like, set a timer to help\nmanage your usage.\n";

test("real Samsung tile OCR with Thai-glyph confusion parses scroll time and apps", () => {
  const parsed = parseScreenTimeText(SAMSUNG_REAL_OCR_FIXTURE, 91);

  assert.equal(Math.round((parsed.scrollHours ?? 0) * 60), 351); // Video 3h16m + Social 2h35m
  assert.equal(Math.round((parsed.hours ?? 0) * 60), 351);
  assert.equal(parsed.totalHours, null); // headline cropped to "onZm" — unrecoverable
  assert.equal(parsed.source, "day-total");
  assert.deepEqual(parsed.apps, [
    { name: "YouTube", minutes: 196 }, // "3 ท 16 ท"
    { name: "WhatsApp", minutes: 81 },
    { name: "Instagram", minutes: 45 },
  ]);
  assert.equal(classifyParseOutcome(parsed), "full");
});

test("Thai-glyph OCR confusion duration forms resolve", () => {
  assert.equal(Math.round((parseScreenTimeText("Daily Average 3 ท 20 ท", 90).hours ?? 0) * 60), 200);
  // Day view: 45 > 24 can only be minutes (hours cap at 24)
  assert.equal(Math.round((parseScreenTimeText("Screen time today 45 ท", 90).hours ?? 0) * 60), 45);
  // Under an average label the context is a week view — bare tokens are
  // unresolvable there and must drop, not guess
  assert.equal(parseScreenTimeText("Daily Average 45 ท", 90).hours, null);
  // genuine Thai words must not match as durations
  const thaiWords = parseScreenTimeText("มีแอปทั้งหมด 12 ทุกวัน", 90);
  assert.equal(thaiWords.hours, null);
});

test("magnitude guard: two ordered units mean h then m", () => {
  assert.equal(Math.round((parseScreenTimeText("Daily Average 3 ท 16 ท", 90).hours ?? 0) * 60), 196);
  assert.equal(Math.round((parseScreenTimeText("Daily Average 2 ท 35 ท", 90).hours ?? 0) * 60), 155);
  // minutes > 59 / hours > 24 reject the token, and the consumed span must
  // not resurrect as a plausible-but-wrong bare match
  assert.equal(parseScreenTimeText("Daily Average 99 ท 61 ท", 90).hours, null);
  assert.equal(parseScreenTimeText("Daily Average 3 h 75 m", 90).hours, null);
});

test("lone ambiguous unit never guesses: 1-24 drops and flags unverified", () => {
  const midRange = parseScreenTimeText("Screen time today 30 ท", 90);
  assert.equal(Math.round((midRange.hours ?? 0) * 60), 30); // day view 25-59: minutes-only

  const ambiguous = parseScreenTimeText("Screen time today 12 ท", 90);
  assert.equal(ambiguous.hours, null); // could be 12h or 12m — never guess
  assert.ok(ambiguous.flags.includes("ambiguous_duration_dropped"));

  const overflow = parseScreenTimeText("Screen time today 999 ท", 90);
  assert.equal(overflow.hours, null); // no plausible display value
});

test("week view widens the hour cap and the ambiguous band", () => {
  // 38h is a plausible weekly total (rejected under the 24h day cap)
  const weekly = parseScreenTimeText("This week\n38 h 30 m", 90);
  assert.equal(weekly.source, "weekly-total");
  assert.equal(Math.round((weekly.hours ?? 0) * 60), 330); // 38.5h / 7

  // bare tokens become unresolvable in week view — drop, never guess
  const bare45 = parseScreenTimeText("This week 45 ท", 90);
  assert.equal(bare45.hours, null);
  assert.ok(bare45.flags.includes("ambiguous_duration_dropped"));
  const bare30 = parseScreenTimeText("This week 30 ท", 90); // 30 min in day view
  assert.equal(bare30.hours, null);
});

test("tile count mismatch bails to unverified instead of shifting pairs", () => {
  // Two tile names, one value token — positional zip would misattribute
  const parsed = parseScreenTimeText(["Video Social", "3 h 16 m"].join("\n"), 85);
  assert.equal(parsed.scrollHours, null);
  assert.ok(parsed.flags.includes("tile_count_mismatch"));

  // Counts compare BEFORE exclusion: 3 names (incl. excluded) ↔ 3 values OK
  const balanced = parseScreenTimeText(
    ["Video Social Productivity and finance", "3 h 16 m 2 h 35 m 5 m"].join("\n"),
    85,
  );
  assert.equal(Math.round((balanced.scrollHours ?? 0) * 60), 351);
  assert.ok(!balanced.flags.includes("tile_count_mismatch"));
});

test("category sum exceeding a surviving headline bails scroll to unverified", () => {
  const parsed = parseScreenTimeText(
    ["Screen time today", "2 h 0 m", "Video 3 h 16 m", "Social 2 h 35 m"].join("\n"),
    85,
  );
  assert.equal(Math.round((parsed.totalHours ?? 0) * 60), 120);
  assert.equal(parsed.scrollHours, null); // 5h51m of categories can't fit a 2h day
  assert.equal(Math.round((parsed.hours ?? 0) * 60), 120); // headline drives the slider
  assert.ok(parsed.flags.includes("category_total_exceeds_headline"));
});

test("headline crop with parseable categories flags unverified degradation", () => {
  const parsed = parseScreenTimeText(SAMSUNG_REAL_OCR_FIXTURE, 91);
  assert.ok(parsed.flags.includes("headline_crop_unrecoverable"));
  assert.ok(parsed.flags.includes("ambiguous_duration_dropped")); // the "5 ท" tile
});

test("an ambiguous tile drops without shifting its neighbours", () => {
  // Third tile's value is ambiguous ("5 ท", 1-24) — Video and Social must
  // keep their own values and the read must carry the unverified flag.
  const parsed = parseScreenTimeText(
    ["Video Social Productivity and finance", "3 h 16 m 2 h 35 m 5 ท"].join("\n"),
    85,
  );
  assert.equal(Math.round((parsed.scrollHours ?? 0) * 60), 351);
  assert.ok(parsed.flags.includes("ambiguous_duration_dropped"));
});

test("Samsung side-by-side category tiles pair names row with values row", () => {
  const parsed = parseScreenTimeText(
    [
      "Screen time today",
      "6 h 2 m",
      "Most used app categories",
      "Video Social Productivity and finance",
      "3 h 16 m 2 h 35 m 5 m",
    ].join("\n"),
    85,
  );

  assert.equal(Math.round((parsed.totalHours ?? 0) * 60), 362);
  assert.equal(Math.round((parsed.scrollHours ?? 0) * 60), 351); // Productivity and finance excluded as ONE unit
  assert.equal(parsed.source, "day-total");
});

test("app row only does not promote an app duration to headline", () => {
  const parsed = parseScreenTimeText("YouTube 3 h 16 m\nWhatsApp 1 h 21 m\nInstagram 45 m", 83);

  assert.equal(parsed.hours, null);
  assert.equal(parsed.source, null);
  assert.deepEqual(parsed.apps, [
    { name: "YouTube", minutes: 196 },
    { name: "WhatsApp", minutes: 81 },
    { name: "Instagram", minutes: 45 },
  ]);
});

test("app-row hour component survives misread hour-unit letters", () => {
  // Requested fixture assertion: the clean form
  const clean = parseScreenTimeText("Daily Average 3h 20m\nWhatsApp 1 h 21 m", 90);
  assert.deepEqual(clean.apps, [{ name: "WhatsApp", minutes: 81 }]);

  // The real-device failure: "h" misread as another letter dropped the hour
  // and reported bare 21m. The composite shape must keep the hour.
  for (const row of ["WhatsApp 1 n 21 m", "WhatsApp 1 b 21 m", "WhatsApp 1 ท 21 ท"]) {
    const parsed = parseScreenTimeText(`Daily Average 3h 20m\n${row}`, 90);
    assert.deepEqual(parsed.apps, [{ name: "WhatsApp", minutes: 81 }], row);
  }

  // "m" stays excluded from the hour slot: two bare minute tokens must not
  // compose into a fake hour+minute reading
  const bareMinutes = parseScreenTimeText("Daily Average 5 m 30 m", 90);
  assert.notEqual(Math.round((bareMinutes.hours ?? 0) * 60), 330);
});

// Fixture #5 — zh-Hans iOS WEEK view (real-device layout): 每周/每天 tabs,
// 日均 headline, chart with a 12小时 axis token and 平均 dashed-line label,
// weekly category legend, weekly grand total, and an update timestamp.
const IOS_ZH_WEEK_FIXTURE = [
  "每周 每天",
  "屏幕时间",
  "日均",
  "6 小时 49 分钟",
  "12 小时",
  "平均",
  "0",
  "日 一 二 三 四 五 六",
  "创意 社交 购物与美食",
  "11小时36分钟 9小时27分钟 1小时7分钟",
  "总屏幕时间 27小时18分钟",
  "更新于：今天 09:51",
  "最常使用 显示类别",
  "抖音 11小时26分钟",
  "微信 6小时8分钟",
  "小红书 2小时18分钟",
  "Chrome 59分钟",
  "Instagram 53分钟",
  "Keeta 36分钟",
  "Uber 27分钟",
].join("\n");

test("zh iOS week view: 日均 anchors the slider, week-scope ratio, verified path", () => {
  const parsed = parseScreenTimeText(IOS_ZH_WEEK_FIXTURE, 90);

  assert.equal(parsed.source, "average");
  assert.equal(Math.round((parsed.hours ?? 0) * 60), 409); // 6h49m daily average
  assert.notEqual(Math.round((parsed.hours ?? 0) * 60), 591); // never the 09:51 timestamp
  assert.deepEqual(parsed.flags, []); // verified-eligible
  assert.equal(parsed.ratioScope, "week");
  assert.equal(Math.round((parsed.scrollHours ?? 0) * 60), 567); // 社交 9h27m
  assert.equal(Math.round((parsed.totalHours ?? 0) * 60), 1638); // 总屏幕时间 27h18m
  assert.deepEqual(parsed.apps, [
    { name: "TikTok", minutes: 686 }, // 抖音
    { name: "WeChat", minutes: 368 }, // 微信
    { name: "Xiaohongshu", minutes: 138 }, // 小红书 (Keeta/Uber uncatalogued: dropped)
  ]);
});

test("update timestamps never become headlines", () => {
  // The real device read "9小时51分钟" from 更新于：今天 09:51 — 今天 anchored a
  // day scope and the clock time parsed as a colon duration.
  assert.equal(parseScreenTimeText("更新于：今天 09:51", 90).hours, null);
  assert.equal(parseScreenTimeText("Updated today at 9:41", 90).hours, null);
  assert.equal(parseScreenTimeText("更新於：今天 09:51", 90).hours, null);
});

test("chart axis tokens never pair with the average label", () => {
  // 12小时 is the chart's y-axis cap; the composite 6h49m is the value.
  const parsed = parseScreenTimeText("日均\n6 小时 49 分钟\n12 小时", 90);
  assert.equal(Math.round((parsed.hours ?? 0) * 60), 409);
  assert.equal(parsed.source, "average");
});

test("unreadable 日均 degrades to the weekly grand total, never the timestamp", () => {
  const corrupted = IOS_ZH_WEEK_FIXTURE.replace("日均", "E8");
  const parsed = parseScreenTimeText(corrupted, 90);
  assert.equal(parsed.source, "weekly-total");
  assert.equal(Math.round((parsed.hours ?? 0) * 60), 234); // 27h18m / 7
  assert.notEqual(Math.round((parsed.hours ?? 0) * 60), 591);
});

test("joined zh category names count as single units", () => {
  // 购物与美食 / 信息与阅读 must be one excluded unit each, not two — a split
  // would shift the name-value pairing.
  const parsed = parseScreenTimeText(
    ["今日屏幕使用时间", "5 小时 0 分钟", "信息与阅读 社交 购物与美食", "1小时0分钟 2小时0分钟 30分钟"].join("\n"),
    90,
  );
  assert.equal(Math.round((parsed.scrollHours ?? 0) * 60), 120); // 社交 only
  assert.ok(!parsed.flags.includes("tile_count_mismatch"));

  // Space-separated zh values ("2小时 30分钟") merge ambiguously into one
  // composite token — the count guard must bail unverified, never mispair.
  const ambiguous = parseScreenTimeText(
    ["今日屏幕使用时间", "5 小时 0 分钟", "信息与阅读 社交 购物与美食", "1小时 2小时 30分钟"].join("\n"),
    90,
  );
  assert.equal(ambiguous.scrollHours, null);
  assert.ok(ambiguous.flags.includes("tile_count_mismatch"));
});

// Fixture #6 — real-device WeChat-webview upload: an app-list-only Screen
// Time screenshot (scrolled past the headline). App rows must never be
// promoted to a headline; catalog-gated roasts still populate so the UI can
// show the partial-parse guidance state.
test("app-list-only zh screenshot: roasts populate, headline stays null", () => {
  const parsed = parseScreenTimeText(
    [
      "微信 2小时8分钟",
      "Kingshot 1小时42分钟",
      "和平精英 1小时2分钟",
      "携程旅行 44分钟",
      "Instagram 38分钟",
      "微信读书 21分钟",
    ].join("\n"),
    85,
  );

  assert.equal(parsed.hours, null);
  assert.equal(parsed.source, null);
  assert.equal(parsed.scrollHours, null);
  assert.deepEqual(parsed.apps, [
    { name: "WeChat", minutes: 128 },
    { name: "Instagram", minutes: 38 },
  ]); // Kingshot/和平精英/携程旅行/微信读书 uncatalogued — dropped, not fuzzy-matched
  assert.equal(classifyParseOutcome(parsed), "failed");
});

// Fixture #7 — English iOS WEEK view (real-device): chart y-axis furniture
// (10h tick, "avg" dashed-line label, 0), the headline value polluted by
// the delta text, weekly legend, and the weekly grand total. A real device
// promoted the 10h AXIS TICK to a VERIFIED headline here.
const IOS_EN_WEEK_FIXTURE = [
  "All Devices Devices",
  "Week Day",
  "Screen Time",
  "Daily Average",
  "5h 20m © 25% from last week",
  "10h",
  "avg",
  "0",
  "S M T W T F S",
  "Social Entertainment Creativity",
  "14h 49m 1h 7m 54m",
  "Total Screen Time 21h 23m",
  "Updated today at 10:21 AM",
].join("\n");

test("en iOS week view: Daily Average beats the axis tick, week ratio, badge path", () => {
  const parsed = parseScreenTimeText(IOS_EN_WEEK_FIXTURE, 88);

  assert.equal(parsed.source, "average");
  assert.equal(Math.round((parsed.hours ?? 0) * 60), 320); // 5h 20m
  assert.notEqual(Math.round((parsed.hours ?? 0) * 60), 600); // never the 10h tick
  assert.deepEqual(parsed.flags, []); // verified-eligible ONLY on the anchored value
  assert.equal(parsed.ratioScope, "week");
  assert.equal(Math.round((parsed.scrollHours ?? 0) * 60), 956); // Social 14h49m + Entertainment 1h7m
  assert.equal(Math.round((parsed.totalHours ?? 0) * 60), 1283); // Total Screen Time 21h 23m
});

test("axis ticks are never promotable: garbled value line fails to manual", () => {
  // The delta line ("© 25% from last week") is comparison furniture, not a
  // weekly label; with the true value unreadable there is no anchored pair
  // and NO source — nothing the badge could fire on.
  const parsed = parseScreenTimeText(["Daily Average", "© 25% from last week", "10h", "avg", "0"].join("\n"), 88);
  assert.equal(parsed.hours, null);
  assert.equal(parsed.source, null);
});

test("rednote resolves to the Xiaohongshu entry; Limits rows never shadow usage", () => {
  const parsed = parseScreenTimeText(
    ["Limits", "Instagram 1 hr", "Most Used Show Categories", "Instagram 7h 2m", "rednote 48m", "Photos 35m"].join("\n"),
    88,
  );
  assert.deepEqual(parsed.apps, [
    { name: "Instagram", minutes: 422 }, // max of the 1hr limit row and 7h2m usage
    { name: "Xiaohongshu", minutes: 48 },
    { name: "Photos", minutes: 35 },
  ]);
  assert.equal(parsed.hours, null); // app-list-only: still no headline promotion
});

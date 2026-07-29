export type AppRoast = {
  name: string;
  minutes: number;
};

export type ScreenTimeLayout = (typeof SCREEN_TIME_LAYOUTS)[number];
export type ParseOutcome = (typeof PARSE_OUTCOMES)[number];

// Non-fatal degradations surfaced to the UI (flags other than
// restricted_pass_failed make the read unverified) and to telemetry.
export const PARSE_FLAGS = [
  "ambiguous_duration_dropped",
  "tile_count_mismatch",
  "headline_crop_unrecoverable",
  "category_total_exceeds_headline",
  "restricted_pass_failed",
] as const;
export type ParseFlag = (typeof PARSE_FLAGS)[number];

export type ParsedScreenTime = {
  hours: number | null;
  source: "average" | "weekly-total" | "day-total" | null;
  totalHours: number | null;
  scrollHours: number | null;
  apps: AppRoast[];
  confidence: number;
  layout: ScreenTimeLayout;
  flags: ParseFlag[];
  // Scope of the scrollHours/totalHours ratio pair (null when no ratio).
  // Week ratios pair weekly categories with the weekly grand total; the
  // slider (hours) still carries the daily average.
  ratioScope: "day" | "week" | null;
};

type RawAppLine = {
  rawName: string;
  minutes: number;
};

type RawParsedScreenTime = {
  hours: number | null;
  source: ParsedScreenTime["source"];
  totalHours?: number | null;
  scrollHours?: number | null;
  apps: RawAppLine[];
  confidence: number;
  layout?: ScreenTimeLayout;
  flags?: ParseFlag[];
  ratioScope?: "day" | "week" | null;
  // day paths drive the slider from scroll time ("count your scroll");
  // average/weekly paths keep the headline on the slider.
  sliderFromScroll?: boolean;
};

export const SCREEN_TIME_LAYOUTS = ["samsung", "pixel", "ios", "unknown"] as const;
export const PARSE_OUTCOMES = ["full", "total_only", "failed"] as const;

const APP_MATCH_THRESHOLD = 0.8;
const SCROLL_CATEGORIES = ["social", "video", "entertainment", "games"] as const;

const appCatalog = [
  { display: "TikTok", variants: ["tiktok", "tik tok", "抖音", "douyin", "ติ๊กต็อก"] },
  { display: "WeChat", variants: ["wechat", "we chat", "微信", "weixin", "วีแชท"] },
  { display: "Instagram", variants: ["instagram", "ig", "อินสตาแกรม"] },
  { display: "YouTube", variants: ["youtube", "you tube", "yt", "ยูทูบ"] },
  { display: "Facebook", variants: ["facebook", "fb", "เฟซบุ๊ก", "เฟสบุ๊ค"] },
  { display: "X", variants: ["x", "twitter", "ทวิตเตอร์"] },
  { display: "Threads", variants: ["threads", "เธรดส์"] },
  { display: "Xiaohongshu", variants: ["xiaohongshu", "red", "rednote", "red note", "小红书", "小紅書", "little red book"] },
  { display: "LINE", variants: ["line", "ไลน์"] },
  { display: "Telegram", variants: ["telegram", "เทเลแกรม"] },
  { display: "WhatsApp", variants: ["whatsapp", "what's app", "วอตส์แอป", "วอทส์แอป"] },
  { display: "Snapchat", variants: ["snapchat", "snap", "สแนปแชต"] },
  { display: "Reddit", variants: ["reddit", "เรดดิท"] },
  { display: "Safari", variants: ["safari", "ซาฟารี"] },
  { display: "Chrome", variants: ["chrome", "google chrome", "โครม"] },
  { display: "Maps", variants: ["maps", "google maps", "apple maps", "地图", "地圖", "แผนที่"] },
  { display: "Photos", variants: ["photos", "google photos", "相簿", "照片", "รูปภาพ"] },
  { display: "Netflix", variants: ["netflix", "เน็ตฟลิกซ์"] },
  { display: "Spotify", variants: ["spotify", "สปอติฟาย"] },
] as const;

// One config for both platforms: Samsung/Android tile labels and the iOS
// taxonomy (Social / Entertainment / Games count as scroll) share these
// variants, including zh-Hant/zh-Hans and Thai label sets.
const scrollCategoryCatalog = [
  { id: "social", variants: ["social", "social networking", "social media", "社交", "โซเชียล", "สังคม"] },
  { id: "video", variants: ["video", "videos", "影片", "视频", "วิดีโอ"] },
  { id: "entertainment", variants: ["entertainment", "娛樂", "娱乐", "ความบันเทิง"] },
  { id: "games", variants: ["games", "game", "遊戲", "游戏", "เกม"] },
] as const;

const excludedCategoryCatalog = [
  "productivity",
  "finance",
  "productivity & finance",
  "productivity and finance",
  "information and reading",
  "shopping & food",
  "shopping and food",
  "shopping",
  "food & drink",
  "health & fitness",
  "health and fitness",
  "health",
  "fitness",
  "travel",
  "navigation",
  "creativity",
  "information",
  "reading",
  "information & reading",
  "education",
  "utilities",
  "utility",
  "communication",
  "other",
  "生產力",
  "生产力",
  "效率",
  "財務",
  "财务",
  "金融",
  "旅行",
  "導航",
  "导航",
  "創意",
  "创意",
  "資訊",
  "信息",
  "資訊與閱讀",
  "信息与阅读",
  "購物與美食",
  "购物与美食",
  "購物",
  "购物",
  "美食",
  "健康與健身",
  "健康与健身",
  "健身",
  "健康",
  "生產力與財務",
  "效率与财务",
  "效率與財務",
  "工作效率",
  "旅遊",
  "閱讀",
  "阅读",
  "教育",
  "工具",
  "實用工具",
  "实用工具",
  "通訊",
  "通讯",
  "通信",
  "其他",
  "การทำงาน",
  "การเงิน",
  "เดินทาง",
  "นำทาง",
  "สร้างสรรค์",
  "ข้อมูล",
  "การอ่าน",
  "การศึกษา",
  "เครื่องมือ",
  "ยูทิลิตี้",
  "การสื่อสาร",
  "อื่นๆ",
  "ช็อปปิ้งและอาหาร",
  "การช็อปปิ้งและอาหาร",
  "ช็อปปิ้ง",
  "สุขภาพและฟิตเนส",
  "ฟิตเนส",
  "สุขภาพ",
  "ประสิทธิภาพและการเงิน",
  "ข้อมูลและการอ่าน",
] as const;

type CategoryKind = (typeof SCROLL_CATEGORIES)[number] | "excluded";
type TotalScope = "average" | "weekly" | "day";

const TOTAL_LABELS: Record<TotalScope, RegExp[]> = {
  average: [
    /\b(?:daily\s+average|average|avg\.?|avg\s*\/\s*day|per\s+day)\b/i,
    /(?:每日平均|日均|平均每天|平均每日|平均|เฉลี่ยต่อวัน|เฉลี่ย|ต่อวัน)/i,
  ],
  weekly: [
    /\b(?:week|weekly|this\s+week)\b/i,
    /(?:本週|本周|週總計|周总计|รายสัปดาห์|สัปดาห์)/i,
  ],
  day: [
    /\b(?:screen\s*time\s*today|screen\s+time|today|daily\s+total|total\s+screen\s+time|total)\b/i,
    /(?:今天螢幕使用時間|今日螢幕使用時間|今天屏幕使用时间|今日屏幕使用时间|螢幕使用時間今天|屏幕使用时间今天|今天|今日|單日|单日|เวลาหน้าจอวันนี้|เวลาใช้หน้าจอวันนี้|เวลาหน้าจอ|วันนี้|รายวัน)/i,
  ],
};

const TOTAL_SCOPES: TotalScope[] = ["average", "weekly", "day"];

// "Total screen time" is scope-dependent: the weekly grand total on a week
// view, the day total on a day view. Assigned per parse via resolveLabels.
const GRAND_TOTAL_LABELS = [
  /\b(?:total\s+screen\s+time)\b/i,
  /(?:總屏幕時間|总屏幕时间|螢幕使用時間總計|屏幕使用时间总计|เวลาหน้าจอทั้งหมด|เวลาหน้าจอรวม)/,
];

// Week-view detection. iOS only shows a "daily average" headline on the
// week view, so average labels are themselves a week signal; the 每周/每週
// tab text and explicit weekly labels are the rest. (Both tab captions
// appear in OCR regardless of which is active — combined with the average
// label they are decisive.)
const WEEK_VIEW_HINT =
  /\b(?:week|weekly|daily\s+average)\b|每周|每週|本週|本周|週總計|周总计|日均|每日平均|รายสัปดาห์|สัปดาห์|เฉลี่ยต่อวัน/i;

// Update-timestamp metadata ("更新于：今天 09:51", "Updated today at 9:41")
// must never contribute labels or durations: 今天 would anchor a day scope
// and the clock time parses as a colon duration.
const METADATA_LINE =
  /更新于|更新於|上次更新|\bupdated\b|\blast\s+update|อัปเดตล่าสุด|อัปเดตเมื่อ/i;

type ScopeLabels = Record<TotalScope, RegExp[]>;

function resolveLabels(isWeekView: boolean): ScopeLabels {
  return {
    average: TOTAL_LABELS.average,
    weekly: isWeekView ? [...TOTAL_LABELS.weekly, ...GRAND_TOTAL_LABELS] : TOTAL_LABELS.weekly,
    day: isWeekView ? TOTAL_LABELS.day : [...TOTAL_LABELS.day, ...GRAND_TOTAL_LABELS],
  };
}

const BLOCKED_APP_ROW =
  /screen time|digital wellbeing|settings|average|avg|daily|total|all apps|pickups|notifications|螢幕|屏幕|平均|每日|總計|总计|ทั้งหมด|เฉลี่ย|หน้าจอ/i;

function normalizeOcrText(text: string) {
  return text
    .replace(/[：﹕]/g, ":")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeAppName(text: string) {
  return text
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[^a-z0-9\u0E00-\u0E7F\u3400-\u9FFF]+/g, "");
}

function levenshteinDistance(a: string, b: string) {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array.from({ length: b.length + 1 }, () => 0);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j += 1) {
      previous[j] = current[j];
    }
  }

  return previous[b.length];
}

function similarity(a: string, b: string) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if ((a.length >= 3 && b.includes(a)) || (b.length >= 3 && a.includes(b))) return 0.96;
  const maxLength = Math.max(a.length, b.length);
  return (maxLength - levenshteinDistance(a, b)) / maxLength;
}

function canonicalAppName(rawName: string) {
  const normalized = normalizeAppName(rawName);
  if (!normalized) return null;

  let best: { display: string; score: number } | null = null;

  for (const app of appCatalog) {
    for (const variant of app.variants) {
      const normalizedVariant = normalizeAppName(variant);
      if (normalizedVariant.length <= 2 && normalized !== normalizedVariant) continue;
      const score = similarity(normalized, normalizedVariant);
      if (!best || score > best.score) {
        best = { display: app.display, score };
      }
    }
  }

  return best && best.score >= APP_MATCH_THRESHOLD ? best.display : null;
}

// Duration tokens accepted everywhere (headlines, app rows, category values):
// "N h M m", "N hr M min", "N hr, M min", "Nh Mm", "N:MM",
// "N 小時 M 分鐘", "N ชั่วโมง M นาที", and bare hour/minute forms.
// Longest unit tokens first so "hr"/"hrs" never half-match as "h" + residue.
const HOUR_UNITS = "hours|hour|hrs|hr|h|小時|小时|ชั่วโมง|ชม\\.?";
const MINUTE_UNITS = "minutes|minute|mins|min|m|分鐘|分钟|นาที";

// hours === null means the span was RECOGNIZED as a duration-shaped token
// but its value was rejected (out-of-range magnitude, or a genuinely
// ambiguous unit). Consuming the span keeps other patterns from re-matching
// a fragment of it into a plausible-but-wrong number, keeps residue checks
// honest, and keeps unit counts aligned for name-value pairing.
type DurationMatch = {
  hours: number | null;
  index: number;
  end: number;
  composite: boolean;
  dropped?: "ambiguous" | "invalid";
};

function overlapsSpan(spans: Array<[number, number]>, start: number, end: number) {
  return spans.some(([s, e]) => start < e && end > s);
}

// maxHours gates plausibility by view scope: 24 for day-scoped screens,
// 168 when the screenshot is a week view (a 45h weekly total is plausible;
// a bare ambiguous token in week view is almost never resolvable).
export function findDurations(input: string, maxHours = 24): DurationMatch[] {
  const text = input.toLowerCase();
  const matches: DurationMatch[] = [];
  const spans: Array<[number, number]> = [];
  const push = (match: DurationMatch) => {
    matches.push(match);
    spans.push([match.index, match.end]);
  };

  const colonRe = /\b(\d{1,2})\s*:\s*(\d{2})\b/g;
  for (let m = colonRe.exec(text); m; m = colonRe.exec(text)) {
    const value = Number(m[1]) + Number(m[2]) / 60;
    if (value >= 1 / 60 && value <= maxHours) {
      push({ hours: value, index: m.index, end: m.index + m[0].length, composite: true });
    }
  }

  const hoursRe = new RegExp(
    `(\\d{1,2}(?:[.,]\\d+)?)\\s*(?:${HOUR_UNITS})(?![a-z])(?:\\s*,?\\s*(\\d{1,3})\\s*(?:${MINUTE_UNITS})(?![a-z]))?`,
    "gi",
  );
  for (let m = hoursRe.exec(text); m; m = hoursRe.exec(text)) {
    const start = m.index;
    const end = m.index + m[0].length;
    if (overlapsSpan(spans, start, end)) continue;
    const hoursPart = Number(m[1].replace(",", "."));
    const minutesPart = m[2] ? Number(m[2]) : 0;
    // Magnitude guard: two ordered units mean h then m.
    if (hoursPart > maxHours || (m[2] && minutesPart > 59)) {
      push({ hours: null, index: start, end, composite: Boolean(m[2]), dropped: "invalid" });
      continue;
    }
    const value = hoursPart + minutesPart / 60;
    if (value >= 1 / 60 && value <= maxHours) {
      push({ hours: value, index: start, end, composite: Boolean(m[2]) });
    }
  }

  // OCR misreads unit letters: the mixed eng+chi_tra+tha model turns h/m
  // into Thai \u0e17, and lower-quality captures turn "h" into other single
  // letters (n, b — observed as "1 n 21 m" reading as bare 21m and dropping
  // the hour). The composite "N <letter> M <minute-unit>" shape is strongly
  // h-then-m, so any single letter except m is accepted in the hour slot;
  // the minute slot stays strict and magnitude guards still apply.
  const confusedRe = /(\d{1,2})\s*[a-ln-z\u0E17]\s*(\d{1,3})\s*(?:min|m|\u0E17)(?![a-z0-9\u0E00-\u0E7F])/gi;
  for (let m = confusedRe.exec(text); m; m = confusedRe.exec(text)) {
    const start = m.index;
    const end = m.index + m[0].length;
    if (overlapsSpan(spans, start, end)) continue;
    const hoursPart = Number(m[1]);
    const minutesPart = Number(m[2]);
    if (hoursPart > maxHours || minutesPart > 59) {
      push({ hours: null, index: start, end, composite: true, dropped: "invalid" });
      continue;
    }
    const value = hoursPart + minutesPart / 60;
    if (value >= 1 / 60 && value <= maxHours) {
      push({ hours: value, index: start, end, composite: true });
    }
  }

  const minutesRe = new RegExp(`(\\d{1,3})\\s*(?:${MINUTE_UNITS})(?![a-z])`, "gi");
  for (let m = minutesRe.exec(text); m; m = minutesRe.exec(text)) {
    const start = m.index;
    const end = m.index + m[0].length;
    if (overlapsSpan(spans, start, end)) continue;
    const value = Number(m[1]) / 60;
    if (value >= 1 / 60 && value <= maxHours) {
      push({ hours: value, index: start, end, composite: false });
    }
  }

  // Bare "N \u0e17": a lone ambiguous unit. Above 59 it is no plausible display
  // value; 25-59 can only be minutes (hours cap at 24); 1-24 could be either
  // hours or minutes -- never guess: drop the token and let the caller mark
  // the read unverified.
  const confusedMinRe = /(\d{1,3})\s*\u0E17(?![a-z0-9\u0E00-\u0E7F])/gi;
  for (let m = confusedMinRe.exec(text); m; m = confusedMinRe.exec(text)) {
    const start = m.index;
    const end = m.index + m[0].length;
    if (overlapsSpan(spans, start, end)) continue;
    const value = Number(m[1]);
    if (value > Math.max(59, maxHours)) {
      push({ hours: null, index: start, end, composite: false, dropped: "invalid" });
    } else if (maxHours <= 24 && value >= 25 && value <= 59) {
      // Day view: 25-59 can only be minutes (hours cap at 24).
      push({ hours: value / 60, index: start, end, composite: false });
    } else if (value >= 1) {
      // Day view 1-24, or anything up to 168 in week view: never guess.
      push({ hours: null, index: start, end, composite: false, dropped: "ambiguous" });
    }
  }

  return matches.sort((a, b) => a.index - b.index);
}

function firstDurationHours(text: string) {
  return findDurations(text).find((match) => match.hours !== null)?.hours ?? null;
}

function stripDurations(text: string) {
  const durations = findDurations(text);
  let out = "";
  let cursor = 0;
  for (const duration of durations) {
    out += `${text.slice(cursor, duration.index)} `;
    cursor = duration.end;
  }
  return out + text.slice(cursor);
}

function isDurationOnlyLine(line: string, durations: DurationMatch[]) {
  if (durations.length === 0) return false;
  // A single stray character of residue is OCR noise (orphaned Thai vowel
  // marks, icon glyphs), not content — observed as "า" on real uploads.
  return stripDurations(line).replace(/[^\p{L}\p{N}]/gu, "").length <= 1;
}

function categoryKindFromText(text: string): CategoryKind | null {
  const normalized = normalizeAppName(stripDurations(text));
  if (!normalized) return null;

  for (const category of scrollCategoryCatalog) {
    for (const variant of category.variants) {
      const normalizedVariant = normalizeAppName(variant);
      if (normalized === normalizedVariant || normalized.includes(normalizedVariant) || normalizedVariant.includes(normalized)) {
        return category.id;
      }
    }
  }

  for (const variant of excludedCategoryCatalog) {
    const normalizedVariant = normalizeAppName(variant);
    if (normalized === normalizedVariant || normalized.includes(normalizedVariant) || normalizedVariant.includes(normalized)) {
      return "excluded";
    }
  }

  return null;
}

function isAppOrCategoryContext(text: string) {
  const label = stripDurations(text).trim();
  return Boolean(label && (canonicalAppName(label) || categoryKindFromText(label)));
}

function totalScopeFromText(text: string, labels: ScopeLabels): TotalScope | null {
  for (const scope of TOTAL_SCOPES) {
    if (labels[scope].some((label) => label.test(text))) return scope;
  }
  return null;
}

// Ordered category labels in a run of text, longest variant first so
// "productivity and finance" is one unit, not two. Used for Samsung tile
// rows where OCR emits several tile names on one line.
function categoryUnitsFromText(text: string): CategoryKind[] {
  const lower = text.toLowerCase();
  const found: Array<{ index: number; kind: CategoryKind }> = [];
  const consumed: Array<[number, number]> = [];
  const catalog: Array<{ kind: CategoryKind; variant: string }> = [];
  for (const category of scrollCategoryCatalog) {
    for (const variant of category.variants) catalog.push({ kind: category.id, variant: variant.toLowerCase() });
  }
  for (const variant of excludedCategoryCatalog) catalog.push({ kind: "excluded", variant: variant.toLowerCase() });
  catalog.sort((a, b) => b.variant.length - a.variant.length);

  for (const { kind, variant } of catalog) {
    let from = 0;
    while (from < lower.length) {
      const index = lower.indexOf(variant, from);
      if (index === -1) break;
      const end = index + variant.length;
      if (!overlapsSpan(consumed, index, end)) {
        consumed.push([index, end]);
        found.push({ index, kind });
      }
      from = end;
    }
  }

  return found.sort((a, b) => a.index - b.index).map((entry) => entry.kind);
}

// Multi-category legend lines (iOS: "Creativity 44m · Social 32m · Travel 9m")
// are split into segments so each duration pairs with its own label.
function categoryPairsFromLine(text: string, durations: DurationMatch[]) {
  const pairs: Array<{ kind: CategoryKind; minutes: number }> = [];
  let cursor = 0;
  for (const duration of durations) {
    const segment = text.slice(cursor, duration.index);
    const kind = categoryKindFromText(segment);
    // Dropped tokens keep their segment consumed but produce no pair — the
    // tile is dropped rather than silently guessed.
    if (kind && duration.hours !== null) pairs.push({ kind, minutes: Math.round(duration.hours * 60) });
    cursor = duration.end;
  }
  return pairs;
}

type ScreenTimeLine = {
  text: string;
  durations: DurationMatch[];
  durationOnly: boolean;
  scope: TotalScope | null;
  categoryPairs: Array<{ kind: CategoryKind; minutes: number }>;
  appRow: RawAppLine | null;
  nameKind: "label" | "category" | "app" | null;
  categoryNameKind: CategoryKind | null;
  appName: string | null;
  pairedTotal: number | null;
  claimed: boolean;
};

function appRowFromLine(text: string, durations: DurationMatch[], categoryPairs: ScreenTimeLine["categoryPairs"], scope: TotalScope | null): RawAppLine | null {
  if (durations.length === 0 || categoryPairs.length > 0 || scope !== null) return null;
  if (BLOCKED_APP_ROW.test(text)) return null;
  const firstValid = durations.find((duration) => duration.hours !== null);
  if (!firstValid || firstValid.hours === null) return null;
  const rawName = stripDurations(text)
    .replace(/[·•|-]+\s*$/g, "")
    .trim();
  if (rawName.length < 1 || rawName.length > 40) return null;
  return { rawName, minutes: Math.round(firstValid.hours * 60) };
}

function buildLine(text: string, maxHours: number, labels: ScopeLabels): ScreenTimeLine {
  if (METADATA_LINE.test(text)) {
    // Inert: update timestamps carry day words and clock times that must
    // not become anchors or durations.
    return { text, durations: [], durationOnly: false, scope: null, categoryPairs: [], appRow: null, nameKind: null, categoryNameKind: null, appName: null, pairedTotal: null, claimed: false };
  }
  const durations = findDurations(text, maxHours);
  // Comparison furniture ("⬇ 25% from last week", 比上周下降25%) contains
  // scope words but is never a totals label — a percentage disqualifies
  // the line from label duty (no real average/total label carries one).
  const scope = /\d\s*%/.test(text) ? null : totalScopeFromText(text, labels);
  const categoryPairs = durations.length > 0 ? categoryPairsFromLine(text, durations) : [];
  const appRow = appRowFromLine(text, durations, categoryPairs, scope);

  let nameKind: ScreenTimeLine["nameKind"] = null;
  let categoryNameKind: CategoryKind | null = null;
  let appName: string | null = null;
  if (durations.length === 0) {
    if (scope) {
      nameKind = "label";
    } else {
      categoryNameKind = categoryKindFromText(text);
      if (categoryNameKind) {
        nameKind = "category";
      } else if (!BLOCKED_APP_ROW.test(text) && canonicalAppName(text)) {
        nameKind = "app";
        appName = text.trim();
      }
    }
  }

  return {
    text,
    durations,
    durationOnly: isDurationOnlyLine(text, durations),
    scope,
    categoryPairs,
    appRow,
    nameKind,
    categoryNameKind,
    appName,
    pairedTotal: null,
    claimed: false,
  };
}

// OCR often emits a screenshot's label column and value column as separate
// blocks: a run of name lines followed by a run of duration-only lines.
// Both sides are decomposed into UNITS before pairing — a tile row can put
// several category names on one line (with wraps) and several durations on
// the next — then zipped tail-aligned: extra leading durations belong to
// content above the list (typically the headline total).
type NameUnit =
  | { type: "label"; line: ScreenTimeLine }
  | { type: "category"; kind: CategoryKind }
  | { type: "app"; rawName: string };

function nameUnitsFromPending(pending: ScreenTimeLine[]): NameUnit[] {
  const units: NameUnit[] = [];
  let index = 0;
  while (index < pending.length) {
    const line = pending[index];
    if (line.nameKind === "category") {
      // Join consecutive category lines so wrapped tile names
      // ("Productivity and" / "finance") resolve as one unit.
      let joined = "";
      while (index < pending.length && pending[index].nameKind === "category") {
        joined += ` ${pending[index].text}`;
        index += 1;
      }
      for (const kind of categoryUnitsFromText(joined)) units.push({ type: "category", kind });
      continue;
    }
    if (line.nameKind === "label") units.push({ type: "label", line });
    else if (line.nameKind === "app" && line.appName) units.push({ type: "app", rawName: line.appName });
    index += 1;
  }
  return units;
}

function zipNameValueRuns(lines: ScreenTimeLine[], onPair: (unit: NameUnit, hours: number) => void, onFlag: (flag: ParseFlag) => void) {
  let pending: ScreenTimeLine[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (line.durationOnly) {
      const values: ScreenTimeLine[] = [];
      while (index < lines.length && lines[index].durationOnly) {
        values.push(lines[index]);
        index += 1;
      }
      const units = nameUnitsFromPending(pending);
      // Dropped (null) tokens still occupy their position so alignment
      // survives; their pair simply produces nothing (tile dropped).
      const durations = values.flatMap((value) => value.durations.map((d) => ({ line: value, hours: d.hours, composite: d.composite })));

      // Count guard for tile runs: one missing/extra token would shift
      // every pair after it, so positional zipping is only trusted when
      // durations match all units (tail-aligned labels included) or exactly
      // the category units. Counts include excluded categories ("productivity
      // and finance") and dropped tokens — the comparison happens BEFORE any
      // exclusion or drop filtering.
      const categoryUnitCount = units.filter((unit) => unit.type === "category").length;
      if (categoryUnitCount > 0 && durations.length !== units.length && durations.length !== categoryUnitCount) {
        onFlag("tile_count_mismatch");
        for (const value of values) value.claimed = true;
        pending = [];
        continue;
      }

      // Label-only runs with extra durations: the extras are chart-axis
      // style tokens ("12 小时"), which are bare — pair labels with
      // composite values first, in order, and claim the whole run so an
      // axis token can never be promoted later.
      const labelOnly = units.length > 0 && units.every((unit) => unit.type === "label");
      if (labelOnly && durations.length > units.length) {
        const order = durations
          .map((value, position) => ({ value, position }))
          .sort((x, y) => Number(y.value.hours !== null && y.value.composite) - Number(x.value.hours !== null && x.value.composite) || x.position - y.position);
        units.forEach((unit, position) => {
          const chosen = order[position];
          if (!chosen) return;
          if (chosen.value.hours !== null) onPair(unit, chosen.value.hours);
        });
        for (const value of values) value.claimed = true;
        pending = [];
        continue;
      }

      const offset = durations.length - units.length;
      units.forEach((unit, position) => {
        const value = durations[position + offset];
        if (!value) return;
        if (value.hours !== null) onPair(unit, value.hours);
        value.line.claimed = true;
      });
      pending = [];
      continue;
    }

    if (line.durations.length === 0 && line.nameKind) {
      pending.push(line);
    } else {
      pending = [];
    }
    index += 1;
  }
}

function analyzeScreenTime(rawText: string, maxHours: number, labels: ScopeLabels) {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => normalizeOcrText(line))
    .filter(Boolean)
    .map((line) => buildLine(line, maxHours, labels));

  const apps: RawAppLine[] = [];
  const categoryMinutes = new Map<CategoryKind, number>();
  const addCategory = (kind: CategoryKind, minutes: number) => {
    if (kind === "excluded" || categoryMinutes.has(kind)) return;
    categoryMinutes.set(kind, minutes);
  };

  for (const line of lines) {
    if (line.appRow) apps.push(line.appRow);
    for (const pair of line.categoryPairs) addCategory(pair.kind, pair.minutes);
  }

  const flags: ParseFlag[] = [];
  zipNameValueRuns(
    lines,
    (unit, hours) => {
      if (unit.type === "label") {
        unit.line.pairedTotal = hours;
      } else if (unit.type === "category") {
        addCategory(unit.kind, Math.round(hours * 60));
      } else {
        apps.push({ rawName: unit.rawName, minutes: Math.round(hours * 60) });
      }
    },
    (flag) => flags.push(flag),
  );

  let scrollMinutes = 0;
  for (const minutes of categoryMinutes.values()) scrollMinutes += minutes;

  if (lines.some((line) => line.durations.some((duration) => duration.dropped === "ambiguous"))) {
    flags.push("ambiguous_duration_dropped");
  }

  return { lines, apps, scrollHours: scrollMinutes > 0 ? scrollMinutes / 60 : null, flags };
}

function sameLineAnchoredHours(line: ScreenTimeLine, scope: TotalScope, labels: ScopeLabels) {
  for (const label of labels[scope]) {
    const match = label.exec(line.text);
    if (!match) continue;
    const afterLabel = match.index + match[0].length;
    const duration = line.durations.find((candidate) => candidate.index >= afterLabel && candidate.hours !== null);
    if (!duration) continue;
    if (isAppOrCategoryContext(line.text.slice(afterLabel, duration.index))) continue;
    return duration.hours;
  }
  return null;
}

// Label-anchored total, in trust order: value on the label's own line ->
// value zip-paired to the label -> a composite value leading the ADJACENT
// line (headline values are often polluted by delta text like
// "5h 20m ⬇ 25% from last week", which fails the duration-only check) ->
// a composite duration-only line in the window. Chart furniture (bare
// axis ticks "10h"/"12小时", "avg"/平均, "0") can never win: axis ticks are
// bare, never composite, and label words alone carry no value. If no
// anchored pair exists the caller fails to manual — a floating fragment
// is never promoted.
function resolveAnchoredTotal(lines: ScreenTimeLine[], scope: TotalScope, labels: ScopeLabels) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.scope !== scope) continue;

    if (line.durations.length > 0 && line.appRow === null && line.categoryPairs.length === 0) {
      const sameLine = sameLineAnchoredHours(line, scope, labels);
      if (sameLine !== null) return sameLine;
    }

    if (line.pairedTotal !== null) return line.pairedTotal;

    const next = lines[index + 1];
    if (next && !next.claimed && next.categoryPairs.length === 0 && next.durations.length > 0) {
      const adjacent = next.durations.find((duration) => duration.hours !== null);
      if (adjacent && adjacent.composite) {
        // Leading-value check: app rows and total rows put text BEFORE the
        // duration; a headline value leads its line.
        const prefix = next.text.slice(0, adjacent.index).replace(/[^\p{L}\p{N}]/gu, "");
        if (prefix.length <= 1) return adjacent.hours;
      }
    }

    const candidates: DurationMatch[] = [];
    for (let offset = 1; offset <= 8 && index + offset < lines.length; offset += 1) {
      const candidate = lines[index + offset];
      if (!candidate.durationOnly || candidate.claimed) continue;
      const firstComposite = candidate.durations.find((duration) => duration.hours !== null && duration.composite);
      if (firstComposite) candidates.push(firstComposite);
    }
    if (candidates.length > 0 && candidates[0].hours !== null) return candidates[0].hours;
  }

  return null;
}

export function guessScreenTimeLayout(rawText: string): ScreenTimeLayout {
  const text = rawText.toLowerCase();
  if (/digital\s*wellbeing/.test(text)) {
    return /\d\s*(?:hr|min)\b/.test(text) ? "pixel" : "samsung";
  }
  if (/most\s*used\s*app\s*categories|app\s*timers/.test(text)) {
    return "samsung";
  }
  if (text.split(/\r?\n/).some((line) => /screen\s*time\s*today/.test(line))) {
    return "samsung";
  }
  if (/show\s*categories|daily\s*average|screen\s*time/.test(text)) {
    return "ios";
  }
  return "unknown";
}

export function classifyParseOutcome(parsed: ParsedScreenTime): ParseOutcome {
  if (parsed.hours === null) return "failed";
  return parsed.scrollHours === null ? "total_only" : "full";
}

export function sanitizeParsedResult(parsed: RawParsedScreenTime): ParsedScreenTime {
  const ratioScope = parsed.ratioScope ?? (parsed.scrollHours != null ? "day" : null);
  const ratioMaxHours = ratioScope === "week" ? 168 : 12;
  const headlineHours = parsed.hours !== null && parsed.hours >= 0.5 && parsed.hours <= 12 ? parsed.hours : null;
  const totalHours = parsed.totalHours != null && parsed.totalHours >= 0.5 && parsed.totalHours <= ratioMaxHours ? parsed.totalHours : null;
  const candidateScrollHours = parsed.scrollHours != null && parsed.scrollHours >= 0.5 && parsed.scrollHours <= ratioMaxHours ? parsed.scrollHours : null;
  const exceedsHeadline = Boolean(
    candidateScrollHours && totalHours && Math.round(candidateScrollHours * 60) > Math.round(totalHours * 60),
  );
  const scrollHours = candidateScrollHours && !exceedsHeadline ? candidateScrollHours : null;
  const sliderFromScroll = parsed.sliderFromScroll ?? true;
  const hours = sliderFromScroll ? scrollHours ?? headlineHours : headlineHours ?? scrollHours;
  const source = hours ? parsed.source : null;
  const totalMinutes = hours ? Math.round(hours * 60) : null;
  // App rows share the ratio total's scope (weekly rows on a week view),
  // so the plausibility cap follows totalHours when present.
  const maxAppMinutes = (totalHours ? Math.round(totalHours * 60) : totalMinutes) ?? 8 * 60;
  // Duplicate canonical names keep the LARGEST minutes: iOS "Limits" rows
  // ("Instagram 1 hr") would otherwise shadow the real usage row.
  const byName = new Map<string, number>();
  for (const app of parsed.apps) {
    const canonical = canonicalAppName(app.rawName);
    if (!canonical) continue;
    if (!Number.isFinite(app.minutes) || app.minutes <= 0 || app.minutes > 16 * 60 || app.minutes > maxAppMinutes) continue;
    byName.set(canonical, Math.max(byName.get(canonical) ?? 0, app.minutes));
  }
  const apps = [...byName.entries()]
    .map(([name, minutes]) => ({ name, minutes }))
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 3);

  return {
    hours,
    source,
    totalHours,
    scrollHours,
    apps,
    confidence: Math.max(0, Math.min(100, parsed.confidence)),
    layout: parsed.layout ?? "unknown",
    flags: [...new Set([...(parsed.flags ?? []), ...(exceedsHeadline ? (["category_total_exceeds_headline"] as const) : [])])],
    ratioScope: scrollHours ? ratioScope : null,
  };
}

export function parseScreenTimeText(rawText: string, ocrConfidence = 0): ParsedScreenTime {
  const layout = guessScreenTimeLayout(rawText);
  const isWeekView = WEEK_VIEW_HINT.test(rawText);
  const labels = resolveLabels(isWeekView);
  const { lines, apps, scrollHours, flags } = analyzeScreenTime(rawText, isWeekView ? 168 : 24, labels);
  const confidence = Math.max(0, Math.min(100, ocrConfidence));
  const confidenceOk = confidence === 0 || confidence >= 45;

  // An average headline drives the slider. On a week view, categories and
  // the grand total share the WEEK scope, so the scroll ratio pairs weekly
  // scroll with the weekly grand total; without a confidently anchored
  // grand total the ratio is suppressed (total-only) — never mix scopes.
  const average = resolveAnchoredTotal(lines, "average", labels);
  if (average && average >= 0.5 && average <= 12 && confidenceOk) {
    let ratio: { scrollHours: number; totalHours: number } | null = null;
    if (isWeekView && scrollHours) {
      const weeklyGrand = resolveAnchoredTotal(lines, "weekly", labels);
      if (weeklyGrand && weeklyGrand >= 0.5 && weeklyGrand <= 168 && scrollHours <= weeklyGrand) {
        ratio = { scrollHours, totalHours: weeklyGrand };
      }
    }
    return sanitizeParsedResult({
      hours: average,
      totalHours: ratio ? ratio.totalHours : average,
      scrollHours: ratio ? ratio.scrollHours : null,
      ratioScope: ratio ? "week" : null,
      sliderFromScroll: false,
      source: "average",
      apps,
      confidence,
      layout,
      flags,
    });
  }

  const weeklyTotal = resolveAnchoredTotal(lines, "weekly", labels);
  if (weeklyTotal && weeklyTotal >= 3.5 && weeklyTotal <= 84 && confidenceOk) {
    return sanitizeParsedResult({ hours: weeklyTotal / 7, totalHours: weeklyTotal / 7, scrollHours: null, ratioScope: null, sliderFromScroll: false, source: "weekly-total", apps, confidence, layout, flags });
  }

  const dayTotal = resolveAnchoredTotal(lines, "day", labels);
  if (dayTotal && dayTotal >= 0.5 && dayTotal <= 12) {
    return sanitizeParsedResult({ hours: dayTotal, totalHours: dayTotal, scrollHours, ratioScope: "day", source: "day-total", apps, confidence, layout, flags });
  }

  // Category-derived scroll time with no surviving headline: the headline
  // was cropped or unreadable. Usable, but never verified.
  const fallbackFlags: ParseFlag[] = scrollHours ? [...flags, "headline_crop_unrecoverable"] : flags;
  return sanitizeParsedResult({ hours: null, totalHours: null, scrollHours, source: scrollHours ? "day-total" : null, apps, confidence, layout, flags: fallbackFlags });
}

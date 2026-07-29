"use client";

import { ChangeEvent, KeyboardEvent, type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { appLinks } from "@/lib/site";
import { classifyParseOutcome, parseScreenTimeText, type AppRoast, type ParseFlag, type ParseOutcome, type ScreenTimeLayout } from "@/lib/scroll/ocrSanitizer";
import { recognizeScreenTime } from "@/lib/scroll/ocrPipeline";
import { detectWebviewEnv, type WebviewEnv } from "@/lib/scroll/webview";
import { SCROLL_CAMPAIGN_UTM, SCROLL_DEEP_LINK_PARAMS, SCROLL_STANDINGS, detectScrollLocale, normalPercentile, normalizeScrollLocale, type ScrollLocale, type ScrollRegion } from "@/lib/scroll/campaign";
import { FLIP_MINUTES_PER_DAY, LADDER_TRACKS, getEducationOutput, getTrackName } from "@/lib/scroll/education";
import { getArchetypeCopy, getScanStageMessage, getShareCaptionVariant, getTapeNote, type ScanStage } from "@/lib/scroll/personality";
import { getRankFrame } from "@/lib/scroll/rank";

const HRS_YR = 365;
const PUBLIC_HOME_URL = "https://www.neuralfin.ai";
const PUBLIC_SCROLL_LABEL = "www.neuralfin.ai/scroll";
const fmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

type Lang = ScrollLocale;
type TapeRow = { region: ScrollRegion; hours: number; flipped?: boolean };
type UploadStatus = "idle" | "received" | "read" | "failed" | "partial";
type ParsedScrollStat = { scrollHours: number; totalHours: number };

const regionOrder: ScrollRegion[] = ["ww", "hk", "sg", "th"];

const demoTape: TapeRow[] = [
  { region: "hk", hours: 6.5 },
  { region: "sg", hours: 3 },
  { region: "th", hours: 8 },
  { region: "hk", hours: 2, flipped: true },
  { region: "sg", hours: 5.5 },
  { region: "hk", hours: 11 },
];

const str = {
  en: {
    pill: "Built for the scroll generation",
    h1a: "Your scroll has a",
    sub: "Drag to your daily screen time. See the damage, see where you rank, post the card, then flip it green in the app.",
    steps: ["Upload", "See the damage", "Post it"],
    slider: "Your daily screen time",
    sliderSub: "count your scroll — social, video, games",
    hday: "h / day",
    scales: ["30 min", "saint", "6 h", "certified scroller", "12 h"],
    regions: { ww: "Worldwide", hk: "Hong Kong", sg: "Singapore", th: "Thailand" },
    scrollpos: "Scroll position",
    openloss: "Open loss",
    verified: "Verified",
    hrsyr: "hours per year",
    pace: "at your current pace",
    learnpos: "Learning position",
    compounding: "Compounding",
    feedcould: "what your feed could have taught you",
    lessonYield: (hours: string, lessons: number, phrase: string, track: string) =>
      `Your ${hours}h/day = ${lessons} micro-lessons a day hiding in your scroll. You'd finish ${track} ${phrase}.`,
    lessonZero: "Lesson zero, free:",
    hyr: "h/yr",
    ladder: [
      ["Week 1", "What an ETF actually is", "and why everyone will not stop talking about them"],
      ["Month 1", "Read a balance sheet without sweating", "where the bodies are buried"],
      ["Month 6", "Build your first watchlist thesis", "an actual opinion, not a group-chat tip"],
    ],
    milestone: (date: string) => [
      "By " + date,
      "≈ a university intro-to-investing course",
      "funded entirely by your feed",
    ],
    dropTitle: "Upload your screen-time screenshot",
    dropSub: "Read on your device · never uploaded",
    dropHint: "iPhone: Settings → Screen Time · Android: Digital Wellbeing",
    dropReceived: "✓ Screenshot received",
    dropRead: (duration: string) => `✓ Read: ${duration}`,
    dropReadScrollDay: (scroll: string, total: string) => `${scroll} of scroll in your ${total} day`,
    dropReadScrollWeek: (scroll: string, total: string) => `${scroll} of scroll in your ${total} week`,
    dropReadScroll: (scroll: string) => `${scroll} of scroll time`,
    dropCouldnt: "Couldn't read that",
    dropReplace: "Use a different screenshot",
    dropDone: "We read {hours} h/day — look right?",
    dropDay: (duration: string) => `That's today's number (${duration}) — set. For your true average, upload the Week view.`,
    dropApps: "Couldn't read your hours — set them below.",
    dropPartialChip: "\u2713 Found your app list",
    dropAppsOnly: "Found your app list — but not your total. Scroll to the top of Screen Time and screenshot the daily average.",
    longPressSave: "Long-press the image to save it",
    overlayClose: "Close",
    dropFail: "Couldn't read your hours — set them below.",
    orManual: "or drag it manually",
    priv: "Screenshots are read on your device and never uploaded. App names stay private unless you share them.",
    stand: "Market standings",
    standsub: "Ranked by % flipped — the market that turns scroll into skill wins.",
    standnote: "Demo data. Launch build: computed from the same anonymous aggregates (hours + market only). Pre-launch averages cite published statistics until community volume takes over.",
    avgday: "avg / day",
    flipped: "flipped",
    youare: "your market",
    tape: "The tape",
    tapesub: "Recent scrolls, marked to market. Anonymous, always.",
    tapenote: "Demo data shown. Launch build: pre-launch ranks benchmark against published screen-time statistics (sourced); community tape activates once real results accumulate. Only hours + market are stored — nothing identifying.",
    f1: "Trading services provided through DL Securities (Hong Kong) Limited, a licensed corporation regulated by the SFC.",
    f2: "Screenshot analysis happens locally in your browser; images and app names are not uploaded or stored. Community stats are anonymous (hours and market only).",
    f3: "This page is a marketing illustration for education and entertainment. It is not financial advice, a forecast, or a projection of returns.",
    vbadge: "VERIFIED SCROLL",
    cardtitle: "My Scroll P&L · 2026",
    cardflip: `Flipping ${FLIP_MINUTES_PER_DAY} min/day →`,
    challenge: "Are you down more than me?",
    scan: "Scan yours ↓",
    savebtn: "Download picture 📸",
    sticky1: "Flip your P&L for real",
    sticky2: "10 min/day in the NeuralFin app",
    anon: "anon",
    bench: "vs. published screen-time benchmarks",
    mostShorted: "Most shorted:",
    wkwks: "work wks",
    vsmkt: "vs market avg",
    youAt: (hours: string) => `You · ${hours}h`,
    scrollChip: (scroll: string, total: string) => `${scroll} of ${total} was scroll`,
    fun: (yr: number) => {
      if (yr < 500) return { title: "Every Star Wars film", sub: "...even the prequels.", num: `×${Math.round(yr / 25)}` };
      if (yr < 1200) return { title: "One full watch of Titanic", sub: "The boat sinks every time.", num: `×${Math.round(yr / 3.23)}` };
      return { title: "Flying HK → New York", sub: "Without the air miles.", num: `×${Math.round(yr / 16)}` };
    },
  },
  "zh-Hant": {
    pill: "為滑屏世代而生",
    h1a: "你的滑屏也有",
    sub: "拖到你的每日螢幕時間。看看虧了多少、排第幾名、發卡挑戰朋友，再到 App 把它翻綠。",
    steps: ["上傳", "看看虧損", "發出去"],
    slider: "你的每日螢幕時間",
    // DRAFT — native review required
    sliderSub: "計算你的滑屏：社交、影片、遊戲",
    hday: "小時／天",
    scales: ["30分鐘", "聖人", "6小時", "認證滑屏員", "12小時"],
    regions: { ww: "全球", hk: "香港", sg: "新加坡", th: "泰國" },
    scrollpos: "滑屏持倉",
    openloss: "未平虧損",
    verified: "已驗證",
    hrsyr: "每年時數",
    pace: "照這個節奏",
    learnpos: "學習持倉",
    compounding: "複利中",
    feedcould: "你的 feed 本來可以教你的",
    lessonYield: (hours: string, lessons: number, phrase: string, track: string) =>
      `你每天 ${hours} 小時 = ${lessons} 節微課藏在滑屏裡。你可在${phrase}完成${track}。`,
    lessonZero: "第零課，免費：",
    hyr: "小時／年",
    ladder: [
      ["第1週", "ETF 到底是什麼", "以及為什麼人人都在講"],
      ["第1個月", "看懂資產負債表不再冒汗", "知道數字藏在哪裡"],
      ["第6個月", "建立你第一個自選股觀點", "自己的判斷，不是群組貼士"],
    ],
    milestone: (date: string) => [
      date + "前",
      "≈ 一門大學投資入門課",
      "全由你的 feed 贊助",
    ],
    dropTitle: "上傳你的螢幕時間截圖",
    dropSub: "只在你的裝置上讀取 · 永不上傳",
    dropHint: "iPhone：設定 → 螢幕使用時間 · Android：數位健康",
    // DRAFT — native review required
    dropReceived: "✓ 已收到截圖",
    // DRAFT — native review required
    dropRead: (duration: string) => `✓ 已讀取：${duration}`,
    // DRAFT — native review required
    dropReadScrollDay: (scroll: string, total: string) => `${scroll}滑屏 / ${total}今日總時數`,
    // DRAFT — native review required
    dropReadScrollWeek: (scroll: string, total: string) => `${scroll}滑屏 / ${total}本週總時長`,
    // DRAFT — native review required
    dropReadScroll: (scroll: string) => `${scroll}滑屏時間`,
    // DRAFT — native review required
    dropCouldnt: "讀不到這張截圖",
    // DRAFT — native review required
    dropReplace: "改用另一張截圖",
    dropDone: "我們讀到 {hours} 小時／天——看起來對嗎？",
    // DRAFT — native review required
    dropDay: (duration: string) => `這是今天的數字（${duration}）——已設定。若要真實平均，請上傳週視圖。`,
    dropApps: "讀不到你的時數——請在下方手動設定。",
    // DRAFT — native review required
    dropPartialChip: "\u2713 已找到你的 App 清單",
    // DRAFT — native review required
    dropAppsOnly: "找到你的 App 清單——但沒有總時數。捲到螢幕使用時間最上方，截圖每日平均。",
    // DRAFT — native review required
    longPressSave: "長按圖片即可儲存",
    // DRAFT — native review required
    overlayClose: "關閉",
    dropFail: "讀不到你的時數——請在下方手動設定。",
    orManual: "或者手動拖一下",
    priv: "截圖只在你的裝置上讀取，永不上傳。App 名稱除非你分享，否則保密。",
    stand: "市場排行榜",
    standsub: "以「翻轉率」排名——哪個市場最會把滑屏變本事，誰就贏。",
    standnote: "目前為示範數據。正式版：由同一組匿名統計（僅時數＋市場）計算。上線初期平均值引用公開統計，社群數據足夠後切換。",
    avgday: "平均／天",
    flipped: "已翻轉",
    youare: "你的市場",
    tape: "即時行情",
    tapesub: "最新滑屏紀錄，逐筆入市。全部匿名。",
    tapenote: "目前為示範數據。正式版：上線初期以公開的螢幕時間統計（附來源）作基準；社群數據累積後切換為真實行情。只儲存時數＋市場，絕無任何識別資料。",
    f1: "交易服務由德林證券（香港）有限公司提供，該公司為香港證監會持牌法團。",
    f2: "截圖分析只在你的瀏覽器本機進行；圖片與 App 名稱不會上傳或儲存。社群統計為匿名（僅時數與市場）。",
    f3: "本頁為市場推廣示意，僅供教育與娛樂。不構成投資建議、預測或回報推算。",
    vbadge: "已驗證滑屏",
    cardtitle: "我的滑屏損益 · 2026",
    cardflip: `每天翻轉 ${FLIP_MINUTES_PER_DAY} 分鐘 →`,
    challenge: "你虧得比我多嗎？",
    scan: "掃你的 ↓",
    savebtn: "下載圖片 📸",
    sticky1: "真正翻轉你的損益",
    sticky2: "每天 10 分鐘，就在 NeuralFin App",
    anon: "匿名",
    bench: "對比公開螢幕時間統計",
    mostShorted: "最重倉：",
    wkwks: "個工作週",
    vsmkt: "對比市場平均",
    youAt: (hours: string) => `你 · ${hours}小時`,
    // DRAFT — native review required
    scrollChip: (scroll: string, total: string) => `${total}中有${scroll}是滑屏`,
    fun: (yr: number) => {
      if (yr < 500) return { title: "看完全部《星球大戰》", sub: "...連前傳都看了。", num: `×${Math.round(yr / 25)}` };
      if (yr < 1200) return { title: "完整看完《鐵達尼號》", sub: "船每次都沉。", num: `×${Math.round(yr / 3.23)}` };
      return { title: "香港飛紐約", sub: "里數一分都沒有。", num: `×${Math.round(yr / 16)}` };
    },
  },
  // DRAFT — native review required (every zh-Hans string below, converted
  // from zh-Hant with mainland/SG vocabulary adjustments)
  "zh-Hans": {
    pill: "为滑屏世代而生",
    h1a: "你的滑屏也有",
    sub: "拖到你的每日屏幕时间。看看亏了多少、排第几名、发卡挑战朋友，再到 App 把它翻绿。",
    steps: ["上传", "看看亏损", "发出去"],
    slider: "你的每日屏幕时间",
    sliderSub: "计算你的滑屏：社交、视频、游戏",
    hday: "小时／天",
    scales: ["30分钟", "圣人", "6小时", "认证滑屏员", "12小时"],
    regions: { ww: "全球", hk: "香港", sg: "新加坡", th: "泰国" },
    scrollpos: "滑屏持仓",
    openloss: "浮亏",
    verified: "已验证",
    hrsyr: "每年小时数",
    pace: "照这个节奏",
    learnpos: "学习持仓",
    compounding: "复利中",
    feedcould: "你的 feed 本来可以教你的",
    lessonYield: (hours: string, lessons: number, phrase: string, track: string) =>
      `你每天 ${hours} 小时 = ${lessons} 节微课藏在滑屏里。你可在${phrase}完成${track}。`,
    lessonZero: "第零课，免费：",
    hyr: "小时／年",
    ladder: [
      ["第1周", "ETF 到底是什么", "以及为什么人人都在聊"],
      ["第1个月", "看懂资产负债表不再冒汗", "知道数字藏在哪里"],
      ["第6个月", "建立你第一个自选股观点", "自己的判断，不是群里的荐股贴"],
    ],
    milestone: (date: string) => [
      date + "前",
      "≈ 一门大学投资入门课",
      "全由你的 feed 赞助",
    ],
    dropTitle: "上传你的屏幕使用时间截图",
    dropSub: "只在你的设备上读取 · 永不上传",
    dropHint: "iPhone：设置 → 屏幕使用时间 · Android：数字健康",
    dropReceived: "✓ 已收到截图",
    dropRead: (duration: string) => `✓ 已读取：${duration}`,
    dropReadScrollDay: (scroll: string, total: string) => `${scroll}滑屏 / ${total}今日总时长`,
    dropReadScrollWeek: (scroll: string, total: string) => `${scroll}滑屏 / ${total}本周总时长`,
    dropReadScroll: (scroll: string) => `${scroll}滑屏时间`,
    dropCouldnt: "读不到这张截图",
    dropReplace: "换一张截图",
    dropDone: "我们读到 {hours} 小时／天——看起来对吗？",
    dropDay: (duration: string) => `这是今天的数字（${duration}）——已设置。要看真实平均值，请上传周视图。`,
    dropApps: "读不到你的时长——请在下面手动设置。",
    // DRAFT — native review required
    dropPartialChip: "\u2713 已找到你的 App 列表",
    // DRAFT — native review required
    dropAppsOnly: "找到你的 App 列表——但没有总时长。滑到屏幕使用时间最上方，截图日均。",
    // DRAFT — native review required (standard WeChat save pattern)
    longPressSave: "长按保存图片",
    // DRAFT — native review required
    overlayClose: "关闭",
    dropFail: "读不到你的时长——请在下面手动设置。",
    orManual: "或者手动拖一下",
    priv: "截图只在你的设备上读取，永不上传。App 名称除非你分享，否则保密。",
    stand: "市场排行榜",
    standsub: "按“翻转率”排名——哪个市场最会把滑屏变本事，谁就赢。",
    standnote: "目前为演示数据。正式版：由同一组匿名统计（仅时长＋市场）计算。上线初期平均值引用公开统计，社区数据足够后切换。",
    avgday: "平均／天",
    flipped: "已翻转",
    youare: "你的市场",
    tape: "实时行情",
    tapesub: "最新滑屏记录，逐笔入市。全部匿名。",
    tapenote: "目前为演示数据。正式版：上线初期以公开的屏幕时间统计（附来源）为基准；社区数据积累后切换为真实行情。只存储时长＋市场，绝无任何识别信息。",
    f1: "交易服务由德林证券（香港）有限公司提供，该公司为香港证监会持牌法团。",
    f2: "截图分析只在你的浏览器本地进行；图片与 App 名称不会上传或存储。社区统计为匿名（仅时长与市场）。",
    f3: "本页为市场推广示意，仅供教育与娱乐。不构成投资建议、预测或回报推算。",
    vbadge: "已验证滑屏",
    cardtitle: "我的滑屏损益 · 2026",
    cardflip: `每天翻转 ${FLIP_MINUTES_PER_DAY} 分钟 →`,
    challenge: "你亏得比我多吗？",
    scan: "扫你的 ↓",
    savebtn: "下载图片 📸",
    sticky1: "真正翻转你的损益",
    sticky2: "每天 10 分钟，就在 NeuralFin App",
    anon: "匿名",
    bench: "对比公开屏幕时间统计",
    mostShorted: "最重仓：",
    wkwks: "个工作周",
    vsmkt: "对比市场平均",
    youAt: (hours: string) => `你 · ${hours}小时`,
    scrollChip: (scroll: string, total: string) => `${total}中有${scroll}是滑屏`,
    fun: (yr: number) => {
      if (yr < 500) return { title: "看完全部《星球大战》", sub: "...连前传都看了。", num: `×${Math.round(yr / 25)}` };
      if (yr < 1200) return { title: "完整看完《泰坦尼克号》", sub: "船每次都沉。", num: `×${Math.round(yr / 3.23)}` };
      return { title: "香港飞纽约", sub: "里程一分都没有。", num: `×${Math.round(yr / 16)}` };
    },
  },
  // DRAFT — native review required (every th string below; Thai-native
  // internet register, not literal EN translation — see VOICE.md)
  th: {
    pill: "สร้างมาเพื่อเจนไถฟีด",
    h1a: "การไถฟีดของคุณก็มี",
    sub: "ลากไปที่เวลาหน้าจอต่อวันของคุณ ดูความเสียหาย ดูอันดับ แชร์การ์ด แล้วไปพลิกให้เขียวในแอป",
    steps: ["อัปโหลด", "ดูความเสียหาย", "โพสต์เลย"],
    slider: "เวลาหน้าจอต่อวันของคุณ",
    sliderSub: "นับเฉพาะการไถ — โซเชียล วิดีโอ เกม",
    hday: "ชม. / วัน",
    scales: ["30 นาที", "นักบุญ", "6 ชม.", "นักเลื่อนตัวจริง", "12 ชม."],
    regions: { ww: "ทั่วโลก", hk: "ฮ่องกง", sg: "สิงคโปร์", th: "ไทย" },
    scrollpos: "สถานะไถฟีด",
    openloss: "ขาดทุนลอยตัว",
    verified: "ยืนยันแล้ว",
    hrsyr: "ชั่วโมงต่อปี",
    pace: "ตามจังหวะนี้",
    learnpos: "สถานะการเรียน",
    compounding: "กำลังทบต้น",
    feedcould: "สิ่งที่ฟีดของคุณสอนคุณได้",
    lessonYield: (hours: string, lessons: number, phrase: string, track: string) =>
      `วันละ ${hours} ชม. = ${lessons} บทเรียนสั้นซ่อนอยู่ในการไถของคุณ เรียนจบ${track}ได้${phrase}`,
    lessonZero: "บทเรียนที่ศูนย์ ฟรี:",
    hyr: "ชม./ปี",
    ladder: [
      ["สัปดาห์ 1", "ETF จริง ๆ แล้วคืออะไร", "และทำไมใคร ๆ ก็พูดถึงมันไม่หยุด"],
      ["เดือน 1", "อ่านงบดุลได้แบบไม่เหงื่อตก", "รู้ว่าตัวเลขซ่อนอยู่ตรงไหน"],
      ["เดือน 6", "สร้างมุมมองหุ้นเฝ้าดูตัวแรกของคุณ", "ความเห็นของตัวเอง ไม่ใช่ทิปจากกลุ่มแชท"],
    ],
    milestone: (date: string) => [
      "ภายใน " + date,
      "≈ คอร์สปูพื้นการลงทุนระดับมหาวิทยาลัย",
      "สนับสนุนโดยฟีดของคุณล้วน ๆ",
    ],
    dropTitle: "อัปโหลดสกรีนช็อตเวลาหน้าจอของคุณ",
    dropSub: "อ่านบนเครื่องของคุณ · ไม่อัปโหลดเด็ดขาด",
    dropHint: "iPhone: การตั้งค่า → เวลาหน้าจอ · Android: Digital Wellbeing",
    dropReceived: "✓ ได้รับสกรีนช็อตแล้ว",
    dropRead: (duration: string) => `✓ อ่านได้: ${duration}`,
    dropReadScrollDay: (scroll: string, total: string) => `ไถไป ${scroll} จากทั้งวัน ${total}`,
    dropReadScrollWeek: (scroll: string, total: string) => `ไถไป ${scroll} จากทั้งสัปดาห์ ${total}`,
    dropReadScroll: (scroll: string) => `เวลาไถ ${scroll}`,
    dropCouldnt: "อ่านสกรีนช็อตนี้ไม่ได้",
    dropReplace: "ลองสกรีนช็อตอื่น",
    dropDone: "เราอ่านได้ {hours} ชม./วัน — ถูกไหม?",
    dropDay: (duration: string) => `นี่คือตัวเลขของวันนี้ (${duration}) — ตั้งให้แล้ว อยากได้ค่าเฉลี่ยจริง อัปโหลดมุมมองรายสัปดาห์`,
    dropApps: "อ่านชั่วโมงของคุณไม่ได้ — ตั้งเองด้านล่างได้เลย",
    // DRAFT — native review required
    dropPartialChip: "\u2713 เจอรายชื่อแอปแล้ว",
    // DRAFT — native review required
    dropAppsOnly: "เจอรายชื่อแอปแล้ว — แต่ไม่เจอเวลารวม เลื่อนขึ้นบนสุดของเวลาหน้าจอ แล้วแคปตรงค่าเฉลี่ยต่อวัน",
    // DRAFT — native review required
    longPressSave: "กดค้างที่รูปเพื่อบันทึก",
    // DRAFT — native review required
    overlayClose: "ปิด",
    dropFail: "อ่านชั่วโมงของคุณไม่ได้ — ตั้งเองด้านล่างได้เลย",
    orManual: "หรือลากเองก็ได้",
    priv: "สกรีนช็อตถูกอ่านบนเครื่องของคุณและไม่มีการอัปโหลด ชื่อแอปเป็นความลับ เว้นแต่คุณจะแชร์เอง",
    stand: "อันดับตลาด",
    standsub: "จัดอันดับด้วย % ที่พลิกได้ — ตลาดที่เปลี่ยนการไถเป็นสกิลได้ชนะ",
    standnote: "ข้อมูลตัวอย่าง เวอร์ชันเปิดตัว: คำนวณจากสถิตินิรนามชุดเดียวกัน (ชั่วโมง + ตลาดเท่านั้น) ช่วงก่อนเปิดตัวใช้ค่าเฉลี่ยจากสถิติสาธารณะจนกว่าข้อมูลชุมชนจะมากพอ",
    avgday: "เฉลี่ย / วัน",
    flipped: "พลิกแล้ว",
    youare: "ตลาดของคุณ",
    tape: "กระดานเทป",
    tapesub: "การไถล่าสุด ตีราคาตลาดสด ๆ นิรนามเสมอ",
    tapenote: "แสดงข้อมูลตัวอย่าง เวอร์ชันเปิดตัว: ก่อนเปิดตัวเทียบกับสถิติเวลาหน้าจอสาธารณะ (มีแหล่งอ้างอิง) เมื่อผลจริงสะสมพอจะสลับเป็นกระดานชุมชน เก็บเฉพาะชั่วโมง + ตลาด — ไม่มีข้อมูลระบุตัวตน",
    f1: "บริการซื้อขายให้บริการโดย DL Securities (Hong Kong) Limited ซึ่งเป็นบริษัทที่ได้รับใบอนุญาตและอยู่ภายใต้การกำกับดูแลของสำนักงาน ก.ล.ต. ฮ่องกง (SFC)",
    f2: "การวิเคราะห์สกรีนช็อตเกิดขึ้นในเบราว์เซอร์ของคุณเท่านั้น รูปภาพและชื่อแอปไม่ถูกอัปโหลดหรือจัดเก็บ สถิติชุมชนเป็นแบบนิรนาม (เฉพาะชั่วโมงและตลาด)",
    f3: "หน้านี้เป็นภาพประกอบทางการตลาดเพื่อการศึกษาและความบันเทิง ไม่ใช่คำแนะนำการลงทุน การคาดการณ์ หรือการประมาณผลตอบแทน",
    vbadge: "ไถฟีดยืนยันแล้ว",
    cardtitle: "P&L การไถของเรา · 2026",
    cardflip: `พลิกวันละ ${FLIP_MINUTES_PER_DAY} นาที →`,
    challenge: "คุณลบหนักกว่าเราไหม?",
    scan: "สแกนของคุณ ↓",
    savebtn: "ดาวน์โหลดรูป 📸",
    sticky1: "พลิก P&L ของคุณจริง ๆ",
    sticky2: "วันละ 10 นาทีในแอป NeuralFin",
    anon: "นิรนาม",
    bench: "เทียบสถิติเวลาหน้าจอสาธารณะ",
    mostShorted: "ช็อตหนักสุด:",
    wkwks: "สัปดาห์ทำงาน",
    vsmkt: "เทียบค่าเฉลี่ยตลาด",
    youAt: (hours: string) => `คุณ · ${hours} ชม.`,
    scrollChip: (scroll: string, total: string) => `${scroll} จาก ${total} คือการไถ`,
    fun: (yr: number) => {
      if (yr < 500) return { title: "ดูสตาร์ วอร์ส ครบทุกภาค", sub: "...รวมไตรภาคพรีเควลด้วย", num: `×${Math.round(yr / 25)}` };
      if (yr < 1200) return { title: "ดูไททานิคจบเต็ม ๆ หนึ่งรอบ", sub: "เรือจมทุกครั้ง", num: `×${Math.round(yr / 3.23)}` };
      return { title: "บินฮ่องกง → นิวยอร์ก", sub: "ไมล์สะสมไม่ได้สักแต้ม", num: `×${Math.round(yr / 16)}` };
    },
  },
} as const;

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function formatDurationFromHours(hours: number, lang: Lang) {
  const totalMinutes = Math.max(0, Math.round(hours * 60));
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (lang === "zh-Hant") {
    if (wholeHours === 0) return `${minutes}分鐘`;
    if (minutes === 0) return `${wholeHours}小時`;
    return `${wholeHours}小時 ${minutes}分鐘`;
  }

  if (lang === "zh-Hans") {
    if (wholeHours === 0) return `${minutes}分钟`;
    if (minutes === 0) return `${wholeHours}小时`;
    return `${wholeHours}小时 ${minutes}分钟`;
  }

  if (lang === "th") {
    if (wholeHours === 0) return `${minutes} นาที`;
    if (minutes === 0) return `${wholeHours} ชม.`;
    return `${wholeHours} ชม. ${minutes} นาที`;
  }

  if (wholeHours === 0) return `${minutes}m`;
  if (minutes === 0) return `${wholeHours}h`;
  return `${wholeHours}h ${minutes}m`;
}

function roundSliderHours(hours: number) {
  return Math.round(hours * 10) / 10;
}

function appLink(base: string, hours: number, region: ScrollRegion, verified: boolean, lang: Lang) {
  const url = new URL(base);
  for (const [key, value] of Object.entries(SCROLL_CAMPAIGN_UTM)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set(SCROLL_DEEP_LINK_PARAMS.hours, String(hours));
  url.searchParams.set(SCROLL_DEEP_LINK_PARAMS.region, region);
  url.searchParams.set(SCROLL_DEEP_LINK_PARAMS.verified, verified ? "1" : "0");
  url.searchParams.set(SCROLL_DEEP_LINK_PARAMS.lang, lang);
  return url.toString();
}

// Aggregate-only: enum fields, nothing else — no image data, no OCR text,
// no app names. Tells us which OEM layouts need fixtures post-launch and
// which degradation paths fire in the wild. Fire-and-forget: telemetry
// failure can never fail a parse.
function sendParseTelemetry(layout: ScreenTimeLayout, outcome: ParseOutcome, events: readonly ParseFlag[] = []) {
  const env: WebviewEnv = detectWebviewEnv(navigator.userAgent);
  void fetch("/api/scroll-telemetry", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ layout, outcome, env, ...(events.length ? { events } : {}) }),
    keepalive: true,
  }).catch(() => undefined);
}

async function parseScreenshot(file: File) {
  const { text, confidence, restrictedPassFailed } = await recognizeScreenTime(file);
  const parsed = parseScreenTimeText(text, confidence);
  return restrictedPassFailed ? { ...parsed, flags: [...parsed.flags, "restricted_pass_failed" as const] } : parsed;
}

// restricted_pass_failed alone doesn't demote a read — the fallback path may
// still parse cleanly — but every other flag makes it unverified.
function hasBlockingFlags(parsed: { flags: readonly string[] }) {
  return parsed.flags.some((flag) => flag !== "restricted_pass_failed");
}

export function ScrollCalculator() {
  const [hours, setHours] = useState(3.5);
  const [lang, setLang] = useState<Lang>("en");
  const [region, setRegion] = useState<ScrollRegion>("ww");
  const [verified, setVerified] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanStage, setScanStage] = useState<ScanStage>("reading");
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [uploadReadDuration, setUploadReadDuration] = useState<string | null>(null);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);
  const [parsedHours, setParsedHours] = useState<number | null>(null);
  const [parsedScrollStat, setParsedScrollStat] = useState<ParsedScrollStat | null>(null);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const [appRoasts, setAppRoasts] = useState<AppRoast[]>([]);
  const [tapeRows, setTapeRows] = useState<TapeRow[]>(demoTape);
  const [saveOverlayUrl, setSaveOverlayUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const hoursBlockRef = useRef<HTMLDivElement>(null);
  const hoursSliderRef = useRef<HTMLInputElement>(null);
  const uploadPreviewRef = useRef<string | null>(null);
  const autoFlipStartedRef = useRef(false);
  const autoFlipTimerRef = useRef<number | null>(null);
  const saveOverlayRef = useRef<string | null>(null);

  const t = str[lang];
  const regionName = t.regions[region];
  const yearly = Math.round(hours * HRS_YR);
  const percentile = normalPercentile(hours);
  const fun = t.fun(yearly);
  const marketAverage = SCROLL_STANDINGS.find((item) => item.region === region)?.averageHours ?? 4.4;
  const diff = Math.round(((hours - marketAverage) / marketAverage) * 100);
  const workWeeks = Math.round(yearly / 40);
  const archetype = getArchetypeCopy(hours, lang);
  const arch = archetype.title;
  const archSubtitle = archetype.subtitle;
  const rankFrame = getRankFrame(percentile, regionName, lang);
  const rankLine = rankFrame.title;
  const maxBar = Math.max(hours, marketAverage) * 1.15;
  const appStoreHref = appLink(appLinks.appStore, hours, region, verified, lang);
  const playStoreHref = appLink(appLinks.googlePlay, hours, region, verified, lang);
  const rangeFill = ((hours - 0.5) / 11.5) * 100;
  const hasAppRoasts = appRoasts.length > 0;
  const appRoastText = appRoasts.map((app) => `${app.name} -${app.minutes}m`).join(" · ");
  const scrollCardStat = parsedScrollStat
    ? t.scrollChip(formatDurationFromHours(parsedScrollStat.scrollHours, lang), formatDurationFromHours(parsedScrollStat.totalHours, lang))
    : null;
  const education = getEducationOutput(hours, lang);
  const ladderRows = [...t.ladder, t.milestone(education.milestoneLabel)];
  const dropTitleText = scanning
    ? getScanStageMessage(lang, scanStage)
    : t.dropTitle;
  const dropStateText = scanning
    ? t.dropReceived
    : uploadStatus === "read" && uploadReadDuration
      ? t.dropRead(uploadReadDuration)
      : uploadStatus === "partial"
        ? t.dropPartialChip
        : uploadStatus === "failed"
          ? t.dropCouldnt
          : t.dropTitle;

  const sortedStandings = useMemo(
    () => [...SCROLL_STANDINGS].sort((a, b) => b.flippedPercent - a.flippedPercent),
    [],
  );

  useEffect(() => {
    const locale = navigator.language.toLowerCase();
    let detectedRegion: ScrollRegion = "ww";
    if (locale.includes("hk")) detectedRegion = "hk";
    else if (locale.includes("sg")) detectedRegion = "sg";
    else if (locale.includes("th")) detectedRegion = "th";
    setRegion(detectedRegion);

    // Precedence: URL param → stored manual choice → browser/region default.
    const requestedLang = normalizeScrollLocale(new URLSearchParams(window.location.search).get("lang"));
    const storedLang = normalizeScrollLocale(window.localStorage.getItem("scroll-calc-lang"));
    const browserLanguages = navigator.languages?.length ? navigator.languages : [navigator.language];
    setLang(requestedLang ?? storedLang ?? detectScrollLocale(browserLanguages, detectedRegion));
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    window.localStorage.setItem("scroll-calc-lang", lang);
  }, [lang]);

  useEffect(() => {
    fetch("/api/scroll-results/summary")
      .then((response) => (response.ok ? response.json() : null))
      .then((summary: { recent?: Array<{ hours: number; region: ScrollRegion }> } | null) => {
        if (!summary?.recent?.length) return;
        setTapeRows(summary.recent.map((item) => ({ hours: item.hours, region: item.region })));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    return () => {
      if (autoFlipTimerRef.current !== null) {
        window.clearTimeout(autoFlipTimerRef.current);
      }
      if (uploadPreviewRef.current !== null) {
        URL.revokeObjectURL(uploadPreviewRef.current);
      }
      if (saveOverlayRef.current !== null) {
        URL.revokeObjectURL(saveOverlayRef.current);
      }
    };
  }, []);

  function replaceUploadPreview(file: File) {
    if (uploadPreviewRef.current !== null) {
      URL.revokeObjectURL(uploadPreviewRef.current);
    }
    const nextUrl = URL.createObjectURL(file);
    uploadPreviewRef.current = nextUrl;
    setUploadPreviewUrl(nextUrl);
  }

  async function submitResult() {
    await fetch("/api/scroll-results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hours, region }),
    }).catch(() => undefined);
  }

  function landOnHoursControl() {
    window.requestAnimationFrame(() => {
      hoursBlockRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      window.requestAnimationFrame(() => {
        hoursSliderRef.current?.focus({ preventScroll: true });
      });
    });
  }

  function scheduleAutoFlip() {
    if (autoFlipStartedRef.current) return;
    autoFlipStartedRef.current = true;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const delay = prefersReducedMotion ? 0 : 800;
    autoFlipTimerRef.current = window.setTimeout(() => {
      setFlipped(true);
      autoFlipTimerRef.current = null;
    }, delay);
  }

  async function handleScan(file?: File) {
    if (!file || scanning) return;
    replaceUploadPreview(file);
    setUploadStatus("received");
    setUploadReadDuration(null);
    setParsedScrollStat(null);
    setScanning(true);
    setScanStage("reading");
    setScanNotice(null);
    const auditTimer = window.setTimeout(() => setScanStage("auditing"), 450);
    try {
      const parsed = await parseScreenshot(file);
      window.clearTimeout(auditTimer);
      sendParseTelemetry(parsed.layout, classifyParseOutcome(parsed), parsed.flags);
      setAppRoasts(parsed.apps);
      if (parsed.hours && parsed.source !== "day-total" && !hasBlockingFlags(parsed)) {
        setScanStage("success");
        await wait(350);
        const rounded = roundSliderHours(parsed.hours);
        const duration = formatDurationFromHours(parsed.hours, lang);
        const ratioText = parsed.ratioScope === "week" ? t.dropReadScrollWeek : t.dropReadScrollDay;
        const scrollReadText = parsed.scrollHours && parsed.totalHours
          ? ratioText(formatDurationFromHours(parsed.scrollHours, lang), formatDurationFromHours(parsed.totalHours, lang))
          : parsed.scrollHours
            ? t.dropReadScroll(formatDurationFromHours(parsed.scrollHours, lang))
            : duration;
        setHours(rounded);
        setParsedHours(rounded);
        setParsedScrollStat(parsed.scrollHours && parsed.totalHours ? { scrollHours: parsed.scrollHours, totalHours: parsed.totalHours } : null);
        setVerified(true);
        setUploadStatus("read");
        setUploadReadDuration(scrollReadText);
        setScanNotice(t.dropDone.replace("{hours}", rounded.toFixed(1)));
        scheduleAutoFlip();
      } else if (parsed.hours) {
        // Day-scoped totals and any flagged (degraded) read land here:
        // slider set, but never the verified badge.
        setScanStage("fail");
        await wait(500);
        const rounded = roundSliderHours(parsed.hours);
        const duration = formatDurationFromHours(parsed.hours, lang);
        const ratioText = parsed.ratioScope === "week" ? t.dropReadScrollWeek : t.dropReadScrollDay;
        const scrollReadText = parsed.scrollHours && parsed.totalHours
          ? ratioText(formatDurationFromHours(parsed.scrollHours, lang), formatDurationFromHours(parsed.totalHours, lang))
          : parsed.scrollHours
            ? t.dropReadScroll(formatDurationFromHours(parsed.scrollHours, lang))
            : duration;
        setHours(rounded);
        setParsedHours(null);
        setParsedScrollStat(parsed.scrollHours && parsed.totalHours ? { scrollHours: parsed.scrollHours, totalHours: parsed.totalHours } : null);
        setVerified(false);
        setUploadStatus("read");
        setUploadReadDuration(scrollReadText);
        setScanNotice(t.dropDay(duration));
        scheduleAutoFlip();
      } else if (parsed.apps.length > 0) {
        // Partial parse: catalog-gated roasts may show (setAppRoasts above),
        // the slider stays manual, no badge — but the guidance is specific.
        setScanStage("fail");
        await wait(500);
        setParsedHours(null);
        setParsedScrollStat(null);
        setVerified(false);
        setUploadStatus("partial");
        setScanNotice(t.dropAppsOnly);
      } else {
        setScanStage("fail");
        await wait(500);
        setParsedHours(null);
        setParsedScrollStat(null);
        setVerified(false);
        setUploadStatus("failed");
        setScanNotice(t.dropFail);
      }
    } catch {
      window.clearTimeout(auditTimer);
      sendParseTelemetry("unknown", "failed");
      setScanStage("fail");
      await wait(500);
      setParsedHours(null);
      setParsedScrollStat(null);
      setVerified(false);
      setUploadStatus("failed");
      setScanNotice(t.dropFail);
    } finally {
      setScanning(false);
      landOnHoursControl();
    }
  }

  function handleDropKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      fileRef.current?.click();
    }
  }

  function closeSaveOverlay() {
    if (saveOverlayRef.current !== null) {
      URL.revokeObjectURL(saveOverlayRef.current);
      saveOverlayRef.current = null;
    }
    setSaveOverlayUrl(null);
  }

  async function saveCard() {
    const node = cardRef.current;
    if (!node) return;
    // Export the real DOM card node — parity with what the user sees is
    // true by construction. ~1080px wide at 320px card width.
    const { toBlob } = await import("html-to-image");
    // style.margin override: the clone otherwise inherits the computed
    // "margin: 0 auto" centering as a concrete left margin and renders the
    // card offset out of its own canvas.
    const blob = await toBlob(node, {
      pixelRatio: 1080 / node.offsetWidth,
      cacheBust: true,
      style: { margin: "0" },
    }).catch(() => null);
    if (!blob) return;
    const text = getShareCaptionVariant(lang, `-${fmt.format(yearly)}h`, rankLine);
    // In-app browsers (WeChat, LINE, IG/FB) don't reliably support blob
    // downloads or file share. The universal in-place pattern: show the
    // rendered PNG full-screen and let the user long-press to save.
    if (detectWebviewEnv(navigator.userAgent) !== "none") {
      if (saveOverlayRef.current !== null) URL.revokeObjectURL(saveOverlayRef.current);
      const overlayUrl = URL.createObjectURL(blob);
      saveOverlayRef.current = overlayUrl;
      setSaveOverlayUrl(overlayUrl);
      return;
    }
    const image = new File([blob], "my-scroll-pnl.png", { type: "image/png" });
    const shareData = { files: [image], title: "My Scroll P&L", text };
    if (navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = "my-scroll-pnl.png";
    a.click();
    URL.revokeObjectURL(href);
    await navigator.clipboard?.writeText(text).catch(() => undefined);
  }

  return (
    <div className="scroll-campaign">
      <div className="scroll-wrap">
        <header className="scroll-header">
          <a className="scroll-logo" href={PUBLIC_HOME_URL} aria-label="NeuralFin home">
            <img src="/assets/neuralfin-logo-transparent-cropped.png" alt="NeuralFin" />
          </a>
          <div className="scroll-header-right">
            <div className="scroll-pill">{t.pill}</div>
            <div className="scroll-lang" role="group" aria-label="Language">
              <button className={lang === "en" ? "on" : ""} onClick={() => setLang("en")} type="button">EN</button>
              <button className={lang === "zh-Hant" ? "on" : ""} onClick={() => setLang("zh-Hant")} type="button" aria-label="繁體中文">繁</button>
              <button className={lang === "zh-Hans" ? "on" : ""} onClick={() => setLang("zh-Hans")} type="button" aria-label="简体中文">简</button>
              <button className={lang === "th" ? "on" : ""} onClick={() => setLang("th")} type="button" aria-label="ภาษาไทย">ไทย</button>
            </div>
          </div>
        </header>

        <div className="scroll-topgrid">
          <section className="scroll-hero scroll-rise">
            <h1><span>{t.h1a}</span> <span className={flipped ? "gain-t" : "loss-t"}>P&amp;L.</span></h1>
            <p>{t.sub}</p>
            <div className="scroll-stepstrip" aria-label="Scroll calculator steps">
              {t.steps.map((step, index) => (
                <span key={step}>
                  {index > 0 ? <i aria-hidden="true">→</i> : null}
                  {step}
                </span>
              ))}
            </div>
          </section>

          <section className="scroll-calc scroll-rise d1" aria-label="Scroll calculator">
            <button
              className={`scroll-drop${scanning ? " scanning" : ""}`}
              type="button"
              onClick={() => fileRef.current?.click()}
              onKeyDown={handleDropKey}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                void handleScan(event.dataTransfer.files[0]);
              }}
            >
              {uploadPreviewUrl ? (
                <span className="scroll-thumb" aria-hidden="true">
                  <img src={uploadPreviewUrl} alt="" />
                </span>
              ) : (
                <span className="di">📱</span>
              )}
              <b>{dropTitleText}</b>
              {uploadStatus !== "idle" ? (
                <span className={`scroll-upload-state ${uploadStatus === "failed" ? "bad" : "ok"}`}>{dropStateText}</span>
              ) : null}
              <span className="dsub">{t.dropSub}</span>
              <span className="dhint">{uploadStatus === "idle" ? t.dropHint : t.dropReplace}</span>
              <span className="beam" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                void handleScan(event.target.files?.[0]);
                event.target.value = "";
              }}
            />

            <div className="scroll-hours-block" ref={hoursBlockRef}>
              {scanNotice ? (
                <p
                  id="scroll-scan-notice"
                  className={`scroll-scan-notice${verified ? " ok" : ""}`}
                  role="status"
                  aria-live="polite"
                >
                  {scanNotice}
                </p>
              ) : null}
              <div className="scroll-orsep"><span>{t.orManual}</span></div>
              <div className="scroll-row-label">
                <label htmlFor="hours">{t.slider}<span>{t.sliderSub}</span></label>
                <div className="scroll-val mono"><span>{hours.toFixed(1)}</span> {t.hday}</div>
              </div>
              <input
                ref={hoursSliderRef}
                id="hours"
                className="scroll-range"
                type="range"
                min="0.5"
                max="12"
                step="0.1"
                value={hours}
                aria-describedby={scanNotice ? "scroll-scan-notice" : undefined}
                style={{ "--fill": `${rangeFill}%` } as CSSProperties}
                onChange={(event) => {
                  scheduleAutoFlip();
                  const nextHours = Number(event.target.value);
                  const keepVerified = parsedHours !== null && Math.abs(nextHours - parsedHours) <= 0.5;
                  setHours(nextHours);
                  setParsedScrollStat(null);
                  setVerified(keepVerified);
                }}
              />
              <div className="scroll-scale">{t.scales.map((label) => <span key={label}>{label}</span>)}</div>
            </div>

            <div className="scroll-regions" role="group" aria-label="Compare against">
              {regionOrder.map((key) => (
                <button className={region === key ? "on" : ""} key={key} type="button" onClick={() => setRegion(key)}>
                  {key === "ww" ? "🌏 " : ""}{t.regions[key]}
                </button>
              ))}
            </div>

            <div className="scroll-pos loss">
              <div className="name"><b>{t.scrollpos} <span className="tag l">{t.openloss}</span>{verified ? <span className="tag v">✓ {t.verified}</span> : null}</b><span>{t.hrsyr} · {t.pace}</span></div>
              <div className="num mono">-{fmt.format(yearly)} h</div>
            </div>
            <div className="scroll-pos rank">
              <div className="name"><b>{rankLine}</b><span>{rankFrame.subtitle} · {t.bench}</span></div>
              <div className="num mono">{rankFrame.displayPercent}</div>
            </div>
            <div className="scroll-pos loss">
              <div className="name"><b>{fun.title}</b><span>{fun.sub}</span></div>
              <div className="num mono">{fun.num}</div>
            </div>
            {hasAppRoasts ? (
              <div className="scroll-pos app-roast">
                <div className="name"><b>{t.mostShorted}</b><span>{appRoastText}</span></div>
              </div>
            ) : null}

            {flipped ? (
              <div className="scroll-flip-reveal">
                <div className="scroll-lesson-yield">
                  {t.lessonYield(hours.toFixed(1), education.lessonsPerDay, education.finishPhrase, getTrackName("foundations", lang))}
                </div>
                <div className="scroll-pos gain">
                  <div className="name"><b>{t.learnpos} <span className="tag g">{t.compounding}</span></b><span>{t.feedcould}</span></div>
                  <div className="num mono">+61 {t.hyr}</div>
                </div>
                {ladderRows.map(([when, title, sub], index) => (
                  <div className="scroll-rung" key={when} style={{ "--stagger": `${index * 90}ms` } as CSSProperties}>
                    <div className="when mono">{when}</div>
                    <div>
                      <span>{title}{index < LADDER_TRACKS.length ? <i>{getTrackName(LADDER_TRACKS[index], lang)}</i> : null}</span>
                      <span>{sub}</span>
                    </div>
                  </div>
                ))}
                <div className="scroll-lesson-zero">
                  <b>{t.lessonZero}</b>
                  <span>{education.microTakeaway}</span>
                </div>
              </div>
            ) : null}

            <section className="scroll-inline-card" aria-label="Your Scroll P&L card">
              <div className={`scroll-card${verified ? " verified" : ""}`} ref={cardRef}>
                <div className="glow r" /><div className="glow g" />
                {verified ? <div className="vbadge">✓ {t.vbadge}</div> : null}
                <div className="cb">{t.cardtitle}</div>
                <div className="big mono">-{fmt.format(yearly)}h</div>
                <div className="pace">{t.pace}</div>
                <div className="rankline">{rankLine} <span className="rk-emoji">{percentile < 50 ? "" : Math.max(1, 100 - percentile) <= 25 ? "💀" : "📉"}</span></div>
                <div><span className="arch">{arch}</span></div>
                <div className="arch-subtitle">{archSubtitle}</div>
                <div className="roast">{fun.title} {fun.num}. <i>{fun.sub}</i></div>
                {hasAppRoasts ? <div className="roast">{t.mostShorted} <b>{appRoastText}</b></div> : null}
                <div className="chips">
                  <span className="chip"><b>-{workWeeks}</b> {t.wkwks}</span>
                  <span className="chip"><b>{diff >= 0 ? "+" : ""}{diff}%</b> {t.vsmkt}</span>
                  {scrollCardStat ? <span className="chip"><b>{scrollCardStat}</b></span> : null}
                </div>
                <div className="vsbar">
                  <div className="vlabel"><span>{t.youAt(hours.toFixed(1))}</span><span>{t.regions[region]} avg · {marketAverage.toFixed(1)}h</span></div>
                  <div className="track you"><i style={{ width: `${Math.round((hours / maxBar) * 100)}%` }} /></div>
                  <div className="track mkt"><i style={{ width: `${Math.round((marketAverage / maxBar) * 100)}%` }} /></div>
                </div>
                <div className="div" />
                <div className="flipline"><span>{t.cardflip}</span><b>{education.cardLine}</b></div>
                <div className="challenge">{t.challenge}<br />{t.scan}</div>
                <div className="brand"><b><img src="/icon.png" alt="" />{PUBLIC_SCROLL_LABEL}</b><span>#ScrollAudit</span></div>
              </div>
              <button className="scroll-download" type="button" onClick={() => { void submitResult(); void saveCard(); }}>
                {t.savebtn}
              </button>
              <div className="scroll-stores inline-stores">
                <a className="scroll-store-button" href={appStoreHref} aria-label="Download on the App Store"><img src="/assets/app-store.svg" alt="Download on the App Store" /></a>
                <a className="scroll-store-button" href={playStoreHref} aria-label="Get it on Google Play"><img src="/assets/google-play.svg" alt="Get it on Google Play" /></a>
              </div>
            </section>
            <p className="scroll-privnote">🔒 {t.priv}</p>
          </section>
        </div>

        <div className="scroll-botgrid">
          <section className="scroll-standings scroll-rise d2">
            <h2>{t.stand} 🏆</h2>
            <p className="ssub">{t.standsub}</p>
            {sortedStandings.map((item, index) => (
              <div className={`srow${index === 0 ? " leader" : ""}${item.region === region ? " you" : ""}`} key={item.region}>
                <div className="medal">{["🥇", "🥈", "🥉", "—"][index]}</div>
                <div className="mkt"><b>{item.region === "ww" ? "🌏 " : ""}{t.regions[item.region]}</b>{item.region === region ? <span>{t.youare}</span> : null}</div>
                <div className="avg mono">{item.averageHours.toFixed(1)}h<span>{t.avgday}</span></div>
                <div className="flippct mono">{item.flippedPercent}%<span>{t.flipped}</span></div>
              </div>
            ))}
            <p className="note">{t.standnote}</p>
          </section>

          <section className="scroll-tape scroll-rise d3">
            <h2>{t.tape} 📟</h2>
            <p className="tsub">{t.tapesub}</p>
            {tapeRows.map((row, index) => {
              const rowYear = Math.round(row.hours * HRS_YR);
              const rowP = normalPercentile(row.hours);
              const rowTop = Math.max(1, 100 - rowP);
              return (
                <div className={`trow${row.flipped ? " flipped" : ""}`} key={`${row.region}-${row.hours}-${index}`}>
                  <span className="who"><b>{t.anon} · {t.regions[row.region]}</b> · {getTapeNote(lang, Boolean(row.flipped), index)}</span>
                  <span><span className="tnum mono">{row.flipped ? "+10m" : `-${fmt.format(rowYear)}h`}</span><span className="pct mono">Top {rowTop}%</span></span>
                </div>
              );
            })}
            <p className="note">{t.tapenote}</p>
          </section>
        </div>

        <footer className="scroll-footer">
          <b>NeuralFin Technologies</b> · <span>{t.f1}</span> <span>{t.f2}</span> <span>{t.f3}</span>
        </footer>
      </div>

      {saveOverlayUrl ? (
        <div className="scroll-save-overlay" role="dialog" aria-modal="true" aria-label={t.longPressSave}>
          <img src={saveOverlayUrl} alt="My Scroll P&L" />
          <p>{t.longPressSave}</p>
          <button type="button" onClick={closeSaveOverlay}>{t.overlayClose}</button>
        </div>
      ) : null}

      <div className="scroll-sticky">
        <div className="in">
          <div className="txt"><b>{t.sticky1}</b><span>{t.sticky2}</span></div>
          <div className="scroll-stores">
            <a className="scroll-store-button" href={appStoreHref} aria-label="Download on the App Store"><img src="/assets/app-store.svg" alt="Download on the App Store" /></a>
            <a className="scroll-store-button" href={playStoreHref} aria-label="Get it on Google Play"><img src="/assets/google-play.svg" alt="Get it on Google Play" /></a>
          </div>
        </div>
      </div>
    </div>
  );
}

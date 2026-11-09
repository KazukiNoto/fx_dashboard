const PAIRS = [
  { label: "USD/JPY", flag: "us", symbol: "FX_IDC:USDJPY" },
  { label: "EUR/JPY", flag: "eu", symbol: "FX_IDC:EURJPY" },
  { label: "GBP/JPY", flag: "gb", symbol: "FX_IDC:GBPJPY" },
  { label: "AUD/JPY", flag: "au", symbol: "FX_IDC:AUDJPY" },
];

const chartEl = document.getElementById("chart");
const navEl = document.getElementById("pairs");
const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

const STORAGE_KEY = "fx-dashboard:pair";

function savedLabel() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

// 優先順位: URLハッシュ > 前回の選択 > 既定(USD/JPY)
function currentPair() {
  const hash = decodeURIComponent(location.hash.slice(1));
  return (
    PAIRS.find((p) => p.label === hash) ??
    PAIRS.find((p) => p.label === savedLabel()) ??
    PAIRS[0]
  );
}

// MACD のパラメーター(短期・長期・シグナル)。TradingView の入力名は in_1=短期 / in_2=長期 / in_3=シグナル
const MACD = { fast: 8, slow: 21, signal: 5 };

const INTERVALS = [
  { value: "1", label: "1分足" },
  { value: "5", label: "5分足" },
  { value: "15", label: "15分足" },
  { value: "30", label: "30分足" },
  { value: "60", label: "1時間足" },
  { value: "240", label: "4時間足" },
  { value: "D", label: "日足" },
];

// 上下ペインの時間足(初期値: 上 1分足 / 下 30分足)。localStorage に保存してリロード後も保持する
const INTERVALS_KEY = "fx-dashboard:intervals";

function loadIntervals() {
  const fallback = ["1", "30"];
  try {
    const saved = JSON.parse(localStorage.getItem(INTERVALS_KEY));
    const valid =
      Array.isArray(saved) &&
      saved.length === 2 &&
      saved.every((v) => INTERVALS.some((i) => i.value === v));
    return valid ? saved : fallback;
  } catch {
    return fallback;
  }
}

const paneIntervals = loadIntervals();

function createPane(pair, index) {
  const interval = paneIntervals[index];
  const container = document.createElement("div");
  container.className = "tradingview-widget-container";
  const widget = document.createElement("div");
  widget.className = "tradingview-widget-container__widget";
  container.append(widget);

  const script = document.createElement("script");
  script.src =
    "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
  script.async = true;
  script.textContent = JSON.stringify({
    autosize: true,
    symbol: pair.symbol,
    interval,
    timezone: "Asia/Tokyo",
    theme: darkQuery.matches ? "dark" : "light",
    style: "8", // 平均足(1: ローソク足)
    locale: "ja",
    allow_symbol_change: false,
    hide_side_toolbar: true,
    hide_top_toolbar: true,
    hide_legend: true,
    hide_volume: true,
    studies: [
      {
        id: "STD;MACD",
        inputs: { in_1: MACD.fast, in_2: MACD.slow, in_3: MACD.signal },
      },
    ],
    support_host: "https://www.tradingview.com",
  });
  container.append(script);

  const select = document.createElement("select");
  select.className = "interval-select";
  select.setAttribute("aria-label", "時間足");
  for (const { value, label } of INTERVALS) {
    select.add(new Option(label, value, false, value === interval));
  }
  select.addEventListener("change", () => {
    paneIntervals[index] = select.value;
    try {
      localStorage.setItem(INTERVALS_KEY, JSON.stringify(paneIntervals));
    } catch {}
    container.replaceWith(createPane(pair, index));
  });
  container.append(select);
  return container;
}

// 指定ペアを上下2ペインで表示
function renderChart(pair) {
  chartEl.replaceChildren(createPane(pair, 0), createPane(pair, 1));
}

function renderNav(active) {
  navEl.replaceChildren(
    ...PAIRS.map((pair) => {
      const button = document.createElement("button");
      button.type = "button";
      const flag = document.createElement("img");
      flag.src = `flags/${pair.flag}.svg`;
      flag.alt = "";
      flag.className = "flag";
      button.append(flag, pair.label);
      button.title = `${pair.label}(キー ${PAIRS.indexOf(pair) + 1})`;
      button.setAttribute("aria-pressed", String(pair === active));
      button.addEventListener("click", () => {
        location.hash = encodeURIComponent(pair.label);
      });
      return button;
    })
  );
}

// マウスホイールの縦回転でも、ペアのボタン列を横スクロールできるようにする
navEl.addEventListener(
  "wheel",
  (e) => {
    if (e.deltaX !== 0 || navEl.scrollWidth <= navEl.clientWidth) return;
    e.preventDefault();
    navEl.scrollLeft += e.deltaY;
  },
  { passive: false }
);

function update() {
  const pair = currentPair();
  document.title = `${pair.label} | FX Dashboard`;
  try {
    localStorage.setItem(STORAGE_KEY, pair.label);
  } catch {}
  renderNav(pair);
  navEl
    .querySelector('[aria-pressed="true"]')
    ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  renderChart(pair);
}

// 数字キー 1〜4 で通貨ペアを切り替え
window.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const pair = PAIRS[Number(e.key) - 1];
  if (pair) location.hash = encodeURIComponent(pair.label);
});

window.addEventListener("hashchange", update);
darkQuery.addEventListener("change", update);
update();

// 相場時間の時計(日本時間の現在時刻と、東京・ロンドン・NY セッションの開閉)
// 各市場の現地時刻の平日 start〜end 時を「開いている」とみなす近似。現地時刻で判定するので夏時間にも追従する
const SESSIONS = [
  { label: "東京", tz: "Asia/Tokyo", start: 9, end: 18 },
  { label: "ロンドン", tz: "Europe/London", start: 8, end: 17 },
  { label: "NY", tz: "America/New_York", start: 8, end: 17 },
];

const sessionsEl = document.getElementById("sessions");
const clockEl = document.getElementById("clock");
const phaseEl = document.getElementById("session-phase");
const clockFormat = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const sessionBadges = SESSIONS.map((session) => {
  const badge = document.createElement("span");
  badge.className = "session";
  badge.textContent = session.label;
  badge.title = `${session.label} ${session.start}:00〜${session.end}:00(現地時間・平日)`;
  sessionsEl.append(badge);
  const format = new Intl.DateTimeFormat("en-US", {
    timeZone: session.tz,
    weekday: "short",
    hour: "numeric",
    hourCycle: "h23",
  });
  return { session, badge, format };
});

sessionsEl.append(clockEl); // 並び順: 時間帯の文言 → バッジ → 時計(一番右)

function isSessionOpen({ session, format }, now) {
  const parts = Object.fromEntries(
    format.formatToParts(now).map((p) => [p.type, p.value])
  );
  const weekday = parts.weekday !== "Sat" && parts.weekday !== "Sun";
  const hour = Number(parts.hour);
  return weekday && hour >= session.start && hour < session.end;
}

// いま開いているセッションから「今の時間帯」の文言を作る
const PHASE_NAMES = {
  東京: "東京時間",
  ロンドン: "ロンドン時間",
  NY: "NY時間",
};

// 次にどれかのセッションが開く時刻(15分刻みで探す。開場は毎時0分なので正確)
function nextOpening(now) {
  const STEP = 15 * 60 * 1000;
  const first = Math.ceil(now.getTime() / STEP) * STEP;
  for (let i = 0; i < 7 * 24 * 4; i++) {
    const at = new Date(first + i * STEP);
    const opened = sessionBadges
      .filter((item) => isSessionOpen(item, at))
      .map((item) => item.session.label);
    if (opened.length > 0) return { at, names: opened };
  }
  return null;
}

function formatRemaining(ms) {
  const minutes = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(minutes / 60);
  const m = String(minutes % 60).padStart(2, "0");
  return `${h}:${m}`;
}

let phaseMinute = null;
let phaseText = "";

function phaseLabel(now, openNames) {
  if (openNames.length === 1) return PHASE_NAMES[openNames[0]];
  if (openNames.length > 1) return `${openNames.join("・")} 重複`;
  const next = nextOpening(now);
  if (!next) return "クローズ";
  const ms = next.at - now;
  if (ms >= 24 * 60 * 60 * 1000) return "週末(クローズ)";
  return `閑散時間帯(${next.names[0]}オープンまで ${formatRemaining(ms)})`;
}

function tickClock() {
  const now = new Date();
  clockEl.textContent = clockFormat.format(now);
  clockEl.dateTime = now.toISOString();
  const openNames = [];
  for (const item of sessionBadges) {
    const open = isSessionOpen(item, now);
    item.badge.dataset.open = String(open);
    item.badge.setAttribute(
      "aria-label",
      `${item.session.label} ${open ? "オープン中" : "クローズ"}`
    );
    if (open) openNames.push(item.session.label);
  }
  // 文言は分が変わったときだけ作り直す(次の開場の探索を毎秒しないため)
  const minute = Math.floor(now.getTime() / 60000);
  if (minute !== phaseMinute) {
    phaseMinute = minute;
    phaseText = phaseLabel(now, openNames);
    phaseEl.textContent = phaseText;
  }
}

tickClock();
setInterval(tickClock, 1000);

// 画面スリープの防止(Screen Wake Lock API)。非対応のブラウザではボタンを出さない
const WAKE_KEY = "fx-dashboard:wake";
const wakeToggle = document.getElementById("wake-toggle");
let wakeLock = null;

function wakeWanted() {
  try {
    return localStorage.getItem(WAKE_KEY) === "1";
  } catch {
    return false;
  }
}

function setWakeWanted(on) {
  try {
    localStorage.setItem(WAKE_KEY, on ? "1" : "0");
  } catch {}
}

function renderWake() {
  const on = wakeWanted();
  wakeToggle.setAttribute("aria-pressed", String(on));
  wakeToggle.title = `画面を消さない(${on ? "オン" : "オフ"})`;
}

async function acquireWake() {
  if (!wakeWanted() || wakeLock || document.visibilityState !== "visible") return;
  try {
    wakeLock = await navigator.wakeLock.request("screen");
    wakeLock.addEventListener("release", () => {
      wakeLock = null;
    });
  } catch {
    // 省電力モードなどで取得できない場合は、オンのままにせずオフに戻す
    wakeLock = null;
    setWakeWanted(false);
    renderWake();
  }
}

if ("wakeLock" in navigator) {
  wakeToggle.hidden = false;
  wakeToggle.addEventListener("click", () => {
    const on = !wakeWanted();
    setWakeWanted(on);
    renderWake();
    if (on) acquireWake();
    else wakeLock?.release();
  });
  // タブを隠すとロックは自動で解除されるので、戻ってきたときに取り直す
  document.addEventListener("visibilitychange", acquireWake);
  renderWake();
  acquireWake();
}

// PWA: Service Worker を登録(インストール可能にする)
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

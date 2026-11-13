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

// 表示サイズ。4K テレビのように画素数の多い大画面では、そのままだと文字もチャートの目盛りも
// 小さすぎて離れた位置から読めない。TradingView のチャートは iframe の中にあり、文字の大きさを
// 外から変えられないので、画面全体を小さめに組んでから拡大して、チャートごと大きく見せる
const SCALE_KEY = "fx-dashboard:scale";
const SCALES = [1, 1.25, 1.5, 1.75, 2, 2.5, 3];
const scaleSelect = document.getElementById("scale-select");

// 自動: フルHD(1920×1080)相当の見た目になる倍率。4K なら 200%。
// 普通のパソコンの画面を勝手に拡大しないよう、150% 以上になる大画面だけに効かせる
function autoScale() {
  const fit = Math.min(innerWidth / 1920, innerHeight / 1080);
  return fit >= 1.5 ? Math.min(Math.floor(fit * 4) / 4, 4) : 1;
}

function savedScale() {
  try {
    const saved = Number(localStorage.getItem(SCALE_KEY));
    return SCALES.includes(saved) ? saved : null;
  } catch {
    return null;
  }
}

const percent = (scale) => `${Math.round(scale * 100)}%`;

function applyScale() {
  const auto = autoScale();
  const saved = savedScale();
  // 拡大しすぎてレイアウトが崩れないよう、拡大後の画面が 960×540 相当を下回らない範囲に抑える
  const limit = Math.max(1, Math.min(innerWidth / 960, innerHeight / 540));
  const scale = Math.min(saved ?? auto, limit);
  const root = document.documentElement;
  root.style.setProperty("--ui-scale", scale);
  root.toggleAttribute("data-scaled", scale !== 1);
  scaleSelect.options[0].text = `自動(${percent(auto)})`;
  scaleSelect.value = saved ?? "auto";
}

scaleSelect.add(new Option("", "auto"));
for (const scale of SCALES) scaleSelect.add(new Option(percent(scale), scale));
scaleSelect.addEventListener("change", () => {
  try {
    if (scaleSelect.value === "auto") localStorage.removeItem(SCALE_KEY);
    else localStorage.setItem(SCALE_KEY, scaleSelect.value);
  } catch {}
  applyScale();
});
window.addEventListener("resize", applyScale);
applyScale();

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

const LOAD_TIMEOUT_MS = 15000; // この時間内にチャートが出なければ読み込み失敗とみなす

const paneIntervals = loadIntervals();

// 読み込み失敗(スクリプトが取れない・一定時間たってもチャートが出ない)のときは、
// 空白のままにせず理由と再読み込みボタンを出す
function watchLoad(container, script, retry) {
  const showError = () => {
    if (container.querySelector(".pane-error")) return;
    const box = document.createElement("div");
    box.className = "pane-error";
    box.setAttribute("role", "alert");
    const text = document.createElement("p");
    text.textContent = navigator.onLine
      ? "チャートを読み込めませんでした"
      : "オフラインのためチャートを表示できません";
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "再読み込み";
    button.addEventListener("click", retry);
    box.append(text, button);
    container.append(box);
  };
  script.addEventListener("error", showError);
  setTimeout(() => {
    if (container.isConnected && !container.querySelector("iframe")) showError();
  }, LOAD_TIMEOUT_MS);
}

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

  watchLoad(container, script, () =>
    container.replaceWith(createPane(pair, index))
  );

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

// 通貨ペアの下に並べる小さなチャート(S&P500・日経平均・原油)。米国債の利回り・先物は、TradingView の埋め込みでは使えないため載せていない。ペアを切り替えても表示したままにする
const MARKETS = [
  { label: "S&P500", symbol: "FOREXCOM:SPXUSD" },
  { label: "日経平均", symbol: "OANDA:JP225USD" },
  { label: "WTI原油", symbol: "TVC:USOIL" },
];

const marketsEl = document.getElementById("markets");

function renderMarkets() {
  marketsEl.replaceChildren(
    ...MARKETS.map(({ label, symbol }) => {
      const container = document.createElement("div");
      container.className = "tradingview-widget-container market";
      container.setAttribute("aria-label", label);
      container.title = label;
      const widget = document.createElement("div");
      widget.className = "tradingview-widget-container__widget";
      container.append(widget);

      const script = document.createElement("script");
      // ミニチャート(数字が大きい)ではなく、グラフが主役の小さなチャートにする
      script.src =
        "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
      script.async = true;
      script.textContent = JSON.stringify({
        autosize: true,
        symbol,
        interval: "15",
        timezone: "Asia/Tokyo",
        theme: darkQuery.matches ? "dark" : "light",
        style: "3", // エリアチャート
        locale: "ja",
        allow_symbol_change: false,
        hide_side_toolbar: true,
        hide_top_toolbar: true,
        hide_volume: true,
        support_host: "https://www.tradingview.com",
      });
      container.append(script);
      watchLoad(container, script, renderMarkets);
      return container;
    })
  );
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
  if (e.target instanceof HTMLSelectElement) return; // セレクトの文字入力での選択を邪魔しない
  const pair = PAIRS[Number(e.key) - 1];
  if (pair) location.hash = encodeURIComponent(pair.label);
});

window.addEventListener("hashchange", update);
darkQuery.addEventListener("change", update);
darkQuery.addEventListener("change", renderMarkets);
update();
renderMarkets();

// 相場時間の時計(日本時間の現在時刻と、東京・ロンドン・NY セッションの開閉)
// 各市場の現地時刻の平日 start〜end 時を「開いている」とみなす近似。現地時刻で判定するので夏時間にも追従する
const SESSIONS = [
  { label: "東京", flag: "jp", tz: "Asia/Tokyo", start: 9, end: 18 },
  { label: "ロンドン", flag: "gb", tz: "Europe/London", start: 8, end: 17 },
  { label: "NY", flag: "us", tz: "America/New_York", start: 8, end: 17 },
];

const sessionsEl = document.getElementById("sessions");
const phaseEl = document.getElementById("session-phase");
// 各国の現地時刻(夏時間にも追従)。東京は日本時間と同じ
const localFormats = Object.fromEntries(
  SESSIONS.map((s) => [
    s.label,
    new Intl.DateTimeFormat("ja-JP", {
      timeZone: s.tz,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }),
  ])
);
// 各セッションを「国旗 + 現地時刻」のチップで常に表示し、オープン中はハイライトする
const sessionBadges = SESSIONS.map((session) => {
  const badge = document.createElement("span");
  badge.className = "session";
  badge.title = `${session.label} ${session.start}:00〜${session.end}:00(現地時間・平日)`;
  const flag = document.createElement("img");
  flag.src = `flags/${session.flag}.svg`;
  flag.alt = "";
  flag.className = "flag";
  const time = document.createElement("time");
  badge.append(flag, time);
  sessionsEl.append(badge);
  const format = new Intl.DateTimeFormat("en-US", {
    timeZone: session.tz,
    weekday: "short",
    hour: "numeric",
    hourCycle: "h23",
  });
  return { session, badge, time, format };
});

function isSessionOpen({ session, format }, now) {
  const parts = Object.fromEntries(
    format.formatToParts(now).map((p) => [p.type, p.value])
  );
  const weekday = parts.weekday !== "Sat" && parts.weekday !== "Sun";
  const hour = Number(parts.hour);
  return weekday && hour >= session.start && hour < session.end;
}

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

// 閉場中の文言
function closedLabel(now) {
  const next = nextOpening(now);
  if (!next) return "クローズ";
  const ms = next.at - now;
  if (ms >= 24 * 60 * 60 * 1000) return "週末(クローズ)";
  return `閑散時間帯(${next.names[0]}オープンまで ${formatRemaining(ms)})`;
}

// 閉場中だけ、次の開場までの文言を出す(オープン中はチップのハイライトで分かる)
function renderPhase(now, openNames) {
  phaseEl.textContent = openNames.length === 0 ? closedLabel(now) : "";
}

function tickClock() {
  const now = new Date();
  const openNames = [];
  for (const item of sessionBadges) {
    const open = isSessionOpen(item, now);
    const text = localFormats[item.session.label].format(now);
    item.time.textContent = text;
    item.time.dateTime = now.toISOString();
    item.badge.dataset.open = String(open);
    item.badge.setAttribute(
      "aria-label",
      `${item.session.label} 現地 ${text} ${open ? "オープン中" : "クローズ"}`
    );
    if (open) openNames.push(item.session.label);
  }
  // 文言は分が変わったときだけ作り直す(次の開場の探索を毎秒しないため)
  const minute = Math.floor(now.getTime() / 60000);
  if (minute !== phaseMinute) {
    phaseMinute = minute;
    renderPhase(now, openNames);
  }
}

tickClock();
setInterval(tickClock, 1000);

// 画面スリープの防止(Screen Wake Lock API)。非対応のブラウザではボタンを出さない
const WAKE_KEY = "fx-dashboard:wake";
const wakeToggle = document.getElementById("wake-toggle");
const wakeState = document.getElementById("wake-state");
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
  wakeState.textContent = on ? "オン" : "オフ";
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

// 右上のメニュー(バーガーボタン): 開閉と、アプリ更新(Service Worker とキャッシュを消して読み込み直す)
const menuToggle = document.getElementById("menu-toggle");
const menuEl = document.getElementById("menu");
const menuWrap = document.getElementById("menu-wrap");
const refreshButton = document.getElementById("refresh-app");

function setMenuOpen(open) {
  menuEl.hidden = !open;
  menuToggle.setAttribute("aria-expanded", String(open));
}

menuToggle.addEventListener("click", () => setMenuOpen(menuEl.hidden));
document.addEventListener("click", (e) => {
  if (!menuWrap.contains(e.target)) setMenuOpen(false);
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !menuEl.hidden) {
    setMenuOpen(false);
    menuToggle.focus();
  }
});

refreshButton.addEventListener("click", async () => {
  refreshButton.disabled = true;
  refreshButton.querySelector(".menu-label").textContent = "更新中…";
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations()) ?? [];
    await Promise.all(regs.map((r) => r.unregister()));
    const keys = (await window.caches?.keys()) ?? [];
    await Promise.all(keys.map((k) => caches.delete(k)));
  } catch {}
  location.reload();
});

// PWA: Service Worker を登録(インストール可能にする)
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

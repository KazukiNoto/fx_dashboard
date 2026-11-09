const PAIRS = [
  { label: "USD/JPY", flag: "🇺🇸", symbol: "FX_IDC:USDJPY" },
  { label: "EUR/JPY", flag: "🇪🇺", symbol: "FX_IDC:EURJPY" },
  { label: "GBP/JPY", flag: "🇬🇧", symbol: "FX_IDC:GBPJPY" },
  { label: "AUD/JPY", flag: "🇦🇺", symbol: "FX_IDC:AUDJPY" },
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

function mountWidget(parent, pair, interval) {
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
    studies: ["STD;MACD"],
    support_host: "https://www.tradingview.com",
  });
  container.append(script);
  parent.append(container);
}

// 指定ペアを上下2ペインで表示(上: 5分足 / 下: 30分足)
function renderChart(pair) {
  chartEl.replaceChildren();
  mountWidget(chartEl, pair, "5");
  mountWidget(chartEl, pair, "30");
}

function renderNav(active) {
  navEl.replaceChildren(
    ...PAIRS.map((pair) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `${pair.flag} ${pair.label}`;
      button.title = `${pair.label}(キー ${PAIRS.indexOf(pair) + 1})`;
      button.setAttribute("aria-pressed", String(pair === active));
      button.addEventListener("click", () => {
        location.hash = encodeURIComponent(pair.label);
      });
      return button;
    })
  );
}

function update() {
  const pair = currentPair();
  document.title = `${pair.label} | FX Dashboard`;
  try {
    localStorage.setItem(STORAGE_KEY, pair.label);
  } catch {}
  renderNav(pair);
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

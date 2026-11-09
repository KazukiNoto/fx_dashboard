const PAIRS = [
  { label: "USD/JPY", flag: "🇺🇸", symbol: "FX_IDC:USDJPY" },
  { label: "EUR/JPY", flag: "🇪🇺", symbol: "FX_IDC:EURJPY" },
  { label: "GBP/JPY", flag: "🇬🇧", symbol: "FX_IDC:GBPJPY" },
  { label: "AUD/JPY", flag: "🇦🇺", symbol: "FX_IDC:AUDJPY" },
];

const chartEl = document.getElementById("chart");
const navEl = document.getElementById("pairs");
const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

function currentPair() {
  const label = decodeURIComponent(location.hash.slice(1));
  return PAIRS.find((p) => p.label === label) ?? PAIRS[0];
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
    style: "1",
    locale: "ja",
    allow_symbol_change: false,
    hide_side_toolbar: true,
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
  renderNav(pair);
  renderChart(pair);
}

window.addEventListener("hashchange", update);
darkQuery.addEventListener("change", update);
update();

const PAIRS = [
  { label: "USD/JPY", symbol: "FX_IDC:USDJPY" },
  { label: "EUR/JPY", symbol: "FX_IDC:EURJPY" },
  { label: "GBP/JPY", symbol: "FX_IDC:GBPJPY" },
  { label: "AUD/JPY", symbol: "FX_IDC:AUDJPY" },
  { label: "EUR/USD", symbol: "FX_IDC:EURUSD" },
  { label: "GBP/USD", symbol: "FX_IDC:GBPUSD" },
  { label: "AUD/USD", symbol: "FX_IDC:AUDUSD" },
];

const chartEl = document.getElementById("chart");
const navEl = document.getElementById("pairs");
const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

function currentPair() {
  const label = decodeURIComponent(location.hash.slice(1));
  return PAIRS.find((p) => p.label === label) ?? PAIRS[0];
}

function renderChart(pair) {
  chartEl.replaceChildren();

  const widget = document.createElement("div");
  widget.className = "tradingview-widget-container__widget";
  chartEl.append(widget);

  const script = document.createElement("script");
  script.src =
    "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
  script.async = true;
  script.textContent = JSON.stringify({
    autosize: true,
    symbol: pair.symbol,
    interval: "60",
    timezone: "Asia/Tokyo",
    theme: darkQuery.matches ? "dark" : "light",
    style: "1",
    locale: "ja",
    allow_symbol_change: true,
    support_host: "https://www.tradingview.com",
  });
  chartEl.append(script);
}

function renderNav(active) {
  navEl.replaceChildren(
    ...PAIRS.map((pair) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = pair.label;
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

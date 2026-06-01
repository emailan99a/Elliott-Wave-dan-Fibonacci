const elements = {
  homeView: document.querySelector("#homeView"),
  detailView: document.querySelector("#detailView"),
  marketSelect: document.querySelector("#marketSelect"),
  assetList: document.querySelector("#assetList"),
  pagination: document.querySelector("#pagination"),
  homeStatus: document.querySelector("#homeStatus"),
  backButton: document.querySelector("#backButton"),
  tradingViewChart: document.querySelector("#tradingViewChart"),
  chartFallback: document.querySelector("#chartFallback"),
  analysisContent: document.querySelector("#analysisContent"),
  newsFilter: document.querySelector("#newsFilter"),
  newsSupport: document.querySelector("#newsSupport"),
  newsContent: document.querySelector("#newsContent")
};

const MARKET_LABELS = {
  crypto: "Crypto",
  us: "Saham Amerika",
  indonesia: "Saham Indonesia"
};

const state = {
  market: "crypto",
  page: 1,
  pageSize: 20,
  pages: 1,
  rows: [],
  selected: null,
  newsItems: [],
  newsFilter: "all",
  tradeSide: "",
  requestId: 0
};

const CORPORATE_ACTION_KEYWORDS = [
  "acquisition",
  "airdrop",
  "buyback",
  "corporate action",
  "delisting",
  "dividend",
  "dividen",
  "earnings",
  "etf",
  "fork",
  "governance",
  "listing",
  "mainnet",
  "merger",
  "rights issue",
  "stock split",
  "token unlock",
  "upgrade"
];

const POSITIVE_NEWS_KEYWORDS = [
  "approval",
  "approved",
  "beats",
  "breakthrough",
  "breaks above",
  "bullish",
  "buyback",
  "climbs",
  "dividend",
  "dividen",
  "earnings beat",
  "etf inflow",
  "expansion",
  "gains",
  "guidance raised",
  "higher",
  "jumps",
  "listing",
  "mainnet",
  "partnership",
  "profit rises",
  "rallies",
  "rally",
  "rebounds",
  "record revenue",
  "raises",
  "rises",
  "soars",
  "surges",
  "upgrade"
];

const NEGATIVE_NEWS_KEYWORDS = [
  "bankruptcy",
  "bearish",
  "breach",
  "crash",
  "crashes",
  "cut guidance",
  "delisting",
  "declines",
  "downgrade",
  "drops",
  "earnings miss",
  "etf outflow",
  "exploit",
  "falls",
  "fine",
  "guidance cut",
  "hack",
  "investigation",
  "lawsuit",
  "liquidation",
  "loss widens",
  "lower",
  "plunges",
  "recall",
  "regulatory probe",
  "sec sues",
  "sell-off",
  "selloff",
  "slides",
  "slumps",
  "token unlock"
];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatPrice(value, currency = "USD") {
  if (!Number.isFinite(Number(value))) return "-";
  const numeric = Number(value);
  const absolute = Math.abs(numeric);
  if (currency === "USD" && absolute > 0 && absolute < 0.0001) {
    return `$${numeric.toPrecision(4)}`;
  }
  const locale = currency === "IDR" ? "id-ID" : "en-US";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "IDR" ? 0 : absolute >= 100 ? 2 : absolute >= 1 ? 4 : 10
  }).format(numeric);
}

function formatPercent(value, sign = true) {
  if (!Number.isFinite(Number(value))) return "-";
  const numeric = Number(value);
  const prefix = sign && numeric > 0 ? "+" : "";
  return `${prefix}${numeric.toFixed(2)}%`;
}

function formatMaximumLeverage(lossPercent) {
  const loss = Math.abs(Number(lossPercent));
  if (!Number.isFinite(loss) || loss <= 0) return "-";
  return String(Math.floor(80 / loss));
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

function toneByBias(value) {
  if (value === "Bullish" || value === "Long") return "tone-green";
  if (value === "Bearish" || value === "Short") return "tone-red";
  return "tone-muted";
}

function toneByConfidence(value) {
  if (value >= 70) return "tone-green";
  if (value >= 50) return "tone-amber";
  return "tone-red";
}

function analysisSummary(row) {
  const forecast = row?.forecast;
  const structure = forecast?.bias || "Netral";
  const action = forecast?.tradePlan?.action || "Skip trade";
  const confidence = row?.analysis?.confidence ?? 0;
  const ideal = forecast?.tradePlan?.isCurrentlyIdeal ? "Sudah" : "Belum";
  return { structure, action, confidence, ideal };
}

function renderSummaryMeta(summary, extraClass = "") {
  return `
    <span class="${extraClass} ${toneByBias(summary.structure)}">${escapeHtml(summary.structure)}</span>
    <span class="dot">•</span>
    <span class="${extraClass} ${toneByBias(summary.action)}">${escapeHtml(summary.action)}</span>
    <span class="dot">•</span>
    <span class="${extraClass} ${toneByConfidence(summary.confidence)}">${summary.confidence}%</span>
    <span class="dot">•</span>
    <span class="${extraClass} ${summary.ideal === "Sudah" ? "tone-green" : "tone-red"}">${summary.ideal}</span>
  `;
}

function renderPreviousInline(previous) {
  if (!previous) {
    return '<span class="previous-empty">24 jam yang lalu: belum tersedia</span>';
  }
  return `
    <span class="previous-label">24 jam yang lalu:</span>
    ${renderSummaryMeta(analysisSummary(previous), "previous-value")}
  `;
}

function normalizeTradeSide(side) {
  return side === "Long" || side === "Short" ? side : "";
}

function countKeywordHits(text, keywords) {
  return keywords.reduce((count, keyword) => count + (text.includes(keyword) ? 1 : 0), 0);
}

function scoreNewsSentiment(items) {
  return (items || []).reduce((summary, item) => {
    const text = `${item.title || ""} ${item.summary || ""}`.toLowerCase();
    const positiveHits = countKeywordHits(text, POSITIVE_NEWS_KEYWORDS);
    const negativeHits = countKeywordHits(text, NEGATIVE_NEWS_KEYWORDS);
    if (positiveHits > negativeHits) {
      return {
        score: summary.score + positiveHits - negativeHits,
        matched: summary.matched + 1
      };
    }
    if (negativeHits > positiveHits) {
      return {
        score: summary.score - (negativeHits - positiveHits),
        matched: summary.matched + 1
      };
    }
    return summary;
  }, { score: 0, matched: 0 });
}

function newsSupportAssessment() {
  const side = normalizeTradeSide(state.tradeSide);
  const sentiment = scoreNewsSentiment(state.newsItems);
  const confidence = sentiment.score === 0
    ? (state.newsItems.length ? 50 : 0)
    : Math.round(Math.min(95, 50 + Math.abs(sentiment.score) / (sentiment.matched + 1) * 45));
  const aligned = side === "Long" ? sentiment.score > 0 : side === "Short" ? sentiment.score < 0 : false;
  const opposed = side === "Long" ? sentiment.score < 0 : side === "Short" ? sentiment.score > 0 : false;

  if (!side || confidence < 55 || (!aligned && !opposed)) {
    return { side, label: "Netral", confidence, tone: "tone-muted" };
  }
  if (aligned) return { side, label: "Ya", confidence, tone: "tone-green" };
  return { side, label: "Tidak", confidence, tone: "tone-red" };
}

function renderNewsSupport() {
  const assessment = newsSupportAssessment();
  const sideLabel = assessment.side || "trade";
  const sideTone = toneByBias(assessment.side);
  elements.newsSupport.innerHTML = `
    <div class="news-support-question">
      Apakah corporate action & news mendukung <strong class="${sideTone}">${escapeHtml(sideLabel.toLowerCase())}</strong>?
    </div>
    <strong class="news-support-result ${assessment.tone}">${escapeHtml(assessment.label)} (${assessment.confidence}%)</strong>
  `;
}

function marketLine(asset) {
  if (asset.market === "crypto") return `Crypto #${asset.rank || "-"} | ${asset.symbol}`;
  if (asset.market === "indonesia") return `Saham Indonesia | IDX:${asset.symbol}`;
  return `Saham Amerika | ${asset.exchange}:${asset.symbol}`;
}

function renderTradingView(asset) {
  elements.tradingViewChart.innerHTML = "";
  const chartBox = elements.tradingViewChart.parentElement;
  chartBox.classList.remove("has-chart");
  chartBox.classList.remove("has-local-chart");
  chartBox.classList.remove("show-local-chart");
  elements.chartFallback.classList.remove("is-chart");
  elements.chartFallback.innerHTML = "Memuat chart perpetual TradingView 1D berdasarkan aset yang dipilih.";

  if (!asset.tvSymbol) {
    chartBox.classList.add("show-local-chart");
    elements.chartFallback.innerHTML = "Chart perpetual TradingView belum tersedia untuk aset ini. Menyiapkan chart lokal.";
    return;
  }

  const widget = document.createElement("div");
  widget.className = "tradingview-widget-container__widget";
  elements.tradingViewChart.appendChild(widget);

  const script = document.createElement("script");
  script.type = "text/javascript";
  script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
  script.async = true;
  script.text = JSON.stringify({
    autosize: true,
    symbol: asset.tvSymbol,
    interval: "D",
    timezone: "Asia/Jakarta",
    theme: "light",
    style: "1",
    locale: "en",
    enable_publishing: false,
    allow_symbol_change: true,
    hide_side_toolbar: true,
    calendar: false,
    support_host: "https://www.tradingview.com"
  });
  elements.tradingViewChart.appendChild(script);

  let iframeLoaded = false;
  let iframeAttached = false;
  const markIframeLoaded = () => {
    iframeLoaded = true;
    chartBox.classList.add("has-chart");
    chartBox.classList.remove("show-local-chart");
  };

  const observer = new MutationObserver(() => {
    const iframe = elements.tradingViewChart.querySelector("iframe");
    if (iframe && !iframeAttached) {
      iframeAttached = true;
      iframe.addEventListener("load", markIframeLoaded, { once: true });
      observer.disconnect();
    }
  });
  observer.observe(elements.tradingViewChart, { childList: true, subtree: true });

  window.setTimeout(() => {
    if (!iframeLoaded) {
      chartBox.classList.add("show-local-chart");
    }
    observer.disconnect();
  }, 9000);
}

function renderHomeRows(rows) {
  if (!rows.length) {
    elements.assetList.innerHTML = '<div class="asset-row"><span class="asset-title">Tidak ada aset yang berhasil dianalisa.</span></div>';
    return;
  }

  elements.assetList.innerHTML = rows.map((row, index) => {
    const asset = row.asset;
    const current = analysisSummary(row);
    return `
      <button class="asset-row asset-row-comparison" type="button" data-index="${index}">
        <span class="asset-title">${(state.page - 1) * state.pageSize + index + 1}. ${escapeHtml(asset.name)}</span>
        <span class="asset-meta current-meta">
          ${renderSummaryMeta(current)}
        </span>
        <span class="asset-previous">
          ${renderPreviousInline(row.previous)}
        </span>
      </button>
    `;
  }).join("");
}

function pageButtons() {
  const pages = state.pages;
  const current = state.page;
  const core = [1, 2, 3, 4, pages].filter((page, index, list) => page >= 1 && page <= pages && list.indexOf(page) === index);
  const buttons = [];
  buttons.push(`<button class="page-button" type="button" data-page="${current - 1}" ${current <= 1 ? "disabled" : ""}>◀</button>`);
  core.forEach((page, index) => {
    if (index > 0 && page - core[index - 1] > 1) {
      buttons.push('<span class="page-ellipsis">...</span>');
    }
    buttons.push(`<button class="page-button ${page === current ? "is-active" : ""}" type="button" data-page="${page}">${page}</button>`);
  });
  buttons.push(`<button class="page-button" type="button" data-page="${current + 1}" ${current >= pages ? "disabled" : ""}>▶</button>`);
  return buttons.join("");
}

function renderPagination() {
  elements.pagination.innerHTML = pageButtons();
}

async function loadScreen() {
  const requestId = state.requestId + 1;
  state.requestId = requestId;
  elements.homeStatus.textContent = `Screening ${MARKET_LABELS[state.market]} halaman ${state.page}...`;
  elements.assetList.innerHTML = Array.from({ length: 6 }, () => '<div class="asset-row"><span class="asset-title">Menganalisa aset...</span></div>').join("");
  elements.pagination.innerHTML = "";

  const params = new URLSearchParams({
    market: state.market,
    page: String(state.page),
    pageSize: String(state.pageSize),
    limit: "100",
    days: "365",
    threshold: state.market === "crypto" ? "7" : "5"
  });

  try {
    const response = await fetch(`/api/screen?${params.toString()}`);
    const payload = await response.json();
    if (requestId !== state.requestId) return;
    if (!response.ok) throw new Error(payload.error || "Screening gagal.");
    state.rows = payload.results || [];
    state.pages = payload.pages || 1;
    renderHomeRows(state.rows);
    renderPagination();
    elements.homeStatus.textContent = `${payload.source} | ${payload.total} aset | ${((payload.elapsedMs || 0) / 1000).toFixed(1)} detik.`;
  } catch (error) {
    elements.assetList.innerHTML = `<div class="asset-row"><span class="asset-title">${escapeHtml(error.message)}</span></div>`;
    elements.homeStatus.textContent = "Screening belum berhasil.";
  }
}

function showHome() {
  elements.detailView.hidden = true;
  elements.homeView.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showDetailShell(row) {
  state.selected = row.asset;
  state.newsItems = [];
  state.newsFilter = "all";
  state.tradeSide = "";
  elements.newsFilter.value = "all";
  elements.homeView.hidden = true;
  elements.detailView.hidden = false;
  elements.analysisContent.innerHTML = '<p class="analysis-copy">Menganalisa struktur Elliott Wave, Fibonacci, dan kelayakan trading...</p>';
  elements.newsContent.innerHTML = '<p class="analysis-copy">Mengambil corporate action dan berita terbaru...</p>';
  renderNewsSupport();
  renderTradingView(row.asset);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderPredictionChart(path, currency) {
  const points = (path || []).filter((point) => Number.isFinite(Number(point.price)));
  if (points.length < 2) return "";

  const prices = points.map((point) => Number(point.price));
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const rawSpan = max - min;
  const reference = Math.max(...prices.map((price) => Math.abs(price)), 1e-12);
  const span = Math.max(rawSpan, reference * 0.01);
  const paddedMin = min - span * 0.18;
  const paddedMax = max + span * 0.18;
  const paddedSpan = Math.max(paddedMax - paddedMin, reference * 0.01);
  const xStep = 360 / Math.max(points.length - 1, 1);
  const coords = points.map((point, index) => {
    const x = 30 + index * xStep;
    const y = 190 - ((Number(point.price) - paddedMin) / paddedSpan) * 135;
    return { ...point, x, y };
  });
  const polyline = coords.map((point) => `${point.x},${point.y}`).join(" ");

  return `
    <div class="prediction-chart" aria-label="Chart prediksi sederhana">
      <svg viewBox="0 0 420 245" role="img">
        <line x1="30" y1="190" x2="390" y2="190" stroke="#777" stroke-width="1" />
        <line x1="30" y1="55" x2="30" y2="190" stroke="#777" stroke-width="1" />
        <polyline points="${polyline}" fill="none" stroke="#155e9f" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
        ${coords.map((point) => `
          <circle cx="${point.x}" cy="${point.y}" r="6" fill="${point.role === "stop" ? "#e21b23" : point.role === "target" ? "#0a9f34" : "#171717"}" />
          <text x="${point.x}" y="${Math.max(18, point.y - 16)}" text-anchor="middle" class="chart-label">${escapeHtml(point.label)}</text>
          <text x="${point.x}" y="${Math.min(232, point.y + 22)}" text-anchor="middle" class="chart-price">${escapeHtml(formatPrice(point.price, currency))}</text>
        `).join("")}
      </svg>
    </div>
  `;
}

function renderLocalPriceChart(candles, asset) {
  const chartBox = elements.tradingViewChart.parentElement;
  const rows = (candles || []).filter((candle) => Number.isFinite(Number(candle.close)));
  if (rows.length < 2) {
    chartBox.classList.remove("has-local-chart");
    chartBox.classList.remove("show-local-chart");
    elements.chartFallback.classList.remove("is-chart");
    elements.chartFallback.innerHTML = "Chart belum tersedia. Data harga historis belum cukup untuk membuat chart lokal.";
    return;
  }

  const sampled = rows.slice(-120);
  const closes = sampled.map((candle) => Number(candle.close));
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const reference = Math.max(...closes.map((price) => Math.abs(price)), 1e-12);
  const span = Math.max(max - min, reference * 0.01);
  const paddedMin = min - span * 0.12;
  const paddedMax = max + span * 0.12;
  const paddedSpan = Math.max(paddedMax - paddedMin, reference * 0.01);
  const xStep = 420 / Math.max(sampled.length - 1, 1);
  const points = sampled.map((candle, index) => {
    const x = 20 + index * xStep;
    const y = 220 - ((Number(candle.close) - paddedMin) / paddedSpan) * 170;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
  const first = closes[0];
  const last = closes.at(-1);
  const positive = last >= first;
  const currency = asset.currency || "USD";

  chartBox.classList.add("has-local-chart");
  if (!chartBox.classList.contains("has-chart")) {
    chartBox.classList.add("show-local-chart");
  }
  elements.chartFallback.classList.add("is-chart");
  elements.chartFallback.innerHTML = `
    <svg viewBox="0 0 460 260" role="img" aria-label="Chart harga lokal ${escapeHtml(asset.name)}">
      <line x1="20" y1="220" x2="440" y2="220" stroke="#9a9a9a" stroke-width="1" />
      <line x1="20" y1="50" x2="20" y2="220" stroke="#9a9a9a" stroke-width="1" />
      <polyline points="${points}" fill="none" stroke="${positive ? "#0a9f34" : "#e21b23"}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
      <text x="24" y="28" class="local-chart-title">${escapeHtml(asset.name)} 1D</text>
      <text x="24" y="246" class="local-chart-price">${escapeHtml(formatPrice(min, currency))}</text>
      <text x="438" y="28" text-anchor="end" class="local-chart-price">${escapeHtml(formatPrice(max, currency))}</text>
      <text x="438" y="246" text-anchor="end" class="local-chart-price">${escapeHtml(formatPrice(last, currency))}</text>
    </svg>
  `;
}

function renderPreviousAnalysis(previous, currency) {
  if (!previous) {
    return `
      <section class="previous-panel">
        <h2>Data 24 jam yang lalu</h2>
        <p class="analysis-copy">Data 24 jam yang lalu belum tersedia. Biasanya tersedia setelah histori candle harian cukup lengkap.</p>
      </section>
    `;
  }

  const forecast = previous.forecast;
  const analysis = previous.analysis;
  const actionTone = forecast.tradePlan.action === "Skip trade" ? "tone-muted" : toneByBias(forecast.tradePlan.side);
  const confidenceTone = toneByConfidence(analysis.confidence);
  const takeProfit = forecast.tradePlan.isTradable
    ? `${formatPrice(forecast.tradePlan.takeProfit, currency)} (${formatPercent(forecast.tradePlan.profitPercent)})`
    : "Tidak aktif";
  const stopLoss = forecast.tradePlan.isTradable
    ? `${formatPrice(forecast.tradePlan.stopLoss, currency)} (-${Math.abs(forecast.tradePlan.lossPercent).toFixed(2)}%)`
    : "Tidak aktif";
  const maximumLeverageSuggestion = formatMaximumLeverage(forecast.tradePlan.lossPercent);
  const idealLabel = forecast.tradePlan.isCurrentlyIdeal ? "Sudah" : "Belum";

  return `
    <section class="previous-panel">
      <h2>Data 24 jam yang lalu</h2>
      <p class="analysis-copy">Simulasi analisa menggunakan data sampai candle sebelumnya, supaya bisa dibandingkan dengan kondisi sekarang.</p>

      ${renderPredictionChart(forecast.predictionPath, currency)}

      <div class="trade-row">
        <span>Potensi trading</span>
        <strong class="${actionTone}">${escapeHtml(forecast.tradePlan.action)}</strong>
      </div>
      <div class="trade-row">
        <span>Confidence</span>
        <strong class="${confidenceTone}">${analysis.confidence}%</strong>
      </div>
      <div class="trade-row">
        <span>Take profit</span>
        <strong class="${forecast.tradePlan.isTradable ? "tone-green" : "tone-muted"}">${takeProfit}</strong>
      </div>
      <div class="trade-row">
        <span>Stop loss</span>
        <strong class="${forecast.tradePlan.isTradable ? "tone-red" : "tone-muted"}">${stopLoss}</strong>
      </div>
      <div class="trade-row">
        <span>Maximum leverage suggestion</span>
        <strong>${maximumLeverageSuggestion}</strong>
      </div>
      <div class="trade-row">
        <span>Sudah ideal untuk trade saat itu?</span>
        <strong class="${idealLabel === "Sudah" ? "tone-green" : "tone-red"}">${idealLabel}</strong>
      </div>

      <h3>Keterangan trade 24 jam lalu</h3>
      <p class="analysis-copy">${escapeHtml(forecast.entryDecision)}</p>
      <p class="analysis-copy">${escapeHtml(forecast.tradePlan.rationale)}</p>
    </section>
  `;
}

function renderAnalysis(payload) {
  const { asset, close, change, analysis, forecast, previous } = payload;
  const currency = asset.currency || "USD";
  const biasTone = toneByBias(forecast.bias);
  const confidenceTone = toneByConfidence(analysis.confidence);
  const actionTone = forecast.tradePlan.action === "Skip trade" ? "tone-muted" : toneByBias(forecast.tradePlan.side);
  state.tradeSide = normalizeTradeSide(forecast.tradePlan.side);
  renderNewsSupport();
  const invalidationText = forecast.bias === "Bullish"
    ? `Selama harga bertahan di atas area invalidasi ${formatPrice(forecast.fibonacci.fib786, currency)}, skenario kenaikan menuju ekstensi Fibonacci masih valid untuk dipantau.`
    : `Selama harga tertahan di bawah area invalidasi ${formatPrice(forecast.fibonacci.fib786, currency)}, skenario penurunan menuju ekstensi Fibonacci masih valid untuk dipantau.`;
  const takeProfit = forecast.tradePlan.isTradable
    ? `${formatPrice(forecast.tradePlan.takeProfit, currency)} (${formatPercent(forecast.tradePlan.profitPercent)})`
    : "Tidak aktif";
  const stopLoss = forecast.tradePlan.isTradable
    ? `${formatPrice(forecast.tradePlan.stopLoss, currency)} (-${Math.abs(forecast.tradePlan.lossPercent).toFixed(2)}%)`
    : "Tidak aktif";
  const maximumLeverageSuggestion = formatMaximumLeverage(forecast.tradePlan.lossPercent);
  const idealLabel = forecast.tradePlan.isCurrentlyIdeal ? "Sudah" : "Belum";

  elements.analysisContent.innerHTML = `
    <div class="summary-grid">
      <div class="summary-card">
        <span>Market</span>
        <strong>${escapeHtml(asset.name)} (${escapeHtml(asset.symbol)})</strong>
      </div>
      <div class="summary-card">
        <span>Harga sekarang</span>
        <strong>${formatPrice(close, currency)}</strong>
      </div>
    </div>
    <div class="metric-row">
      <span>Market struktur</span>
      <strong class="${biasTone}">${escapeHtml(forecast.bias)}</strong>
    </div>
    <div class="metric-row">
      <span>Potensi range top</span>
      <strong>${formatPrice(forecast.topRange.from, currency)} - ${formatPrice(forecast.topRange.to, currency)}</strong>
    </div>
    <div class="metric-row">
      <span>Potensi range bottom</span>
      <strong>${formatPrice(forecast.bottomRange.from, currency)} - ${formatPrice(forecast.bottomRange.to, currency)}</strong>
    </div>

    <h3>Keterangan analisa Elliott Wave & Fibonacci</h3>
    <p class="analysis-copy">${escapeHtml(forecast.marketStructure.text)}</p>
    <p class="analysis-copy">Area Fibonacci utama berada pada retracement 0.5 di ${formatPrice(forecast.fibonacci.fib500, currency)} dan 0.618 di ${formatPrice(forecast.fibonacci.fib618, currency)}. ${escapeHtml(invalidationText)}</p>
    <p class="analysis-copy">Area top potensial berada pada rentang ${formatPrice(forecast.topRange.from, currency)} sampai ${formatPrice(forecast.topRange.to, currency)}. Area bottom potensial berada pada rentang ${formatPrice(forecast.bottomRange.from, currency)} sampai ${formatPrice(forecast.bottomRange.to, currency)}. Perubahan harga periode analisa: ${formatPercent(change)}.</p>

    ${renderPredictionChart(forecast.predictionPath, currency)}

    <section class="trade-panel">
      <h2>Analisa untuk trading</h2>
      <div class="trade-row">
        <span>Potensi trading</span>
        <strong class="${actionTone}">${escapeHtml(forecast.tradePlan.action)}</strong>
      </div>
      <div class="trade-row">
        <span>Confidence</span>
        <strong class="${confidenceTone}">${analysis.confidence}%</strong>
      </div>
      <div class="trade-row">
        <span>Take profit</span>
        <strong class="${forecast.tradePlan.isTradable ? "tone-green" : "tone-muted"}">${takeProfit}</strong>
      </div>
      <div class="trade-row">
        <span>Stop loss</span>
        <strong class="${forecast.tradePlan.isTradable ? "tone-red" : "tone-muted"}">${stopLoss}</strong>
      </div>
      <div class="trade-row">
        <span>Maximun leverage suggestion</span>
        <strong>${maximumLeverageSuggestion}</strong>
      </div>
      <div class="trade-row">
        <span>Sudah ideal untuk trade sekarang?</span>
        <strong class="${idealLabel === "Sudah" ? "tone-green" : "tone-red"}">${idealLabel}</strong>
      </div>

      <h3>Keterangan trade</h3>
      <p class="analysis-copy">${escapeHtml(forecast.entryDecision)}</p>
      <p class="analysis-copy">${escapeHtml(forecast.tradePlan.rationale)}</p>
      <p class="risk-note">Analisa ini bersifat riset teknikal berbasis data harian. Validasi manual pada chart tetap diperlukan sebelum mengambil keputusan.</p>
    </section>

    ${renderPreviousAnalysis(previous, currency)}
  `;
}

function classifyNewsItem(item) {
  const text = `${item.title || ""} ${item.summary || ""}`.toLowerCase();
  return CORPORATE_ACTION_KEYWORDS.some((keyword) => text.includes(keyword)) ? "corporate" : "news";
}

function emptyNewsMessage() {
  if (state.newsFilter === "corporate") {
    return "Belum ada corporate action signifikan yang berhasil diambil dari sumber publik.";
  }
  if (state.newsFilter === "news") {
    return "Belum ada news signifikan yang berhasil diambil dari sumber publik.";
  }
  return "Belum ada corporate action atau news signifikan yang berhasil diambil dari sumber publik.";
}

function renderNews(items) {
  if (Array.isArray(items)) {
    state.newsItems = items;
  }
  renderNewsSupport();

  const filteredItems = state.newsFilter === "all"
    ? state.newsItems
    : state.newsItems.filter((item) => classifyNewsItem(item) === state.newsFilter);

  if (!filteredItems.length) {
    elements.newsContent.innerHTML = `<p class="analysis-copy">${emptyNewsMessage()}</p>`;
    return;
  }

  elements.newsContent.innerHTML = filteredItems.slice(0, 10).map((item) => `
    <article class="news-item">
      <div class="news-date">${escapeHtml(formatDate(item.publishedAt))}${item.source ? ` • ${escapeHtml(item.source)}` : ""}</div>
      <p>${escapeHtml(item.title)} <a href="${escapeHtml(item.link)}" target="_blank" rel="noopener">source</a></p>
    </article>
  `).join("");
}

async function openDetail(row) {
  showDetailShell(row);
  const asset = row.asset;
  const params = new URLSearchParams({
    market: state.market,
    id: asset.id,
    limit: "100",
    days: state.market === "crypto" ? "365" : "730",
    threshold: state.market === "crypto" ? "7" : "5"
  });

  try {
    const [analysisResult, newsResult] = await Promise.allSettled([
      fetch(`/api/analyze?${params.toString()}`),
      fetch(`/api/news?${params.toString()}`)
    ]);

    let analysisError = "";
    if (analysisResult.status === "fulfilled") {
      const analysisPayload = await analysisResult.value.json();
      if (analysisResult.value.ok) {
        renderLocalPriceChart(analysisPayload.history, analysisPayload.asset || asset);
        renderAnalysis(analysisPayload);
      } else {
        analysisError = analysisPayload.error || "Analisa gagal.";
      }
    } else {
      analysisError = "Analisa gagal dimuat.";
    }

    if (newsResult.status === "fulfilled") {
      const newsPayload = await newsResult.value.json();
      renderNews(newsResult.value.ok ? newsPayload.items || [] : []);
    } else {
      elements.newsContent.innerHTML = '<p class="analysis-copy">Berita belum dapat dimuat.</p>';
    }

    if (analysisError) {
      elements.analysisContent.innerHTML = `<p class="analysis-copy">${escapeHtml(analysisError)}</p>`;
    }
  } catch (error) {
    elements.analysisContent.innerHTML = `<p class="analysis-copy">${escapeHtml(error.message)}</p>`;
  }
}

elements.marketSelect.addEventListener("change", (event) => {
  state.market = event.target.value;
  state.page = 1;
  loadScreen();
});

elements.assetList.addEventListener("click", (event) => {
  const button = event.target.closest(".asset-row[data-index]");
  if (!button) return;
  const row = state.rows[Number(button.dataset.index)];
  if (row) openDetail(row);
});

elements.pagination.addEventListener("click", (event) => {
  const button = event.target.closest(".page-button[data-page]");
  if (!button || button.disabled) return;
  const page = Number(button.dataset.page);
  if (page >= 1 && page <= state.pages) {
    state.page = page;
    loadScreen();
  }
});

elements.backButton.addEventListener("click", showHome);

elements.newsFilter.addEventListener("change", (event) => {
  state.newsFilter = event.target.value;
  renderNews();
});

loadScreen();

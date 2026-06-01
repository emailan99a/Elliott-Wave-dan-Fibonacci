import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const PORT = Number(process.env.PORT || 4173);
const PUBLIC_DIR = join(process.cwd(), "public");
const CACHE_TTL_MS = 10 * 60 * 1000;

const cache = new Map();

function cryptoTvCandidates(symbol) {
  if (symbol === "USDT" || symbol === "USDC") return [];
  return [
    `BYBIT:${symbol}USDT.P`,
    `OKX:${symbol}USDT.P`,
    `BINANCE:${symbol}USDT.P`
  ];
}

function cryptoTvSymbol(symbol) {
  return cryptoTvCandidates(symbol)[0];
}

async function resolveCryptoTvSymbols(assets) {
  const candidates = [...new Set(assets.flatMap((asset) => asset.tvCandidates || cryptoTvCandidates(asset.symbol)))];
  if (!candidates.length) return assets;

  try {
    const available = new Set();
    const tvPriceBySymbol = new Map();
    for (let index = 0; index < candidates.length; index += 200) {
      const response = await fetchWithTimeout("https://scanner.tradingview.com/crypto/scan", {
        method: "POST",
        accept: "application/json",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          symbols: {
            tickers: candidates.slice(index, index + 200),
            query: { types: [] }
          },
          columns: ["close"]
        }),
        timeoutMs: 10000
      });
      const payload = await response.json();
      for (const item of payload.data || []) {
        available.add(item.s);
        tvPriceBySymbol.set(item.s, Number(item.d?.[0] || 0));
      }
    }

    return assets.map((asset) => {
      const assetCandidates = asset.tvCandidates || cryptoTvCandidates(asset.symbol);
      const tvSymbol = assetCandidates.find((candidate) => available.has(candidate)) || "";
      const tvPrice = Number(tvPriceBySymbol.get(tvSymbol) || 0);
      return {
        ...asset,
        tvSymbol,
        tvCandidates: assetCandidates,
        tvProvider: tvSymbol ? tvSymbol.split(":")[0] : "",
        currentPrice: Number(asset.currentPrice) > 0 ? Number(asset.currentPrice) : tvPrice,
        tvPrice
      };
    });
  } catch {
    return assets;
  }
}

const CRYPTO_FALLBACK = [
  ["bitcoin", "BTC", "Bitcoin"],
  ["ethereum", "ETH", "Ethereum"],
  ["ripple", "XRP", "XRP"],
  ["bnb", "BNB", "BNB"],
  ["solana", "SOL", "Solana"],
  ["usd-coin", "USDC", "USD Coin"],
  ["dogecoin", "DOGE", "Dogecoin"],
  ["tron", "TRX", "TRON"],
  ["cardano", "ADA", "Cardano"],
  ["hyperliquid", "HYPE", "Hyperliquid"],
  ["bitcoin-cash", "BCH", "Bitcoin Cash"],
  ["chainlink", "LINK", "Chainlink"],
  ["stellar", "XLM", "Stellar"],
  ["sui", "SUI", "Sui"],
  ["avalanche-2", "AVAX", "Avalanche"],
  ["shiba-inu", "SHIB", "Shiba Inu"],
  ["the-open-network", "TON", "Toncoin"],
  ["litecoin", "LTC", "Litecoin"],
  ["polkadot", "DOT", "Polkadot"],
  ["leo-token", "LEO", "UNUS SED LEO"],
  ["monero", "XMR", "Monero"],
  ["dai", "DAI", "Dai"],
  ["uniswap", "UNI", "Uniswap"],
  ["aptos", "APT", "Aptos"],
  ["near", "NEAR", "NEAR Protocol"],
  ["ethereum-classic", "ETC", "Ethereum Classic"],
  ["internet-computer", "ICP", "Internet Computer"],
  ["okb", "OKB", "OKB"],
  ["bittensor", "TAO", "Bittensor"],
  ["filecoin", "FIL", "Filecoin"],
  ["kaspa", "KAS", "Kaspa"],
  ["cosmos", "ATOM", "Cosmos"],
  ["aave", "AAVE", "Aave"],
  ["arbitrum", "ARB", "Arbitrum"],
  ["optimism", "OP", "Optimism"],
  ["worldcoin-wld", "WLD", "Worldcoin"],
  ["maker", "MKR", "Maker"],
  ["injective-protocol", "INJ", "Injective"],
  ["vechain", "VET", "VeChain"],
  ["the-graph", "GRT", "The Graph"],
  ["fetch-ai", "FET", "Artificial Superintelligence Alliance"],
  ["algorand", "ALGO", "Algorand"],
  ["blockstack", "STX", "Stacks"],
  ["quant-network", "QNT", "Quant"],
  ["lido-dao", "LDO", "Lido DAO"],
  ["render-token", "RENDER", "Render"],
  ["bonk", "BONK", "Bonk"],
  ["sei-network", "SEI", "Sei"],
  ["jupiter-exchange-solana", "JUP", "Jupiter"],
  ["pyth-network", "PYTH", "Pyth Network"],
  ["floki", "FLOKI", "FLOKI"],
  ["thorchain", "RUNE", "THORChain"],
  ["the-sandbox", "SAND", "The Sandbox"],
  ["decentraland", "MANA", "Decentraland"],
  ["theta-token", "THETA", "Theta Network"],
  ["hedera-hashgraph", "HBAR", "Hedera"],
  ["eos", "EOS", "EOS"],
  ["bitcoin-cash-sv", "BSV", "Bitcoin SV"],
  ["nexo", "NEXO", "Nexo"],
  ["tezos", "XTZ", "Tezos"],
  ["pax-gold", "PAXG", "PAX Gold"],
  ["pepe", "PEPE", "Pepe"],
  ["ondo-finance", "ONDO", "Ondo"],
  ["dogwifcoin", "WIF", "dogwifhat"],
  ["celestia", "TIA", "Celestia"],
  ["immutable-x", "IMX", "Immutable"],
  ["ethena", "ENA", "Ethena"],
  ["crypto-com-chain", "CRO", "Cronos"],
  ["mantle", "MNT", "Mantle"],
  ["wrapped-bitcoin", "WBTC", "Wrapped Bitcoin"],
  ["weth", "WETH", "Wrapped Ether"],
  ["first-digital-usd", "FDUSD", "First Digital USD"],
  ["usdd", "USDD", "USDD"],
  ["gatechain-token", "GT", "GateToken"],
  ["xdce-crowd-sale", "XDC", "XDC Network"],
  ["raydium", "RAY", "Raydium"],
  ["jasmycoin", "JASMY", "JasmyCoin"],
  ["based-brett", "BRETT", "Brett"],
  ["kaia", "KAIA", "Kaia"],
  ["flow", "FLOW", "Flow"],
  ["beam-2", "BEAM", "Beam"],
  ["axie-infinity", "AXS", "Axie Infinity"],
  ["elrond-erd-2", "EGLD", "MultiversX"],
  ["starknet", "STRK", "Starknet"],
  ["dydx-chain", "DYDX", "dYdX"],
  ["movement", "MOVE", "Movement"],
  ["coredaoorg", "CORE", "Core"],
  ["flare-networks", "FLR", "Flare"],
  ["ethereum-name-service", "ENS", "Ethereum Name Service"],
  ["fantom", "FTM", "Fantom"],
  ["kava", "KAVA", "Kava"],
  ["mina-protocol", "MINA", "Mina"],
  ["neo", "NEO", "Neo"],
  ["chiliz", "CHZ", "Chiliz"],
  ["pancakeswap-token", "CAKE", "PancakeSwap"],
  ["pendle", "PENDLE", "Pendle"],
  ["gala", "GALA", "Gala"],
  ["zcash", "ZEC", "Zcash"],
  ["dash", "DASH", "Dash"],
  ["oasis-network", "ROSE", "Oasis Network"]
].map(([id, symbol, name], index) => ({
  id,
  symbol,
  name,
  market: "crypto",
  rank: index + 1,
  marketCap: null,
  currency: "USD",
  tvCandidates: cryptoTvCandidates(symbol),
  tvSymbol: cryptoTvSymbol(symbol)
}));

const STOCKS = [
  ["AAPL", "Apple", "NASDAQ"],
  ["MSFT", "Microsoft", "NASDAQ"],
  ["NVDA", "NVIDIA", "NASDAQ"],
  ["AMZN", "Amazon", "NASDAQ"],
  ["GOOGL", "Alphabet Class A", "NASDAQ"],
  ["GOOG", "Alphabet Class C", "NASDAQ"],
  ["META", "Meta Platforms", "NASDAQ"],
  ["AVGO", "Broadcom", "NASDAQ"],
  ["TSLA", "Tesla", "NASDAQ"],
  ["LLY", "Eli Lilly", "NYSE"],
  ["JPM", "JPMorgan Chase", "NYSE"],
  ["V", "Visa", "NYSE"],
  ["XOM", "Exxon Mobil", "NYSE"],
  ["UNH", "UnitedHealth", "NYSE"],
  ["MA", "Mastercard", "NYSE"],
  ["COST", "Costco", "NASDAQ"],
  ["WMT", "Walmart", "NYSE"],
  ["NFLX", "Netflix", "NASDAQ"],
  ["PG", "Procter & Gamble", "NYSE"],
  ["JNJ", "Johnson & Johnson", "NYSE"],
  ["HD", "Home Depot", "NYSE"],
  ["ORCL", "Oracle", "NYSE"],
  ["BAC", "Bank of America", "NYSE"],
  ["ABBV", "AbbVie", "NYSE"],
  ["KO", "Coca-Cola", "NYSE"],
  ["CRM", "Salesforce", "NYSE"],
  ["CVX", "Chevron", "NYSE"],
  ["MRK", "Merck", "NYSE"],
  ["AMD", "Advanced Micro Devices", "NASDAQ"],
  ["PEP", "PepsiCo", "NASDAQ"],
  ["ADBE", "Adobe", "NASDAQ"],
  ["LIN", "Linde", "NASDAQ"],
  ["TMO", "Thermo Fisher Scientific", "NYSE"],
  ["ACN", "Accenture", "NYSE"],
  ["MCD", "McDonald's", "NYSE"],
  ["CSCO", "Cisco", "NASDAQ"],
  ["ABT", "Abbott Laboratories", "NYSE"],
  ["WFC", "Wells Fargo", "NYSE"],
  ["QCOM", "Qualcomm", "NASDAQ"],
  ["INTU", "Intuit", "NASDAQ"],
  ["IBM", "IBM", "NYSE"],
  ["GE", "GE Aerospace", "NYSE"],
  ["TXN", "Texas Instruments", "NASDAQ"],
  ["AMAT", "Applied Materials", "NASDAQ"],
  ["DIS", "Walt Disney", "NYSE"],
  ["NOW", "ServiceNow", "NYSE"],
  ["PM", "Philip Morris", "NYSE"],
  ["VZ", "Verizon", "NYSE"],
  ["CAT", "Caterpillar", "NYSE"],
  ["ISRG", "Intuitive Surgical", "NASDAQ"],
  ["GS", "Goldman Sachs", "NYSE"],
  ["RTX", "RTX", "NYSE"],
  ["MS", "Morgan Stanley", "NYSE"],
  ["SPGI", "S&P Global", "NYSE"],
  ["PFE", "Pfizer", "NYSE"],
  ["NEE", "NextEra Energy", "NYSE"],
  ["BKNG", "Booking Holdings", "NASDAQ"],
  ["LOW", "Lowe's", "NYSE"],
  ["DHR", "Danaher", "NYSE"],
  ["HON", "Honeywell", "NASDAQ"],
  ["TJX", "TJX Companies", "NYSE"],
  ["UNP", "Union Pacific", "NYSE"],
  ["CMCSA", "Comcast", "NASDAQ"],
  ["COP", "ConocoPhillips", "NYSE"],
  ["BA", "Boeing", "NYSE"],
  ["SYK", "Stryker", "NYSE"],
  ["BLK", "BlackRock", "NYSE"],
  ["AMGN", "Amgen", "NASDAQ"],
  ["PANW", "Palo Alto Networks", "NASDAQ"],
  ["ADP", "Automatic Data Processing", "NASDAQ"],
  ["GILD", "Gilead Sciences", "NASDAQ"],
  ["DE", "Deere", "NYSE"],
  ["MDT", "Medtronic", "NYSE"],
  ["ELV", "Elevance Health", "NYSE"],
  ["PLD", "Prologis", "NYSE"],
  ["BMY", "Bristol Myers Squibb", "NYSE"],
  ["SBUX", "Starbucks", "NASDAQ"],
  ["LMT", "Lockheed Martin", "NYSE"],
  ["ADI", "Analog Devices", "NASDAQ"],
  ["ETN", "Eaton", "NYSE"],
  ["MMC", "Marsh & McLennan", "NYSE"],
  ["CB", "Chubb", "NYSE"],
  ["MDLZ", "Mondelez", "NASDAQ"],
  ["C", "Citigroup", "NYSE"],
  ["REGN", "Regeneron", "NASDAQ"],
  ["VRTX", "Vertex Pharmaceuticals", "NASDAQ"],
  ["SCHW", "Charles Schwab", "NYSE"],
  ["CVS", "CVS Health", "NYSE"],
  ["MU", "Micron Technology", "NASDAQ"],
  ["LRCX", "Lam Research", "NASDAQ"],
  ["KLAC", "KLA", "NASDAQ"],
  ["BX", "Blackstone", "NYSE"],
  ["UPS", "United Parcel Service", "NYSE"],
  ["FI", "Fiserv", "NYSE"],
  ["SO", "Southern Company", "NYSE"],
  ["ZTS", "Zoetis", "NYSE"],
  ["MO", "Altria", "NYSE"],
  ["PYPL", "PayPal", "NASDAQ"],
  ["T", "AT&T", "NYSE"],
  ["USB", "U.S. Bancorp", "NYSE"]
].map(([symbol, name, exchange, stooq]) => ({
  id: symbol.toLowerCase(),
  symbol,
  name,
  market: "us",
  exchange,
  currency: "USD",
  stooq: stooq || `${symbol.toLowerCase().replaceAll(".", "-")}.us`,
  tvSymbol: `${exchange}:${symbol}`
}));

const INDONESIA_STOCKS = [
  ["BBCA", "Bank Central Asia"],
  ["BBRI", "Bank Rakyat Indonesia"],
  ["BMRI", "Bank Mandiri"],
  ["BBNI", "Bank Negara Indonesia"],
  ["TLKM", "Telkom Indonesia"],
  ["ASII", "Astra International"],
  ["AMMN", "Amman Mineral Internasional"],
  ["BREN", "Barito Renewables Energy"],
  ["TPIA", "Chandra Asri Pacific"],
  ["BYAN", "Bayan Resources"],
  ["DSSA", "Dian Swastatika Sentosa"],
  ["GOTO", "GoTo Gojek Tokopedia"],
  ["ADRO", "Alamtri Resources Indonesia"],
  ["MDKA", "Merdeka Copper Gold"],
  ["BRPT", "Barito Pacific"],
  ["KLBF", "Kalbe Farma"],
  ["ICBP", "Indofood CBP"],
  ["INDF", "Indofood Sukses Makmur"],
  ["UNVR", "Unilever Indonesia"],
  ["HMSP", "H.M. Sampoerna"],
  ["CPIN", "Charoen Pokphand Indonesia"],
  ["ANTM", "Aneka Tambang"],
  ["INCO", "Vale Indonesia"],
  ["PTBA", "Bukit Asam"],
  ["MEDC", "Medco Energi Internasional"],
  ["PGAS", "Perusahaan Gas Negara"],
  ["ISAT", "Indosat"],
  ["EXCL", "XL Axiata"],
  ["SMGR", "Semen Indonesia"],
  ["INTP", "Indocement Tunggal Prakarsa"],
  ["BUKA", "Bukalapak.com"],
  ["EMTK", "Elang Mahkota Teknologi"],
  ["MAPI", "Mitra Adiperkasa"],
  ["ACES", "Aspirasi Hidup Indonesia"],
  ["SIDO", "Industri Jamu dan Farmasi Sido Muncul"],
  ["MYOR", "Mayora Indah"],
  ["JPFA", "Japfa Comfeed Indonesia"],
  ["ERAA", "Erajaya Swasembada"],
  ["AKRA", "AKR Corporindo"],
  ["ESSA", "ESSA Industries Indonesia"],
  ["ITMG", "Indo Tambangraya Megah"],
  ["HRUM", "Harum Energy"],
  ["TBIG", "Tower Bersama Infrastructure"],
  ["TOWR", "Sarana Menara Nusantara"],
  ["MTEL", "Dayamitra Telekomunikasi"],
  ["JSMR", "Jasa Marga"],
  ["MIKA", "Mitra Keluarga Karyasehat"],
  ["HEAL", "Medikaloka Hermina"],
  ["SILO", "Siloam International Hospitals"],
  ["BRIS", "Bank Syariah Indonesia"],
  ["ARTO", "Bank Jago"],
  ["BTPS", "Bank BTPN Syariah"],
  ["BNGA", "Bank CIMB Niaga"],
  ["NISP", "Bank OCBC NISP"],
  ["PNBN", "Bank Pan Indonesia"],
  ["MAYA", "Bank Mayapada Internasional"],
  ["MEGA", "Bank Mega"],
  ["BTPN", "Bank BTPN"],
  ["BDMN", "Bank Danamon Indonesia"],
  ["BJBR", "Bank Pembangunan Daerah Jawa Barat"],
  ["BJTM", "Bank Pembangunan Daerah Jawa Timur"],
  ["WIKA", "Wijaya Karya"],
  ["PTPP", "PP Persero"],
  ["WSKT", "Waskita Karya"],
  ["ADHI", "Adhi Karya"],
  ["CTRA", "Ciputra Development"],
  ["BSDE", "Bumi Serpong Damai"],
  ["PWON", "Pakuwon Jati"],
  ["SMRA", "Summarecon Agung"],
  ["ASRI", "Alam Sutera Realty"],
  ["DMAS", "Puradelta Lestari"],
  ["KIJA", "Kawasan Industri Jababeka"],
  ["SSIA", "Surya Semesta Internusa"],
  ["AUTO", "Astra Otoparts"],
  ["IMAS", "Indomobil Sukses Internasional"],
  ["GJTL", "Gajah Tunggal"],
  ["DRMA", "Dharma Polimetal"],
  ["TINS", "Timah"],
  ["ELSA", "Elnusa"],
  ["INDY", "Indika Energy"],
  ["DOID", "Delta Dunia Makmur"],
  ["NCKL", "Trimegah Bangun Persada"],
  ["MBMA", "Merdeka Battery Materials"],
  ["CUAN", "Petrindo Jaya Kreasi"],
  ["DEWA", "Darma Henwa"],
  ["TOBA", "TBS Energi Utama"],
  ["ENRG", "Energi Mega Persada"],
  ["WIRG", "WIR Asia"],
  ["MLPL", "Multipolar"],
  ["LPPF", "Matahari Department Store"],
  ["RALS", "Ramayana Lestari Sentosa"],
  ["MAPA", "Map Aktif Adiperkasa"],
  ["SCMA", "Surya Citra Media"],
  ["MNCN", "Media Nusantara Citra"],
  ["BMTR", "Global Mediacom"],
  ["SAME", "Sarana Meditama Metropolitan"],
  ["IRRA", "Itama Ranoraya"],
  ["TSPC", "Tempo Scan Pacific"],
  ["KAEF", "Kimia Farma"],
  ["INAF", "Indofarma"],
  ["PANI", "Pantai Indah Kapuk Dua"]
].map(([symbol, name], index) => ({
  id: symbol.toLowerCase(),
  symbol,
  name,
  market: "indonesia",
  exchange: "IDX",
  currency: "IDR",
  rank: index + 1,
  yahoo: `${symbol}.JK`,
  tvSymbol: `IDX:${symbol}`
}));

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8"
};

function json(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function getCached(key) {
  const entry = cache.get(key);
  if (!entry || Date.now() - entry.createdAt > CACHE_TTL_MS) return null;
  return entry.value;
}

function setCached(key, value) {
  cache.set(key, { createdAt: Date.now(), value });
  return value;
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 15000);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "accept": options.accept || "*/*",
        "user-agent": "ElliottWaveScanner/0.1 local research dashboard",
        ...options.headers
      }
    });
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function getCryptoAssets(limit = 100) {
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 100);
  const key = `crypto-assets:coingecko:${safeLimit}`;
  const cached = getCached(key);
  if (cached) return cached;

  const url = new URL("https://api.coingecko.com/api/v3/coins/markets");
  url.searchParams.set("vs_currency", "usd");
  url.searchParams.set("order", "market_cap_desc");
  url.searchParams.set("per_page", String(safeLimit));
  url.searchParams.set("page", "1");
  url.searchParams.set("sparkline", "false");
  url.searchParams.set("price_change_percentage", "24h,7d,30d,1y");

  try {
    const response = await fetchWithTimeout(url, { accept: "application/json" });
    const rows = await response.json();
    const assets = rows.map((row) => {
      const symbol = row.symbol.toUpperCase();
      return {
        id: row.id,
        symbol,
        name: row.name,
        market: "crypto",
        rank: row.market_cap_rank,
        marketCap: row.market_cap,
        currency: "USD",
        currentPrice: Number(row.current_price),
        change24h: Number(row.price_change_percentage_24h || 0),
        change7d: Number(row.price_change_percentage_7d_in_currency || 0),
        change30d: Number(row.price_change_percentage_30d_in_currency || 0),
        change1y: Number(row.price_change_percentage_1y_in_currency || 0),
        volume24h: Number(row.total_volume || 0),
        lastUpdated: row.last_updated,
        tvCandidates: cryptoTvCandidates(symbol),
        tvSymbol: cryptoTvSymbol(symbol)
      };
    });

    if (!assets.length) throw new Error("CoinGecko returned no crypto assets");
    return setCached(key, await resolveCryptoTvSymbols(assets));
  } catch (error) {
    const fallback = CRYPTO_FALLBACK.slice(0, safeLimit).map((asset) => ({ ...asset }));
    if (fallback.length) return setCached(key, await resolveCryptoTvSymbols(fallback));
    throw new Error(`CoinGecko crypto asset list unavailable: ${error.message}`);
  }
}

async function getAssets(market, limit = 100) {
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 100);
  if (market === "crypto") return getCryptoAssets(limit);
  if (market === "stocks" || market === "us") return STOCKS.slice(0, safeLimit);
  if (market === "indonesia" || market === "idx") return INDONESIA_STOCKS.slice(0, safeLimit);

  const cryptoResult = await Promise.allSettled([getCryptoAssets(safeLimit)]);
  const crypto = cryptoResult[0].status === "fulfilled" ? cryptoResult[0].value : [];
  return [...crypto, ...STOCKS.slice(0, safeLimit), ...INDONESIA_STOCKS.slice(0, safeLimit)];
}

function dateToken(date) {
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

function parseStooqCsv(csv) {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length <= 1 || /no data/i.test(csv)) return [];
  return lines.slice(1).map((line) => {
    const [date, open, high, low, close, volume] = line.split(",");
    return {
      date,
      open: Number(open),
      high: Number(high),
      low: Number(low),
      close: Number(close),
      volume: Number(volume)
    };
  }).filter((row) => Number.isFinite(row.close) && row.close > 0);
}

async function getYahooHistory(symbol, safeDays) {
  const yahooUrl = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`);
  yahooUrl.searchParams.set("range", `${Math.min(Math.ceil(safeDays / 365), 5)}y`);
  yahooUrl.searchParams.set("interval", "1d");
  const response = await fetchWithTimeout(yahooUrl, { accept: "application/json" });
  const data = await response.json();
  const result = data.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  const timestamps = result?.timestamp || [];
  const rows = timestamps.map((timestamp, index) => ({
    date: new Date(timestamp * 1000).toISOString().slice(0, 10),
    open: Number(quote?.open?.[index]),
    high: Number(quote?.high?.[index]),
    low: Number(quote?.low?.[index]),
    close: Number(quote?.close?.[index]),
    volume: Number(quote?.volume?.[index] || 0)
  })).filter((row) => Number.isFinite(row.close) && row.close > 0);
  return rows.slice(-safeDays);
}

async function getHistory(asset, days = 730) {
  const maxDays = asset.market === "crypto" ? 365 : 1825;
  const safeDays = Math.min(Math.max(Number(days) || 730, 120), maxDays);
  const key = `history:${asset.market}:${asset.id}:${safeDays}`;
  const cached = getCached(key);
  if (cached) return cached;

  if (asset.market === "crypto") {
    const url = new URL(`https://api.coingecko.com/api/v3/coins/${asset.id}/market_chart`);
    url.searchParams.set("vs_currency", "usd");
    url.searchParams.set("days", String(safeDays));
    url.searchParams.set("interval", "daily");
    const response = await fetchWithTimeout(url, { accept: "application/json" });
    const data = await response.json();
    const rows = (data.prices || []).map(([timestamp, price]) => ({
      date: new Date(timestamp).toISOString().slice(0, 10),
      open: Number(price),
      high: Number(price),
      low: Number(price),
      close: Number(price),
      volume: 0
    })).filter((row) => Number.isFinite(row.close) && row.close > 0);
    if (rows.length && Number.isFinite(asset.currentPrice) && asset.currentPrice > 0) {
      rows[rows.length - 1] = {
        ...rows[rows.length - 1],
        close: asset.currentPrice,
        high: Math.max(rows[rows.length - 1].high, asset.currentPrice),
        low: Math.min(rows[rows.length - 1].low, asset.currentPrice)
      };
    }
    if (rows.length) return setCached(key, rows);
    throw new Error(`No CoinGecko daily crypto history found for ${asset.symbol}`);
  }

  if (asset.market === "indonesia" || asset.exchange === "IDX") {
    const rows = await getYahooHistory(asset.yahoo || `${asset.symbol}.JK`, safeDays);
    if (rows.length) return setCached(key, rows);
    throw new Error(`No daily stock history found for ${asset.symbol}`);
  }

  const end = new Date();
  const start = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);
  const url = new URL("https://stooq.com/q/d/l/");
  url.searchParams.set("s", asset.stooq);
  url.searchParams.set("i", "d");
  url.searchParams.set("d1", dateToken(start));
  url.searchParams.set("d2", dateToken(end));
  try {
    const response = await fetchWithTimeout(url, { accept: "text/csv" });
    const rows = parseStooqCsv(await response.text());
    if (rows.length) return setCached(key, rows);
  } catch {
    // Yahoo is the fallback for stock history.
  }

  const rows = await getYahooHistory(asset.yahoo || asset.symbol.replace(".", "-"), safeDays);
  if (rows.length) return setCached(key, rows);
  throw new Error(`No daily stock history found for ${asset.symbol}`);
}

function mockAssets(market = "crypto", limit = 50) {
  if (market === "all") {
    return [
      ...mockAssets("crypto", limit),
      ...mockAssets("us", limit),
      ...mockAssets("indonesia", limit)
    ];
  }
  const base = market === "us" || market === "stocks"
    ? STOCKS
    : market === "indonesia" || market === "idx"
      ? INDONESIA_STOCKS
      : [
    { id: "bitcoin", symbol: "BTC", name: "Bitcoin", market: "crypto", tvCandidates: cryptoTvCandidates("BTC"), tvSymbol: cryptoTvSymbol("BTC") },
    { id: "ethereum", symbol: "ETH", name: "Ethereum", market: "crypto", tvCandidates: cryptoTvCandidates("ETH"), tvSymbol: cryptoTvSymbol("ETH") },
    { id: "solana", symbol: "SOL", name: "Solana", market: "crypto", tvCandidates: cryptoTvCandidates("SOL"), tvSymbol: cryptoTvSymbol("SOL") },
    { id: "ripple", symbol: "XRP", name: "XRP", market: "crypto", tvCandidates: cryptoTvCandidates("XRP"), tvSymbol: cryptoTvSymbol("XRP") }
  ];
  return Array.from({ length: Math.min(Number(limit) || 8, 100) }, (_, index) => {
    const template = base[index % base.length];
    return {
      ...template,
      id: `${template.id}-${index + 1}`,
      symbol: index < base.length ? template.symbol : `${template.symbol}${index + 1}`,
      name: index < base.length ? template.name : `${template.name} ${index + 1}`
    };
  });
}

function mockHistory(seed = 1, days = 420) {
  const rows = [];
  let price = 80 + seed * 7;
  for (let index = 0; index < days; index += 1) {
    const date = new Date(Date.now() - (days - index) * 24 * 60 * 60 * 1000);
    const wave = Math.sin(index / 18 + seed) * 3.5 + Math.sin(index / 55 + seed) * 8;
    const drift = index * 0.08;
    price = Math.max(2, price + Math.sin(index / 9 + seed) * 1.2 + 0.18);
    const close = price + wave + drift;
    rows.push({
      date: date.toISOString().slice(0, 10),
      open: close * 0.99,
      high: close * 1.015,
      low: close * 0.985,
      close,
      volume: 0
    });
  }
  return rows;
}

function zigZag(candles, thresholdPercent = 6) {
  if (!Array.isArray(candles) || candles.length < 20) return [];
  const threshold = Math.max(Number(thresholdPercent) || 6, 1) / 100;
  const first = candles[0];
  let trend = 0;
  let candidateIndex = 0;
  let candidatePrice = first.close;
  const pivots = [];

  for (let index = 1; index < candles.length; index += 1) {
    const price = candles[index].close;

    if (trend === 0) {
      const move = (price - candidatePrice) / candidatePrice;
      if (Math.abs(move) >= threshold) {
        trend = move > 0 ? 1 : -1;
        pivots.push({
          index: candidateIndex,
          date: candles[candidateIndex].date,
          price: candidatePrice,
          type: trend > 0 ? "low" : "high"
        });
        candidateIndex = index;
        candidatePrice = price;
      } else if (price < candidatePrice) {
        candidateIndex = index;
        candidatePrice = price;
      } else if (price > candidatePrice) {
        candidateIndex = index;
        candidatePrice = price;
      }
      continue;
    }

    if (trend > 0) {
      if (price > candidatePrice) {
        candidateIndex = index;
        candidatePrice = price;
      }
      if ((candidatePrice - price) / candidatePrice >= threshold) {
        pivots.push({
          index: candidateIndex,
          date: candles[candidateIndex].date,
          price: candidatePrice,
          type: "high"
        });
        trend = -1;
        candidateIndex = index;
        candidatePrice = price;
      }
      continue;
    }

    if (price < candidatePrice) {
      candidateIndex = index;
      candidatePrice = price;
    }
    if ((price - candidatePrice) / candidatePrice >= threshold) {
      pivots.push({
        index: candidateIndex,
        date: candles[candidateIndex].date,
        price: candidatePrice,
        type: "low"
      });
      trend = 1;
      candidateIndex = index;
      candidatePrice = price;
    }
  }

  const lastType = trend > 0 ? "high" : "low";
  const previous = pivots[pivots.length - 1];
  if (!previous || previous.index !== candidateIndex) {
    pivots.push({
      index: candidateIndex,
      date: candles[candidateIndex].date,
      price: candidatePrice,
      type: lastType,
      pending: true
    });
  }

  return pivots.filter((pivot, index, list) => index === 0 || pivot.index !== list[index - 1].index);
}

function percent(value) {
  if (!Number.isFinite(value)) return null;
  return Number((value * 100).toFixed(1));
}

function classifyWave(candles, pivots) {
  const close = candles.at(-1)?.close || 0;
  const lastDate = candles.at(-1)?.date;
  const base = {
    confidence: 0,
    direction: "neutral",
    phase: "Belum cukup struktur swing",
    status: "insufficient",
    close,
    lastDate,
    pivots: pivots.slice(-8),
    metrics: {},
    notes: ["Butuh minimal 6 pivot swing untuk membaca impuls 1-5."]
  };

  if (pivots.length < 6) {
    return base;
  }

  const last = pivots.slice(-6);
  const [p0, p1, p2, p3, p4, p5] = last;
  const bullish = p1.price > p0.price;
  const direction = bullish ? "bullish" : "bearish";
  const size = (from, to) => bullish ? to.price - from.price : from.price - to.price;
  const retrace = (from, to, against) => {
    const impulse = Math.abs(size(from, to));
    const pullback = Math.abs(size(to, against));
    return impulse > 0 ? pullback / impulse : 0;
  };

  const w1 = size(p0, p1);
  const w3 = size(p2, p3);
  const w5 = size(p4, p5);
  const r2 = retrace(p0, p1, p2);
  const r4 = retrace(p2, p3, p4);
  const waveLengths = [w1, w3, w5].filter((value) => value > 0);
  const alternating = last.every((pivot, index) => index === 0 || pivot.type !== last[index - 1].type);
  const noOverlap = bullish ? p4.price > p1.price : p4.price < p1.price;
  const wave5Break = bullish ? p5.price > p3.price : p5.price < p3.price;
  const wave3NotShortest = waveLengths.length === 3 && w3 >= Math.min(w1, w5);
  const recentPivot = candles.length - p5.index < Math.round(candles.length * 0.22);
  const currentBeyondWave5 = bullish ? close >= p5.price * 0.985 : close <= p5.price * 1.015;
  const currentPullback = bullish ? close < p5.price * 0.96 : close > p5.price * 1.04;

  let score = 10;
  const notes = [];

  if (alternating) score += 15;
  else notes.push("Pivot belum berselang-seling bersih.");

  if (r2 >= 0.382 && r2 <= 0.786) score += 18;
  else notes.push("Retracement wave 2 di luar area umum 38.2%-78.6%.");

  if (r4 >= 0.236 && r4 <= 0.5) score += 15;
  else notes.push("Retracement wave 4 di luar area umum 23.6%-50%.");

  if (w3 > w1) score += 14;
  else notes.push("Wave 3 belum lebih panjang dari wave 1.");

  if (wave3NotShortest) score += 12;
  else notes.push("Wave 3 berisiko menjadi wave terpendek.");

  if (noOverlap) score += 10;
  else notes.push("Wave 4 overlap dengan area wave 1.");

  if (wave5Break) score += 9;
  if (recentPivot) score += 5;
  if (currentBeyondWave5) score += 3;

  let phase = currentPullback
    ? "Kemungkinan koreksi ABC setelah wave 5"
    : wave5Break
      ? "Wave 5 / akhir impuls terdeteksi"
      : "Wave 5 belum mengonfirmasi break wave 3";

  if (!wave5Break && p5.pending) {
    phase = "Wave 5 masih berkembang";
  }

  return {
    confidence: Math.min(Math.max(Math.round(score), 0), 96),
    direction,
    phase,
    status: score >= 70 ? "impulse" : score >= 45 ? "watchlist" : "weak",
    close,
    lastDate,
    pivots: last,
    metrics: {
      wave1: Number(w1.toFixed(4)),
      wave3: Number(w3.toFixed(4)),
      wave5: Number(w5.toFixed(4)),
      wave2Retracement: percent(r2),
      wave4Retracement: percent(r4),
      noOverlap,
      wave5Break
    },
    notes: notes.length ? notes : ["Struktur memenuhi banyak aturan dasar impuls Elliott."]
  };
}

function analyzeAsset(asset, candles, threshold) {
  const pivots = zigZag(candles, threshold);
  const analysis = classifyWave(candles, pivots);
  const firstClose = candles[0]?.close;
  const lastClose = candles.at(-1)?.close;
  const change = firstClose && lastClose ? ((lastClose - firstClose) / firstClose) * 100 : 0;

  return {
    ...asset,
    close: lastClose || 0,
    change: Number(change.toFixed(2)),
    candles: candles.length,
    analysis
  };
}

function roundPrice(value) {
  if (!Number.isFinite(value)) return null;
  if (Math.abs(value) >= 100) return Number(value.toFixed(2));
  if (Math.abs(value) >= 1) return Number(value.toFixed(4));
  if (value === 0) return 0;
  return Number(value.toPrecision(8));
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function basicRangeForecast(candles) {
  const closes = candles.map((candle) => candle.close).filter(Number.isFinite);
  const recent = closes.slice(-120);
  const close = closes.at(-1) || 0;
  const high = Math.max(...recent);
  const low = Math.min(...recent);
  const range = Math.max(high - low, close * 0.05);
  const sma20 = average(closes.slice(-20));
  const sma50 = average(closes.slice(-50));
  const bullish = sma20 >= sma50;

  return {
    bullish,
    high,
    low,
    range,
    close
  };
}

function buildForecast(asset, candles, analysis) {
  const basic = basicRangeForecast(candles);
  const pivots = analysis.pivots || [];
  const enoughWave = pivots.length >= 6 && analysis.direction !== "neutral";
  const bullish = enoughWave ? analysis.direction === "bullish" : basic.bullish;
  const prices = enoughWave ? pivots.map((pivot) => pivot.price) : [];
  const swingHigh = enoughWave ? Math.max(...prices) : basic.high;
  const swingLow = enoughWave ? Math.min(...prices) : basic.low;
  const range = Math.max(swingHigh - swingLow, basic.range);
  const close = basic.close;

  const fib = bullish
    ? {
        retrace382: swingHigh - range * 0.382,
        retrace500: swingHigh - range * 0.5,
        retrace618: swingHigh - range * 0.618,
        retrace786: swingHigh - range * 0.786,
        extension1272: swingLow + range * 1.272,
        extension1618: swingLow + range * 1.618
      }
    : {
        retrace382: swingLow + range * 0.382,
        retrace500: swingLow + range * 0.5,
        retrace618: swingLow + range * 0.618,
        retrace786: swingLow + range * 0.786,
        extension1272: swingHigh - range * 1.272,
        extension1618: swingHigh - range * 1.618
      };

  const side = bullish ? "Long" : "Short";
  const entry = average([fib.retrace382, fib.retrace500]);
  const stop = fib.retrace786;
  const risk = Math.abs(entry - stop);
  const minimumReward = risk * 2;
  const extensionTarget = bullish ? fib.extension1272 : fib.extension1272;
  const rrTarget = bullish ? entry + minimumReward : entry - minimumReward;
  const rawTarget = bullish
    ? Math.max(extensionTarget, rrTarget)
    : Math.min(extensionTarget, rrTarget);
  const target = Math.max(0, rawTarget);
  const reward = Math.abs(target - entry);
  const riskReward = risk > 0 ? reward / risk : 0;
  const profitPercent = entry ? (reward / entry) * 100 : 0;
  const lossPercent = entry ? (risk / entry) * 100 : 0;
  const distanceToEntry = close ? Math.abs(close - entry) / close : 1;
  const isNearEntry = distanceToEntry <= 0.035;
  const setupZoneMin = Math.min(fib.retrace382, fib.retrace786);
  const setupZoneMax = Math.max(fib.retrace382, fib.retrace786);
  const isCurrentInSetupZone = close >= setupZoneMin && close <= setupZoneMax;
  const isChasing = bullish ? close > setupZoneMax : close < setupZoneMin;
  const isTradable = analysis.confidence >= 50 && risk > 0 && riskReward >= 2;
  const isCurrentlyIdeal = isTradable && isNearEntry && isCurrentInSetupZone;

  const entryDecision = isCurrentlyIdeal
    ? "Harga berada di zona setup yang layak dipantau. Tetap tunggu konfirmasi candle harian, validasi volume, dan eksekusi bertahap."
    : isChasing
      ? "Harga belum berada di area risk-reward ideal. Hindari mengejar harga dan tunggu reaksi di zona Fibonacci."
      : "Harga masih berada di area observasi. Validasi ulang struktur swing sebelum mengambil posisi.";

  const reversalFrom = Math.min(fib.retrace500, fib.retrace618);
  const reversalTo = Math.max(fib.retrace500, fib.retrace618);
  const rangePayload = (values) => {
    const clamped = values.map((value) => Math.max(0, value));
    return {
      from: roundPrice(Math.min(...clamped)),
      to: roundPrice(Math.max(...clamped))
    };
  };
  const topRange = bullish
    ? rangePayload([fib.extension1272, fib.extension1618])
    : rangePayload([fib.retrace500, fib.retrace618]);
  const bottomRange = bullish
    ? rangePayload([fib.retrace500, fib.retrace618])
    : rangePayload([fib.extension1272, fib.extension1618]);
  const tradeRationale = isTradable
    ? `Setup ${side} hanya layak dipertimbangkan jika harga bereaksi di area entry dan rasio reward terhadap risk tetap minimal 2:1.`
    : "Tidak ada setup trading aktif yang memenuhi standar probabilitas dan manajemen risiko. Sikap profesional saat ini adalah skip trade sampai struktur menjadi lebih jelas.";
  const structureText = enoughWave
    ? `Struktur swing terakhir menunjukkan bias ${bullish ? "bullish" : "bearish"} dengan fase ${analysis.phase.toLowerCase()}. Tingkat confidence berada di ${analysis.confidence}%, sehingga keputusan tetap perlu menunggu konfirmasi candle harian.`
    : `Struktur Elliott Wave belum lengkap. Bias sementara dibaca dari tren rata-rata bergerak dan range 120 candle terakhir, sehingga kualitas sinyal lebih rendah.`;
  const elliottText = [
    `Area Fibonacci utama berada pada retracement 0.5 di ${roundPrice(fib.retrace500)} dan 0.618 di ${roundPrice(fib.retrace618)}.`,
    bullish
      ? `Selama harga bertahan di atas area invalidasi ${roundPrice(fib.retrace786)}, skenario kenaikan menuju ekstensi 1.272-1.618 masih dapat dipantau.`
      : `Selama harga tertahan di bawah area invalidasi ${roundPrice(fib.retrace786)}, skenario penurunan menuju ekstensi 1.272-1.618 masih dapat dipantau.`
  ].join(" ");

  return {
    asset: `${asset.symbol} - ${asset.name}`,
    timeframe: "1D",
    bias: bullish ? "Bullish" : "Bearish",
    confidence: analysis.confidence,
    phase: analysis.phase,
    topPrediction: bullish
      ? {
          label: "Estimasi puncak berikutnya dari ekstensi 1.272-1.618",
          price: roundPrice(average([topRange.from, topRange.to]))
        }
      : {
          label: "Estimasi area retest sebelum potensi penurunan",
          price: roundPrice(average([topRange.from, topRange.to]))
        },
    bottomPrediction: bullish
      ? {
          label: "Estimasi bottom koreksi sehat 0.5-0.618",
          price: roundPrice(average([bottomRange.from, bottomRange.to]))
        }
      : {
          label: "Estimasi bottom berikutnya dari ekstensi 1.272-1.618",
          price: roundPrice(average([bottomRange.from, bottomRange.to]))
        },
    topRange,
    bottomRange,
    reversalPrediction: bullish
      ? {
          label: "Zona potensi pembalikan naik",
          from: roundPrice(reversalFrom),
          to: roundPrice(reversalTo)
        }
      : {
          label: "Zona potensi pembalikan turun",
          from: roundPrice(reversalFrom),
          to: roundPrice(reversalTo)
        },
    marketStructure: {
      label: bullish ? "Bullish" : "Bearish",
      text: structureText
    },
    elliottText,
    entryDecision,
    tradePlan: {
      action: isTradable ? side : "Skip trade",
      side,
      isTradable,
      isCurrentlyIdeal,
      entry: roundPrice(entry),
      takeProfit: roundPrice(target),
      stopLoss: roundPrice(stop),
      riskReward: Number(riskReward.toFixed(2)),
      minimumRiskReward: 2,
      profitPercent: Number(profitPercent.toFixed(2)),
      lossPercent: Number(lossPercent.toFixed(2)),
      rationale: tradeRationale
    },
    fibonacci: {
      swingHigh: roundPrice(swingHigh),
      swingLow: roundPrice(swingLow),
      fib382: roundPrice(fib.retrace382),
      fib500: roundPrice(fib.retrace500),
      fib618: roundPrice(fib.retrace618),
      fib786: roundPrice(fib.retrace786),
      ext1272: roundPrice(fib.extension1272),
      ext1618: roundPrice(fib.extension1618)
    },
    predictionPath: bullish
      ? [
          { label: "Swing low", price: roundPrice(swingLow), role: "support" },
          { label: "Zona entry", price: roundPrice(entry), role: "entry" },
          { label: "Target", price: roundPrice(target), role: "target" },
          { label: "Invalidasi", price: roundPrice(stop), role: "stop" }
        ]
      : [
          { label: "Swing high", price: roundPrice(swingHigh), role: "resistance" },
          { label: "Zona entry", price: roundPrice(entry), role: "entry" },
          { label: "Target", price: roundPrice(target), role: "target" },
          { label: "Invalidasi", price: roundPrice(stop), role: "stop" }
        ],
    notes: [
      enoughWave
        ? "Struktur memakai pivot Elliott Wave terakhir dari data harian."
        : "Pivot Elliott belum lengkap, jadi estimasi memakai range 120 candle dan SMA.",
      "Gunakan sebagai bahan riset, bukan rekomendasi transaksi otomatis."
    ]
  };
}

function analyzeFullAsset(asset, candles, threshold) {
  const result = analyzeAsset(asset, candles, threshold);
  return {
    asset,
    close: result.close,
    change: result.change,
    candles: result.candles,
    analysis: result.analysis,
    forecast: buildForecast(asset, candles, result.analysis)
  };
}

function percentValue(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function buildCryptoScreenRow(asset) {
  const close = Number(asset.currentPrice || asset.tvPrice || asset.close) || 0;
  const change24h = percentValue(asset.change24h);
  const change7d = percentValue(asset.change7d);
  const change30d = percentValue(asset.change30d);
  const trendScore = change30d * 0.5 + change7d * 0.35 + change24h * 0.15;
  const volatility = Math.max(Math.abs(change24h), Math.abs(change7d) / 2, Math.abs(change30d) / 4);
  const isStableLike = close > 0.85 && close < 1.15 && volatility < 2.5;
  const bullish = trendScore >= 0;
  const side = bullish ? "Long" : "Short";
  const confidence = isStableLike
    ? 28
    : Math.min(
        88,
        Math.max(
          42,
          Math.round(54 + Math.min(Math.abs(trendScore) * 1.35, 24) + (Math.sign(change7d) === Math.sign(change30d) ? 8 : 0))
        )
      );
  const tradable = !isStableLike && confidence >= 50;
  const isCurrentlyIdeal = tradable && Math.abs(change24h) <= 4.5 && Math.abs(change7d) <= 16;
  const riskPercent = Math.max(2.5, Math.min(9, volatility * 0.6));
  const rewardPercent = riskPercent * 2.2;
  const entry = close || 0;
  const stopLoss = bullish ? entry * (1 - riskPercent / 100) : entry * (1 + riskPercent / 100);
  const takeProfit = bullish ? entry * (1 + rewardPercent / 100) : entry * (1 - rewardPercent / 100);
  const topRange = bullish
    ? { from: roundPrice(entry * (1 + riskPercent / 100)), to: roundPrice(takeProfit) }
    : { from: roundPrice(stopLoss), to: roundPrice(entry * (1 + riskPercent / 200)) };
  const bottomRange = bullish
    ? { from: roundPrice(stopLoss), to: roundPrice(entry * (1 - riskPercent / 200)) }
    : { from: roundPrice(takeProfit), to: roundPrice(entry * (1 - riskPercent / 100)) };
  const sortedTopRange = {
    from: roundPrice(Math.min(topRange.from, topRange.to)),
    to: roundPrice(Math.max(topRange.from, topRange.to))
  };
  const sortedBottomRange = {
    from: roundPrice(Math.min(bottomRange.from, bottomRange.to)),
    to: roundPrice(Math.max(bottomRange.from, bottomRange.to))
  };
  const swingHigh = roundPrice(Math.max(sortedTopRange.from, sortedTopRange.to, entry, stopLoss, takeProfit));
  const swingLow = roundPrice(Math.min(sortedBottomRange.from, sortedBottomRange.to, entry, stopLoss, takeProfit));
  const fib500 = bullish ? sortedBottomRange.to : sortedTopRange.from;
  const fib618 = bullish ? sortedBottomRange.from : sortedTopRange.to;
  const fib786 = roundPrice(stopLoss);
  const ext1272 = roundPrice(takeProfit);

  return {
    asset,
    close,
    change: Number((change30d || change7d || change24h).toFixed(2)),
    candles: 0,
    analysis: {
      confidence,
      direction: bullish ? "bullish" : "bearish",
      phase: "Screening momentum CoinGecko",
      status: tradable ? "watchlist" : "insufficient",
      close,
      lastDate: asset.lastUpdated || new Date().toISOString(),
      pivots: [],
      metrics: {
        change24h: Number(change24h.toFixed(2)),
        change7d: Number(change7d.toFixed(2)),
        change30d: Number(change30d.toFixed(2))
      },
      notes: [
        "Halaman utama memakai data market CoinGecko agar screening cepat dan stabil.",
        "Buka detail aset untuk membaca struktur Elliott Wave dan Fibonacci dari histori 1D."
      ]
    },
    forecast: {
      asset: `${asset.symbol} - ${asset.name}`,
      timeframe: "Market screening",
      bias: bullish ? "Bullish" : "Bearish",
      confidence,
      phase: "Screening momentum CoinGecko",
      topRange: sortedTopRange,
      bottomRange: sortedBottomRange,
      marketStructure: {
        label: bullish ? "Bullish" : "Bearish",
        text: `Screening cepat membaca perubahan 24 jam, 7 hari, dan 30 hari dari CoinGecko. Bias sementara ${bullish ? "bullish" : "bearish"} dengan confidence ${confidence}%.`
      },
      elliottText: `Area Fibonacci screening berada pada retracement 0.5 di ${fib500} dan 0.618 di ${fib618}.`,
      entryDecision: isCurrentlyIdeal
        ? "Area saat ini layak dipantau, tetapi keputusan tetap perlu dikonfirmasi pada halaman detail."
        : "Belum ideal untuk eksekusi. Gunakan halaman detail untuk validasi struktur dan area harga.",
      tradePlan: {
        action: tradable ? side : "Skip trade",
        side,
        isTradable: tradable,
        isCurrentlyIdeal,
        entry: roundPrice(entry),
        takeProfit: roundPrice(takeProfit),
        stopLoss: roundPrice(stopLoss),
        riskReward: 2.2,
        minimumRiskReward: 2,
        profitPercent: Number(rewardPercent.toFixed(2)),
        lossPercent: Number(riskPercent.toFixed(2)),
        rationale: tradable
          ? `Screening awal hanya valid jika rasio reward terhadap risk minimal 2:1 dan dikonfirmasi pada halaman detail.`
          : "Aset tidak memenuhi standar awal untuk setup trading aktif."
      },
      fibonacci: {
        swingHigh,
        swingLow,
        fib382: roundPrice(entry),
        fib500,
        fib618,
        fib786,
        ext1272,
        ext1618: ext1272
      },
      predictionPath: bullish
        ? [
            { label: "Swing low", price: swingLow, role: "support" },
            { label: "Zona entry", price: roundPrice(entry), role: "entry" },
            { label: "Target", price: roundPrice(takeProfit), role: "target" },
            { label: "Invalidasi", price: roundPrice(stopLoss), role: "stop" }
          ]
        : [
            { label: "Swing high", price: swingHigh, role: "resistance" },
            { label: "Zona entry", price: roundPrice(entry), role: "entry" },
            { label: "Target", price: roundPrice(takeProfit), role: "target" },
            { label: "Invalidasi", price: roundPrice(stopLoss), role: "stop" }
          ]
    }
  };
}

function analysisDays(asset, days) {
  const maxDays = asset.market === "crypto" ? 365 : 1825;
  return Math.min(Math.max(Number(days) || 730, 120), maxDays);
}

function analysisCacheKey(asset, days, threshold) {
  return `analysis:${asset.market}:${asset.id}:${analysisDays(asset, days)}:${threshold}`;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getConsistentAnalysis(asset, days, threshold, options = {}) {
  const key = analysisCacheKey(asset, days, threshold);
  const cached = getCached(key);
  if (cached) return cached;

  try {
    const safeDays = analysisDays(asset, days);
    const candles = options.useMock ? mockHistory(options.mockIndex || 1, safeDays) : await getHistory(asset, safeDays);
    return setCached(key, {
      ...analyzeFullAsset(asset, candles, threshold),
      history: candles
    });
  } catch (error) {
    if (asset.market !== "crypto") throw error;
    const fallback = {
      ...buildCryptoScreenRow(asset),
      history: [],
      sourceWarning: `Histori CoinGecko belum tersedia: ${error.message}`
    };
    return setCached(key, fallback);
  }
}

async function mapLimit(items, limit, worker) {
  const results = [];
  let nextIndex = 0;
  async function run() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      try {
        results[index] = await worker(items[index], index);
      } catch (error) {
        results[index] = { item: items[index], error: error.message };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

function decodeXml(value = "") {
  return value
    .replaceAll("<![CDATA[", "")
    .replaceAll("]]>", "")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function stripTags(value = "") {
  return decodeXml(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function parseRssItems(xml, maxItems = 10) {
  return Array.from(xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)).slice(0, maxItems).map((match) => {
    const item = match[0];
    const pick = (tag) => decodeXml(item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1] || "");
    const sourceMatch = item.match(/<source[^>]*url="([^"]*)"[^>]*>([\s\S]*?)<\/source>/i);
    return {
      title: stripTags(pick("title")),
      link: stripTags(pick("link")),
      source: sourceMatch ? stripTags(sourceMatch[2]) : "",
      publishedAt: stripTags(pick("pubDate")),
      summary: stripTags(pick("description")).slice(0, 220)
    };
  }).filter((item) => item.title && item.link);
}

async function getNewsItems(asset, market, maxItems = 10) {
  const key = `news:${market}:${asset.id}:${maxItems}`;
  const cached = getCached(key);
  if (cached) return cached;

  const query = market === "crypto"
    ? `${asset.name} ${asset.symbol} crypto news market`
    : market === "indonesia"
      ? `${asset.name} ${asset.symbol} saham IDX dividen aksi korporasi`
      : `${asset.name} ${asset.symbol} stock earnings dividend corporate action`;
  const url = new URL("https://news.google.com/rss/search");
  url.searchParams.set("q", query);
  url.searchParams.set("hl", market === "indonesia" ? "id" : "en-US");
  url.searchParams.set("gl", market === "indonesia" ? "ID" : "US");
  url.searchParams.set("ceid", market === "indonesia" ? "ID:id" : "US:en");

  const response = await fetchWithTimeout(url, { accept: "application/rss+xml,text/xml" });
  const items = parseRssItems(await response.text(), maxItems);
  return setCached(key, items);
}

async function handleApi(req, res, url) {
  const path = url.pathname;
  const market = url.searchParams.get("market") || "crypto";
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 100), 1), 100);
  const days = Math.min(Math.max(Number(url.searchParams.get("days") || 730), 120), 1825);
  const threshold = Math.min(Math.max(Number(url.searchParams.get("threshold") || 6), 1), 20);
  const useMock = url.searchParams.get("mock") === "1";

  if (path === "/api/assets") {
    const assets = useMock ? mockAssets(market, limit) : await getAssets(market, limit);
    json(res, 200, { assets });
    return;
  }

  if (path === "/api/screen") {
    const page = Math.max(Number(url.searchParams.get("page") || 1), 1);
    const pageSize = Math.min(Math.max(Number(url.searchParams.get("pageSize") || 20), 1), 20);
    const startedAt = Date.now();
    const assets = useMock ? mockAssets(market, limit) : await getAssets(market, limit);
    const total = assets.length;
    const pages = Math.max(Math.ceil(total / pageSize), 1);
    const pageAssets = assets.slice((page - 1) * pageSize, page * pageSize);
    if (!useMock && market === "crypto") {
      const rows = await mapLimit(pageAssets, 1, async (asset, index) => {
        if (index > 0) await delay(650);
        const result = await getConsistentAnalysis(asset, Math.min(days, 365), threshold);
        const { history, ...screenRow } = result;
        return screenRow;
      });
      const results = rows.filter((row) => row && !row.error);
      const errors = rows.filter((row) => row?.error).map((row) => ({
        symbol: row.item?.symbol,
        message: row.error
      }));

      json(res, 200, {
        market,
        page,
        pageSize,
        total,
        pages,
        source: "CoinGecko 1D",
        elapsedMs: Date.now() - startedAt,
        results,
        errors
      });
      return;
    }
    const rows = await mapLimit(pageAssets, market === "crypto" ? 2 : 5, async (asset, index) => {
      const candles = useMock ? mockHistory(index + 1, Math.min(days, 365)) : await getHistory(asset, Math.min(days, 365));
      return analyzeFullAsset(asset, candles, threshold);
    });
    const results = rows.filter((row) => row && !row.error);
    const errors = rows.filter((row) => row?.error).map((row) => ({
      symbol: row.item?.symbol,
      message: row.error
    }));

    json(res, 200, {
      market,
      page,
      pageSize,
      total,
      pages,
      source: useMock ? "mock" : market === "crypto" ? "CoinGecko" : "Stooq/Yahoo",
      elapsedMs: Date.now() - startedAt,
      results,
      errors
    });
    return;
  }

  if (path === "/api/history") {
    const symbol = (url.searchParams.get("symbol") || "").toUpperCase();
    const id = (url.searchParams.get("id") || "").toLowerCase();
    const assets = useMock ? mockAssets(market, limit) : await getAssets(market, limit);
    let asset = assets.find((item) => item.id === id || item.symbol.toUpperCase() === symbol);
    if (!asset) {
      json(res, 404, { error: "Asset not found" });
      return;
    }
    const candles = useMock ? mockHistory(1, analysisDays(asset, days)) : await getHistory(asset, days);
    const result = analyzeFullAsset(asset, candles, threshold);
    json(res, 200, {
      asset,
      candles,
      analysis: result.analysis,
      forecast: result.forecast
    });
    return;
  }

  if (path === "/api/analyze") {
    const symbol = (url.searchParams.get("symbol") || "").toUpperCase();
    const id = (url.searchParams.get("id") || "").toLowerCase();
    const assets = useMock ? mockAssets(market, limit) : await getAssets(market, limit);
    let asset = assets.find((item) => item.id === id || item.symbol.toUpperCase() === symbol);
    if (!asset) {
      json(res, 404, { error: "Asset not found" });
      return;
    }
    json(res, 200, await getConsistentAnalysis(asset, days, threshold, { useMock, mockIndex: 1 }));
    return;
  }

  if (path === "/api/news") {
    const symbol = (url.searchParams.get("symbol") || "").toUpperCase();
    const id = (url.searchParams.get("id") || "").toLowerCase();
    const assets = useMock ? mockAssets(market, limit) : await getAssets(market, limit);
    const asset = assets.find((item) => item.id === id || item.symbol.toUpperCase() === symbol);
    if (!asset) {
      json(res, 404, { error: "Asset not found" });
      return;
    }
    const items = await getNewsItems(asset, market, 10);
    json(res, 200, { asset, items });
    return;
  }

  if (path === "/api/scan") {
    const startedAt = Date.now();
    const assets = useMock ? mockAssets(market, limit) : await getAssets(market, limit);
    const rows = await mapLimit(assets.slice(0, limit), market === "crypto" ? 3 : 6, async (asset, index) => {
      const candles = useMock ? mockHistory(index + 1, days) : await getHistory(asset, days);
      return analyzeAsset(asset, candles, threshold);
    });

    const results = rows
      .filter((row) => row && !row.error)
      .sort((a, b) => b.analysis.confidence - a.analysis.confidence);
    const errors = rows.filter((row) => row?.error).map((row) => ({
      symbol: row.item?.symbol,
      message: row.error
    }));

    json(res, 200, {
      market,
      limit,
      days,
      threshold,
      source: useMock ? "mock" : market === "crypto" ? "CoinGecko" : "Stooq",
      elapsedMs: Date.now() - startedAt,
      results,
      errors
    });
    return;
  }

  json(res, 404, { error: "Unknown API route" });
}

async function serveStatic(req, res, url) {
  const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const safePath = normalize(requested).replace(/^(\.\.[/\\])+/, "");
  const fullPath = join(PUBLIC_DIR, safePath);
  if (!fullPath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const content = await readFile(fullPath);
    res.writeHead(200, {
      "content-type": MIME_TYPES[extname(fullPath)] || "application/octet-stream"
    });
    res.end(content);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }
    await serveStatic(req, res, url);
  } catch (error) {
    json(res, 500, {
      error: error.message,
      hint: "Market data may be rate-limited or unavailable. Try again later or use ?mock=1 for a local demo."
    });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Elliott Wave Scanner running on port ${PORT}`);
});

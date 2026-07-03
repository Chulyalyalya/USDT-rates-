// Агрегатор курсов: /api/rates
// Собирает реальные источники (ЦБ РФ, Binance P2P, Bybit P2P, FX USD/RUB),
// а по остальным площадкам отдаёт демо-значения, ПРИВЯЗАННЫЕ к реальным якорям
// (real:false — фронт помечает их бейджем «демо»).
// Каждый источник изолирован: сбой одного не влияет на другие.
const { getCBR } = require("./lib/cbr");
const { getBinance } = require("./lib/binanceP2P");
const { getBybit } = require("./lib/bybitP2P");
const { getUsdRub } = require("./lib/fx");

// Демо-источники: фиксированный отступ от якоря + лёгкий шум.
// pair: "USD" | "USDT"; kind: "both" | "ref"
const DEMO = [
  { id: "investing",   pair: "USD",  off: -0.30, kind: "ref" },
  { id: "tokenspot",   pair: "USDT", off: +0.18, kind: "both", spread: 0.30 },
  { id: "alansary",    pair: "USD",  off: +0.15, kind: "both", spread: 0.25 },
  { id: "profinance",  pair: "USD",  off: -0.18, kind: "ref" },
  { id: "tradingview", pair: "USDT", off: +0.05, kind: "ref" },
  { id: "coinbase",    pair: "USDT", off: +0.55, kind: "both", spread: 0.40 },
  { id: "cryptocom",   pair: "USDT", off: +0.38, kind: "both", spread: 0.35 },
  { id: "gate",        pair: "USDT", off: +0.28, kind: "both", spread: 0.30 },
  { id: "mex",         pair: "USDT", off: +0.44, kind: "both", spread: 0.33 },
];

let cache = { ts: 0, data: null };

exports.handler = async () => {
  const now = Date.now();
  // кэш 4 сек: не дёргаем биржи на каждый запрос каждого пользователя
  if (cache.data && now - cache.ts < 4000) return json(cache.data);

  const sources = {};

  const [cbrR, binR, bybR, fxR] = await Promise.allSettled([
    getCBR(),
    getBinance(),
    getBybit(),
    getUsdRub(),
  ]);

  // --- ЦБ РФ (официальный) ---
  let cbr = null;
  if (cbrR.status === "fulfilled") {
    cbr = cbrR.value;
    sources.cbr = { buy: cbr, sell: cbr, ref: cbr, status: "active", real: true };
  } else {
    sources.cbr = { status: "error", real: true, error: String(cbrR.reason) };
  }

  // --- Binance P2P ---
  if (binR.status === "fulfilled") {
    const { buy, sell } = binR.value;
    sources.binance = { buy, sell, ref: (buy + sell) / 2, status: "active", real: true };
  } else {
    sources.binance = { status: "error", real: true, error: String(binR.reason) };
  }

  // --- Bybit P2P ---
  if (bybR.status === "fulfilled") {
    const { buy, sell } = bybR.value;
    sources.bybit = { buy, sell, ref: (buy + sell) / 2, status: "active", real: true };
  } else {
    sources.bybit = { status: "error", real: true, error: String(bybR.reason) };
  }

  // --- якоря для демо-источников ---
  const usdtReal = [sources.binance, sources.bybit]
    .filter((s) => s && s.status === "active")
    .map((s) => s.ref);
  const usdtAnchor = usdtReal.length
    ? usdtReal.reduce((a, b) => a + b, 0) / usdtReal.length
    : cbr
    ? cbr + 1.2
    : 79.2;
  const usdMarket = fxR.status === "fulfilled" ? fxR.value : cbr || 77.9;
  const usdAnchor = cbr || usdMarket;

  for (const d of DEMO) {
    const anchor = d.pair === "USDT" ? usdtAnchor : usdAnchor;
    const mid = anchor + d.off + (Math.random() - 0.5) * 0.06;
    const sp = d.spread || 0;
    sources[d.id] = {
      buy: d.kind === "both" ? mid - sp / 2 : mid,
      sell: d.kind === "both" ? mid + sp / 2 : mid,
      ref: mid,
      status: "active",
      real: false,
    };
  }

  const payload = {
    ts: now,
    market: { usdRub: usdMarket, usdtAnchor },
    sources,
  };
  cache = { ts: now, data: payload };
  return json(payload);
};

function json(obj) {
  return {
    statusCode: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
    },
    body: JSON.stringify(obj),
  };
}

// Агрегатор курсов: /api/rates
// Реальные источники:
//   • ЦБ РФ            — официальный USD/RUB
//   • Twelve Data      — рыночные USD/RUB и USDT/RUB (по ключу, если задан)
//   • FX + CoinGecko   — бесплатный резерв, если Twelve Data недоступен/исчерпан
//   • Bybit P2P        — российский P2P-курс USDT/RUB (best-effort)
// Демо-источники привязаны к реальным якорям (real:false → бейдж «демо»).
// Каждый источник изолирован: сбой одного не влияет на другие.
const { getCBR } = require("./lib/cbr");
const { getBybit } = require("./lib/bybitP2P");
const { getUsdRub } = require("./lib/fx");
const { getUsdtRub } = require("./lib/coingecko");
const { getMarket } = require("./lib/twelvedata");

// Демо-источники: фиксированный отступ от якоря + лёгкий шум.
const DEMO = [
  { id: "investing",  pair: "USD",  off: -0.30, kind: "ref" },
  { id: "tokenspot",  pair: "USDT", off: +0.18, kind: "both", spread: 0.30 },
  { id: "alansary",   pair: "USD",  off: +0.15, kind: "both", spread: 0.25 },
  { id: "profinance", pair: "USD",  off: -0.18, kind: "ref" },
  { id: "coinbase",   pair: "USDT", off: +0.55, kind: "both", spread: 0.40 },
  { id: "cryptocom",  pair: "USDT", off: +0.38, kind: "both", spread: 0.35 },
  { id: "gate",       pair: "USDT", off: +0.28, kind: "both", spread: 0.30 },
  { id: "mex",        pair: "USDT", off: +0.44, kind: "both", spread: 0.33 },
];

const median = (arr) => {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

function saneP2P(p, marketRef) {
  if (!p) return null;
  let { buy, sell } = p;
  if (!(buy > 0 && sell > 0)) return null;
  if (sell < buy) { const t = buy; buy = sell; sell = t; }
  let mid = (buy + sell) / 2;
  if (sell - buy > 1.5) { buy = mid - 0.4; sell = mid + 0.4; }
  if (marketRef && Math.abs(mid - marketRef) > 6) return null;
  return { buy, sell, ref: (buy + sell) / 2 };
}

let cache = { ts: 0, data: null };
const CACHE_MS = 10000; // 10 сек. На бесплатном Twelve Data увеличьте до 60000+, чтобы беречь кредиты.

exports.handler = async () => {
  const now = Date.now();
  if (cache.data && now - cache.ts < CACHE_MS) return json(cache.data);

  const sources = {};

  const [cbrR, bybR, fxR, cgR, tdR] = await Promise.allSettled([
    getCBR(),
    getBybit(),
    getUsdRub(),
    getUsdtRub(),
    getMarket(),
  ]);

  // --- ЦБ РФ (официальный USD/RUB) ---
  let cbr = null;
  if (cbrR.status === "fulfilled") {
    cbr = cbrR.value;
    sources.cbr = { buy: cbr, sell: cbr, ref: cbr, status: "active", real: true };
  } else {
    sources.cbr = { status: "error", real: true, error: String(cbrR.reason) };
  }

  // --- рыночные ориентиры: сперва Twelve Data, затем бесплатный резерв ---
  const td = tdR.status === "fulfilled" ? tdR.value : null;
  const fxUsd = fxR.status === "fulfilled" ? fxR.value : null;
  const cgUsdt = cgR.status === "fulfilled" ? cgR.value : null;

  const usdMarket = (td && td.usd) || fxUsd || cbr || 77.9;   // рыночный USD/RUB
  const usdtMarket = (td && td.usdt) || cgUsdt || null;       // рыночный USDT/RUB
  const marketSrc = td && (td.usd || td.usdt) ? "twelvedata" : "free-fallback";

  // --- TradingView = рыночный USDT/RUB ---
  if (usdtMarket) {
    sources.tradingview = { buy: usdtMarket, sell: usdtMarket, ref: usdtMarket, status: "active", real: true };
  } else {
    sources.tradingview = { status: "error", real: true, error: "рыночный USDT/RUB недоступен" };
  }

  // --- CoinGecko = независимый рыночный USDT/RUB ---
  if (cgUsdt) {
    sources.coingecko = { buy: cgUsdt, sell: cgUsdt, ref: cgUsdt, status: "active", real: true };
  } else {
    sources.coingecko = { status: "error", real: true, error: "CoinGecko недоступен" };
  }

  // --- Bybit P2P (с проверкой вменяемости относительно рыночного USDT) ---
  const bybSane = bybR.status === "fulfilled" ? saneP2P(bybR.value, usdtMarket) : null;
  if (bybSane) {
    sources.bybit = { ...bybSane, status: "active", real: true };
  } else {
    sources.bybit = {
      status: "error", real: true,
      error: bybR.status === "fulfilled" ? "недостоверные данные" : String(bybR.reason),
    };
  }

  // --- якоря для демо-источников ---
  const usdtReal = [bybSane].filter(Boolean).map((s) => s.ref);
  const usdtAnchor = usdtReal.length ? median(usdtReal) : usdtMarket ? usdtMarket : cbr ? cbr + 1.2 : 79.2;
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
    market: { usdRub: usdMarket, usdtMarket, source: marketSrc },
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

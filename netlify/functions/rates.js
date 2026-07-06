// Агрегатор курсов: /api/rates
// Реальные источники:
//   • ЦБ РФ            — официальный USD/RUB
//   • Twelve Data      — рыночные USD/RUB и USDT/RUB (по ключу)
//   • open.er-api      — рыночный USD/RUB (Investing)
//   • exchangerate.fun — рыночный USD/RUB (Profinance)
//   • CoinGecko        — рыночный USDT/RUB
//   • Bybit P2P        — российский P2P USDT/RUB
// Демо-источники привязаны к реальным якорям (real:false → бейдж «демо»).
// Каждый источник изолирован: сбой одного не влияет на другие.
const { getCBR } = require("./lib/cbr");
const { getBybit } = require("./lib/bybitP2P");
const { getUsdRub } = require("./lib/fx");           // open.er-api
const { getUsdRubFun } = require("./lib/fxfun");     // exchangerate.fun
const { getUsdtRub } = require("./lib/coingecko");
const { getMarket } = require("./lib/twelvedata");

// Остаются демо (нет публичного API к рублю): tokenspot, coinbase, cryptocom, gate, mex
const DEMO = [
  { id: "tokenspot", pair: "USDT", off: +0.18, kind: "both", spread: 0.30 },
  { id: "coinbase",  pair: "USDT", off: +0.55, kind: "both", spread: 0.40 },
  { id: "cryptocom", pair: "USDT", off: +0.38, kind: "both", spread: 0.35 },
  { id: "gate",      pair: "USDT", off: +0.28, kind: "both", spread: 0.30 },
  { id: "mex",       pair: "USDT", off: +0.44, kind: "both", spread: 0.33 },
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

function demoSource(anchor, off, spread, kind) {
  const mid = anchor + off + (Math.random() - 0.5) * 0.06;
  const sp = spread || 0;
  return {
    buy: kind === "both" ? mid - sp / 2 : mid,
    sell: kind === "both" ? mid + sp / 2 : mid,
    ref: mid, status: "active", real: false,
  };
}
const real1 = (v) => ({ buy: v, sell: v, ref: v, status: "active", real: true });

let cache = { ts: 0, data: null };
const CACHE_MS = 10000; // 10 сек. На бесплатном Twelve Data увеличьте до 60000+, чтобы беречь кредиты.

exports.handler = async () => {
  const now = Date.now();
  if (cache.data && now - cache.ts < CACHE_MS) return json(cache.data);

  const sources = {};

  const [cbrR, bybR, fxR, funR, cgR, tdR] = await Promise.allSettled([
    getCBR(),
    getBybit(),
    getUsdRub(),      // open.er-api USD/RUB
    getUsdRubFun(),   // exchangerate.fun USD/RUB
    getUsdtRub(),     // CoinGecko USDT/RUB
    getMarket(),      // Twelve Data USD/RUB + USDT/RUB
  ]);

  // --- ЦБ РФ (официальный USD/RUB) ---
  let cbr = null;
  if (cbrR.status === "fulfilled") {
    cbr = cbrR.value;
    sources.cbr = real1(cbr);
  } else {
    sources.cbr = { status: "error", real: true, error: String(cbrR.reason) };
  }

  // --- значения фидов ---
  const td = tdR.status === "fulfilled" ? tdR.value : null;
  const erUsd = fxR.status === "fulfilled" ? fxR.value : null;    // open.er-api
  const funUsd = funR.status === "fulfilled" ? funR.value : null; // exchangerate.fun
  const tdUsd = td && td.usd ? td.usd : null;
  const cgUsdt = cgR.status === "fulfilled" ? cgR.value : null;
  const tdUsdt = td && td.usdt ? td.usdt : null;

  const usdMarket = tdUsd || erUsd || funUsd || cbr || 77.9;
  const usdtMarket = tdUsdt || cgUsdt || null;
  const usdAnchor = cbr || usdMarket;
  const marketSrc = td && (td.usd || td.usdt) ? "twelvedata" : "free-fallback";

  // --- РЕАЛЬНЫЕ рыночные USD/RUB по отдельным фидам ---
  sources.investing  = erUsd  ? real1(erUsd)  : demoSource(usdAnchor, -0.30, 0, "ref");
  sources.profinance = funUsd ? real1(funUsd) : demoSource(usdAnchor, -0.18, 0, "ref");
  sources.alansary   = tdUsd  ? real1(tdUsd)  : demoSource(usdAnchor, +0.15, 0.25, "both");

  // --- рыночный USDT/RUB ---
  sources.tradingview = usdtMarket ? real1(usdtMarket) : { status: "error", real: true, error: "рыночный USDT/RUB недоступен" };
  sources.coingecko   = cgUsdt     ? real1(cgUsdt)     : { status: "error", real: true, error: "CoinGecko недоступен" };

  // --- Bybit P2P ---
  const bybSane = bybR.status === "fulfilled" ? saneP2P(bybR.value, usdtMarket) : null;
  sources.bybit = bybSane
    ? { ...bybSane, status: "active", real: true }
    : { status: "error", real: true, error: bybR.status === "fulfilled" ? "недостоверные данные" : String(bybR.reason) };

  // --- якорь для оставшихся демо USDT ---
  const usdtReal = [bybSane].filter(Boolean).map((s) => s.ref);
  const usdtAnchor = usdtReal.length ? median(usdtReal) : usdtMarket ? usdtMarket : cbr ? cbr + 1.2 : 79.2;

  for (const d of DEMO) {
    const anchor = d.pair === "USDT" ? usdtAnchor : usdAnchor;
    sources[d.id] = demoSource(anchor, d.off, d.spread, d.kind);
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

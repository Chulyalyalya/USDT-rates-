// Источник: Binance P2P — реальные курсы USDT/RUB (покупка/продажа).
// ВНИМАНИЕ: это НЕофициальный внутренний эндпоинт p2p-раздела Binance.
// Он публичный, но не гарантируется биржей: формат/доступность могут меняться,
// возможна гео-блокировка запросов из некоторых регионов (в т.ч. дата-центров).
// Поэтому вызовы обёрнуты в try/catch на уровне агрегатора — сбой не ломает сайт.
const { fetchJSON } = require("./util");

const URL = "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search";

// tradeType: "BUY"  — объявления, по которым тейкер ПОКУПАЕТ USDT (цена покупки)
//            "SELL" — объявления, по которым тейкер ПРОДАЁТ USDT (цена продажи)
async function side(tradeType) {
  const body = {
    fiat: "RUB",
    page: 1,
    rows: 8,
    tradeType,
    asset: "USDT",
    payTypes: [],
    publisherType: null,
  };
  const j = await fetchJSON(
    URL,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "user-agent": "Mozilla/5.0 (compatible; RateMonitor/1.0)",
      },
      body: JSON.stringify(body),
    },
    7000
  );
  const prices = (j && j.data ? j.data : [])
    .map((d) => parseFloat(d && d.adv && d.adv.price))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  if (!prices.length) throw new Error("Binance P2P: пустой ответ");
  // берём медиану топ-объявлений, чтобы отсечь единичные выбросы
  return prices[Math.floor(prices.length / 2)];
}

async function getBinance() {
  const [buy, sell] = await Promise.all([side("BUY"), side("SELL")]);
  return { buy, sell };
}
module.exports = { getBinance };

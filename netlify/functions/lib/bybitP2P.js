// Источник: Bybit P2P — реальные курсы USDT/RUB (покупка/продажа).
// ВНИМАНИЕ: НЕофициальный внутренний эндпоинт p2p-раздела Bybit (api2.bybit.com).
// Публичный, но не гарантируется биржей; возможна гео-блокировка из ЦОД.
// Сбой изолируется на уровне агрегатора.
//
// side в API Bybit OTC: "0" и "1". Соответствие «покупка/продажа» на разных
// площадках трактуется по-разному. Если в интерфейсе покупка/продажа окажутся
// перепутаны — просто поменяйте местами аргументы в getBybit() ниже.
const { fetchJSON } = require("./util");

const URL = "https://api2.bybit.com/fiat/otc/item/online";

async function side(sideCode) {
  const body = {
    tokenId: "USDT",
    currencyId: "RUB",
    payment: [],
    side: sideCode,
    size: "8",
    page: "1",
    amount: "",
    authMaker: false,
    canTrade: false,
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
  const items = (j && j.result && j.result.items) || [];
  const prices = items
    .map((i) => parseFloat(i && i.price))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  if (!prices.length) throw new Error("Bybit P2P: пустой ответ");
  return prices[Math.floor(prices.length / 2)];
}

async function getBybit() {
  // side "1" — цена, по которой пользователь покупает USDT
  // side "0" — цена, по которой пользователь продаёт USDT
  const [buy, sell] = await Promise.all([side("1"), side("0")]);
  return { buy, sell };
}
module.exports = { getBybit };

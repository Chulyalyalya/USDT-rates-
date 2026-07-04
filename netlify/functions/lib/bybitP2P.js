// Источник: Bybit P2P — реальные курсы USDT/RUB (покупка/продажа).
// НЕофициальный внутренний эндпоинт p2p-раздела Bybit (api2.bybit.com).
// Публичный, но не гарантируется биржей; данные по сторонам сделки бывают
// «шумными», поэтому агрегатор дополнительно проверяет вменяемость спреда.
const { fetchJSON } = require("./util");

const URL = "https://api2.bybit.com/fiat/otc/item/online";

// side "1" — тейкер ПОКУПАЕТ USDT (берём лучшую = наименьшую цену)
// side "0" — тейкер ПРОДАЁТ USDT  (берём лучшую = наибольшую цену)
async function bestSide(sideCode) {
  const body = {
    tokenId: "USDT",
    currencyId: "RUB",
    payment: [],
    side: sideCode,
    size: "10",
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
        origin: "https://www.bybit.com",
        referer: "https://www.bybit.com/",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
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
  return sideCode === "1" ? prices[0] : prices[prices.length - 1];
}

async function getBybit() {
  const [buy, sell] = await Promise.all([bestSide("1"), bestSide("0")]);
  return { buy, sell };
}
module.exports = { getBybit };

// Источник: CoinGecko — реальный рыночный курс USDT/RUB.
// Публичный бесплатный API, стабильно работает с любого сервера (без гео-блокировок),
// в отличие от P2P-эндпоинтов бирж. Даёт рыночную цену (не P2P-премию).
const { fetchJSON } = require("./util");

async function getUsdtRub() {
  const j = await fetchJSON(
    "https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=rub",
    { headers: { accept: "application/json" } },
    6000
  );
  const rub = j && j.tether && j.tether.rub;
  if (!rub) throw new Error("CoinGecko: нет USDT/RUB");
  return Number(rub);
}
module.exports = { getUsdtRub };

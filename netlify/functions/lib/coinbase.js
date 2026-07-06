// Источник: Coinbase — курс USDT/RUB через публичный API конвертации (без ключа).
// api.coinbase.com/v2/exchange-rates?currency=USDT отдаёт таблицу курсов USDT
// ко множеству валют, включая RUB. Это реальный курс от Coinbase.
const { fetchJSON } = require("./util");

async function getCoinbaseUsdtRub() {
  const j = await fetchJSON(
    "https://api.coinbase.com/v2/exchange-rates?currency=USDT",
    { headers: { accept: "application/json" } },
    6000
  );
  const rub = j && j.data && j.data.rates && j.data.rates.RUB;
  if (!rub) throw new Error("Coinbase: нет RUB");
  return Number(rub);
}
module.exports = { getCoinbaseUsdtRub };

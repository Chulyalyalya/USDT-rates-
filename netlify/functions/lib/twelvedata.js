// Источник: Twelve Data — рыночные курсы USD/RUB и USDT/RUB одним запросом.
// Ключ берётся из переменной окружения TWELVEDATA_KEY (в код НЕ вписываем).
// Бесплатный тариф ограничен по кредитам — при исчерпании Twelve Data вернёт
// ошибку/лимит, и агрегатор мягко откатится на бесплатные CoinGecko/FX.
const { fetchJSON } = require("./util");

async function getMarket() {
  const key = process.env.TWELVEDATA_KEY;
  if (!key) throw new Error("нет TWELVEDATA_KEY");

  const url =
    "https://api.twelvedata.com/price?symbol=" +
    encodeURIComponent("USD/RUB,USDT/RUB") +
    "&apikey=" +
    key;

  const j = await fetchJSON(url, { headers: { accept: "application/json" } }, 6000);

  // общий сбой/лимит: {"code":429,"status":"error",...}
  if (j && j.status === "error") {
    throw new Error("TwelveData: " + (j.message || j.code || "error"));
  }

  const pick = (v) => (v && v.price != null ? Number(v.price) : null);

  let usd = null;
  let usdt = null;
  if (j && (j["USD/RUB"] || j["USDT/RUB"])) {
    usd = pick(j["USD/RUB"]);
    usdt = pick(j["USDT/RUB"]);
  } else if (j && j.price != null) {
    usd = Number(j.price);
  }

  if (usd == null && usdt == null) throw new Error("TwelveData: пустой ответ");
  return { usd, usdt };
}
module.exports = { getMarket };

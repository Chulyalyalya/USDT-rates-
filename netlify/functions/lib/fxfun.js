// Источник: exchangerate.fun (проект FreeExchangeRateApi) — рыночный USD/RUB.
// Без ключа и регистрации, обновление раз в час, RUB присутствует.
// Используется как независимый реальный фид для карточки Profinance.
const { fetchJSON } = require("./util");

async function getUsdRubFun() {
  const j = await fetchJSON(
    "https://api.exchangerate.fun/latest?base=USD",
    { headers: { accept: "application/json" } },
    6000
  );
  const rub = j && j.rates && j.rates.RUB;
  if (!rub) throw new Error("exchangerate.fun: нет RUB");
  return Number(rub);
}
module.exports = { getUsdRubFun };

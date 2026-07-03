// Рыночный ориентир USD/RUB из открытого бесплатного FX-API (без ключа).
// Используется как «якорь» для демо-источников по паре USD/RUB, если по ним
// нет собственного фида. Само по себе — реальное значение.
const { fetchJSON } = require("./util");

async function getUsdRub() {
  const j = await fetchJSON("https://open.er-api.com/v6/latest/USD", {}, 6000);
  const rub = j && j.rates && j.rates.RUB;
  if (!rub) throw new Error("FX: нет RUB");
  return Number(rub);
}
module.exports = { getUsdRub };

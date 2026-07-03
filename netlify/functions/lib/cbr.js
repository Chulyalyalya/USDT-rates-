// Источник: ЦБ РФ — официальный справочный курс USD/RUB.
// Открытый API, стабилен, CORS-дружелюбен.
const { fetchJSON } = require("./util");

async function getCBR() {
  const j = await fetchJSON("https://www.cbr-xml-daily.ru/daily_json.js", {}, 6000);
  const usd = j && j.Valute && j.Valute.USD && j.Valute.USD.Value;
  if (!usd) throw new Error("CBR: нет значения USD");
  return Number(usd);
}
module.exports = { getCBR };

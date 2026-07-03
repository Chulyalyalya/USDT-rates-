// Небольшая обёртка над fetch с таймаутом (Node 18+, global fetch).
async function fetchJSON(url, opts = {}, ms = 6000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { ...opts, signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status} @ ${url}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}
module.exports = { fetchJSON };

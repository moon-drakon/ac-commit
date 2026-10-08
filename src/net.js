// A "net" is { text(url, opts), json(url, opts) }. Platforms only talk to judges through it,
// so the same code runs from the worker, from a judge tab, or from Node tests.
export function checkResponse(url, status, body) {
  if (/just a moment|challenge-platform|cf-chl/i.test(body) && status >= 400) {
    throw Object.assign(new Error(`Cloudflare check is showing on ${new URL(url).host}. Open the site and wait for it to pass.`), { status });
  }
  if (status >= 400) {
    throw Object.assign(new Error(`HTTP ${status} from ${new URL(url).host}${new URL(url).pathname}`), { status, body });
  }
  return body;
}

export function fetchNet(fetchImpl = fetch) {
  const text = async (url, opts = {}) => {
    const res = await fetchImpl(url, { method: opts.method || 'GET', headers: opts.headers, body: opts.body });
    return checkResponse(url, res.status, await res.text());
  };
  return { text, json: async (url, opts) => JSON.parse(await text(url, opts)) };
}

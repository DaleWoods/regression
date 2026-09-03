// Link checking with a global cache so each distinct URL is only probed once
// per scan, no matter how many pages link to it.
import { pLimit } from './util.js';
import { USER_AGENT, config } from './config.js';

export class LinkChecker {
  constructor({ concurrency = config.linkConcurrency, timeoutMs = 10000 } = {}) {
    this.cache = new Map(); // url -> Promise<{url, ok, status?, detail?}>
    this.limit = pLimit(concurrency);
    this.timeoutMs = timeoutMs;
  }

  check(url) {
    if (!this.cache.has(url)) {
      this.cache.set(
        url,
        this.limit(() => this.#probe(url)).catch((e) => ({
          url,
          ok: false,
          detail: String(e?.message || e),
        }))
      );
    }
    return this.cache.get(url);
  }

  async #attempt(url, method) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        redirect: 'follow',
        headers: { 'user-agent': USER_AGENT, accept: '*/*' },
        signal: ctrl.signal,
      });
      try {
        await res.body?.cancel?.();
      } catch {
        /* body already consumed/closed */
      }
      return res.status;
    } finally {
      clearTimeout(timer);
    }
  }

  async #probe(url) {
    try {
      let status = await this.#attempt(url, 'HEAD');
      // Some servers reject HEAD (or bot-block it) — confirm with GET.
      if ([403, 405, 501].includes(status)) status = await this.#attempt(url, 'GET');
      return { url, ok: status < 400, status };
    } catch {
      try {
        const status = await this.#attempt(url, 'GET');
        return { url, ok: status < 400, status };
      } catch (e) {
        return { url, ok: false, detail: e?.cause?.code || e?.message || 'request failed' };
      }
    }
  }
}

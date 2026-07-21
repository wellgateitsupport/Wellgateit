// browser-global shims สำหรับรัน binSync.js/core.jsx ใน node:test
// (ถูก inject โดย esbuild ใน scripts/bundle-for-tests.mjs — แทนที่ free variables)
const mem = new Map();

export const localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => { mem.set(k, String(v)); },
  removeItem: (k) => { mem.delete(k); },
  clear: () => { mem.clear(); },
};

export const location = {
  origin: 'http://localhost', protocol: 'http:', pathname: '/', hash: '', search: '', href: 'http://localhost/',
};

export class CustomEvent {
  constructor(type, opts) { this.type = type; this.detail = opts && opts.detail; }
}

export const navigator = { onLine: true, userAgent: 'node-test' };

export const document = {
  documentElement: { setAttribute() {}, getAttribute: () => null },
  addEventListener() {}, removeEventListener() {},
  createElement: () => ({ style: {}, setAttribute() {}, click() {} }),
  body: { appendChild() {}, removeChild() {} },
};

export const window = {
  localStorage, location, navigator, document, CustomEvent,
  addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
  setTimeout, clearTimeout,
};

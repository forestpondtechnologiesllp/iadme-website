import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../reel-shop-admin.js", import.meta.url), "utf8");
class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.style = {}; this.listeners = {}; this.value = ""; this.disabled = false; }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children = items; }
  addEventListener(event, handler) { this.listeners[event] = handler; }
  dispatch(event = "click") { return this.listeners[event]?.(); }
  set innerHTML(_) { throw new Error("Admin data must not become executable HTML"); }
}
const flush = async () => { for (let i = 0; i < 5; i++) await new Promise(setImmediate); };
function harness(reply) {
  const elements = new Map();
  const get = (id) => { if (!elements.has(id)) elements.set(id, new Element(id)); return elements.get(id); };
  const config = { baseUrl: "http://localhost:3000", token: "test-token" };
  const requests = [];
  const document = { getElementById: get, createElement: (tag) => new Element(tag) };
  vm.runInNewContext(source, { document, URL, Date, getConfig: () => ({ ...config }), encodeURIComponent,
    requestAdminApi: async (path, options) => { requests.push({ path, options, target: config.baseUrl }); return reply(path, options); } });
  return { get, config, requests };
}
const product = { id: "abc", title: '<img src=x onerror="alert(1)">', source_url: "https://amzn.to/abc",
  status: "ready", enabled: true, image_url: "https://m.media-amazon.com/images/I/primary.jpg",
  expires_at: new Date(Date.now() + 3600000).toISOString() };
const catalog = (products = [product]) => ({ environment: "dev", settings: { enabled: true, worker_seen_at: new Date().toISOString() }, products });

test("renders ready stamp preview and Shop underneath, with text-only product titles", async () => {
  const h = harness(() => catalog()); await h.get("loadReelShopBtn").dispatch();
  assert.equal(h.get("reelShopEditor").disabled, false);
  const row = h.get("reelShopRows").children[0];
  assert.equal(row.children[0].children[0].tag, "img");
  assert.equal(row.children[0].children[0].style.cssText.includes("width:80px;height:80px"), true);
  assert.equal(row.children[0].children[1].textContent, "Shop ↗");
  assert.equal(row.children[1].children[0].textContent, product.title);
});
test("queues links and exposes per-product monthly renewal, expiry and removal", async () => {
  const h = harness((path, options) => options ? {} : catalog());
  await h.get("loadReelShopBtn").dispatch();
  h.get("reelProductUrls").value = "https://amzn.to/one\nhttps://amzn.to/two";
  h.get("queueReelProductsBtn").dispatch(); await flush();
  const write = h.requests.find((r) => r.path === "/admin/reel-shop/products");
  assert.deepEqual(JSON.parse(write.options.body), { urls: ["https://amzn.to/one", "https://amzn.to/two"] });
  assert.equal(h.get("reelProductUrls").value, "");
  assert.deepEqual(Array.from(h.get("reelShopRows").children[0].children.at(-1).children, (b) => b.textContent),
    ["Renew for 1 month", "Mark expired", "Remove"]);
  for (let i = 0; i < 3; i++) {
    const row = h.get("reelShopRows").children[0];
    await row.children.at(-1).children[i].dispatch(); await flush();
  }
  assert.deepEqual(h.requests.filter((r) => r.path.endsWith("/abc")).map((r) => JSON.parse(r.options.body).action), ["retry", "disable", "remove"]);
});
test("explicit expired DB status hides a product with a future expiry date", async () => {
  const h = harness(() => catalog([{ ...product, status: "expired" }]));
  await h.get("loadReelShopBtn").dispatch();
  const row = h.get("reelShopRows").children[0];
  assert.equal(row.children.length, 2);
  assert.match(row.children[0].children[2].textContent, /^Expired/);
});
test("changing environment invalidates reads and prevents writing loaded products to another server", async () => {
  let resolveRead;
  const h = harness(() => new Promise((resolve) => { resolveRead = resolve; }));
  const loading = h.get("loadReelShopBtn").dispatch();
  h.config.baseUrl = "https://api.iadme.app"; h.get("adminEnv").dispatch("input");
  resolveRead(catalog()); await loading;
  assert.equal(h.get("reelShopEditor").disabled, true);
  h.get("saveReelShopBtn").dispatch(); await flush();
  assert.equal(h.requests.length, 1);
  assert.match(h.get("reelShopStatus").textContent, /Load products again/);
});
test("expired products have no preview and a block explains the paused worker", async () => {
  const result = catalog([{ ...product, expires_at: new Date(0).toISOString() }]);
  result.settings.blocked_until = new Date(Date.now() + 86400000).toISOString();
  const h = harness(() => result); await h.get("loadReelShopBtn").dispatch();
  assert.equal(h.get("reelShopRows").children[0].children.length, 2);
  assert.match(h.get("reelShopStatus").textContent, /URL fetching paused/);
});

test("imported images use the selected API and do not report a missing fetching worker", async () => {
  const path = `/affiliate-ads/images/${'a'.repeat(64)}`;
  const result = catalog([{ ...product, source_kind: "asset", image_url: path }]);
  result.settings.worker_seen_at = null;
  const h = harness(() => result); await h.get("loadReelShopBtn").dispatch();
  const image = h.get("reelShopRows").children[0].children[0].children[0];
  assert.equal(image.src, `http://localhost:3000${path}`);
  assert.match(h.get("reelShopStatus").textContent, /do not need a fetching worker/);
  assert.doesNotMatch(h.get("reelShopStatus").textContent, /not reporting/);
});

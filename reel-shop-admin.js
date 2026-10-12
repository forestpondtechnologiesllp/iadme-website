/* Uses the existing admin authentication and selected API environment. */
(() => {
  const element = (id) => document.getElementById(id);
  const editor = element("reelShopEditor");
  if (!editor) return;
  let loadedTarget = null;
  let generation = 0;
  const status = element("reelShopStatus");
  const targetKey = () => { const config = getConfig(); return `${config.baseUrl}\n${config.token}`; };
  const assertTarget = () => {
    if (!loadedTarget || targetKey() !== loadedTarget) throw new Error("Load products again after changing the environment or signing in.");
  };
  const date = (value) => value ? new Date(value).toLocaleString() : "Not yet";
  function previewUrl(value) {
    try {
      if (/^\/affiliate-ads\/images\/[a-f0-9]{64}$/.test(value)) {
        return new URL(value, getConfig().baseUrl);
      }
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password && !url.port && !url.hash
        && url.hostname === "m.media-amazon.com" && url.pathname.startsWith("/images/I/") ? url : null;
    } catch { return null; }
  }

  function renderProduct(product) {
    const row = document.createElement("article");
    row.style.cssText = "display:flex;flex-wrap:wrap;align-items:center;gap:14px;padding:14px;border:1px solid #cbd5e1;border-radius:10px;";
    const expired = product.status === "expired" || new Date(product.expires_at).getTime() <= Date.now();
    if (product.status === "ready" && product.enabled && !expired && product.image_url) {
      const url = previewUrl(product.image_url);
      if (url) {
        const preview = document.createElement("div");
        preview.style.cssText = "width:80px;text-align:center;background:white;color:#111;border:1px solid #ddd;border-radius:8px;overflow:hidden;";
        const image = document.createElement("img");
        image.src = url.href; image.alt = product.title || "Product"; image.loading = "lazy";
        image.referrerPolicy = "no-referrer";
        image.style.cssText = "display:block;width:80px;height:80px;object-fit:contain;";
        image.addEventListener("error", () => { preview.textContent = "Image unavailable"; });
        const shop = document.createElement("div"); shop.textContent = "Shop ↗"; shop.style.padding = "6px";
        preview.append(image, shop); row.append(preview);
      }
    }
    const details = document.createElement("div");
    details.style.cssText = "flex:1;min-width:220px;overflow-wrap:anywhere;";
    const title = document.createElement("strong"); title.textContent = product.title || "Product awaiting preparation";
    const link = document.createElement("p"); link.textContent = product.source_url;
    const state = document.createElement("p");
    state.textContent = `${expired ? "Expired" : !product.enabled ? "Disabled" : product.status} · ${product.source_kind === "asset" ? "Imported image" : "URL preparation"} · Expires ${date(product.expires_at)}${product.error_code ? ` · ${product.error_code}` : ""}`;
    details.append(title, link, state); row.append(details);
    const buttons = document.createElement("div"); buttons.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;";
    for (const [action, label] of [["retry", "Renew for 1 month"], ["disable", "Mark expired"], ["remove", "Remove"]]) {
      const button = document.createElement("button"); button.type = "button"; button.className = "button"; button.textContent = label;
      button.addEventListener("click", () => mutate(`/admin/reel-shop/products/${encodeURIComponent(product.id)}`, { action }));
      buttons.append(button);
    }
    row.append(buttons);
    return row;
  }

  async function load() {
    const run = ++generation;
    loadedTarget = null; editor.disabled = true;
    status.textContent = "Loading reel products…";
    try {
      const target = targetKey();
      const data = await requestAdminApi("/admin/reel-shop");
      if (run !== generation || target !== targetKey()) return;
      element("reelShopEnabled").checked = data.settings.enabled === true;
      element("reelShopRows").replaceChildren(...data.products.map(renderProduct));
      const blocked = data.settings.blocked_until && new Date(data.settings.blocked_until).getTime() > Date.now();
      const workerSeen = new Date(data.settings.worker_seen_at || 0).getTime();
      const importedOnly = data.products.length > 0 && data.products.every((product) => product.source_kind === "asset");
      status.textContent = `${data.environment}: ${data.products.length} products. Display ${data.settings.enabled ? "enabled" : "disabled"}. `
        + (blocked ? `Amazon URL fetching paused until ${date(data.settings.blocked_until)}. Imported images can still display. ` : "")
        + (importedOnly ? "These supplied images do not need a fetching worker." :
          (Date.now() - workerSeen > 120000 ? "Worker is not reporting; queued products will wait. " : "Worker is reporting. ")
          + `Last worker check: ${date(data.settings.worker_seen_at)}.`);
      loadedTarget = target; editor.disabled = false;
    } catch (error) { if (run === generation) status.textContent = `Could not load: ${error.message}`; }
  }

  async function mutate(path, body, method = "POST", onSuccess) {
    try {
      assertTarget();
      const target = loadedTarget;
      editor.disabled = true; status.textContent = "Saving…";
      await requestAdminApi(path, { method, body: JSON.stringify(body) });
      if (target !== targetKey()) return;
      onSuccess?.();
      await load();
    } catch (error) { status.textContent = `Not saved: ${error.message}`; }
    finally { editor.disabled = !loadedTarget || loadedTarget !== targetKeySafely(); }
  }
  function targetKeySafely() { try { return targetKey(); } catch { return null; } }

  element("loadReelShopBtn").addEventListener("click", load);
  element("saveReelShopBtn").addEventListener("click", () => mutate("/admin/reel-shop", { enabled: element("reelShopEnabled").checked }, "PUT"));
  element("queueReelProductsBtn").addEventListener("click", () => {
    const urls = element("reelProductUrls").value.split(/\r?\n/).map((url) => url.trim()).filter(Boolean);
    if (!urls.length || urls.length > 20 || new Set(urls).size !== urls.length) {
      status.textContent = "Enter 1–20 different affiliate URLs, one per line."; return;
    }
    mutate("/admin/reel-shop/products", { urls }, "POST", () => { element("reelProductUrls").value = ""; });
  });
  // Invalidate an outstanding read as soon as the selected target changes.
  for (const id of ["adminEnv", "baseUrl", "adminToken"]) element(id)?.addEventListener("input", () => {
    generation++; loadedTarget = null; editor.disabled = true; status.textContent = "Load the selected environment again.";
  });
})();

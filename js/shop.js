/* Solarplaner – Online-Preisabruf & Produktsuche
 *
 * Viele Solar-Shops (z. B. 1asol.de, solarhandel24.de) laufen auf Shopify.
 * Shopify liefert für jedes Produkt öffentliche JSON-Endpunkte mit CORS-Freigabe:
 *   /products/<handle>.js                 → Einzelprodukt inkl. Varianten & Preis (Cent)
 *   /collections/<handle>/products.json   → Produktliste einer Kategorie
 * Andere Shops blockieren den Abruf aus dem Browser (CORS); dafür gibt es
 * Fallback-Links zu idealo / Google Shopping.
 */
(function () {
  'use strict';

  const TIMEOUT_MS = 20000;
  const collectionCache = new Map();

  function withTimeout(url) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    return fetch(url, { signal: ctrl.signal, credentials: 'omit' })
      .finally(() => clearTimeout(t));
  }

  function parseUrl(url) {
    try { return new URL(String(url || '').trim()); } catch (e) { return null; }
  }

  function absImg(src) {
    if (!src) return '';
    if (src.startsWith('//')) return 'https:' + src;
    return src;
  }

  /** true, wenn die URL wie eine Shopify-Produktseite aussieht */
  function isShopifyProduct(url) {
    const u = parseUrl(url);
    return !!(u && /^https?:$/.test(u.protocol) && /\/products\/[^/]+/.test(u.pathname));
  }

  /** Aktuellen Preis + Bild einer Shopify-Produktseite abrufen */
  async function fetchProduct(url) {
    const u = parseUrl(url);
    if (!u) throw new Error('Ungültiger Link');
    const m = u.pathname.match(/\/products\/([^/?#]+)/);
    if (!m) throw new Error('Kein unterstützter Shop-Link (Shopify-Produktseite erwartet)');
    const variantId = u.searchParams.get('variant');
    const endpoint = u.origin + '/products/' + m[1].replace(/\.(js|json)$/, '') + '.js';
    let res;
    try {
      res = await withTimeout(endpoint);
    } catch (e) {
      throw new Error(e.name === 'AbortError' ? 'Zeitüberschreitung beim Shop-Abruf' : 'Shop nicht erreichbar oder blockiert den Abruf (CORS)');
    }
    if (!res.ok) throw new Error('Produkt nicht gefunden (HTTP ' + res.status + ')');
    const p = await res.json();
    const variants = Array.isArray(p.variants) ? p.variants : [];
    const v = variants.find(x => String(x.id) === String(variantId)) ||
              variants.find(x => x.available) || variants[0];
    if (!v) throw new Error('Keine Preisinformation gefunden');
    return {
      title: p.title,
      vendor: p.vendor || '',
      price: Math.round(Number(v.price)) / 100,
      available: !!v.available,
      variantTitle: v.title,
      img: absImg(p.featured_image || (p.images && p.images[0])),
      url: u.origin + '/products/' + p.handle + '?variant=' + v.id
    };
  }

  async function loadCollection(shop) {
    const key = shop.domain + '|' + shop.collection;
    if (collectionCache.has(key)) return collectionCache.get(key);
    const base = 'https://' + shop.domain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    const path = shop.collection ? '/collections/' + encodeURIComponent(shop.collection) + '/products.json' : '/products.json';
    const all = [];
    for (let page = 1; page <= 4; page++) {
      const res = await withTimeout(base + path + '?limit=250&page=' + page);
      if (!res.ok) throw new Error(shop.domain + ': HTTP ' + res.status);
      const data = await res.json();
      const list = (data && data.products) || [];
      for (const p of list) {
        const v = (p.variants || [])[0];
        if (!v) continue;
        all.push({
          shop: shop.domain,
          title: p.title,
          vendor: p.vendor || '',
          price: Number(v.price),
          available: v.available !== false,
          img: absImg(p.images && p.images[0] && p.images[0].src),
          url: base + '/products/' + p.handle + '?variant=' + v.id
        });
      }
      if (list.length < 250) break;
    }
    collectionCache.set(key, all);
    return all;
  }

  const norm = s => String(s || '').toLowerCase();
  const compact = s => norm(s).replace(/[^a-z0-9]/g, '');

  /** Produkte in allen aktiven Shops suchen */
  async function search(query, shops, onProgress) {
    const tokens = norm(query).split(/\s+/).filter(Boolean);
    const results = [];
    const errors = [];
    const active = (shops || []).filter(s => s.enabled !== false && s.domain);
    let done = 0;
    await Promise.all(active.map(async shop => {
      try {
        const items = await loadCollection(shop);
        for (const it of items) {
          const t = norm(it.title + ' ' + it.vendor);
          const c = compact(t);
          if (tokens.every(tok => t.includes(tok) || c.includes(compact(tok)))) results.push(it);
        }
      } catch (e) {
        errors.push(shop.domain + ': ' + (e.name === 'AbortError' ? 'Zeitüberschreitung' : (e.message || 'Fehler')));
      } finally {
        done++;
        if (onProgress) onProgress(done, active.length);
      }
    }));
    results.sort((a, b) => a.title.localeCompare(b.title, 'de', { numeric: true }) || a.price - b.price);
    return { results, errors };
  }

  /** Leistung (kW) und Typ aus einem Produkttitel ableiten */
  function guessSpecs(title) {
    const t = String(title || '');
    const kws = [...t.matchAll(/(\d+(?:[.,]\d+)?)\s*kW\b/gi)].map(m => parseFloat(m[1].replace(',', '.')));
    let kw = kws.length ? kws[kws.length - 1] : 0;
    if (!kw) {
      const m = t.match(/\b(?:SH|SG)(\d+(?:\.\d+)?)/i) || t.match(/(\d+(?:\.\d+)?)KTL/i);
      if (m) kw = parseFloat(m[1]);
    }
    const type = /hybrid/i.test(t) ? 'Hybrid' : (/mikro|micro/i.test(t) ? 'Mikro' : 'String');
    return { kw, type };
  }

  /**
   * Modulkatalog eines Shopify-Shops laden (z. B. solarhandel24.de).
   * solarhandel24 führt je Modul zwei Produkte: „… (Staffelpreis)“ mit Mengenstaffel
   * (Option „Quantity“: 1/6/15/37) und „… – Palettenpreis (37 Stk.)“ zum Festpreis.
   * Beide werden zu einem Katalogeintrag zusammengeführt.
   */
  async function fetchModuleCatalog(cfg) {
    const domain = String(cfg.domain || 'solarhandel24.de').replace(/^https?:\/\//, '').replace(/\/+$/, '');
    const base = 'https://' + domain;
    const raw = new Map();
    for (const col of cfg.collections || []) {
      const res = await withTimeout(base + '/collections/' + encodeURIComponent(col) + '/products.json?limit=250');
      if (!res.ok) throw new Error(domain + ': HTTP ' + res.status);
      const data = await res.json();
      (data.products || []).forEach(p => raw.set(p.handle, p));
    }
    const baseTitle = t => String(t).replace(/\s*\(Staffelpreis\)\s*$/i, '').replace(/\s*-\s*Palettenpreis.*$/i, '').replace(/\s+/g, ' ').trim();
    const priv = vs => { const pv = vs.filter(v => /privat/i.test(v.option1 || v.title || '')); return pv.length ? pv : vs; };
    const groups = new Map();
    raw.forEach(p => {
      const t = p.title || '';
      if (/komplettset|balkonkraftwerk|flexib|\bset\b/i.test(t)) return;
      const wp = t.match(/(\d{3})\s*Wp?\b/);
      if (!wp) return;
      const b = baseTitle(t), key = b.toLowerCase();
      if (!groups.has(key)) groups.set(key, { title: b, vendor: p.vendor || '', wp: parseInt(wp[1], 10) });
      const g = groups.get(key);
      const body = String(p.body_html || '').replace(/<[^>]+>/g, ' ');
      const dm = body.match(/(\d{3,4})\s*[x×]\s*(\d{3,4})\s*[x×]\s*(\d{2})\s*mm/);
      if (dm && !g.dims) { const a = +dm[1], c = +dm[2]; g.dims = [Math.max(a, c), Math.min(a, c)]; }
      if (!g.img && p.images && p.images[0]) g.img = absImg(p.images[0].src);
      const vs = priv(p.variants || []);
      if (/palettenpreis/i.test(t)) {
        const v = vs[0];
        const q = t.match(/\((\d+)\s*St/i);
        g.pallet = { qty: q ? +q[1] : 0, price: Number(v.price), url: base + '/products/' + p.handle + '?variant=' + v.id, available: v.available !== false, grams: Number(v.grams) || 0 };
      } else {
        const tiers = vs.map(v => [parseInt(v.option2, 10) || 1, Number(v.price), v.id]).sort((x, y) => x[0] - y[0]);
        g.single = { tiers: tiers.map(x => [x[0], x[1]]), url: base + '/products/' + p.handle + '?variant=' + tiers[0][2], handle: p.handle, available: (p.variants || []).some(v => v.available !== false), grams: Number(vs[0] && vs[0].grams) || 0 };
      }
    });
    const items = [];
    groups.forEach(g => {
      const s = g.single, pl = g.pallet;
      if (!s && !pl) return;
      const v = g.vendor.toLowerCase();
      items.push({
        id: s ? s.handle : g.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        brand: v.startsWith('ja') ? 'JA Solar' : (v.includes('aiko') ? 'AIKO' : g.vendor),
        title: g.title, wp: g.wp,
        heightMm: g.dims ? g.dims[0] : 0, widthMm: g.dims ? g.dims[1] : 0,
        img: g.img || '',
        tiers: s ? s.tiers : [],
        singleUrl: s ? s.url : '',
        palletQty: (pl && pl.qty) || (s && s.tiers.length ? s.tiers[s.tiers.length - 1][0] : 0),
        palletPrice: pl ? pl.price : 0,
        palletUrl: pl ? pl.url : '',
        available: !!((s && s.available) || (pl && pl.available)),
        weightKg: s && s.grams ? Math.round(s.grams / 10) / 100 : 0,
        palletWeightKg: pl && pl.grams ? Math.round(pl.grams / 10) / 100 : 0
      });
    });
    items.sort((a, b) => a.brand.localeCompare(b.brand) || a.wp - b.wp || a.title.localeCompare(b.title));
    if (!items.length) throw new Error('Keine Module im Shop gefunden');
    return items;
  }

  const idealoUrl = q => 'https://www.idealo.de/preisvergleich/MainSearchProductCategory.html?q=' + encodeURIComponent(q);
  const googleShoppingUrl = q => 'https://www.google.com/search?tbm=shop&q=' + encodeURIComponent(q);

  window.SPShop = { isShopifyProduct, fetchProduct, search, guessSpecs, fetchModuleCatalog, idealoUrl, googleShoppingUrl };
})();

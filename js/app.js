/* Agapovs PV-Planer – Anwendung
 * Zustand → calc() → Ausgabe. Eingaben sind per data-bind="pfad.zum.wert" an den Zustand gebunden.
 */
(function () {
  'use strict';

  const STORE_KEY = 'agapov.pvplaner.v2';
  const LEGACY_KEY = 'solarplaner.state.v1';
  const APP_ID = 'agapov-pv-planer';
  const APP_NAME = 'Agapovs PV-Planer';
  const APP_VERSION = '17'; // muss zu version.json und den ?v= in index.html passen
  const CONFIG_KEYS = ['project', 'modules', 'inverters', 'components', 'mounting', 'externals', 'economy'];
  const D = window.SP_DEFAULTS;
  const Shop = window.SPShop;
  const Charts = window.SPCharts;

  /* ------------------------------------------------------------------ *
   * Hilfsfunktionen
   * ------------------------------------------------------------------ */
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const clone = o => JSON.parse(JSON.stringify(o));
  const isObj = o => o && typeof o === 'object' && !Array.isArray(o);
  const uid = () => Math.random().toString(36).slice(2, 9);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  const NF = {
    eur: new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }),
    eur0: new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }),
    n0: new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }),
    n1: new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    n2: new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    nMax2: new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }),
    in: new Intl.NumberFormat('de-DE', { maximumFractionDigits: 3, useGrouping: false })
  };
  const eur = v => NF.eur.format(Number.isFinite(v) ? v : 0);
  const pct = v => NF.n1.format(Number.isFinite(v) ? v : 0) + ' %';

  /** Zahl aus deutscher oder englischer Schreibweise lesen ("1.470,50", "7,17", "7.17", "1.470") */
  function parseNum(str) {
    if (typeof str === 'number') return str;
    let s = String(str || '').trim().replace(/\s|€|%/g, '');
    if (!s) return 0;
    if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
    else if (s.includes(',')) s = s.replace(',', '.');
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  }
  const parseIntList = s => String(s || '').split(/[^0-9]+/).filter(Boolean).map(x => parseInt(x, 10)).filter(n => n > 0);
  const fmtIn = (v, type) => type === 'int' ? String(Math.round(num(v))) : (type === 'intlist' ? (v || []).join(', ') : NF.in.format(num(v)));

  function getPath(obj, path) {
    return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
  }
  function setPath(obj, path, val) {
    const keys = path.split('.');
    let o = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      if (o[keys[i]] == null) o[keys[i]] = {};
      o = o[keys[i]];
    }
    o[keys[keys.length - 1]] = val;
  }
  function deepMerge(base, over) {
    if (!isObj(base) || !isObj(over)) return over === undefined ? base : over;
    const out = Object.assign({}, base);
    Object.keys(over).forEach(k => {
      out[k] = isObj(base[k]) && isObj(over[k]) ? deepMerge(base[k], over[k]) : (over[k] === undefined ? base[k] : over[k]);
    });
    return out;
  }
  function debounce(fn, ms) {
    let t;
    return function () { clearTimeout(t); const a = arguments; t = setTimeout(() => fn.apply(null, a), ms); };
  }
  const slug = s => String(s || 'projekt').toLowerCase().replace(/[äöüß]/g, c => ({ 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss' }[c])).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'projekt';

  /* ------------------------------------------------------------------ *
   * Konstanten
   * ------------------------------------------------------------------ */
  const CATS = [
    { key: 'module', label: 'Module & Versand', icon: 'panel' },
    { key: 'inverter', label: 'Wechselrichter', icon: 'inverter' },
    { key: 'storage', label: 'Speicher', icon: 'battery' },
    { key: 'wallbox', label: 'Wallbox & Energiemanagement', icon: 'plug' },
    { key: 'mounting', label: 'Montagesystem & Zubehör', icon: 'wrench' },
    { key: 'labor', label: 'Montage & Gerüst', icon: 'hardhat' },
    { key: 'electrical', label: 'Elektroanschluss', icon: 'bolt' },
    { key: 'other', label: 'Sonstiges', icon: 'list' }
  ];
  const CAT = Object.fromEntries(CATS.map((c, i) => [c.key, Object.assign({ color: 'var(--c' + (i + 1) + ')' }, c)]));
  const MOUNT_KEYS = ['hooks', 'rails', 'midClamps', 'endClamps', 'connectors'];

  const THEMES = [
    { key: 'auto', name: 'System', desc: 'Folgt Hell/Dunkel des Geräts', mode: null },
    { key: 'light', name: 'Hell', desc: 'Klar und neutral', mode: 'light' },
    { key: 'dark', name: 'Dunkel', desc: 'Augenschonend, kontrastreich', mode: 'dark' },
    { key: 'material', name: 'Material', desc: 'Material You, tonale Flächen', mode: 'light' },
    { key: 'glass', name: 'Glass', desc: 'Dunkles Glas mit Farbverlauf', mode: 'dark' },
    { key: 'frost', name: 'Frost', desc: 'Helles Milchglas, kühl', mode: 'light' },
    { key: 'ios', name: 'iOS', desc: 'Gruppierte Listen im Apple-Stil', mode: 'light' },
    { key: 'solar', name: 'Solar', desc: 'Warmes Dunkel mit Bernstein', mode: 'dark' }
  ];

  /* ------------------------------------------------------------------ *
   * Zustand
   * ------------------------------------------------------------------ */
  let state;
  const ui = {
    summaryView: 'categories',
    hover: null,
    pinned: null,
    settingsTab: 'general',
    libOpen: new Set(),
    search: { query: '', loading: false, results: null, errors: [], progress: '' },
    imageTarget: null,
    busy: new Set(),
    savedAt: null,
    r: null
  };

  function normalize(s) {
    const d = D.create();
    // Konfigurationen von vor dem Shop-Katalog: Versand auf 199 € je Palette umstellen
    const legacyModules = s && s.modules && !s.modules.source;
    const legacyBuyMode = !(s && s.modules && s.modules.buyModeV);
    const legacyEco = !!(s && s.economy && !s.economy.selfMode);
    s = deepMerge(d, s || {});
    if (legacyModules) s.modules.shipping = clone(d.modules.shipping);
    if (s.modules.shipping.mode === 'perPallet' && num(s.modules.shipping.amount) === 199) s.modules.shipping.mode = 'shop24';
    if (!s.settings.shipTable || !Array.isArray(s.settings.shipTable.freight)) s.settings.shipTable = d.settings.shipTable;
    if (!s.moduleCatalog || !Array.isArray(s.moduleCatalog.items) || !s.moduleCatalog.items.length) s.moduleCatalog = d.moduleCatalog;
    if (!['single', 'pallet', 'mixed'].includes(s.modules.buyMode)) s.modules.buyMode = 'mixed';
    // frühere Voreinstellung „Palette“ → „Optimal“ (sonst kostet z. B. das 38. Modul eine ganze zweite Palette)
    // ältere Konfigurationen: Standard-40 % → 6.930 kWh (gleicher Wert bei 37 × 465 Wp), sonst bei % bleiben
    if (legacyEco) s.economy.selfMode = num(s.economy.selfPct) === 40 ? 'kwh' : 'pct';
    if (legacyBuyMode) { if (s.modules.buyMode === 'pallet') s.modules.buyMode = 'mixed'; s.modules.buyModeV = 2; }
    if (!['shop', 'manual'].includes(s.modules.source)) s.modules.source = 'shop';
    // Listen auffüllen, damit importierte/alte Daten vollständig sind
    s.inverters = (Array.isArray(s.inverters) ? s.inverters : []).map(x => Object.assign({ id: uid(), libId: '', qty: 1 }, x));
    s.components = (Array.isArray(s.components) ? s.components : []).map(x => Object.assign({ id: uid(), label: 'Position', name: '', title: '', qty: 1, price: 0, category: 'other', enabled: true, url: '', img: '' }, x));
    s.externals = (Array.isArray(s.externals) ? s.externals : []).map(x => Object.assign({ id: uid(), kind: 'item', label: 'Position', name: '', qty: 1, price: 0, category: 'other', enabled: true }, x));
    if (!s.externals.some(x => x.kind === 'montage')) s.externals.splice(Math.min(1, s.externals.length), 0, clone(d.externals[1]));
    s.library.inverters = (Array.isArray(s.library.inverters) ? s.library.inverters : []).map(x => Object.assign({ id: uid(), brand: '', model: '', title: '', type: 'Hybrid', kw: 0, price: 0, url: '', img: '' }, x));
    s.settings.shops = (Array.isArray(s.settings.shops) ? s.settings.shops : []).map(x => Object.assign({ domain: '', collection: '', enabled: true }, x));
    MOUNT_KEYS.forEach(k => { s.mounting.items[k] = Object.assign({}, d.mounting.items[k], s.mounting.items[k]); });
    if (!Array.isArray(s.mounting.layout.customRows)) s.mounting.layout.customRows = parseIntList(s.mounting.layout.customRows);
    s.settings.sliderMax = clamp(Math.round(num(s.settings.sliderMax)) || 100, 5, 5000);
    s.modules.count = Math.max(0, Math.round(num(s.modules.count)));
    if (s.modules.count > s.settings.sliderMax) s.settings.sliderMax = s.modules.count;
    if (!THEMES.some(t => t.key === s.settings.theme)) s.settings.theme = 'dark';
    return s;
  }

  /* ---------- Gespeicherte Konfigurationen ----------
   * store = { settings, library, configs: [{ id, name, createdAt, updatedAt, meta, data }], activeId }
   * Bibliothek, Shops und Design gelten für alle Konfigurationen; alles andere je Konfiguration.
   */
  let store;
  const nowIso = () => new Date().toISOString();
  const pickConfig = s => { const o = {}; CONFIG_KEYS.forEach(k => { o[k] = clone(s[k]); }); return o; };
  function templateConfig(name) { const c = pickConfig(D.create()); if (name) c.project.name = name; return c; }
  function configEntry(name, data, id) { const t = nowIso(); return { id: id || 'cfg-' + uid(), name: name, createdAt: t, updatedAt: t, meta: null, data: data }; }
  const activeCfg = () => store.configs.find(c => c.id === store.activeId) || store.configs[0];
  function uniqueName(base, exceptId) {
    const names = new Set(store.configs.filter(c => c.id !== exceptId).map(c => c.name));
    let n = base, i = 2;
    while (names.has(n)) n = base + ' (' + (i++) + ')';
    return n;
  }

  function loadStore() {
    let st = null;
    try { st = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { st = null; }
    if (!st || !Array.isArray(st.configs) || !st.configs.length) {
      const d = D.create();
      let legacy = null;
      try { legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null'); } catch (e) { legacy = null; }
      st = { settings: d.settings, library: d.library, moduleCatalog: d.moduleCatalog, configs: [], activeId: null };
      if (legacy && legacy.settings && legacy.settings.theme) st.settings.theme = legacy.settings.theme;
      // Erste Konfiguration: MK_37_Module – exakt die Werte aus der Excel
      const first = configEntry('MK_37_Module', templateConfig('MK_37_Module'), 'cfg-mk37');
      st.configs.push(first);
      st.activeId = first.id;
    }
    if (!st.configs.some(c => c.id === st.activeId)) st.activeId = st.configs[0].id;
    return st;
  }

  function stateFromConfig(cfg) {
    const s = normalize(Object.assign({}, clone(cfg.data || {}), { settings: clone(store.settings || {}), library: clone(store.library || {}), moduleCatalog: clone(store.moduleCatalog || null) }));
    if (!s.project.name) s.project.name = cfg.name;
    return s;
  }

  function persist() {
    const cfg = activeCfg();
    if (cfg && state) {
      cfg.data = pickConfig(state);
      cfg.name = (state.project.name || '').trim() || cfg.name;
      cfg.updatedAt = nowIso();
      if (ui.r) cfg.meta = { n: ui.r.n, kwp: ui.r.kwp, total: ui.r.total };
    }
    store.settings = clone(state.settings);
    store.library = clone(state.library);
    store.moduleCatalog = clone(state.moduleCatalog);
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(store));
      ui.savedAt = new Date();
      $$('[data-out="savedAt"]').forEach(el => { el.textContent = 'Gespeichert ' + ui.savedAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }); });
    } catch (e) {
      $$('[data-out="savedAt"]').forEach(el => { el.textContent = 'Speichern nicht möglich'; });
    }
    if (!$('#cfgMenu').hidden) renderCfgMenu();
    $('#cfgCount').textContent = store.configs.length;
  }
  const save = debounce(persist, 350);

  /* ---------- Konfigurations-Aktionen ---------- */
  function loadConfig(id, silent) {
    persist();
    store.activeId = id;
    state = stateFromConfig(activeCfg());
    ui.libOpen.clear();
    ui.pinned = null; ui.hover = null;
    closeCfgMenu();
    renderAll();
    if ($('#settingsDialog').open) renderSettings();
    persist();
    if (!silent) toast('Konfiguration „' + activeCfg().name + '“ geladen.', 'ok');
  }

  function addConfig(data, name, msg) {
    persist();
    const cfg = configEntry(uniqueName(name), data);
    cfg.data.project.name = cfg.name;
    store.configs.push(cfg);
    loadConfig(cfg.id, true);
    toast(msg || ('Konfiguration „' + cfg.name + '“ angelegt.'), 'ok');
    const n = $('#projectName');
    if (n && !msg) { n.focus(); n.select(); }
  }

  async function deleteConfig(id) {
    const cfg = store.configs.find(c => c.id === id);
    if (!cfg) return;
    if (store.configs.length === 1) { toast('Die letzte Konfiguration kann nicht gelöscht werden.', 'info'); return; }
    if (!(await confirmBox('Konfiguration löschen?', '„' + cfg.name + '“ wird dauerhaft aus diesem Browser gelöscht. Tipp: Vorher exportieren.', 'Löschen'))) return;
    store.configs = store.configs.filter(c => c.id !== id);
    if (store.activeId === id) { store.activeId = store.configs[0].id; state = stateFromConfig(activeCfg()); renderAll(); }
    persist();
    if (!$('#cfgMenu').hidden) renderCfgMenu();
    if ($('#settingsDialog').open) renderSettings();
    toast('„' + cfg.name + '“ gelöscht.', 'ok');
  }

  function fmtDate(iso) {
    try { return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; }
  }

  function renderCfgMenu() {
    const menu = $('#cfgMenu');
    const list = store.configs.slice().sort((a, b) => (a.id === store.activeId ? -1 : b.id === store.activeId ? 1 : 0) || String(b.updatedAt).localeCompare(String(a.updatedAt)));
    menu.innerHTML =
      '<div class="cfg-menu-head"><span>Gespeicherte Konfigurationen</span><span class="muted">' + store.configs.length + '</span></div>' +
      '<ul class="cfg-list" role="menu">' + list.map(c => {
        const on = c.id === store.activeId;
        const m = c.meta;
        return '<li class="cfg-item' + (on ? ' is-active' : '') + '">' +
          '<button type="button" class="cfg-open" role="menuitem" data-action="cfg-open" data-id="' + esc(c.id) + '"' + (on ? ' aria-current="true"' : '') + '>' +
            '<span class="cfg-item-icon">' + icon(on ? 'check' : 'folder') + '</span>' +
            '<span class="cfg-item-main"><b>' + esc(c.name) + '</b>' +
              '<span>' + (m ? m.n + ' Module · ' + NF.n2.format(m.kwp) + ' kWp · ' + esc(eur(m.total)) : 'Noch nicht berechnet') + '</span>' +
              '<span class="cfg-item-date">Geändert ' + esc(fmtDate(c.updatedAt)) + '</span></span>' +
          '</button>' +
          '<span class="cfg-item-actions">' +
            '<button type="button" class="btn btn-icon btn-ghost" data-action="cfg-dup" data-id="' + esc(c.id) + '" title="Duplizieren" aria-label="' + esc(c.name) + ' duplizieren">' + icon('copy') + '</button>' +
            '<button type="button" class="btn btn-icon btn-ghost" data-action="cfg-export" data-id="' + esc(c.id) + '" title="Exportieren" aria-label="' + esc(c.name) + ' exportieren">' + icon('download') + '</button>' +
            '<button type="button" class="btn btn-icon btn-ghost" data-action="cfg-del" data-id="' + esc(c.id) + '" title="Löschen" aria-label="' + esc(c.name) + ' löschen"' + (store.configs.length === 1 ? ' disabled' : '') + '>' + icon('trash') + '</button>' +
          '</span></li>';
      }).join('') + '</ul>' +
      '<div class="cfg-menu-foot">' +
        '<button type="button" class="btn btn-soft btn-sm" data-action="cfg-new">' + icon('plus') + '<span>Neue Konfiguration</span></button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-action="import">' + icon('upload') + '<span>Importieren</span></button>' +
      '</div>';
  }
  function openCfgMenu() { renderCfgMenu(); $('#cfgMenu').hidden = false; $('#cfgBtn').setAttribute('aria-expanded', 'true'); }
  function closeCfgMenu() { $('#cfgMenu').hidden = true; $('#cfgBtn').setAttribute('aria-expanded', 'false'); }

  /* ------------------------------------------------------------------ *
   * Berechnung (entspricht den Excel-Formeln)
   * ------------------------------------------------------------------ */
  function libById(id) { return state.library.inverters.find(x => x.id === id) || null; }

  /* ---------- Module: Katalog (solarhandel24) oder manuell ---------- */
  function catalogItem() {
    const m = state.modules;
    if (m.source !== 'shop') return null;
    return (state.moduleCatalog.items || []).find(x => x.id === m.productId) || null;
  }

  /** Einheitliche Moduldaten – egal ob aus dem Shop-Katalog oder manuell eingegeben */
  function moduleSpec() {
    const m = state.modules, it = catalogItem();
    if (it) {
      return {
        shop: true, item: it, name: it.brand + ' ' + it.wp + ' W', title: it.title, wp: num(it.wp),
        widthMm: num(it.widthMm) || num(m.widthMm), heightMm: num(it.heightMm) || num(m.heightMm),
        img: it.img, url: it.singleUrl || it.palletUrl, palletQty: Math.max(1, num(it.palletQty) || num(m.shipping.palletSize) || 1),
        weightKg: num(it.weightKg) || num(m.weightKg), palletWeightKg: num(it.palletWeightKg) || 0
      };
    }
    return {
      shop: false, item: null, name: m.name, title: m.title, wp: num(m.wp), widthMm: num(m.widthMm), heightMm: num(m.heightMm),
      img: m.img, url: m.url, palletQty: Math.max(1, num(m.shipping.palletSize) || 1),
      weightKg: num(m.weightKg), palletWeightKg: 0
    };
  }

  /** Staffelpreis für eine Stückzahl (höchste Stufe, deren Mindestmenge erreicht ist) */
  function tierPrice(it, q) {
    const tiers = it.tiers || [];
    if (!tiers.length) return it.palletQty ? num(it.palletPrice) / num(it.palletQty) : 0;
    let p = num(tiers[0][1]);
    tiers.forEach(t => { if (q >= num(t[0])) p = num(t[1]); });
    return p;
  }
  const activeTier = (it, q) => { let a = null; (it.tiers || []).forEach(t => { if (q >= num(t[0])) a = t; }); return a; };

  /** Einkauf berechnen: Einzeln (Staffel), ganze Paletten oder günstigste Kombination */
  function modulePurchase(n, spec, mode) {
    const it = spec.item, pq = spec.palletQty;
    const hasPallet = num(it.palletPrice) > 0, hasSingle = (it.tiers || []).length > 0;
    if (mode === 'pallet' && !hasPallet) mode = 'single';
    if (mode === 'single' && !hasSingle) mode = 'pallet';
    const single = q => ({ lines: q > 0 ? [{ kind: 'single', qty: q, unit: tierPrice(it, q), tier: activeTier(it, q) }] : [], delivered: q });
    const pallets = k => ({ lines: k > 0 ? [{ kind: 'pallet', qty: k, unit: num(it.palletPrice) }] : [], delivered: k * pq });
    const cost = r => r.lines.reduce((a, l) => a + l.qty * l.unit, 0);
    let res;
    if (n <= 0) res = { lines: [], delivered: 0 };
    else if (mode === 'single') res = single(n);
    else if (mode === 'pallet') res = pallets(Math.ceil(n / pq));
    else {
      const cands = [];
      if (hasPallet) {
        const full = Math.floor(n / pq), rest = n - full * pq;
        const a = pallets(full), b = single(rest);
        if (hasSingle || rest === 0) cands.push({ lines: a.lines.concat(b.lines), delivered: full * pq + rest });
        cands.push(pallets(Math.ceil(n / pq)));
      }
      if (hasSingle) cands.push(single(n));
      cands.sort((x, y) => cost(x) - cost(y) || x.delivered - y.delivered);
      res = cands[0];
    }
    res.cost = cost(res);
    res.mode = mode;
    return res;
  }

  /** Versandkosten solarhandel24 nach Gesamtgewicht (Speditions-/LKW-Tabelle + Modul-Sonderregeln) */
  function shop24Shipping(weightKg, modules) {
    const T = state.settings.shipTable;
    if (!(weightKg > 0)) return { cost: 0, kind: '', label: '' };
    if (modules === 1 && num(T.courierSingle) > 0) return { cost: num(T.courierSingle), kind: 'courier', label: 'Versicherter Kurierversand (1 Modul)' };
    const pick = rows => { for (const r of rows) if (weightKg <= num(r[0])) return r; return null; };
    let row = pick(T.freight || []);
    if (row) {
      const cost = Math.max(num(row[1]), modules > 0 ? num(T.moduleMin) : 0);
      return { cost, kind: 'freight', label: 'Spedition (' + NF.n1.format(weightKg) + ' kg)' };
    }
    row = pick(T.direct || []);
    if (row) return { cost: num(row[1]), kind: 'direct', label: 'Direktlieferung per LKW (' + NF.n0.format(weightKg) + ' kg)' };
    const last = (T.direct || [])[T.direct.length - 1] || [0, 0];
    return { cost: num(last[1]), kind: 'direct', label: 'LKW (' + NF.n0.format(weightKg) + ' kg) – über Tabelle, Preis auf Anfrage', over: true };
  }

  function calcLayout(n) {
    const M = moduleSpec(), L = state.mounting.layout;
    let rows;
    if (L.rowMode === 'custom') {
      rows = (L.customRows || []).map(x => Math.max(0, Math.round(num(x)))).filter(x => x > 0);
    } else {
      const r = Math.min(Math.max(1, Math.round(num(L.rows))), n);
      rows = [];
      for (let i = 0; i < r; i++) rows.push(Math.floor(n / r) + (i < n % r ? 1 : 0));
    }
    const portrait = L.orientation !== 'landscape';
    const modW = (portrait ? num(M.widthMm) : num(M.heightMm)) / 1000;
    const modH = (portrait ? num(M.heightMm) : num(M.widthMm)) / 1000;
    const gap = num(L.gapMm) / 1000;
    const over = num(L.overhangMm) / 1000;
    const railLen = Math.max(0.1, num(L.railLengthMm) / 1000);
    const lines = Math.max(1, Math.round(num(L.railsPerRow)));
    const spacing = Math.max(0.1, num(L.hookSpacingMm) / 1000);
    const edge = Math.max(0, num(L.hookEdgeMm) / 1000);
    const reserve = Math.max(0, num(L.reservePct)) / 100;

    const rowLengths = [], piecesPerLine = [], hooksPerLine = [];
    let pieces = 0, connectors = 0, hooks = 0, mid = 0, end = 0, lineMeters = 0;
    rows.forEach(k => {
      const len = k * modW + (k - 1) * gap + 2 * over;
      const p = Math.ceil(len / railLen - 1e-9);
      const h = Math.max(2, Math.ceil(Math.max(0, len - 2 * edge) / spacing - 1e-9) + 1);
      rowLengths.push(len); piecesPerLine.push(p); hooksPerLine.push(h);
      pieces += p * lines;
      connectors += (p - 1) * lines;
      hooks += h * lines;
      mid += (k - 1) * lines;
      end += 2 * lines;
      lineMeters += len * lines;
    });
    const rails = L.reuseOffcuts ? Math.ceil(lineMeters / railLen - 1e-9) : pieces;
    const withRes = q => q > 0 ? Math.ceil(q * (1 + reserve) - 1e-9) : 0;
    const placed = rows.reduce((a, b) => a + b, 0);
    return {
      rows, rowLengths, piecesPerLine, hooksPerLine, placed,
      modW, modH, gap, overhang: over, railLen, railsPerRow: lines, hookEdge: edge,
      lineMeters,
      qty: { hooks: withRes(hooks), rails: rails, midClamps: withRes(mid), endClamps: withRes(end), connectors: withRes(connectors) }
    };
  }

  function calc() {
    const s = state, m = s.modules;
    const n = Math.max(0, Math.round(num(m.count)));
    const spec = moduleSpec();
    const wp = spec.wp;
    const kwp = n * wp / 1000;
    const positions = [];
    const add = p => { positions.push(p); return p; };

    // 1 – Module
    let modCost, delivered = n, purchase = null;
    if (spec.shop) {
      purchase = modulePurchase(n, spec, m.buyMode);
      modCost = purchase.cost;
      delivered = purchase.delivered;
      purchase.lines.forEach(l => {
        if (l.kind === 'pallet') add({ group: 'own', cat: 'module', label: 'PV-Module (Palette)', name: spec.title + ' – Palette à ' + spec.palletQty + ' Stk.', qty: l.qty, unitLabel: l.qty === 1 ? 'Palette' : 'Paletten', unit: l.unit, total: l.qty * l.unit, url: spec.item.palletUrl || spec.url });
        else add({ group: 'own', cat: 'module', label: 'PV-Module', name: spec.title + (l.tier ? ' – Staffelpreis ab ' + l.tier[0] + ' Stk.' : ''), qty: l.qty, unitLabel: 'Stk.', unit: l.unit, total: l.qty * l.unit, url: spec.item.singleUrl || spec.url });
      });
      if (!purchase.lines.length) add({ group: 'own', cat: 'module', label: 'PV-Module', name: spec.title, qty: 0, unitLabel: 'Stk.', unit: tierPrice(spec.item, 1), total: 0, url: spec.url });
    } else {
      modCost = n * num(m.price);
      add({ group: 'own', cat: 'module', label: 'PV-Module', name: m.name, qty: n, unitLabel: 'Stk.', unit: num(m.price), total: modCost, url: m.url });
    }
    const sh = m.shipping || {};
    let ship = 0, shipQty = 0, shipUnit = 'pauschal', shipInfo = null;
    // Liefergewicht: Paletten mit Palettengewicht, Einzelmodule mit Modulgewicht
    let weight = 0;
    if (purchase) purchase.lines.forEach(l => { weight += l.kind === 'pallet' ? l.qty * (spec.palletWeightKg || spec.palletQty * spec.weightKg) : l.qty * spec.weightKg; });
    else weight = n * spec.weightKg;
    if (n > 0) {
      if (sh.mode === 'shop24') { shipInfo = shop24Shipping(weight, delivered); ship = shipInfo.cost; shipQty = 1; }
      else if (sh.mode === 'flat') { ship = num(sh.amount); shipQty = 1; }
      else if (sh.mode === 'perModule') { ship = delivered * num(sh.amount); shipQty = delivered; shipUnit = 'Stk.'; }
      else if (sh.mode === 'perPallet') { shipQty = Math.ceil(delivered / spec.palletQty); ship = shipQty * num(sh.amount); shipUnit = shipQty === 1 ? 'Palette' : 'Paletten'; }
    }
    if (sh.mode !== 'none' && ship > 0) add({ group: 'own', cat: 'module', label: 'Versand Module', name: shipInfo ? 'solarhandel24: ' + shipInfo.label : (shipUnit === 'pauschal' ? 'Pauschale' : (sh.mode === 'perPallet' ? 'Spedition je Palette (' + spec.palletQty + ' Module)' : 'je Modul')), qty: shipQty, unitLabel: shipUnit, unit: shipQty ? ship / shipQty : 0, total: ship });

    // 2 – Wechselrichter
    let acKw = 0, invCount = 0;
    const inv = s.inverters.map((slot, i) => {
      const lib = libById(slot.libId);
      const qty = Math.max(0, Math.round(num(slot.qty)));
      const unit = lib ? num(lib.price) : 0;
      const total = qty * unit;
      if (lib) { acKw += qty * num(lib.kw); invCount += qty; }
      if (lib && qty > 0) add({ group: 'own', cat: 'inverter', label: 'Wechselrichter ' + (i + 1), name: (lib.brand + ' ' + lib.model).trim() + (lib.kw ? ' (' + NF.nMax2.format(lib.kw) + ' kW)' : ''), qty, unitLabel: 'Stk.', unit, total, url: lib.url });
      return { lib, qty, unit, total };
    });
    const invCost = inv.reduce((a, x) => a + x.total, 0);

    // 3 – weitere Komponenten
    const cmp = s.components.map(c => {
      const qty = Math.max(0, num(c.qty));
      const total = c.enabled ? qty * num(c.price) : 0;
      if (c.enabled && total !== 0) add({ group: 'own', cat: CAT[c.category] ? c.category : 'other', label: c.label, name: c.name, qty, unitLabel: 'Stk.', unit: num(c.price), total, url: c.url });
      return { total };
    });
    const cmpCost = cmp.reduce((a, x) => a + x.total, 0);

    // 4 – Montagesystem
    const MT = s.mounting;
    let mQty = {}, layout = null;
    if (MT.mode === 'manual') MOUNT_KEYS.forEach(k => { mQty[k] = Math.max(0, Math.round(num(MT.items[k].manual))); });
    else if (MT.mode === 'layout') { layout = calcLayout(n); mQty = layout.qty; }
    else {
      const ref = num(MT.refModules);
      MOUNT_KEYS.forEach(k => { mQty[k] = ref > 0 ? Math.ceil(n * num(MT.items[k].ref) / ref - 1e-9) : 0; });
    }
    // Aufsparrendämmung: Anteil der Hakenpositionen geht an Lehmann-Aufdachmodulhalter
    const A = MT.asd;
    const asdN = clamp(Math.round(num(A.modules)), 0, n);
    const hookPositions = mQty.hooks;
    const asdHolders = n > 0 && asdN > 0 ? Math.ceil(hookPositions * asdN / n - 1e-9) : 0;
    mQty = Object.assign({}, mQty, { hooks: hookPositions - asdHolders });
    const mnt = MOUNT_KEYS.map(k => {
      const it = MT.items[k];
      const total = mQty[k] * num(it.price);
      if (total !== 0) add({ group: 'own', cat: 'mounting', label: it.label + (k === 'hooks' && asdN > 0 ? ' (normale Module)' : ''), name: it.name, qty: mQty[k], unitLabel: 'Stk.', unit: num(it.price), total, url: it.url });
      return { key: k, qty: mQty[k], total };
    });
    const holder = A.holders[A.type] || A.holders['7300'];
    const holderTotal = asdHolders * num(holder.price);
    const cartons = asdHolders > 0 ? Math.ceil(asdHolders / Math.max(1, num(A.screw.packSize))) : 0;
    const screwTotal = cartons * num(A.screw.price);
    const vendorSum = holderTotal + screwTotal;
    const asdFee = vendorSum > 0 && vendorSum < num(A.minOrder) ? num(A.minOrderFee) : 0;
    if (holderTotal) add({ group: 'own', cat: 'mounting', label: 'Aufdachmodulhalter (Aufsparrendämmung)', name: holder.name, qty: asdHolders, unitLabel: 'Stk.', unit: num(holder.price), total: holderTotal, url: holder.url });
    if (screwTotal) add({ group: 'own', cat: 'mounting', label: 'Unischrauben 5×70 (Konterlatte)', name: A.screw.name, qty: cartons, unitLabel: cartons === 1 ? 'Karton' : 'Kartons', unit: num(A.screw.price), total: screwTotal, url: A.screw.url });
    if (asdFee) add({ group: 'own', cat: 'mounting', label: 'Mindermengenzuschlag', name: 'dachbaustoffe.de – Warenwert unter ' + eur(num(A.minOrder)), qty: 1, unitLabel: 'pauschal', unit: asdFee, total: asdFee });
    mnt.push({ key: 'asdHolders', qty: asdHolders, total: holderTotal }, { key: 'asdScrews', qty: cartons, total: screwTotal }, { key: 'asdFee', qty: asdFee ? 1 : 0, total: asdFee });
    const asd = { n: asdN, normal: n - asdN, holders: asdHolders, hookPositions, cartons, screws: asdHolders, fee: asdFee, holder };
    const mntCost = mnt.reduce((a, x) => a + x.total, 0);

    // 5 – Externe Arbeit
    let montage = null;
    const extRows = s.externals.map(x => {
      if (x.kind === 'montage') {
        const basisWp = x.useModuleWp ? wp : num(x.billingWp);
        const kwpBill = Math.round(n * basisWp) / 1000;          // Excel: =ROUND(D2*470,0)/1000
        const raw = num(x.rate) * kwpBill;                          // Excel: =MAX(1470, E18*D18)
        const minApplied = n > 0 && raw < num(x.minimum);
        const total = x.enabled && n > 0 ? Math.max(num(x.minimum), raw) : 0;
        montage = { basisWp, kwpBill, raw, minApplied, total };
        if (total !== 0) add({ group: 'ext', cat: 'labor', label: x.label, name: minApplied ? 'Mindestbetrag' : NF.nMax2.format(basisWp) + ' Wp je Modul', qty: kwpBill, unitLabel: 'kWp', unit: num(x.rate), total });
        return { total };
      }
      const qty = Math.max(0, num(x.qty));
      const total = x.enabled ? qty * num(x.price) : 0;
      if (x.enabled && total !== 0) add({ group: 'ext', cat: CAT[x.category] ? x.category : 'other', label: x.label, name: x.name, qty, unitLabel: qty === 1 ? 'pauschal' : 'Stk.', unit: num(x.price), total });
      return { total };
    });

    const own = positions.filter(p => p.group === 'own').reduce((a, p) => a + p.total, 0);
    const extSum = positions.filter(p => p.group === 'ext').reduce((a, p) => a + p.total, 0);
    const total = own + extSum;
    const cats = CATS.map(c => ({ key: c.key, label: c.label, color: CAT[c.key].color, value: positions.filter(p => p.cat === c.key).reduce((a, p) => a + p.total, 0) }));

    // Wirtschaftlichkeit
    const E = s.economy;
    const prod = kwp * num(E.specificYield);
    const selfWanted = E.selfMode === 'kwh' ? Math.max(0, num(E.selfKwh)) : prod * clamp(num(E.selfPct), 0, 100) / 100;
    const self = Math.min(selfWanted, prod);
    const feed = prod - self;
    const savings = self * num(E.priceCt) / 100 + feed * num(E.feedCt) / 100;
    const payback = savings > 0 ? total / savings : Infinity;

    return {
      n, wp, kwp, spec, purchase, delivered, weight, shipInfo, modCost, ship, inv, invCost, acKw, invCount, dcac: acKw > 0 ? kwp / acKw : null,
      cmp, cmpCost, mnt, mntCost, layout, asd, extRows, montage,
      positions, own, ext: extSum, total, cats,
      eco: { prod, self, selfWanted, feed, savings, payback, bal20: savings * 20 - total }
    };
  }

  /* ------------------------------------------------------------------ *
   * Template-Bausteine
   * ------------------------------------------------------------------ */
  const icon = (name, cls) => '<svg class="ico' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#i-' + name + '"/></svg>';

  function thumb(src, ico, cls) {
    return '<div class="thumb' + (src ? '' : ' is-fallback') + (cls ? ' ' + cls : '') + '">' +
      (src ? '<img src="' + esc(src) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.classList.add(\'is-fallback\');this.remove()">' : '') +
      icon(ico || 'list', 'thumb-ico') + '</div>';
  }

  function field(o) {
    const type = o.type || 'num';
    const v = o.value !== undefined ? o.value : getPath(state, o.bind);
    const display = type === 'text' ? (v == null ? '' : v) : fmtIn(v, type);
    const im = type === 'int' ? 'numeric' : (type === 'num' ? 'decimal' : (type === 'intlist' ? 'numeric' : ''));
    const attrs = [
      'class="input' + (o.inputCls ? ' ' + o.inputCls : '') + '"', 'type="text"',
      im ? 'inputmode="' + im + '"' : '',
      'data-bind="' + o.bind + '"', 'data-type="' + type + '"',
      o.min != null ? 'data-min="' + o.min + '"' : '', o.max != null ? 'data-max="' + o.max + '"' : '',
      o.step ? 'data-stepsize="' + o.step + '"' : '',
      o.rerender ? 'data-rerender="' + o.rerender + '"' : '',
      o.placeholder ? 'placeholder="' + esc(o.placeholder) + '"' : '',
      o.arrows ? 'data-arrows' : '',
      o.disabled ? 'disabled' : '',
      o.id ? 'id="' + o.id + '"' : '',
      'aria-label="' + esc(o.aria || o.label || '') + '"',
      'value="' + esc(display) + '"',
      'autocomplete="off"', 'spellcheck="false"'
    ].filter(Boolean).join(' ');
    const arrows = o.arrows ? '<span class="step-arrows"><button type="button" data-step="1" tabindex="-1" aria-label="erhöhen">' + icon('up') + '</button><button type="button" data-step="-1" tabindex="-1" aria-label="verringern">' + icon('down') + '</button></span>' : '';
    return '<label class="field' + (o.cls ? ' ' + o.cls : '') + '">' +
      (o.label ? '<span class="field-label">' + o.label + '</span>' : '') +
      '<span class="input-wrap' + (o.arrows ? ' stepper' : '') + (o.disabled ? ' is-disabled' : '') + '">' +
      (o.prefix ? '<span class="affix">' + o.prefix + '</span>' : '') +
      '<input ' + attrs + '>' +
      (o.suffix ? '<span class="affix">' + o.suffix + '</span>' : '') + arrows +
      '</span>' + (o.hint ? '<span class="field-hint">' + o.hint + '</span>' : '') + '</label>';
  }

  function selectField(o) {
    const v = getPath(state, o.bind);
    const opts = o.options.map(op => '<option value="' + esc(op[0]) + '"' + (String(op[0]) === String(v) ? ' selected' : '') + '>' + esc(op[1]) + '</option>').join('');
    return '<label class="field' + (o.cls ? ' ' + o.cls : '') + '">' + (o.label ? '<span class="field-label">' + o.label + '</span>' : '') +
      '<span class="input-wrap select-wrap"><select class="input" data-bind="' + o.bind + '" data-type="text"' + (o.rerender ? ' data-rerender="' + o.rerender + '"' : '') + ' aria-label="' + esc(o.aria || o.label || '') + '">' + opts + '</select>' + icon('down', 'select-caret') + '</span></label>';
  }

  function toggle(bind, label, rerender) {
    const v = !!getPath(state, bind);
    return '<label class="switch" title="' + esc(label) + '"><input type="checkbox" data-bind="' + bind + '" data-type="bool"' + (v ? ' checked' : '') + (rerender ? ' data-rerender="' + rerender + '"' : '') + '><span class="switch-ui" aria-hidden="true"></span><span class="sr-only">' + esc(label) + '</span></label>';
  }

  function segmented(path, options, rerender, cls) {
    const v = getPath(state, path);
    return '<div class="segmented' + (cls ? ' ' + cls : '') + '" role="radiogroup">' + options.map(o =>
      '<button type="button" role="radio" aria-checked="' + (v === o[0]) + '" class="' + (v === o[0] ? 'is-active' : '') + '" data-action="seg" data-path="' + path + '" data-value="' + esc(o[0]) + '" data-rerender="' + (rerender || '') + '">' + esc(o[1]) + '</button>').join('') + '</div>';
  }

  function linkBtns(path, url, query) {
    let h = '';
    if (url) h += '<a class="chip" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer" title="Shop öffnen">' + icon('ext') + '<span>Shop</span></a>';
    if (url && Shop.isShopifyProduct(url)) h += '<button type="button" class="chip" data-action="fetch-price" data-path="' + path + '" title="Aktuellen Preis aus dem Shop abrufen">' + icon('refresh') + '<span>Preis abrufen</span></button>';
    if (query) h += '<a class="chip" href="' + esc(Shop.idealoUrl(query)) + '" target="_blank" rel="noopener noreferrer" title="Preisvergleich bei idealo">' + icon('search') + '<span>idealo</span></a>';
    return h;
  }

  const catOptions = CATS.map(c => [c.key, c.label]);

  /* ------------------------------------------------------------------ *
   * Abschnitte rendern
   * ------------------------------------------------------------------ */
  function shipNoteHtml(r) {
    const T = state.settings.shipTable, si = r.shipInfo || {};
    return '<div class="ship-note">' + icon('truck') + '<span>Versand laut solarhandel24-Tabelle: <strong>' + NF.n1.format(r.weight) + ' kg</strong> Liefergewicht → <strong>' + esc(si.label || '') + ' = ' + esc(eur(r.ship)) + '</strong>.' +
      (si.over ? ' Gewicht über der Tabelle – bitte Angebot anfragen.' : '') +
      ' <a href="' + esc(T.url) + '" target="_blank" rel="noopener noreferrer">Tabelle (Stand ' + esc(T.checkedAt.split('-').reverse().join('.')) + ')</a></span></div>';
  }

  function catalogStatusText() {
    const c = state.moduleCatalog;
    if (ui.busy.has('catalog')) return 'Wird aktualisiert …';
    let t = '';
    try { t = new Date(c.fetchedAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (e) { t = ''; }
    return (c.items || []).length + ' Module von ' + (c.source || 'solarhandel24.de') + (t ? ' · Stand ' + t : '');
  }

  function moduleOptions(selectedId, isManual) {
    const items = state.moduleCatalog.items || [];
    const groups = {};
    items.forEach(it => { (groups[it.brand] = groups[it.brand] || []).push(it); });
    let h = '';
    Object.keys(groups).sort().forEach(b => {
      h += '<optgroup label="' + esc(b) + ' · solarhandel24.de">';
      groups[b].forEach(it => {
        const short = it.title.replace(/^(AIKO Solar|AIKO|JA Solar|Ja Solar)\s*/i, '').replace(/^\d{3}\s*W\s*/i, '');
        const best = it.palletQty && it.palletPrice ? it.palletPrice / it.palletQty : tierPrice(it, 1e9);
        h += '<option value="' + esc(it.id) + '"' + (!isManual && it.id === selectedId ? ' selected' : '') + '>' + esc(it.brand + ' ' + it.wp + ' W · ' + short + ' · ab ' + eur(best)) + (it.available === false ? ' (nicht verfügbar)' : '') + '</option>';
      });
      h += '</optgroup>';
    });
    h += '<optgroup label="Sonstiges"><option value="__manual"' + (isManual ? ' selected' : '') + '>Eigenes Modul (manuelle Eingabe)</option></optgroup>';
    return h;
  }

  function renderModules() {
    const m = state.modules, max = state.settings.sliderMax;
    const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => '<span>' + Math.round(max * f) + '</span>').join('');
    const sh = m.shipping;
    const spec = moduleSpec();
    const it = spec.item;
    const isManual = m.source !== 'shop';
    const missing = !isManual && !it;
    const shipLabel = { flat: 'Versand pauschal', perModule: 'Versand je Modul', perPallet: 'Versand je Palette' }[sh.mode] || 'Versandkosten';
    const countBlock =
      '<div class="count-block">' +
        '<div class="count-head"><span class="field-label" id="mcLabel">Anzahl Module</span><span class="count-hint" data-out="countHint"></span></div>' +
        '<div class="count-row">' +
          '<div class="input-wrap stepper stepper-lg">' +
            '<button type="button" class="step-side" data-step="-1" aria-label="Ein Modul weniger">' + icon('minus') + '</button>' +
            '<input id="mcInput" class="input count-input" type="text" inputmode="numeric" data-bind="modules.count" data-type="int" data-min="0" data-max="' + max + '" data-arrows aria-labelledby="mcLabel" value="' + m.count + '" autocomplete="off">' +
            '<span class="step-arrows"><button type="button" data-step="1" aria-label="erhöhen">' + icon('up') + '</button><button type="button" data-step="-1" aria-label="verringern">' + icon('down') + '</button></span>' +
            '<button type="button" class="step-side" data-step="1" aria-label="Ein Modul mehr">' + icon('plus') + '</button>' +
          '</div>' +
          '<div class="range-wrap">' +
            '<input type="range" class="range" id="mcRange" min="0" max="' + max + '" step="1" value="' + Math.min(m.count, max) + '" data-bind="modules.count" data-type="int" aria-labelledby="mcLabel">' +
            '<div class="range-scale">' + ticks + '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    const picker =
      '<div class="module-pick">' +
        '<div class="mp-head"><span class="field-label" id="modSelLabel">Modultyp</span>' +
          '<span class="catalog-status"><span data-out="catalogStatus">' + esc(catalogStatusText()) + '</span>' +
          '<button type="button" class="chip" data-action="catalog-refresh"' + (ui.busy.has('catalog') ? ' disabled' : '') + ' title="Module, Preise und Paletten live von solarhandel24.de laden">' + icon('refresh') + '<span>Aktualisieren</span></button></span></div>' +
        '<span class="input-wrap select-wrap select-lg"><select class="input" id="moduleSelect" aria-labelledby="modSelLabel">' + moduleOptions(m.productId, isManual) + '</select>' + icon('down', 'select-caret') + '</span>' +
        (missing ? '<p class="warn-text">' + icon('alert') + ' Das gewählte Modul ist im aktuellen Katalog nicht mehr vorhanden – bitte neu wählen.</p>' : '') +
      '</div>';

    let body;
    if (!isManual && it) {
      const pq = spec.palletQty;
      const tiers = (it.tiers || []).map(t => '<span class="tier" data-kind="single" data-qty="' + t[0] + '"><b>ab ' + t[0] + '</b> ' + esc(eur(num(t[1]))) + '</span>').join('') +
        (it.palletPrice ? '<span class="tier tier-pallet" data-kind="pallet"><b>Palette ' + pq + ' Stk.</b> ' + esc(eur(num(it.palletPrice))) + ' <span class="muted">(' + esc(eur(it.palletPrice / pq)) + '/Stk.)</span></span>' : '');
      body =
        '<div class="product">' +
          thumb(it.img, 'panel', 'thumb-lg') +
          '<div class="product-info">' +
            '<span class="product-title">' + esc(it.title) + '</span>' +
            '<div class="chips">' +
              '<span class="chip chip-static">' + icon('bolt') + it.wp + ' Wp</span>' +
              (it.widthMm ? '<span class="chip chip-static">' + icon('grid') + it.heightMm + ' × ' + it.widthMm + ' mm</span>' : '') +
              (it.weightKg ? '<span class="chip chip-static">' + icon('truck') + NF.nMax2.format(it.weightKg) + ' kg</span>' : '') +
              (it.singleUrl ? '<a class="chip" href="' + esc(it.singleUrl) + '" target="_blank" rel="noopener noreferrer">' + icon('ext') + '<span>Einzeln</span></a>' : '') +
              (it.palletUrl ? '<a class="chip" href="' + esc(it.palletUrl) + '" target="_blank" rel="noopener noreferrer">' + icon('ext') + '<span>Palette</span></a>' : '') +
              (it.available === false ? '<span class="pill pill-warn">derzeit nicht verfügbar</span>' : '') +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="buy-row">' +
          '<div class="field"><span class="field-label">Bezugsart</span>' +
            segmented('modules.buyMode', [['single', 'Einzeln (Staffel)'], ['pallet', 'Palette (' + pq + ' Stk.)'], ['mixed', 'Optimal']], 'modules', 'segmented-wide') + '</div>' +
          '<div class="tiers" aria-label="Preise solarhandel24.de">' + tiers + '</div>' +
        '</div>' +
        '<div class="grid grid-4">' +
          selectField({ label: 'Versandart', bind: 'modules.shipping.mode', rerender: 'modules', options: [['shop24', 'solarhandel24 (nach Gewicht)'], ['none', 'Kein Versand'], ['flat', 'Pauschal'], ['perModule', 'Pro Modul'], ['perPallet', 'Pro Palette']] }) +
          (sh.mode === 'none' || sh.mode === 'shop24' ? '' : field({ label: shipLabel, bind: 'modules.shipping.amount', suffix: '€', arrows: true, step: sh.mode === 'perModule' ? 0.5 : 10, min: 0 })) +
        '</div>';
    } else {
      body =
        '<div class="product">' +
          thumb(m.img, 'panel', 'thumb-lg') +
          '<div class="product-info">' +
            '<input class="inline-edit inline-strong" data-bind="modules.name" data-type="text" value="' + esc(m.name) + '" aria-label="Modulbezeichnung" spellcheck="false">' +
            '<input class="inline-edit inline-muted" data-bind="modules.title" data-type="text" value="' + esc(m.title) + '" aria-label="Produktbeschreibung" placeholder="Produktbeschreibung" spellcheck="false">' +
            '<div class="chips">' + linkBtns('modules', m.url, m.title || m.name) + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="grid grid-4">' +
          field({ label: 'Leistung je Modul', bind: 'modules.wp', suffix: 'Wp', arrows: true, step: 5, min: 0 }) +
          field({ label: 'Preis je Modul', bind: 'modules.price', suffix: '€', arrows: true, step: 0.5, min: 0 }) +
          selectField({ label: 'Versandart', bind: 'modules.shipping.mode', rerender: 'modules', options: [['shop24', 'solarhandel24 (nach Gewicht)'], ['none', 'Kein Versand'], ['flat', 'Pauschal'], ['perModule', 'Pro Modul'], ['perPallet', 'Pro Palette']] }) +
          (sh.mode === 'none' || sh.mode === 'shop24' ? '' : field({ label: shipLabel, bind: 'modules.shipping.amount', suffix: '€', arrows: true, step: sh.mode === 'perModule' ? 0.5 : 10, min: 0 })) +
          (sh.mode === 'perPallet' ? field({ label: 'Module je Palette', bind: 'modules.shipping.palletSize', type: 'int', suffix: 'Stk.', arrows: true, min: 1 }) : '') +
          (sh.mode === 'shop24' || sh.mode === 'perPallet' ? field({ label: 'Gewicht je Modul', bind: 'modules.weightKg', suffix: 'kg', arrows: true, step: 0.5, min: 0 }) : '') +
        '</div>';
    }
    $('#modulesBody').innerHTML = countBlock + picker + body +
      '<div class="calc-line" data-out-html="modulesCalc"></div>' +
      '<div class="status-note" data-out-html="shipNote"></div>' +
      '<div class="status-note" data-out-html="moduleSurplus"></div>' +
      (isManual ? '<details class="more"><summary>' + icon('edit') + 'Produktlink, Bild &amp; Modulmaße</summary><div class="grid grid-2">' +
        field({ label: 'Shop-Link', bind: 'modules.url', type: 'text', placeholder: 'https://…', rerender: 'modules' }) +
        field({ label: 'Bild-URL', bind: 'modules.img', type: 'text', placeholder: 'https://…', rerender: 'modules' }) +
        field({ label: 'Modulbreite', bind: 'modules.widthMm', type: 'int', suffix: 'mm', hint: 'Für den Belegungsplan', min: 0 }) +
        field({ label: 'Modulhöhe', bind: 'modules.heightMm', type: 'int', suffix: 'mm', min: 0 }) +
      '</div></details>' : '');
    paintRanges();
  }

  /** Moduldropdown: Katalogmodul wählen oder auf manuelle Eingabe umschalten */
  function selectModule(value) {
    const m = state.modules;
    if (value === '__manual') {
      if (m.source === 'shop') {
        // aktuelle Shop-Daten als Startwerte für die manuelle Eingabe übernehmen
        const spec = moduleSpec(), r = ui.r;
        if (spec.item) {
          Object.assign(m, { name: spec.name, title: spec.title, wp: spec.wp, url: spec.url, img: spec.img, widthMm: spec.widthMm, heightMm: spec.heightMm, weightKg: spec.weightKg });
          m.price = r && r.n > 0 ? Math.round(r.modCost / r.n * 100) / 100 : tierPrice(spec.item, 1);
          m.shipping.palletSize = spec.palletQty;
        }
      }
      m.source = 'manual';
    } else {
      m.source = 'shop';
      m.productId = value;
    }
    renderModules(); renderMounting(); update();
  }

  async function refreshCatalog(silent) {
    if (ui.busy.has('catalog')) return;
    ui.busy.add('catalog');
    $$('[data-out="catalogStatus"]').forEach(el => { el.textContent = 'Wird aktualisiert …'; });
    const btn = $('[data-action="catalog-refresh"]');
    if (btn) { btn.disabled = true; btn.classList.add('is-loading'); }
    try {
      const cfg = state.settings.moduleShop || {};
      const items = await Shop.fetchModuleCatalog(cfg);
      const sel = (state.moduleCatalog.items || []).find(x => x.id === state.modules.productId);
      const neu = items.find(x => x.id === state.modules.productId);
      if (sel && !neu) items.push(Object.assign({}, sel, { available: false, stale: true }));
      const changed = sel && neu && (sel.palletPrice !== neu.palletPrice || JSON.stringify(sel.tiers) !== JSON.stringify(neu.tiers));
      state.moduleCatalog = { source: cfg.domain || 'solarhandel24.de', fetchedAt: nowIso(), items: items };
      ui.busy.delete('catalog');
      renderModules(); renderMounting(); update();
      if (!silent) toast('Modulkatalog aktualisiert: ' + items.length + ' Module von ' + state.moduleCatalog.source + '.', 'ok');
      else if (changed) toast('Neue Modulpreise von ' + state.moduleCatalog.source + ' übernommen.', 'info');
    } catch (e) {
      ui.busy.delete('catalog');
      renderModules(); update();
      if (!silent) toast('Modulkatalog konnte nicht geladen werden: ' + (e.message || 'Netzwerkfehler') + '. Es werden die zuletzt gespeicherten Preise verwendet.', 'err');
    }
  }

  function inverterOptions(selected) {
    const lib = state.library.inverters;
    const groups = {};
    lib.forEach(x => { (groups[x.type || 'Andere'] = groups[x.type || 'Andere'] || []).push(x); });
    const order = ['Hybrid', 'String', 'Mikro'].concat(Object.keys(groups).filter(k => !['Hybrid', 'String', 'Mikro'].includes(k)));
    let h = '<option value=""' + (selected ? '' : ' selected') + '>– Wechselrichter wählen –</option>';
    order.forEach(g => {
      if (!groups[g]) return;
      h += '<optgroup label="' + esc(g === 'Hybrid' ? 'Hybrid-Wechselrichter' : g === 'String' ? 'String-Wechselrichter' : g) + '">';
      groups[g].slice().sort((a, b) => (a.brand + a.model).localeCompare(b.brand + b.model, 'de', { numeric: true })).forEach(x => {
        h += '<option value="' + esc(x.id) + '"' + (x.id === selected ? ' selected' : '') + '>' + esc((x.brand + ' ' + x.model).trim() || x.title || 'Ohne Namen') + ' · ' + NF.nMax2.format(num(x.kw)) + ' kW · ' + esc(eur(num(x.price))) + '</option>';
      });
      h += '</optgroup>';
    });
    return h;
  }

  function renderInverters() {
    const host = $('#invertersBody');
    const slots = state.inverters.map((slot, i) => {
      const lib = libById(slot.libId);
      const li = lib ? state.library.inverters.indexOf(lib) : -1;
      const missing = slot.libId && !lib;
      return '<div class="inv-slot">' +
        '<div class="inv-media">' + thumb(lib && lib.img, 'inverter', 'thumb-inv') + (lib ? '<span class="badge badge-' + esc((lib.type || '').toLowerCase()) + '">' + esc(lib.type) + '</span>' : '') + '</div>' +
        '<div class="inv-main">' +
          '<span class="field-label">Wechselrichter ' + (i + 1) + '</span>' +
          '<span class="input-wrap select-wrap"><select class="input" data-bind="inverters.' + i + '.libId" data-type="text" data-rerender="inverters" aria-label="Wechselrichter ' + (i + 1) + '">' + inverterOptions(lib ? lib.id : '') + '</select>' + icon('down', 'select-caret') + '</span>' +
          (missing ? '<p class="warn-text">' + icon('alert') + ' Der gewählte Wechselrichter existiert nicht mehr in der Bibliothek.</p>' : '') +
          (lib ? '<div class="inv-meta"><span>' + esc(lib.title || (lib.brand + ' ' + lib.model)) + '</span></div>' +
            '<div class="chips">' +
              '<span class="chip chip-static">' + icon('bolt') + NF.nMax2.format(num(lib.kw)) + ' kW AC</span>' +
              '<span class="chip chip-static">' + icon('coins') + esc(eur(num(lib.price))) + ' / Stk.</span>' +
              linkBtns('library.inverters.' + li, lib.url, (lib.brand + ' ' + lib.model).trim()) +
            '</div>' : '') +
        '</div>' +
        '<div class="inv-side">' +
          field({ label: 'Anzahl', bind: 'inverters.' + i + '.qty', type: 'int', arrows: true, min: 0, max: 99, cls: 'field-qty' }) +
          '<div class="inv-total"><span class="field-label">Summe</span><strong data-out="inv.' + i + '.total"></strong></div>' +
          '<button type="button" class="btn btn-icon btn-ghost" data-action="inv-remove" data-idx="' + i + '" title="Entfernen" aria-label="Wechselrichter ' + (i + 1) + ' entfernen">' + icon('trash') + '</button>' +
        '</div>' +
      '</div>';
    }).join('');
    host.innerHTML =
      (slots || '<div class="empty-note">Noch kein Wechselrichter ausgewählt.</div>') +
      '<div class="row-actions">' +
        '<button type="button" class="btn btn-soft" data-action="inv-add">' + icon('plus') + '<span>Wechselrichter hinzufügen</span></button>' +
        '<button type="button" class="btn btn-ghost" data-action="open-settings" data-tab="inverters">' + icon('search') + '<span>Bibliothek &amp; Online-Suche</span></button>' +
      '</div>' +
      '<div class="status-note" data-out-html="dcac"></div>';
  }

  function itemRow(prefix, i, it, opts) {
    const p = prefix + '.' + i;
    const cat = CAT[it.category] || CAT.other;
    return '<div class="item-row' + (it.enabled ? '' : ' is-off') + '">' +
      '<div class="item-toggle">' + toggle(p + '.enabled', 'Position aktiv', opts.rerender) + '</div>' +
      thumb(it.img, cat.icon) +
      '<div class="item-main">' +
        '<input class="inline-edit inline-strong" data-bind="' + p + '.label" data-type="text" value="' + esc(it.label) + '" aria-label="Artikel" spellcheck="false">' +
        '<input class="inline-edit inline-muted" data-bind="' + p + '.name" data-type="text" value="' + esc(it.name) + '" aria-label="Marke / Produkt" placeholder="Marke / Produkt" spellcheck="false">' +
        '<div class="chips">' + linkBtns(p, it.url, opts.idealo ? (it.title || it.name) : '') + '</div>' +
      '</div>' +
      '<div class="item-fields">' +
        field({ label: 'Menge', bind: p + '.qty', type: 'num', arrows: true, min: 0, step: 1, cls: 'field-qty' }) +
        field({ label: 'Preis/Stk.', bind: p + '.price', suffix: '€', min: 0, cls: 'field-price', arrows: true, step: opts.priceStep || 1 }) +
        '<div class="item-total"><span class="field-label">Summe</span><strong data-out="' + opts.out + '.' + i + '.total"></strong></div>' +
      '</div>' +
      '<div class="item-actions">' +
        '<button type="button" class="btn btn-icon btn-ghost" data-action="' + opts.remove + '" data-idx="' + i + '" title="Entfernen" aria-label="' + esc(it.label) + ' entfernen">' + icon('trash') + '</button>' +
      '</div>' +
      '<details class="more item-more"><summary>' + icon('edit') + 'Details</summary><div class="grid grid-2">' +
        selectField({ label: 'Kategorie (Diagramm)', bind: p + '.category', options: catOptions, rerender: opts.rerender }) +
        (opts.desc ? '<label class="field"><span class="field-label">Beschreibung</span><textarea class="input textarea" rows="4" data-bind="' + p + '.desc" data-type="text">' + esc(it.desc || '') + '</textarea></label>'
          : field({ label: 'Produktbeschreibung', bind: p + '.title', type: 'text' })) +
        field({ label: 'Shop-Link', bind: p + '.url', type: 'text', placeholder: 'https://…', rerender: opts.rerender }) +
        field({ label: 'Bild-URL', bind: p + '.img', type: 'text', placeholder: 'https://…', rerender: opts.rerender }) +
      '</div></details>' +
    '</div>';
  }

  function renderComponents() {
    $('#componentsBody').innerHTML =
      '<div class="item-list">' + state.components.map((c, i) => itemRow('components', i, c, { rerender: 'components', remove: 'cmp-remove', out: 'cmp', idealo: true })).join('') + '</div>' +
      '<div class="row-actions"><button type="button" class="btn btn-soft" data-action="cmp-add">' + icon('plus') + '<span>Position hinzufügen</span></button></div>';
  }

  function renderMounting() {
    const MT = state.mounting, L = MT.layout;
    const desc = {
      ratio: 'Die Mengen wachsen automatisch mit der Modulanzahl mit – Basis sind die Mengen aus der Excel (z. B. 90 Dachhaken bei 37 Modulen). Es wird immer aufgerundet.',
      layout: 'Mengen werden aus dem Belegungsplan berechnet: Reihen, Modulmaße, Schienenlänge und Hakenabstand. Mittelklemmen = Schienen × (Module − 1), Endklemmen = 2 × Schienen je Reihe.',
      manual: 'Feste Mengen – sie ändern sich NICHT, wenn die Modulanzahl angepasst wird.'
    }[MT.mode];
    let settings = '';
    if (MT.mode === 'manual') {
      settings = '<div class="mnt-banner">' + icon('alert') + '<span>Manuelle Mengen folgen der Modulanzahl nicht automatisch.</span>' +
        '<button type="button" class="btn btn-soft btn-sm" data-action="mnt-scale">' + icon('refresh') + '<span>Auf aktuelle Modulanzahl hochrechnen</span></button></div>';
    } else if (MT.mode === 'layout') {
      settings =
        '<div class="layout-grid">' +
          '<div class="field"><span class="field-label">Reihen</span>' + segmented('mounting.layout.rowMode', [['auto', 'Automatisch'], ['custom', 'Individuell']], 'mounting') + '</div>' +
          (L.rowMode === 'custom'
            ? '<div class="field field-wide">' + field({ label: 'Module je Reihe (kommagetrennt)', bind: 'mounting.layout.customRows', type: 'intlist', placeholder: 'z. B. 7, 6, 6, 6' }) + '<button type="button" class="btn btn-ghost btn-sm" data-action="distribute-rows">' + icon('grid') + '<span>Aus Modulanzahl verteilen</span></button></div>'
            : field({ label: 'Anzahl Reihen', bind: 'mounting.layout.rows', type: 'int', arrows: true, min: 1, max: 100 })) +
          '<div class="field"><span class="field-label">Ausrichtung</span>' + segmented('mounting.layout.orientation', [['portrait', 'Hochkant'], ['landscape', 'Quer']], 'mounting') + '</div>' +
          field({ label: 'Schienenlänge', bind: 'mounting.layout.railLengthMm', type: 'int', suffix: 'mm', arrows: true, step: 100, min: 100 }) +
          field({ label: 'Schienen je Reihe', bind: 'mounting.layout.railsPerRow', type: 'int', arrows: true, min: 1, max: 6 }) +
          field({ label: 'Max. Hakenabstand', bind: 'mounting.layout.hookSpacingMm', type: 'int', suffix: 'mm', arrows: true, step: 50, min: 100 }) +
          field({ label: 'Randabstand Haken', bind: 'mounting.layout.hookEdgeMm', type: 'int', suffix: 'mm', arrows: true, step: 50, min: 0 }) +
          field({ label: 'Modulabstand (Klemme)', bind: 'mounting.layout.gapMm', type: 'int', suffix: 'mm', arrows: true, min: 0 }) +
          field({ label: 'Schienenüberstand je Seite', bind: 'mounting.layout.overhangMm', type: 'int', suffix: 'mm', arrows: true, step: 10, min: 0 }) +
          field({ label: 'Reserve Kleinteile', bind: 'mounting.layout.reservePct', suffix: '%', arrows: true, min: 0, max: 100 }) +
          '<label class="check"><input type="checkbox" data-bind="mounting.layout.reuseOffcuts" data-type="bool"' + (L.reuseOffcuts ? ' checked' : '') + '><span>Schienenreste wiederverwenden</span></label>' +
        '</div>' +
        '<div class="layout-preview"><div class="lp-head"><span class="field-label">Belegungsvorschau</span><span class="muted small" data-out="layoutInfo"></span></div><div id="layoutPreview"></div><div class="status-note" data-out-html="layoutWarn"></div></div>';
    }
    const isRatio = MT.mode === 'ratio', isManual = MT.mode === 'manual';
    const A = MT.asd, holder = A.holders[A.type] || A.holders['7300'];
    const asdBlock =
      '<div class="asd-block">' +
        '<div class="asd-head">' +
          '<span class="asd-icon">' + icon('layers') + '</span>' +
          '<div class="asd-titles"><strong>Aufsparrendämmung</strong><span class="muted small">Otto Lehmann Aufdachmodulhalter statt Dachhaken – wählbar pro Modulanzahl</span></div>' +
        '</div>' +
        '<div class="asd-grid">' +
          '<div class="field asd-count"><span class="field-label" id="asdLabel">Module mit Aufsparrendämmung</span>' +
            '<div class="asd-count-row">' +
              '<span class="input-wrap stepper"><input class="input" type="text" inputmode="numeric" data-bind="mounting.asd.modules" data-type="int" data-min="0" data-max="' + state.settings.sliderMax + '" data-arrows aria-labelledby="asdLabel" value="' + num(A.modules) + '" autocomplete="off">' +
              '<span class="step-arrows"><button type="button" data-step="1" tabindex="-1" aria-label="erhöhen">' + icon('up') + '</button><button type="button" data-step="-1" tabindex="-1" aria-label="verringern">' + icon('down') + '</button></span></span>' +
              '<input type="range" class="range" id="asdRange" min="0" max="' + state.modules.count + '" step="1" value="' + Math.min(num(A.modules), state.modules.count) + '" data-bind="mounting.asd.modules" data-type="int" aria-labelledby="asdLabel">' +
            '</div>' +
            '<div class="asd-quick"><button type="button" class="chip" data-action="asd-set" data-value="0">Keine</button><button type="button" class="chip" data-action="asd-set" data-value="half">Hälfte</button><button type="button" class="chip" data-action="asd-set" data-value="all">Alle</button></div>' +
          '</div>' +
          selectField({ label: 'Halter-Typ', bind: 'mounting.asd.type', rerender: 'mounting', options: [['7300', 'Lehmann 7300 (Standard)'], ['7302', 'Lehmann HVS 7302 (horiz./vert./seitl.)']] }) +
          field({ label: 'Preis je Halter', bind: 'mounting.asd.holders.' + A.type + '.price', suffix: '€', arrows: true, step: 0.5, min: 0, hint: 'Je nach Ziegelmodell/Farbe ca. 30–46 €' }) +
        '</div>' +
        '<div class="asd-split" data-out-html="asdSplit"></div>' +
        '<div class="status-note" data-out-html="asdWarn"></div>' +
        '<div class="chips">' +
          '<a class="chip" href="' + esc(holder.url) + '" target="_blank" rel="noopener noreferrer">' + icon('ext') + '<span>Halter bei dachbaustoffe.de</span></a>' +
          '<a class="chip" href="' + esc(A.screw.url) + '" target="_blank" rel="noopener noreferrer">' + icon('ext') + '<span>Unischrauben 5×70</span></a>' +
          '<a class="chip" href="' + esc(A.manualUrl) + '" target="_blank" rel="noopener noreferrer">' + icon('info') + '<span>Einbauanleitung (PDF)</span></a>' +
          '<a class="chip" href="https://www.ottolehmann.com/solar" target="_blank" rel="noopener noreferrer">' + icon('ext') + '<span>Otto Lehmann Solar</span></a>' +
        '</div>' +
        '<details class="more"><summary>' + icon('info') + 'Hinweise zur Montage</summary><ul class="asd-notes">' +
          '<li>Der Halter ersetzt einen Dachziegel – die <b>Metalldachplatte muss zum Ziegelmodell passen</b> (über 90 Modelle, Preis je nach Modell/Farbe).</li>' +
          '<li>Bei Aufsparrendämmung wird die Verstärkungsschiene an der <b>Konterlatte (min. 4/6 cm)</b> verschraubt – max. 150 mm Abstand zur Konterlattenmitte.</li>' +
          '<li>Dafür je Halter eine <b>Unischraube 5,0 × 70 mm</b> (Art.-Nr. 8611001001000) – nicht im Lieferumfang, Karton à 200 Stk.</li>' +
          '<li>Anzahl der Halter nach Wind-/Schneelast prüfen (Lehmann Modulrechner). Die Planung setzt 1 Halter je Hakenposition an.</li>' +
          '<li>Lieferzeit bei dachbaustoffe.de laut Shop 6–8 Wochen; unter ' + esc(eur(num(A.minOrder))) + ' Warenwert ' + esc(eur(num(A.minOrderFee))) + ' Mindermengenzuschlag.</li>' +
        '</ul></details>' +
      '</div>';
    const asdRow = (key, label, name, priceField, sub) => '<tr data-asd-row="' + key + '" class="asd-row"' + ((key === 'asdFee' ? true : !num(A.modules)) ? ' hidden' : '') + '>' +
      '<td class="mt-art">' + thumb('', key === 'asdFee' ? 'coins' : 'layers', 'thumb-sm') + '<div><strong class="asd-label">' + esc(label) + '</strong><span class="inline-muted asd-name">' + esc(name) + '</span></div></td>' +
      '<td class="mt-qty" data-label="Menge">' + (key === 'asdFee' ? '<strong class="qty-out">pauschal</strong>' : '<strong class="qty-out" data-out="mnt.' + key + '.qty"></strong><span class="qty-sub" data-out="mnt.' + key + '.sub"></span>') + '</td>' +
      '<td class="mt-price" data-label="Einzelpreis">' + priceField + '</td>' +
      '<td class="mt-sum" data-label="Summe"><strong data-out="mnt.' + key + '.total"></strong></td></tr>';
    const asdRows =
      asdRow('asdHolders', holder.label + ' (Aufsparrendämmung)', holder.name, field({ bind: 'mounting.asd.holders.' + A.type + '.price', suffix: '€', min: 0, aria: 'Preis je Halter', cls: 'field-compact' })) +
      asdRow('asdScrews', A.screw.label + ' (Karton)', A.screw.name, field({ bind: 'mounting.asd.screw.price', suffix: '€', min: 0, aria: 'Preis je Karton', cls: 'field-compact' })) +
      asdRow('asdFee', 'Mindermengenzuschlag', 'dachbaustoffe.de – Warenwert unter ' + eur(num(A.minOrder)), '<span class="muted">' + esc(eur(num(A.minOrderFee))) + '</span>');
    const rows = MOUNT_KEYS.map(k => {
      const it = MT.items[k], p = 'mounting.items.' + k;
      return '<tr>' +
        '<td class="mt-art">' + thumb(it.img, 'wrench', 'thumb-sm') + '<div><input class="inline-edit inline-strong" data-bind="' + p + '.label" data-type="text" value="' + esc(it.label) + '" aria-label="Artikel" spellcheck="false">' +
          '<input class="inline-edit inline-muted" data-bind="' + p + '.name" data-type="text" value="' + esc(it.name) + '" aria-label="Produkt" spellcheck="false"><div class="chips">' + linkBtns(p, it.url, '') + '</div></div></td>' +
        '<td class="mt-qty" data-label="Menge">' + (isManual ? field({ bind: p + '.manual', type: 'int', arrows: true, min: 0, aria: 'Menge ' + it.label, cls: 'field-compact' }) : '<strong class="qty-out" data-out="mnt.' + k + '.qty"></strong><span class="qty-sub" data-out="mnt.' + k + '.sub"></span>') + '</td>' +
        '<td class="mt-price" data-label="Einzelpreis">' + field({ bind: p + '.price', suffix: '€', min: 0, aria: 'Einzelpreis ' + it.label, cls: 'field-compact' }) + '</td>' +
        '<td class="mt-sum" data-label="Summe"><strong data-out="mnt.' + k + '.total"></strong></td>' +
      '</tr>';
    }).join('');
    $('#mountingBody').innerHTML =
      segmented('mounting.mode', [['ratio', 'Proportional (Excel)'], ['layout', 'Belegungsplan'], ['manual', 'Manuell']], 'mounting', 'segmented-wide') +
      '<p class="hint">' + icon('info') + desc + '</p>' + settings +
      (isManual ? '' : '<div class="mnt-basis">' + icon('panel') + '<span data-out-html="mountBasis"></span></div>') +
      asdBlock +
      '<div class="table-wrap"><table class="mt mt-' + MT.mode + '"><thead><tr><th>Artikel</th><th>Menge</th><th>Einzelpreis</th><th class="num">Summe</th></tr></thead><tbody>' + rows + asdRows + '</tbody>' +
      '<tfoot><tr><td colspan="3">Summe Montagesystem</td><td class="num"><strong data-out="sumMounting"></strong></td></tr></tfoot></table></div>' +
      (isRatio ? '<details class="more"><summary>' + icon('edit') + 'Referenzmengen anpassen (Basis der Hochrechnung)</summary>' +
        '<p class="muted small" style="margin:0 0 12px">Diese Mengen gelten für die Referenz-Modulanzahl und werden auf die aktuelle Modulanzahl hochgerechnet. Standard: Werte aus der Excel für 37 Module.</p>' +
        '<div class="grid grid-3">' + field({ label: 'Referenz-Modulanzahl', bind: 'mounting.refModules', type: 'int', suffix: 'Module', arrows: true, min: 1 }) +
        MOUNT_KEYS.map(k => field({ label: MT.items[k].label, bind: 'mounting.items.' + k + '.ref', type: 'num', suffix: 'Stk.', arrows: true, min: 0 })).join('') +
        '</div></details>' : '');
  }

  function renderLabor() {
    const html = state.externals.map((x, i) => {
      if (x.kind === 'montage') {
        const p = 'externals.' + i;
        return '<div class="item-row montage-row' + (x.enabled ? '' : ' is-off') + '">' +
          '<div class="item-toggle">' + toggle(p + '.enabled', 'Montage aktiv', 'labor') + '</div>' +
          thumb('', 'hardhat') +
          '<div class="item-main"><input class="inline-edit inline-strong" data-bind="' + p + '.label" data-type="text" value="' + esc(x.label) + '" aria-label="Bezeichnung" spellcheck="false"><div class="formula" data-out-html="montageFormula"></div></div>' +
          '<div class="item-fields"><div class="item-total"><span class="field-label">Summe</span><strong data-out="ext.' + i + '.total"></strong></div></div>' +
          '<div class="item-actions"></div>' +
          '<div class="montage-grid">' +
            field({ label: 'Montagekosten (€ pro kWp)', bind: p + '.rate', suffix: '€', arrows: true, step: 5, min: 0 }) +
            field({ label: 'Mindestbetrag', bind: p + '.minimum', suffix: '€', arrows: true, step: 10, min: 0 }) +
            field({ label: 'Abrechnungsbasis je Modul', bind: p + '.billingWp', suffix: 'Wp', arrows: true, step: 5, min: 0, disabled: x.useModuleWp }) +
            '<label class="check"><input type="checkbox" data-bind="' + p + '.useModuleWp" data-type="bool" data-rerender="labor"' + (x.useModuleWp ? ' checked' : '') + '><span>Modulleistung verwenden</span></label>' +
          '</div>' +
        '</div>';
      }
      return itemRow('externals', i, x, { rerender: 'labor', remove: 'ext-remove', out: 'ext', desc: true, priceStep: 10 });
    }).join('');
    $('#laborBody').innerHTML = '<div class="item-list">' + html + '</div>' +
      '<div class="row-actions"><button type="button" class="btn btn-soft" data-action="ext-add">' + icon('plus') + '<span>Externe Position hinzufügen</span></button></div>';
  }

  function renderEconomy() {
    const E = state.economy;
    $('#economyBody').innerHTML =
      '<div class="grid grid-4">' +
        field({ label: 'Spez. Ertrag (kWh/kWp)', bind: 'economy.specificYield', suffix: 'kWh', arrows: true, step: 10, min: 0, hint: 'Aus der Simulation: 1.007' }) +
        field({ label: 'Strompreis (ct/kWh)', bind: 'economy.priceCt', suffix: 'ct', arrows: true, step: 0.5, min: 0 }) +
        '<div class="field eco-self"><div class="label-row"><span class="field-label">Eigenverbrauch</span>' +
          '<div class="segmented segmented-xs" role="radiogroup" aria-label="Einheit Eigenverbrauch">' + [['kwh', 'kWh'], ['pct', '%']].map(o =>
            '<button type="button" role="radio" aria-checked="' + (E.selfMode === o[0]) + '" class="' + (E.selfMode === o[0] ? 'is-active' : '') + '" data-action="eco-mode" data-value="' + o[0] + '">' + o[1] + '</button>').join('') + '</div></div>' +
          (E.selfMode === 'kwh'
            ? field({ bind: 'economy.selfKwh', type: 'int', suffix: 'kWh/Jahr', arrows: true, step: 100, min: 0, aria: 'Eigenverbrauch in kWh pro Jahr' })
            : field({ bind: 'economy.selfPct', suffix: '% vom Ertrag', arrows: true, step: 5, min: 0, max: 100, aria: 'Eigenverbrauch in Prozent' })) +
          '<span class="field-hint" data-out="ecoSelfHint"></span></div>' +
        field({ label: 'Einspeisung (ct/kWh)', bind: 'economy.feedCt', suffix: 'ct', arrows: true, step: 0.1, min: 0, hint: 'Bitte aktuellen EEG-Satz prüfen' }) +
      '</div>' +
      '<div class="eco-stats">' +
        '<div><span>Jahresertrag</span><strong data-out="ecoProd"></strong></div>' +
        '<div><span>Eigenverbrauch</span><strong data-out="ecoSelf"></strong></div>' +
        '<div><span>Einspeisung</span><strong data-out="ecoFeed"></strong></div>' +
        '<div><span>Ersparnis / Jahr</span><strong data-out="ecoSave"></strong></div>' +
        '<div><span>Amortisation</span><strong data-out="payback"></strong></div>' +
        '<div><span>Bilanz nach 20 Jahren</span><strong data-out="ecoBal"></strong></div>' +
      '</div>';
  }

  function renderAll() {
    renderModules();
    renderInverters();
    renderComponents();
    renderMounting();
    renderLabor();
    renderEconomy();
    $('#projectName').value = state.project.name;
    document.title = (state.project.name ? state.project.name + ' · ' : '') + APP_NAME;
    $('#cfgCount').textContent = store.configs.length;
    update();
  }

  /** Beim Neu-Rendern Fokus, Cursor und geöffnete Detailbereiche erhalten */
  function preserveUI(fn) {
    const active = document.activeElement;
    const bind = active && active.dataset ? active.dataset.bind : null;
    const inDialog = active && active.closest ? active.closest('dialog') : null;
    let sel = null;
    try { if (active && typeof active.selectionStart === 'number') sel = [active.selectionStart, active.selectionEnd]; } catch (e) { sel = null; }
    const keyOf = d => { const b = d.querySelector('[data-bind]'); return b ? b.dataset.bind : null; };
    const open = new Set($$('details[open]').map(keyOf).filter(Boolean));
    fn();
    $$('details').forEach(d => { const k = keyOf(d); if (k && open.has(k)) d.open = true; });
    if (bind && (!active.isConnected)) {
      const el = (inDialog || document).querySelector('[data-bind="' + bind + '"]');
      if (el) { el.focus({ preventScroll: true }); try { if (sel) el.setSelectionRange(sel[0], sel[1]); } catch (e) { /* select/checkbox */ } }
    }
  }
  const _rM = renderModules, _rI = renderInverters, _rC = renderComponents, _rMt = renderMounting, _rL = renderLabor, _rE = renderEconomy, _rS = renderSettings;
  renderModules = () => preserveUI(_rM);
  renderInverters = () => preserveUI(_rI);
  renderComponents = () => preserveUI(_rC);
  renderMounting = () => preserveUI(_rMt);
  renderLabor = () => preserveUI(_rL);
  renderEconomy = () => preserveUI(_rE);
  renderSettings = () => preserveUI(_rS);

  const RENDER = {
    modules: renderModules, inverters: renderInverters, components: renderComponents,
    mounting: renderMounting, labor: renderLabor, economy: renderEconomy,
    settings: () => renderSettings(), all: () => renderAll()
  };

  /* ------------------------------------------------------------------ *
   * Ausgaben aktualisieren
   * ------------------------------------------------------------------ */
  function update() {
    const r = calc();
    ui.r = r;
    const s = state, m = s.modules;
    const out = {}, html = {};

    out.total = eur(r.total);
    out.totalSub = 'Eigeneinkauf ' + eur(r.own) + ' · Extern ' + eur(r.ext);
    out.kwp = NF.n2.format(r.kwp) + ' kWp';
    out.kwpSub = r.n + ' × ' + NF.nMax2.format(r.wp) + ' Wp';
    out.perKwp = r.kwp > 0 ? eur(r.total / r.kwp) : '–';
    out.yield = s.economy.enabled === false ? '–' : NF.n0.format(r.eco.prod) + ' kWh';
    out.yieldSub = NF.n0.format(num(s.economy.specificYield)) + ' kWh/kWp';
    out.payback = Number.isFinite(r.eco.payback) ? NF.n1.format(r.eco.payback) + ' Jahre' : '–';
    out.paybackSub = 'Ersparnis ≈ ' + eur(r.eco.savings) + ' / Jahr';
    out.countHint = r.n >= s.settings.sliderMax ? 'Maximum erreicht – in den Einstellungen anpassbar' : r.n + ' Module · ' + NF.n2.format(r.kwp) + ' kWp';

    out.modulesSub = r.n + ' × ' + NF.nMax2.format(r.wp) + ' Wp = ' + NF.n2.format(r.kwp) + ' kWp';
    out.sumModules = eur(r.modCost + r.ship);
    const effUnit = r.n > 0 ? (r.modCost + r.ship) / r.n : 0;
    if (r.purchase) {
      html.modulesCalc = r.purchase.lines.map(l => l.kind === 'pallet'
        ? '<span>' + l.qty + ' × Palette à ' + r.spec.palletQty + ' Stk. × ' + esc(eur(l.unit)) + ' = <strong>' + esc(eur(l.qty * l.unit)) + '</strong></span>'
        : '<span>' + l.qty + ' × ' + esc(eur(l.unit)) + ' (Staffel ab ' + (l.tier ? l.tier[0] : 1) + ') = <strong>' + esc(eur(l.qty * l.unit)) + '</strong></span>').join('') +
        (m.shipping.mode !== 'none' ? '<span>Versand: <strong>' + esc(eur(r.ship)) + '</strong>' + (r.shipInfo && r.shipInfo.label ? ' <span class="muted">(' + esc(r.shipInfo.label) + ')</span>' : '') + '</span>' : '') +
        '<span>Effektiv inkl. Versand: <strong>' + esc(eur(effUnit)) + '/Modul</strong> · <strong>' + (r.wp > 0 && r.n > 0 ? NF.n1.format(effUnit / r.wp * 100) + ' ct/Wp' : '–') + '</strong></span>';
      html.shipNote = m.shipping.mode === 'shop24' && r.n > 0 ? shipNoteHtml(r) : '';
      html.moduleSurplus = r.delivered > r.n ? statusNote('info', 'Geliefert werden <strong>' + r.delivered + ' Module</strong> (' + (r.delivered - r.n) + ' mehr als geplant), da nur ganze Paletten bestellt werden.' + (m.buyMode === 'pallet' ? ' Tipp: „Optimal“ kombiniert Paletten mit Einzelmodulen.' : '')) : '';
    } else {
      html.modulesCalc = '<span>' + r.n + ' × ' + esc(eur(num(m.price))) + ' = <strong>' + esc(eur(r.modCost)) + '</strong></span>' +
        (m.shipping.mode !== 'none' ? '<span>Versand: <strong>' + esc(eur(r.ship)) + '</strong></span>' : '') +
        '<span>Modulpreis je Wp: <strong>' + (r.wp > 0 ? NF.n2.format(num(m.price) / r.wp * 100) + ' ct' : '–') + '</strong></span>';
      html.shipNote = m.shipping.mode === 'shop24' && r.n > 0 ? shipNoteHtml(r) : '';
      html.moduleSurplus = '';
    }
    $$('#modulesBody .tier').forEach(el => { el.classList.toggle('is-active', !!r.purchase && r.purchase.lines.some(l => l.kind === el.dataset.kind && (l.kind === 'pallet' || (l.tier && String(l.tier[0]) === el.dataset.qty)))); });
    out.catalogStatus = catalogStatusText();

    out.invSub = r.invCount + (r.invCount === 1 ? ' Gerät' : ' Geräte') + ' · ' + NF.nMax2.format(r.acKw) + ' kW AC';
    out.sumInverters = eur(r.invCost);
    r.inv.forEach((x, i) => { out['inv.' + i + '.total'] = eur(x.total); });
    if (r.dcac == null) {
      html.dcac = r.n > 0 ? statusNote('warn', 'Kein Wechselrichter gewählt – die Anlage benötigt mindestens einen Wechselrichter.') : '';
    } else {
      const v = r.dcac, txt = 'DC/AC-Verhältnis <strong>' + NF.nMax2.format(v) + '</strong> (' + NF.n2.format(r.kwp) + ' kWp Module / ' + NF.nMax2.format(r.acKw) + ' kW Wechselrichter)';
      if (v < 0.8) html.dcac = statusNote('info', txt + ' – Wechselrichter großzügig dimensioniert.');
      else if (v <= 1.3) html.dcac = statusNote('good', txt + ' – passend dimensioniert.');
      else if (v <= 1.5) html.dcac = statusNote('warn', txt + ' – hohe Überbelegung, Abregelung an Spitzentagen möglich.');
      else html.dcac = statusNote('bad', txt + ' – Wechselrichter wahrscheinlich zu klein.');
    }

    out.sumComponents = eur(r.cmpCost);
    r.cmp.forEach((x, i) => { out['cmp.' + i + '.total'] = eur(x.total); });

    out.sumMounting = eur(r.mntCost);
    const MT = s.mounting;
    r.mnt.forEach(x => {
      out['mnt.' + x.key + '.qty'] = NF.n0.format(x.qty) + ' Stk.';
      out['mnt.' + x.key + '.total'] = eur(x.total);
      out['mnt.' + x.key + '.sub'] = MT.mode === 'ratio' && MT.items[x.key] ? NF.nMax2.format(num(MT.items[x.key].ref)) + ' bei ' + num(MT.refModules) + ' Mod.' : '';
    });
    const ad = r.asd;
    out['mnt.asdHolders.qty'] = NF.n0.format(ad.holders) + ' Stk.';
    out['mnt.asdHolders.total'] = eur(r.mnt.find(x => x.key === 'asdHolders').total);
    out['mnt.asdHolders.sub'] = 'für ' + ad.n + ' Module';
    out['mnt.asdScrews.qty'] = ad.cartons + (ad.cartons === 1 ? ' Karton' : ' Kartons');
    out['mnt.asdScrews.total'] = eur(r.mnt.find(x => x.key === 'asdScrews').total);
    out['mnt.asdScrews.sub'] = ad.screws + ' benötigt';
    out['mnt.asdFee.total'] = eur(ad.fee);
    if (ad.n > 0) out['mnt.hooks.sub'] = 'für ' + ad.normal + ' Module';
    html.asdSplit = ad.n > 0
      ? '<span class="asd-chip asd-chip-a">' + icon('layers') + '<b>' + ad.n + '</b> Module Aufsparrendämmung → <b>' + ad.holders + '</b> Lehmann-Halter</span>' +
        '<span class="asd-chip">' + icon('wrench') + '<b>' + ad.normal + '</b> Module normal → <b>' + (ad.hookPositions - ad.holders) + '</b> K2-Dachhaken</span>'
      : '<span class="muted">Keine Module auf Aufsparrendämmung – alle ' + r.n + ' Module mit K2-Dachhaken.</span>';
    $$('#mountingBody [data-asd-row]').forEach(tr => {
      const k = tr.dataset.asdRow;
      tr.hidden = k === 'asdFee' ? !ad.fee : ad.n === 0;
    });
    const asdRange = $('#asdRange');
    if (asdRange) { asdRange.max = String(r.n); if (document.activeElement !== asdRange) asdRange.value = String(ad.n); paintRange(asdRange); }
    html.asdWarn = num(MT.asd.modules) > r.n ? statusNote('warn', 'Es sind mehr Module mit Aufsparrendämmung eingetragen (' + num(MT.asd.modules) + ') als geplant – berechnet werden ' + r.n + '.') : '';
    const placed = r.layout ? r.layout.placed : r.n;
    out.mountSub = { ratio: 'Wächst mit · ' + r.n + ' Module', layout: 'Belegungsplan · ' + placed + ' Module', manual: 'Manuelle Mengen (fest)' }[MT.mode];
    html.mountBasis = MT.mode === 'layout'
      ? 'Berechnet für <strong>' + placed + ' Module</strong> in ' + (r.layout ? r.layout.rows.length : 0) + ' Reihen' + (placed !== r.n ? ' <span class="pill pill-warn">geplant: ' + r.n + '</span>' : '')
      : 'Hochgerechnet für <strong>' + r.n + ' Module</strong> <span class="muted">(Faktor ' + NF.n2.format(num(MT.refModules) > 0 ? r.n / num(MT.refModules) : 0) + ' × Excel-Mengen)</span>';
    $$('#mountingBody .qty-out').forEach(el => {
      const k = el.dataset.out;
      if (k in out && el.textContent && el.textContent !== out[k]) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
    });
    if (r.layout) {
      const lo = r.layout;
      out.layoutInfo = lo.rows.length + (lo.rows.length === 1 ? ' Reihe' : ' Reihen') + ' · max. ' + NF.n2.format(Math.max(0, ...lo.rowLengths, 0)) + ' m · ' + NF.n1.format(lo.lineMeters) + ' m Schiene';
      html.layoutWarn = lo.placed !== r.n ? statusNote('warn', 'Die individuelle Belegung enthält ' + lo.placed + ' Module, geplant sind ' + r.n + '. Das Montagesystem wird für die Belegung berechnet. <button type="button" class="btn btn-soft btn-sm" data-action="distribute-rows">Belegung auf ' + r.n + ' Module anpassen</button>') : '';
      const lp = $('#layoutPreview');
      if (lp) lp.innerHTML = Charts.layoutPreview(lo);
    }

    out.sumExternal = eur(r.ext);
    r.extRows.forEach((x, i) => { out['ext.' + i + '.total'] = eur(x.total); });
    if (r.montage) {
      const mo = r.montage, x = s.externals.find(e => e.kind === 'montage');
      html.montageFormula = r.n > 0
        ? NF.nMax2.format(mo.kwpBill) + ' kWp × ' + esc(eur(num(x.rate))) + '/kWp = ' + esc(eur(mo.raw)) +
          (mo.minApplied ? ' <span class="pill pill-warn">Mindestbetrag ' + esc(eur(num(x.minimum))) + ' greift</span>' : ' <span class="muted">(min. ' + esc(eur(num(x.minimum))) + ')</span>')
        : '<span class="muted">Keine Module – keine Montagekosten</span>';
    }

    out.cfgFoot = store.configs.length + (store.configs.length === 1 ? ' Konfiguration' : ' Konfigurationen') + ' gespeichert';
    out.printInfo = 'Konfiguration: ' + (s.project.name || '–') + ' · ' + new Date().toLocaleDateString('de-DE');
    out.sumOwn = eur(r.own);
    out.sumExt = eur(r.ext);

    out.ecoProd = NF.n0.format(r.eco.prod) + ' kWh';
    const ePct = v => r.eco.prod > 0 ? ' (' + NF.n1.format(v / r.eco.prod * 100) + ' %)' : '';
    out.ecoSelf = NF.n0.format(r.eco.self) + ' kWh' + ePct(r.eco.self);
    out.ecoFeed = NF.n0.format(r.eco.feed) + ' kWh' + ePct(r.eco.feed);
    out.ecoSelfHint = s.economy.selfMode === 'kwh'
      ? (r.eco.selfWanted > r.eco.prod ? 'Mehr als der Ertrag – begrenzt auf ' + NF.n0.format(r.eco.prod) + ' kWh' : '≈ ' + NF.n1.format(r.eco.prod > 0 ? r.eco.self / r.eco.prod * 100 : 0) + ' % des Jahresertrags')
      : '≈ ' + NF.n0.format(r.eco.self) + ' kWh pro Jahr';
    out.ecoSave = eur(r.eco.savings);
    out.ecoBal = eur(r.eco.bal20);

    document.body.classList.toggle('no-eco', s.economy.enabled === false);
    $$('[data-out]').forEach(el => { const k = el.dataset.out; if (k in out) el.textContent = out[k]; });
    $$('[data-out-html]').forEach(el => { const k = el.dataset.outHtml; if (k in html) el.innerHTML = html[k]; });

    renderSummary(r);
    renderBom(r);
    save();
  }

  function statusNote(kind, text) {
    const ic = { good: 'check', warn: 'alert', bad: 'alert', info: 'info' }[kind];
    const lbl = { good: 'OK', warn: 'Hinweis', bad: 'Achtung', info: 'Info' }[kind];
    return '<div class="status status-' + kind + '">' + icon(ic) + '<span><b>' + lbl + ':</b> ' + text + '</span></div>';
  }

  /* ------------------------------------------------------------------ *
   * Kostenübersicht (Donut, Legende, Positionen, Aufteilung)
   * ------------------------------------------------------------------ */
  function renderSummary(r) {
    const total = r.total;
    const cats = r.cats;
    Charts.donut($('#donutHost'), cats, { onHover: k => setHover(k), onTap: k => { ui.pinned = ui.pinned === k ? null : k; setHover(ui.pinned); } });

    $('#legend').innerHTML = cats.filter(c => c.value !== 0).map(c => {
      const p = total > 0 ? c.value / total * 100 : 0;
      return '<li data-key="' + c.key + '" tabindex="0">' +
        '<span class="lg-dot" style="background:' + c.color + '"></span>' +
        '<span class="lg-label">' + esc(c.label) + '</span>' +
        '<span class="lg-val">' + esc(eur(c.value)) + '</span>' +
        '<span class="lg-pct">' + pct(p) + '</span>' +
        '<span class="lg-bar"><i style="width:' + clamp(p, 0, 100).toFixed(2) + '%;background:' + c.color + '"></i></span>' +
      '</li>';
    }).join('') || '<li class="empty-note">Noch keine Kosten.</li>';

    const pos = r.positions.filter(p => p.total !== 0).slice().sort((a, b) => b.total - a.total);
    const maxV = pos.length ? pos[0].total : 1;
    $('#posList').innerHTML = pos.map(p => {
      const share = total > 0 ? p.total / total * 100 : 0;
      return '<li data-key="' + p.cat + '">' +
        '<div class="pl-top"><span class="lg-dot" style="background:' + CAT[p.cat].color + '"></span><span class="pl-label">' + esc(p.label) + '</span><span class="pl-val">' + esc(eur(p.total)) + '</span><span class="pl-pct">' + pct(share) + '</span></div>' +
        '<div class="pl-bar"><i style="width:' + clamp(p.total / maxV * 100, 0, 100).toFixed(2) + '%;background:' + CAT[p.cat].color + '"></i></div>' +
        (p.name ? '<div class="pl-name">' + esc(p.name) + '</div>' : '') +
      '</li>';
    }).join('') || '<li class="empty-note">Noch keine Kosten.</li>';

    const ownP = total > 0 ? r.own / total * 100 : 0;
    $('#split').innerHTML =
      '<div class="split-labels"><span><b>Eigeneinkauf</b> ' + pct(ownP) + '</span><span><b>Extern</b> ' + pct(total > 0 ? 100 - ownP : 0) + '</span></div>' +
      '<div class="split-bar"><i class="sb-own" style="width:' + ownP.toFixed(2) + '%"></i><i class="sb-ext" style="width:' + (total > 0 ? 100 - ownP : 0).toFixed(2) + '%"></i></div>';

    setHover(ui.hover || ui.pinned, true);
  }

  function setHover(key, silent) {
    if (!silent) ui.hover = key;
    const r = ui.r;
    if (!r) return;
    const host = $('#donutHost');
    Charts.setActive(host, key);
    $$('#legend li').forEach(li => { li.classList.toggle('is-active', key != null && li.dataset.key === key); li.classList.toggle('is-dim', key != null && li.dataset.key !== key); });
    const c = key ? r.cats.find(x => x.key === key) : null;
    if (c) {
      Charts.setDonutCenter(host, c.label, eur(c.value), pct(r.total > 0 ? c.value / r.total * 100 : 0) + ' der Gesamtkosten');
    } else {
      const npos = r.positions.filter(p => p.total !== 0).length;
      Charts.setDonutCenter(host, 'Gesamtkosten', eur(r.total), npos + ' Positionen');
    }
  }

  /* ------------------------------------------------------------------ *
   * Stückliste
   * ------------------------------------------------------------------ */
  function renderBom(r) {
    const groups = [['own', 'Eigeneinkauf', r.own, 'Summe Eigeneinkauf'], ['ext', 'Arbeit und Artikel extern', r.ext, 'Summe externe Arbeit/Artikel']];
    let h = '<table class="bom"><thead><tr><th class="c-pos">#</th><th>Artikel</th><th class="c-prod">Produkt</th><th class="num">Menge</th><th class="num">Einzelpreis</th><th class="num">Gesamt</th><th class="num c-share">Anteil</th></tr></thead><tbody>';
    groups.forEach(g => {
      const rows = r.positions.filter(p => p.group === g[0]);
      h += '<tr class="bom-group"><td colspan="7">' + g[1] + '</td></tr>';
      rows.forEach((p, i) => {
        h += '<tr><td class="c-pos">' + (i + 1) + '</td>' +
          '<td><span class="lg-dot" style="background:' + CAT[p.cat].color + '"></span>' + esc(p.label) + '</td>' +
          '<td class="c-prod">' + (p.url ? '<a href="' + esc(p.url) + '" target="_blank" rel="noopener noreferrer">' + esc(p.name || 'Link') + '</a>' : esc(p.name || '')) + '</td>' +
          '<td class="num">' + NF.nMax2.format(p.qty) + ' <span class="muted">' + esc(p.unitLabel) + '</span></td>' +
          '<td class="num">' + eur(p.unit) + '</td>' +
          '<td class="num"><strong>' + eur(p.total) + '</strong></td>' +
          '<td class="num c-share">' + pct(r.total > 0 ? p.total / r.total * 100 : 0) + '</td></tr>';
      });
      if (!rows.length) h += '<tr><td></td><td colspan="6" class="muted">Keine Positionen</td></tr>';
      h += '<tr class="bom-sub"><td></td><td colspan="4">' + g[3] + '</td><td class="num">' + eur(g[2]) + '</td><td class="num c-share">' + pct(r.total > 0 ? g[2] / r.total * 100 : 0) + '</td></tr>';
    });
    h += '</tbody><tfoot><tr class="bom-total"><td></td><td colspan="4">Summe gesamt</td><td class="num">' + eur(r.total) + '</td><td class="num c-share">' + (r.total > 0 ? '100,0 %' : '–') + '</td></tr></tfoot></table>';
    $('#bomBody').innerHTML = h;
  }

  /* ------------------------------------------------------------------ *
   * Einstellungen
   * ------------------------------------------------------------------ */
  function renderSettings() {
    $$('#settingsTabs [data-tab]').forEach(b => { const on = b.dataset.tab === ui.settingsTab; b.classList.toggle('is-active', on); b.setAttribute('aria-selected', on); });
    const body = $('#settingsBody');
    const tab = ui.settingsTab;
    let h = '';
    if (tab === 'general') {
      h = '<div class="set-section"><h3>Planung</h3><div class="grid grid-2">' +
        field({ label: 'Name der Konfiguration', bind: 'project.name', type: 'text' }) +
        field({ label: 'Max. Module am Schieberegler', bind: 'settings.sliderMax', type: 'int', arrows: true, step: 10, min: 5, max: 5000, rerender: 'modules', hint: 'Standard: 100. Gilt auch als Obergrenze des Eingabefelds.' }) +
        '</div><label class="field"><span class="field-label">Notizen</span><textarea class="input textarea" rows="4" data-bind="project.note" data-type="text" placeholder="z. B. Dachflächen, Ansprechpartner, offene Punkte …">' + esc(state.project.note) + '</textarea></label></div>' +
        '<div class="set-section"><h3>Wirtschaftlichkeit</h3><label class="check"><input type="checkbox" data-bind="economy.enabled" data-type="bool"' + (state.economy.enabled !== false ? ' checked' : '') + ' data-rerender="all"><span>Ertrags- und Amortisationsprognose anzeigen</span></label></div>' +
        '<div class="set-section"><h3>Excel-Formeln</h3><ul class="formula-list">' +
          '<li><code>Montage-kWp = RUNDEN(Module × Wp-Basis; 0) / 1000</code></li>' +
          '<li><code>Montage = MAX(Mindestbetrag; €/kWp × Montage-kWp)</code></li>' +
          '<li><code>Position = Menge × Preis pro Stück</code></li>' +
          '<li><code>Summe gesamt = Summe Eigeneinkauf + Summe extern</code></li>' +
        '</ul></div>';
    } else if (tab === 'themes') {
      h = '<div class="set-section"><h3>Design wählen</h3><div class="theme-grid">' + THEMES.map(t =>
        '<button type="button" class="theme-card' + (state.settings.theme === t.key ? ' is-active' : '') + '" data-action="theme" data-value="' + t.key + '" aria-pressed="' + (state.settings.theme === t.key) + '">' +
          '<span class="tc-preview tc-' + t.key + '"><span class="tc-bar"></span><span class="tc-row"><span class="tc-card"></span><span class="tc-card"></span></span><span class="tc-row"><span class="tc-card tc-wide"></span></span><span class="tc-dot"></span></span>' +
          '<span class="tc-name">' + t.name + (state.settings.theme === t.key ? icon('check') : '') + '</span><span class="tc-desc">' + t.desc + '</span>' +
        '</button>').join('') + '</div></div>';
    } else if (tab === 'inverters') {
      const S = ui.search;
      const shops = state.settings.shops.filter(x => x.enabled !== false && x.domain).map(x => x.domain).join(', ') || 'keine Shops aktiv';
      let results = '';
      if (S.loading) results = '<div class="search-state"><span class="spinner"></span>Suche läuft … ' + esc(S.progress) + '</div>';
      else if (S.results) {
        results = (S.errors.length ? '<div class="status status-warn">' + icon('alert') + '<span>' + S.errors.map(esc).join('<br>') + '</span></div>' : '') +
          (S.results.length ? '<div class="search-results">' + S.results.slice(0, 60).map((x, i) => {
            const exists = state.library.inverters.some(l => l.url && l.url.split('?')[0] === x.url.split('?')[0]);
            return '<div class="sr-item">' + thumb(x.img, 'inverter', 'thumb-sm') +
              '<div class="sr-main"><span class="sr-title">' + esc(x.title) + '</span><span class="muted small">' + esc(x.shop) + (x.available ? '' : ' · nicht verfügbar') + '</span></div>' +
              '<strong class="sr-price">' + eur(x.price) + '</strong>' +
              '<button type="button" class="btn btn-sm ' + (exists ? 'btn-ghost' : 'btn-soft') + '" data-action="search-add" data-idx="' + i + '">' + icon(exists ? 'refresh' : 'plus') + '<span>' + (exists ? 'Preis übernehmen' : 'Übernehmen') + '</span></button>' +
            '</div>';
          }).join('') + '</div>' + (S.results.length > 60 ? '<p class="muted small">' + (S.results.length - 60) + ' weitere Treffer – Suche verfeinern.</p>' : '')
          : '<div class="empty-note">Keine Treffer. Andere Schreibweise versuchen (z. B. „SH10“ oder „Fronius 8.0“).</div>');
      }
      h = '<div class="set-section"><h3>Online suchen</h3>' +
        '<p class="muted small">Aktuelle Preise &amp; Bilder direkt aus den Shops (' + esc(shops) + '). Treffer lassen sich mit einem Klick in die Bibliothek übernehmen.</p>' +
        '<form class="search-bar" data-form="search"><span class="input-wrap">' + icon('search', 'input-ico') + '<input class="input" type="search" id="searchInput" placeholder="z. B. Sungrow SH10, Fronius Symo, Huawei 8KTL" value="' + esc(S.query) + '" autocomplete="off"></span>' +
        '<button type="submit" class="btn btn-primary"' + (S.loading ? ' disabled' : '') + '>' + icon('search') + '<span>Suchen</span></button></form>' +
        '<div class="search-fallback">Andere Quellen: <a href="' + esc(Shop.idealoUrl((S.query || 'Wechselrichter'))) + '" target="_blank" rel="noopener noreferrer">idealo</a> · <a href="' + esc(Shop.googleShoppingUrl((S.query || 'PV Wechselrichter'))) + '" target="_blank" rel="noopener noreferrer">Google Shopping</a></div>' +
        results + '</div>' +
        '<div class="set-section"><div class="set-head"><h3>Bibliothek <span class="muted">(' + state.library.inverters.length + ')</span></h3><div class="btn-row">' +
          '<button type="button" class="btn btn-ghost btn-sm" data-action="lib-refresh-all"' + (ui.busy.has('lib-all') ? ' disabled' : '') + '>' + icon('refresh') + '<span>Alle Preise abrufen</span></button>' +
          '<button type="button" class="btn btn-soft btn-sm" data-action="lib-add">' + icon('plus') + '<span>Neu anlegen</span></button></div></div>' +
        '<div class="lib-list">' + state.library.inverters.map((x, i) => libRow(x, i)).join('') + '</div></div>';
    } else if (tab === 'shops') {
      h = '<div class="set-section"><h3>Shops für die Online-Suche</h3>' +
        '<p class="muted small">Unterstützt werden Shopify-Shops. Die Kategorie ist der Sammlungs-Pfad aus der Shop-URL (<code>/collections/<b>wechselrichter</b></code>). Ohne Kategorie wird das gesamte Sortiment geladen (langsamer).</p>' +
        '<div class="shop-list">' + state.settings.shops.map((x, i) =>
          '<div class="shop-row">' + toggle('settings.shops.' + i + '.enabled', 'Shop aktiv') +
            field({ label: 'Domain', bind: 'settings.shops.' + i + '.domain', type: 'text', placeholder: 'shop.de' }) +
            field({ label: 'Kategorie', bind: 'settings.shops.' + i + '.collection', type: 'text', placeholder: 'wechselrichter' }) +
            '<button type="button" class="btn btn-icon btn-ghost" data-action="shop-remove" data-idx="' + i + '" aria-label="Shop entfernen">' + icon('trash') + '</button></div>').join('') + '</div>' +
        '<div class="row-actions"><button type="button" class="btn btn-soft btn-sm" data-action="shop-add">' + icon('plus') + '<span>Shop hinzufügen</span></button></div></div>' +
        shipTableHtml() +
        '<div class="set-section"><h3>Preise aktualisieren</h3>' +
        '<p class="muted small">Ruft für alle Positionen mit Shopify-Link (Module, Komponenten, Montagesystem, Wechselrichter-Bibliothek) den aktuellen Shop-Preis ab. Andere Shops (z. B. weecoo.de, husatech.de) erlauben keinen Abruf aus dem Browser – dort bitte den Preis manuell eintragen oder über idealo vergleichen.</p>' +
        '<button type="button" class="btn btn-primary" data-action="refresh-all"' + (ui.busy.has('all') ? ' disabled' : '') + '>' + icon('refresh') + '<span>' + (ui.busy.has('all') ? 'Wird abgerufen …' : 'Alle Preise abrufen') + '</span></button></div>';
    } else if (tab === 'data') {
      h = '<div class="set-section"><h3>Konfigurationen</h3><p class="muted small">Jede Konfiguration wird automatisch im Browser gespeichert. Wechseln, duplizieren und löschen über die Leiste „Konfiguration“ oben. Für Weitergabe oder Sicherung als JSON-Datei exportieren.</p>' +
        '<div class="cfg-table">' + store.configs.map(c => '<div class="cfg-trow' + (c.id === store.activeId ? ' is-active' : '') + '"><span class="cfg-trow-name">' + icon(c.id === store.activeId ? 'check' : 'folder') + '<span>' + esc(c.name) + '</span></span><span class="muted small">' + (c.meta ? NF.n2.format(c.meta.kwp) + ' kWp · ' + esc(eur(c.meta.total)) : '') + '</span>' +
          '<span class="btn-row">' + (c.id === store.activeId ? '<span class="pill">aktiv</span>' : '<button type="button" class="btn btn-ghost btn-sm" data-action="cfg-open" data-id="' + esc(c.id) + '">Laden</button>') +
          '<button type="button" class="btn btn-icon btn-ghost" data-action="cfg-export" data-id="' + esc(c.id) + '" title="Exportieren" aria-label="Exportieren">' + icon('download') + '</button></span></div>').join('') + '</div>' +
        '<div class="btn-row" style="margin-top:14px">' +
          '<button type="button" class="btn btn-primary" data-action="export">' + icon('download') + '<span>Aktuelle exportieren</span></button>' +
          '<button type="button" class="btn btn-soft" data-action="export-all">' + icon('db') + '<span>Backup (alle) exportieren</span></button>' +
          '<button type="button" class="btn btn-ghost" data-action="import">' + icon('upload') + '<span>Importieren</span></button>' +
          '<button type="button" class="btn btn-ghost" data-action="csv">' + icon('table') + '<span>Stückliste als CSV</span></button>' +
        '</div><p class="muted small" style="margin-top:10px">Import: Eine einzelne Konfiguration wird als neue Konfiguration hinzugefügt. Ein Backup stellt alle enthaltenen Konfigurationen, die Bibliothek und das Design wieder her.</p></div>' +
        '<div class="set-section"><h3>Zurücksetzen</h3><p class="muted small">Setzt nur die <b>aktuelle</b> Konfiguration auf die Werte aus <em>MK_37_Module.xlsx</em> zurück (der Name bleibt). Die Bibliothek kann separat auf den Standard zurückgesetzt werden.</p>' +
        '<div class="btn-row"><button type="button" class="btn btn-danger" data-action="reset">' + icon('refresh') + '<span>Auf Excel-Werte zurücksetzen</span></button>' +
        '<button type="button" class="btn btn-ghost" data-action="reset-lib">' + icon('inverter') + '<span>Bibliothek &amp; Shops zurücksetzen</span></button></div></div>';
    }
    body.innerHTML = h;
  }

  function shipTableHtml() {
    const T = state.settings.shipTable;
    const rows = (list, key, prefix) => list.map((r, i) => {
      const from = i === 0 ? (key === 'direct' ? 3000 : 0) : list[i - 1][0];
      return '<div class="st-row"><span>' + prefix + NF.n0.format(from) + '–' + NF.n0.format(r[0]) + ' kg</span>' +
        field({ bind: 'settings.shipTable.' + key + '.' + i + '.1', suffix: '€', min: 0, aria: 'Preis bis ' + r[0] + ' kg', cls: 'field-compact' }) + '</div>';
    }).join('');
    return '<div class="set-section"><div class="set-head"><h3>Versandkosten solarhandel24 (nach Gewicht)</h3>' +
      '<a class="chip" href="' + esc(T.url) + '" target="_blank" rel="noopener noreferrer">' + icon('ext') + '<span>Original-Tabelle</span></a></div>' +
      '<p class="muted small">Stand ' + esc(T.checkedAt.split('-').reverse().join('.')) + ', gegen den Shop-Checkout geprüft. Der Shop erlaubt keinen automatischen Abruf der Tabelle aus dem Browser – bei Preisänderungen hier anpassen.</p>' +
      '<div class="grid grid-3">' +
        field({ label: '1 Modul (Kurier)', bind: 'settings.shipTable.courierSingle', suffix: '€', min: 0 }) +
        field({ label: 'Mindestpreis Spedition mit Modulen', bind: 'settings.shipTable.moduleMin', suffix: '€', min: 0 }) +
        field({ label: 'Langgutzuschlag (ab 2,40 m)', bind: 'settings.shipTable.longGoods', suffix: '€', min: 0, hint: 'Nur zur Info, z. B. für 4,8-m-Schienen' }) +
      '</div>' +
      '<details class="more"><summary>' + icon('truck') + 'Gewichtsstaffel anzeigen &amp; bearbeiten</summary>' +
        '<div class="st-grid"><div><span class="field-label">Spedition</span>' + rows(T.freight, 'freight', '') + '</div>' +
        '<div><span class="field-label">Direktlieferung per LKW</span>' + rows(T.direct, 'direct', '') + '</div></div>' +
      '</details></div>';
  }

  function libRow(x, i) {
    const p = 'library.inverters.' + i;
    const open = ui.libOpen.has(x.id);
    const used = state.inverters.some(s => s.libId === x.id);
    return '<div class="lib-row' + (open ? ' is-open' : '') + '">' +
      '<div class="lib-top">' + thumb(x.img, 'inverter', 'thumb-sm') +
        '<div class="lib-main"><span class="lib-title">' + esc((x.brand + ' ' + x.model).trim() || 'Neuer Wechselrichter') + (used ? ' <span class="pill">in Planung</span>' : '') + '</span>' +
        '<span class="muted small"><span class="badge badge-' + esc((x.type || '').toLowerCase()) + '">' + esc(x.type) + '</span> ' + NF.nMax2.format(num(x.kw)) + ' kW' + (x.url ? ' · ' + esc(hostOf(x.url)) : '') + '</span></div>' +
        field({ bind: p + '.price', suffix: '€', min: 0, aria: 'Preis', cls: 'field-compact lib-price' }) +
        '<div class="lib-actions">' +
          (x.url && Shop.isShopifyProduct(x.url) ? '<button type="button" class="btn btn-icon btn-ghost" data-action="fetch-price" data-path="' + p + '" title="Preis abrufen" aria-label="Preis abrufen">' + icon('refresh') + '</button>' : '') +
          '<button type="button" class="btn btn-icon btn-ghost" data-action="lib-edit" data-idx="' + i + '" title="Bearbeiten" aria-label="Bearbeiten" aria-expanded="' + open + '">' + icon('edit') + '</button>' +
          '<button type="button" class="btn btn-icon btn-ghost" data-action="lib-remove" data-idx="' + i + '" title="Löschen" aria-label="Löschen">' + icon('trash') + '</button>' +
        '</div></div>' +
      (open ? '<div class="lib-edit grid grid-3">' +
        field({ label: 'Hersteller', bind: p + '.brand', type: 'text', rerender: 'inverters settings' }) +
        field({ label: 'Modell', bind: p + '.model', type: 'text', rerender: 'inverters settings' }) +
        selectField({ label: 'Typ', bind: p + '.type', options: [['Hybrid', 'Hybrid'], ['String', 'String'], ['Mikro', 'Mikro']], rerender: 'settings' }) +
        field({ label: 'AC-Leistung', bind: p + '.kw', suffix: 'kW', arrows: true, step: 0.5, min: 0 }) +
        field({ label: 'Preis', bind: p + '.price', suffix: '€', arrows: true, step: 1, min: 0 }) +
        field({ label: 'Bezeichnung', bind: p + '.title', type: 'text' }) +
        field({ label: 'Shop-Link', bind: p + '.url', type: 'text', placeholder: 'https://…', cls: 'span-2' }) +
        '<div class="field"><span class="field-label">Bild</span><div class="btn-row">' +
          '<button type="button" class="btn btn-ghost btn-sm" data-action="upload-img" data-path="' + p + '.img">' + icon('upload') + '<span>Hochladen</span></button>' +
          (x.img ? '<button type="button" class="btn btn-ghost btn-sm" data-action="clear-img" data-path="' + p + '.img">' + icon('x') + '<span>Entfernen</span></button>' : '') + '</div></div>' +
        field({ label: 'Bild-URL', bind: p + '.img', type: 'text', placeholder: 'https://… oder hochladen', cls: 'span-3', rerender: 'settings' }) +
      '</div>' : '') +
    '</div>';
  }

  const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };

  function openSettings(tab) {
    if (tab) ui.settingsTab = tab;
    renderSettings();
    const dlg = $('#settingsDialog');
    if (!dlg.open) dlg.showModal();
  }

  /* ------------------------------------------------------------------ *
   * Theme
   * ------------------------------------------------------------------ */
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  function applyTheme() {
    const t = state.settings.theme;
    const def = THEMES.find(x => x.key === t) || THEMES[2];
    const mode = def.mode || (mq.matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', t === 'auto' ? mode : t);
    document.documentElement.setAttribute('data-mode', mode);
    requestAnimationFrame(() => {
      const bg = getComputedStyle(document.body).getPropertyValue('--bg').trim();
      const meta = $('meta[name="theme-color"]');
      if (meta && bg) meta.setAttribute('content', bg);
    });
  }
  mq.addEventListener && mq.addEventListener('change', () => { if (state.settings.theme === 'auto') applyTheme(); });

  /* ------------------------------------------------------------------ *
   * Eingaben
   * ------------------------------------------------------------------ */
  function readEl(el) {
    const t = el.dataset.type;
    if (el.type === 'checkbox') return el.checked;
    if (t === 'int' || t === 'num') {
      let v = parseNum(el.value);
      if (t === 'int') v = Math.round(v);
      if (el.dataset.min != null) v = Math.max(num(el.dataset.min), v);
      if (el.dataset.max != null) v = Math.min(num(el.dataset.max), v);
      return v;
    }
    if (t === 'intlist') return parseIntList(el.value);
    return el.value;
  }

  function writeEl(el, v) {
    if (el.type === 'checkbox') el.checked = !!v;
    else if (el.type === 'range') { el.value = v; paintRange(el); }
    else el.value = el.dataset.type === 'text' || !el.dataset.type ? (v == null ? '' : v) : fmtIn(v, el.dataset.type);
  }

  function paintRange(el) {
    const min = num(el.min), max = num(el.max) || 1, v = num(el.value);
    el.style.setProperty('--pct', clamp((v - min) / (max - min) * 100, 0, 100) + '%');
  }
  function paintRanges() { $$('input[type="range"]').forEach(paintRange); }

  function syncBound(path, src) {
    const v = getPath(state, path);
    $$('[data-bind="' + path + '"]').forEach(el => { if (el !== src) writeEl(el, v); });
  }

  function applyBound(el, isCommit) {
    const path = el.dataset.bind;
    if (!path) return;
    const v = readEl(el);
    setPath(state, path, v);
    syncBound(path, el);
    if (el.type === 'range') paintRange(el);
    afterChange(path, el, isCommit);
  }

  const rerenderInvertersSoon = debounce(() => renderInverters() || update(), 250);

  function afterChange(path, el, isCommit) {
    if (path === 'settings.sliderMax') {
      if (state.modules.count > state.settings.sliderMax) state.modules.count = state.settings.sliderMax;
      if (isCommit) renderModules();
    }
    if (path === 'project.name') document.title = (state.project.name ? state.project.name + ' · ' : '') + APP_NAME;
    if (path.startsWith('library.')) rerenderInvertersSoon();
    const rr = el.dataset.rerender;
    if (rr && (isCommit || el.tagName === 'SELECT' || el.type === 'checkbox')) {
      rr.split(' ').forEach(k => RENDER[k] && RENDER[k]());
    }
    update();
  }

  document.addEventListener('input', e => {
    const el = e.target;
    if (!el.dataset || !el.dataset.bind) return;
    if (el.tagName === 'SELECT' || el.type === 'checkbox') return; // → change
    applyBound(el, false);
  });

  document.addEventListener('change', e => {
    const el = e.target;
    if (el.id === 'importFile') { handleImport(el); return; }
    if (el.id === 'moduleSelect') { selectModule(el.value); return; }
    if (el.id === 'imageFile') return handleImage(el);
    if (!el.dataset || !el.dataset.bind) return;
    applyBound(el, true);
    // Anzeige normalisieren (z. B. "82,5" statt "82.50")
    if (el.type !== 'checkbox' && el.tagName !== 'SELECT' && el.type !== 'range' && el.dataset.type && el.dataset.type !== 'text') writeEl(el, getPath(state, el.dataset.bind));
  });

  // Pfeiltasten & Mausrad in Zahlenfeldern
  document.addEventListener('keydown', e => {
    const el = e.target;
    if (!(el instanceof HTMLInputElement) || !el.hasAttribute('data-arrows')) return;
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      stepInput(el, (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1));
    }
  });
  document.addEventListener('wheel', e => {
    const el = e.target;
    if (el instanceof HTMLInputElement && el.hasAttribute('data-arrows') && document.activeElement === el) {
      e.preventDefault();
      stepInput(el, e.deltaY < 0 ? 1 : -1);
    }
  }, { passive: false });

  function stepInput(input, dir) {
    if (input.disabled) return;
    const step = num(input.dataset.stepsize) || 1;
    let v = parseNum(input.value) + dir * step;
    v = Math.round(v * 1000) / 1000;
    if (input.dataset.min != null) v = Math.max(num(input.dataset.min), v);
    if (input.dataset.max != null) v = Math.min(num(input.dataset.max), v);
    writeEl(input, v);
    applyBound(input, false);
  }

  // Stepper-Buttons mit Gedrückthalten
  let holdTimer = null, holdInterval = null;
  function stopHold() { clearTimeout(holdTimer); clearInterval(holdInterval); holdTimer = holdInterval = null; }
  document.addEventListener('pointerdown', e => {
    const btn = e.target.closest('[data-step]');
    if (!btn || e.button !== 0) return;
    const input = btn.closest('.stepper') && btn.closest('.stepper').querySelector('input');
    if (!input) return;
    e.preventDefault();
    const dir = num(btn.dataset.step);
    stepInput(input, dir);
    stopHold();
    holdTimer = setTimeout(() => { holdInterval = setInterval(() => stepInput(input, dir), 70); }, 380);
  });
  ['pointerup', 'pointercancel', 'pointerleave', 'blur'].forEach(ev => window.addEventListener(ev, stopHold));
  document.addEventListener('pointerout', e => { if (e.target.closest && e.target.closest('[data-step]')) stopHold(); });

  /* ------------------------------------------------------------------ *
   * Klick-Aktionen
   * ------------------------------------------------------------------ */
  document.addEventListener('click', async e => {
    // Tastatur-Bedienung der Stepper (Enter/Leertaste → click ohne Pointer)
    const stepBtn = e.target.closest('[data-step]');
    if (stepBtn && e.detail === 0) {
      const input = stepBtn.closest('.stepper') && stepBtn.closest('.stepper').querySelector('input');
      if (input) stepInput(input, num(stepBtn.dataset.step));
      return;
    }
    if (!e.target.closest('#donutHost') && !e.target.closest('#legend') && ui.pinned) { ui.pinned = null; setHover(null); }

    const tabBtn = e.target.closest('#settingsTabs [data-tab]');
    if (tabBtn) { ui.settingsTab = tabBtn.dataset.tab; renderSettings(); return; }
    if (e.target.closest('[data-close]')) { $('#settingsDialog').close(); return; }

    const a = e.target.closest('[data-action]');
    if (!a) return;
    const act = a.dataset.action, idx = num(a.dataset.idx);
    switch (act) {
      case 'seg': {
        setPath(state, a.dataset.path, a.dataset.value);
        (a.dataset.rerender || '').split(' ').forEach(k => RENDER[k] && RENDER[k]());
        if (!a.dataset.rerender) $$('[data-path="' + a.dataset.path + '"]').forEach(b => { const on = b.dataset.value === a.dataset.value; b.classList.toggle('is-active', on); b.setAttribute('aria-checked', on); });
        update();
        break;
      }
      case 'inv-add': {
        const last = state.inverters[state.inverters.length - 1];
        state.inverters.push({ id: uid(), libId: last ? last.libId : (state.library.inverters[0] || {}).id || '', qty: 1 });
        renderInverters(); update(); break;
      }
      case 'inv-remove': state.inverters.splice(idx, 1); renderInverters(); update(); break;
      case 'cmp-add':
        state.components.push({ id: uid(), label: 'Neue Position', name: '', title: '', qty: 1, price: 0, category: 'other', enabled: true, url: '', img: '' });
        renderComponents(); update(); focusLast('#componentsBody'); break;
      case 'cmp-remove': {
        const it = state.components[idx];
        if (await confirmBox('Position entfernen?', '„' + (it.label || 'Position') + '“ wird aus der Planung entfernt.', 'Entfernen')) { state.components.splice(idx, 1); renderComponents(); update(); }
        break;
      }
      case 'ext-add':
        state.externals.push({ id: uid(), kind: 'item', label: 'Neue Leistung', name: '', desc: '', qty: 1, price: 0, category: 'other', enabled: true });
        renderLabor(); update(); focusLast('#laborBody'); break;
      case 'ext-remove': {
        const it = state.externals[idx];
        if (await confirmBox('Position entfernen?', '„' + (it.label || 'Position') + '“ wird aus der Planung entfernt.', 'Entfernen')) { state.externals.splice(idx, 1); renderLabor(); update(); }
        break;
      }
      case 'eco-mode': {
        const E = state.economy, v = a.dataset.value;
        if (E.selfMode !== v) {
          const prod = ui.r ? ui.r.eco.prod : 0;
          // umrechnen, damit das Ergebnis beim Wechsel gleich bleibt
          if (v === 'kwh') E.selfKwh = Math.round(prod * clamp(num(E.selfPct), 0, 100) / 100);
          else E.selfPct = prod > 0 ? Math.round(Math.min(num(E.selfKwh), prod) / prod * 1000) / 10 : num(E.selfPct);
          E.selfMode = v;
          renderEconomy(); update();
        }
        break;
      }
      case 'asd-set': {
        const n = state.modules.count, v = a.dataset.value;
        state.mounting.asd.modules = v === 'all' ? n : v === 'half' ? Math.round(n / 2) : 0;
        syncBound('mounting.asd.modules', null);
        update();
        break;
      }
      case 'mnt-scale': {
        const MT = state.mounting, n = state.modules.count, ref = num(MT.refModules);
        MOUNT_KEYS.forEach(k => { MT.items[k].manual = ref > 0 ? Math.ceil(n * num(MT.items[k].ref) / ref - 1e-9) : 0; });
        renderMounting(); update(); toast('Mengen auf ' + n + ' Module hochgerechnet.', 'ok');
        break;
      }
      case 'distribute-rows': {
        const L = state.mounting.layout, n = state.modules.count;
        const r = Math.max(1, Math.min(L.customRows.length || num(L.rows) || 1, n || 1));
        L.customRows = Array.from({ length: r }, (_, i) => Math.floor(n / r) + (i < n % r ? 1 : 0)).filter(x => x > 0);
        renderMounting(); update(); break;
      }
      case 'fetch-price': await fetchPrice(a.dataset.path, a); break;
      case 'catalog-refresh': await refreshCatalog(false); break;
      case 'open-settings': openSettings(a.dataset.tab); break;
      case 'theme': state.settings.theme = a.dataset.value; applyTheme(); renderSettings(); update(); break;
      case 'lib-add': {
        const item = { id: 'lib-' + uid(), brand: '', model: '', title: '', type: 'Hybrid', kw: 0, price: 0, url: '', img: '' };
        state.library.inverters.unshift(item);
        ui.libOpen.add(item.id);
        renderSettings(); renderInverters(); update();
        const f = $('#settingsBody .lib-edit input'); if (f) f.focus();
        break;
      }
      case 'lib-edit': {
        const id = state.library.inverters[idx].id;
        ui.libOpen.has(id) ? ui.libOpen.delete(id) : ui.libOpen.add(id);
        renderSettings(); break;
      }
      case 'lib-remove': {
        const it = state.library.inverters[idx];
        const used = state.inverters.some(s => s.libId === it.id);
        if (await confirmBox('Wechselrichter löschen?', '„' + ((it.brand + ' ' + it.model).trim() || 'Eintrag') + '“ wird aus der Bibliothek gelöscht.' + (used ? ' Er ist aktuell in der Planung ausgewählt.' : ''), 'Löschen')) {
          state.library.inverters.splice(idx, 1); renderSettings(); renderInverters(); update();
        }
        break;
      }
      case 'lib-refresh-all': await refreshAll(true); break;
      case 'refresh-all': await refreshAll(false); break;
      case 'search-add': addSearchResult(ui.search.results[idx]); break;
      case 'shop-add': state.settings.shops.push({ domain: '', collection: '', enabled: true }); renderSettings(); save(); break;
      case 'shop-remove': state.settings.shops.splice(idx, 1); renderSettings(); save(); break;
      case 'upload-img': ui.imageTarget = a.dataset.path; $('#imageFile').value = ''; $('#imageFile').click(); break;
      case 'clear-img': setPath(state, a.dataset.path, ''); renderSettings(); renderInverters(); update(); break;
      case 'export': exportConfig(); break;
      case 'import': $('#importFile').value = ''; $('#importFile').click(); break;
      case 'csv': exportCsv(); break;
      case 'reset': {
        if (await confirmBox('Auf Excel-Werte zurücksetzen?', 'Alle Eingaben der Konfiguration „' + state.project.name + '“ werden auf den Stand von MK_37_Module.xlsx zurückgesetzt. Andere Konfigurationen bleiben unverändert.', 'Zurücksetzen')) {
          const name = state.project.name;
          Object.assign(state, templateConfig(name));
          state = normalize(state);
          renderAll(); renderSettings(); toast('Excel-Werte wiederhergestellt.', 'ok');
        }
        break;
      }
      case 'reset-lib': {
        if (await confirmBox('Bibliothek zurücksetzen?', 'Wechselrichter-Bibliothek und Shop-Liste werden auf den Standard zurückgesetzt. Selbst angelegte Wechselrichter gehen verloren.', 'Zurücksetzen')) {
          const d = D.create();
          state.library = d.library; state.settings.shops = d.settings.shops;
          ui.libOpen.clear();
          renderAll(); renderSettings(); toast('Bibliothek zurückgesetzt.', 'ok');
        }
        break;
      }
      case 'export-all': exportBackup(); break;
      case 'cfg-open': if (a.dataset.id !== store.activeId) loadConfig(a.dataset.id); else closeCfgMenu(); break;
      case 'cfg-new': closeCfgMenu(); addConfig(templateConfig(), 'Neue Konfiguration'); break;
      case 'cfg-dup': {
        persist();
        const src = a.dataset.id ? store.configs.find(c => c.id === a.dataset.id) : activeCfg();
        if (src) { closeCfgMenu(); addConfig(clone(src.data), src.name + ' (Kopie)', '„' + src.name + '“ dupliziert.'); }
        break;
      }
      case 'cfg-del': await deleteConfig(a.dataset.id); break;
      case 'cfg-export': { persist(); const c = store.configs.find(x => x.id === a.dataset.id); if (c) exportConfig(c); break; }
    }
  });

  function focusLast(sel) {
    const rows = $$(sel + ' .item-row');
    const last = rows[rows.length - 1];
    if (last) { const inp = last.querySelector('.inline-strong'); if (inp) { inp.focus(); inp.select(); } last.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  }

  // Legende ↔ Donut
  ['mouseover', 'focusin'].forEach(ev => document.addEventListener(ev, e => {
    const li = e.target.closest && e.target.closest('#legend li[data-key]');
    if (li) setHover(li.dataset.key);
  }));
  ['mouseout', 'focusout'].forEach(ev => document.addEventListener(ev, e => {
    const li = e.target.closest && e.target.closest('#legend li[data-key]');
    if (li && !(e.relatedTarget && li.contains(e.relatedTarget))) setHover(ui.pinned);
  }));
  document.addEventListener('click', e => {
    const li = e.target.closest('#legend li[data-key]');
    if (li) { ui.pinned = ui.pinned === li.dataset.key ? null : li.dataset.key; setHover(ui.pinned); }
  });

  // Ansicht Kategorien / Positionen
  $('#summaryView').addEventListener('click', e => {
    const b = e.target.closest('[data-view]');
    if (!b) return;
    ui.summaryView = b.dataset.view;
    $$('#summaryView [data-view]').forEach(x => { x.classList.toggle('is-active', x === b); x.setAttribute('aria-selected', x === b); });
    $('.view-categories').hidden = ui.summaryView !== 'categories';
    $('.view-positions').hidden = ui.summaryView !== 'positions';
  });

  // Suche
  document.addEventListener('submit', async e => {
    const form = e.target.closest('[data-form="search"]');
    if (!form) return;
    e.preventDefault();
    const q = $('#searchInput').value.trim();
    ui.search.query = q;
    if (!q) { toast('Bitte einen Suchbegriff eingeben.', 'info'); return; }
    ui.search.loading = true; ui.search.progress = '';
    renderSettings();
    try {
      const res = await Shop.search(q, state.settings.shops, (d, t) => { ui.search.progress = d + '/' + t + ' Shops'; const el = $('.search-state'); if (el) el.lastChild.textContent = 'Suche läuft … ' + ui.search.progress; });
      ui.search.results = res.results; ui.search.errors = res.errors;
    } catch (err) {
      ui.search.results = []; ui.search.errors = [err.message || 'Fehler bei der Suche'];
    }
    ui.search.loading = false;
    renderSettings();
    const inp = $('#searchInput'); if (inp) inp.focus();
  });

  function addSearchResult(x) {
    if (!x) return;
    const base = x.url.split('?')[0];
    const existing = state.library.inverters.find(l => l.url && l.url.split('?')[0] === base);
    if (existing) {
      const old = existing.price;
      existing.price = x.price;
      if (!existing.img && x.img) existing.img = x.img;
      toast('Preis aktualisiert: ' + eur(old) + ' → ' + eur(x.price), 'ok');
    } else {
      const spec = Shop.guessSpecs(x.title);
      const brand = x.vendor && !/^(1asol|solarhandel)/i.test(x.vendor) ? x.vendor.replace(/^HUAWEI$/, 'Huawei') : x.title.split(' ')[0];
      const model = x.title.replace(new RegExp('^' + brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*', 'i'), '').replace(/\s*(Hybrid[- ]?Wechselrichter|String[- ]?Wechselrichter|Strang-Wechselrichter|Wechselrichter|inkl\..*|\d+(?:[.,]\d+)?\s*kW.*)$/i, '').replace(/^Hybrid\s+/i, '').trim() || x.title;
      state.library.inverters.unshift({ id: 'lib-' + uid(), brand, model, title: x.title, type: spec.type, kw: spec.kw, price: x.price, url: x.url, img: x.img });
      toast('„' + x.title + '“ zur Bibliothek hinzugefügt.', 'ok');
    }
    renderSettings(); renderInverters(); update();
  }

  /* ------------------------------------------------------------------ *
   * Preisabruf
   * ------------------------------------------------------------------ */
  async function fetchPrice(path, btn) {
    const obj = getPath(state, path);
    if (!obj || !obj.url) return;
    if (btn) { btn.disabled = true; btn.classList.add('is-loading'); }
    try {
      const p = await Shop.fetchProduct(obj.url);
      const old = num(obj.price);
      obj.price = p.price;
      if (!obj.img && p.img) obj.img = p.img;
      rerenderFor(path);
      update();
      toast((old === p.price ? 'Preis unverändert: ' + eur(p.price) : 'Preis aktualisiert: ' + eur(old) + ' → ' + eur(p.price)) + (p.available ? '' : ' (derzeit nicht verfügbar)'), 'ok');
    } catch (err) {
      toast(err.message || 'Preis konnte nicht abgerufen werden.', 'err', { label: 'idealo öffnen', href: Shop.idealoUrl(obj.title || obj.name || obj.model || '') });
    } finally {
      if (btn && btn.isConnected) { btn.disabled = false; btn.classList.remove('is-loading'); }
    }
  }

  function rerenderFor(path) {
    const root = path.split('.')[0];
    if (root === 'modules') renderModules();
    else if (root === 'components') renderComponents();
    else if (root === 'externals') renderLabor();
    else if (root === 'mounting') renderMounting();
    else if (root === 'library') { renderInverters(); if ($('#settingsDialog').open) renderSettings(); }
  }

  async function refreshAll(libraryOnly) {
    const key = libraryOnly ? 'lib-all' : 'all';
    if (ui.busy.has(key)) return;
    const targets = [];
    if (!libraryOnly) {
      if (state.modules.source === 'shop') await refreshCatalog(true);
      else targets.push(['modules', state.modules]);
      state.components.forEach((c, i) => targets.push(['components.' + i, c]));
      MOUNT_KEYS.forEach(k => targets.push(['mounting.items.' + k, state.mounting.items[k]]));
    }
    state.library.inverters.forEach((x, i) => targets.push(['library.inverters.' + i, x]));
    const list = targets.filter(t => t[1].url && Shop.isShopifyProduct(t[1].url));
    if (!list.length) { toast('Keine Positionen mit unterstütztem Shop-Link gefunden.', 'info'); return; }
    ui.busy.add(key); renderSettings();
    let ok = 0, changed = 0, fail = 0;
    const queue = list.slice();
    async function worker() {
      while (queue.length) {
        const t = queue.shift();
        try {
          const p = await Shop.fetchProduct(t[1].url);
          if (num(t[1].price) !== p.price) changed++;
          t[1].price = p.price;
          if (!t[1].img && p.img) t[1].img = p.img;
          ok++;
        } catch (e) { fail++; }
      }
    }
    await Promise.all([worker(), worker(), worker(), worker()]);
    ui.busy.delete(key);
    renderAll(); renderSettings();
    toast(ok + ' Preise abgerufen, ' + changed + ' geändert' + (fail ? ', ' + fail + ' fehlgeschlagen' : '') + '.', fail && !ok ? 'err' : 'ok');
  }

  /* ------------------------------------------------------------------ *
   * Import / Export
   * ------------------------------------------------------------------ */
  function download(name, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  const today = () => new Date().toISOString().slice(0, 10);

  function exportConfig(cfg) {
    persist();
    cfg = cfg || activeCfg();
    const usedIds = new Set((cfg.data.inverters || []).map(x => x.libId));
    const payload = {
      app: APP_ID, type: 'config', version: 2, exportedAt: nowIso(),
      name: cfg.name, data: cfg.data,
      // verwendete Wechselrichter mitgeben, damit die Datei auch auf anderen Geräten vollständig ist
      library: { inverters: state.library.inverters.filter(x => usedIds.has(x.id)) }
    };
    download('agapov-pv-' + slug(cfg.name) + '-' + today() + '.json', JSON.stringify(payload, null, 2), 'application/json');
    toast('Konfiguration „' + cfg.name + '“ exportiert.', 'ok');
  }

  function exportBackup() {
    persist();
    const payload = { app: APP_ID, type: 'backup', version: 2, exportedAt: nowIso(), store: store };
    download('agapov-pv-backup-' + today() + '.json', JSON.stringify(payload, null, 2), 'application/json');
    toast('Backup mit ' + store.configs.length + ' Konfiguration(en) exportiert.', 'ok');
  }

  function mergeLibrary(items) {
    (items || []).forEach(it => {
      if (!it || !it.id) return;
      if (!state.library.inverters.some(x => x.id === it.id)) state.library.inverters.push(it);
    });
  }

  async function handleImport(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    let json;
    try { json = JSON.parse(await file.text()); } catch (e) { toast('Import fehlgeschlagen: Datei ist kein gültiges JSON.', 'err'); return; }
    try {
      if (json && json.type === 'backup' && json.store && Array.isArray(json.store.configs)) {
        if (!(await confirmBox('Backup wiederherstellen?', 'Das Backup enthält ' + json.store.configs.length + ' Konfiguration(en). Einträge mit gleicher ID werden überschrieben, Bibliothek und Design übernommen.', 'Wiederherstellen'))) return;
        persist();
        json.store.configs.forEach(c => {
          if (!c || !c.data) return;
          const i = store.configs.findIndex(x => x.id === c.id);
          if (i >= 0) store.configs[i] = c; else store.configs.push(Object.assign({}, c, { id: c.id || 'cfg-' + uid() }));
        });
        if (json.store.library) store.library = json.store.library;
        if (json.store.settings) store.settings = json.store.settings;
        if (json.store.activeId && store.configs.some(c => c.id === json.store.activeId)) store.activeId = json.store.activeId;
        state = stateFromConfig(activeCfg());
        applyTheme(); renderAll(); persist();
        if ($('#settingsDialog').open) renderSettings();
        toast('Backup wiederhergestellt (' + json.store.configs.length + ' Konfigurationen).', 'ok');
        return;
      }
      let data, name, lib;
      if (json && json.app === APP_ID && json.type === 'config') { data = json.data; name = json.name; lib = json.library && json.library.inverters; }
      else { // ältere Exporte (Solarplaner v1) oder reiner Zustand
        const raw = json && json.app === 'solarplaner' ? json.data : json;
        if (!raw || typeof raw !== 'object' || !(raw.modules || raw.inverters)) throw new Error('Keine gültige Konfiguration.');
        data = raw; name = raw.project && raw.project.name; lib = raw.library && raw.library.inverters;
      }
      if (!data || !data.modules) throw new Error('Keine gültige Konfiguration.');
      mergeLibrary(lib);
      const merged = pickConfig(normalize(Object.assign({}, data, { settings: state.settings, library: state.library })));
      const nm = (name || file.name.replace(/\.json$/i, '')).trim() || 'Import';
      addConfig(merged, nm, 'Konfiguration „' + nm + '“ importiert und geladen.');
    } catch (err) {
      toast('Import fehlgeschlagen: ' + (err.message || 'Datei nicht lesbar'), 'err');
    }
  }

  function handleImage(input) {
    const file = input.files && input.files[0];
    if (!file || !ui.imageTarget) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 320, sc = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        setPath(state, ui.imageTarget, c.toDataURL('image/webp', 0.85));
        ui.imageTarget = null;
        renderSettings(); renderInverters(); update();
        toast('Bild gespeichert.', 'ok');
      };
      img.onerror = () => toast('Bild konnte nicht gelesen werden.', 'err');
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function exportCsv() {
    const r = ui.r || calc();
    const f2 = v => NF.n2.format(v).replace(/\./g, '');
    const q = s => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';
    const lines = [['Gruppe', 'Artikel', 'Produkt', 'Menge', 'Einheit', 'Einzelpreis', 'Gesamt', 'Anteil %', 'Link'].map(q).join(';')];
    r.positions.forEach(p => lines.push([p.group === 'own' ? 'Eigeneinkauf' : 'Extern', p.label, p.name, NF.nMax2.format(p.qty).replace(/\./g, ''), p.unitLabel, f2(p.unit), f2(p.total), f2(r.total > 0 ? p.total / r.total * 100 : 0), p.url || ''].map(q).join(';')));
    lines.push(['', 'Summe Eigeneinkauf', '', '', '', '', f2(r.own), '', ''].map(q).join(';'));
    lines.push(['', 'Summe externe Arbeit/Artikel', '', '', '', '', f2(r.ext), '', ''].map(q).join(';'));
    lines.push(['', 'Summe gesamt', '', '', '', '', f2(r.total), '', ''].map(q).join(';'));
    download('stueckliste-' + slug(state.project.name) + '-' + today() + '.csv', '﻿' + lines.join('\r\n'), 'text/csv;charset=utf-8');
    toast('Stückliste als CSV exportiert.', 'ok');
  }

  /* ------------------------------------------------------------------ *
   * Toasts & Bestätigung
   * ------------------------------------------------------------------ */
  function toast(msg, type, action) {
    const host = $('#toasts');
    const el = document.createElement('div');
    el.className = 'toast toast-' + (type || 'info');
    el.innerHTML = icon(type === 'ok' ? 'check' : type === 'err' ? 'alert' : 'info') + '<span>' + esc(msg) + '</span>' +
      (action ? '<a href="' + esc(action.href) + '" target="_blank" rel="noopener noreferrer">' + esc(action.label) + '</a>' : '') +
      '<button type="button" aria-label="Schließen">' + icon('x') + '</button>';
    el.querySelector('button').addEventListener('click', () => el.remove());
    host.appendChild(el);
    requestAnimationFrame(() => el.classList.add('is-in'));
    setTimeout(() => { el.classList.remove('is-in'); setTimeout(() => el.remove(), 300); }, type === 'err' ? 7000 : 4000);
  }

  function confirmBox(title, text, okLabel) {
    const dlg = $('#confirmDialog');
    $('#confirmTitle').textContent = title;
    $('#confirmText').textContent = text;
    $('#confirmOk').textContent = okLabel || 'OK';
    return new Promise(resolve => {
      const done = v => { cleanup(); if (dlg.open) dlg.close(); resolve(v); };
      const ok = () => done(true), cancel = () => done(false);
      const onClose = () => { cleanup(); resolve(false); };
      function cleanup() {
        $('#confirmOk').removeEventListener('click', ok);
        $('#confirmCancel').removeEventListener('click', cancel);
        dlg.removeEventListener('close', onClose);
      }
      $('#confirmOk').addEventListener('click', ok);
      $('#confirmCancel').addEventListener('click', cancel);
      dlg.addEventListener('close', onClose);
      dlg.showModal();
      $('#confirmCancel').focus();
    });
  }

  /* ------------------------------------------------------------------ *
   * Kopfzeile & Dialoge
   * ------------------------------------------------------------------ */
  $('#btnSettings').addEventListener('click', () => openSettings());
  $('#btnExport').addEventListener('click', () => exportConfig());
  $('#btnImport').addEventListener('click', () => { $('#importFile').value = ''; $('#importFile').click(); });
  $('#btnPrint').addEventListener('click', () => window.print());
  $('#btnCsv').addEventListener('click', exportCsv);
  ['settingsDialog', 'confirmDialog'].forEach(id => {
    const dlg = $('#' + id);
    dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); }); // Klick auf Hintergrund
  });
  $('#settingsDialog').addEventListener('close', () => { renderModules(); update(); });
  $('#cfgBtn').addEventListener('click', e => { e.stopPropagation(); if ($('#cfgMenu').hidden) openCfgMenu(); else closeCfgMenu(); });
  document.addEventListener('click', e => { if (!$('#cfgMenu').hidden && !e.target.closest('.cfg-switch')) closeCfgMenu(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#cfgMenu').hidden) { closeCfgMenu(); $('#cfgBtn').focus(); } });
  $('.brand').addEventListener('click', e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); });

  /* ------------------------------------------------------------------ *
   * Start
   * ------------------------------------------------------------------ */
  store = loadStore();
  state = stateFromConfig(activeCfg());
  applyTheme();
  renderAll();
  persist();
  // Neue Version auf dem Server? Dann einmal neu laden (Browser-Cache umgehen)
  (function () {
    if (!/^https?:/.test(location.protocol)) return;
    fetch('version.json?t=' + Date.now(), { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(v => {
        if (!v || !v.version || String(v.version) === APP_VERSION) return;
        let tried = null;
        try { tried = sessionStorage.getItem('agapov.reloadFor'); } catch (e) { /* ignorieren */ }
        if (tried === String(v.version)) return; // nur ein Versuch pro Version
        try { sessionStorage.setItem('agapov.reloadFor', String(v.version)); } catch (e) { /* ignorieren */ }
        persist();
        location.reload();
      })
      .catch(() => {});
  })();

  // Modulpreise beim Start live laden, wenn der Stand älter als 1 Stunde ist
  (function () {
    const t = Date.parse(state.moduleCatalog.fetchedAt || 0) || 0;
    if (Date.now() - t > 60 * 60 * 1000) refreshCatalog(true);
  })();

  // Für Tests/Debugging
  window.Solarplaner = { get state() { return state; }, get store() { return store; }, calc: () => calc(), parseNum };
})();

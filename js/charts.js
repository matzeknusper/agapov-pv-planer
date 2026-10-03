/* Solarplaner – Diagramme (reines SVG, keine Abhängigkeiten) */
(function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const R = 78;
  const C = 2 * Math.PI * R;
  const GAP = 2.6; // Abstand zwischen Segmenten (Oberflächenfuge)

  /**
   * Donut mit persistenten Segmenten → weiche Übergänge bei jeder Änderung.
   * segs: [{ key, label, value, color }] in fester Reihenfolge (Farbe folgt der Kategorie).
   */
  function donut(host, segs, opts) {
    opts = opts || {};
    let svg = host.querySelector('svg.donut');
    if (!svg) {
      host.innerHTML =
        '<svg class="donut" viewBox="0 0 200 200" role="img" aria-label="Kostenaufteilung">' +
        '<circle class="donut-track" cx="100" cy="100" r="' + R + '"></circle>' +
        '<g class="donut-segs" transform="rotate(-90 100 100)"></g></svg>' +
        '<div class="donut-center" aria-live="polite"><div class="dc-label"></div><div class="dc-value"></div><div class="dc-sub"></div></div>';
      svg = host.querySelector('svg.donut');
    }
    const g = svg.querySelector('.donut-segs');
    const total = segs.reduce((a, s) => a + Math.max(0, s.value), 0);
    const visible = segs.filter(s => s.value > 0).length;
    let acc = 0;
    const seen = new Set();
    segs.forEach(s => {
      seen.add(s.key);
      let c = g.querySelector('[data-key="' + s.key + '"]');
      if (!c) {
        c = document.createElementNS(NS, 'circle');
        c.setAttribute('cx', '100');
        c.setAttribute('cy', '100');
        c.setAttribute('r', String(R));
        c.setAttribute('class', 'donut-seg');
        c.setAttribute('data-key', s.key);
        c.setAttribute('tabindex', '0');
        c.style.strokeDasharray = '0 ' + C;
        c.style.strokeDashoffset = '0';
        c.addEventListener('mouseenter', () => opts.onHover && opts.onHover(s.key));
        c.addEventListener('mouseleave', () => opts.onHover && opts.onHover(null));
        c.addEventListener('focus', () => opts.onHover && opts.onHover(s.key));
        c.addEventListener('blur', () => opts.onHover && opts.onHover(null));
        c.addEventListener('click', ev => { ev.stopPropagation(); opts.onTap && opts.onTap(s.key); });
        g.appendChild(c);
        // Startzustand setzen, dann im nächsten Frame animieren
        c.getBoundingClientRect();
      }
      const len = total > 0 ? Math.max(0, s.value) / total * C : 0;
      const gap = visible > 1 && len > 0 ? Math.min(GAP, len * 0.45) : 0;
      const dash = Math.max(0, len - gap);
      c.style.stroke = s.color;
      c.style.strokeDasharray = dash.toFixed(3) + ' ' + (C - dash).toFixed(3);
      c.style.strokeDashoffset = (-(acc + gap / 2)).toFixed(3);
      c.setAttribute('aria-label', s.label);
      c.classList.toggle('is-empty', len === 0);
      acc += len;
    });
    g.querySelectorAll('.donut-seg').forEach(c => { if (!seen.has(c.dataset.key)) c.remove(); });
  }

  function setDonutCenter(host, label, value, sub) {
    const l = host.querySelector('.dc-label');
    if (!l) return;
    l.textContent = label;
    host.querySelector('.dc-value').textContent = value;
    host.querySelector('.dc-sub').textContent = sub || '';
  }

  function setActive(host, key) {
    host.querySelectorAll('.donut-seg').forEach(c => {
      c.classList.toggle('is-active', key != null && c.dataset.key === key);
      c.classList.toggle('is-dim', key != null && c.dataset.key !== key);
    });
  }

  /**
   * Belegungsvorschau: Modulreihen mit Schienen und Dachhaken.
   */
  function layoutPreview(info, opts) {
    const rows = info.rows || [];
    if (!rows.length) return '<div class="empty-note">Keine Module in der Belegung.</div>';
    const maxRows = 14;
    const shown = rows.slice(0, maxRows);
    const modW = info.modW, modH = info.modH;
    const maxLen = Math.max.apply(null, info.rowLengths);
    const W = 640;
    const pad = 14;
    const scale = (W - pad * 2 - 30) / Math.max(maxLen, 0.001);
    const rowH = Math.min(46, Math.max(16, modH * scale));
    const gapY = 10;
    const H = pad * 2 + shown.length * rowH + (shown.length - 1) * gapY + (rows.length > maxRows ? 18 : 0);
    let s = '<svg class="layout-svg" viewBox="0 0 ' + W + ' ' + H.toFixed(1) + '" role="img" aria-label="Belegungsvorschau">';
    shown.forEach((n, i) => {
      const len = info.rowLengths[i];
      const y = pad + i * (rowH + gapY);
      const x0 = pad;
      const over = info.overhang * scale;
      // Schienen
      const lines = info.railsPerRow;
      for (let l = 0; l < lines; l++) {
        const ly = y + rowH * ((l + 1) / (lines + 1));
        s += '<line class="lp-rail" x1="' + x0.toFixed(1) + '" y1="' + ly.toFixed(1) + '" x2="' + (x0 + len * scale).toFixed(1) + '" y2="' + ly.toFixed(1) + '"/>';
        // Schienenstöße
        const pieces = info.piecesPerLine[i];
        for (let k = 1; k < pieces; k++) {
          const jx = x0 + Math.min(len, k * info.railLen) * scale;
          s += '<line class="lp-joint" x1="' + jx.toFixed(1) + '" y1="' + (ly - 4).toFixed(1) + '" x2="' + jx.toFixed(1) + '" y2="' + (ly + 4).toFixed(1) + '"/>';
        }
        // Haken
        const hooks = info.hooksPerLine[i];
        const e = Math.min(info.hookEdge, len / 2);
        for (let k = 0; k < hooks; k++) {
          const hx = hooks === 1 ? len / 2 : e + (len - 2 * e) * (k / (hooks - 1));
          s += '<circle class="lp-hook" cx="' + (x0 + hx * scale).toFixed(1) + '" cy="' + ly.toFixed(1) + '" r="2.6"/>';
        }
      }
      // Module
      for (let k = 0; k < n; k++) {
        const mx = x0 + over + k * (modW + info.gap) * scale;
        s += '<rect class="lp-mod" x="' + mx.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + Math.max(1, modW * scale).toFixed(1) + '" height="' + rowH.toFixed(1) + '" rx="2"/>';
      }
      s += '<text class="lp-label" x="' + (W - pad).toFixed(1) + '" y="' + (y + rowH / 2 + 4).toFixed(1) + '" text-anchor="end">' + n + '</text>';
    });
    if (rows.length > maxRows) {
      s += '<text class="lp-more" x="' + pad + '" y="' + (H - 6) + '">+ ' + (rows.length - maxRows) + ' weitere Reihen</text>';
    }
    s += '</svg>';
    return s;
  }

  window.SPCharts = { donut, setDonutCenter, setActive, layoutPreview };
})();

/* Copyright (c) 2026 AWendt206 · MIT-Lizenz · https://github.com/AWendt206/ */
/* Avarma 12 kW V1 – Parameter-Wirkung (Analysekarte, nur lesend)
 * Liest Recorder-Historie und -Statistiken per WebSocket und bewertet die beobachtete
 * Wirkung von Reglerparametern im Vergleich zu ähnlichen Betriebsbedingungen.
 * Schreibt NIE an die Wärmepumpe. Einzige Schreibaktion: Vergleichsfenster in
 * input_datetime-Helfer übernehmen (nur auf Knopfdruck).
 * Modi: type: custom:avarma-parameter-wirkung, mode: header | params | ab | regeln
 */
const AVPW_VERSION = '1.0.0';

const E = {
  freq: 'sensor.hausinstallation_avarma_verdichterfrequenz_ist',
  defrost: 'binary_sensor.avarma_abtauung',
  esp: 'binary_sensor.hausinstallation_avarma_status',
  vl: 'sensor.hausinstallation_avarma_vorlauftemperatur',
  aussen: 'sensor.hausinstallation_avarma_aussentemperatur',
  dtl: 'sensor.avarma_luft_verdampfung',
  fan: 'sensor.hausinstallation_avarma_lufter_1_drehzahl',
  ue: 'sensor.avarma_uberhitzung',
  raum: 'sensor.avarma_raum1_temperatur',
  el: 'sensor.avarma_strom_energie',
  th: 'sensor.avarma_warmemenge_schatzung',
  startsLts: 'sensor.avarma_echte_heizstarts_gesamt',
  defLts: 'sensor.hausinstallation_avarma_abtauvorgange_gesamt',
  bhLts: 'sensor.hausinstallation_avarma_verdichter_betriebsstunden',
  vlAbwLts: 'sensor.avarma_vl_abweichung_heizbetrieb',
  vlDefLts: 'sensor.avarma_vl_wahrend_abtauung',
  refA: 'input_datetime.avarma_vergleich_referenz_start',
  refB: 'input_datetime.avarma_vergleich_referenz_ende',
  testA: 'input_datetime.avarma_vergleich_test_start',
  testB: 'input_datetime.avarma_vergleich_test_ende',
  profil: 'input_text.avarma_parameterprofil',
  profilSeit: 'input_datetime.avarma_parameterprofil_seit',
};

const P = {
  P00: { e: 'select.hausinstallation_avarma_betrieb', n: 'Betrieb', u: '', map: { EIN: 1, AUS: 0 }, txt: ['AUS', 'EIN'] },
  P19: { e: 'select.hausinstallation_avarma_regelart_heizen', n: 'Regelart', u: '', map: { 'Fester Sollwert': 0, 'Witterungsgeführt (OTC)': 1 }, txt: ['Fest', 'OTC'] },
  P02: { e: 'number.hausinstallation_avarma_vorlauf_sollwert_heizen', m: 'sensor.avarma_param_p02_vorlauf_soll', n: 'Vorlauf-Sollwert', u: '°C', werk: 45 },
  P06: { e: 'number.hausinstallation_avarma_hysterese_heizen', m: 'sensor.avarma_param_p06_hysterese', n: 'Hysterese Heizen', u: 'K', werk: 5 },
  P114: { e: 'number.hausinstallation_avarma_frequenzabsenkung', m: 'sensor.avarma_param_p114_frequenzabsenkung', n: 'Frequenzabsenkung', u: '%', werk: 2 },
  P46: { e: 'number.hausinstallation_avarma_mindestfrequenz_verdichter', m: 'sensor.avarma_param_p46_mindestfrequenz', n: 'Mindestfrequenz', u: 'Hz', werk: 35 },
  P47: { e: 'number.hausinstallation_avarma_abtaufrequenz', m: 'sensor.avarma_param_p47_abtaufrequenz', n: 'Abtaufrequenz', u: 'Hz', werk: 65 },
  P60: { e: 'number.hausinstallation_avarma_maximaldrehzahl_lufter', m: 'sensor.avarma_param_p60_lufter_max', n: 'Lüfter max.', u: 'U/min', werk: 900 },
  P17: { e: 'select.hausinstallation_avarma_nachtmodus', m: 'sensor.avarma_param_p17_nachtmodus', n: 'Nachtmodus', u: '', map: { EIN: 1, AUS: 0 }, txt: ['AUS', 'EIN'] },
  P15: { e: 'number.hausinstallation_avarma_nachtmodus_start', m: 'sensor.avarma_param_p15_nacht_start', n: 'Nacht Start', u: 'h' },
  P16: { e: 'number.hausinstallation_avarma_nachtmodus_ende', m: 'sensor.avarma_param_p16_nacht_ende', n: 'Nacht Ende', u: 'h' },
};
const PK = Object.keys(P);

// Kennzahlen: Bezeichnung, Einheit, Nachkommastellen
const M = {
  starts24: ['Echte Heizstarts / 24 h', '', 1],
  runPerStart: ['Ø Heizlaufzeit je Start', 'min', 0],
  defrost24: ['Abtauvorgänge / 24 h', '', 1],
  defrostDur: ['Ø Abtaudauer', 'min', 1],
  az: ['Arbeitszahl Wärme/Strom (Schätzung)', '', 2],
  el24: ['Strom / 24 h', 'kWh', 1],
  th24: ['Wärme / 24 h (Schätzung)', 'kWh', 1],
  vlAbw: ['Ø |VL − Soll| im Heizbetrieb', 'K', 2],
  vlMinDef: ['Kleinster VL beim Abtauen', '°C', 1],
  reheat: ['Ø Wiederaufheizdauer nach Abtauung', 'min', 0],
  freqMean: ['Ø Verdichterfrequenz im Lauf', 'Hz', 1],
  dTluft: ['Ø Luft → Verdampfung', 'K', 1],
  fanMean: ['Ø Lüfter-Istdrehzahl im Lauf', 'U/min', 0],
  raum: ['Ø Raumtemperatur', '°C', 1],
  ueMin: ['Min. Überhitzung (5-min-Mittel, Lauf)', 'K', 1],
  nightShare: ['Anteil Nachtmodus EIN', '%', 0],
  fanCurrent: ['Lüfterstrom', 'A', 1],
  noise: ['Geräusch', 'dB', 0],
};

// Bewertungsregeln – per YAML (rules:) überschreibbar.
const DEFAULT_RULES = {
  P06: { keys: ['P06'], title: 'Hysterese Heizen', wirkung: 'Taktreduzierung', icon: 'mdi:delta',
    primary: { m: 'starts24', better: 'lower', type: 'pct', t1: 5, t2: 10 },
    secondary: [{ m: 'vlAbw', better: 'lower', type: 'abs', t1: 0.3, t2: 0.8, critical: true }, { m: 'runPerStart', better: 'higher', type: 'pct', t1: 5, t2: 10 }, { m: 'az', better: 'higher', type: 'pct', t1: 3, t2: 6 }, { m: 'raum', better: 'higher', type: 'abs', t1: 0.3, t2: 0.8 }],
    hinweis: 'Weniger echte Starts sind positiv, eine größere Vorlauf-/Raumtemperatur-Unterschreitung ist negativ und wird getrennt gezeigt. Rücklesehistorie: Vorwert 5 K (der Auftrag nannte 3 K – nicht in den Daten belegt).' },
  P114: { keys: ['P114'], title: 'Frequenzabsenkung', wirkung: 'Effizienz', icon: 'mdi:arrow-down-bold',
    primary: { m: 'az', better: 'higher', type: 'pct', t1: 3, t2: 6 },
    secondary: [{ m: 'freqMean', better: 'lower', type: 'pct', t1: 5, t2: 10, info: true }, { m: 'starts24', better: 'lower', type: 'pct', t1: 5, t2: 10 }, { m: 'vlAbw', better: 'lower', type: 'abs', t1: 0.3, t2: 0.8, critical: true }],
    hinweis: 'Wirkt auf die Frequenzregelung nahe Solltemperatur. Funktionsweise am realen Frequenzverlauf prüfen; keine pauschale Prozentformel unterstellt.' },
  P46: { keys: ['P46'], title: 'Mindestfrequenz', wirkung: 'Taktreduzierung', icon: 'mdi:speedometer-slow', vorher: 'Werk 35 Hz',
    primary: { m: 'starts24', better: 'lower', type: 'pct', t1: 5, t2: 10 },
    secondary: [{ m: 'az', better: 'higher', type: 'pct', t1: 3, t2: 6 }, { m: 'runPerStart', better: 'higher', type: 'pct', t1: 5, t2: 10 }, { m: 'ueMin', better: 'higher', type: 'abs', t1: 0.5, t2: 1, critical: true }],
    warn: '30 Hz liegt unter der vom Betreiber genannten Werkseinstellung 35 Hz. Ohne ausdrückliche Herstellerfreigabe nicht als langfristig sicher bewertet.' },
  P60: { keys: ['P60'], title: 'Lüfter-Maximaldrehzahl', wirkung: 'Effizienz', icon: 'mdi:fan',
    primary: { m: 'az', better: 'higher', type: 'pct', t1: 3, t2: 6 },
    secondary: [{ m: 'dTluft', better: 'lower', type: 'abs', t1: 0.5, t2: 1 }, { m: 'defrost24', better: 'lower', type: 'pct', t1: 10, t2: 20 }, { m: 'fanMean', better: 'higher', type: 'pct', t1: 5, t2: 10, info: true }, { m: 'fanCurrent', info: true }, { m: 'noise', info: true }],
    hinweis: 'P60 ist eine Obergrenze. Die tatsächlich gefahrene Drehzahl wird separat gemessen (Lüfter 1 Istdrehzahl).' },
  P47: { keys: ['P47'], title: 'Abtaufrequenz', wirkung: 'Abtauverhalten', icon: 'mdi:snowflake-melt', noStars: true,
    primary: { m: 'defrostDur', better: 'lower', type: 'pct', t1: 10, t2: 20 },
    secondary: [{ m: 'vlMinDef', better: 'higher', type: 'abs', t1: 1, t2: 2, critical: true }, { m: 'reheat', better: 'lower', type: 'pct', t1: 10, t2: 20 }, { m: 'defrost24', info: true }],
    warn: 'Keine Optimierungssterne: Betriebssicherheit des Abtaubetriebs nicht verifiziert. P47 wirkt auf den Abtaubetrieb, nicht auf die Anzahl der Abtauungen.' },
  NACHT: { keys: ['P17', 'P15', 'P16'], title: 'Nachtmodus & Zeitfenster', pnr: 'P17/P15/P16', wirkung: 'Temperaturstabilität', icon: 'mdi:weather-night',
    primary: { m: 'az', better: 'higher', type: 'pct', t1: 3, t2: 6 },
    secondary: [{ m: 'starts24', better: 'lower', type: 'pct', t1: 5, t2: 10 }, { m: 'vlAbw', better: 'lower', type: 'abs', t1: 0.3, t2: 0.8, critical: true }, { m: 'nightShare', info: true }],
    hinweis: 'Vergleich mit markierten Nachtmodus-Phasen; nicht mit einer reinen Lüfteränderung gleichzusetzen.' },
  P02: { keys: ['P02'], title: 'Vorlauf-Sollwert', wirkung: 'Effizienz', icon: 'mdi:thermometer-check',
    primary: { m: 'az', better: 'higher', type: 'pct', t1: 3, t2: 6 },
    secondary: [{ m: 'raum', better: 'higher', type: 'abs', t1: 0.3, t2: 0.8, critical: true }, { m: 'starts24', better: 'lower', type: 'pct', t1: 5, t2: 10 }],
    hinweis: 'Zielkonflikt Energieeffizienz gegen thermischen Komfort: beide Richtungen werden getrennt gezeigt.' },
};

const DEFAULTS = {
  raw_days: 10, lts_days: 90, max_window_days: 7, transition_h: 2, debounce_s: 120,
  min_hours_mittel: 48, min_hours_hoch: 120, min_cover: 0.85, max_dt_aussen: 2,
  vl_min_def_warn: 15, ue_min_warn: 1, reload_min: 15,
};

const C = { ok: '#48d18c', cy: '#3ac8ef', gold: '#ffbf55', red: '#ff727f', grey: '#91a5c0', bg: '#111d30', bd: '#2a3b55', fg: '#f0f7ff' };
const HOUR = 3600e3, DAY = 24 * HOUR;

// ---------- Hilfsfunktionen ----------
const num = (x) => { const v = parseFloat(x); return isFinite(v) ? v : null; };
const fmt = (v, d = 1, u = '') => (v == null || !isFinite(v) ? '–' : v.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d }) + (u ? ' ' + u : ''));
const dt = (t) => (t == null ? '–' : new Date(t).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }));
const dd = (t) => new Date(t).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const std = (a) => { if (a.length < 2) return null; const m = avg(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };
const ovl = (a1, b1, a2, b2) => Math.max(0, Math.min(b1, b2) - Math.max(a1, a2));
const ovlList = (ivs, list) => ivs.reduce((s, [a, b]) => s + list.reduce((q, [c, d]) => q + ovl(a, b, c, d), 0), 0);
const inIvs = (t, ivs) => ivs.some(([a, b]) => t >= a && t < b);
const totLen = (ivs) => ivs.reduce((s, [a, b]) => s + (b - a), 0);
const pVal = (k, s) => { if (s == null || s === 'unavailable' || s === 'unknown') return null; const p = P[k]; if (p.map) return p.map[s] != null ? p.map[s] : null; return num(s); };
const pTxt = (k, v) => { if (v == null) return '–'; const p = P[k]; if (p.txt) return p.txt[v] ?? String(v); return fmt(v, v % 1 ? 1 : 0, p.u); };
const profKey = (prof) => PK.map((k) => k + '=' + prof[k]).join('|');
// Profilvergleich: P00 (Betrieb, z. B. durch Frostsperre) ist kein Regelparameter; unbekannte Werte (noch nicht aufgezeichnet) gelten als Platzhalter; P15/P16 nur relevant bei Nachtmodus EIN.
const nightIrrelevant = (a, b) => a.P17 === 0 || b.P17 === 0 || a.P17 == null || b.P17 == null;
const diffKeys = (a, b) => PK.filter((k) => k !== 'P00' && a[k] != null && b[k] != null && a[k] !== b[k] && !((k === 'P15' || k === 'P16') && nightIrrelevant(a, b)));
const profMatch = (a, b) => diffKeys(a, b).length === 0;

// ---------- Datenladen (geteilt zwischen allen Karteninstanzen) ----------
const STORE = (window.__avpwStore = window.__avpwStore || { data: null, at: 0, promise: null });

async function loadData(hass, cfg) {
  const now = Date.now();
  if (STORE.data && now - STORE.at < cfg.reload_min * 60e3) return STORE.data;
  if (STORE.promise) return STORE.promise;
  STORE.promise = (async () => {
    const rawStart = now - cfg.raw_days * DAY;
    const ltsStart = now - cfg.lts_days * DAY;
    const iso = (t) => new Date(t).toISOString();
    const histIds = [E.freq, E.defrost, E.esp, ...PK.map((k) => P[k].e)];
    const hist = await hass.callWS({ type: 'history/history_during_period', start_time: iso(rawStart), end_time: iso(now), entity_ids: histIds, minimal_response: true, no_attributes: true, significant_changes_only: false });
    const s5ids = [E.vl, E.aussen, E.freq, E.dtl, E.fan, E.ue, E.raum, E.el, E.th];
    const st5 = await hass.callWS({ type: 'recorder/statistics_during_period', start_time: iso(rawStart), end_time: iso(now), statistic_ids: s5ids, period: '5minute', types: ['mean', 'min', 'max', 'change'] });
    const hIds = [...s5ids, E.startsLts, E.defLts, E.bhLts, E.vlAbwLts, E.vlDefLts, ...PK.map((k) => P[k].m).filter(Boolean)];
    const sth = await hass.callWS({ type: 'recorder/statistics_during_period', start_time: iso(ltsStart), end_time: iso(now), statistic_ids: hIds, period: 'hour', types: ['mean', 'min', 'max', 'change'] });
    const D = buildModel(hist, st5, sth, rawStart, now, cfg);
    STORE.data = D; STORE.at = Date.now();
    return D;
  })();
  try { return await STORE.promise; } finally { STORE.promise = null; }
}

function series(hist, id) {
  return (hist[id] || []).map((x) => ({ t: ((x.lc ?? x.lu) || 0) * 1000, s: x.s }));
}

function buildModel(hist, st5, sth, rawStart, now, cfg) {
  // Parameter-Zeitreihen (entprellt: Wert muss debounce_s stabil sein, Rampen werden zusammengefasst)
  const params = {};
  let firstParamT = now;
  for (const k of PK) {
    const pts = series(hist, P[k].e).map((x) => ({ t: x.t, v: pVal(k, x.s) })).filter((x) => x.v != null);
    const deb = [];
    for (let i = 0; i < pts.length; i++) {
      const next = pts[i + 1];
      if (i > 0 && next && next.t - pts[i].t < cfg.debounce_s * 1000 && next.v !== pts[i].v) continue; // Rampe überspringen, ersten Rücklesewert behalten
      if (!deb.length || deb[deb.length - 1].v !== pts[i].v) deb.push(pts[i]);
    }
    params[k] = deb;
    if (deb.length) firstParamT = Math.min(firstParamT, deb[0].t);
  }
  const dataStart = Math.max(rawStart, firstParamT);
  // Profil-Segmente
  const cps = [...new Set(PK.flatMap((k) => params[k].map((x) => x.t)).filter((t) => t > dataStart))].sort((a, b) => a - b);
  const bounds = [dataStart, ...cps, now];
  const valAt = (k, t) => { let v = null; for (const x of params[k]) { if (x.t <= t) v = x.v; else break; } return v; };
  const segs = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const a = bounds[i], b = bounds[i + 1];
    if (b - a < 1000) continue;
    const prof = {}; PK.forEach((k) => (prof[k] = valAt(k, a + 1)));
    const key = profKey(prof);
    if (segs.length && segs[segs.length - 1].key === key) segs[segs.length - 1].b = b; else segs.push({ a, b, prof, key });
  }
  // Verdichterlauf + Verfügbarkeit
  const espOn = []; { let on = null; for (const x of series(hist, E.esp)) { if (x.s === 'on' && on == null) on = x.t; if (x.s !== 'on' && on != null) { espOn.push([on, x.t]); on = null; } } if (on != null) espOn.push([on, now]); }
  const run = [], avail = [], startsAll = [];
  { let ra = null, aa = null, last = null, gapAt = null;
    for (const x of series(hist, E.freq)) {
      const f = num(x.s);
      if (f == null) { // Lücke (ESP32/Sensor nicht verfügbar): Lauf endet hier, kein Start beim Wiederkehren
        if (aa != null) { avail.push([aa, x.t]); aa = null; }
        if (ra != null) { run.push([ra, x.t]); ra = null; }
        if (gapAt == null) gapAt = x.t;
        continue;
      }
      if (aa == null) aa = x.t;
      const on = f > 0;
      if (on && ra == null) {
        const gap = gapAt != null ? x.t - gapAt : 0;
        if (last === false && gap < 5 * 60e3) startsAll.push(x.t);
        ra = x.t;
      }
      if (!on && ra != null) { run.push([ra, x.t]); ra = null; }
      last = on; gapAt = null;
    }
    if (ra != null) run.push([ra, now]); if (aa != null) avail.push([aa, now]);
  }
  // ESP-Status nur einbeziehen, wenn er aufgezeichnet wird (sonst reicht die Verfügbarkeit des Frequenzsensors)
  const availEsp = espOn.length ? avail.flatMap(([a, b]) => espOn.map(([c, d]) => [Math.max(a, c), Math.min(b, d)]).filter(([c, d]) => d > c)) : avail;
  // Abtauungen (Rohsignal) + 90 s Nachlauf wie 'Abtauung gefiltert'
  const defr = []; { let on = null; for (const x of series(hist, E.defrost)) { if (x.s === 'on' && on == null) on = x.t; else if (x.s === 'off' && on != null) { defr.push([on, x.t]); on = null; } } if (on != null) defr.push([on, now]); }
  const defrX = defr.map(([a, b]) => [a - 10e3, b + 90e3]);
  const starts = startsAll.filter((t) => !inIvs(t, defrX));
  const runHeat = run.flatMap(([a, b]) => { let parts = [[a, b]]; for (const [c, d] of defrX) parts = parts.flatMap(([x, y]) => (d <= x || c >= y ? [[x, y]] : [[x, Math.max(x, c)], [Math.min(y, d), y]].filter(([p, q]) => q > p))); return parts; });
  const toRows = (st) => { const o = {}; for (const id of Object.keys(st || {})) o[id] = st[id].map((r) => ({ a: r.start, b: r.end, mean: r.mean, min: r.min, max: r.max, change: r.change })); return o; };
  return { now, rawStart, dataStart, params, segs, run, runHeat, avail: availEsp, starts, defr, defrX, s5: toRows(st5), sh: toRows(sth), valAt, cfg };
}

// ---------- Fensterauswertung ----------
function rowsIn(rows, ivs) { return (rows || []).filter((r) => ivs.some(([a, b]) => r.a >= a && r.b <= b)); }
function statRows(D, id, ivs) {
  const r5 = rowsIn(D.s5[id], ivs);
  const covered5 = r5.length * 5 * 60e3 >= 0.5 * totLen(ivs);
  return covered5 ? r5 : rowsIn(D.sh[id], ivs);
}

function evalWindow(D, ivs) {
  ivs = ivs.map(([a, b]) => [Math.max(a, D.now - D.cfg.lts_days * DAY), Math.min(b, D.now)]).filter(([a, b]) => b > a);
  // Nur Zeiten mit Betrieb EIN (P00) bewerten – Aus-Phasen (z. B. Frostsperre) zählen nicht als Betriebszeit
  const raw0 = totLen(ivs);
  const off = D.segs.filter((s) => s.prof.P00 === 0).map((s) => [s.a, s.b]);
  ivs = ivs.flatMap(([a, b]) => { let parts = [[a, b]]; for (const [c, d] of off) parts = parts.flatMap(([x, y]) => (d <= x || c >= y ? [[x, y]] : [[x, Math.max(x, c)], [Math.min(y, d), y]].filter(([p, q]) => q > p))); return parts; });
  const tot = totLen(ivs); const R = { ivs, hours: tot / HOUR, offH: (raw0 - tot) / HOUR, src: 'Rohdaten' };
  if (!tot) return R;
  const rawPart = ovlList(ivs, [[D.rawStart, D.now]]) / tot;
  const obs = ovlList(ivs, D.avail);
  R.cover = obs / tot;
  const aus = statRows(D, E.aussen, ivs).filter((r) => r.mean != null);
  R.aussen = avg(aus.map((r) => r.mean)); R.aussenMin = aus.length ? Math.min(...aus.map((r) => r.min ?? r.mean)) : null; R.aussenMax = aus.length ? Math.max(...aus.map((r) => r.max ?? r.mean)) : null;
  const el = statRows(D, E.el, ivs).filter((r) => r.change != null), th = statRows(D, E.th, ivs).filter((r) => r.change != null);
  const elH = el.reduce((s, r) => s + (r.b - r.a), 0) / HOUR, thH = th.reduce((s, r) => s + (r.b - r.a), 0) / HOUR;
  const elS = el.reduce((s, r) => s + r.change, 0), thS = th.reduce((s, r) => s + r.change, 0);
  if (elH > 1) R.el24 = (elS / elH) * 24; if (thH > 1) R.th24 = (thS / thH) * 24;
  if (elS > 0.5 && thS > 0) R.az = thS / elS;
  R.nightShare = (ovlList(ivs, D.segs.filter((s) => s.prof.P17 === 1).map((s) => [s.a, s.b])) / tot) * 100;
  if (rawPart >= 0.5) {
    const obsH = obs / HOUR;
    R.nStarts = D.starts.filter((t) => inIvs(t, ivs)).length;
    const dIn = D.defr.filter(([a]) => inIvs(a, ivs));
    R.nDefrost = dIn.length;
    R.runH = ovlList(ivs, D.runHeat) / HOUR;
    if (obsH >= 6) { R.starts24 = (R.nStarts / obsH) * 24; R.defrost24 = (R.nDefrost / obsH) * 24; }
    if (R.nStarts >= 3) R.runPerStart = (R.runH * 60) / R.nStarts;
    if (dIn.length) R.defrostDur = avg(dIn.map(([a, b]) => (b - a) / 60e3));
    const vl = rowsIn(D.s5[E.vl], ivs);
    const vlOk = vl.filter((r) => r.mean != null && !D.defrX.some(([a, b]) => ovl(r.a, r.b, a, b) > 0) && D.valAt('P00', r.a) === 1 && D.valAt('P19', r.a) === 0 && D.valAt('P02', r.a) != null);
    if (vlOk.length >= 24) { R.vlAbw = avg(vlOk.map((r) => Math.abs(r.mean - D.valAt('P02', r.a)))); R.vlAbwSrc = '5-min-Mittel'; }
    const vlD = vl.filter((r) => r.min != null && D.defrX.some(([a, b]) => ovl(r.a, r.b, a, b) > 0));
    if (vlD.length) R.vlMinDef = Math.min(...vlD.map((r) => r.min));
    const rh = [];
    for (const [da, db] of dIn) {
      const pre = avg(vl.filter((r) => r.a >= da - 15 * 60e3 && r.b <= da && r.mean != null).map((r) => r.mean));
      if (pre == null) continue;
      const hit = vl.find((r) => r.a >= db && r.mean != null && r.mean >= pre - 1 && r.a - db < 120 * 60e3);
      if (hit) rh.push((hit.b - db) / 60e3);
    }
    if (rh.length) R.reheat = avg(rh);
    // stationärer Lauf: erste 10 min nach Start bzw. nach Abtauende als Übergang ausgeschlossen
    const runRows = (id) => rowsIn(D.s5[id], ivs).filter((r) => r.mean != null && D.runHeat.some(([a, b]) => r.a >= a + 10 * 60e3 && r.b <= b));
    const fr = runRows(E.freq); if (fr.length >= 12) R.freqMean = avg(fr.map((r) => r.mean));
    const dl = runRows(E.dtl); if (dl.length >= 12) R.dTluft = avg(dl.map((r) => r.mean));
    const fn = runRows(E.fan); if (fn.length >= 12) R.fanMean = avg(fn.map((r) => r.mean));
    const ue = runRows(E.ue); if (ue.length >= 12) R.ueMin = Math.min(...ue.map((r) => r.mean));
  } else {
    // Langzeitstatistik (ältere Fenster) – nur vorhandene Helfer
    R.src = 'Langzeitstatistik (stündlich)';
    const hr = (id) => rowsIn(D.sh[id], ivs);
    const aH = hr(E.aussen).length; R.cover = Math.min(1, aH / (tot / HOUR));
    const ch = (id) => { const r = hr(id).filter((x) => x.change != null); return r.length ? r.reduce((s, x) => s + x.change, 0) : null; };
    const obsH = (tot / HOUR) * R.cover;
    const st = ch(E.startsLts), df = ch(E.defLts), bh = ch(E.bhLts);
    if (st != null && obsH >= 6) { R.nStarts = st; R.starts24 = (st / obsH) * 24; }
    if (df != null && obsH >= 6) { R.nDefrost = df; R.defrost24 = (df / obsH) * 24; }
    if (bh != null) R.runH = bh;
    if (st && bh != null && st >= 3) R.runPerStart = (bh * 60) / st;
    const va = hr(E.vlAbwLts).filter((x) => x.mean != null); if (va.length >= 6) { R.vlAbw = avg(va.map((x) => x.mean)); R.vlAbwSrc = 'Helfer-Sensor'; }
    const vd = hr(E.vlDefLts).filter((x) => x.min != null); if (vd.length) R.vlMinDef = Math.min(...vd.map((x) => x.min));
  }
  const rm = statRows(D, E.raum, ivs).filter((r) => r.mean != null); if (rm.length) R.raum = avg(rm.map((r) => r.mean));
  return R;
}

function dailyValues(D, ivs, m) {
  const out = [];
  const d0 = new Date(Math.min(...ivs.map((x) => x[0]))); d0.setHours(0, 0, 0, 0);
  for (let t = d0.getTime(); t < Math.max(...ivs.map((x) => x[1])); t += DAY) {
    const sub = ivs.map(([a, b]) => [Math.max(a, t), Math.min(b, t + DAY)]).filter(([a, b]) => b - a > 0);
    if (totLen(sub) < 12 * HOUR) continue;
    const v = evalWindow(D, sub)[m]; if (v != null) out.push(v);
  }
  return out;
}

// ---------- Vergleichsfenster automatisch zuordnen ----------
function changesOf(D, keys) {
  const out = [];
  for (let i = 1; i < D.segs.length; i++) {
    const p0 = D.segs[i - 1].prof, p1 = D.segs[i].prof;
    const diff = diffKeys(p0, p1);
    if (diff.some((k) => keys.includes(k))) out.push({ t: D.segs[i].a, i, diff, from: p0, to: p1 });
  }
  return out;
}

// Alle Abschnitte mit passendem Profil und Betrieb EIN; nach jedem Abschnittsbeginn (Änderung, Wiedereinschalten) Übergangszeit ausschließen.
function autoWindows(D, ch, cfg, keys) {
  const refProf = ch.from, testProf = ch.to;
  const lim = cfg.max_window_days * DAY, tr = cfg.transition_h * HOUR;
  const ref = [], test = [], assumed = new Set(); let rl = 0, tl = 0;
  const ok = (s, target) => {
    if (s.prof.P00 === 0 || !profMatch(s.prof, target)) return false;
    if (keys.some((k) => s.prof[k] == null)) return false; // eigener Parameter muss belegt sein
    PK.forEach((k) => { if (k !== 'P00' && s.prof[k] == null && target[k] != null && !((k === 'P15' || k === 'P16') && target.P17 === 0)) assumed.add(k); });
    return true;
  };
  for (let j = ch.i - 1; j >= 0 && rl < lim; j--) {
    const s = D.segs[j]; if (!ok(s, refProf)) continue;
    const a = Math.max(s.a + (j === 0 ? 0 : tr), s.b - (lim - rl)); if (s.b - a > 0) { ref.unshift([a, s.b]); rl += s.b - a; }
  }
  for (let j = ch.i; j < D.segs.length && tl < lim; j++) {
    const s = D.segs[j]; if (!ok(s, testProf)) continue;
    const a = s.a + tr, b = Math.min(s.b, a + (lim - tl)); if (b - a > 0) { test.push([a, b]); tl += b - a; }
  }
  return { ref, test, assumed: [...assumed] };
}

// ---------- Bewertung ----------
function grade(rule, r, t) {
  if (r == null || t == null || !isFinite(r) || !isFinite(t) || rule.info || !rule.better) return null;
  let d;
  if (rule.type === 'abs') d = rule.better === 'lower' ? r - t : t - r;
  else { if (Math.abs(r) < 1e-9) return null; d = ((t - r) / Math.abs(r)) * 100; if (rule.better === 'lower') d = -d; }
  const s = d > rule.t2 ? 5 : d >= rule.t1 ? 4 : d > -rule.t1 ? 3 : d >= -rule.t2 ? 2 : 1;
  return { d, s, arrow: d >= rule.t1 ? '↑' : d <= -rule.t1 ? '↓' : '≈', word: d >= rule.t1 ? 'besser' : d <= -rule.t1 ? 'schlechter' : 'gleich' };
}

function weatherCheck(ref, test, cfg) {
  if (ref.aussen == null || test.aussen == null) return { ok: false, txt: 'Außentemperatur fehlt' };
  const dT = Math.abs(ref.aussen - test.aussen);
  const ov = Math.max(0, Math.min(ref.aussenMax, test.aussenMax) - Math.max(ref.aussenMin, test.aussenMin));
  const span = Math.min(ref.aussenMax - ref.aussenMin, test.aussenMax - test.aussenMin) || 1;
  const ok = dT <= cfg.max_dt_aussen && ov / span >= 0.5;
  return { ok, dT, txt: ok ? `vergleichbar (Ø ${fmt(ref.aussen, 1, '°C')} vs. ${fmt(test.aussen, 1, '°C')})` : `nicht ausreichend vergleichbar (Ø ${fmt(ref.aussen, 1, '°C')} vs. ${fmt(test.aussen, 1, '°C')}, Überlappung ${fmt((ov / span) * 100, 0, '%')})` };
}

function safety(R, cfg) {
  const w = [];
  if (R.vlMinDef != null && R.vlMinDef < cfg.vl_min_def_warn) w.push(`Vorlauf fiel beim Abtauen auf ${fmt(R.vlMinDef, 1, '°C')} (konfigurierbare Warnschwelle ${cfg.vl_min_def_warn} °C, kein Herstellerwert).`);
  if (R.ueMin != null && R.ueMin < cfg.ue_min_warn) w.push(`Überhitzung im stationären Lauf zeitweise ${fmt(R.ueMin, 1, 'K')} (5-min-Mittel, nahe null/negativ; Schwelle ${cfg.ue_min_warn} K).`);
  return w;
}

function assess(D, rule, ivRef, ivTest, cfg, isolated, assumed = []) {
  const ref = evalWindow(D, ivRef), test = evalWindow(D, ivTest);
  const out = { ref, test, isolated, reasons: [], warns: [...safety(test, cfg)] };
  out.weather = weatherCheck(ref, test, cfg);
  const pr = rule.primary;
  out.g = grade(pr, ref[pr.m], test[pr.m]);
  out.sec = (rule.secondary || []).map((s) => ({ rule: s, r: ref[s.m], t: test[s.m], g: grade(s, ref[s.m], test[s.m]) }));
  const minH = Math.min(ref.hours || 0, test.hours || 0), cov = Math.min(ref.cover ?? 0, test.cover ?? 0);
  let conf = minH >= cfg.min_hours_hoch && cov >= 0.95 ? 'hoch' : minH >= cfg.min_hours_mittel && cov >= cfg.min_cover ? 'mittel' : 'gering';
  if (minH < cfg.min_hours_mittel) out.reasons.push(`zu kurzes Fenster (${fmt(minH, 0, 'h')}, mind. ${cfg.min_hours_mittel} h)`);
  if (cov < cfg.min_cover) out.reasons.push(`Datenvollständigkeit ${fmt(cov * 100, 0, '%')}`);
  if (pr.m === 'starts24' && (ref.nStarts ?? 0) + (test.nStarts ?? 0) < 10) { conf = 'gering'; out.reasons.push('zu wenige Heizstarts für eine Aussage'); }
  if (out.g) {
    const dr = dailyValues(D, ivRef, pr.m), dtv = dailyValues(D, ivTest, pr.m);
    const sd = Math.max(std(dr) ?? 0, std(dtv) ?? 0);
    out.spread = { nRef: dr.length, nTest: dtv.length, sd };
    if (dr.length < 2 || dtv.length < 2) { if (conf === 'hoch') conf = 'mittel'; }
    else if (sd > Math.abs(test[pr.m] - ref[pr.m])) { conf = 'gering'; out.reasons.push('Tagesstreuung größer als der Unterschied'); }
  }
  if (!out.weather.ok) { conf = 'gering'; out.reasons.push('Außenbedingungen ' + out.weather.txt); }
  if (assumed.length) { if (conf === 'hoch') conf = 'mittel'; out.reasons.push(`nicht verifiziert: ${assumed.join(', ')} vor Aufzeichnungsbeginn als unverändert angenommen`); }
  out.conf = conf;
  const critUnknown = out.sec.filter((s) => s.rule.critical && (s.r == null || s.t == null)).map((s) => M[s.rule.m][0]);
  out.status = 'stars';
  if (!out.g) { out.status = 'nodata'; out.reasons.unshift('Hauptkennzahl in mindestens einem Fenster nicht verfügbar'); }
  else if (rule.noStars) out.status = 'nostars';
  else if (!isolated) out.status = 'profile';
  else if (conf === 'gering') out.status = 'weak';
  else if (out.warns.length) out.status = 'safety';
  else if (critUnknown.length) { out.status = 'counter'; out.reasons.push('Gegenwirkung unbekannt: ' + critUnknown.join(', ')); }
  return out;
}

function explain(rule, A) {
  if (!A || !A.g) return '';
  const pr = rule.primary, [l, u, d] = M[pr.m];
  let s = `${A.weather.ok ? 'Unter ähnlichen Außenbedingungen' : 'Bei nicht vergleichbaren Außenbedingungen'} ergab sich für „${l}“ ${fmt(A.test[pr.m], d, u)} statt ${fmt(A.ref[pr.m], d, u)} (${A.g.word})`;
  const c = A.sec.find((x) => x.rule.critical && x.g);
  if (c) { const [l2, u2, d2] = M[c.rule.m]; s += `; gleichzeitig ${c.g.word === 'gleich' ? 'blieb' : 'veränderte sich'} „${l2}“ ${c.g.word === 'gleich' ? 'nahezu gleich' : 'von ' + fmt(c.r, d2, u2) + ' auf ' + fmt(c.t, d2, u2)} (${c.g.word})`; }
  return s + '.';
}

// ---------- Darstellung ----------
function starsHtml(A) {
  if (!A || ['nodata', 'weak', 'profile', 'counter', 'safety'].includes(A.status) || !A.g) {
    const lbl = !A ? 'Noch keine Bewertung' : { nodata: 'Noch keine Bewertung', weak: 'Nicht belastbar', profile: 'Nur Profilbewertung', counter: 'Gegenwirkung unbekannt', safety: 'Sicherheitsprüfung offen' }[A.status] || 'Noch keine Bewertung';
    return `<div class="stars" style="color:${C.grey}">☆☆☆☆☆</div><div class="slbl" style="color:${C.grey}">${lbl}</div>`;
  }
  if (A.status === 'nostars') return `<div class="stars" style="color:${C.grey}">— keine Sterne —</div><div class="slbl" style="color:${C.grey}">Referenzparameter ${A.g.arrow} ${A.g.word}</div>`;
  const s = A.g.s, col = s >= 4 ? (s === 5 ? C.ok : C.cy) : s === 3 ? C.gold : C.red;
  return `<div class="stars" style="color:${col}" title="${s} von 5">${'★'.repeat(s)}<span style="color:#3a4a63">${'☆'.repeat(5 - s)}</span></div><div class="slbl" style="color:${col}">${A.g.arrow} ${A.g.word} · ${s}/5${s === 3 ? ' · neutral' : ''}</div>`;
}

function confChip(A) {
  if (!A) return '<span class="chip">Vertrauen: –</span>';
  const col = A.conf === 'hoch' ? C.ok : A.conf === 'mittel' ? C.gold : C.grey;
  return `<span class="chip" style="border-color:${col};color:${col}">Vertrauen: ${A.conf}</span>`;
}

function sparkline(D, rule, ch, A) {
  const m = rule.primary.m, days = [];
  const d0 = new Date(D.dataStart); d0.setHours(0, 0, 0, 0);
  for (let t = d0.getTime(); t < D.now; t += DAY) { const R = evalWindow(D, [[Math.max(t, D.dataStart), Math.min(t + DAY, D.now)]]); days.push({ t, v: R[m], au: R.aussen, h: R.hours }); }
  const vals = days.map((x) => x.v).filter((v) => v != null);
  if (!vals.length) return '<div class="muted">Noch keine Tageswerte.</div>';
  const W = 320, H = 86, pad = 16, bw = (W - 2 * pad) / days.length, max = Math.max(...vals) * 1.15 || 1;
  const x = (t) => pad + ((t - d0.getTime()) / (days.length * DAY)) * (W - 2 * pad);
  let s = `<svg viewBox="0 0 ${W} ${H + 14}" class="spark" role="img" aria-label="Tagesverlauf ${esc(M[m][0])}">`;
  days.forEach((dy, i) => {
    if (dy.v == null) return;
    const h = (dy.v / max) * (H - 10), mid = dy.t + DAY / 2;
    const col = A && inIvs(mid, A.test.ivs) ? C.cy : A && inIvs(mid, A.ref.ivs) ? '#7d93b5' : '#3a4a63';
    s += `<rect x="${(pad + i * bw + 1).toFixed(1)}" y="${(H - h).toFixed(1)}" width="${Math.max(2, bw - 2).toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${col}"><title>${dd(dy.t)}: ${fmt(dy.v, M[m][2], M[m][1])} · Außen Ø ${fmt(dy.au, 1, '°C')}${dy.h < 23 ? ' · unvollständiger Tag' : ''}</title></rect>`;
    if (i % Math.ceil(days.length / 6) === 0) s += `<text x="${(pad + i * bw).toFixed(1)}" y="${H + 12}" class="ax">${dd(dy.t)}</text>`;
  });
  if (ch) s += `<line x1="${x(ch.t).toFixed(1)}" x2="${x(ch.t).toFixed(1)}" y1="2" y2="${H}" stroke="${C.gold}" stroke-width="1.5" stroke-dasharray="3 2"/><text x="${(x(ch.t) + 3).toFixed(1)}" y="10" class="ax" fill="${C.gold}">Änderung</text>`;
  return s + '</svg><div class="legend"><i style="background:#7d93b5"></i>Referenz <i style="background:' + C.cy + '"></i>Test <i style="background:' + C.gold + '"></i>Parameteränderung</div>';
}

function metricRows(A, rule) {
  const row = (rl, r, t, g, extra) => { const [l, u, d] = M[rl.m]; const pct = g ? (rl.type === 'abs' ? fmt(g.d, 2, 'K') : fmt(g.d, 1, '%')) : '–';
    const col = !g ? C.grey : g.arrow === '↑' ? C.ok : g.arrow === '↓' ? C.red : C.gold;
    return `<tr><td>${l}${extra || ''}</td><td>${fmt(r, d, u)}</td><td>${fmt(t, d, u)}</td><td style="color:${col}">${g ? g.arrow + ' ' + pct : rl.info ? 'Info' : 'NA'}</td></tr>`; };
  let h = `<table class="mt"><thead><tr><th>Kennzahl</th><th>Referenz</th><th>Test</th><th>Wirkung</th></tr></thead><tbody>`;
  h += row(rule.primary, A.ref[rule.primary.m], A.test[rule.primary.m], A.g, ' <b>(Ziel)</b>');
  for (const s of A.sec) h += row(s.rule, s.r, s.t, s.g, s.rule.critical ? ' <span class="crit">Gegenwirkung</span>' : '');
  h += `<tr class="ctx"><td>Außentemperatur Ø (min…max)</td><td>${fmt(A.ref.aussen, 1, '°C')} (${fmt(A.ref.aussenMin, 0)}…${fmt(A.ref.aussenMax, 0)})</td><td>${fmt(A.test.aussen, 1, '°C')} (${fmt(A.test.aussenMin, 0)}…${fmt(A.test.aussenMax, 0)})</td><td>${A.weather.ok ? '≈' : '≠'}</td></tr>`;
  h += `<tr class="ctx"><td>Heizbedarf: Wärme / 24 h</td><td>${fmt(A.ref.th24, 1, 'kWh')}</td><td>${fmt(A.test.th24, 1, 'kWh')}</td><td></td></tr>`;
  h += `<tr class="ctx"><td>Zeitraum · Heizlaufzeit</td><td>${fmt(A.ref.hours, 0, 'h')} · ${fmt(A.ref.runH, 0, 'h')}</td><td>${fmt(A.test.hours, 0, 'h')} · ${fmt(A.test.runH, 0, 'h')}</td><td></td></tr>`;
  h += `<tr class="ctx"><td>Stichprobe: Starts · Abtauungen</td><td>${A.ref.nStarts ?? '–'} · ${A.ref.nDefrost ?? '–'}</td><td>${A.test.nStarts ?? '–'} · ${A.test.nDefrost ?? '–'}</td><td></td></tr>`;
  h += `<tr class="ctx"><td>Datenvollständigkeit</td><td>${fmt((A.ref.cover ?? 0) * 100, 0, '%')}</td><td>${fmt((A.test.cover ?? 0) * 100, 0, '%')}</td><td></td></tr>`;
  return h + '</tbody></table>';
}

const ivTxt = (ivs) => (ivs && ivs.length ? ivs.map(([a, b]) => `${dt(a)} – ${dt(b)}`).join('<br>') : '–');

// ---------- Karte ----------
class AvarmaParameterWirkung extends HTMLElement {
  setConfig(config) {
    this._cfg = { ...DEFAULTS, ...(config || {}) };
    this._cfg.mode = this._cfg.mode || 'params';
    const r = JSON.parse(JSON.stringify(DEFAULT_RULES));
    for (const [k, v] of Object.entries(this._cfg.rules || {})) r[k] = { ...(r[k] || {}), ...v };
    this._rules = r;
    this._open = this._open || null;
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
  }
  getCardSize() { return this._cfg.mode === 'header' ? 3 : 8; }
  getGridOptions() { return { columns: 'full', rows: 'auto' }; }
  set hass(h) {
    this._hass = h;
    const sig = [E.refA, E.refB, E.testA, E.testB, E.profil, E.esp, ...PK.map((k) => P[k].e)].map((e) => h.states[e]?.state + '@' + h.states[e]?.last_changed).join('|');
    if (sig !== this._sig) { this._sig = sig; this._refresh(); }
    else if (!this._loading && STORE.data && STORE.data !== this._D) this._refresh();
  }
  async _refresh() {
    if (this._loading) return; this._loading = true;
    try { this._D = await loadData(this._hass, this._cfg); this._err = null; } catch (e) { this._err = e && (e.message || e.code || JSON.stringify(e)); }
    this._loading = false; this._render();
    clearTimeout(this._tm); this._tm = setTimeout(() => this._refresh(), this._cfg.reload_min * 60e3 + 500);
  }
  disconnectedCallback() { clearTimeout(this._tm); }

  _badge(k) {
    const st = this._hass.states[P[k].e], esp = this._hass.states[E.esp]?.state === 'on';
    if (!st || pVal(k, st.state) == null) return ['Daten fehlen', C.grey, 'mdi:help-circle-outline'];
    const age = Date.now() - new Date(st.last_changed).getTime();
    if (esp && age > this._cfg.debounce_s * 1000) return ['Istwert bestätigt', C.ok, 'mdi:check-decagram'];
    return ['nicht verifiziert', C.gold, 'mdi:alert-circle-outline'];
  }

  _render() {
    const root = this.shadowRoot; if (!root) return;
    let body;
    if (this._err) body = `<div class="err">Daten konnten nicht geladen werden: ${esc(this._err)}</div>`;
    else if (!this._D) body = `<div class="muted">Lade Recorder-Daten …</div>`;
    else body = { header: () => this._header(), params: () => this._params(), ab: () => this._ab(), regeln: () => this._regeln() }[this._cfg.mode]?.() ?? 'Unbekannter Modus';
    root.innerHTML = `<style>${CSS}</style><ha-card>${body}</ha-card>`;
    root.querySelectorAll('[data-open]').forEach((el) => el.addEventListener('click', () => { const k = el.getAttribute('data-open'); this._open = this._open === k ? null : k; this._render(); }));
    root.querySelectorAll('[data-set]').forEach((el) => el.addEventListener('click', (ev) => { ev.stopPropagation(); this._setWin(el.getAttribute('data-set'), +el.getAttribute('data-a'), +el.getAttribute('data-b')); }));
    root.querySelectorAll('[data-export]').forEach((el) => el.addEventListener('click', () => this._export(el.getAttribute('data-export'))));
    const rb = root.querySelector('[data-reload]'); if (rb) rb.addEventListener('click', () => { STORE.at = 0; this._refresh(); });
  }

  // ----- A: Kopfleiste Betriebsprofil -----
  _header() {
    const D = this._D, h = this._hass, keys = ['P00', 'P02', 'P06', 'P114', 'P46', 'P60', 'P47', 'P17', 'P15', 'P16', 'P19'];
    const chips = keys.map((k) => { const [b, col] = this._badge(k); const v = pVal(k, h.states[P[k].e]?.state);
      return `<div class="pc" title="${esc(P[k].n)}: ${b}"><span class="pk">${k}</span><span class="pv">${pTxt(k, v)}</span><span class="dot" style="background:${col}"></span><span class="pb" style="color:${col}">${b}</span></div>`; }).join('');
    const allCh = changesOf(D, PK).slice(-4).reverse();
    const chTxt = allCh.length ? allCh.map((c) => `<div>${dt(c.t)} · ${c.diff.map((k) => `${k} ${pTxt(k, c.from[k])} → ${pTxt(k, c.to[k])}`).join(', ')}</div>`).join('') : '<div class="muted">keine im Aufzeichnungszeitraum</div>';
    const last24 = evalWindow(D, [[D.now - DAY, D.now]]), last7 = evalWindow(D, [[Math.max(D.dataStart, D.now - 7 * DAY), D.now]]);
    const seit = h.states[E.profilSeit]?.state;
    const ra = h.states[E.refA]?.state, rb = h.states[E.refB]?.state, ta = h.states[E.testA]?.state, tb = h.states[E.testB]?.state;
    const p46 = pVal('P46', h.states[P.P46.e]?.state);
    return `<div class="hd"><ha-icon icon="mdi:tune-variant"></ha-icon><div><div class="t1">Betriebsprofil</div><div class="t2">Maßgeblich ist der Register-Rücklesewert, nicht der zuletzt gesendete Sollwert.</div></div><button class="rl" data-reload title="Neu laden">⟳</button></div>
    <div class="pcs">${chips}</div>
    <div class="info">
      <div><b>Profil seit</b><span>${esc(seit || '–')}</span></div>
      <div><b>Letzte Änderungen</b><span>${chTxt}</span></div>
      <div><b>Vergleichsperiode A/B</b><span>Ref. ${esc(ra || '–')} – ${esc(rb || '–')}<br>Test ${esc(ta || '–')} – ${esc(tb || '–')}</span></div>
      <div><b>Außentemperatur</b><span>24 h: ${fmt(last24.aussenMin, 1)} … ${fmt(last24.aussenMax, 1, '°C')} · 7 Tage Ø ${fmt(last7.aussen, 1, '°C')}</span></div>
      <div><b>Datenvollständigkeit</b><span>24 h ${fmt((last24.cover ?? 0) * 100, 0, '%')} · 7 Tage ${fmt((last7.cover ?? 0) * 100, 0, '%')} · Rohdaten ab ${dt(D.dataStart)}</span></div>
    </div>
    ${p46 != null && p46 < 35 ? `<div class="warn"><ha-icon icon="mdi:alert"></ha-icon><div><b>P46 ${pTxt('P46', p46)}</b> liegt unter der vom Betreiber genannten Werkseinstellung 35 Hz – ohne ausdrückliche Freigabe nicht als langfristig sicher bewertet.</div></div>` : ''}
    <div class="note"><ha-icon icon="mdi:snowflake-melt"></ha-icon><div><b>P47</b> wirkt auf den Abtaubetrieb (Verdichterfrequenz beim Abtauen), nicht auf die Anzahl der Abtauungen als Stellgröße.</div></div>
    <div class="foot">Die Sterne zeigen die beobachtete Wirkung einer Einstellung <b>im Vergleich zu ähnlichen Betriebsbedingungen</b>. Sie sind keine Bewertung der Herstellersicherheit oder eine automatische Empfehlung. Abtauung, Heizbedarf, Außentemperatur und andere Parameteränderungen können das Ergebnis beeinflussen.</div>`;
  }

  // ----- B: Wirkungskarten -----
  _evalRule(id) {
    const D = this._D, rule = this._rules[id], chs = changesOf(D, rule.keys);
    const ch = chs[chs.length - 1];
    if (!ch) return { rule, ch: null, A: null };
    const isolated = ch.diff.every((k) => rule.keys.includes(k));
    const w = autoWindows(D, ch, this._cfg, rule.keys);
    const A = w.ref.length && w.test.length ? assess(D, rule, w.ref, w.test, this._cfg, isolated, w.assumed) : null;
    return { rule, ch, A, w };
  }
  _params() {
    const ids = this._cfg.cards || Object.keys(this._rules);
    this._evals = {};
    const tiles = ids.map((id) => {
      const ev = (this._evals[id] = this._evalRule(id)), { rule, ch, A } = ev, k0 = rule.keys[0];
      const cur = pVal(k0, this._hass.states[P[k0].e]?.state), [b, bc] = this._badge(k0);
      const prev = ch ? pTxt(k0, ch.from[k0]) : rule.vorher || 'nicht dokumentiert';
      const open = this._open === id;
      return `<div class="tile ${open ? 'open' : ''}" data-open="${id}" role="button" tabindex="0" aria-expanded="${open}">
        <div class="th"><ha-icon icon="${rule.icon || 'mdi:tune'}"></ha-icon><div class="tn"><div class="pn">${rule.pnr || k0} · ${esc(rule.wirkung)}</div><div class="tt">${esc(rule.title)}</div></div></div>
        <div class="tv"><span class="old">${esc(prev)}</span> → <b>${pTxt(k0, cur)}</b> <span class="dot" style="background:${bc}" title="${b}"></span></div>
        ${starsHtml(A)}
        <div class="tc">${confChip(A)}${ch ? `<span class="chip">seit ${dd(ch.t)}</span>` : ''}</div>
        ${open ? this._detail(ev) : ''}
      </div>`;
    }).join('');
    return `<div class="hd"><ha-icon icon="mdi:star-half-full"></ha-icon><div><div class="t1">Wirkung je Parameter</div><div class="t2">Antippen für Details · Sterne nur bei plausibler Vergleichsbasis</div></div><button class="rl" data-reload title="Neu laden">⟳</button></div><div class="grid">${tiles}</div>`;
  }
  _detail({ rule, ch, A, w }) {
    let h = '<div class="det" onclick="event.stopPropagation()">';
    if (rule.warn) h += `<div class="warn"><ha-icon icon="mdi:alert"></ha-icon><div>${esc(rule.warn)}</div></div>`;
    if (rule.hinweis) h += `<div class="note"><ha-icon icon="mdi:information-outline"></ha-icon><div>${esc(rule.hinweis)}</div></div>`;
    if (!ch) return h + `<div class="muted">Im Aufzeichnungszeitraum (ab ${dt(this._D.dataStart)}) ist keine Änderung dieses Parameters dokumentiert – kein Referenzfenster, daher <b>keine Bewertung</b>.</div>${sparkline(this._D, rule, null, null)}</div>`;
    h += `<div class="kv"><b>Änderung</b> ${dt(ch.t)}: ${ch.diff.map((k) => `${k} ${pTxt(k, ch.from[k])} → ${pTxt(k, ch.to[k])}`).join(', ')}${ch.diff.length > rule.keys.length || !ch.diff.every((k) => rule.keys.includes(k)) ? ' <span class="crit">gleichzeitige Änderungen – nur Profilbewertung</span>' : ''}</div>`;
    h += `<div class="kv"><b>Referenzfenster</b><br>${ivTxt(w.ref)}</div><div class="kv"><b>Testfenster</b> (ohne ${this._cfg.transition_h} h Übergang)<br>${ivTxt(w.test)}</div>`;
    if (!A) return h + '<div class="muted">Kein auswertbares Fenster.</div></div>';
    A.warns.forEach((x) => (h += `<div class="warn"><ha-icon icon="mdi:alert-octagon"></ha-icon><div><b>Technischer Warnhinweis:</b> ${esc(x)} Keine automatisierte Freigabe.</div></div>`));
    h += `<div class="ex">${esc(explain(rule, A))}</div>`;
    h += metricRows(A, rule);
    h += `<div class="kv"><b>Datenqualität: ${A.conf}</b>${A.reasons.length ? ' – ' + A.reasons.map(esc).join('; ') : ' – Fensterlänge, Vollständigkeit und Wetter ausreichend'}${A.spread ? ` · Tageswerte ${A.spread.nRef}/${A.spread.nTest}, Streuung σ ${fmt(A.spread.sd, 2)}` : ''} · Quelle: ${A.test.src}</div>`;
    h += sparkline(this._D, rule, ch, A);
    return h + '</div>';
  }

  // ----- C: A/B-Vergleich -----
  _winFromHelpers() {
    const g = (e) => { const s = this._hass.states[e]; return s && s.attributes && s.attributes.timestamp ? s.attributes.timestamp * 1000 : null; };
    return { ref: [g(E.refA), g(E.refB)], test: [g(E.testA), g(E.testB)] };
  }
  _ab() {
    const D = this._D, W = this._winFromHelpers();
    const segs = D.segs.filter((s) => s.b - s.a >= 6 * HOUR).slice(-8).reverse();
    let h = `<div class="hd"><ha-icon icon="mdi:compare-horizontal"></ha-icon><div><div class="t1">Vergleichsmodus A/B</div><div class="t2">Zwei dokumentierte Zeitfenster: Referenz und Test</div></div><button class="rl" data-reload title="Neu laden">⟳</button></div>`;
    h += `<div class="segs"><div class="muted">Dokumentierte Parameterprofile (≥ 6 h) – als Fenster übernehmen:</div>${segs.map((s) => { const prev = D.segs[D.segs.indexOf(s) - 1];
      const diff = prev ? (s.prof.P00 === 0 ? 'Betrieb AUS (keine Bewertung)' : [...(prev.prof.P00 === 0 ? ['Betrieb EIN'] : []), ...diffKeys(prev.prof, s.prof).map((k) => `${k} ${pTxt(k, s.prof[k])}`)].join(', ') || 'gleiches Profil') : 'Aufzeichnungsbeginn';
      return `<div class="seg"><div><b>${dt(s.a)} – ${dt(s.b)}</b> · ${fmt((s.b - s.a) / HOUR, 0, 'h')}<div class="muted">${esc(diff)}</div></div><div class="bt"><button data-set="ref" data-a="${s.a}" data-b="${s.b}">Referenz</button><button data-set="test" data-a="${s.a}" data-b="${s.b}">Test</button></div></div>`; }).join('')}</div>`;
    if (!W.ref[0] || !W.ref[1] || !W.test[0] || !W.test[1] || W.ref[1] <= W.ref[0] || W.test[1] <= W.test[0]) return h + '<div class="muted">Bitte Referenz- und Testfenster wählen (Helfer „Avarma Vergleich …“ oder Knöpfe oben).</div>';
    const ivR = [W.ref], ivT = [W.test];
    const profIn = (iv) => D.segs.filter((s) => s.prof.P00 !== 0 && ovl(s.a, s.b, iv[0], iv[1]) > 0);
    const pR = profIn(W.ref), pT = profIn(W.test);
    const mixed = (L) => L.some((s) => L.some((u) => diffKeys(s.prof, u.prof).length));
    const mixR = mixed(pR), mixT = mixed(pT);
    const diffK = pR.length && pT.length ? diffKeys(pR[pR.length - 1].prof, pT[0].prof) : [];
    const ruleId = Object.keys(this._rules).find((id) => diffK.length && diffK.every((k) => this._rules[id].keys.includes(k)));
    const rule = ruleId ? this._rules[ruleId] : { primary: { m: 'az', better: 'higher', type: 'pct', t1: 3, t2: 6 }, secondary: [{ m: 'starts24', better: 'lower', type: 'pct', t1: 5, t2: 10 }, { m: 'vlAbw', better: 'lower', type: 'abs', t1: 0.3, t2: 0.8, critical: true }, { m: 'defrost24', better: 'lower', type: 'pct', t1: 10, t2: 20 }, { m: 'runPerStart', better: 'higher', type: 'pct', t1: 5, t2: 10 }, { m: 'vlMinDef', better: 'higher', type: 'abs', t1: 1, t2: 2 }, { m: 'reheat', better: 'lower', type: 'pct', t1: 10, t2: 20 }, { m: 'raum', better: 'higher', type: 'abs', t1: 0.3, t2: 0.8 }] };
    const isolated = !!ruleId && !mixR && !mixT;
    const A = assess(D, rule, ivR, ivT, this._cfg, isolated);
    this._lastAB = { W, diffK, ruleId, A, mixR, mixT };
    h += `<div class="ab2"><div><b>Referenz</b><br>${dt(W.ref[0])} – ${dt(W.ref[1])}${mixR ? '<div class="crit">Parameteränderung im Fenster!</div>' : ''}</div><div><b>Test</b><br>${dt(W.test[0])} – ${dt(W.test[1])}${mixT ? '<div class="crit">Parameteränderung im Fenster!</div>' : ''}</div></div>`;
    h += `<div class="kv"><b>Unterschied der Profile:</b> ${diffK.length ? diffK.map((k) => `${k} ${pTxt(k, pR[pR.length - 1].prof[k])} → ${pTxt(k, pT[0].prof[k])}`).join(', ') : 'keiner erkannt'} – ${isolated ? `isolierte Bewertung (${esc(this._rules[ruleId].title)})` : diffK.length > 1 || mixR || mixT ? '<span class="crit">mehrere Änderungen: nur Profilbewertung, keine Einzelwirkung</span>' : 'Profilbewertung'}</div>`;
    h += `<div class="kv"><b>Wettervergleichbarkeit:</b> ${A.weather.txt} · Feuchte/Wind: nicht verfügbar</div>`;
    h += `<div class="sum">${starsHtml(A)}${confChip(A)}</div>`;
    A.warns.forEach((x) => (h += `<div class="warn"><ha-icon icon="mdi:alert-octagon"></ha-icon><div><b>Technischer Warnhinweis:</b> ${esc(x)}</div></div>`));
    if (A.reasons.length) h += `<div class="kv muted">${A.reasons.map(esc).join(' · ')}</div>`;
    h += `<div class="ex">${esc(explain(rule, A))}</div>` + metricRows(A, rule);
    h += `<div class="bt exp"><button data-export="csv">Export CSV</button><button data-export="json">Export JSON</button></div>`;
    return h;
  }
  async _setWin(which, a, b) {
    const ids = which === 'ref' ? [E.refA, E.refB] : [E.testA, E.testB];
    const f = (t) => { const d = new Date(t), p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; };
    await this._hass.callService('input_datetime', 'set_datetime', { datetime: f(a) }, { entity_id: ids[0] });
    await this._hass.callService('input_datetime', 'set_datetime', { datetime: f(b) }, { entity_id: ids[1] });
  }
  _export(kind) {
    const L = this._lastAB; if (!L) return;
    const keys = Object.keys(M).filter((m) => L.A.ref[m] != null || L.A.test[m] != null);
    let data, mime, name;
    if (kind === 'csv') {
      const rows = [['Kennzahl', 'Einheit', 'Referenz', 'Test'], ...keys.map((m) => [M[m][0], M[m][1], L.A.ref[m] ?? '', L.A.test[m] ?? '']),
        ['Außen Ø', '°C', L.A.ref.aussen ?? '', L.A.test.aussen ?? ''], ['Stunden', 'h', L.A.ref.hours, L.A.test.hours], ['Vollständigkeit', '', L.A.ref.cover, L.A.test.cover],
        ['Referenz', '', new Date(L.W.ref[0]).toISOString(), new Date(L.W.ref[1]).toISOString()], ['Test', '', new Date(L.W.test[0]).toISOString(), new Date(L.W.test[1]).toISOString()],
        ['Status', '', L.A.status, L.A.conf], ['Sterne', '', L.A.g ? L.A.g.s : '', '']];
      data = rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(';')).join('\n'); mime = 'text/csv'; name = 'avarma_ab_vergleich.csv';
    } else { data = JSON.stringify({ version: AVPW_VERSION, erstellt: new Date().toISOString(), fenster: L.W, profilUnterschied: L.diffK, regel: L.ruleId || 'Profil', ergebnis: { status: L.A.status, vertrauen: L.A.conf, sterne: L.A.g ? L.A.g.s : null, gruende: L.A.reasons, warnungen: L.A.warns, referenz: { ...L.A.ref, ivs: undefined }, test: { ...L.A.test, ivs: undefined } } }, null, 2); mime = 'application/json'; name = 'avarma_ab_vergleich.json'; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: mime })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  // ----- E: Regeln transparent -----
  _regeln() {
    const c = this._cfg, r = this._rules;
    const rr = (x) => `${M[x.m][0]}${M[x.m][1] ? ' [' + M[x.m][1] + ']' : ''}: ${x.info || !x.better ? 'nur Info' : (x.better === 'lower' ? 'niedriger = besser' : 'höher = besser') + ', ' + (x.type === 'abs' ? `±${x.t1}/${x.t2} K absolut` : `±${x.t1}/${x.t2} %`)}${x.critical ? ' · Gegenwirkung' : ''}`;
    return `<div class="hd"><ha-icon icon="mdi:scale-balance"></ha-icon><div><div class="t1">Bewertungsregeln</div><div class="t2">Konfigurierbar im Karten-YAML (rules:, Schwellen) · Version ${AVPW_VERSION}</div></div></div>
    <div class="rules"><p><b>Sterne-Mapping</b> (normierte Verbesserung gegenüber Referenz, Wirkungsrichtung je Kennzahl): &gt; t2 = 5 · t1…t2 = 4 · innerhalb ±t1 = 3 (neutral) · −t1…−t2 = 2 · &lt; −t2 = 1. Standard t1/t2 = 5/10 %. Visualisierungsvorschlag, keine Signifikanzgrenze.</p>
    <p><b>Sterne nur wenn:</b> Hauptkennzahl in beiden Fenstern vorhanden (sonst NA) · isolierte Änderung (sonst Profilbewertung) · Vertrauen ≥ mittel (≥ ${c.min_hours_mittel} h je Fenster, ≥ ${c.min_cover * 100} % Daten, Außen-Ø-Differenz ≤ ${c.max_dt_aussen} K und ≥ 50 % Bereichsüberlappung, Tagesstreuung kleiner als Unterschied) · keine Sicherheitswarnung (VL beim Abtauen &lt; ${c.vl_min_def_warn} °C, Überhitzung &lt; ${c.ue_min_warn} K) · Gegenwirkung bekannt.</p>
    <p><b>Fenster:</b> automatisch alle Abschnitte mit identischem Profil vor/nach der Änderung, max. ${c.max_window_days} Tage, Übergang ${c.transition_h} h nach jeder Änderung ausgeschlossen, Werte erst nach ${c.debounce_s} s Stabilität. Bei Nachtmodus AUS werden P15/P16 ignoriert.</p>
    <p><b>Ereignisse:</b> echter Heizstart = Verdichterfrequenz 0 → &gt; 0 außerhalb Abtauung (+90 s Nachlauf), nicht nach ESP-Ausfall &gt; 5 min. Abtauung = Betriebszustand Bit 16 (binary_sensor.avarma_abtauung). Der Zähler „Verdichterstarts inkl. Abtauungen“ wird nicht als Heiztakt verwendet.</p>
    <p><b>NA-Behandlung:</b> fehlende Kennzahl = „–“/NA, nie 0; fehlende Hauptkennzahl ⇒ ☆☆☆☆☆ grau. Normierung je beobachteter Stunde. AZ = Σ Wärme (Schätzung) / Σ Strom inkl. Übergängen und Standby.</p>
    ${Object.entries(r).map(([id, x]) => `<details><summary>${x.pnr || x.keys.join('/')} – ${esc(x.title)}${x.noStars ? ' (keine Sterne)' : ''}</summary><div>Ziel: ${rr(x.primary)}</div>${(x.secondary || []).map((s) => `<div>Neben: ${rr(s)}</div>`).join('')}</details>`).join('')}</div>`;
  }
}

const CSS = `:host{--f:Inter,Roboto,"Segoe UI",sans-serif}
ha-card{background:${C.bg};border:1px solid ${C.bd};border-radius:18px;color:${C.fg};font-family:var(--f);padding:14px;box-shadow:none}
.hd{display:flex;align-items:center;gap:10px;margin-bottom:10px}.hd ha-icon{color:${C.cy};--mdc-icon-size:26px}.t1{font-size:18px;font-weight:800}.t2{font-size:12.5px;color:${C.grey}}
.rl{margin-left:auto;background:#16263d;border:1px solid ${C.bd};color:${C.fg};border-radius:10px;width:34px;height:34px;font-size:18px;cursor:pointer}
.pcs{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.pc{background:#16263d;border:1px solid ${C.bd};border-radius:12px;padding:8px 10px;display:grid;grid-template-columns:auto 1fr auto;gap:2px 8px;align-items:center}
.pk{font-size:12px;font-weight:700;color:${C.cy}}.pv{font-size:16px;font-weight:800;text-align:right}.pb{grid-column:1/-1;font-size:11.5px}
.dot{display:inline-block;width:10px;height:10px;border-radius:50%}
.info{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:8px;margin-top:10px}.info>div{background:#0f1a2b;border-radius:12px;padding:8px 10px;font-size:13px}.info b{display:block;color:${C.grey};font-size:12px;margin-bottom:2px}
.warn,.note{display:flex;gap:10px;align-items:flex-start;border-radius:12px;padding:9px 11px;margin-top:8px;font-size:13px}.warn{background:#2a1216;border:1px solid ${C.red}}.warn ha-icon{color:${C.red};flex:none}.note{background:#13233a;border:1px solid ${C.bd}}.note ha-icon{color:${C.cy};flex:none}
.foot{margin-top:10px;font-size:12.5px;color:#c9d7ea;border-top:1px solid ${C.bd};padding-top:8px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px}
.tile{background:#16263d;border:1px solid ${C.bd};border-radius:14px;padding:10px;cursor:pointer;min-width:0}.tile.open{grid-column:1/-1;cursor:default;border-color:${C.cy}}
.th{display:flex;gap:8px;align-items:center}.th ha-icon{color:${C.cy};--mdc-icon-size:22px;flex:none}.tn{min-width:0}.pn{font-size:11.5px;color:${C.grey};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tt{font-size:14.5px;font-weight:800;line-height:1.2}
.tv{font-size:13px;margin:6px 0 2px}.tv .old{color:${C.grey}}
.stars{font-size:22px;letter-spacing:2px;line-height:1.2}.slbl{font-size:12px;font-weight:700}
.tc{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px}.chip{font-size:11px;border:1px solid ${C.bd};border-radius:999px;padding:2px 8px;color:${C.grey}}
.det{margin-top:10px;cursor:auto}.kv{font-size:13px;margin-top:8px}.ex{margin-top:10px;font-size:14px;background:#0f1a2b;border:1px solid ${C.bd};padding:8px 10px;border-radius:10px}
.mt{width:100%;border-collapse:collapse;margin-top:10px;font-size:12.5px}.mt th{text-align:left;color:${C.grey};font-weight:600;border-bottom:1px solid ${C.bd};padding:4px}.mt td{padding:4px;border-bottom:1px solid #1d2c44;vertical-align:top}.mt td:nth-child(n+2){white-space:nowrap}.mt tr.ctx td{color:#b5c4d9}
.crit{color:${C.gold};font-size:11.5px;font-weight:700}.muted{color:${C.grey};font-size:12.5px}.err{color:${C.red}}
.spark{width:100%;height:auto;margin-top:10px}.ax{font-size:9px;fill:${C.grey}}.legend{font-size:11px;color:${C.grey};display:flex;gap:10px;align-items:center}.legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:3px}
.segs{display:grid;gap:6px;margin-bottom:10px}.seg{display:flex;justify-content:space-between;gap:8px;align-items:center;background:#16263d;border:1px solid ${C.bd};border-radius:12px;padding:7px 10px;font-size:13px}
.bt{display:flex;gap:6px;flex-wrap:wrap}.bt button{background:#13233a;border:1px solid ${C.cy};color:${C.fg};border-radius:9px;padding:5px 9px;font-size:12px;cursor:pointer}.exp{margin-top:10px}
.ab2{display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px}.ab2>div{background:#0f1a2b;border-radius:12px;padding:8px 10px}
.sum{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:8px}
.rules{font-size:13px}.rules p{margin:6px 0}.rules details{background:#16263d;border-radius:10px;padding:6px 10px;margin-top:6px}.rules summary{cursor:pointer;font-weight:700}
@media (max-width:420px){.grid{grid-template-columns:1fr 1fr}.stars{font-size:18px}.mt{font-size:11.5px}}`;

customElements.define('avarma-parameter-wirkung', AvarmaParameterWirkung);
window.customCards = window.customCards || [];
window.customCards.push({ type: 'avarma-parameter-wirkung', name: 'Avarma Parameter-Wirkung', description: 'Sterne-Bewertung der beobachteten Wirkung von Reglerparametern (nur lesend).' });

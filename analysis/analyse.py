# Copyright (c) 2026 AWendt206 · MIT-Lizenz · https://github.com/AWendt206/
"""Avarma 12 kW V1 – Wide-CSV aus HA-Recorder und Kalibrieranalyse der Kältekreis-Ampel.
Nur lesend. Keine Annahmen über Herstellergrenzen. Ergebnis: wide_60s.csv, ergebnis.json, bericht_tabellen.md
Aufruf: python -I analyse.py <history.json>
"""
import json, sys, math, statistics, datetime as dt


SRC = sys.argv[1]
TZ = dt.timezone(dt.timedelta(hours=1), 'MEZ')  # Zeitraum 07.–10.11.: MEZ = UTC+1 (keine Sommerzeit)
raw = json.load(open(SRC, encoding='utf-8'))['result']
P = 'sensor.hausinstallation_avarma_'
COLS = [  # (Spalte, Entität, Typ)
    ('compressor_Hz', P + 'verdichterfrequenz_ist', 'num'), ('fan_rpm', P + 'lufter_1_drehzahl', 'num'), ('outdoor_C', P + 'aussentemperatur', 'num'),
    ('mode', 'sensor.avarma_visueller_modus', 'str'), ('defrost_bit16', 'binary_sensor.avarma_abtauung', 'bin'), ('defrost_filtered', 'binary_sensor.avarma_abtauung_gefiltert', 'bin'),
    ('output_code', P + 'ausgangszustand_code', 'num'), ('assessable_ha', 'binary_sensor.avarma_kaltekreis_bewertbar', 'bin'), ('esp_online', 'binary_sensor.hausinstallation_avarma_status', 'bin'),
    ('flow_l_min', P + 'wasserdurchfluss', 'num'), ('pump_C1_percent', P + 'pumpe_c1_leistung', 'num'), ('pump_pwm_raw', P + 'pumpe_pwm', 'num'),
    ('Ts_C', P + 'sauggastemperatur', 'num'), ('Te_C', P + 'verdampfungstemperatur', 'num'), ('Tk_C', P + 'kondensationstemperatur', 'num'), ('Ty_C', P + 'flussigtemperatur_kaltemittel', 'num'),
    ('VL_C', P + 'vorlauftemperatur', 'num'), ('RL_C', P + 'rucklauftemperatur', 'num'), ('Ps_bar', P + 'niederdruck', 'num'), ('Pd_bar', P + 'hochdruck', 'num'),
    ('electric_W', 'sensor.avarma_strom_leistung', 'num'), ('eev_steps', P + 'expansionsventil_schritte', 'num'),
    ('P06', 'number.hausinstallation_avarma_hysterese_heizen', 'num'), ('P46', 'number.hausinstallation_avarma_mindestfrequenz_verdichter', 'num'), ('P47', 'number.hausinstallation_avarma_abtaufrequenz', 'num'),
    ('P60', 'number.hausinstallation_avarma_maximaldrehzahl_lufter', 'num'), ('P114', 'number.hausinstallation_avarma_frequenzabsenkung', 'num'),
]
MAXAGE = {'num': 24 * 3600, 'str': 24 * 3600, 'bin': 24 * 3600}  # Halten eines Wertes; Sensoren senden nur bei Änderung
PARAM_MAXAGE = 7 * 24 * 3600

def series(eid, typ):
    out = []
    for x in raw.get(eid, []):
        t = x.get('lc', x.get('lu')); s = x['s']
        if s in ('unavailable', 'unknown', None): v = None
        elif typ == 'num':
            try: v = float(s)
            except ValueError: v = None
        elif typ == 'bin': v = 1 if s == 'on' else 0 if s == 'off' else None
        else: v = s
        out.append((t, v))
    return out

S = {c: series(e, t) for c, e, t in COLS}
t0 = math.ceil(min(v[0][0] for v in S.values() if v) / 60) * 60
t1 = math.floor(max(v[-1][0] for v in S.values() if v) / 60) * 60
grid = list(range(int(t0), int(t1) + 1, 60))

def sample(ser, typ, col):
    res, j, last = [], 0, (None, None)
    ma = PARAM_MAXAGE if col.startswith('P') else MAXAGE[typ]
    for t in grid:
        while j < len(ser) and ser[j][0] <= t: last = ser[j]; j += 1
        lt, lv = last
        res.append(lv if lt is not None and lv is not None and t - lt <= ma else None)
    return res

W = {c: sample(S[c], t, c) for c, e, t in COLS}
n = len(grid)
# Abtau-Bit 1024 im Ausgangszustand-Code (Vierwegeventil / Abtauausgang – zu validieren)
W['defrost_bit1024'] = [None if v is None else int((int(v) >> 10) & 1) for v in W['output_code']]
# Abgeleitete Kennwerte (K)
def d(a, b): return [None if x is None or y is None else round(x - y, 2) for x, y in zip(W[a], W[b])]
W['SH_K'] = d('Ts_C', 'Te_C'); W['SC_K'] = d('Tk_C', 'Ty_C'); W['Hub_K'] = d('Tk_C', 'Te_C')
W['LuftVerd_K'] = d('outdoor_C', 'Te_C'); W['KondVL_K'] = d('Tk_C', 'VL_C'); W['Spreizung_K'] = d('VL_C', 'RL_C')
# R290-Sättigung (Propan, Dampfdruckkurve, bar absolut) – Plausibilisierung Te/Tk aus Ps/Pd (Druck als Überdruck angenommen, +1,013)
R290 = [(-30, 1.68), (-25, 2.03), (-20, 2.44), (-15, 2.91), (-10, 3.45), (-5, 4.06), (0, 4.74), (5, 5.51), (10, 6.36), (15, 7.31), (20, 8.36), (25, 9.52), (30, 10.79), (35, 12.19), (40, 13.70), (45, 15.34), (50, 17.13), (55, 19.06), (60, 21.17)]
def tsat(p_abs):
    if p_abs is None: return None
    for (ta, pa), (tb, pb) in zip(R290, R290[1:]):
        if pa <= p_abs <= pb:
            return ta + (tb - ta) * (math.log(p_abs) - math.log(pa)) / (math.log(pb) - math.log(pa))
    return None
W['Te_sat_Ps_C'] = [None if p is None else (None if tsat(p + 1.013) is None else round(tsat(p + 1.013), 2)) for p in W['Ps_bar']]
W['Tk_sat_Pd_C'] = [None if p is None else (None if tsat(p + 1.013) is None else round(tsat(p + 1.013), 2)) for p in W['Pd_bar']]

# Stabilitätsfilter (Prototyp): Verdichter läuft ≥10 min, ≥10 min nach Abtauende, Frequenzänderung ≤5 Hz/5 min, ESP online, alle Kernwerte vorhanden
run = [1 if (f or 0) > 0 else 0 for f in W['compressor_Hz']]
def since(flags, i, want):  # Minuten, seit flags durchgehend == want
    k = i
    while k >= 0 and flags[k] == want: k -= 1
    return i - k
dfr = [1 if (a == 1 or b == 1) else 0 for a, b in zip(W['defrost_filtered'], W['defrost_bit16'])]
core = ['Ts_C', 'Te_C', 'Tk_C', 'Ty_C', 'VL_C', 'RL_C', 'outdoor_C', 'Ps_bar', 'Pd_bar', 'compressor_Hz']
last_def_end = None; mins_since_def = []
for i in range(n):
    if dfr[i] == 1: last_def_end = None
    elif i > 0 and dfr[i - 1] == 1: last_def_end = i
    mins_since_def.append(None if last_def_end is None and not any(dfr[:i]) else (i - (last_def_end if last_def_end is not None else max(k for k in range(i) if dfr[k] == 1) + 1)))
W['min_since_defrost'] = mins_since_def
W['min_since_start'] = [since(run, i, 1) if run[i] else 0 for i in range(n)]
dhz = [None] * n
for i in range(5, n):
    w = [W['compressor_Hz'][k] for k in range(i - 5, i + 1)]
    dhz[i] = None if None in w else max(w) - min(w)
W['dHz_5min'] = dhz
quality = []
for i in range(n):
    ok = all(W[c][i] is not None for c in core) and W['esp_online'][i] != 0
    quality.append(1 if ok else 0)
W['data_ok'] = quality
stable = []
for i in range(n):
    s = (quality[i] == 1 and run[i] == 1 and W['min_since_start'][i] >= 10 and dfr[i] == 0
         and (W['min_since_defrost'][i] is None or W['min_since_defrost'][i] >= 10) and dhz[i] is not None and dhz[i] <= 5 and W['mode'][i] in ('heizen', None))
    stable.append(1 if s else 0)
W['stable_heating'] = stable
def fgroup(f):
    if f is None or f <= 0: return ''
    return '<30' if f < 30 else '30-40' if f < 40 else '40-60' if f < 60 else '60-80' if f < 80 else '>80'
W['freq_group'] = [fgroup(f) for f in W['compressor_Hz']]
# 5-min-Median der Kennwerte (rollierend, nur aus vorhandenen Werten, mind. 3)
K = ['SH_K', 'SC_K', 'Hub_K', 'LuftVerd_K', 'KondVL_K', 'Spreizung_K']
for k in K:
    m = []
    for i in range(n):
        w = [W[k][j] for j in range(max(0, i - 4), i + 1) if W[k][j] is not None]
        m.append(round(statistics.median(w), 2) if len(w) >= 3 else None)
    W[k + '_med5'] = m

# --- CSV ---
order = ['timestamp_utc', 'timestamp_local'] + [c for c, _, _ in COLS] + ['defrost_bit1024', 'Te_sat_Ps_C', 'Tk_sat_Pd_C'] + K + [k + '_med5' for k in K] + ['data_ok', 'stable_heating', 'freq_group', 'min_since_start', 'min_since_defrost', 'dHz_5min']
with open('wide_60s.csv', 'w', encoding='utf-8', newline='') as f:
    f.write(';'.join(order) + '\n')
    for i, t in enumerate(grid):
        row = [dt.datetime.fromtimestamp(t, dt.timezone.utc).isoformat(), dt.datetime.fromtimestamp(t, TZ).isoformat()]
        for c in order[2:]:
            v = W[c][i]
            row.append('' if v is None else (str(v).replace('.', ',') if isinstance(v, float) else str(v)))
        f.write(';'.join(row) + '\n')

# --- Auswertung ---
def q(vals, p):
    s = sorted(vals); k = (len(s) - 1) * p; a = math.floor(k); b = math.ceil(k)
    return s[a] + (s[b] - s[a]) * (k - a)
def desc(vals):
    if len(vals) < 5: return {'N': len(vals)}
    return {'N': len(vals), 'min': round(min(vals), 2), 'P10': round(q(vals, .1), 2), 'P50': round(q(vals, .5), 2), 'mean': round(sum(vals) / len(vals), 2), 'P90': round(q(vals, .9), 2), 'max': round(max(vals), 2)}
res = {'zeitraum_utc': [grid[0], grid[-1]], 'minuten_gesamt': n, 'minuten_daten_ok': sum(quality), 'minuten_verdichter_laeuft': sum(run),
       'minuten_stabil': sum(stable), 'minuten_abtauung': sum(dfr)}
res['kennwerte_alle_laufend'] = {k: desc([W[k][i] for i in range(n) if run[i] and W[k][i] is not None]) for k in K}
res['kennwerte_stabil'] = {k: desc([W[k][i] for i in range(n) if stable[i] and W[k][i] is not None]) for k in K}
res['kennwerte_stabil_med5'] = {k: desc([W[k + '_med5'][i] for i in range(n) if stable[i] and W[k + '_med5'][i] is not None]) for k in K}
res['stabil_nach_frequenzgruppe'] = {g: {k: desc([W[k][i] for i in range(n) if stable[i] and W['freq_group'][i] == g and W[k][i] is not None]) for k in K}
                                     for g in ['<30', '30-40', '40-60', '60-80', '>80']}
# Messkette: Te vs. Sättigung aus Ps, Tk vs. Sättigung aus Pd
dte = [W['Te_C'][i] - W['Te_sat_Ps_C'][i] for i in range(n) if run[i] and W['Te_C'][i] is not None and W['Te_sat_Ps_C'][i] is not None]
dtk = [W['Tk_C'][i] - W['Tk_sat_Pd_C'][i] for i in range(n) if run[i] and W['Tk_C'][i] is not None and W['Tk_sat_Pd_C'][i] is not None]
res['messkette'] = {'Te_minus_Tsat(Ps+1,013)': desc(dte), 'Tk_minus_Tsat(Pd+1,013)': desc(dtk)}
# Negative Überhitzung: Episoden im stabilen Betrieb (5-min-Median < 0)
eps, cur = [], None
for i in range(n):
    neg = stable[i] and W['SH_K_med5'][i] is not None and W['SH_K_med5'][i] < 0
    if neg and cur is None: cur = {'start': i, 'vals': [], 'hz': [], 'since_def': W['min_since_defrost'][i], 'since_start': W['min_since_start'][i], 'out': [], 'eev': []}
    if neg: cur['vals'].append(W['SH_K'][i]); cur['hz'].append(W['compressor_Hz'][i]); cur['out'].append(W['outdoor_C'][i]); cur['eev'].append(W['eev_steps'][i])
    if not neg and cur is not None:
        cur['end'] = i; eps.append(cur); cur = None
if cur: cur['end'] = n; eps.append(cur)
def epi(e):
    v = [x for x in e['vals'] if x is not None]
    return {'start_local': dt.datetime.fromtimestamp(grid[e['start']], TZ).strftime('%d.%m. %H:%M'), 'dauer_min': e['end'] - e['start'], 'SH_min': round(min(v), 2) if v else None,
            'SH_mittel': round(sum(v) / len(v), 2) if v else None, 'Hz_mittel': round(sum(x for x in e['hz'] if x) / max(1, len([x for x in e['hz'] if x])), 1),
            'aussen_mittel': round(sum(x for x in e['out'] if x is not None) / max(1, len([x for x in e['out'] if x is not None])), 1),
            'EEV_mittel': round(sum(x for x in e['eev'] if x is not None) / max(1, len([x for x in e['eev'] if x is not None])), 0),
            'min_seit_abtauung': e['since_def'], 'min_seit_start': e['since_start']}
res['sh_negativ_episoden_stabil'] = [epi(e) for e in eps]
shs = [W['SH_K'][i] for i in range(n) if stable[i] and W['SH_K'][i] is not None]
res['sh_stabil_anteile'] = {'<0': round(sum(1 for x in shs if x < 0) / max(1, len(shs)) * 100, 1), '<-1': round(sum(1 for x in shs if x < -1) / max(1, len(shs)) * 100, 1), '<-2': round(sum(1 for x in shs if x < -2) / max(1, len(shs)) * 100, 1), 'N': len(shs)}
# Abtaubits: Übereinstimmung Bit16 (Betriebszustand) vs. Bit1024 (Ausgangszustand)
both = [(a, b) for a, b in zip(W['defrost_bit16'], W['defrost_bit1024']) if a is not None and b is not None]
res['abtaubits'] = {'N': len(both), 'beide_1': sum(1 for a, b in both if a and b), 'nur_bit16': sum(1 for a, b in both if a and not b), 'nur_bit1024': sum(1 for a, b in both if b and not a)}
# Korrelation SH mit Frequenz / EEV / Außen im stabilen Betrieb
def corr(a, b):
    pr = [(x, y) for x, y in zip(a, b) if x is not None and y is not None]
    if len(pr) < 30: return None
    xs, ys = zip(*pr); mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
    sx = math.sqrt(sum((x - mx) ** 2 for x in xs)); sy = math.sqrt(sum((y - my) ** 2 for y in ys))
    return round(sum((x - mx) * (y - my) for x, y in pr) / (sx * sy), 2) if sx and sy else None
st = lambda c: [W[c][i] if stable[i] else None for i in range(n)]
res['korrelation_SH_stabil'] = {'Hz': corr(st('SH_K'), st('compressor_Hz')), 'EEV': corr(st('SH_K'), st('eev_steps')), 'Aussen': corr(st('SH_K'), st('outdoor_C')), 'Luefter': corr(st('SH_K'), st('fan_rpm')), 'min_seit_start': corr(st('SH_K'), st('min_since_start'))}
json.dump(res, open('ergebnis.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(json.dumps({k: res[k] for k in ['zeitraum_utc', 'minuten_gesamt', 'minuten_daten_ok', 'minuten_verdichter_laeuft', 'minuten_stabil', 'minuten_abtauung', 'sh_stabil_anteile', 'messkette', 'abtaubits', 'korrelation_SH_stabil']}, ensure_ascii=False, indent=1))
print('Episoden:', len(res['sh_negativ_episoden_stabil']))

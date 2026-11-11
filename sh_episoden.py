# Copyright (c) 2026 AWendt206 · MIT-Lizenz · https://github.com/AWendt206/
# Eigener Plot der historischen negativen Ueberhitzung im stabilen Heizbetrieb
# (Dauer, Haeufigkeit, Messqualitaet, Zeit seit Abtauung). Ohne Fremdbibliotheken.
# Aufruf: python -I sh_episoden.py wide_60s.csv  -> sh_episoden.html
import csv, sys, html, statistics as st

SRC = sys.argv[1] if len(sys.argv) > 1 else 'wide_60s.csv'
rows = list(csv.DictReader(open(SRC, encoding='utf-8'), delimiter=';'))


def num(v):
    try:
        return float(v.replace(',', '.'))
    except (ValueError, AttributeError):
        return None


T = [r['timestamp_local'][5:16].replace('T', ' ') for r in rows]  # MM-DD hh:mm
sh = [num(r['SH_K']) for r in rows]
med = [num(r['SH_K_med5']) for r in rows]
hz = [num(r['compressor_Hz']) for r in rows]
stab = [r['stable_heating'] == '1' for r in rows]
okq = [r['data_ok'] == '1' for r in rows]
dfr = [r['defrost_bit16'] == '1' or r['defrost_filtered'] == '1' for r in rows]
msd = [num(r['min_since_defrost']) for r in rows]
N = len(rows)

# Episoden: zusammenhaengende Minuten mit stabil und Median5 < 0
eps, i = [], 0
while i < N:
    if stab[i] and med[i] is not None and med[i] < 0:
        j = i
        while j + 1 < N and stab[j + 1] and med[j + 1] is not None and med[j + 1] < 0:
            j += 1
        seg = range(i, j + 1)
        raw = [sh[k] for k in seg if sh[k] is not None]
        eps.append({'i0': i, 'i1': j, 'start': T[i], 'dauer': j - i + 1,
                    'sh_min': min(raw) if raw else None, 'sh_mit': st.mean(raw) if raw else None,
                    'med_min': min(med[k] for k in seg), 'hz': st.mean([hz[k] for k in seg if hz[k] is not None] or [0]),
                    'seit_abt': msd[i], 'q': sum(okq[k] for k in seg) / len(seg)})
        i = j + 1
    else:
        i += 1

stab_min = sum(stab)
neg_min = sum(e['dauer'] for e in eps)
in_res = sum(1 for e in eps if e['med_min'] >= -1.0)

W, PL, PR = 1100, 56, 16
PW = W - PL - PR
xs = lambda k: PL + PW * k / max(N - 1, 1)


def ticks_x(h, y0):
    out = []
    for k in range(0, N, 720):  # alle 12 h
        x = xs(k)
        out.append(f'<line x1="{x:.1f}" x2="{x:.1f}" y1="{y0}" y2="{y0 + h}" class="grid"/>'
                   f'<text x="{x:.1f}" y="{y0 + h + 16}" class="tick" text-anchor="middle">{T[k][3:5]}.{T[k][0:2]}. {T[k][6:]}</text>')
    return ''.join(out)


def bands(h, y0):
    out, k = [], 0
    for flag, cls in ((stab, 'b-stab'), (dfr, 'b-dfr')):
        k = 0
        while k < N:
            if flag[k]:
                j = k
                while j + 1 < N and flag[j + 1]:
                    j += 1
                out.append(f'<rect x="{xs(k):.1f}" y="{y0}" width="{max(xs(j) - xs(k), 1):.1f}" height="{h}" class="{cls}"/>')
                k = j + 1
            else:
                k += 1
    return ''.join(out)


def path(vals, ymap):
    d, pen = [], False
    for k, v in enumerate(vals):
        if v is None:
            pen = False
            continue
        d.append(('L' if pen else 'M') + f'{xs(k):.1f},{ymap(v):.1f}')
        pen = True
    return ' '.join(d)


# Chart 1: SH roh + Median (nur stabil), Bänder stabil/Abtauung, Episoden markiert
H1, Y1 = 260, 20
lo, hi = -5.0, 8.0
ym = lambda v: Y1 + H1 * (hi - max(lo, min(hi, v))) / (hi - lo)
med_stab = [m if s else None for m, s in zip(med, stab)]
c1 = [f'<svg viewBox="0 0 {W} {H1 + 50}" role="img" aria-label="Überhitzung roh und Median 5 min über die Zeit">', bands(H1, Y1)]
for v in range(-4, 9, 2):
    c1.append(f'<line x1="{PL}" x2="{W - PR}" y1="{ym(v):.1f}" y2="{ym(v):.1f}" class="{"zero" if v == 0 else "grid"}"/>'
              f'<text x="{PL - 6}" y="{ym(v) + 4:.1f}" class="tick" text-anchor="end">{v}</text>')
c1.append(ticks_x(H1, Y1))
c1.append(f'<path d="{path(sh, ym)}" class="l-raw"/><path d="{path(med_stab, ym)}" class="l-med"/>')
for e in eps:
    x0, x1 = xs(e['i0']), xs(e['i1'])
    c1.append(f'<rect x="{x0:.1f}" y="{Y1 + H1 - 8}" width="{max(x1 - x0, 2):.1f}" height="8" rx="2" class="ep">'
              f'<title>{e["start"]} · {e["dauer"]} min · Median min {e["med_min"]:.1f} K · seit Abtauung {e["seit_abt"]:.0f} min</title></rect>')
c1.append(f'<text x="{PL}" y="12" class="axt">K</text></svg>')

# Chart 2: Verdichter Hz (eigene Achse, eigenes Diagramm)
H2, Y2 = 110, 14
ymh = lambda v: Y2 + H2 * (100 - max(0, min(100, v))) / 100
c2 = [f'<svg viewBox="0 0 {W} {H2 + 44}" role="img" aria-label="Verdichterfrequenz">', bands(H2, Y2)]
for v in (0, 30, 60, 90):
    c2.append(f'<line x1="{PL}" x2="{W - PR}" y1="{ymh(v):.1f}" y2="{ymh(v):.1f}" class="grid"/><text x="{PL - 6}" y="{ymh(v) + 4:.1f}" class="tick" text-anchor="end">{v}</text>')
c2.append(ticks_x(H2, Y2) + f'<path d="{path(hz, ymh)}" class="l-hz"/><text x="{PL}" y="10" class="axt">Hz</text></svg>')

# Chart 3: Dauer vs. Zeit seit Abtauung (Streudiagramm)
W3, H3, L3, B3 = 540, 260, 46, 36
mx = max([e['seit_abt'] or 0 for e in eps] + [60])
my = max([e['dauer'] for e in eps] + [5])
sx = lambda v: L3 + (W3 - L3 - 12) * v / mx
sy = lambda v: 10 + (H3 - 10 - B3) * (1 - v / my)
c3 = [f'<svg viewBox="0 0 {W3} {H3}" role="img" aria-label="Episodendauer über Zeit seit Abtauung">']
for v in range(0, int(mx) + 1, 60):
    c3.append(f'<line x1="{sx(v):.1f}" x2="{sx(v):.1f}" y1="10" y2="{H3 - B3}" class="grid"/><text x="{sx(v):.1f}" y="{H3 - B3 + 16}" class="tick" text-anchor="middle">{v}</text>')
for v in range(0, my + 1, 5):
    c3.append(f'<line x1="{L3}" x2="{W3 - 12}" y1="{sy(v):.1f}" y2="{sy(v):.1f}" class="grid"/><text x="{L3 - 6}" y="{sy(v) + 4:.1f}" class="tick" text-anchor="end">{v}</text>')
for e in eps:
    if e['seit_abt'] is None:
        continue
    cls = 'pt-in' if e['med_min'] >= -1.0 else 'pt-out'
    c3.append(f'<circle cx="{sx(e["seit_abt"]):.1f}" cy="{sy(e["dauer"]):.1f}" r="4.5" class="{cls}"><title>{e["start"]} · {e["dauer"]} min · seit Abtauung {e["seit_abt"]:.0f} min · Median min {e["med_min"]:.1f} K</title></circle>')
c3.append(f'<text x="{(W3 + L3) / 2}" y="{H3 - 4}" class="axt" text-anchor="middle">Minuten seit Abtauung</text><text x="4" y="10" class="axt">min</text></svg>')

# Chart 4: Häufigkeit der Episodendauer
bins = [(1, 1), (2, 3), (4, 5), (6, 10), (11, 20), (21, 999)]
lab = ['1', '2–3', '4–5', '6–10', '11–20', '>20']
cnt = [sum(1 for e in eps if a <= e['dauer'] <= b) for a, b in bins]
W4, H4, L4, B4 = 540, 260, 40, 36
bw = (W4 - L4 - 12) / len(bins)
cm = max(cnt + [1])
c4 = [f'<svg viewBox="0 0 {W4} {H4}" role="img" aria-label="Häufigkeit der Episodendauer">']
for k, (c, l) in enumerate(zip(cnt, lab)):
    h = (H4 - 14 - B4) * c / cm
    x = L4 + k * bw + 2
    c4.append(f'<path d="M{x:.1f},{H4 - B4} V{H4 - B4 - h + 4:.1f} q0,-4 4,-4 H{x + bw - 8:.1f} q4,0 4,4 V{H4 - B4} Z" class="bar"><title>{l} min: {c} Episoden</title></path>'
              f'<text x="{x + bw / 2 - 2:.1f}" y="{H4 - B4 - h - 6:.1f}" class="val" text-anchor="middle">{c}</text>'
              f'<text x="{x + bw / 2 - 2:.1f}" y="{H4 - B4 + 16}" class="tick" text-anchor="middle">{l}</text>')
c4.append(f'<line x1="{L4}" x2="{W4 - 12}" y1="{H4 - B4}" y2="{H4 - B4}" class="axis"/><text x="{(W4 + L4) / 2}" y="{H4 - 4}" class="axt" text-anchor="middle">Episodendauer (min)</text></svg>')

f1 = lambda v: '–' if v is None else f'{v:.1f}'.replace('.', ',')
trs = ''.join(f'<tr><td>{html.escape(e["start"][3:5] + "." + e["start"][0:2] + ". " + e["start"][6:])}</td><td>{e["dauer"]}</td><td>{f1(e["med_min"])}</td><td>{f1(e["sh_min"])}</td><td>{f1(e["sh_mit"])}</td><td>{e["hz"]:.0f}</td><td>{"–" if e["seit_abt"] is None else int(e["seit_abt"])}</td><td>{e["q"] * 100:.0f} %</td><td>{"ja" if e["med_min"] >= -1.0 else "nein"}</td></tr>' for e in eps)

doc = f'''<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Negative Überhitzung</title><style>
:root{{--surface-1:#fcfcfb;--text-primary:#0b0b0b;--text-secondary:#52514e;--grid:#e4e3df;--s1:#2a78d6;--s2:#eb6834;--raw:#a3a29c;--band-stab:#2a78d61a;--band-dfr:#1baf7a33;--warn:#b26b00}}
@media (prefers-color-scheme:dark){{:root:where(:not([data-theme="light"])){{--surface-1:#1a1a19;--text-primary:#f0efec;--text-secondary:#c3c2b7;--grid:#34332f;--s1:#3987e5;--s2:#d95926;--raw:#6e6d68;--band-stab:#3987e526;--band-dfr:#199e7040;--warn:#e0a640}}}}
:root[data-theme="dark"]{{--surface-1:#1a1a19;--text-primary:#f0efec;--text-secondary:#c3c2b7;--grid:#34332f;--s1:#3987e5;--s2:#d95926;--raw:#6e6d68;--band-stab:#3987e526;--band-dfr:#199e7040;--warn:#e0a640}}
body{{margin:0;background:var(--surface-1);color:var(--text-primary);font:15px/1.45 Inter,Roboto,"Segoe UI",sans-serif}}
main{{max-width:1140px;margin:0 auto;padding:20px 16px 40px}}h1{{font-size:22px;margin:0 0 4px}}h2{{font-size:17px;margin:26px 0 6px}}
p,li{{color:var(--text-secondary)}}.warn{{border-left:4px solid var(--warn);padding:8px 12px;margin:12px 0;color:var(--text-primary)}}
.kpi{{display:flex;flex-wrap:wrap;gap:10px;margin:14px 0}}.kpi div{{border:1px solid var(--grid);border-radius:10px;padding:8px 12px;min-width:150px}}.kpi b{{display:block;font-size:20px}}.kpi span{{font-size:13px;color:var(--text-secondary)}}
svg{{width:100%;height:auto;display:block}}.grid{{stroke:var(--grid);stroke-width:1}}.zero{{stroke:var(--text-secondary);stroke-width:1}}.axis{{stroke:var(--text-secondary)}}
.tick,.axt,.val{{fill:var(--text-secondary);font-size:11px}}.val{{fill:var(--text-primary);font-weight:600}}
.l-raw{{fill:none;stroke:var(--raw);stroke-width:1}}.l-med{{fill:none;stroke:var(--s1);stroke-width:2}}.l-hz{{fill:none;stroke:var(--s1);stroke-width:1.5}}
.b-stab{{fill:var(--band-stab)}}.b-dfr{{fill:var(--band-dfr)}}.ep{{fill:var(--s2)}}.bar{{fill:var(--s1)}}
.pt-in{{fill:var(--s1);stroke:var(--surface-1);stroke-width:2}}.pt-out{{fill:var(--s2);stroke:var(--surface-1);stroke-width:2}}
.lg{{display:flex;flex-wrap:wrap;gap:14px;font-size:13px;color:var(--text-secondary);margin:4px 0 6px}}.lg i{{display:inline-block;width:14px;height:10px;border-radius:2px;margin-right:5px;vertical-align:middle}}
.two{{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:18px}}
.tw{{overflow-x:auto}}table{{border-collapse:collapse;width:100%;font-size:13px;min-width:640px}}th,td{{padding:5px 8px;border-bottom:1px solid var(--grid);text-align:right}}th:first-child,td:first-child{{text-align:left}}th{{color:var(--text-secondary);font-weight:600}}
</style></head><body><main>
<h1>Negative Überhitzung im stabilen Heizbetrieb</h1>
<p>Avarma 12 kW · {T[0][3:5]}.{T[0][0:2]}. bis {T[-1][3:5]}.{T[-1][0:2]}. · 60-s-Raster, Halten bis zur nächsten Änderung, keine Nullauffüllung.</p>
<div class="warn"><b>Offene technische Fragestellung – experimentell.</b> Te wird in 0,5-K-Schritten gemeldet, Ts und Te werden nicht gleichzeitig aktualisiert. Werte zwischen etwa −1 und +1 K liegen in der Messunsicherheit. Herstellersoll laut Handbuch: 0,5 K im Heizbetrieb (P92–P96, Regelziel, kein Grenzwert) – im stabilen Betrieb liegt der Mittelwert bei +0,38 K. Eine rote Schwelle nennt der Hersteller nicht und wird hier nicht gesetzt; dies ist keine Störungsmeldung und keine Anweisung zur Änderung am Kältekreis/EEV.</div>
<div class="kpi"><div><b>{len(eps)}</b><span>Episoden (Median 5 min &lt; 0)</span></div><div><b>{neg_min} min</b><span>Gesamtdauer · {neg_min / max(stab_min, 1) * 100:.0f} % der stabilen Zeit</span></div>
<div><b>{st.median([e["dauer"] for e in eps]) if eps else 0:.0f} min</b><span>Median-Dauer · max {max([e["dauer"] for e in eps] + [0])} min</span></div>
<div><b>{in_res} / {len(eps)}</b><span>Episoden nur bis −1 K (innerhalb Auflösung)</span></div><div><b>{stab_min} min</b><span>stabiler Heizbetrieb gesamt</span></div></div>
<h2>Überhitzung über die Zeit</h2>
<div class="lg"><span><i style="background:var(--raw)"></i>SH roh</span><span><i style="background:var(--s1)"></i>SH Median 5 min (nur stabil)</span><span><i style="background:var(--s2)"></i>Episode</span><span><i style="background:var(--band-stab)"></i>stabiler Heizbetrieb</span><span><i style="background:var(--band-dfr)"></i>Abtauung</span></div>
{"".join(c1)}
<h2>Verdichterfrequenz (gleiche Zeitachse)</h2>{"".join(c2)}
<div class="two"><div><h2>Dauer und Zeit seit Abtauung</h2><div class="lg"><span><i style="background:var(--s1)"></i>Median ≥ −1 K</span><span><i style="background:var(--s2)"></i>Median &lt; −1 K</span></div>{"".join(c3)}</div>
<div><h2>Häufigkeit nach Dauer</h2>{"".join(c4)}</div></div>
<h2>Alle Episoden</h2><p>Messqualität = Anteil der Minuten mit vollständigen, aktuellen Messdaten in der Episode.</p>
<div class="tw"><table><thead><tr><th>Beginn</th><th>Dauer min</th><th>Median min K</th><th>SH roh min K</th><th>SH roh Mittel K</th><th>Hz</th><th>seit Abtauung min</th><th>Messqualität</th><th>≤ Auflösung</th></tr></thead><tbody>{trs}</tbody></table></div>
<p>Quelle: Home-Assistant-Recorder, eigene Auswertung (KI-gestützt). Keine Herstellerangaben. Änderungen vorbehalten.</p>
</main></body></html>'''
open('sh_episoden.html', 'w', encoding='utf-8').write(doc)
print(len(eps), 'Episoden,', neg_min, 'min,', in_res, 'innerhalb Aufloesung')

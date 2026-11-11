# Copyright (c) 2026 AWendt206 · MIT-Lizenz · https://github.com/AWendt206/
# Erzeugt ein importierbares Grafana-Dashboard (InfluxDB 2 / Flux) fuer die Kaeltekreis-Kalibrierung.
# Aufruf: python -I grafana_build.py  -> grafana_kaeltekreis_kalibrierung.json
# Annahme HA-InfluxDB-Schema: Tag entity_id = Objekt-ID ohne Domain, Feld "value".
# Der Measurement-Name wird bewusst NICHT gefiltert (je nach Einheit "K", "Hz", "°C" oder Entity-ID).
import json

P = 'hausinstallation_avarma_'
KW = [  # (Titel, HA-Objekt-ID roh, Objekt-ID stabil gefiltert, Formel)
    ('Überhitzung SH', 'avarma_uberhitzung', 'avarma_mq_sh_stabil', 'Ts − Te'),
    ('Unterkühlung SC', 'avarma_unterkuhlung', 'avarma_mq_sc_stabil', 'Tk − Ty'),
    ('Temperaturhub', 'avarma_temperaturhub', 'avarma_mq_hub_stabil', 'Tk − Te'),
    ('Luft − Verdampfung', 'avarma_luft_verdampfung', 'avarma_mq_luftverd_stabil', 'Außen − Te'),
    ('Kondensation − VL', 'avarma_kondensation_vorlauf', 'avarma_mq_kondvl_stabil', 'Tk − VL'),
    ('Spreizung VL/RL', 'avarma_spreizung', 'avarma_mq_spreizung_stabil', 'VL − RL'),
]
DS = {'type': 'influxdb', 'uid': '${ds}'}


def q(eid, ref, median=False, alias=None):
    s = ('from(bucket: "${bucket}")\n'
         '  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)\n'
         f'  |> filter(fn: (r) => r.entity_id == "{eid}" and r._field == "value")\n'
         '  |> keep(columns: ["_time", "_value"])\n')
    if median:
        s += '  |> aggregateWindow(every: 5m, fn: median, createEmpty: false)\n'
    s += f'  |> map(fn: (r) => ({{r with _field: "{alias or eid}"}}))\n  |> yield(name: "{ref}")'
    return {'refId': ref, 'datasource': DS, 'query': s}


pid = [0]


def panel(title, targets, x, y, w=12, h=7, unit='none', typ='timeseries', desc='', overrides=None, extra=None):
    pid[0] += 1
    p = {'id': pid[0], 'type': typ, 'title': title, 'description': desc, 'datasource': DS,
         'gridPos': {'x': x, 'y': y, 'w': w, 'h': h}, 'targets': targets,
         'fieldConfig': {'defaults': {'unit': unit, 'custom': {
             'drawStyle': 'line', 'lineWidth': 1, 'pointSize': 3, 'showPoints': 'never',
             'spanNulls': False, 'lineInterpolation': 'stepAfter', 'fillOpacity': 0}},
             'overrides': overrides or []},
         'options': {'tooltip': {'mode': 'multi'}, 'legend': {'displayMode': 'list', 'placement': 'bottom'}}}
    if extra:
        p.update(extra)
    return p


def name_ov(name, color, axis_right=False, unit=None):
    props = [{'id': 'color', 'value': {'mode': 'fixed', 'fixedColor': color}}]
    if axis_right:
        props.append({'id': 'custom.axisPlacement', 'value': 'right'})
    if unit:
        props.append({'id': 'unit', 'value': unit})
    return {'matcher': {'id': 'byRegexp', 'options': '.*' + name + '.*'}, 'properties': props}


panels, y = [], 0
pid[0] += 1
panels.append({'id': pid[0], 'type': 'text', 'title': 'Hinweis', 'gridPos': {'x': 0, 'y': y, 'w': 24, 'h': 3},
               'options': {'mode': 'markdown', 'content':
                           '**Experimentelle Auswertung – keine Herstellerfreigabe.** Rohwerte links (ohne Nullauffüllung, '
                           'Lücken bleiben Lücken), 5-min-Median rechts. Grün/Gelb/Rot werden hier bewusst **nicht** verwendet. '
                           'Herstellersoll Überhitzung Heizen 0,5 K (P92–P96, Regelziel, kein Grenzwert). Ursache negativer Werte ist offen (Te-Auflösung 0,5 K, Ts/Te asynchron). '
                           'Alle Panels teilen Zeitachse und Fadenkreuz.'}})
y += 3

# Kontext (synchron mit allen Kennwerten)
ctx = [
    ('Verdichter Hz · Lüfter rpm', [q(P + 'verdichterfrequenz_ist', 'A', alias='Verdichter Hz'), q(P + 'lufter_1_drehzahl', 'B', alias='Lüfter rpm')],
     'hertz', [name_ov('Verdichter', '#ff8a2a'), name_ov('Lüfter', '#3ac8ef', True, 'rotrpm')]),
    ('Außentemperatur', [q(P + 'aussentemperatur', 'A', alias='Außen')], 'celsius', [name_ov('Außen', '#48d18c')]),
    ('Wasser VL / RL', [q(P + 'vorlauftemperatur', 'A', alias='VL'), q(P + 'rucklauftemperatur', 'B', alias='RL')], 'celsius',
     [name_ov('VL', '#ff727f'), name_ov('RL', '#4c9eff')]),
    ('Durchfluss', [q(P + 'wasserdurchfluss', 'A', alias='Durchfluss')], 'none', [name_ov('Durchfluss', '#4c9eff')]),
    ('Expansionsventil (EEV-Schritte)', [q(P + 'expansionsventil_schritte', 'A', alias='EEV-Schritte')], 'none', [name_ov('EEV', '#b5a0ff')]),
    ('Überhitzung − Herstellersoll (P92–P96, Median 5 min, nur stabil)', [q('avarma_sh_abweichung_vom_soll', 'A', alias='SH − Soll'),
     q('avarma_sh_soll_hersteller', 'B', alias='Soll Hersteller')], 'kelvin', [name_ov('SH − Soll', '#4c9eff'), name_ov('Soll Hersteller', '#48d18c')]),
]
for i, (t, tg, u, ov) in enumerate(ctx):
    panels.append(panel(t, tg, (i % 2) * 12, y + (i // 2) * 6, h=6, unit=u, overrides=ov))
y += 18
panels.append(panel('Abtau-Bits und Bewertbarkeit', [
    q('avarma_abtauung', 'A', alias='Abtauung (Bit 16)'),
    q('avarma_abtauung_gefiltert', 'B', alias='Abtauung gefiltert'),
    q('avarma_vierwegeventil', 'C', alias='4-Wege-Ventil'),
    q('avarma_mq_stabiler_heizbetrieb', 'D', alias='Stabiler Heizbetrieb'),
    q('avarma_mq_messdaten_ok', 'E', alias='Messdaten OK'),
    q('avarma_sh_unter_schwelle_stabil', 'F', alias='SH unter Schwelle'),
], 0, y, w=24, h=7, typ='state-timeline',
    desc='Bit 1024 des Ausgangszustand-Codes ist nicht identisch mit Bit 16 (Abtauung). Siehe Kalibrierbericht.',
    extra={'options': {'showValue': 'never', 'mergeValues': True, 'rowHeight': 0.8, 'tooltip': {'mode': 'multi'},
                       'legend': {'showLegend': False}}}))
y += 7

# Sechs Kennwerte: links roh, rechts Median 5 min (roh-Median und Median nur stabiler Minuten)
for t, raw, stab, formel in KW:
    panels.append(panel(f'{t} · roh  ({formel})', [q(raw, 'A', alias=t + ' roh')], 0, y, unit='kelvin',
                        overrides=[name_ov('roh', '#ffbf55')]))
    panels.append(panel(f'{t} · median_5min', [q(raw, 'A', True, t + ' Median 5 min (alle)'),
                                                q(stab, 'B', True, t + ' Median 5 min (nur stabil)')], 12, y, unit='kelvin',
                        overrides=[name_ov('alle', '#91a5c0'), name_ov('nur stabil', '#4c9eff')]))
    y += 7

dash = {
    '__inputs': [{'name': 'DS_INFLUX', 'label': 'InfluxDB (Flux)', 'type': 'datasource', 'pluginId': 'influxdb', 'pluginName': 'InfluxDB'}],
    'title': 'Avarma Kältekreis – Kalibrierung (experimentell)',
    'uid': 'avarma-kk-kalibrierung',
    'tags': ['avarma', 'kaeltekreis', 'experimentell'],
    'timezone': 'browser', 'graphTooltip': 1, 'editable': True, 'schemaVersion': 39,
    'time': {'from': 'now-24h', 'to': 'now'}, 'refresh': '1m',
    'templating': {'list': [
        {'name': 'ds', 'label': 'Datenquelle', 'type': 'datasource', 'query': 'influxdb', 'current': {}},
        {'name': 'bucket', 'label': 'Bucket', 'type': 'textbox', 'query': 'homeassistant',
         'current': {'text': 'homeassistant', 'value': 'homeassistant'}},
    ]},
    'panels': panels,
}
json.dump(dash, open('grafana_kaeltekreis_kalibrierung.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(panels), 'Panels')

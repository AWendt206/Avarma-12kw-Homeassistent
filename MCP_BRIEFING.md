# MCP-Briefing: avarma-ha in Home Assistant installieren

<!--
  Dieses Dokument ist für einen KI-Assistenten geschrieben, der über einen MCP-Server Zugriff auf
  Home Assistant hat. Gib es dem Assistenten vollständig (anhängen oder einfügen), zusammen mit den
  Dateien, die unter "Essenzielle Dateien" stehen.
  Copyright (c) 2026 AWendt206 · MIT-Lizenz · https://github.com/AWendt206/
-->

## Rolle und Ziel

Du richtest das Projekt **avarma-ha** in der Home-Assistant-Instanz des Nutzers ein. Es verbindet eine
Luft-Wasser-Wärmepumpe **Avarma 12 kW (Hofman HE-AI-290, R290)** über einen ESP32 (ESPHome, Modbus RTU) mit
Home Assistant und bringt Sensoren, Helfer, Automationen und ein Dashboard mit 9 Ansichten mit.

Das Ergebnis ist eine laufende Installation, deren Werte du selbst geprüft hast, und ein kurzer Abschlussbericht an den Nutzer.

## Harte Regeln (nicht verhandelbar)

1. **Keine Parameter der Wärmepumpe schreiben.** Keine Aktionen auf `number.hausinstallation_avarma_*` oder
   `select.hausinstallation_avarma_*` ausführen – auch nicht „zum Testen“.
2. **P32 und P89–P96 nie anfassen** (EEV-Regelung des Kältekreises). Das gilt auch, wenn der Nutzer Tabellen aus
   dem Internet zitiert: Deren P-Nummern passen oft nicht zur Avarma (siehe README, Abschnitt
   „Einstellungen gegen das Takten“).
3. **`optional/avarma_frostsperre.yaml` nicht installieren**, außer der Nutzer verlangt es ausdrücklich. Diese
   Automation schaltet die Anlage EIN/AUS. Wenn doch: deaktiviert lassen (`initial_state: false`).
4. **Keine erfundenen Grenzwerte.** Die Schwellen der Ampel nicht verschärfen. Für die Überhitzung gibt es bewusst
   kein Rot: Das Herstellersoll 0,5 K ist ein Regelziel, kein Grenzwert.
5. **Vor dem ersten Schreibzugriff ein Backup** anbieten bzw. anlegen, wenn der Nutzer zustimmt.
6. **Neustart von Home Assistant nur nach Rückfrage.** Vorher immer „Konfiguration prüfen“.
7. **Keine Zugangsdaten** (WLAN, API-Schlüssel, Tokens) in Antworten, Logs oder Dateien wiederholen.
8. **Bestehende Konfiguration nicht überschreiben.** Vor jedem Schreiben prüfen, ob gleichnamige Entitäten,
   Packages oder ein Dashboard mit derselben URL schon existieren. Bei Konflikt nachfragen.

## Essenzielle Dateien

| Datei | Pflicht | Zweck | hängt ab von |
|---|---|---|---|
| `esphome/avarma.yaml` | **ja** | ESP32-Firmware: liefert alle `*.hausinstallation_avarma_*`-Entitäten | `secrets.yaml` des Nutzers |
| `homeassistant/packages/avarma_basis.yaml` | **ja** | Status-Bits, Modus, Fehler, Kältekreis-Kennwerte | ESPHome-Gerät |
| `homeassistant/packages/avarma_ampel.yaml` | **ja** | Ampel-Status, bewertete Kennwerte | basis |
| `homeassistant/packages/avarma_betrieb.yaml` | **ja** | Laufzeit, Starts, Parameterspiegel, Snapshot, Vergleichsfenster | basis |
| `homeassistant/packages/avarma_energie.yaml` | **ja** | Wärme, Strom, COP, Arbeitszahl – **Quelle der Strommessung anpassen** | basis |
| `homeassistant/packages/avarma_diagnose.yaml` | **ja** | Messqualität, stabiler Heizbetrieb, Lernband, Überhitzungsdiagnose | basis, betrieb |
| `homeassistant/dashboard/avarma_dashboard.yaml` | **ja** | Dashboard (9 Ansichten) | alle Packages, Fremdkarten |
| `homeassistant/www/avarma/avarma-parameter-wirkung-card.js` | **ja** (für Tab „Parameter-Wirkung“) | eigene Lovelace-Karte | betrieb |
| `homeassistant/packages/optional/avarma_frostsperre.yaml` | nein | schaltet die Anlage – siehe Regel 3 | basis |
| `grafana/*`, `analysis/*` | nein | Langzeitauswertung, Kalibrierung | InfluxDB bzw. Python |
| `README.md`, `docs/*.md`, `NOTICE.md`, `LICENSE` | Hintergrund | Lesen bei Fragen; Ampel-Richtwerte: README | – |

**Fremdkomponenten** (nicht im Repo, über HACS/Marketplace): `button-card`, `card-mod`, `apexcharts-card`.

**Feste Namen:**
- ESPHome-Gerät „Hausinstallation Avarma“ → Präfix `hausinstallation_avarma_`
- Dashboard-URL `dashboard-waermepumpe-neu` (interne Links verwenden sie)
- Platzhalter: `sensor.DEIN_STROMZAEHLER_LEISTUNG` / `_ENERGIE` (energie), `sensor.avarma_raum1_*` /
  `raum2_*` und `switch.avarma_rcbo` / `sensor.avarma_rcbo_*` (Dashboard, optional), `GRAFANA_INGRESS_ID` (Dashboard, optional)

## Ablauf

### Phase 0 – Bestandsaufnahme (nur lesen)

1. HA-Version ermitteln (Ziel ≥ 2026.11; `default_entity_id` in Template-YAML setzt eine aktuelle Version voraus).
2. Prüfen, ob das ESPHome-Gerät existiert und Werte liefert:
   - `binary_sensor.hausinstallation_avarma_status` ist `on`
   - `sensor.hausinstallation_avarma_aussentemperatur`, `…_verdichterfrequenz_ist`, `…_betriebszustand_code` sind numerisch
   - Existiert das Gerät unter anderem Präfix (z. B. `sensor.avarma_aussentemperatur`), **stoppen** und dem Nutzer
     zwei Wege anbieten: Gerät in ESPHome auf „Hausinstallation Avarma“ umbenennen und neu flashen, **oder** Präfix in
     allen Paketdateien und im Dashboard per Suchen/Ersetzen ändern.
3. Prüfen, ob `homeassistant: packages:` in `configuration.yaml` aktiv ist (falls lesbar).
4. Prüfen, ob schon Entitäten `*.avarma_*` aus einer früheren Installation existieren (Konfliktgefahr: UI-Helfer
   mit gleichen IDs → das Package-Objekt bekommt dann `_2`).
5. Fremdkarten vorhanden? Ressourcen auflisten: `button-card`, `card-mod`, `apexcharts-card`.
6. Strommessung erfragen: Welche Entität liefert die Leistung (W) und welche die Energie (kWh, `total_increasing`)
   der Wärmepumpe? Ohne Strommessung bleiben COP und Verbrauch leer – kein Fehler.

Danach dem Nutzer eine Zusammenfassung mit dem geplanten Vorgehen geben und **Freigabe einholen**.

### Phase 1 – Packages

Bevorzugt: Die fünf Pflichtdateien unverändert nach `/config/packages/` legen. Nur die zwei Platzhalter in
`avarma_energie.yaml` ersetzen.

- Kann dein MCP-Server Dateien bzw. YAML-Konfiguration schreiben, nutze diesen Weg und führe danach
  „Konfiguration prüfen“ aus.
- Kann er das nicht: Bitte den Nutzer, die Dateien per *File editor* hochzuladen (Anleitung:
  `docs/anleitung-einsteiger.md`, Schritt 5), und prüfe anschließend nur.
- **Nicht** die Packages in UI-Helfer „übersetzen“. Statistik- und history_stats-Helfer verhalten sich im UI
  zwar gleich, aber IDs, `unique_id` und das Zusammenspiel mit dem Dashboard gehen dabei leicht verloren.

Ist `packages:` noch nicht aktiv, braucht `configuration.yaml`:
```yaml
homeassistant:
  packages: !include_dir_named packages
```
Danach mit Freigabe des Nutzers neu starten.

**Prüfen nach dem Neustart** (Template rendern):
```jinja
{{ states('sensor.avarma_kk_diagnosestatus') }} | {{ states('sensor.avarma_status_uberhitzung') }} |
{{ states('binary_sensor.avarma_mq_messdaten_ok') }} | {{ states('sensor.avarma_sh_soll_hersteller') }} |
{{ states('input_number.avarma_sh_diagnosedauer') }} | {{ states('sensor.avarma_strom_leistung') }}
```
Erwartet:
- ein Diagnosestatus (z. B. `inaktiv` oder `unauffällig`), ein Ampelstatus (z. B. `ok` oder `inaktiv`)
- `on` bei laufendem ESP32, `0.5` (Herstellersoll)
- `15.0` (Startwert, wird von einer Automation beim ersten Start gesetzt)
- eine Leistung oder `unavailable`, falls keine Strommessung eingetragen ist

### Phase 2 – Frontend

1. Fehlende Fremdkarten installieren, wenn der Nutzer zustimmt (oder den Nutzer bitten).
2. `avarma-parameter-wirkung-card.js` als Ressource registrieren. Bevorzugt Datei unter
   `/config/www/avarma/` und URL `/local/avarma/avarma-parameter-wirkung-card.js?v=1.0.0` (Typ `module`).
   Kann dein Server Inline-Ressourcen anlegen, ist das eine Alternative ohne Dateizugriff (ca. 58 KB).
3. Dem Nutzer sagen: Browser mit Strg + Umschalt + R neu laden.

### Phase 3 – Dashboard

1. Prüfen, ob ein Dashboard mit URL `dashboard-waermepumpe-neu` existiert. Falls ja: nicht überschreiben,
   sondern nachfragen.
2. Neues Dashboard anlegen (Titel „Wärmepumpe“, URL `dashboard-waermepumpe-neu`) und als Konfiguration den
   **vollständigen Inhalt** von `avarma_dashboard.yaml` setzen (YAML → JSON-Objekt; Schlüssel `views`,
   `button_card_templates`, `background`).
3. Platzhalter:
   - Raumsensoren: echte Entitäten des Nutzers einsetzen oder die betroffene Karte (`av_rooms`) entfernen.
   - Kein RCBO: nichts tun; die Bereiche im Service-Tab blenden sich aus.
   - Keine Grafana: die Abschnitte mit `GRAFANA_INGRESS_ID` (Tab Energie, Button im Tab Analyse) entfernen.

**Prüfen:** Dashboard laden und durch die Karten nach Entitäten suchen, die nicht existieren. Erwartet sind nur die
bewusst optionalen Platzhalter.

### Phase 4 – Abschlussbericht an den Nutzer

Kurz, in Alltagssprache:
- was installiert wurde (Anzahl Entitäten, Dashboard-URL)
- welche Platzhalter noch offen sind
- dass Ampel und Diagnose bei stehendem Verdichter **grau** sind (gewollt)
- dass sich das Lernband erst nach etwa 7 Tagen Heizbetrieb füllt
- die drei Regeln für den Nutzer:
  1. immer nur einen Parameter ändern
  2. die Wirkung im Tab „Parameter-Wirkung“ prüfen
  3. P32 und P89–P96 nie ändern

## Häufige Fehler und Abhilfe

| Symptom | Ursache und Lösung |
|---|---|
| Entitäten mit Suffix `_2` | Alte UI-Helfer mit gleicher ID existieren: alte Helfer nach Rückfrage entfernen, neu starten. |
| `default_entity_id` unbekannt | HA zu alt: Nutzer bitten zu aktualisieren, nicht die Dateien umbauen. |
| Ampel immer `inaktiv` | ESP32 offline, Verdichter aus oder läuft noch keine 10 min – normal. |
| Alle `hausinstallation_avarma_*` `unavailable` | RS485-Verdrahtung (A+/B− vertauscht, Display noch angeschlossen) – Hardwarefrage, an den Nutzer bzw. eine Elektrofachkraft verweisen. |
| Rote Karte „Custom element doesn't exist: button-card“ | Fremdkarte fehlt oder Browser-Cache alt. |
| `sensor.avarma_strom_*` leer | Platzhalter in `avarma_energie.yaml` nicht ersetzt. |

## Hintergrundwissen (für Rückfragen)

- **Ampel-Richtwerte und Handbuchbezug:** README, Abschnitt „Kältekreis-Ampel und Handbuch“.
- **Herstellerparameter:** Betriebsanleitung HE-AI-290 Rev. 01, S. 77–81, Spalte 12 kW.
  - P06 = Hysterese (Werk 5)
  - P46 = min. Frequenz (35)
  - P45 = **max.** Frequenz (85)
  - P105 = Startfrequenz (35)
  - P32 = EEV-Modus (3, nie ändern)
  - P92–P96 = Soll-Überhitzung (0,5 K Heizen)
  - P102 = Spreizungsschutz (12 K)
- **Messkette:** Te kommt in 0,5-K-Schritten, Ts und Te werden asynchron aktualisiert. Überhitzung zwischen −1 und
  +1 K ist nicht auflösbar. Details: `docs/kalibrierung.md`.
- **Lizenz:** MIT. `esphome/avarma.yaml` steht unter CC BY-NC-SA 4.0 (Register mit KaHu85 abgeglichen).
  Namensnennung AWendt206 (https://github.com/AWendt206/) beibehalten.

# Installation

> Ohne Vorwissen? Die [Schritt-für-Schritt-Anleitung für Einsteiger](anleitung-einsteiger.md) erklärt jeden Klick.

Reihenfolge: Hardware → ESPHome → Packages → Frontend-Karten → Dashboard → optional Grafana.
Vorher ein **vollständiges Home-Assistant-Backup** anlegen.

## 1. ESPHome-Gerät

1. Hardware nach [hardware.md](hardware.md) anschließen.
2. In ESPHome (Builder/App) ein neues Gerät anlegen und den Inhalt von [`esphome/avarma.yaml`](../esphome/avarma.yaml) übernehmen.
3. `secrets.yaml` nach dem Muster [`esphome/secrets.example.yaml`](../esphome/secrets.example.yaml) anlegen (WLAN, API-Schlüssel, OTA-Passwort).
4. Gerätename **„Hausinstallation Avarma“** beibehalten. Alle Pakete und das Dashboard erwarten die Entitäten
   `sensor.hausinstallation_avarma_*`, `number.hausinstallation_avarma_*`, `select.hausinstallation_avarma_*`.
   Anderer Name? Dann in allen Dateien `hausinstallation_avarma` durch den neuen Präfix ersetzen.
5. Flashen, in Home Assistant über die ESPHome-Integration übernehmen und prüfen, ob Werte ankommen
   (z. B. `sensor.hausinstallation_avarma_aussentemperatur`).

## 2. Home-Assistant-Packages

1. In `configuration.yaml` (falls noch nicht vorhanden):
   ```yaml
   homeassistant:
     packages: !include_dir_named packages
   ```
2. Ordner `/config/packages/` anlegen und hineinkopieren:

   | Datei | Inhalt | Pflicht |
   |---|---|---|
   | `avarma_basis.yaml` | Status-Bits, Modus, Fehler, Kältekreis-Kennwerte | ja |
   | `avarma_ampel.yaml` | Ampel-Status und bewertete Kennwerte | ja |
   | `avarma_betrieb.yaml` | Laufzeit, Starts, Parameterspiegel, Snapshot, Vergleichsfenster | ja |
   | `avarma_energie.yaml` | Wärme (Schätzung), Strom, COP, Arbeitszahl | ja, **anpassen** |
   | `avarma_diagnose.yaml` | Messqualität, stabiler Heizbetrieb, Lernband, Überhitzungsdiagnose | ja |
   | `optional/avarma_frostsperre.yaml` | schaltet die Anlage EIN/AUS – startet deaktiviert | nein |

3. **Strommessung eintragen** (`avarma_energie.yaml`): `sensor.DEIN_STROMZAEHLER_LEISTUNG` (W) und
   `sensor.DEIN_STROMZAEHLER_ENERGIE` (kWh, stetig steigend) durch deine Entitäten ersetzen.
   Ohne Strommessung bleiben COP, Arbeitszahl und Verbrauchsanzeigen leer; alles andere funktioniert.
4. *Entwicklerwerkzeuge → YAML → Konfiguration prüfen*, danach Home Assistant neu starten.
5. Die Startwerte der Diagnosegrenzen (10 min, 5 Hz, 0 K, 15 min, 40/60/80 Hz) setzt die Automation
   „Avarma – Diagnose-Startwerte setzen“ beim ersten Start. Danach sind sie in der Ansicht **Diagnose** änderbar.

> Die Lernbänder (`sensor.avarma_lernband_*`) starten leer und brauchen etwa 7 Tage Heizbetrieb bis zur vollen Basis.

## 3. Frontend-Karten

Über HACS bzw. den Marketplace (HA 2026.11+) installieren:

- [button-card](https://github.com/custom-cards/button-card)
- [card-mod](https://github.com/thomasloven/lovelace-card-mod)
- [apexcharts-card](https://github.com/RomRider/apexcharts-card)

Eigene Karte:

1. [`homeassistant/www/avarma/avarma-parameter-wirkung-card.js`](../homeassistant/www/avarma/avarma-parameter-wirkung-card.js) nach `/config/www/avarma/` kopieren.
2. *Einstellungen → Dashboards → ⋮ → Ressourcen → Ressource hinzufügen*:
   URL `/local/avarma/avarma-parameter-wirkung-card.js?v=1.0.0`, Typ **JavaScript-Modul**.
3. Browser hart neu laden (Strg+Umschalt+R). Bei Updates die Versionsnummer `?v=` erhöhen.

## 4. Dashboard

1. *Einstellungen → Dashboards → Dashboard hinzufügen → Neues Dashboard von Grund auf*
   (Name z. B. „Wärmepumpe“, URL z. B. `dashboard-waermepumpe`).
2. Dashboard öffnen → ✏️ → ⋮ → **Rohdaten-Konfigurationseditor** → gesamten Inhalt durch
   [`avarma_dashboard.yaml`](../homeassistant/dashboard/avarma_dashboard.yaml) ersetzen → Speichern.
3. Wenn die URL nicht `dashboard-waermepumpe-neu` lautet, im YAML die Navigationspfade
   `/dashboard-waermepumpe-neu/…` anpassen (Suchen und Ersetzen).

### Platzhalter im Dashboard

| Platzhalter | Wofür | Anpassen |
|---|---|---|
| `sensor.avarma_raum1_temperatur`, `…_raum1_luftfeuchte`, `…_raum2_temperatur`, `…_raum2_luftfeuchte` | Raumkarte in der Übersicht | eigene Raumsensoren eintragen oder Entitäten so umbenennen |
| `switch.avarma_rcbo`, `sensor.avarma_rcbo_*`, `number.avarma_rcbo_*` | optionaler Leitungsschutzschalter mit Mess- und Fehlerstromfunktion (Zigbee) | ohne RCBO werden die Bereiche im Service-Tab ausgeblendet |
| `GRAFANA_INGRESS_ID` | eingebettete Grafana-Kacheln (Energie) und Langzeit-Button (Analyse) | Ingress-Pfad deiner Grafana-App eintragen oder Karten löschen |

## 5. Grafana (optional)

1. InfluxDB-Integration in HA einrichten (Bucket z. B. `homeassistant`).
2. In Grafana *Dashboards → Import* → [`grafana/avarma_kaeltekreis_kalibrierung.json`](../grafana/avarma_kaeltekreis_kalibrierung.json),
   Datenquelle und Bucket wählen.
3. Annahme: HA schreibt mit Tag `entity_id` (ohne Domain) und Feld `value`. Bei abweichendem Schema die Abfragen anpassen.

## Deinstallation

Package-Dateien aus `/config/packages/` löschen, neu starten, Dashboard und Ressource entfernen.
Am ESPHome-Gerät und an der Wärmepumpe bleibt nichts zurück.

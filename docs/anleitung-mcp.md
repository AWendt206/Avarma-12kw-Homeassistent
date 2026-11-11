# Installation mit KI-Assistent (MCP)

Copyright (c) 2026 AWendt206 – https://github.com/AWendt206/

Du nutzt einen KI-Assistenten (z. B. Claude), der über einen **MCP-Server** auf dein Home Assistant zugreifen kann?
Dann kann der Assistent den größten Teil der Installation übernehmen. Du gibst ihm dafür das
**[MCP_BRIEFING.md](../MCP_BRIEFING.md)** und die essenziellen Dateien. Das Briefing enthält Ablauf, Prüfschritte
und die Sicherheitsregeln.

> [!IMPORTANT]
> Der Assistent arbeitet in **deinem** Home Assistant. Lies jede Freigabe-Abfrage, bevor du zustimmst.
> Hardware (ESP32 flashen, Verdrahtung an der Wärmepumpe) kann kein Assistent übernehmen –
> das bleibt bei dir bzw. einer Elektrofachkraft.

---

## Voraussetzungen

| Was | Warum |
|---|---|
| ESP32 ist geflasht und angeschlossen (Einsteiger-Anleitung **Schritte 1–4**) | Ohne Messwerte gibt es nichts einzurichten |
| Home Assistant ab 2026.11 | Die Packages nutzen aktuelle Template-Optionen |
| Ein MCP-Server für Home Assistant **mit Konfigurations-Werkzeugen** | Er muss Helfer, Dashboards und Ressourcen anlegen und Templates rendern können. Ein Server, der nur Geräte schaltet (z. B. reine Sprachsteuerung), reicht nicht. |
| Idealerweise Dateizugriff (Datei-Upload oder YAML-Werkzeug) | Damit legt der Assistent die Packages selbst ab. Ohne Dateizugriff lädst du die Dateien selbst hoch, der Assistent prüft. |
| Ein aktuelles HA-Backup | Bevor irgendetwas geschrieben wird |

---

## Welche Dateien du dem Assistenten gibst

### Pflicht (immer anhängen)

| Datei | Wofür |
|---|---|
| `MCP_BRIEFING.md` | Auftrag, Regeln, Ablauf, Prüfungen |
| `homeassistant/packages/avarma_basis.yaml` | Grundlage aller Kennwerte |
| `homeassistant/packages/avarma_ampel.yaml` | Kältekreis-Ampel |
| `homeassistant/packages/avarma_betrieb.yaml` | Laufzeit, Starts, Parameterspiegel |
| `homeassistant/packages/avarma_energie.yaml` | Wärme, Strom, COP |
| `homeassistant/packages/avarma_diagnose.yaml` | Messqualität, Diagnose, Lernband |
| `homeassistant/dashboard/avarma_dashboard.yaml` | das Dashboard |
| `homeassistant/www/avarma/avarma-parameter-wirkung-card.js` | Karte für den Tab „Parameter-Wirkung“ |

### Hilfreich (bei Fragen)

`README.md` mit den Ampel-Richtwerten und dem Handbuchbezug, `docs/kalibrierung.md` und `docs/hardware.md`.

### Nicht mitgeben

- **`secrets.yaml`, WLAN-Passwort, API-Schlüssel**: Der Assistent braucht sie nicht.
- `esphome/avarma.yaml`: nur nötig, wenn der Assistent das ESPHome-Gerät prüfen oder umbenennen soll.
  Flashen musst du selbst.
- `optional/avarma_frostsperre.yaml`: schaltet die Anlage; nur auf ausdrücklichen eigenen Wunsch.

### So hängen die Dateien zusammen

```
ESPHome-Gerät "Hausinstallation Avarma"  (esphome/avarma.yaml)
        │  liefert sensor/number/select.hausinstallation_avarma_*
        ▼
avarma_basis.yaml ──┬──► avarma_ampel.yaml
                    ├──► avarma_energie.yaml   (+ deine Strommessung)
                    └──► avarma_betrieb.yaml ──► avarma_diagnose.yaml
                                   │
                                   ▼
             avarma_dashboard.yaml  +  avarma-parameter-wirkung-card.js
             (+ button-card, card-mod, apexcharts-card aus HACS/Marketplace)
```

---

## Ablauf in 5 Schritten

1. **ZIP entpacken** (`avarma-ha-v0.1.0.zip`).
2. **Neue Unterhaltung** mit deinem Assistenten beginnen. Der MCP-Server für Home Assistant muss verbunden sein.
3. **Dateien anhängen** (Pflichtliste oben) und folgenden Text senden:

   ```text
   Bitte installiere das Projekt avarma-ha in meinem Home Assistant.
   Halte dich genau an das angehängte MCP_BRIEFING.md, insbesondere an die harten Regeln.
   Beginne mit Phase 0 (nur lesen) und zeig mir dann deinen Plan, bevor du etwas schreibst.
   Meine Strommessung der Wärmepumpe: Leistung = sensor.XXX, Energie = sensor.YYY
   (falls ich keine habe: "keine").
   Meine Raumsensoren für das Dashboard: sensor.AAA (Temperatur), sensor.BBB (Feuchte) – oder "keine".
   Grafana nutze ich: ja/nein.
   ```

4. **Plan prüfen und freigeben.** Der Assistent meldet sich nach Phase 0 mit einer Bestandsaufnahme. Achte auf:
   - Findet er dein ESPHome-Gerät mit dem Präfix `hausinstallation_avarma_`?
   - Gibt es Konflikte mit vorhandenen Entitäten oder einem vorhandenen Dashboard?
   - Will er neu starten? Nur zustimmen, wenn „Konfiguration prüfen“ fehlerfrei war.
5. **Abschluss prüfen.** Dashboard öffnen (Browser: Strg + Umschalt + R). Der Assistent soll dir am Ende sagen,
   welche Platzhalter noch offen sind.

---

## Was der Assistent laut Briefing **nicht** tun darf

- Parameter der Wärmepumpe schreiben, auch nicht testweise
- P32 oder P89–P96 verändern (Regelung des Expansionsventils)
- die optionale Frostsperre ohne deinen ausdrücklichen Wunsch installieren
- Grenzwerte der Ampel verschärfen oder eine rote Schwelle für die Überhitzung erfinden
- ohne Rückfrage neu starten oder Bestehendes überschreiben
- Zugangsdaten wiedergeben

Hält er sich nicht daran, brich ab und weise ihn auf den Abschnitt „Harte Regeln“ im Briefing hin.

---

## Typische Rückfragen des Assistenten

| Frage | Gute Antwort |
|---|---|
| „Dein Gerät heißt `avarma_…`, nicht `hausinstallation_avarma_…`.“ | Entweder in ESPHome den `friendly_name` auf „Hausinstallation Avarma“ setzen und neu flashen, oder den Assistenten das Präfix in allen Dateien ersetzen lassen. |
| „Packages sind nicht aktiviert – darf ich `configuration.yaml` ergänzen?“ | Ja, wenn er dir die Änderung vorher zeigt. |
| „Mein Server kann keine Dateien schreiben.“ | Lade die fünf Package-Dateien selbst per *File editor* nach `/config/packages/` hoch (Einsteiger-Anleitung, Schritt 5) und sag ihm Bescheid. |
| „Es gibt schon Helfer mit gleichen Namen.“ | Stammen sie aus einer alten Avarma-Installation: nach Prüfung löschen lassen. Sonst abbrechen und nachsehen. |
| „Soll ich die Takt-Optimierung aus der README umsetzen?“ | **Nein.** Parameter änderst du selbst im Tab „Steuerung“, einzeln und mit Kontrolle im Tab „Parameter-Wirkung“. |

---

## Ohne MCP?

Kein Problem: Die [Schritt-für-Schritt-Anleitung für Einsteiger](anleitung-einsteiger.md) erklärt jeden Klick
von Hand, die [Installationsanleitung](installation.md) ist die Kurzfassung für Erfahrene.

# Avarma 12 kW – Kältekreisampel: Kalibrierbericht

Stand 10.11.2026 · Datenbasis 07.11. 00:00 bis 10.11. ca. 10:30 MEZ (4950 Minuten, 60-s-Raster)

> **Experimentell.** Alle Bänder in diesem Bericht sind statistische Häufigkeiten der eigenen Anlage. Sie sind **kein technisch sicherer Normalbereich** und keine Herstellerfreigabe. Es wurden **keine Maschinen- oder P-Parameter verändert**. Am Kältekreis und am EEV wurde nichts eigenständig geändert. Die Ampel ersetzt keine Schutzfunktion.

## 1. Datengrundlage

| Größe | Minuten |
|---|---|
| gesamt | 4950 |
| Messdaten vollständig (data_ok) | 4937 |
| Verdichter läuft | 3497 |
| **stabiler Heizbetrieb** | **1866** |
| Abtauung | 214 |

**Aufbereitung:**
- Rohhistorie aus dem HA-Recorder (29 Entitäten).
- Halten bis zur nächsten Änderung. Werte gelten höchstens 24 h, P-Parameter höchstens 7 d.
- Keine Nullauffüllung; „nicht verfügbar“ bleibt leer.

**Filter „stabiler Heizbetrieb“:**
- Verdichter läuft seit mindestens 10 min.
- Keine Abtauung, und die letzte Abtauung ist mindestens 10 min her.
- Die Frequenzspanne der letzten 5 min ist höchstens 5 Hz.
- Modus Heizen.
- Messdaten OK.

Dateien:
- `wide_60s.csv`: breite Tabelle mit den angeforderten Feldern sowie den Kennwerten (roh und `_med5`), data_ok, stable_heating, freq_group, min_since_start und min_since_defrost.
- `ergebnis.json`: alle Statistiken.
- `sh_episoden.html`: eigener Plot der negativen Überhitzung.

## 2. Kennwerte im stabilen Heizbetrieb

Basis sind 1866 Minuten. Angegeben sind Rohwert und 5-min-Median.

| Kennwert | Formel | P10 roh | P50 roh | P90 roh | P10 Median | P90 Median |
|---|---|---|---|---|---|---|
| Überhitzung SH | Ts − Te | −1,0 | 0,0 | 2,5 | −0,5 | 1,0 |
| Unterkühlung SC | Tk − Ty | 1,7 | 3,9 | 7,6 | 1,7 | 6,1 |
| Temperaturhub | Tk − Te | 32,2 | 35,7 | 40,1 | 32,4 | 38,0 |
| Luft − Verdampfung | Außen − Te | 1,5 | 3,5 | 6,5 | 1,5 | 5,5 |
| Kondensation − VL | Tk − VL | 0,3 | 0,7 | 4,2 | 0,3 | 2,5 |
| Spreizung | VL − RL | 3,0 | 3,0 | 3,5 | 3,0 | 3,5 |

Zum Vergleich, alle laufenden Minuten ohne Filter:

| Kennwert | Bereich | P90 |
|---|---|---|
| SH | −4,5 … 20,5 K | 3,0 K |
| SC | bis 46,6 K | 10,8 K |
| Hub | – | 42,7 K |

Der Filter entfernt also vor allem Anfahr- und Abtauphasen. Ohne ihn wären die Bänder deutlich zu breit.

**Frequenzgruppen:** 1754 der 1866 stabilen Minuten liegen bei 30–40 Hz. Die übrigen Gruppen haben zu wenige Minuten:

| Frequenzgruppe | Minuten |
|---|---|
| 40–60 Hz | 80 |
| 60–80 Hz | 17 |
| > 80 Hz | 15 |

Die höheren Gruppen zeigen einen höheren Hub (> 80 Hz: Median 43,9 K) sowie höhere SC- und LuftVerd-Werte. Eigene Referenzkurven je Gruppe sind erst nach mehreren Wochen mit Kälteperioden belastbar. Bis dahin sind die Lernbänder praktisch die Bänder der 30–40-Hz-Gruppe.

## 3. Messkette (wichtigster Befund)

- **Te und Ps passen zueinander:** Te − Tsat(Ps + 1,013 bar) hat den Median 0,05 K (P10 −0,42 / P90 1,88). Ps ist also Überdruck, und die Kältemittelzuordnung R290 ist plausibel.
- **Tk und Pd passen zueinander:** Tk − Tsat(Pd + 1,013) hat den Median −0,28 K.
- **Auflösung:** Te kommt in 0,5-K-Schritten, Ts in 0,1–0,2-K-Schritten.
- **Zeitversatz:** Ts und Te werden asynchron aktualisiert. Nur 11 von 5065 Te-Änderungen fallen innerhalb von 2 s auf eine Ts-Änderung. Der Median-Aktualisierungsabstand beträgt etwa 22 s, bei Tk/Pd etwa 11 s.
- **Folge:** Die berechnete Überhitzung trägt allein durch Quantisierung und Zeitversatz eine Unsicherheit von etwa ±0,5 bis 1 K. Ein SH-Wert zwischen −1 und +1 K ist messtechnisch nicht von 0 zu unterscheiden.

## 4. Überhitzung – offene technische Fragestellung

**Anteile im stabilen Betrieb (Rohwert):**

| Bedingung | Anteil |
|---|---|
| SH < 0 | 33,5 % |
| SH < −1 K | 9,9 % |
| SH < −2 K | 0,9 % |

Der 5-min-Median erreicht minimal −2,0 K.

**Episoden** (5-min-Median < 0 im stabilen Betrieb):
- 135 Episoden mit zusammen 598 min, das sind 32 % der stabilen Zeit.
- Mediandauer 4 min, maximal 20 min.
- **119 von 135 bleiben im Bereich bis −1 K**, also innerhalb der Messauflösung.
- Die Episoden treten 20–270 min nach der Abtauung auf, fast immer bei 30–35 Hz.
- Die Korrelation mit Hz, EEV-Schritten, Außentemperatur, Lüfter und Zeit seit Start ist ≈ 0.

**Herstellersollwert (Nachtrag 10.11.):**

Laut Betriebsanleitung HE-AI-290, Rev. 01, S. 78/80 (Angabe aus externer Recherche, Seite selbst nicht geprüft) regelt das EEV mit P32 = 3 auf die Sauggasüberhitzung.

| Parameter | Funktion | Rohwert live | Wert |
|---|---|---|---|
| P32 | EEV-Regelmodus | 3 | Sauggasüberhitzung |
| P92 | Soll-SH Heizen, Außen ≤ −5 °C | 5 | 0,5 K |
| P93 | Soll-SH Heizen, ca. −5 … +5 °C | 5 | 0,5 K |
| P94 | Soll-SH Heizen, ca. +5 … +25 °C | 5 | 0,5 K |
| P95 | Soll-SH Kühlen | 30 | 3,0 K |
| P96 | Soll-SH Heizen, ca. +25 … +45 °C | 5 | 0,5 K |
| P89 | Proportionalfaktor SH-Regelung | 3 | 0,3 |
| P90 | Differenzkoeffizient SH-Regelung | 1 | 1 |

- Die Rohwerte stammen live über RS485 vom 10.11. und entsprechen den Werkseinstellungen. Skalierung 0,1 K, abgeleitet aus Handbuch und Werkswert.
- Die Außentemperatur-Intervalle sind im Handbuch widersprüchlich notiert. Die Zuordnung in `sensor.avarma_sh_soll_hersteller` ist sinngemäß; im Messzeitraum (−2,5 … +6 °C) gilt praktisch immer 0,5 K.
- **Die gemessene Überhitzung trifft den Sollwert im Mittel:**
  - Mittelwert im stabilen Heizbetrieb +0,38 K, also −0,12 K vom Soll.
  - 45 % der Minuten liegen innerhalb ±0,5 K vom Soll, 64 % innerhalb ±1 K.
  - Nur 9,9 % liegen mehr als 1,5 K unter dem Soll (SH < −1 K).
- **Bezug zum EEV:** SH-Mittelwert je EEV-Klasse im stabilen Betrieb:

  | EEV-Schritte | Minuten | SH-Mittel | Anteil < 0 |
  |---|---|---|---|
  | 75–99 | 376 | 0,55 K | 37 % |
  | 100–124 | 1192 | 0,37 K | 35 % |
  | 125–149 | 245 | 0,23 K | 22 % |

  Es gibt keinen ausgeprägten Zusammenhang. Das ist typisch für einen Regler, der die Ventilstellung nachführt, um den Sollwert zu halten.
- Auch bei konstanten 30–45 Hz bleibt der Befund bestehen (30–35 Hz: 36 % < 0, Mittel +0,39 K).

**Bewertung:**
- Bei einem Regelziel von 0,5 K und 0,5-K-Auflösung von Te ist ein großer Anteil rechnerisch negativer Werte zu erwarten. Der Sollwert ist ein Regelziel, **kein Grenzwert**; eine Alarmgrenze nennt der Hersteller nicht.
- 0,5 K ist für die Sollüberhitzung direkt am Verdichtereintritt ungewöhnlich niedrig. Er darf nicht mit Empfehlungen für andere Verdichtertypen gleichgesetzt werden. Die tatsächliche Lage des Ts-Fühlers (Verdichtereintritt oder vor einem Sauggasspeicher) ist unbekannt.
- Das Muster spricht eher für Regelung auf ein sehr kleines Ziel plus Messketten-Artefakt (Quantisierung, Asynchronität, Sensorposition Ts) als für ein Fehlverhalten. Belegt ist das nicht.
- Ein echtes Nassansaugen kann mit diesen Daten **weder bestätigt noch ausgeschlossen** werden.
- Es wird deshalb **keine rote Überhitzungsschwelle** eingeführt.
- Empfohlen ist eine Rückfrage beim Hersteller oder Fachbetrieb zum Soll-Überhitzungsbereich, zur Lage des Ts-Fühlers und dazu, ob Ts/Te reglerseitig gemittelt werden.

**Aktuelle Darstellung:**
- Der Status zeigt bei Bedarf „Beobachtung“ oder „Prüfen: Messkette“, in Gelb und **nie still grün**.
- Diese Kennzeichnung ist keine Störungsmeldung.

## 5. Abtau-Bits

Bit 16 (Abtauung) und Bit 1024 des Ausgangszustand-Codes sind nicht identisch:

| Fall | Minuten |
|---|---|
| beide gesetzt | 106 |
| nur Bit 16 | 66 |
| nur Bit 1024 | 33 |

Bit 1024 ist vermutlich das 4-Wege-Ventil oder ein Begleitsignal. Der Stabilitätsfilter behandelt **beide** Bits als Ausschluss. Zusätzlich wartet er nach jeder Umschaltung des 4-Wege-Ventils die Stabilisierungszeit ab. Das ist konservativ und kostet etwas stabile Zeit.

## 6. Umsetzung in Home Assistant (Punkt 7 des Auftrags)

**Bestehende Entitäten und Ampelkarten blieben unverändert.** Neu hinzugekommen ist eine Vorstufe.

**1 · Vorstufe Messqualität / stabiler Heizbetrieb:**
- `binary_sensor.avarma_mq_messdaten_ok`: alle 11 Kernmesswerte numerisch, ESP32 online, Ts/Te/Ps innerhalb von 30 min gemeldet, Tk > Te.
- `binary_sensor.avarma_mq_stabiler_heizbetrieb`: Lauf ≥ Stabilisierung, Heizen, keine Abtauung (Bit 16, gefiltert, Bit 1024), 4-Wege-Ventil und letzte Abtauung ≥ Stabilisierung zurück, Hz-Spanne 5 min ≤ Toleranz.
- `sensor.avarma_mq_hz_spanne_5_min`: max − min der Verdichterfrequenz über 5 min.
- `sensor.avarma_mq_minuten_seit_abtauung`: zählt nach einem HA-Neustart ab dem Neustart.
- `sensor.avarma_mq_frequenzgruppe`: Grenzen P46 / Grenze 1 / 2 / 3.

**2 · Normalbereich und Lernband getrennt:**
- `sensor.avarma_mq_<kw>_stabil`: Kennwert nur im stabilen Betrieb.
- `sensor.avarma_mq_<kw>_median_5_min`: 5-min-Median.
- `sensor.avarma_lernband_<kw>_p10 / _p90`: 7 Tage, lernend.
- Die Lernbänder werden neutral dargestellt (blau/violett), nicht als Ampelfarben. Die Spalte „Normalbereich Hersteller“ zeigt „keine Vorgabe“ bzw. für SH „offene technische Prüfung“.

**3 · Überhitzungsdiagnose:**
- `sensor.avarma_sh_soll_hersteller`: aktiver Sollwert aus P92–P96 je Modus und Außentemperatur.
- `sensor.avarma_sh_abweichung_vom_soll`: 5-min-Median minus Soll, nur im stabilen Betrieb.
- `binary_sensor.avarma_sh_unter_schwelle_stabil` und `binary_sensor.avarma_sh_diagnose_bestaetigt` (bestätigt erst nach der Diagnosedauer).
- `sensor.avarma_sh_diagnose_dauer_heute`, `sensor.avarma_sh_diagnose_ereignisse_heute` und `sensor.avarma_stabiler_heizbetrieb_heute`.
- `sensor.avarma_kk_diagnosestatus` mit der Priorität Herstelleralarm > Messqualität unklar > nicht bewertbar > Prüfen: Messkette > Beobachtung > unauffällig.
- Es gibt keine eigene „kritische Grenzverletzung“, weil keine Herstellergrenzen vorliegen.

**5 · Konfigurierbare Grenz-Entitäten** (nur Auswertung, keine P-Parameter):

| Entität | Startwert |
|---|---|
| `input_number.avarma_mq_stabilisierung` | 10 min |
| `input_number.avarma_mq_hz_toleranz` | 5 Hz |
| `input_number.avarma_sh_diagnoseschwelle` | 0,0 K |
| `input_number.avarma_sh_diagnosedauer` | 15 min (seit 10.11.; vorher 5 min) |
| `input_number.avarma_fg_grenze_1` / `_2` / `_3` | 40 / 60 / 80 Hz |

**Dashboard:**
- Neue Ansicht **Diagnose** (`/dashboard-waermepumpe-neu/diagnose`) mit Statusbanner, Experimentell-Hinweis, Vorstufe, Überhitzungskacheln, Grenz-Entitäten, Lernbandtabelle und vier Verläufen (SH roh vs. Median mit Schwelle, Flags, Hz/Hz-Spanne, Minuten seit Abtauung).
- In Übersicht, Kältekreis und Analyse erscheint direkt unter der unveränderten Ampel ein Hinweisbanner. Es ist nur sichtbar bei „Prüfen: Messkette“, „Beobachtung“, „Messqualität unklar“ oder „Herstelleralarm“.

**Bekannte Grenzen:**
- Der HA-Statistik-Helfer gewichtet nach Zustandsänderungen, nicht nach Zeit.
- Lernbänder beginnen leer und erreichen erst nach 7 Tagen eine volle Basis (Anzeige „Lernbasis“).

## 7. Grafana (Punkt 4)

`grafana_kaeltekreis_kalibrierung.json` ist ein importierbares Dashboard für InfluxDB 2 (Flux). Es fragt beim Import nach Datenquelle und Bucket; voreingestellt ist `homeassistant`.

**Aufbau:**
- Alle Panels teilen Zeitachse und Fadenkreuz.
- Kontextpanels: Verdichter Hz und Lüfter rpm, Außentemperatur, VL/RL, Durchfluss und eine Zeitleiste der Abtau-Bits mit Bewertbarkeit.
- Je Kennwert links **roh** und rechts **median_5min**, einmal über alle Werte und einmal nur aus stabilen Minuten.
- Keine Nullauffüllung (`createEmpty: false`, Lücken bleiben sichtbar).

**Ungetestet:**
- Der Bucket-Name ist geraten.
- Das Schema wird angenommen: Tag `entity_id` ohne Domain, Feld `value`.
- Die Abfragen sind beim ersten Import zu prüfen. Erzeugt wird die Datei mit `grafana_build.py`.

## 8. Datenbasis und Reproduzierbarkeit

- Die Auswertung stammt aus **einer** Anlage (Avarma 12 kW V1, R290) und einem kurzen Zeitraum im November. Andere Anlagen, Hydrauliken und Jahreszeiten können andere Bänder ergeben.
- Reproduzieren: Recorder-Historie der genannten Entitäten als JSON exportieren (WebSocket `history/history_during_period`) und `python -I analysis/analyse.py <history.json>` ausführen; der Episoden-Plot entsteht mit `python -I analysis/sh_episoden.py wide_60s.csv`.
- Rohdaten (CSV) sind nicht Teil des Repos.

## 9. Empfehlungen

1. Keine Parameteränderungen auf Basis dieser Bänder. Sie beschreiben den Ist-Zustand, nicht den Sollzustand.
2. Überhitzung:
   - Das Soll 0,5 K ist bekannt.
   - Beim Hersteller oder einer R290-Fachkraft zu klären: Lage des Ts-Fühlers, ob Ts/Te reglerseitig gefiltert werden, und ab welcher Dauer bzw. Höhe negativer Werte der Hersteller eingreift.
   - Bis dahin nur Diagnoseanzeige: Abweichung vom Soll getrennt anzeigen, Gelb erst nach 15 min bestätigt negativ im stabilen Betrieb, keine Ampelfarbe Rot.
   - Keine Experimente an P32 und P89–P96.
3. Mindestens 4–6 Wochen inklusive Frostperioden sammeln, dann die Lernbänder je Frequenzgruppe neu auswerten (`analyse.py` mit neuem Export).
4. Prüfen, ob der ESP32 Ts und Te im selben Modbus-Zyklus lesen und gemeinsam veröffentlichen kann. Das würde den Zeitversatz beseitigen; eine Firmwareänderung am Regler ist dafür nicht nötig.

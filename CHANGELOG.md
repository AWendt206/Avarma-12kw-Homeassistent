# Changelog

Copyright (c) 2026 AWendt206 – https://github.com/AWendt206/

## [0.1.0] – 2026-11-11 · erste Veröffentlichung (experimentell)

- ESPHome-Konfiguration für Waveshare ESP32-S3-RS485-CAN-U an der Displayleitung der Avarma (nur A+/B−, ohne 12 V);
  Registeradressen abgeglichen mit KaHu85 – Datei unter CC BY-NC-SA 4.0
- Home-Assistant-Packages: Basis, Ampel, Betrieb, Energie, Diagnose; optionale Frostsperre (deaktiviert)
- Dashboard mit 9 Ansichten inkl. Diagnose (Messqualität, stabiler Heizbetrieb, Lernband, Herstellersoll Überhitzung)
- Karte `custom:avarma-parameter-wirkung` 1.0.0
- Grafana-Import-Dashboard und Analyse-Skripte zur Kalibrierung
- Überhitzungs-Status meldet höchstens „warnung“ (Herstellersoll 0,5 K ist Regelziel, keine Alarmgrenze)
- README: Ampel-Richtwerte mit Bezug zur Parametertabelle des Handbuchs (HE-AI-290 Rev. 01, S. 77–81);
  Tabellen „Optimierung gegen das Takten“ mit Abgleich der Parameternummern (u. a. P32 = EEV-Modus, nicht ändern)

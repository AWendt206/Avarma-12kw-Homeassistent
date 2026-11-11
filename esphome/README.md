# ESPHome – Avarma über RS485/Modbus

`avarma.yaml` ist die ESPHome-Konfiguration für den **Waveshare ESP32-S3-RS485-CAN-U**. Sie liest den Regler der
Avarma 12 kW per Modbus RTU und stellt alle Werte Home Assistant bereit.

## Benutzung

1. `secrets.example.yaml` nach `secrets.yaml` kopieren und ausfüllen. **`secrets.yaml` niemals veröffentlichen**
   (sie steht in `.gitignore`).
2. `avarma.yaml` im ESPHome Builder als neues Gerät anlegen bzw. den Inhalt übernehmen.
3. Gerätename `hausinstallation-avarma` / Anzeigename „Hausinstallation Avarma“ (in der Datei bereits gesetzt) beibehalten, damit die
   Entitäts-IDs zu den Home-Assistant-Paketen passen.
4. Erstes Flashen per USB-C, danach OTA.

## Hinweise

- Schreibbare Entitäten (`number`/`select`) wirken **sofort** auf die Wärmepumpe. Immer nur einen Wert ändern und
  den alten notieren.
- Registeradressen und Skalierungen sind **nicht vom Hersteller bestätigt**. Sie wurden mit der Veröffentlichung von
  KaHu85 ([HA-Hofman-Energy-Dashboard-avarma-heatpump](https://github.com/KaHu85/HA-Hofman-Energy-Dashboard-avarma-heatpump),
  CC BY-NC-SA 4.0) abgeglichen und an einer Avarma 12 kW V1 (Software Hauptplatine 1514) im Betrieb geprüft.

## Lizenz dieser Datei

`avarma.yaml` steht unter **CC BY-NC-SA 4.0** (Namensnennung, nicht kommerziell, Weitergabe unter gleichen
Bedingungen), weil die Registerliste mit dem gleich lizenzierten Projekt von KaHu85 abgeglichen wurde.
Namensnennung: AWendt206 (https://github.com/AWendt206/) und KaHu85. Der Rest des Repositories steht unter MIT.

# Sicherheit, Haftung, Kennzeichnung

## Haftungsausschluss

Dieses Projekt dient ausschließlich der Information und dem privaten Erfahrungsaustausch. Es ist keine Anleitung,
Empfehlung oder Freigabe für Eingriffe an Heizungs- oder Kälteanlagen.

- Die Nutzung erfolgt auf eigene Gefahr. Für Schäden an Anlagen, Gebäuden oder Personen, für Garantie- oder
  Gewährleistungsverlust, Datenverlust oder Folgeschäden wird keine Haftung übernommen, soweit gesetzlich zulässig.
  Es gilt zusätzlich der Haftungsausschluss der [MIT-Lizenz](../LICENSE).
- Änderungen an Reglerparametern wirken direkt auf die Wärmepumpe. Werte außerhalb der Herstellerangaben können
  Betrieb, Effizienz oder Lebensdauer beeinträchtigen. Vor Änderungen den Hersteller oder einen Fachbetrieb fragen.
- Arbeiten an elektrischen Anlagen und am Kältekreis (R290, brennbares Kältemittel) dürfen nur qualifizierte
  Fachkräfte ausführen.
- Alle Angaben ohne Gewähr. Inhalte können fehlerhaft, unvollständig oder veraltet sein.

## Grundsätze des Projekts

1. **Keine automatischen Parameteränderungen.** Kein Paket ändert Reglerparameter selbständig. Die einzige Automation, die an die
   Anlage schreibt (Frostsperre: Betrieb EIN/AUS), ist optional und startet deaktiviert.
2. **Kältekreis und EEV werden nie geschrieben.** P32 und P89–P96 werden nur gelesen.
3. **Keine erfundenen Grenzwerte.** Wo der Hersteller keine Grenze nennt (z. B. Überhitzung), gibt es kein Rot.
   Herstellersollwerte (z. B. Soll-Überhitzung 0,5 K) sind Regelziele, keine Alarmgrenzen.
4. **Statistik ist keine Freigabe.** Lernbänder (P10–P90) zeigen, was an *einer* Anlage häufig vorkam. Sie werden
   neutral und nicht als Ampelfarbe dargestellt.
5. **Messqualität vor Bewertung.** Bewertet wird nur im stabilen Heizbetrieb mit vollständigen Messdaten. Unklare
   Messqualität wird sichtbar angezeigt, nie stillschweigend grün.
6. **Die Ampel ersetzt keine Schutzfunktion.** Alarme und Abschaltungen des Reglers haben immer Vorrang.

## Kennzeichnung

- **KI-Unterstützung:** Code, Texte und Grafiken wurden mit Unterstützung von KI (Claude, Anthropic) erstellt und vom Autor geprüft.
- **Werbung:** Nichtkommerzielles Projekt in eigener Sache, keine Bezahlung, keine Kooperation mit Herstellern.
- **Marken:** Kein offizielles Projekt von Avarma bzw. Hofman und nicht mit diesen Unternehmen verbunden. Avarma,
  Hofman, Home Assistant, ESPHome, Waveshare, Grafana und InfluxDB sind Marken bzw. Namen ihrer jeweiligen Inhaber
  und werden nur zur Beschreibung der Kompatibilität genannt.
- **Änderungen vorbehalten:** Inhalte, Funktionen und Registerzuordnungen können sich ohne Ankündigung ändern.
  Maßgeblich ist der aktuelle Stand im Repository.

# Abnahme: Pipeline ohne Backups

Diese Kriterien gehören zu [plan.md](plan.md). Am 16. Oktober 2026 durch denselben Lead-Agent ausgeführt;
Nachweise und Grenzen stehen im [Abnahmebericht](report.md). Alle schreibenden CLI-Läufe verwenden isolierte
Verzeichnisse mit Fixture-Kopien. Die unveränderte MKV-/AVI-Metadatenpolitik führt in den dokumentierten
Konfliktfällen zur geprüften sicheren Ablehnung, nicht zu einem neuen Zielprofil.

Eine unabhängige Nachprüfung am selben Tag bestätigt die 69 Tests in 12 Dateien sowie Check und Build des
vorhandenen Arbeitsstands. Die zusätzlichen Anforderungen aus dieser Prüfung stehen in Abschnitt 7.
Die Nacharbeiten wurden anschließend durch den implementierenden Lead-Agent umgesetzt und geprüft.
Die Häkchen in Abschnitt 1 bis 5 dokumentieren die bisher geprüften Fälle; sie nehmen die erweiterte
Abnahme nicht vorweg. Insbesondere deckt der bisherige Nachweis semantisch unvollständiger Videos verlorenes Audio
ab, nicht die neu nachgewiesene Verkürzung der Videospur bei unveränderter Containerdauer.

## Geprüfte Ausgangslage vor dem Pipeline-Umbau

Am 16. Oktober 2026 auf Commit `8867f57288d9d1bd74751dfd4d4e84b649e479c9` mit Node 26.11.1 und npm 11.20.0 geprüft:

- `@tsconfig/node26` 26.0.1 ist in Manifest, Lockfile und Installation konsistent; das alte Node-24-Paket ist entfernt.
- `tsc --showConfig` erfasst alle 22 Projektdateien und übernimmt die Node-Typen aus dem Preset.
- `strict` ist laut installiertem TypeScript 7.0.2 standardmäßig aktiv; `noEmit` bleibt explizit gesetzt.
- `npm run check` erfolgreich; `npm test` erfolgreich mit 26 Tests in 9 Testdateien.
- `npm run build` erfolgreich mit tsdown-Ziel `node26`.
- Die gebaute CLI startet unter Node 26 in einem isolierten leeren Verzeichnis erfolgreich ohne Änderungen.

Das ist eine Toolchain-Baseline, keine Abnahme des noch nicht implementierten Pipeline-Umbaus. Die folgenden
Kriterien müssen nach dessen Umsetzung erneut und vollständig geprüft werden.

## 1. Projektchecks

- [x] `npm run check` besteht: TypeScript und Biome, keine neue Lint-/Format-Toolchain.
- [x] `npm test` besteht einschließlich der vorhandenen Tests mit echten Medienwerkzeugen.
- [x] `npm run build` besteht; anschließend wird `node dist/index.js` für echte CLI-Abnahme verwendet.
- [x] Alle Projektchecks und CLI-Läufe verwenden Node.js 26; Node und npm stammen aus `~/.n/bin`.
- [x] Effektive Node-/npm- und Medienwerkzeug-Versionen sind protokolliert.
- [x] Fehlende Tools werden konkret gemeldet; echte Integration nicht still durch Mocks oder Test-Skips ersetzen.

Bestehende Fehler vor dem Umbau erfassen. Ein bloß erfolgreicher Build oder `git diff --check` ist kein Nachweis für
korrekte Medienverarbeitung. Die Testmatrix verlangt keine Änderung der technischen Zielprofile.

## 2. Discovery und CLI

- [x] Ohne Argument wird ausschließlich das aktuelle Arbeitsverzeichnis verarbeitet.
- [x] Mit einem Verzeichnisargument wird ausschließlich dieses Verzeichnis verarbeitet, auch bei Leerzeichen im Pfad.
- [x] Mehrere Positionsargumente, ungültige Verzeichnisse und unbekannte Flags erhalten verständliche Fehlermeldungen.
- [x] Die bisherigen Bild-/Videoendungen werden weiterhin erkannt, auch bei Großschreibung.
- [x] Nicht unterstützte Dateien und eigenständige Audiodateien bleiben unverändert.
- [x] Dateien in Unterordnern bleiben unverändert; Symlinks führen nicht zu Verarbeitung außerhalb des Zielordners.
- [x] Ein existierendes `.originals` hat keinen Einfluss auf die Auswahl gleichnamiger Dateien im Zielverzeichnis.
- [x] Ein leeres Verzeichnis schließt ohne Änderungen erfolgreich ab.
- [x] Fortschritt, Skip-Gründe, Fehler und Summen decken jede ausgewählte Datei genau einmal ab.

## 3. Echte Medien und Wiederholungsläufe

| Fall | Erwartung und Nachweis |
| --- | --- |
| Kleines konformes Bild | Skip; Dateihash und mtime unverändert |
| Zu großes Bild | Gleicher Name und Format; beide Dimensionen höchstens 1200; Seitenverhältnis erhalten |
| Kleines Bild mit entfernbaren Metadaten | Verarbeitung trotz passender Größe; bisheriges Stripping angewendet |
| Transparentes PNG/WebP | Transparenz bleibt erhalten; kein ungewollter Formatwechsel |
| Animiertes GIF/WebP | Keine Frame-Reduktion; Dimensionen und Timing prüfen |
| Konformes Video | Skip ohne Encoder-Aufruf; Hash und mtime unverändert |
| Zu großes Querformatvideo | Bestehende Grenze 1280 × 720 eingehalten, ohne Verzerrung |
| Zu großes Hochformatvideo | Bestehende Grenze 720 × 1280 eingehalten, ohne Verzerrung |
| Niedrige Bildrate / kleine Abmessungen | Keine künstliche Erhöhung durch Verarbeitung aus einem anderen Grund |
| Hohe Bildrate / anderer Codec | Höchstens 24 fps und H.264 nach bisheriger Operation |
| Video nur mit relevanten Metadaten | Bisherige Operation und Bereinigung; zweiter Lauf konform |
| Video mit Audio/Textuntertiteln | Erwartete Spuren und ihre Inhalte bleiben gemäß bestehendem Vertrag erhalten |
| Binäruntertitel/Daten/Anhänge | Entfernung und Konformität prüfen; MKV-Konflikt siehe Bericht |
| Anderer vorhandener Videocontainer | Kein erzwungener Wechsel zu MP4; nicht unterstützte Fälle sicher ablehnen |

- [x] Jedes bisher unterstützte Bildformat wird in der echten Format-/Skip-Prüfung mindestens einmal abgedeckt.
- [x] Für erfolgreich verarbeitete repräsentative Bilder und Videos wird unmittelbar ein zweiter CLI-Lauf ausgeführt.
- [x] Im zweiten Lauf sind diese Dateien ausschließlich `skipped` und es gibt keinen schreibenden Encoder-Aufruf.
- [x] SHA-256 und mtime vor/nach dem zweiten Lauf stimmen überein; keine neuen temporären Artefakte verbleiben.
- [x] Die mtime nach dem ersten Lauf entspricht der ursprünglichen innerhalb der dokumentierten Speicherpräzision.
- [x] Tests setzen die Änderungszeiten ausdrücklich, auch mit Untersekundenanteilen.

Encoder-Presets/CRF durch Adaptertests sichern. Nicht aus komprimierten Fremddateien zu rekonstruieren versuchen.
Die Ausgabeprüfung zusätzlich zur Konformität gegen das erwartete Ergebnis testen: Ein kleines stummes Video ist kein
gültiger Ersatz für eine Quelle, deren Audiospur hätte erhalten bleiben müssen.

## 4. Fehler und Schutz der Eingabedateien

- [x] Ein beschädigtes Bild/Video erhält einen Dateifehler; die folgende gültige Datei wird verarbeitet.
- [x] Fehlende oder unplausible Probe-Daten führen nicht zu einem falschen Skip oder einer ungeprüften Übernahme.
- [x] Ein Toolfehler nach teilweise geschriebener temporärer Ausgabe lässt Eingabe und ihre mtime unverändert.
- [x] Leere, unlesbare oder weiterhin nicht konforme Ausgaben werden vor der Übernahme abgelehnt.
- [x] Eine zwar konforme, aber semantisch unvollständige Ausgabe wird nicht übernommen, etwa bei verlorener Audiospur.
- [x] Fehler beim Setzen der mtime oder beim finalen Rename lassen die Eingabe erhalten; eigenes Cleanup wird versucht.
- [x] Fremde Dateien wie `foto.tmp.jpg` oder `clip.tmp.mp4` werden weder überschrieben noch bereinigt.
- [x] Nach erfolgreicher Übernahme löscht ein Reporting-/Cleanup-Fehler nicht die fertige Ausgabe.
- [x] Behandelbare Abbrüche erhalten die Quelle; Grenzen bei hartem Prozessabbruch sind ehrlich dokumentiert.

Fehlerfälle durch gezielte Mocks/Injection auf Dateisystem- und Adaptergrenzen nachweisen; mindestens ein defektes
echtes Medium im CLI-Mischlauf ergänzen. Kein Mock soll die Originaldatei absichtlich beschädigen und anschließend
eine nicht mehr vorhandene Backup-Wiederherstellung verlangen. Der neue Vertrag verbietet diesen Schreibzugriff.

## 5. Entfernung der Backup-Verwaltung und Dokumentation

- [x] Keine `.originals`-Anlage, Backup-Kopie, Backup-basierte Filterung oder Restore-Operation im aktiven Code.
- [x] Keine aktiven Backup-Typfelder, `ORIGINALS_DIR`-Konstante oder `backup-exists`-Entscheidungen mehr.
- [x] Vorhandene `.originals`-Dateien bleiben einschließlich Hash und mtime unverändert, auch bei Fehlern.
- [x] Alte Backup-/Restore-Tests wurden sinnvoll durch die neuen Verträge ersetzt.
- [x] README nennt die Benutzerverantwortung für separat aufbewahrte Originale und beschreibt Skip nach Zustand.
- [x] `AGENTS.md` enthält die neue Regel für temporäre Ausgaben statt der aufgehobenen Backup-Pflicht.
- [x] Keine neue JXL-Unterstützung, neuen technischen Zielprofile oder neuen Medien-Umbenennungen enthalten.
- [x] Historische Specs bleiben erhalten; ihre Backup-Beschreibungen sind keine aktive Verhaltensanforderung.

Nach Abschluss gezielt nach `backup`, `backup-exists`, `ORIGINALS_DIR`, `restoreFailedProcessing` und `.originals`
in Code, Tests und aktueller Dokumentation suchen. Treffer als aktive Altlogik, historische Beschreibung oder erlaubten
negativen Test einordnen. Historische Dateien und Tests auf Unverändertheit nicht nur für eine leere Suche löschen.

## 6. Abnahmebericht

In der Umsetzung einen kompakten Bericht mit geprüftem Arbeitsstand, Toolversionen, Befehlen, Ergebnissen, realen
Erster-/Zweiter-Lauf-Nachweisen und offenen Einschränkungen ergänzen. Bereits vorhandene Baseline-Probleme klar von
neuen Fehlern unterscheiden. Keine behauptete unabhängige Abnahme bei Prüfung durch denselben Lead-Agent.

## 7. Ergänzungen aus der unabhängigen Nachprüfung vom 16. Oktober 2026

Die folgenden Aufgaben wurden durch den implementierenden Lead-Agent umgesetzt und geprüft; Nachweise stehen im
Nacharbeitsabschnitt von [report.md](report.md). Eine unabhängige Abnahme der neuen Änderungen wird nicht behauptet.
Bestehende Änderungen und Nachweise bleiben erhalten; keine neue Prozessorhierarchie, Zielprofile oder Migration.

### 7.1 Erhaltung der Videospur unabhängig von der Containerdauer

Reproduzierter Befund: Eine Quelle mit 2 Sekunden Video, 24 Frames und 2 Sekunden Audio wurde mit einer absichtlich
unvollständigen Ausgabe verglichen. Diese enthält nur 0,5 Sekunden Video beziehungsweise 6 Frames bei gleicher
Bildrate, aber die unveränderte Audiospur. Beide Container melden 2 Sekunden Dauer. `validateVideo()` und der
Paketvergleich akzeptieren diese Ausgabe derzeit. Das ist eine Lücke der Ausgabeprüfung; eine solche Kürzung durch
den regulären Transcoder wurde nicht beobachtet.

- [x] Den Fall zunächst mit echten, isolierten Medien reproduzieren und als Regressionstest sichern. Die Ausgabe
  gezielt verkürzen, ohne die Quelle zu verändern; identische Audio-Paketdaten und Containerdauer nachweisen.
- [x] Die zeitliche Abdeckung der primären Videospur in Probe-Daten und Ausgabevalidierung berücksichtigen.
  Containerdauer allein genügt nicht. Fehlende erforderliche Nachweise dürfen keine ungeprüfte Übernahme erlauben.
- [x] Die bereits beim Dekodieren gezählte Framezahl sinnvoll weiterverwenden. Bei unveränderter konstanter Bildrate
  unerwarteten Frameverlust erkennen; bei geplanter Bildratenreduktion keine identischen Framezahlen verlangen.
  Toleranzen und den Umgang mit variabler Bildrate fachlich begründen, statt eine pauschale Gleichheit einzuführen.
- [x] Direkte Tests für `validateVideo()` ergänzen: gültige Ausgabe, verkürzte Videospur bei unverändertem Audio
  und Containerdauer sowie zulässige Bildratenreduktion. Prüfungen auf Geometrie und Spurerhaltung bewahren.
- [x] Zusätzlich über den Prozessor beziehungsweise die Transaktion nachweisen, dass die unvollständige Ausgabe
  abgelehnt wird, Quellhash und mtime unverändert bleiben und die eigene temporäre Ausgabe bereinigt wird.

### 7.2 Optimierte Animationen mit Teilframes

Reproduzierter Befund: Ein optimiertes GIF enthält einen vollständigen Frame von 1600 × 800 und einen Teilframe von
101 × 91 auf derselben Canvas von 1600 × 800, mit Offset 10/10. Die bestehende Operation verkleinert die Canvas auf
1200 × 600, lässt den kleinen Teilframe und seinen Offset jedoch unverändert. Die Validierung leitet den erwarteten
Canvas-Maßstab aus der jeweiligen Framegröße ab und lehnt die Ausgabe mit `Image output does not preserve animation
canvas` ab. Die Quelle bleibt erhalten. Die bisherige Abnahme verwendet vollständige Frames gleicher Größe.

- [x] Eine echte optimierte GIF-Fixture mit Teilframe und Offset ergänzen und den beschriebenen CLI-Fehler
  reproduzieren. Ausgangsframes, Canvas, Offsets, Timing und Disposal ausdrücklich prüfen.
- [x] Den Vertrag für Teilframes festlegen und dokumentieren: entweder nachweisbar korrekte Verarbeitung innerhalb
  der bestehenden Operation oder ausdrücklich sichere Ablehnung als zusätzliche Betriebsgrenze. Für dieses Paket
  ist eine belegte und dokumentierte sichere Ablehnung zulässig; neue Animationsverarbeitung ist nicht vorausgesetzt.
- [x] Framegröße, Canvas und Offsets gemeinsam beurteilen. Die Validierung nicht nur lockern, um den Fehler zu
  beseitigen; eine räumlich veränderte Animation darf dadurch nicht als korrekt gelten.
- [x] Bei erfolgreicher Verarbeitung zusätzlich die zusammengesetzten Animationsframes gegenüber der erwarteten
  Skalierung prüfen und den zweiten CLI-Lauf ohne Encoder-Aufruf nachweisen. Bei Ablehnung Quellhash, mtime und
  Cleanup prüfen und die Grenze in README und Report neben den bestehenden Containergrenzen dokumentieren.

### 7.3 Gezielte Vereinfachungen in Code und Tests

- [x] Die beiden Tests zu strukturellen Format-/Stream-Tags in `test/media/inspect.test.ts` bereinigen. Sie mocken
  bereits `hasMetadata: false` und prüfen die behauptete Tag-Auswertung nicht. Die tatsächlichen Ausnahmen auf
  Probe-Ebene prüfen; vorhandene Abdeckung in `test/media/probe.test.ts` nutzen, statt identische Tests zu ergänzen.
- [x] Die FFmpeg-Adaptertests aus `test/adapters.test.ts` und `test/media/ffmpeg-adapter.test.ts` konsolidieren.
  Doppelten Kommando-Rekonstruktionscode und den Mock entfernen, der nur das Originalmodul zurückgibt. Eigenständige
  Fälle wie mehrere Audiospuren, fehlende Untertitel, Mapping und Encoder-Einstellungen weiterhin abdecken.
- [x] Die ungenutzte Abhängigkeit `fast-glob` nach erneuter Referenzprüfung aus Manifest und Lockfile entfernen.
  Dies ist die gezielte Ausnahme zum bisherigen unveränderten Dependency-Stand; keine weiteren Versionswechsel.
- [x] `VIDEO_CODEC` und den direkt geschriebenen Encoderwert auf eine tatsächlich verwendete Definition reduzieren;
  die Encoderwahl bleibt `libx264`.
- [x] Die redundante Speicherung von `FileResult.reasons` und dem daraus erzeugten `reason`-Text bereinigen.
  Verarbeitungsgründe, Skip-Gründe und Fehlerphasen müssen im CLI-Reporting weiterhin vollständig erscheinen.

### 7.4 Erneute Abnahme und Dokumentation

- [x] Nach den Änderungen `npm run check`, `npm test` und `npm run build` mit den vorgeschriebenen Werkzeugen
  erfolgreich ausführen. Die bisherige echte Formatmatrix, Wiederholungsläufe und Fehlersicherheit bleiben erhalten.
- [x] `report.md` um den geprüften Arbeitsstand, neue Regressionstests, tatsächliche Ergebnisse und verbleibende
  Grenzen ergänzen. Frühere Nachweise als solche erhalten; keine unabhängige Nachprüfung der neuen Implementierung
  behaupten, wenn Implementierung und Prüfung erneut durch denselben Agenten erfolgen.
- [x] Neue Aufgaben erst nach ihrem jeweiligen Nachweis abhaken. Sichere Ablehnung von Teilframe-Animationen als
  solche benennen; erfolgreiche Verarbeitung darf nur bei entsprechendem Mediennachweis behauptet werden.

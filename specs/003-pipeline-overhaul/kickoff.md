# Start in einer frischen Session

## Empfehlung

GPT-6.1 Sol (`gpt-6.1-sol`) mit Reasoning **high**, ein Lead-Agent ohne Subagents.

Das ist eine auf dieses Paket bezogene Einschätzung: Der Umfang ist begrenzt, aber die Dateitransaktion ohne Backup,
die neue Bildinspektion und die Wiederholbarkeit verlangen sorgfältige gemeinsame Entscheidungen. Parallele
Implementierer würden an denselben Verträgen, Typen und Tests arbeiten. Ein zusätzlicher Koordinator ist nicht nötig.

Die offizielle Modellübersicht nennt GPT-6.1 Sol für komplexe Projekte mit Kostenabwägung. Die konkrete Wahl von
`high` und Lead-Agent-only ist unsere Empfehlung für diesen Umbau, keine gemessene Überlegenheit für dieses Repository.

Quelle, geprüft am 16. Oktober 2026:
[OpenAI: Model selection](https://developers.openai.com/api/docs/guides/model-selection).

Ein späterer unabhängiger Review könnte separat mit GPT-6 Astra (`gpt-6-astra`), Reasoning **high**, auf einem
festgehaltenen unveränderten Stand erfolgen. Das ist optional und wird durch den folgenden Prompt nicht beauftragt.

## Kopierbarer Startprompt

```text
Implementiere das Arbeitspaket specs/003-pipeline-overhaul im Repository
/Users/roland.hummel/projects/defaude/bloggymedia.

Lies zuerst AGENTS.md sowie specs/003-pipeline-overhaul/plan.md und acceptance.md vollständig.
Die Dokumente enthalten die verbindlichen Entscheidungen und den geprüften Ausgangsstand.
Prüfe den aktuellen Checkout und vorhandene Änderungen, bevor du mit der Umsetzung beginnst.

Arbeite als einzelner Lead-Agent ohne Subagents. Setze das Paket einschließlich Tests und Dokumentation
vollständig um; beschränke dich nicht auf eine erneute Planung. Triff normale Implementierungsentscheidungen
selbstständig innerhalb der dokumentierten Grenzen.

Ziel ist ausschließlich der Pipeline-Umbau: zustandsbasierte Entscheidung für Bilder und Videos,
keine Backups oder Backup-basierte Filterung, geprüfte temporäre Ausgaben vor sicherer Ersetzung,
Erhalt der ursprünglichen Änderungszeit und aussagekräftige Meldungen für Skip, Erfolg und Fehler.
Vorhandene .originals-Verzeichnisse bleiben unangetastet. Die alte Backup-Pflicht in AGENTS.md ist durch
diesen Auftrag ausdrücklich aufgehoben; passe sie im Zuge der Umsetzung an die neue Regel an.

Die eigentliche Medienverarbeitung bleibt unverändert: bisherige Formate, Dateinamen, Endungen, Limits,
Encoder-Einstellungen, Audio-/Untertitelbehandlung und Metadaten-Stripping. Keine JXL-Umstellung,
keine eigenständige Audioverarbeitung, keine neuen Zielprofile, keine neue Metadaten-Positivliste
und keine vorgezogene Umbenennungsarchitektur. Verwende Node.js 26 und npm aus ~/.n/bin.
Node 26 ist bereits als Default installiert. Behalte den aktuellen Dependency-Stand, @tsconfig/node26
mit ausschließlich noEmit als lokaler Compileroption und das tsdown-Ziel node26 bei.
Keine zusätzliche Toolchain-Migration und kein Runtime-Downgrade.

Prüfe insbesondere mit echten Medienwerkzeugen, dass ein erfolgreicher erster Lauf ein konformes Ergebnis
erzeugt und der zweite Lauf diese Dateien ohne Änderung von Inhalt oder mtime überspringt. Prüfe Fehler
vor der Übernahme, temporäre Namenskollisionen und die unveränderte Fortsetzung mit weiteren Dateien.
Führe npm run check, npm test und npm run build aus und erfülle die Abnahmekriterien in acceptance.md.
Nutze für schreibende CLI-Tests ausschließlich isolierte Verzeichnisse mit Fixture-Kopien.

Erhalte fremde Änderungen. Keine Commits, Pushes oder Veröffentlichungen ohne weiteren Auftrag.
Dokumentiere zum Abschluss die tatsächlichen Änderungen, Prüfungen, Toolversionen und verbleibenden Grenzen.
Falls ein reproduzierbarer Fall eine Änderung der technischen Medienpolitik benötigt, erhalte die Eingabe,
melde den konkreten Konflikt und ändere das Zielprofil nicht eigenmächtig.
```

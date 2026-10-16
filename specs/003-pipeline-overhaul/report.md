# Abnahmebericht: Pipeline ohne Backups

Stand: 16. Oktober 2026. Umsetzung und Prüfung durch denselben Lead-Agent, ohne Subagents.

Die folgenden ursprünglichen Abschnitte dokumentieren die Erstimplementierung mit 69 Tests. Ihre Nachweise bleiben
historisch erhalten. Die anschließend unabhängig bestätigte Baseline und die jetzt umgesetzten Nacharbeiten aus
Abschnitt 7 der Abnahme sind am Ende dieses Berichts separat beschrieben.

## Arbeitsstand und Umfang

Ausgangspunkt und weiterhin unveränderter HEAD: `main`, `8867f57288d9d1bd74751dfd4d4e84b649e479c9`. Beim Start
lagen bereits Änderungen in `AGENTS.md`, `README.md` und das unversionierte Verzeichnis
`specs/003-pipeline-overhaul` vor. Diese Vorarbeit wurde erhalten und gezielt fortgeschrieben. Es wurden keine
Commits, Pushes oder Veröffentlichungen ausgeführt.

Die Pipeline untersucht Bilder und Videos anhand ihres Inhalts. Konforme Dateien erhalten `skipped
(compliant)`. Verarbeitungsgründe und Fehlerphasen erscheinen pro Datei; der Report zählt alle ausgewählten
Dateien. Discovery verwendet einen sortierten Snapshot regulärer Dateien direkt im Zielverzeichnis, ohne
Symlinks. Die aktive Backup-/Restore-Verwaltung und ihre Ergebnisfelder sind entfernt. `.originals` wird nicht
betreten.

Die gemeinsame Transaktion reserviert per `open(..., 'wx')` eine zufällige temporäre Datei im selben
Verzeichnis mit derselben Endung. Bilder werden dorthin kopiert; `mogrify` schreibt ausschließlich auf der
Kopie. Videos erhalten die reservierte Ausgabe als FFmpeg-Ziel. Vor der Ersetzung werden Existenz, Dateityp,
Dateigröße, Lesbarkeit, Konformität und die erwarteten Erhaltungspflichten geprüft. Erst danach werden
Dateimodus und ursprüngliche mtime übertragen und die Quelle per Rename ersetzt. Vorher wird sie nicht
gelöscht. Fehler bereinigen ausschließlich die eigene temporäre Datei. Ein Reportingfehler nach Übernahme
löscht sie nicht.

Unverändert: Dependency-Stand, `@tsconfig/node26` mit ausschließlich `noEmit` als lokaler Option, Build-Ziel
`node26`, Format-/Endungslisten, Limits und die beiden schreibenden Medienadapter einschließlich
Encoder-Einstellungen. Keine JXL-Unterstützung, Audio-Pipeline, neuen Zielprofile, fachliche
Metadaten-Positivliste oder Umbenennungsarchitektur.

## Werkzeuge und Projektchecks

Alle Node-/npm-Aufrufe verwendeten die vorgegebenen Programme aus `~/.n/bin`, einschließlich der Unterprozesse
der Tests.

| Werkzeug | Effektive Version |
| --- | --- |
| Node.js / npm | 26.11.1 / 11.20.0 |
| ImageMagick (`magick`, `mogrify`) | 7.1.2-34 Q16-HDRI, aarch64 |
| FFmpeg / ffprobe | 9.0.2 / 9.0.2 |
| TypeScript / Node-Typen | 7.0.2 / 26.6.4 |
| Node-Preset | `@tsconfig/node26` 26.0.1 |
| Biome / Vitest | 2.5.15 / 5.0.3 |
| tsdown / Rolldown | 0.23.0 / 1.2.13 |

Die Baseline vor Änderungen bestand: `npm run check`, 26 Tests in 9 Dateien und `npm run build`. Es gab keine
vorbestehenden Checkfehler.

Nach Umsetzung ausgeführt:

- `npm run check`: TypeScript und Biome erfolgreich.
- `npm test`: 69 Tests in 12 Testdateien erfolgreich, einschließlich echter Medienwerkzeuge.
- `npm run build`: erfolgreich, Ziel `node26`; die echte CLI-Abnahme verwendet `node dist/index.js`.
- `npm ls --depth=0`: Installation entspricht weiterhin dem unveränderten Manifest und Lockfile.
- `git diff --exit-code -- package.json package-lock.json tsconfig.json tsdown.config.ts`: keine Änderungen.
  Auch `src/adapters/ffmpeg.ts` und `src/adapters/mogrify.ts` bleiben unverändert.
- Suche nach `backup`, `backup-exists`, `ORIGINALS_DIR`, `restoreFailedProcessing`, `.originals`: keine aktive
  Altlogik in `src`; verbleibende Treffer sind negative Tests und aktuelle Dokumentation der Entfernung.

Fehlende Werkzeuge führen weiterhin zu einem konkreten fatalen Fehler. Die neue Bildinspektion benötigt
`magick` (ImageMagick 7); diese Voraussetzung steht in README und Toolprüfung. Kein Integrationstest wird
still übersprungen.

## Echte Erster- und Zweiter-Lauf-Abnahme

`test/cli.integration.test.ts` baut die CLI, erzeugt kleine Fixtures in einem isolierten temporären
Verzeichnis und führt schreibende CLI-Läufe ausschließlich auf Kopien aus. Pfade enthalten absichtlich
Leerzeichen. Die 13 Dateien der positiven Formatmatrix liefern im ersten Lauf **12 processed, 1 skipped, 0
failed**:

| Fälle | Tatsächlicher Nachweis |
| --- | --- |
| `large.jpg` | 1600 × 800 mit Kommentar wird JPEG 1200 × 600 mit gleichem Namen |
| `small.jpeg` | 60 × 40, bereits bereinigt: sofortiger Skip, SHA-256 und mtime unverändert |
| `transparent.PNG`, `transparent.webp` | Metadaten entfernt; Transparenz und kleine Abmessungen erhalten |
| `animation.gif`, `animation.webp` | Zwei Frames, Resize auf 1200 × 600; Timing 0,1/0,2 s und Schleifen erhalten |
| `landscape.mp4` | 1600 × 900 / 30 fps wird 1280 × 720 / 24 fps |
| `portrait.mp4` | 900 × 1600 wird 720 × 1280 |
| `low.mov` | MPEG-4 wird H.264; 64 × 48 und 12 fps bleiben erhalten |
| `metadata.mp4`, `alternate.m4v` | Nur relevante Metadaten lösen Verarbeitung aus; danach konform |
| `streams.mp4` | Audio und Textuntertitel erhalten; vollständige SHA-256-Pakethashfolgen unverändert |
| `data.mov` | Datenstream entfernt; Audio und Textuntertitel erhalten; Ausgabe konform |

Unmittelbar anschließend liefert dieselbe CLI **0 processed, 13 skipped, 0 failed**. Für diesen Lauf stehen
`mogrify` und `ffmpeg` absichtlich durch fehlschlagende Wächter am Anfang von PATH: kein Aufruf dieser
schreibenden Werkzeuge findet statt. SHA-256 und mtime jeder Datei sind vor/nach Lauf zwei gleich. Die
Verzeichnisliste enthält anschließend ausschließlich die 13 erwarteten Eingaben, keine Transaktionsartefakte.

Vor Lauf eins wird absichtlich `mtime = 1600000000.123456` Sekunden gesetzt. Die Prüfung vergleicht die
tatsächlich vom Dateisystem gelesene mtime vor/nach Verarbeitung mit einer Toleranz unter 0,002 ms (2
Mikrosekunden). Das ist die hier nachgewiesene Speicherpräzision, keine Zusage nanosekundengenauer Erhaltung
auf jedem Dateisystem. Der zweite Lauf bewahrt die gespeicherte mtime exakt im Zahlenwert von Node `stat`.

Die Videoinspektion liest die Container-/Streamdaten und dekodiert zusätzlich mit `ffprobe -count_frames` alle
Frames der bisherigen primären Videospur, ohne eine neue Mediendatei zu kodieren. Decoderfehler verhindern
einen Skip. Bei Ausgaben werden außerdem Zielmaße, Rate, Container, Dauer, Audio-/Textuntertitelanzahl und
Codecs verglichen. Die Paketdaten der kopierten Spuren werden in Reihenfolge per SHA-256 verglichen; Muxer
dürfen Zeitstempel neu basieren.

Bildinspektion verwendet die JSON-Ausgabe von ImageMagick und berücksichtigt alle Frames und
Canvas-Abmessungen. Die technische Ausnahmegruppe wurde anhand echter Ausgaben vor/nach `mogrify -strip`
geprüft: Dateisystemdaten `date:*`, Pixelsignatur, PNG-IHDR/Palette/Transparenz, JPEG-Farbraum/Sampling und
WebP-Blendstruktur. Kommentare, Profile, PNG-Farb-/Text-/Zeit-Metadaten lösen dagegen Verarbeitung aus. Das
ist keine GPS-/Datum-Positivliste. Die Ausgabeprüfung kontrolliert Format, geplante Maße, Framezahl, Delay,
Iterationen, Disposal, Canvas und Transparenz.

## Fehlersicherheit und CLI

- Gemischter echter Lauf: defektes JPEG, defekter MP4-Header und beschädigter H.264-Videokörper mit intaktem
  Containerkopf erhalten je einen Fehler. Die folgende große gültige JPEG-Datei wird erfolgreich verarbeitet.
- Hash und mtime vorhandener `.originals`-Dateien, fremder konformer `photo.tmp.jpg`/`clip.tmp.mp4`,
  Unterordnerdateien, Audiodateien und sonstiger Dateien bleiben unverändert. Symlinks werden nicht als
  Eingaben ausgewählt.
- Unit-Tests injizieren Teil-Ausgaben mit Toolfehler, leere/unlesbare/nicht konforme Ausgaben, verlorene
  Audiospuren, veränderte kopierte Paketdaten, mtime-/Rename-Fehler und Cleanupfehler. Die Quelle bleibt vor
  Übernahme erhalten; behandelbare Fehler im Dateilauf verhindern nicht die Verarbeitung der nächsten Datei.
- Eine gezielt belegte UUID-Temporärdatei erzwingt eine neue exklusive Reservierung. Die fremde Datei bleibt
  erhalten.
- Ein echter SIGTERM während einer teilweise geschriebenen temporären Bildausgabe beendet mit 143, erhält
  Quellhash und mtime und entfernt die eigene Ausgabe. Ein zusätzlicher AbortSignal-Test sichert den Punkt vor
  Übernahme.
- Ein injizierter Reportingfehler nach Rename lässt die erfolgreich übernommene Ausgabe bestehen.
- Aufruf ohne Argument, genau ein Verzeichnis mit Leerzeichen, leeres Verzeichnis und nur Audiodateien sind
  geprüft. Unbekannte Flags, mehrere Argumente, fehlende Verzeichnisse und eine Datei als Verzeichnis liefern
  Exit 1.
- Das bestehende Exit-Verhalten bleibt: dateibezogene Fehler zählen im Report, ohne einen fatalen Exit zu
  erzwingen.

## Reproduzierbare Grenze der unveränderten Medienpolitik

Mit FFmpeg 9.0.2 erzeugt die bestehende Operation in Matroska neue `ENCODER`- und `DURATION`-Tags. Die
bestehenden Ausnahmen gelten kleingeschrieben und enthalten diese Tags nicht. AVI erhält das ebenfalls
relevante Format-Tag `software=Lavf63.1.102`. Die erneute Untersuchung fordert daher weiter
`metadata`-Verarbeitung. Diese Ausgaben werden mit `transaction: validate: Video output remains non-compliant:
metadata` abgelehnt. Die Eingaben bleiben einschließlich Hash und mtime erhalten; ein anderer Container wird
nicht untergeschoben.

Die Tests erzeugen zusätzlich ein MKV mit einer echten PGS-Binäruntertitelspur und einem Anhang. Ein direkter
Lauf des unveränderten Adapters entfernt beide Spuren wie vorgesehen; die erzeugte Datei bleibt wegen
derselben Tags nicht konform. Der CLI-Lauf übernimmt deshalb auch diese Ausgabe nicht. MOV mit Datenstream
wird dagegen erfolgreich bereinigt. Konformität nach Entfernung ist damit für MOV belegt und für MKV
ausdrücklich als Konflikt dokumentiert. Das Paket ist einschließlich sicherer Ablehnung umgesetzt; eine
allgemeine erfolgreiche MKV-/AVI-Verarbeitung unter diesen Toolversionen würde eine separat zu entscheidende
Änderung der Medienpolitik benötigen.

Reproduktion der einfachen Containerfälle, ausschließlich mit Fixture-Kopien:

```sh
case_dir=$(mktemp -d)
mkdir "$case_dir/fixtures" "$case_dir/work"
for ext in mkv avi; do
    ffmpeg -v error -f lavfi -i color=red:size=64x48:rate=12 -t 0.5 \
        -c:v mpeg4 "$case_dir/fixtures/clip.$ext"
    cp "$case_dir/fixtures/clip.$ext" "$case_dir/work/clip.$ext"
done
node dist/index.js "$case_dir/work"
```

Die vollständige automatische Reproduktion einschließlich PGS, Anhang und unveränderter Eingaben läuft mit
`npm test`. Bei absichtlich generiertem unbekanntem Binäranhang kann FFmpeg eine Warnung zu fehlenden
Codecparametern ausgeben; die Spur wird wie bisher nicht gemappt. Das ist kein fehlendes Werkzeug oder
übersprungener Test.

## Verbleibende Betriebsgrenzen

SIGKILL/Stromausfall können temporäre Reste hinterlassen; die Anwendung löscht keine fremden Altdateien
pauschal. Parallele Läufe und externe Änderungen desselben Verzeichnisses sind nicht zugesichert. Ein vor
Rename erkennbar geänderter Quell-Inode, Dateigröße oder Zeitstempel verhindert die Übernahme, ersetzt aber
keine Dateisperre. Rename schützt vor Ersetzung durch ungeprüfte Ausgaben; eine
Stromausfall-Durabilitätsgarantie mit `fsync` ist nicht Teil dieses Pakets. Kopierte Spurpayloads werden
geprüft; es gibt keine neue Audioqualitäts- oder Zeitstempelpolitik. Originale werden nicht wiederherstellbar
verwaltet. Benutzer müssen gewünschte Originale vorher separat aufbewahren.


## Nacharbeiten aus Abschnitt 7 der unabhängigen Prüfung

Arbeitsstand: weiterhin `main`, HEAD `8867f57288d9d1bd74751dfd4d4e84b649e479c9`, mit den erhaltenen Änderungen der
Erstimplementierung und der ergänzten Abnahme. Bereits gestagte Inhalte wurden nicht zurückgesetzt oder umgestagt.
Auch diese Nacharbeiten erfolgen ohne Subagents, Commit, Push oder Veröffentlichung. Die neuen Änderungen werden
vom implementierenden Lead-Agent geprüft; eine erneute unabhängige Abnahme wird nicht behauptet.

### Videospur: Reproduktion, Nachweise und Toleranzen

Vor der Korrektur wurden zwei echte Regressionstests in `test/preservation.integration.test.ts` ausgeführt.
Eine H.264-Quelle enthält 24 Frames bei 12 fps, 2 Sekunden Video und 2 Sekunden AAC-Audio. Eine gezielt erzeugte
Ausgabe enthält nur 6 Frames beziehungsweise 0,5 Sekunden Video; die AAC-Pakethashfolge bleibt identisch. Beide
Container melden weiterhin 2 Sekunden. Der direkte Test erwartete eine Ablehnung, erhielt aber keinen Fehler.
Im Prozessortest wurden fälschlich beide Dateien als verarbeitet gemeldet. Beide Tests waren damit zuerst rot.
Die absichtlich unvollständige Datei wird separat erzeugt; die Quelle wird dabei nicht verändert.

Die bestehende dekodierende `ffprobe -count_frames`-Abfrage liefert jetzt zusätzlich Frame-Zeitstempel und
Frame-Dauern. Daraus werden Beginn, spätestes Frameende relativ zum Containerstart, Framezahl, Zeitbasis und eine
CFR-Einschätzung gespeichert. Fehlende Zeitstempel, Dauern, Zeitbasis oder Containerstart, unplausible Werte,
nicht steigende Präsentationszeitstempel und Widersprüche zur gezählten Framezahl verhindern die Untersuchung.
Die Container-Gesamtdauer bleibt eine zusätzliche Prüfung; sie ersetzt die Videospur-Nachweise nicht.

CFR bedeutet hier: Frameabstände und Frame-Dauern stimmen mit `1 / frameRate` überein, innerhalb von zwei Ticks
der Zeitbasis plus 2 Mikrosekunden Dezimalrundung. Bei unveränderter konstanter Bildrate wird die dekodierte
Framezahl exakt erhalten. Ein Verlust trotz passend wirkender Randzeitstempel wird deshalb ebenfalls erkannt.

Für Bildratenreduktion und VFR gilt die bereits vorhandene FFmpeg-Operation mit `-r` weiter. Die erwartete
Ausgabezahl richtet sich nach dekodierter Quellabdeckung mal geplanter Zielrate, nicht nach der Quellframezahl.
Die Toleranz beträgt einen Frame weniger oder zwei Frames mehr, jeweils zuzüglich der Zeitbasis-Rundung.
Diese asymmetrische Grenze ist am bestehenden Werkzeugverhalten geprüft: Die bisherige Formatmatrix erzeugt aus
15 Frames bei 30 fps über 0,5 Sekunden 14 Frames bei 24 fps über etwa 0,583333 Sekunden statt rechnerisch 12 Frames.
Eine engere Rundungsannahme lehnte dieses unveränderte, bisher akzeptierte Ergebnis ab. Der Encoder wurde nicht
angepasst, um die Prüfung zu erfüllen.

Für die Randzeiten werden eine Ziel-Frameperiode Verschiebung am Anfang, eine Ziel-Frameperiode Verkürzung am Ende
und zwei Ziel-Frameperioden Verlängerung am Ende zugelassen. Hinzu kommen je ein Tick der Quell-/Zielzeitbasis und
2 Mikrosekunden für die Dezimalausgabe. Diese Grenzen erlauben die bestehende Synchronisierung am Zielraster;
sie erlauben keine pauschale Verkürzung proportional zur Containerdauer. Bei 12 fps liegt die Endverkürzungsgrenze
bei etwa 0,0835 Sekunden. Die reproduzierten 1,5 Sekunden fehlender Videospur werden sicher abgelehnt.

Ein echter VFR-Fall enthält 9 Frames mit ungleichen Abständen und der gemeldeten mittleren Rate 108/25 fps.
Die vorhandene Operation erzeugt 10 gleichmäßig verteilte Frames mit derselben Zielrate. Der neue Test bestätigt
die VFR-Erkennung, CFR-Ausgabe und zulässige Erhaltungsprüfung. Gleichheit der Framezahlen und identische
VFR-Zeitstempel werden hier ausdrücklich nicht vorausgesetzt. Nicht belegbare Zeitdaten werden nicht geschätzt.

Zusätzliche direkte Tests in `test/media/video-validation.test.ts` prüfen gültige Ausgaben, die verdeckte
Verkürzung, Verlust trotz gleicher Randzeiten, geplante Framezahlreduktion, Toleranzgrenzen, VFR, verschobenen
Spurbeginn, fehlende Nachweise sowie unverändert Geometrie-, Audio- und Textuntertitelverluste.
Der echte Prozessortest injiziert die unvollständige Mediendatei ausschließlich als temporäre Ausgabe. Jetzt
wird sie mit `transaction: validate: Video coverage ...` abgelehnt; SHA-256 und absichtlich gesetzte mtime der
Quelle sind unverändert. Die eigene temporäre Datei ist entfernt und die nächste Quelle wird erfolgreich verarbeitet.

### Teilframe-GIF: ausdrücklich sichere Ablehnung

Die CLI-Integration erzeugt eine echte optimierte GIF-Fixture mit diesen Eigenschaften:

| Frame | Rechteck | Canvas | Offset | Delay | Disposal |
| --- | --- | --- | --- | --- | --- |
| 1 | 1600 × 800 | 1600 × 800 | 0/0 | 0,1 s | None |
| 2 | 101 × 91 | 1600 × 800 | 10/10 | 0,2 s | Background |

Eine Kopie wird mit dem unveränderten `mogrify -strip -resize '1200x1200>'` bearbeitet. Das Werkzeug liefert eine
Canvas von 1200 × 600, aber weiterhin einen Teilframe von 101 × 91 bei Offset 10/10. Delay und Disposal bleiben
erhalten. Für eine einheitliche Skalierung mit Faktor 0,75 müssten auch der Teilframe und seine Position skaliert
werden. Die räumliche Zusammensetzung ist deshalb nicht als korrekt belegt. Vor der Änderung reproduzierte der
CLI-Test genau den gemeldeten Fehler `Image output does not preserve animation canvas`.

Die Validierung beurteilt nun die Quell-Canvas gemeinsam mit Rechteck und Offset. Bei notwendiger Verkleinerung
einer Animation mit Teilframes oder Offsets meldet sie ausdrücklich
`Partial-frame animation resizing cannot be validated safely with the existing operation`.
Die Prüfung wird nicht gelockert und es gibt keine neue Coalesce-/Optimierungsoperation. Der CLI-Test belegt
Quellhash, unveränderte mtime und vollständiges Cleanup der eigenen Ausgabe. Die Grenze steht auch in README.
Eine erfolgreiche Teilframe-Verkleinerung, der Vergleich zusammengesetzter Frames oder ein erfolgreicher zweiter
Lauf für diesen abgelehnten Fall wird nicht behauptet. Die bisherigen vollständigen GIF-/WebP-Frames und ihre
unveränderten Wiederholungsläufe bleiben Teil der positiven Formatmatrix.

### Bereinigungen aus Abschnitt 7.3

- Die beiden irreführenden Tag-Tests auf `inspectVideo`-Ebene sind entfernt. Die vorhandenen Probe-Tests prüfen
  jetzt tatsächliche Format-/Stream-Tags getrennt: technische Ausnahmen, relevante Titel und weiterhin relevante
  großgeschriebene MKV-Tags. Excluded-Stream-Klassifikation bleibt auf derselben Adaptergrenze geprüft.
- FFmpeg-Adaptertests liegen zusammen in `test/adapters.test.ts`. Die zweite Datei mit duplizierter
  Kommando-Rekonstruktion und wirkungslosem Originalmodul-Mock ist entfernt. Mehrere Audiospuren, Textuntertitel,
  fehlende Spuren, Mapping, CRF/Preset, Metadaten-/Kapitelentfernung und Containeroptionen bleiben abgedeckt.
- Nach Referenzprüfung ist `fast-glob` aus Manifest, Lockfile und Installation entfernt. Aktive Quellen und Tests
  verwendeten es bereits nicht mehr; historische Specs bleiben erhalten. Die begrenzte npm-Änderung entfernt
  genau 18 Pakete einschließlich `fast-glob`; ein strukturierter Lockfile-Vergleich zeigt keine hinzugefügten Pakete
  und keine Versions-/Integritätsänderungen verbleibender Pakete.
- Der FFmpeg-Adapter verwendet `VIDEO_CODEC` statt eines zweiten Encoderliterals. Der effektive Wert bleibt
  `libx264`; Qualitäts-, Preset-, Mapping- und Stripping-Optionen bleiben gleich.
- `FileResult` speichert nur noch `reason`. Die Entscheidungslisten der Inspektion bleiben erhalten; alle Gründe
  werden beim Ergebnis einmal in Text umgewandelt. Ein gezielter Test sichert mehrere Verarbeitungsgründe in
  Ergebnis und Fortschritt. Skip-Gründe und Fehlerphasen bleiben in den bisherigen echten CLI-Läufen abgedeckt.

### Abschlusschecks der Nacharbeiten

Am 16. Oktober 2026 vollständig ausgeführt, einschließlich des letzten gemeinsamen Laufs nach allen Codeänderungen:

| Prüfung | Tatsächliches Ergebnis |
| --- | --- |
| `npm run check` | TypeScript und Biome erfolgreich |
| `npm test` | 92 Tests in 13 Dateien erfolgreich, ohne ausgelassene Tests |
| `npm run build` | Erfolgreich, tsdown-Ziel weiterhin `node26` |
| Echte Formatmatrix, erster Lauf | Weiterhin 12 verarbeitet, 1 übersprungen, 0 Fehler |
| Echte Formatmatrix, zweiter Lauf | Weiterhin 13 Skips, identische SHA-256/mtime, keine Encoder-Aufrufe |
| Neue Video-Regression | Direkte und transaktionale Ablehnung; Hash/mtime/Cleanup/Fortsetzung belegt |
| Neue Teilframe-Regression | Ausdrückliche sichere Ablehnung; Hash/mtime/Cleanup belegt |
| Strukturierter Lockfile-Vergleich | 18 entfernte Pakete, 0 neue, keine übrigen Versions-/Integritätsänderungen |
| Referenz- und Diffprüfung | Kein aktives `fast-glob`; nur eine Encoderdefinition; `git diff --check` erfolgreich |

Die früheren 69 Tests werden nicht als unveränderte Anzahl fortgeschrieben: Drei doppelte beziehungsweise
irreführende Testfälle entfallen netto durch die Konsolidierung. Neue und erweiterte Nachweise ergeben 92 Tests.
Die bisherigen eigenständigen Medien-, Wiederholungs- und Fehlersicherheitsfälle bleiben erhalten.

Effektiv erneut geprüft: Node 26.11.1, npm 11.20.0, ImageMagick 7.1.2-34 und FFmpeg/ffprobe 9.0.2. Sämtliche
Node-/npm-Aufrufe verwenden die vorgegebenen Programme aus `~/.n/bin`. TypeScript 7.0.2, Biome 2.5.15,
Vitest 5.0.3 und tsdown 0.23.0 bleiben unverändert. `tsconfig.json` und `tsdown.config.ts` sind unverändert.
Die bekannte FFmpeg-Warnung zum absichtlich codec-freien Binäranhang erscheint weiterhin im Test und ist kein
fehlgeschlagener oder ausgelassener Nachweis.

Die bestehende MKV-/AVI-Metadatenpolitik ist unverändert. Teilframe-Verkleinerung wird sicher abgelehnt.
VFR wird nach dem bestehenden Resampling-Vertrag innerhalb der erläuterten Rastertoleranzen geprüft; exakte
zeitliche oder pixelweise Identität sämtlicher Quellframes ist kein neuer Vertrag. Fehlende Frame-Zeitnachweise
führen zur sicheren Ablehnung. Die bisherigen Grenzen für harte Abbrüche und gleichzeitige Änderungen gelten weiter.

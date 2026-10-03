# Agapovs PV-Planer

Dynamische Kostenplanung für PV-Anlagen auf Basis von `MK_37_Module.xlsx`.

## Starten

`index.html` direkt im Browser öffnen (Doppelklick). Es ist kein Build und keine Installation nötig.

Alternativ als lokaler Server:

```bash
python -m http.server 8765
```

Danach im Browser http://localhost:8765 öffnen.

## Funktionen

- **Konfigurationen:** „MK_37_Module“ ist die erste gespeicherte Konfiguration. Du kannst beliebig viele weitere anlegen, duplizieren, umbenennen (Name anklicken), laden und löschen. Alles wird automatisch im Browser gespeichert.
- **Module:** Anzahl über Eingabefeld, Pfeile (▲▼, Pfeiltasten, Mausrad, Gedrückthalten) oder Schieberegler. Das Maximum des Schiebereglers (Standard 100) stellst du in den Einstellungen ein.
- **Modulkatalog von solarhandel24.de:** Modultyp per Dropdown wählen. Leistung, Maße, Staffelpreise (ab 1/6/15/37 Stück) und Palettenpreis kommen live aus dem Shop. Der Katalog wird beim Öffnen automatisch aktualisiert, wenn er älter als eine Stunde ist. Offline gilt der zuletzt geladene Stand.
  - *Einzeln (Staffel):* Stückpreis je nach Menge
  - *Palette:* nur ganze Paletten (36 oder 37 Stück)
  - *Optimal:* die günstigste Kombination
  - Versand nach den echten solarhandel24-Versandkosten (Gewichtstabelle, gegen den Checkout geprüft): 1 Modul per Kurier 49 €, Spedition ab 69 €, 1 Palette AIKO 465 (906,5 kg) 169 €, ab 3 t Direkt-LKW. Die Tabelle lässt sich unter Einstellungen → Shops & Preise anpassen.
  - Über „Eigenes Modul (manuelle Eingabe)“ gehen weiterhin eigene Preise.
- **Wechselrichter:** Auswahl per Dropdown mit Vorschaubild. Die Bibliothek verwaltest du in den Einstellungen: anlegen, bearbeiten, Bild hochladen, Preis festlegen.
- **Online-Preise:** Preise lassen sich live aus Shopify-Shops abrufen (1asol.de, solarhandel24.de, weitere in den Einstellungen ergänzbar). Für andere Shops gibt es idealo-Links.
- **Montagesystem:** drei Modi
  - *Proportional (Excel):* hochgerechnet aus den Excel-Mengen
  - *Belegungsplan:* berechnet aus Reihen, Maßen, Schienenlänge und Hakenabstand
  - *Manuell*
- **Aufsparrendämmung:** Du wählst, wie viele Module auf Aufsparrendämmung sitzen. An diesen Modulen ersetzen Otto Lehmann Aufdachmodulhalter (7300 oder HVS 7302) die K2-Dachhaken im Verhältnis 1:1.
  - Pro Halter kommt eine Unischraube 5,0 × 70 mm für die Konterlatte dazu (Karton à 200 Stück).
  - Unter 119 € Warenwert berechnet dachbaustoffe.de einen Mindermengenzuschlag.
  - Die Preise sind einstellbar, Stand 03.10.2026 bei dachbaustoffe.de.
- **Montage:** `MAX(Mindestbetrag; €/kWp × RUNDEN(Module × Wp-Basis)/1000)`, wie in der Excel. €/kWp, Mindestbetrag und Wp-Basis sind einstellbar.
- **Live-Kostenaufteilung** (Donut und Positionsliste), Stückliste, CSV-Export und Druck/PDF.
- **Themes:** System, Hell, Dunkel, Material, Glass, Frost, iOS, Solar.
- **Export/Import:** einzelne Konfiguration oder komplettes Backup als JSON.

## Dateien

- `index.html`: Seitenstruktur
- `css/styles.css`: Layout und Themes
- `js/defaults.js`: Standardwerte aus der Excel und Wechselrichter-Bibliothek
- `js/app.js`: Berechnung, Oberfläche, Konfigurationen
- `js/charts.js`: Donut-Diagramm und Belegungsvorschau
- `js/shop.js`: Online-Preisabruf und Produktsuche

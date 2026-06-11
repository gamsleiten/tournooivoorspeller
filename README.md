# WK 2026 Predictor V4

GitHub Pages app met:
- lokale WK 2026 JSON
- lokale Elo ratings
- SportDB live data via hardcoded endpoint
- Polymarket Gamma markets voor toernooiwinstkansen
- baseline / werkelijk / projected standen
- baseline en live/projected kampioenskansen

## Upload
Wis je repo en upload alleen de inhoud van deze ZIP.

## SportDB
Vul je SportDB API-key in. Endpoint staat hardcoded:
https://api.sportdb.dev/api/flashscore/football

## Polymarket
Geen API-key nodig. Vul een zoekterm in, bijvoorbeeld:
world cup 2026 winner

De app zoekt via:
https://gamma-api.polymarket.com/markets

En probeert outcomes te matchen met teams in data/world-cup-2026.json.

## V5

- Toont expliciet N/A bij ontbrekende Polymarket-data.
- Probeert ook wedstrijdmarkten te herkennen.
- Tab Polymarket bevat per groepswedstrijd marktstatus en prijzen indien beschikbaar.

## V6

- Geen automatische berekening bij eerste paginalaad.
- Eerst API-key invullen, daarna handmatig op Genereer klikken.
- Genereer-knop wordt disabled tijdens berekenen.
- Standaard simulaties verlaagd naar 1000 voor snelle start.


## V7

- SportDB direct-call uit browser uitgezet; dit gaf CORS.
- Gebruik optioneel `sportdb-worker.js` als Cloudflare Worker proxy.
- De app vraagt nu om SportDB API-key + SportDB proxy URL.
- Groepswedstrijden tonen nu ook:
  - expected goals
  - modelkansen 1/X/2
  - exacte score
- De exacte score is de meest waarschijnlijke losse score, niet de gemiddelde uitkomst.


## V8

- Scoremodus toegevoegd:
  - Meest waarschijnlijk
  - Afgeronde xG
  - Realistische variant
- Variant seed toegevoegd, zodat de realistische variant stabiel blijft.
- Polymarket modus toegevoegd:
  - Search
  - Exact slug


## V8.1

Fix voor ontbrekende velden/cache: app crasht niet meer als browser nog oude HTML/controls heeft.


## V8.2

- Scoremodus staat nu gegarandeerd zichtbaar in de controls bovenaan.
- Header toont V8.2 zodat je ziet dat GitHub Pages de juiste versie serveert.

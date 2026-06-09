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

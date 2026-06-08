# WK Predictor - GitHub Pages V1

Statische HTML/JS-app voor GitHub Pages.

## Deploy

1. Upload alle bestanden naar een GitHub repo.
2. Zet repo public als Pages daarom vraagt.
3. Settings -> Pages -> Deploy from branch -> main / root.
4. Open de Pages URL.
5. Vul je API-Football key in. De key wordt opgeslagen in localStorage van jouw browser.

## Data

- API-Football: fixtures via `https://v3.football.api-sports.io/fixtures?league=...&season=...`
- Elo fallback in `elo.js`
- Model: Elo -> expected goals -> Poisson score -> groepsstand -> Monte Carlo kansen.

## Let op

De gratis API-Sports tier heeft 100 requests per dag. De app cachet fixtures 12 uur in localStorage.

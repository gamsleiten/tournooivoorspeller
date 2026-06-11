# WK 2026 Voorspeller V9

Schone V9 codebase.

## Upload naar GitHub Pages
Upload alleen deze bestanden/mappen naar je repo:

- index.html
- app.js
- styles.css
- .nojekyll
- data/world-cup-2026.json
- data/elo.json

## SportDB live data
SportDB blokkeert browser-calls via CORS. Gebruik daarom `sportdb-worker.js` als Cloudflare Worker.

1. Maak een Worker.
2. Plak `sportdb-worker.js`.
3. Vul je SportDB key in bij `SPORTDB_API_KEY`.
4. Deploy.
5. Plak de Worker URL in de app bij SportDB proxy URL.

## Polymarket
Geen key nodig. Gebruik Search of Exact slug.

## Let op
De WK 2026 data bevat placeholders. Werk `data/world-cup-2026.json` bij zodra teams/schema definitief zijn.

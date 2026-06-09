# WK 2026 Predictor V2

GitHub Pages app met lokale WK 2026 JSON, Elo, baseline/projected standings en optionele SportSRC live data.

Upload alleen deze bestanden:
- index.html
- app.js
- styles.css
- .nojekyll
- data/world-cup-2026.json
- data/elo.json

SportSRC is optioneel. Vul in de UI je API-key en endpoint in. Als SportSRC velden niet levert, blijven ze leeg. Als de API faalt, blijft de voorspeller werken op lokale JSON + Elo.

Let op: WK 2026 data bevat placeholders en kan in data/world-cup-2026.json worden aangepast zodra teams/schema definitief zijn.

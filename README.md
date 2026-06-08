# Tournament Predictor V1 - GitHub Pages

Statische voetbaltoernooi-voorspeller voor GitHub Pages.

## Wat doet deze versie?

- Draait volledig in de browser via GitHub Pages.
- Geen backend nodig.
- Je vult je Football-Data.org API-key eenmalig in de UI in.
- De key wordt opgeslagen in `localStorage` van jouw browser, niet in de GitHub repo.
- Polymarket gebruikt publieke marktdata zonder key.
- Zonder API-key kun je de demo-data gebruiken.
- Model: Polymarket/marktdata + Elo + vormfactor -> expected goals -> Poisson -> Monte Carlo.

## Installatie op GitHub Pages

1. Maak een nieuwe GitHub repository, bijvoorbeeld `tournament-predictor`.
2. Upload deze bestanden naar de root van de repo:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `README.md`
3. Ga in GitHub naar **Settings -> Pages**.
4. Kies **Deploy from a branch**.
5. Selecteer branch `main` en folder `/root`.
6. Open de GitHub Pages URL.
7. Klik op **Instellingen** en vul je Football-Data.org API-key in.
8. Klik **Opslaan** en daarna **Genereer voorspelling**.

## API-key veiligheid

De key staat niet in de code en wordt niet naar GitHub gepusht. Hij staat alleen lokaal in jouw browser via `localStorage`.

Let op: omdat de browser de request direct naar Football-Data doet, is je API-key zichtbaar in de browser devtools van jouw eigen sessie. Dat is normaal voor een volledig statische app.

## Model V1

1. Haal fixtures op via Football-Data.org.
2. Zoek relevante Polymarket-markten via de Gamma API.
3. Bereken Elo-kansen op basis van ingebouwde Elo fallback.
4. Combineer kansen met gewichten uit de instellingen.
5. Zet kansen om naar expected goals.
6. Bepaal meest waarschijnlijke score met Poisson.
7. Simuleer groepsfase en knock-out met Monte Carlo.

## Beperkingen V1

- Knock-out bracket gebruikt een generieke top-2-per-groep bracket.
- Beste nummers drie en officiële WK 2026 bracket-regels zijn nog niet volledig uitgewerkt.
- Vormfactor is nu nog een placeholder op basis van Elo.
- Polymarket-matchmatching is conservatief en kan markten missen.

## Aanbevolen V2

- Officiële WK 2026 bracketmapping toevoegen.
- Beste nummers drie correct verwerken.
- Real form-data toevoegen uit laatste interlands.
- Bookmaker odds-provider toevoegen als optionele bron.

<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>WK 2026 Predictor</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <header class="hero">
    <div>
      <p class="eyebrow">JSON-only · GitHub Pages ready</p>
      <h1>WK 2026 Predictor</h1>
      <p>Voorspel alle groepswedstrijden, eindstanden, knockout en kampioenskansen met Elo + Poisson + Monte Carlo.</p>
    </div>
    <button id="runBtn">Genereer voorspelling</button>
  </header>

  <main>
    <section class="panel controls">
      <div>
        <label>Toernooi</label>
        <select id="tournamentSelect"><option value="world-cup-2026">FIFA World Cup 2026</option></select>
      </div>
      <div>
        <label>Simulaties</label>
        <input id="simulations" type="number" min="100" max="50000" step="100" value="5000" />
      </div>
      <div>
        <label>Draw-factor groepsfase</label>
        <input id="drawFactor" type="number" min="0" max="0.6" step="0.01" value="0.25" />
      </div>
      <div>
        <label>Doelpuntenniveau</label>
        <input id="goalBase" type="number" min="1.6" max="3.4" step="0.1" value="2.6" />
      </div>
      <div class="hint">Alles komt uit <code>/data/world-cup-2026.json</code> en <code>/data/elo.json</code>. Pas die bestanden aan wanneer teams/Elo veranderen.</div>
    </section>

    <section class="tabs">
      <button class="tab active" data-tab="summary">Samenvatting</button>
      <button class="tab" data-tab="groups">Groepsfase</button>
      <button class="tab" data-tab="knockout">Knock-out</button>
      <button class="tab" data-tab="chances">Kansen</button>
      <button class="tab" data-tab="data">Data</button>
    </section>

    <section id="summary" class="panel tabPanel active"></section>
    <section id="groups" class="panel tabPanel"></section>
    <section id="knockout" class="panel tabPanel"></section>
    <section id="chances" class="panel tabPanel"></section>
    <section id="data" class="panel tabPanel"></section>
  </main>

  <footer>
    <small>Model: Elo -> expected goals -> Poisson-score. Monte Carlo gebruikt dezelfde scoreverdeling en tiebreakers op punten, doelsaldo, goals voor en Elo.</small>
  </footer>
  <script src="app.js"></script>
</body>
</html>

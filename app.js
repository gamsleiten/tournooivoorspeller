const API_BASE = 'https://v3.football.api-sports.io';
const $ = (id) => document.getElementById(id);

const state = { fixtures: [], groups: {}, predictions: [], standings: {}, chances: [] };

function setStatus(msg, type='') {
  const el = $('status'); el.textContent = msg; el.className = 'status ' + type;
}

function loadSettings() {
  $('apiKey').value = localStorage.getItem('apiFootballKey') || '';
  $('simulations').value = localStorage.getItem('simulations') || '10000';
  $('tournament').value = localStorage.getItem('tournament') || '1:2026';
}
function saveSettings() {
  localStorage.setItem('apiFootballKey', $('apiKey').value.trim());
  localStorage.setItem('simulations', $('simulations').value);
  localStorage.setItem('tournament', $('tournament').value);
  setStatus('Instellingen opgeslagen.', 'ok');
}

async function apiFetch(path, cacheKey, ttlMs = 12 * 60 * 60 * 1000) {
  const key = localStorage.getItem('apiFootballKey');
  if (!key) throw new Error('Geen API-key opgeslagen.');
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    const obj = JSON.parse(cached);
    if (Date.now() - obj.time < ttlMs) return obj.data;
  }
  const res = await fetch(API_BASE + path, { headers: { 'x-apisports-key': key } });
  if (!res.ok) throw new Error(`API fout ${res.status}`);
  const json = await res.json();
  if (json.errors && Object.keys(json.errors).length) throw new Error(JSON.stringify(json.errors));
  localStorage.setItem(cacheKey, JSON.stringify({ time: Date.now(), data: json.response }));
  return json.response;
}

function elo(teamName) {
  if (!teamName) return 1600;
  const ratings = window.ELO_RATINGS || {};
  if (ratings[teamName]) return ratings[teamName];
  const found = Object.keys(ratings).find(k => teamName.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(teamName.toLowerCase()));
  return found ? ratings[found] : 1600;
}

function expectedGoals(homeElo, awayElo) {
  const diff = Math.max(-450, Math.min(450, homeElo - awayElo));
  const total = 2.55;
  const share = 1 / (1 + Math.pow(10, -diff / 400));
  const home = Math.max(0.25, total * (0.38 + 0.24 * share));
  const away = Math.max(0.25, total - home);
  return [home, away];
}
function poisson(lambda, k) { return Math.exp(-lambda) * Math.pow(lambda, k) / factorial(k); }
function factorial(n) { let r=1; for(let i=2;i<=n;i++) r*=i; return r; }
function bestScore(lh, la) {
  let best = {h:0,a:0,p:-1};
  for (let h=0; h<=6; h++) for (let a=0; a<=6; a++) {
    const p = poisson(lh,h) * poisson(la,a);
    if (p > best.p) best = {h,a,p};
  }
  return best;
}
function sampleGoals(lambda) {
  let L = Math.exp(-lambda), k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
}

function normalizeFixture(f) {
  return {
    id: f.fixture.id,
    date: f.fixture.date,
    round: f.league.round || '',
    venue: f.fixture.venue?.name || '',
    group: extractGroup(f.league.round || ''),
    home: f.teams.home.name,
    away: f.teams.away.name,
    played: f.fixture.status?.short === 'FT',
    goalsHome: f.goals.home,
    goalsAway: f.goals.away
  };
}
function extractGroup(round) {
  const m = round.match(/Group\s+([A-L])/i);
  return m ? m[1].toUpperCase() : '';
}

async function loadFixtures() {
  const [league, season] = $('tournament').value.split(':');
  const response = await apiFetch(`/fixtures?league=${league}&season=${season}`, `fixtures_${league}_${season}`);
  const fixtures = response.map(normalizeFixture).filter(f => f.home && f.away);
  state.fixtures = fixtures;
  return fixtures;
}

function predictFixtures(fixtures) {
  return fixtures.map(f => {
    const eh = elo(f.home), ea = elo(f.away);
    const [xh, xa] = expectedGoals(eh, ea);
    const s = f.played && Number.isInteger(f.goalsHome) ? {h:f.goalsHome,a:f.goalsAway,p:1} : bestScore(xh, xa);
    return {...f, eloHome: eh, eloAway: ea, xh, xa, predHome: s.h, predAway: s.a, scoreProb: s.p};
  });
}

function buildStandings(predictions, sampled=false) {
  const table = {};
  const add = t => table[t] ||= {team:t, p:0,w:0,d:0,l:0,gf:0,ga:0,gd:0,pts:0};
  for (const m of predictions.filter(x => x.group)) {
    add(m.home); add(m.away);
    const hg = sampled ? m.simHome : m.predHome, ag = sampled ? m.simAway : m.predAway;
    const H = table[m.home], A = table[m.away];
    H.p++; A.p++; H.gf+=hg; H.ga+=ag; A.gf+=ag; A.ga+=hg; H.gd=H.gf-H.ga; A.gd=A.gf-A.ga;
    if (hg > ag) { H.w++; A.l++; H.pts+=3; }
    else if (hg < ag) { A.w++; H.l++; A.pts+=3; }
    else { H.d++; A.d++; H.pts++; A.pts++; }
  }
  const groups = {};
  for (const m of predictions.filter(x => x.group)) {
    groups[m.group] ||= new Set(); groups[m.group].add(m.home); groups[m.group].add(m.away);
  }
  const out = {};
  for (const [g, teams] of Object.entries(groups)) {
    out[g] = [...teams].map(t => table[t]).sort((a,b)=> b.pts-a.pts || b.gd-a.gd || b.gf-a.gf || elo(b.team)-elo(a.team));
  }
  return out;
}

function monteCarlo(predictions, n) {
  const teams = [...new Set(predictions.flatMap(m => [m.home, m.away]))];
  const counts = Object.fromEntries(teams.map(t => [t, {team:t, groupWinner:0, top2:0}]));
  const groupMatches = predictions.filter(m => m.group);
  for (let i=0; i<n; i++) {
    const sim = groupMatches.map(m => ({...m, simHome: sampleGoals(m.xh), simAway: sampleGoals(m.xa)}));
    const st = buildStandings(sim, true);
    for (const rows of Object.values(st)) {
      if (rows[0]) counts[rows[0].team].groupWinner++;
      if (rows[0]) counts[rows[0].team].top2++;
      if (rows[1]) counts[rows[1].team].top2++;
    }
  }
  return Object.values(counts).map(c => ({...c, groupWinnerPct: c.groupWinner/n*100, top2Pct: c.top2/n*100})).sort((a,b)=>b.groupWinnerPct-a.groupWinnerPct);
}

function renderFixtures(predictions) {
  $('fixtures').innerHTML = `<table><thead><tr><th>Datum</th><th>Ronde</th><th>Wedstrijd</th><th>Elo</th><th>xG</th><th>Voorspelling</th></tr></thead><tbody>` +
    predictions.map(m => `<tr><td>${new Date(m.date).toLocaleDateString('nl-NL')}</td><td><span class="badge">${m.round}</span></td><td>${m.home} - ${m.away}</td><td>${m.eloHome} - ${m.eloAway}</td><td>${m.xh.toFixed(2)} - ${m.xa.toFixed(2)}</td><td><b>${m.predHome}-${m.predAway}</b></td></tr>`).join('') +
    `</tbody></table>`;
}
function renderGroups(groups) {
  $('groups').innerHTML = Object.entries(groups).sort().map(([g, rows]) => `<h3>Groep ${g}</h3><table><thead><tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>G</th><th>V</th><th>DV</th><th>DT</th><th>DS</th><th>Pt</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td>${i+1}</td><td>${r.team}</td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.gf}</td><td>${r.ga}</td><td>${r.gd}</td><td><b>${r.pts}</b></td></tr>`).join('')}</tbody></table>`).join('') || 'Geen groepsdata gevonden in API-response.';
}
function renderChances(chances) {
  $('chances').innerHTML = `<table><thead><tr><th>Team</th><th>Groepswinnaar</th><th>Top 2</th></tr></thead><tbody>` + chances.map(c => `<tr><td>${c.team}</td><td>${c.groupWinnerPct.toFixed(1)}%</td><td>${c.top2Pct.toFixed(1)}%</td></tr>`).join('') + `</tbody></table>`;
}
function renderDebug(data) { $('debug').innerHTML = `<pre>${JSON.stringify(data, null, 2).slice(0, 20000)}</pre>`; }

async function run() {
  try {
    saveSettings();
    setStatus('Data ophalen...', '');
    const fixtures = await loadFixtures();
    if (!fixtures.length) throw new Error('Geen wedstrijden gevonden. Check league/season of je API-plan.');
    setStatus(`${fixtures.length} wedstrijden gevonden. Voorspelling draaien...`, 'ok');
    const predictions = predictFixtures(fixtures);
    const standings = buildStandings(predictions);
    const chances = monteCarlo(predictions, Math.max(100, parseInt($('simulations').value || '10000')));
    state.predictions = predictions; state.standings = standings; state.chances = chances;
    renderFixtures(predictions); renderGroups(standings); renderChances(chances); renderDebug({sampleFixture: fixtures[0], count: fixtures.length, cacheKeys: Object.keys(localStorage).filter(k=>k.startsWith('fixtures_'))});
    setStatus('Klaar.', 'ok');
  } catch (e) {
    setStatus(e.message, 'error');
    renderDebug({error:e.message, hint:'Controleer API-key, league id, season en CORS. API-Football ondersteunt browsercalls meestal, maar sommige plannen/instellingen kunnen verschillen.'});
  }
}

document.querySelectorAll('.tabs button').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('.tabs button').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  btn.classList.add('active'); $(btn.dataset.tab).classList.add('active');
}));
$('saveBtn').addEventListener('click', saveSettings);
$('runBtn').addEventListener('click', run);
loadSettings();

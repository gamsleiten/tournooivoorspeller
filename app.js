/* Tournament Predictor V1 - static browser app */
const $ = (id) => document.getElementById(id);
const state = { settings: {}, fixtures: [], predictions: [], groups: {}, bracket: [], championOdds: {}, polyMarkets: [] };

const DEFAULT_ELO = {
  Netherlands:1961, Japan:1906, Sweden:1714, Tunisia:1633, France:2081, Spain:2165, Germany:1925, Belgium:1888,
  England:2040, Portugal:1995, Argentina:2120, Brazil:2070, Uruguay:1945, Croatia:1870, Morocco:1840, USA:1785,
  Mexico:1765, Canada:1710, Switzerland:1815, Senegal:1795, Norway:1760, Colombia:1830, Ghana:1660, Panama:1540,
  Qatar:1580, Australia:1690, Paraguay:1725, Ecuador:1810, "Ivory Coast":1700, Iran:1765, Egypt:1705, "New Zealand":1505,
  Austria:1810, Algeria:1685, Jordan:1460, Uzbekistan:1625, "Saudi Arabia":1620, "South Korea":1800, "South Africa":1605,
  Scotland:1720, Haiti:1390, "Cape Verde":1585, Curaçao:1490
};

const DEMO_FIXTURES = [
  {id:'F1', group:'F', utcDate:'2026-06-14', homeTeam:{name:'Netherlands'}, awayTeam:{name:'Japan'}},
  {id:'F2', group:'F', utcDate:'2026-06-14', homeTeam:{name:'Sweden'}, awayTeam:{name:'Tunisia'}},
  {id:'F3', group:'F', utcDate:'2026-06-19', homeTeam:{name:'Netherlands'}, awayTeam:{name:'Sweden'}},
  {id:'F4', group:'F', utcDate:'2026-06-19', homeTeam:{name:'Tunisia'}, awayTeam:{name:'Japan'}},
  {id:'F5', group:'F', utcDate:'2026-06-24', homeTeam:{name:'Japan'}, awayTeam:{name:'Sweden'}},
  {id:'F6', group:'F', utcDate:'2026-06-24', homeTeam:{name:'Tunisia'}, awayTeam:{name:'Netherlands'}},
  {id:'E1', group:'E', utcDate:'2026-06-15', homeTeam:{name:'Germany'}, awayTeam:{name:'Ecuador'}},
  {id:'E2', group:'E', utcDate:'2026-06-15', homeTeam:{name:'Ivory Coast'}, awayTeam:{name:'Curaçao'}},
  {id:'E3', group:'E', utcDate:'2026-06-20', homeTeam:{name:'Germany'}, awayTeam:{name:'Ivory Coast'}},
  {id:'E4', group:'E', utcDate:'2026-06-20', homeTeam:{name:'Curaçao'}, awayTeam:{name:'Ecuador'}},
  {id:'E5', group:'E', utcDate:'2026-06-25', homeTeam:{name:'Ecuador'}, awayTeam:{name:'Ivory Coast'}},
  {id:'E6', group:'E', utcDate:'2026-06-25', homeTeam:{name:'Curaçao'}, awayTeam:{name:'Germany'}}
];

function loadSettings(){
  state.settings = {
    footballDataKey: localStorage.getItem('footballDataKey') || '',
    polymarketQuery: localStorage.getItem('polymarketQuery') || 'world cup 2026',
    polyWeight: parseFloat(localStorage.getItem('polyWeight') || '0.50'),
    eloWeight: parseFloat(localStorage.getItem('eloWeight') || '0.30'),
    formWeight: parseFloat(localStorage.getItem('formWeight') || '0.20'),
    simulations: parseInt(localStorage.getItem('simulations') || '10000', 10)
  };
  for(const k of Object.keys(state.settings)) if($(k)) $(k).value = state.settings[k];
}
function saveSettings(){
  for(const id of ['footballDataKey','polymarketQuery','polyWeight','eloWeight','formWeight','simulations']) localStorage.setItem(id, $(id).value);
  loadSettings(); setStatus('Instellingen opgeslagen.');
}
function clearSettings(){ localStorage.clear(); loadSettings(); setStatus('Instellingen gewist.'); }
function setStatus(msg){ $('status').textContent = msg; }
function esc(s){return String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}

async function fetchFootballData(){
  const key = state.settings.footballDataKey;
  if(!key) throw new Error('Geen Football-Data API key ingesteld. Gebruik demo-data of vul je key in.');
  const comp = $('competition').value;
  const season = $('season').value;
  const url = `https://api.football-data.org/v4/competitions/${encodeURIComponent(comp)}/matches?season=${encodeURIComponent(season)}`;
  const res = await fetch(url, { headers: { 'X-Auth-Token': key }});
  if(!res.ok) throw new Error(`Football-Data fout ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return normalizeFootballDataMatches(data.matches || []);
}
function normalizeFootballDataMatches(matches){
  return matches.map(m => ({
    id: m.id,
    group: groupFromStage(m.group || m.stage || m.matchday),
    stage: m.stage,
    utcDate: m.utcDate,
    homeTeam: { name: m.homeTeam?.name || m.homeTeam?.shortName || 'TBD' },
    awayTeam: { name: m.awayTeam?.name || m.awayTeam?.shortName || 'TBD' },
    raw: m
  })).filter(m => m.homeTeam.name !== 'TBD' && m.awayTeam.name !== 'TBD');
}
function groupFromStage(x){
  const s = String(x || 'GROUP').toUpperCase();
  const m = s.match(/GROUP[_\s-]?([A-L])/); return m ? m[1] : (s.length === 1 ? s : 'Group');
}

async function fetchPolymarketMarkets(){
  const q = state.settings.polymarketQuery || 'world cup 2026';
  try{
    const url = `https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=200&search=${encodeURIComponent(q)}`;
    const res = await fetch(url);
    if(!res.ok) throw new Error(`Polymarket ${res.status}`);
    state.polyMarkets = await res.json();
  }catch(err){
    console.warn(err); state.polyMarkets = [];
  }
}
function getMarketSignal(home, away){
  const hay = `${home} ${away}`.toLowerCase();
  const market = state.polyMarkets.find(m => (`${m.question||''} ${m.slug||''} ${m.description||''}`).toLowerCase().includes(home.toLowerCase()) && (`${m.question||''} ${m.slug||''} ${m.description||''}`).toLowerCase().includes(away.toLowerCase()));
  if(!market) return null;
  // Try to infer binary prices. If not a direct match market, return null conservatively.
  let outcomes = parseJsonish(market.outcomes), prices = parseJsonish(market.outcomePrices);
  if(!Array.isArray(outcomes) || !Array.isArray(prices)) return null;
  const idxH = outcomes.findIndex(o => String(o).toLowerCase().includes(home.toLowerCase()));
  const idxA = outcomes.findIndex(o => String(o).toLowerCase().includes(away.toLowerCase()));
  const ph = idxH >= 0 ? parseFloat(prices[idxH]) : NaN;
  const pa = idxA >= 0 ? parseFloat(prices[idxA]) : NaN;
  if(Number.isFinite(ph) && Number.isFinite(pa)) return normalize3(ph, Math.max(0.08, 1 - ph - pa), pa);
  return null;
}
function parseJsonish(v){ if(Array.isArray(v)) return v; try{return JSON.parse(v)}catch{return null} }

function eloExpected(home, away){
  const eh = DEFAULT_ELO[home] || 1600, ea = DEFAULT_ELO[away] || 1600;
  const pHomeNoDraw = 1/(1+Math.pow(10, -(eh-ea)/400));
  const draw = Math.max(0.18, 0.30 - Math.abs(eh-ea)/2000);
  const h = pHomeNoDraw * (1-draw), a = (1-pHomeNoDraw) * (1-draw);
  return normalize3(h, draw, a);
}
function normalize3(h,d,a){ const s=h+d+a; return {home:h/s, draw:d/s, away:a/s}; }
function blendProbs(elo, market){
  const wP = market ? state.settings.polyWeight : 0;
  const wE = state.settings.eloWeight + (!market ? state.settings.polyWeight : 0);
  const wF = state.settings.formWeight;
  const form = elo; // V1 placeholder: form equals Elo until real form API is added.
  const s = wP + wE + wF;
  return normalize3(
    ((market?.home||0)*wP + elo.home*wE + form.home*wF)/s,
    ((market?.draw||0)*wP + elo.draw*wE + form.draw*wF)/s,
    ((market?.away||0)*wP + elo.away*wE + form.away*wF)/s
  );
}
function probsToXg(p){
  const strength = p.home - p.away;
  const drawTendency = p.draw;
  const total = clamp(2.35 + (0.26 - drawTendency)*2.2, 1.6, 3.6);
  const diff = clamp(strength * 2.1, -2.2, 2.2);
  return { home: clamp(total/2 + diff/2, 0.25, 3.8), away: clamp(total/2 - diff/2, 0.25, 3.8) };
}
function clamp(x,a,b){return Math.max(a, Math.min(b, x));}
function poisson(lambda, k){return Math.exp(-lambda) * Math.pow(lambda,k) / factorial(k);}
const facts=[1,1,2,6,24,120,720,5040,40320,362880]; function factorial(k){return facts[k] || k*facts[k-1];}
function scoreFromXg(xg){
  let best={h:0,a:0,p:-1};
  for(let h=0;h<=6;h++) for(let a=0;a<=6;a++){ const p=poisson(xg.home,h)*poisson(xg.away,a); if(p>best.p) best={h,a,p}; }
  return best;
}
function sampleGoals(lambda){
  let L=Math.exp(-lambda), k=0, p=1; do{k++; p*=Math.random();}while(p>L); return k-1;
}

function predictFixture(f){
  const home=f.homeTeam.name, away=f.awayTeam.name;
  const elo=eloExpected(home,away), market=getMarketSignal(home,away), probs=blendProbs(elo,market), xg=probsToXg(probs), score=scoreFromXg(xg);
  return {...f, home, away, elo, market, probs, xg, predHome:score.h, predAway:score.a, scoreProb:score.p};
}
function buildTables(preds){
  const groups={};
  for(const p of preds){
    const g=p.group || 'Group'; groups[g] ??= {};
    for(const t of [p.home,p.away]) groups[g][t] ??= {team:t,p:0,w:0,d:0,l:0,gf:0,ga:0,gd:0,pts:0};
    applyResult(groups[g], p.home, p.away, p.predHome, p.predAway);
  }
  return Object.fromEntries(Object.entries(groups).map(([g,t]) => [g, Object.values(t).sort((a,b)=>b.pts-a.pts||b.gd-a.gd||b.gf-a.gf||a.team.localeCompare(b.team))]));
}
function applyResult(table, h, a, hg, ag){
  const H=table[h], A=table[a]; H.p++; A.p++; H.gf+=hg; H.ga+=ag; A.gf+=ag; A.ga+=hg; H.gd=H.gf-H.ga; A.gd=A.gf-A.ga;
  if(hg>ag){H.w++;A.l++;H.pts+=3}else if(hg<ag){A.w++;H.l++;A.pts+=3}else{H.d++;A.d++;H.pts++;A.pts++}
}
function simulateTournament(preds, n){
  const wins={}; let lastBracket=[];
  for(let i=0;i<n;i++){
    const groupTables={};
    for(const p of preds){
      groupTables[p.group] ??= {}; for(const t of [p.home,p.away]) groupTables[p.group][t] ??= {team:t,p:0,w:0,d:0,l:0,gf:0,ga:0,gd:0,pts:0};
      const hg=sampleGoals(p.xg.home), ag=sampleGoals(p.xg.away); applyResult(groupTables[p.group], p.home, p.away, hg, ag);
    }
    const ranked = Object.fromEntries(Object.entries(groupTables).map(([g,t])=>[g,Object.values(t).sort((a,b)=>b.pts-a.pts||b.gd-a.gd||b.gf-a.gf||Math.random()-.5)]));
    const qualifiers = Object.entries(ranked).flatMap(([g,arr]) => arr.slice(0,2).map((row,idx)=>({team:row.team, seed:`${idx+1}${g}`})));
    const bracket = simulateBracket(qualifiers, preds);
    lastBracket=bracket.rounds; wins[bracket.champion]=(wins[bracket.champion]||0)+1;
  }
  return {odds:Object.fromEntries(Object.entries(wins).sort((a,b)=>b[1]-a[1]).map(([k,v])=>[k,v/n])), bracket:lastBracket};
}
function simulateBracket(teams, preds){
  let current=teams.map(x=>x.team); const rounds=[];
  while(current.length>1){
    const games=[], next=[];
    for(let i=0;i<current.length;i+=2){
      const h=current[i], a=current[i+1] || current[0]; const fake={homeTeam:{name:h},awayTeam:{name:a},group:'KO'}; const p=predictFixture(fake);
      let hg=sampleGoals(p.xg.home), ag=sampleGoals(p.xg.away); if(hg===ag){ if(Math.random()<p.probs.home/(p.probs.home+p.probs.away)) hg++; else ag++; }
      const winner=hg>ag?h:a; games.push({home:h,away:a,hg,ag,winner}); next.push(winner);
    }
    rounds.push(games); current=next;
  }
  return {champion:current[0], rounds};
}

async function run(useDemo=false){
  try{
    loadSettings(); setStatus('Data ophalen...');
    state.fixtures = useDemo ? DEMO_FIXTURES : await fetchFootballData();
    await fetchPolymarketMarkets();
    setStatus('Voorspellingen berekenen...');
    state.predictions = state.fixtures.filter(f => (f.group || '').match(/^[A-LFGE]$|Group/)).map(predictFixture);
    if(!state.predictions.length) throw new Error('Geen groepswedstrijden gevonden. Probeer demo-data of controleer toernooi/seizoen.');
    state.groups = buildTables(state.predictions);
    const sim = simulateTournament(state.predictions, state.settings.simulations);
    state.championOdds = sim.odds; state.bracket = sim.bracket;
    renderAll(); setStatus(`Klaar: ${state.predictions.length} wedstrijden, ${state.settings.simulations.toLocaleString('nl-NL')} simulaties.`);
  }catch(err){ setStatus(err.message); console.error(err); }
}

function renderAll(){ renderMatches(); renderGroups(); renderKnockout(); renderOdds(); renderDebug(); }
function renderMatches(){
  $('matches').innerHTML = `<h2>Voorspelde groepswedstrijden</h2><table><thead><tr><th>Groep</th><th>Wedstrijd</th><th>Kans 1-X-2</th><th>xG</th><th>Uitslag</th></tr></thead><tbody>${state.predictions.map(p=>`<tr><td>${esc(p.group)}</td><td>${esc(p.home)} - ${esc(p.away)}<br><span class="small">${esc((p.utcDate||'').slice(0,10))}</span></td><td>${pct(p.probs.home)} - ${pct(p.probs.draw)} - ${pct(p.probs.away)} ${p.market?'<span class="pill">markt</span>':'<span class="pill">Elo</span>'}</td><td>${p.xg.home.toFixed(2)} - ${p.xg.away.toFixed(2)}</td><td class="score">${p.predHome}-${p.predAway}</td></tr>`).join('')}</tbody></table>`;
}
function renderGroups(){
  $('groups').innerHTML = `<h2>Voorspelde eindstanden</h2>` + Object.entries(state.groups).sort().map(([g,rows])=>`<h3>Groep ${esc(g)}</h3><table><thead><tr><th>#</th><th>Team</th><th>Pnt</th><th>W</th><th>G</th><th>V</th><th>DV-DT</th><th>DS</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.team)}</td><td><b>${r.pts}</b></td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.gf}-${r.ga}</td><td>${r.gd}</td></tr>`).join('')}</tbody></table>`).join('');
}
function renderKnockout(){
  $('knockout').innerHTML = `<h2>Voorbeeld knock-out bracket uit laatste simulatie</h2><p class="hint">V1 vult top-2 per groep in en simuleert een generieke bracket. Officiële WK 2026 beste-nummers-3-regels kunnen in V2 preciezer worden toegevoegd.</p><div class="bracket">${state.bracket.map((round,i)=>`<div class="round"><h3>Ronde ${i+1}</h3>${round.map(g=>`<div class="game"><div>${esc(g.home)} <b>${g.hg}</b></div><div>${esc(g.away)} <b>${g.ag}</b></div><div class="winner">Winnaar: ${esc(g.winner)}</div></div>`).join('')}</div>`).join('')}</div>`;
}
function renderOdds(){
  const rows=Object.entries(state.championOdds).sort((a,b)=>b[1]-a[1]);
  $('odds').innerHTML = `<h2>Kampioenskansen</h2><table><thead><tr><th>#</th><th>Team</th><th>Kans</th></tr></thead><tbody>${rows.map(([t,p],i)=>`<tr><td>${i+1}</td><td>${esc(t)}</td><td>${pct(p)}</td></tr>`).join('')}</tbody></table>`;
}
function renderDebug(){
  $('debug').innerHTML = `<h2>Debug</h2><pre>${esc(JSON.stringify({settings:{...state.settings,footballDataKey: state.settings.footballDataKey?'***':''}, fixtures:state.fixtures.length, polymarketMarkets:state.polyMarkets.length}, null, 2))}</pre>`;
}
function pct(x){return `${(x*100).toFixed(1)}%`;}

function init(){
  loadSettings(); if(!state.settings.footballDataKey) $('settingsPanel').classList.remove('hidden');
  $('settingsBtn').onclick=()=> $('settingsPanel').classList.toggle('hidden');
  $('saveSettings').onclick=saveSettings; $('clearSettings').onclick=clearSettings;
  $('runBtn').onclick=()=>run(false); $('demoBtn').onclick=()=>run(true);
  document.querySelectorAll('.tab').forEach(btn=>btn.onclick=()=>{document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));btn.classList.add('active');document.querySelectorAll('.tabpage').forEach(p=>p.classList.add('hidden'));$(btn.dataset.tab).classList.remove('hidden');});
  run(true);
}
document.addEventListener('DOMContentLoaded', init);

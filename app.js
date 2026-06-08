
const qs = s => document.querySelector(s);
const pct = x => `${(100 * x).toFixed(1)}%`;
let tournament, elo;

function factorial(n){ let r=1; for(let i=2;i<=n;i++) r*=i; return r; }
function poisson(lambda,k){ return Math.exp(-lambda) * Math.pow(lambda,k) / factorial(k); }
function teamName(code){ return tournament.teams[code]?.name || code; }
function rating(code){ return elo[code] || tournament.teams[code]?.elo || 1600; }

async function loadData(){
  const [t,e] = await Promise.all([
    fetch("data/world-cup-2026.json").then(r => {
      if(!r.ok) throw new Error("Kan data/world-cup-2026.json niet laden");
      return r.json();
    }),
    fetch("data/elo.json").then(r => {
      if(!r.ok) throw new Error("Kan data/elo.json niet laden");
      return r.json();
    })
  ]);
  tournament = t;
  elo = e.ratings || {};
}

function expectedGoals(home, away, knockout=false){
  const diff = rating(home) - rating(away);
  const goalBase = Number(qs("#goalBase").value || 2.6) + (knockout ? -0.15 : 0);
  const adv = Math.max(-1.25, Math.min(1.25, diff / 300));
  return [
    Math.max(0.15, goalBase/2 + adv*0.55),
    Math.max(0.15, goalBase/2 - adv*0.55)
  ];
}

function scoreMatrix(home, away, knockout=false){
  const [h,a] = expectedGoals(home, away, knockout);
  const rows = [];
  let total = 0;
  for(let hg=0; hg<=7; hg++){
    for(let ag=0; ag<=7; ag++){
      const p = poisson(h,hg) * poisson(a,ag);
      rows.push({hg,ag,p});
      total += p;
    }
  }
  rows.forEach(r => r.p /= total);
  rows.sort((x,y) => y.p - x.p);
  return rows;
}

function pickMostLikely(home, away, knockout=false){
  return scoreMatrix(home, away, knockout)[0];
}

function sampleScore(home, away, knockout=false){
  const rows = scoreMatrix(home, away, knockout);
  let r = Math.random();
  for(const row of rows){
    r -= row.p;
    if(r <= 0) return row;
  }
  return rows[rows.length-1];
}

function blankTable(group){
  return tournament.groups[group].map(team => ({
    team, group, p:0, w:0, d:0, l:0, gf:0, ga:0, gd:0, pts:0
  }));
}

function addResult(table, home, away, hg, ag){
  const h = table.find(x => x.team === home);
  const a = table.find(x => x.team === away);
  h.p++; a.p++;
  h.gf += hg; h.ga += ag;
  a.gf += ag; a.ga += hg;
  h.gd = h.gf - h.ga;
  a.gd = a.gf - a.ga;
  if(hg > ag){ h.w++; a.l++; h.pts += 3; }
  else if(hg < ag){ a.w++; h.l++; a.pts += 3; }
  else { h.d++; a.d++; h.pts++; a.pts++; }
}

function compareRows(a,b){
  return (b.pts-a.pts) || (b.gd-a.gd) || (b.gf-a.gf) || (rating(b.team)-rating(a.team));
}

function deterministicGroups(){
  const standings = {};
  const predictions = [];
  Object.keys(tournament.groups).forEach(g => standings[g] = blankTable(g));
  for(const m of tournament.groupMatches){
    const s = pickMostLikely(m.home, m.away, false);
    predictions.push({...m, hg:s.hg, ag:s.ag, prob:s.p});
    addResult(standings[m.group], m.home, m.away, s.hg, s.ag);
  }
  Object.keys(standings).forEach(g => standings[g].sort(compareRows));
  return {standings,predictions};
}

function bestThirds(standings){
  return Object.values(standings).map(rows => rows[2]).sort(compareRows).slice(0,8);
}

function resolveRef(ref, standings, winners, thirds, usedThirds){
  if(ref.kind === "pos") return standings[ref.group][ref.pos-1].team;
  if(ref.kind === "winner") return winners[ref.match];
  if(ref.kind === "third"){
    const options = thirds.filter(t => ref.groups.includes(t.group) && !usedThirds.has(t.team)).sort(compareRows);
    const chosen = options[0] || thirds.find(t => !usedThirds.has(t.team)) || thirds[0];
    if(chosen) usedThirds.add(chosen.team);
    return chosen ? chosen.team : "TBD";
  }
  return "TBD";
}

function knockoutFromStandings(standings, stochastic=false){
  const thirds = bestThirds(standings);
  const usedThirds = new Set();
  const winners = {};
  const matches = [];
  for(const m of tournament.knockout){
    const home = resolveRef(m.home, standings, winners, thirds, usedThirds);
    const away = resolveRef(m.away, standings, winners, thirds, usedThirds);
    const s = stochastic ? sampleScore(home, away, true) : pickMostLikely(home, away, true);
    let winner;
    if(s.hg !== s.ag) winner = s.hg > s.ag ? home : away;
    else {
      const pHome = 1 / (1 + Math.pow(10, -(rating(home)-rating(away))/400));
      winner = stochastic ? (Math.random() < pHome ? home : away) : (pHome >= 0.5 ? home : away);
    }
    winners[m.id] = winner;
    matches.push({...m, homeTeam:home, awayTeam:away, hg:s.hg, ag:s.ag, winner});
  }
  return {matches, winner:winners.F1 || matches[matches.length-1]?.winner};
}

function simulateOnce(){
  const standings = {};
  Object.keys(tournament.groups).forEach(g => standings[g] = blankTable(g));
  for(const m of tournament.groupMatches){
    const s = sampleScore(m.home, m.away, false);
    addResult(standings[m.group], m.home, m.away, s.hg, s.ag);
  }
  Object.keys(standings).forEach(g => standings[g].sort(compareRows));
  return {standings, knockout: knockoutFromStandings(standings, true)};
}

function monteCarlo(n){
  const res = {};
  Object.keys(tournament.teams).forEach(t => res[t] = {groupWinner:0, advance:0, qf:0, sf:0, final:0, champion:0});
  for(let i=0;i<n;i++){
    const sim = simulateOnce();
    const thirds = bestThirds(sim.standings).map(x => x.team);
    for(const rows of Object.values(sim.standings)){
      res[rows[0].team].groupWinner++;
      rows.slice(0,2).forEach(r => res[r.team].advance++);
    }
    thirds.forEach(t => res[t].advance++);
    for(const m of sim.knockout.matches){
      if(m.stage === "Round of 16"){ res[m.homeTeam].qf++; res[m.awayTeam].qf++; }
      if(m.stage === "Quarter-final"){ res[m.homeTeam].sf++; res[m.awayTeam].sf++; }
      if(m.stage === "Semi-final"){ res[m.homeTeam].final++; res[m.awayTeam].final++; }
    }
    if(sim.knockout.winner) res[sim.knockout.winner].champion++;
  }
  Object.values(res).forEach(r => Object.keys(r).forEach(k => r[k] /= n));
  return res;
}

function standingsTable(rows){
  return `<table><thead><tr><th>Team</th><th class="right">P</th><th class="right">W</th><th class="right">G</th><th class="right">V</th><th class="right">DV</th><th class="right">DT</th><th class="right">DS</th><th class="right">Pnt</th></tr></thead><tbody>${
    rows.map((r,i) => `<tr><td>${i<2?"✅ ":i===2?"◐ ":""}${teamName(r.team)}</td><td class="right">${r.p}</td><td class="right">${r.w}</td><td class="right">${r.d}</td><td class="right">${r.l}</td><td class="right">${r.gf}</td><td class="right">${r.ga}</td><td class="right">${r.gd}</td><td class="right"><b>${r.pts}</b></td></tr>`).join("")
  }</tbody></table>`;
}

function renderSummary(groupData, ko, mc){
  const top = Object.entries(mc).sort((a,b) => b[1].champion - a[1].champion).slice(0,10);
  qs("#summary").innerHTML = `<div class="grid">
    <div class="card"><h2>Voorspelde winnaar</h2><p class="winner" style="font-size:30px">${teamName(ko.winner)}</p><p class="muted">Deterministisch op basis van meest waarschijnlijke uitslag per wedstrijd.</p></div>
    <div class="card"><h2>Hoogste kampioenskansen</h2>${top.map(([t,r]) => `<p>${teamName(t)} <span class="pill">${pct(r.champion)}</span></p><div class="bar"><span style="width:${r.champion*100}%"></span></div>`).join("")}</div>
  </div>`;
}

function renderGroups(groupData){
  const byGroup = {};
  groupData.predictions.forEach(m => (byGroup[m.group] ||= []).push(m));
  qs("#groups").innerHTML = Object.keys(tournament.groups).map(g => `<div class="card"><h2>Groep ${g}</h2>${standingsTable(groupData.standings[g])}<h3>Wedstrijden</h3><table><tbody>${
    byGroup[g].map(m => `<tr><td>${m.date}</td><td>${teamName(m.home)} - ${teamName(m.away)}</td><td class="right"><b>${m.hg}-${m.ag}</b></td><td class="right muted">${pct(m.prob)}</td></tr>`).join("")
  }</tbody></table></div>`).join("");
}

function renderKnockout(ko){
  const stages = ["Round of 32","Round of 16","Quarter-final","Semi-final","Final"];
  qs("#knockout").innerHTML = stages.map(stage => `<div class="card"><h2>${stage}</h2><table><tbody>${
    ko.matches.filter(m => m.stage === stage).map(m => `<tr><td>${m.id}</td><td>${teamName(m.homeTeam)} - ${teamName(m.awayTeam)}</td><td class="right"><b>${m.hg}-${m.ag}</b></td><td class="winner">${teamName(m.winner)}</td></tr>`).join("")
  }</tbody></table></div>`).join("");
}

function renderChances(mc){
  const rows = Object.entries(mc).sort((a,b) => b[1].champion - a[1].champion);
  qs("#chances").innerHTML = `<div class="card"><h2>Monte Carlo-kansen</h2><table><thead><tr><th>Team</th><th class="right">Groepswinnaar</th><th class="right">Door groep</th><th class="right">Kwartfinale</th><th class="right">Halve finale</th><th class="right">Finale</th><th class="right">Kampioen</th></tr></thead><tbody>${
    rows.map(([t,r]) => `<tr><td>${teamName(t)}</td><td class="right">${pct(r.groupWinner)}</td><td class="right">${pct(r.advance)}</td><td class="right">${pct(r.qf)}</td><td class="right">${pct(r.sf)}</td><td class="right">${pct(r.final)}</td><td class="right"><b>${pct(r.champion)}</b></td></tr>`).join("")
  }</tbody></table></div>`;
}

async function run(){
  try{
    if(!tournament) await loadData();
    const groupData = deterministicGroups();
    const ko = knockoutFromStandings(groupData.standings, false);
    const n = Math.max(100, Math.min(50000, Number(qs("#simulations").value || 5000)));
    const mc = monteCarlo(n);
    renderSummary(groupData, ko, mc);
    renderGroups(groupData);
    renderKnockout(ko);
    renderChances(mc);
  }catch(err){
    qs("#summary").innerHTML = `<div class="error"><b>Fout:</b> ${err.message}</div>`;
  }
}

function initTabs(){
  document.querySelectorAll(".tab").forEach(btn => btn.addEventListener("click", () => {
    document.querySelectorAll(".tab,.tabPanel").forEach(x => x.classList.remove("active"));
    btn.classList.add("active");
    qs("#" + btn.dataset.tab).classList.add("active");
  }));
}

initTabs();
qs("#runBtn").addEventListener("click", run);
run();

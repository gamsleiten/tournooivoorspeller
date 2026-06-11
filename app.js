
const SPORTDB_URL="https://api.sportdb.dev/api/flashscore/football"; // Direct browser calls are usually blocked by CORS. Use a proxy URL.
const POLY_URL="https://gamma-api.polymarket.com/markets";
const qs=s=>document.querySelector(s),qsa=s=>Array.from(document.querySelectorAll(s)),pct=x=>`${(100*x).toFixed(1)}%`;
function setVal(sel,val){const el=qs(sel);if(el)el.value=val;}
function getVal(sel,fallback=''){const el=qs(sel);return el?el.value:fallback;}
let tournament,elo,liveMatches={},polyMarkets=[],polyTeamPrices={},polyMatchMarkets={},isRunning=false;
const LS={key:"wk2026.sportdbKey",proxy:"wk2026.sportdbProxy",poly:"wk2026.polyQuery",polyMode:"wk2026.polyMode",scoreMode:"wk2026.scoreMode",seed:"wk2026.variantSeed",sim:"wk2026.simulations",goal:"wk2026.goalBase",cache:"wk2026.sportdbCache",polyCache:"wk2026.polyCache"};
function status(m){qs("#status").innerHTML=m||""}function fact(n){let r=1;for(let i=2;i<=n;i++)r*=i;return r}function poisson(l,k){return Math.exp(-l)*Math.pow(l,k)/fact(k)}
function name(c){return tournament.teams[c]?.name||c}function rating(c){return elo[c]||tournament.teams[c]?.elo||1600}
function save(){
  localStorage.setItem(LS.key, getVal("#sportdbKey","").trim());
  localStorage.setItem(LS.proxy, getVal("#sportdbProxy","").trim());
  localStorage.setItem(LS.poly, getVal("#polyQuery","").trim());
  localStorage.setItem(LS.polyMode, getVal("#polyMode","search"));
  localStorage.setItem(LS.scoreMode, getVal("#scoreMode","likely"));
  localStorage.setItem(LS.seed, getVal("#variantSeed","2026"));
  localStorage.setItem(LS.sim, getVal("#simulations","1000"));
  localStorage.setItem(LS.goal, getVal("#goalBase","2.6"));
  status("Instellingen opgeslagen.");
}
function loadSettings(){
  setVal("#sportdbKey", localStorage.getItem(LS.key)||"");
  setVal("#sportdbProxy", localStorage.getItem(LS.proxy)||"");
  setVal("#polyQuery", localStorage.getItem(LS.poly)||"world cup 2026 winner");
  setVal("#polyMode", localStorage.getItem(LS.polyMode)||"search");
  setVal("#scoreMode", localStorage.getItem(LS.scoreMode)||"likely");
  setVal("#variantSeed", localStorage.getItem(LS.seed)||"2026");
  setVal("#simulations", localStorage.getItem(LS.sim)||"1000");
  setVal("#goalBase", localStorage.getItem(LS.goal)||"2.6");
}
async function loadData(){const[t,e]=await Promise.all([fetch("data/world-cup-2026.json").then(r=>r.json()),fetch("data/elo.json").then(r=>r.json())]);tournament=t;elo=e.ratings||{}}
function norm(s){return String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim()}
function code(v){if(!v)return null;let raw=String(v).trim().toUpperCase();if(tournament.teams[raw])return raw;let n=norm(v);for(const[c,info]of Object.entries(tournament.teams)){if(norm(info.name)===n)return c;if((info.aliases||[]).map(norm).includes(n))return c}return null}
function get(o,paths){for(const p of paths){let cur=o;for(const part of p.split(".")){if(cur==null)break;cur=cur[part]}if(cur!==undefined&&cur!==null&&cur!=="")return cur}return null}
function arrDeep(o){if(Array.isArray(o))return o;if(!o||typeof o!=="object")return[];for(const k of["data","matches","fixtures","events","response","results","games"]){if(Array.isArray(o[k]))return o[k]}for(const v of Object.values(o)){let f=arrDeep(v);if(f.length)return f}return[]}
function isFinished(s){s=norm(s);return["finished","final","ft","full time","completed","ended","aet"].some(x=>s.includes(x))}function isLive(s){s=norm(s);return["live","in progress","1st half","2nd half","halftime","ht"].some(x=>s.includes(x))}
function normalizeMatch(r){let h=code(get(r,["home.name","homeTeam.name","home_team.name","teams.home.name","participants.home.name","competitors.0.name","home","homeTeam"])),a=code(get(r,["away.name","awayTeam.name","away_team.name","teams.away.name","participants.away.name","competitors.1.name","away","awayTeam"]));if(!h||!a)return null;let st=get(r,["status","state","matchStatus","status.name","fixture.status.short","fixture.status.long"])||"scheduled",hg=get(r,["score.home","scores.home","goals.home","homeScore","home_score","score.fulltime.home","score.ft.home","scores.fulltime.home","home.score"]),ag=get(r,["score.away","scores.away","goals.away","awayScore","away_score","score.fulltime.away","score.ft.away","scores.fulltime.away","away.score"]);return{home:h,away:a,date:get(r,["date","kickoff","startTime","start_time","scheduled","time","fixture.date","startTimestamp"]),status:String(st),finished:isFinished(st)||(hg!==null&&ag!==null&&!isLive(st)),live:isLive(st),hg:hg===null?null:Number(hg),ag:ag===null?null:Number(ag),city:get(r,["city","venue.city","stadium.city","location.city"]),venue:get(r,["venue.name","stadium.name","stadium","venue","location.name"])}}
async function loadSportDB(){
  let key=qs("#sportdbKey").value.trim();
  let proxy=qs("#sportdbProxy").value.trim();
  if(!key || !proxy){
    liveMatches={};
    status("SportDB overgeslagen: browser direct-call geeft CORS. Vul een proxy URL in voor live uitslagen.");
    return;
  }
  let c=JSON.parse(localStorage.getItem(LS.cache)||"null"),now=Date.now();
  if(c&&c.proxy===proxy&&now-c.ts<300000){
    liveMatches=c.matches||{};
    status(`SportDB cache gebruikt (${Object.keys(liveMatches).length/2} wedstrijden).`);
    return;
  }
  try{
    let res=await fetch(proxy,{headers:{"X-API-Key":key}});
    if(!res.ok)throw new Error(`HTTP ${res.status}`);
    let raw=await res.json(),map={};
    arrDeep(raw).map(normalizeMatch).filter(Boolean).forEach(m=>{
      map[`${m.home}-${m.away}`]=m;
      map[`${m.away}-${m.home}`]={...m,home:m.away,away:m.home,hg:m.ag,ag:m.hg}
    });
    liveMatches=map;
    localStorage.setItem(LS.cache,JSON.stringify({ts:now,proxy,matches:map}));
    status(`SportDB via proxy geladen: ${Object.keys(map).length/2} wedstrijden herkend.`);
  }catch(e){
    liveMatches={};
    status(`<span class="warn">SportDB niet geladen via proxy: ${e.message}. Fallback op JSON + Elo.</span>`)
  }
}
function parseJsonMaybe(v){if(Array.isArray(v))return v;if(typeof v==="string"){try{return JSON.parse(v)}catch(e){return[]}}return[]}
function priceNum(v){let n=Number(v);return Number.isFinite(n)?n:null}

function marketText(m){
  return `${m.question||m.title||""} ${m.slug||""}`.toLowerCase();
}
function hasTeamInMarket(m, teamCode){
  const txt = marketText(m);
  const info = tournament.teams[teamCode] || {};
  const names = [info.name, ...(info.aliases||[]), teamCode].map(norm).filter(Boolean);
  return names.some(n => txt.includes(n));
}
function findMatchMarket(home, away){
  const direct = polyMarkets.find(m => hasTeamInMarket(m, home) && hasTeamInMarket(m, away));
  if(!direct) return null;
  const outcomes = parseJsonMaybe(direct.outcomes);
  const priceArr = parseJsonMaybe(direct.outcomePrices||direct.outcome_prices);
  const prices = {};
  outcomes.forEach((out,i)=>{
    const c = code(out);
    const p = priceNum(priceArr[i]);
    if(c && p !== null) prices[c] = p;
    if(norm(out).includes("draw") || norm(out).includes("tie") || norm(out).includes("gelijk")) {
      const dp = priceNum(priceArr[i]);
      if(dp !== null) prices.DRAW = dp;
    }
  });
  return { market: direct, prices };
}
async function fetchPolyMarkets(mode,q){
  if(mode==="slug"){
    const urls=[
      `${POLY_URL}?closed=false&limit=10&slug=${encodeURIComponent(q)}`,
      `${POLY_URL}?closed=false&limit=10&search=${encodeURIComponent(q)}`
    ];
    for(const url of urls){
      const res=await fetch(url);
      if(res.ok){
        let data=await res.json();
        if(!Array.isArray(data)) data=data.data||[];
        const exact=data.filter(m=>m.slug===q);
        if(exact.length) return exact;
        if(data.length) return data;
      }
    }
    return [];
  }
  const res=await fetch(`${POLY_URL}?closed=false&limit=100&search=${encodeURIComponent(q)}`);
  if(!res.ok) throw new Error(`HTTP ${res.status}`);
  let data=await res.json();
  if(!Array.isArray(data)) data=data.data||[];
  return data;
}
async function loadPolymarket(){
  polyMarkets=[];polyTeamPrices={};polyMatchMarkets={};
  let q=getVal("#polyQuery","").trim();
  let mode=getVal("#polyMode","search");
  if(!q)return;
  let c=JSON.parse(localStorage.getItem(LS.polyCache)||"null"),now=Date.now();
  if(c&&c.q===q&&c.mode===mode&&now-c.ts<300000){polyMarkets=c.markets||[];polyTeamPrices=c.prices||{};polyMatchMarkets=c.matchMarkets||{};return}
  try{
    let markets=await fetchPolyMarkets(mode,q);
    polyMarkets=markets.slice(0,50);
    let prices={};
    for(const m of polyMarkets){
      let outcomes=parseJsonMaybe(m.outcomes),priceArr=parseJsonMaybe(m.outcomePrices||m.outcome_prices);
      outcomes.forEach((out,i)=>{let c=code(out),p=priceNum(priceArr[i]);if(c&&p!==null)prices[c]=Math.max(prices[c]||0,p)})
    }
    polyTeamPrices=prices;
    const matchMap={};
    if(tournament){
      for(const gm of tournament.groupMatches){
        const found=findMatchMarket(gm.home,gm.away);
        if(found)matchMap[gm.id]={slug:found.market.slug||"",question:found.market.question||found.market.title||"",home:found.prices[gm.home],draw:found.prices.DRAW,away:found.prices[gm.away]};
      }
    }
    polyMatchMarkets=matchMap;
    localStorage.setItem(LS.polyCache,JSON.stringify({ts:now,q,mode,markets:polyMarkets,prices:polyTeamPrices,matchMarkets:polyMatchMarkets}))
  }catch(e){polyMarkets=[];polyTeamPrices={};polyMatchMarkets={};}
}
function live(m){return liveMatches[`${m.home}-${m.away}`]||null}
function dt(x){if(!x)return"";if(typeof x==="number"&&x<9999999999)x*=1000;let d=new Date(x);return Number.isNaN(d.getTime())?String(x):d.toLocaleString("nl-NL",{timeZone:"Europe/Amsterdam",dateStyle:"medium",timeStyle:"short"})}

function hashString(str){
  let h=2166136261;
  for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}
  return h>>>0;
}
function seededRandom(seed){
  let t=seed>>>0;
  return function(){
    t += 0x6D2B79F5;
    let r=Math.imul(t ^ t>>>15, 1 | t);
    r ^= r + Math.imul(r ^ r>>>7, 61 | r);
    return ((r ^ r>>>14) >>> 0) / 4294967296;
  }
}
function sampleScoreSeeded(home,away,matchId,knockout=false){
  const rows=matrix(home,away,knockout);
  const seedBase=Number(getVal("#variantSeed","2026")||2026);
  const rnd=seededRandom(hashString(`${seedBase}-${matchId}-${home}-${away}`));
  let r=rnd();
  for(const row of rows){r-=row.p;if(r<=0)return row}
  return rows.at(-1);
}
function displayScore(home,away,matchId,knockout=false){
  const mode=getVal("#scoreMode","likely");
  if(mode==="rounded"){
    const [xh,xa]=expGoals(home,away,knockout);
    return {hg:Math.max(0,Math.round(xh)),ag:Math.max(0,Math.round(xa)),p:null,mode};
  }
  if(mode==="variant"){
    const s=sampleScoreSeeded(home,away,matchId,knockout);
    return {...s,mode};
  }
  return {...likely(home,away,knockout),mode};
}
function expGoals(h,a,ko=false){let diff=rating(h)-rating(a),base=Number(qs("#goalBase").value||2.6)+(ko?-0.15:0),adv=Math.max(-1.25,Math.min(1.25,diff/300));return[Math.max(.15,base/2+adv*.55),Math.max(.15,base/2-adv*.55)]}
function matrix(h,a,ko=false){let[eh,ea]=expGoals(h,a,ko),rows=[],tot=0;for(let hg=0;hg<=7;hg++)for(let ag=0;ag<=7;ag++){let p=poisson(eh,hg)*poisson(ea,ag);rows.push({hg,ag,p});tot+=p}rows.forEach(r=>r.p/=tot);return rows.sort((x,y)=>y.p-x.p)}
function likely(h,a,ko=false){return matrix(h,a,ko)[0]}function sample(h,a,ko=false){let rows=matrix(h,a,ko),r=Math.random();for(const row of rows){r-=row.p;if(r<=0)return row}return rows.at(-1)}
function blank(g){return tournament.groups[g].map(team=>({team,group:g,p:0,w:0,d:0,l:0,gf:0,ga:0,gd:0,pts:0}))}
function add(t,h,a,hg,ag){let H=t.find(x=>x.team===h),A=t.find(x=>x.team===a);if(!H||!A)return;H.p++;A.p++;H.gf+=hg;H.ga+=ag;A.gf+=ag;A.ga+=hg;H.gd=H.gf-H.ga;A.gd=A.gf-A.ga;if(hg>ag){H.w++;A.l++;H.pts+=3}else if(hg<ag){A.w++;H.l++;A.pts+=3}else{H.d++;A.d++;H.pts++;A.pts++}}
function cmp(a,b){return(b.pts-a.pts)||(b.gd-a.gd)||(b.gf-a.gf)||(rating(b.team)-rating(a.team))}
function outcomeProbs(home,away){
  const rows=matrix(home,away,false);
  let hw=0,d=0,aw=0;
  rows.forEach(r=>{if(r.hg>r.ag)hw+=r.p;else if(r.hg<r.ag)aw+=r.p;else d+=r.p});
  const [xh,xa]=expGoals(home,away,false);
  return {homeWin:hw,draw:d,awayWin:aw,xh,xa};
}
function build(mode){let standings={},pred=[];Object.keys(tournament.groups).forEach(g=>standings[g]=blank(g));for(const m of tournament.groupMatches){let p=displayScore(m.home,m.away,m.id,false),lv=live(m),u={hg:p.hg,ag:p.ag,source:"prediction"};if(mode==="actual"){if(lv?.finished&&lv.hg!==null&&lv.ag!==null)u={hg:lv.hg,ag:lv.ag,source:"actual"};else continue}else if(mode==="projected"&&lv?.finished&&lv.hg!==null&&lv.ag!==null)u={hg:lv.hg,ag:lv.ag,source:"actual"};pred.push({...m,predHg:p.hg,predAg:p.ag,prob:p.p||0,scoreMode:p.mode,odds:outcomeProbs(m.home,m.away),live:lv,hg:u.hg,ag:u.ag,source:u.source});add(standings[m.group],m.home,m.away,u.hg,u.ag)}Object.keys(standings).forEach(g=>standings[g].sort(cmp));return{standings,predictions:pred}}
function thirds(st){return Object.values(st).map(r=>r[2]).filter(Boolean).sort(cmp).slice(0,8)}
function ref(r,st,w,th,used){if(r.kind==="pos")return st[r.group]?.[r.pos-1]?.team||"TBD";if(r.kind==="winner")return w[r.match]||"TBD";if(r.kind==="third"){let o=th.filter(t=>r.groups.includes(t.group)&&!used.has(t.team)).sort(cmp),ch=o[0]||th.find(t=>!used.has(t.team))||th[0];if(ch)used.add(ch.team);return ch?ch.team:"TBD"}return"TBD"}
function ko(st,stoch=false){let th=thirds(st),used=new Set(),w={},matches=[];for(const m of tournament.knockout){let h=ref(m.home,st,w,th,used),a=ref(m.away,st,w,th,used),s=stoch?sample(h,a,true):displayScore(h,a,m.id,true),win;if(s.hg!==s.ag)win=s.hg>s.ag?h:a;else{let ph=1/(1+Math.pow(10,-(rating(h)-rating(a))/400));win=stoch?(Math.random()<ph?h:a):(ph>=.5?h:a)}w[m.id]=win;matches.push({...m,homeTeam:h,awayTeam:a,hg:s.hg,ag:s.ag,winner:win})}return{matches,winner:w.F1||matches.at(-1)?.winner}}
function sim(projected=true){let st={};Object.keys(tournament.groups).forEach(g=>st[g]=blank(g));for(const m of tournament.groupMatches){let lv=live(m),s=(projected&&lv?.finished&&lv.hg!==null&&lv.ag!==null)?{hg:lv.hg,ag:lv.ag}:sample(m.home,m.away);add(st[m.group],m.home,m.away,s.hg,s.ag)}Object.keys(st).forEach(g=>st[g].sort(cmp));return{standings:st,knockout:ko(st,true)}}
function mc(n,projected=true){let res={};Object.keys(tournament.teams).forEach(t=>res[t]={groupWinner:0,advance:0,qf:0,sf:0,final:0,champion:0});for(let i=0;i<n;i++){let s=sim(projected),th=thirds(s.standings).map(x=>x.team);for(const rows of Object.values(s.standings)){res[rows[0].team].groupWinner++;rows.slice(0,2).forEach(r=>res[r.team].advance++)}th.forEach(t=>res[t].advance++);for(const m of s.knockout.matches){if(m.stage==="Round of 16"){res[m.homeTeam].qf++;res[m.awayTeam].qf++}if(m.stage==="Quarter-final"){res[m.homeTeam].sf++;res[m.awayTeam].sf++}if(m.stage==="Semi-final"){res[m.homeTeam].final++;res[m.awayTeam].final++}}if(s.knockout.winner&&res[s.knockout.winner])res[s.knockout.winner].champion++}Object.values(res).forEach(r=>Object.keys(r).forEach(k=>r[k]/=n));return res}
function table(rows,title){return`<h3>${title}</h3><table><thead><tr><th>Team</th><th class=right>P</th><th class=right>W</th><th class=right>G</th><th class=right>V</th><th class=right>DV</th><th class=right>DT</th><th class=right>DS</th><th class=right>Pnt</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td>${i<2?"✅ ":i===2?"◐ ":""}${name(r.team)}</td><td class=right>${r.p}</td><td class=right>${r.w}</td><td class=right>${r.d}</td><td class=right>${r.l}</td><td class=right>${r.gf}</td><td class=right>${r.ga}</td><td class=right>${r.gd}</td><td class=right><b>${r.pts}</b></td></tr>`).join("")}</tbody></table>`}
function na(v){return v===undefined||v===null||Number.isNaN(v)?'N/A':pct(v)}
function pmDiff(pm,model){return pm===undefined||pm===null?'N/A':((pm-model)>=0?'+':'')+pct(pm-model)}
function renderSummary(base,proj,kb,kp,mb,mp){let top=Object.entries(mp).sort((a,b)=>b[1].champion-a[1].champion).slice(0,10);qs("#summary").innerHTML=`<div class=grid><div class=card><h2>Baseline winnaar</h2><p class=winner style="font-size:30px">${name(kb.winner)}</p><p class=muted>Vooraf-model zonder echte uitslagen.</p></div><div class=card><h2>Live/projected winnaar</h2><p class=winner style="font-size:30px">${name(kp.winner)}</p><p class=muted>Echte uitslagen + voorspelde rest.</p>${top.map(([t,r])=>`<p>${name(t)} <span class=pill>${pct(r.champion)}</span> ${`<span class=pill>PM ${na(polyTeamPrices[t])}</span>`}</p><div class=bar><span style="width:${r.champion*100}%"></span></div>`).join("")}</div></div>`}
function renderGroups(base,actual,proj){
  let by={};proj.predictions.forEach(m=>(by[m.group]||=[]).push(m));
  qs("#groups").innerHTML=Object.keys(tournament.groups).map(g=>`<div class=card><h2>Groep ${g}</h2><div class=grid><div>${table(base.standings[g],"Baseline")}</div><div>${table(actual.standings[g],"Werkelijk")}</div><div>${table(proj.standings[g],"Projected")}</div></div><h3>Wedstrijden</h3><table><thead><tr><th>Datum CEST</th><th>Wedstrijd</th><th>Stad</th><th>Stadion</th><th>Status</th><th class=right>xG</th><th class=right>1/X/2 model</th><th class=right>Score</th><th class=right>Werkelijk</th><th class=right>Gebruikt</th><th>Polymarket</th></tr></thead><tbody>${(by[g]||[]).map(m=>{
    let l=m.live,real=l?.finished&&l.hg!==null&&l.ag!==null?`${l.hg}-${l.ag}`:"",used=m.source==="actual"?real:`${m.hg}-${m.ag}`;
    let pm=polyMatchMarkets[m.id];
    let pmText=pm?`✅ ${name(m.home)} ${na(pm.home)} / X ${na(pm.draw)} / ${name(m.away)} ${na(pm.away)}`:"N/A";
    return`<tr><td>${dt(l?.date||m.date)}</td><td>${name(m.home)} - ${name(m.away)}</td><td>${l?.city||m.city||""}</td><td>${l?.venue||m.venue||""}</td><td>${l?.status||"scheduled"}</td><td class=right>${m.odds.xh.toFixed(1)}-${m.odds.xa.toFixed(1)}</td><td class=right>${pct(m.odds.homeWin)} / ${pct(m.odds.draw)} / ${pct(m.odds.awayWin)}</td><td class=right>${m.predHg}-${m.predAg}</td><td class=right>${real}</td><td class=right><b>${used}</b> <span class=pill>${m.source}</span></td><td>${pmText}</td></tr>`
  }).join("")}</tbody></table></div>`).join("")
}
function renderKo(kb,kp){let stages=["Round of 32","Round of 16","Quarter-final","Semi-final","Final"],r=(k,title)=>`<div class=card><h2>${title}</h2>${stages.map(s=>`<h3>${s}</h3><table><tbody>${k.matches.filter(m=>m.stage===s).map(m=>`<tr><td>${m.id}</td><td>${name(m.homeTeam)} - ${name(m.awayTeam)}</td><td class=right><b>${m.hg}-${m.ag}</b></td><td class=winner>${name(m.winner)}</td></tr>`).join("")}</tbody></table>`).join("")}</div>`;qs("#knockout").innerHTML=`<div class=grid>${r(kb,"Baseline bracket")}${r(kp,"Live/projected bracket")}</div>`}
function renderChances(mb,mp){
  let rows=Object.keys(tournament.teams).sort((a,b)=>(polyTeamPrices[b]??-1)-(polyTeamPrices[a]??-1)||mp[b].champion-mp[a].champion);
  qs("#chances").innerHTML=`<div class=card><h2>Kampioenskansen</h2><table><thead><tr><th>Team</th><th class=right>Baseline</th><th class=right>Nu</th><th class=right>Polymarket</th><th class=right>Verschil PM - Nu</th><th class=right>Finale nu</th></tr></thead><tbody>${rows.map(t=>{
    let pm=polyTeamPrices[t];
    return`<tr><td>${name(t)}</td><td class=right>${pct(mb[t].champion)}</td><td class=right><b>${pct(mp[t].champion)}</b></td><td class=right>${na(pm)}</td><td class=right>${pmDiff(pm,mp[t].champion)}</td><td class=right>${pct(mp[t].final)}</td></tr>`
  }).join("")}</tbody></table></div>`
}
function renderMarkets(){
  const matchRows = tournament.groupMatches.map(m=>{
    const pm = polyMatchMarkets[m.id];
    return `<tr><td>${m.group}</td><td>${name(m.home)} - ${name(m.away)}</td><td>${pm?"✅ gevonden":"N/A"}</td><td class=right>${pm?na(pm.home):"N/A"}</td><td class=right>${pm?na(pm.draw):"N/A"}</td><td class=right>${pm?na(pm.away):"N/A"}</td><td>${pm?.question||""}</td></tr>`;
  }).join("");
  qs("#markets").innerHTML=`<div class=card><h2>Polymarket</h2><p class=muted>Modus: <code>${qs("#polyMode").value}</code> · Zoekterm/slug: <code>${getVal("#polyQuery","").trim()}</code>. Ontbrekende data wordt expliciet als <b>N/A</b> getoond.</p><h3>Wedstrijdmarkten</h3><table><thead><tr><th>Groep</th><th>Wedstrijd</th><th>Status</th><th class=right>Home</th><th class=right>Draw</th><th class=right>Away</th><th>Market</th></tr></thead><tbody>${matchRows}</tbody></table><h3>Teamprijzen toernooiwinst</h3><table><thead><tr><th>Team</th><th class=right>Market price</th></tr></thead><tbody>${Object.keys(tournament.teams).sort((a,b)=>(polyTeamPrices[b]??-1)-(polyTeamPrices[a]??-1)).map(t=>`<tr><td>${name(t)}</td><td class=right><b>${na(polyTeamPrices[t])}</b></td></tr>`).join("")}</tbody></table><h3>Gevonden markten</h3><table><thead><tr><th>Question</th><th>Slug</th></tr></thead><tbody>${polyMarkets.map(m=>`<tr><td>${m.question||m.title||""}</td><td>${m.slug||""}</td></tr>`).join("")||"<tr><td colspan=2>Geen markten gevonden.</td></tr>"}</tbody></table></div>`
}
function renderData(){qs("#data").innerHTML=`<div class=card><h2>Databronnen</h2><p><b>Lokaal:</b> <code>data/world-cup-2026.json</code> en <code>data/elo.json</code>.</p><p><b>SportDB:</b> direct browser calls naar <code>${SPORTDB_URL}</code> geven meestal CORS. Gebruik een proxy URL, bijvoorbeeld een Cloudflare Worker.</p><p><b>Polymarket:</b> <code>${POLY_URL}</code>, zonder API-key. Ondersteunt search en exact slug.</p><p><b>Scoremodus:</b> meest waarschijnlijk, afgeronde xG of realistische variant met vaste seed.</p><p><b>Cache:</b> SportDB en Polymarket 5 minuten in <code>localStorage</code>.</p></div>`}
async function run(){
  if(isRunning) return;
  isRunning = true;
  const runBtn = qs("#runBtn");
  runBtn.disabled = true;
  runBtn.textContent = "Bezig...";
  try{
    save();
    if(!tournament) await loadData();
    await loadSportDB();
    await loadPolymarket();
    let n=Math.max(100,Math.min(50000,Number(getVal("#simulations","1000")||1000))),
      base=build("baseline"),actual=build("actual"),proj=build("projected"),
      kb=ko(base.standings),kp=ko(proj.standings);
    let old=liveMatches;
    liveMatches={};
    let mb=mc(n,false);
    liveMatches=old;
    let mp=mc(n,true);
    renderSummary(base,proj,kb,kp,mb,mp);
    renderGroups(base,actual,proj);
    renderKo(kb,kp);
    renderChances(mb,mp);
    renderMarkets();
    renderData();
    status(`Klaar. Simulaties: ${n}. Scoremodus: ${getVal("#scoreMode","likely")}.`);
  }catch(e){
    qs("#summary").innerHTML=`<div class=error><b>Fout:</b> ${e.message}</div>`;
  }finally{
    isRunning = false;
    runBtn.disabled = false;
    runBtn.textContent = "Genereer";
  }
}
function init(){qsa(".tab").forEach(b=>b.addEventListener("click",()=>{qsa(".tab,.tabPanel").forEach(x=>x.classList.remove("active"));b.classList.add("active");qs("#"+b.dataset.tab).classList.add("active")}));loadSettings();qs("#saveBtn").onclick=save;qs("#runBtn").onclick=run;qs("#clearBtn").onclick=()=>{localStorage.removeItem(LS.cache);localStorage.removeItem(LS.polyCache);status("Cache gewist.")};status("Vul eventueel je SportDB key in en klik op Genereer.")}
init();

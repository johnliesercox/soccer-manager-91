'use strict';
// Balance check: all-AI league with a passive human manager, several worlds and seasons.
const E = require('./engine.js');
const WORLDS = parseInt(process.argv[2]||'8'), SEASONS = parseInt(process.argv[3]||'6');
const mean = a => a.reduce((s,v)=>s+v,0)/a.length;
const median = a => { const s=a.slice().sort((x,y)=>x-y); return s[Math.floor(s.length/2)]; };
const acc = { games:0, goals:0, hw:0, dr:0, aw:0, skill:{1:[],2:[],3:[],4:[]}, net:{1:[],2:[],3:[],4:[]}, sacked:0, seasons:0, userPos:[], userExp:[], bans:0, fa:[], wages:{1:[],2:[],3:[],4:[]} };
for (let w=0; w<WORLDS; w++){
  const st = E.newGame({seed: 1000+w, userClub: 48+(w%16)});
  for (let s=0; s<SEASONS; s++){
    const startBal = {}; st.clubs.forEach(c=>startBal[c.id]=c.balance); const startDiv = {}; st.clubs.forEach(c=>startDiv[c.id]=c.div);
    const uid = st.userClub;
    for (let wk=0; wk<E.CFG.WEEKS; wk++){
      const res = E.advanceWeek(st);
      for (const m of res){ if (m.euro||m.cup!==undefined) continue; acc.games++; acc.goals+=m.gH+m.gA; if (m.gH>m.gA) acc.hw++; else if (m.gH<m.gA) acc.aw++; else acc.dr++; }
      if (st.gameOver){ acc.sacked++; st.gameOver=null; st.sackOffer=null; st.clubs[st.userClub].confidence=E.CFG.CONF_START; st.clubs[st.userClub].overdraftWeeks=0; }
    }
    acc.seasons++;
    const sm = st.seasonSummary; acc.userPos.push(sm.userPos); acc.userExp.push(sm.userExpected);
    for (const c of st.clubs){ if (!startDiv[c.id]) continue; acc.net[startDiv[c.id]].push(c.balance-startBal[c.id]); }
    for (const d of [1,2,3,4]){ const cs = E.divClubs(st,d); acc.skill[d].push(mean(cs.flatMap(c=>E.squadOf(st,c).map(p=>p.skill)))); acc.wages[d].push(mean(cs.map(c=>E.squadOf(st,c).reduce((x,p)=>x+p.wage,0)))); }
    acc.fa.push(E.freeAgentsList? E.freeAgentsList(st).length : 0);
  }
}
const pct = x => (100*x/acc.games).toFixed(1)+'%';
console.log(`Worlds ${WORLDS} x seasons ${SEASONS}. Goals/game ${(acc.goals/acc.games).toFixed(2)} Home ${pct(acc.hw)} Draw ${pct(acc.dr)} Away ${pct(acc.aw)}`);
for (const d of [1,2,3,4]) console.log(`Div ${d}: skill mean ${mean(acc.skill[d]).toFixed(1)} (first ${acc.skill[d][0].toFixed(1)}, last ${acc.skill[d][acc.skill[d].length-1].toFixed(1)}) | season net £k median ${Math.round(median(acc.net[d])/1000)} | weekly wages £${Math.round(mean(acc.wages[d]))}`);
console.log(`Passive manager sacked ${acc.sacked} in ${acc.seasons} club-seasons (${(100*acc.sacked/acc.seasons).toFixed(0)}%) | median finish ${median(acc.userPos)} vs expected ${median(acc.userExp)} | free agents at season start median ${median(acc.fa)}`);

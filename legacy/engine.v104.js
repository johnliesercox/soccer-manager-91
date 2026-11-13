'use strict';
// =====================================================================
//  MPSM Remake - game engine (UI-agnostic)
// =====================================================================

// ---------- RNG ----------
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
let rand = Math.random;
function seedRng(s){ rand = mulberry32(s); }
function rInt(a,b){ return a + Math.floor(rand()*(b-a+1)); }
function rNorm(m,sd){ const u=1-rand(), v=rand(); return m + sd*Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); }
function pick(arr){ return arr[Math.floor(rand()*arr.length)]; }
function shuffle(arr){ for(let i=arr.length-1;i>0;i--){ const j=Math.floor(rand()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; } return arr; }
function poisson(lambda){ const L=Math.exp(-lambda); let k=0,p=1; do{ k++; p*=rand(); }while(p>L); return k-1; }
function clamp(x,a,b){ return Math.max(a,Math.min(b,x)); }
function round500(x){ return Math.round(x/500)*500; }

// ---------- Tunables ----------
const CFG = {
  WEEKS: 42,
  CUPS: {
    lc: { name:'League Cup', short:'Lg Cup', weeks:[3,7,11,15,19,23], prize:[3000,6000,15000,30000,60000,150000], runnerUp:60000, finalAtt:30000, finalTicket:8 },
    fa: { name:'FA Cup', short:'FA Cup', weeks:[26,30,34,37,40,42], prize:[5000,10000,25000,50000,100000,250000], runnerUp:100000, finalAtt:40000, finalTicket:10 },
  },
  ST_HOLDER_WALKUP: 0.7,    // fraction of season-ticket holders who would have paid on the gate anyway
  LOAN_RATE: 0.12,
  LOAN_WEEKS: 36,
  EVENT_TV: {0:0, 1:150000, 2:60000, 3:25000, 4:12000},
  DIV_MEAN: {1:72, 2:60, 3:48, 4:36},
  SKILL_SD: 7,
  PRESTIGE_SKILL_SPREAD: 0.7,     // +/- per prestige idx within division
  BASE_GOALS: 1.22,
  HOME_ADV: 1.2,
  CUP_HOME_UNDERDOG: 1.25,
  AWAY_ADV: 0.82,
  MID_K: 2.0,                      // possession battle sharpness
  POSS_POW: 0.8,
  ATTDEF_POW: 1.2,
  MATCH_NOISE: 0.15,
  LATE_EQUALISER: 0.10,
  UNIT_POW: 0.6,                   // diminishing returns on unit size
  CAPACITY: {1:[45000,20000], 2:[30000,12000], 3:[16000,7000], 4:[10000,4000]},
  FILL: {0:0.7, 1:0.65, 2:0.52, 3:0.47, 4:0.43},
  DEMAND: {1:21000, 2:10800, 3:5600, 4:3000},   // typical home crowd for a mid-table club in each division
  SUPPORT_BLEND: 0.5,                             // how fast a club's support moves toward its division each season
  TICKET: {0:8, 1:7, 2:6.5, 3:6, 4:5},      // the going rate in each division (0 = Europe)
  TICKET_ELASTICITY: 1.3,                     // demand falls this fast as price rises above the going rate
  TICKET_MIN: 2, TICKET_MAX: 30,
  TV: {0:0, 1:200000, 2:250000, 3:175000, 4:60000},
  SPONSOR_BASE: {0:0, 1:250000, 2:110000, 3:45000, 4:20000},
  PRIZE_TOP: {1:300000, 2:100000, 3:40000, 4:20000},
  PRIZE_BOT: {1:20000, 2:8000, 3:4000, 4:2000},
  PROMO_BONUS: {3:40000, 2:100000, 1:250000}, // keyed by division promoted INTO
  GROUND_COST_PER_SEAT: 0.06,
  OVERDRAFT_TURNOVER: 0.5,   // the bank lends up to half a season's gate and TV income
  OVERDRAFT_MIN: 100000,
  INTEREST_WEEKLY: 0.0025,
  DEPOSIT_WEEKLY: 0.001,
  START_BALANCE: {1:[1500000,400000], 2:[500000,120000], 3:[200000,50000], 4:[120000,30000]},
  WAGE_A: 0.00067, WAGE_P: 3.56,
  VALUE_MULT: 200,
  SUMMER_WEEKS: 10,
  INJURY_BASE: 0.025,
  RESALE_WEEKS: 26,          // a club will not entertain bids for a player this soon after signing him
  STAFF_WAGE: [80, 250, 600, 1200],
  STAFF_DIV_MULT: {0:3, 1:3, 2:2, 3:1.4, 4:1},
  COACH_MULT: [0.4, 1, 1.6, 2.4],
  PHYSIO_INJ_CHANCE: [1.2, 1, 0.9, 0.75],
  PHYSIO_INJ_LEN: [1.3, 1, 0.75, 0.5],
  PHYSIO_RECOVERY: [0, 1, 2, 4],
  SCOUT_LIST: [6, 8, 10, 12],
  TRAIN_BASE: 0.03,
  TRAIN: { light:{gain:0.5, fit:3, inj:0}, normal:{gain:1, fit:0, inj:0}, hard:{gain:1.7, fit:-2, inj:0.01} },
  SEAT_COST: 120,
  BUILD_WEEKS: 10,
  SAFETY_COST_PER_SEAT: 0.4,
  SAFETY_DECAY: 0.25,
  CROWD_TROUBLE_BELOW: 45,
  SAFETY_RESTRICT_BELOW: 25,
  EURO: {
    legWeeks: [[5,8],[13,17],[21,25],[29,33]],
    finalWeek: 38,
    crowdMult: 1.3,
    comps: {
      ec:   { name:'European Cup',      short:'Euro Cup', size:32, prize:[100000,150000,250000,400000,1000000], runnerUp:400000, finalAtt:70000, finalTicket:15 },
      cwc:  { name:"Cup Winners' Cup",  short:'CWC',      size:16, prize:[150000,250000,400000,600000],         runnerUp:250000, finalAtt:45000, finalTicket:12 },
      uefa: { name:'UEFA Cup',          short:'UEFA Cup', size:16, prize:[120000,200000,300000,500000],         runnerUp:200000, finalAtt:45000, finalTicket:12 },
    },
  },
  CONF_START: 55,
  CONF_REVERT: 0.03,
  SACK_CONF: 5,
  OVERDRAFT_SACK_WEEKS: 8,
};

// ---------- Static data ----------
const CLUB_DATA = [
  [1,'Arsenal','Arsenal'],[1,'Liverpool','Liverpool'],[1,'Crystal Palace','C Palace'],[1,'Leeds United','Leeds'],
  [1,'Manchester City','Man City'],[1,'Manchester United','Man Utd'],[1,'Wimbledon','Wimbledon'],[1,'Nottingham Forest','Nottm Forest'],
  [1,'Everton','Everton'],[1,'Tottenham Hotspur','Tottenham'],[1,'Chelsea','Chelsea'],[1,'Queens Park Rangers','QPR'],
  [1,'Sheffield United','Sheff Utd'],[1,'Southampton','Southampton'],[1,'Norwich City','Norwich'],[1,'Coventry City','Coventry'],
  [2,'Oldham Athletic','Oldham'],[2,'West Ham United','West Ham'],[2,'Sheffield Wednesday','Sheff Wed'],[2,'Notts County','Notts County'],
  [2,'Millwall','Millwall'],[2,'Brighton & Hove Albion','Brighton'],[2,'Middlesbrough','Middlesbro'],[2,'Barnsley','Barnsley'],
  [2,'Bristol City','Bristol City'],[2,'Oxford United','Oxford'],[2,'Newcastle United','Newcastle'],[2,'Wolverhampton Wanderers','Wolves'],
  [2,'Bristol Rovers','Bristol Rov'],[2,'Ipswich Town','Ipswich'],[2,'Port Vale','Port Vale'],[2,'Charlton Athletic','Charlton'],
  [3,'Cambridge United','Cambridge'],[3,'Southend United','Southend'],[3,'Grimsby Town','Grimsby'],[3,'Bolton Wanderers','Bolton'],
  [3,'Tranmere Rovers','Tranmere'],[3,'Brentford','Brentford'],[3,'Bury','Bury'],[3,'Bradford City','Bradford'],
  [3,'Bournemouth','Bournemouth'],[3,'Wigan Athletic','Wigan'],[3,'Huddersfield Town','Huddersfield'],[3,'Birmingham City','Birmingham'],
  [3,'Leyton Orient','L Orient'],[3,'Stoke City','Stoke'],[3,'Reading','Reading'],[3,'Exeter City','Exeter'],
  [4,'Darlington','Darlington'],[4,'Stockport County','Stockport'],[4,'Hartlepool United','Hartlepool'],[4,'Peterborough United','Peterboro'],
  [4,'Blackpool','Blackpool'],[4,'Burnley','Burnley'],[4,'Torquay United','Torquay'],[4,'Scunthorpe United','Scunthorpe'],
  [4,'Scarborough','Scarborough'],[4,'Northampton Town','Northampton'],[4,'Doncaster Rovers','Doncaster'],[4,'Rochdale','Rochdale'],
  [4,'Cardiff City','Cardiff'],[4,'Lincoln City','Lincoln'],[4,'Gillingham','Gillingham'],[4,'Walsall','Walsall'],
];
const SPONSORS_LOCAL = ['Dawson Double Glazing','Kendrick Kitchens','Pemberton Paints','Speakman Scaffolding','Trident Tyres','Goldstar Bingo','Rialto Video','Sherwood Coaches','Whitworth Windows','Lomax Removals','Yates Insurance','Oakes Plant Hire','Fenwick Motors','Regal Carpets','Bramble Bakeries','Ace Taxis','Marsden Meats','Hollis Haulage'];
const SPONSORS_NATIONAL = ['Meridian Electrical','Halcyon Holidays','Crown Assurance','Northgate Motors','Pennine Petroleum','Apex Lager','Britannia Building Society','Sovereign Cigarettes','Vantage Computers','Imperial Tobacco Co.','Tudor Crisps','Kingfisher Beer'];
// ---------- European clubs (appended into the engine) ----------
const EURO_POOL = [
  ['AC Milan','Milan',86,'it'],['Juventus','Juventus',82,'it'],['Internazionale','Inter',80,'it'],['Napoli','Napoli',78,'it'],['Sampdoria','Sampdoria',78,'it'],['Roma','Roma',76,'it'],['Torino','Torino',74,'it'],['Parma','Parma',73,'it'],['Lazio','Lazio',72,'it'],['Fiorentina','Fiorentina',72,'it'],
  ['Real Madrid','Real Madrid',84,'es'],['Barcelona','Barcelona',84,'es'],['Atlético Madrid','Atlético',76,'es'],['Valencia','Valencia',72,'es'],['Athletic Bilbao','Bilbao',70,'es'],['Sevilla','Sevilla',68,'es'],
  ['Bayern Munich','Bayern',82,'de'],['Werder Bremen','Bremen',76,'de'],['Borussia Dortmund','Dortmund',76,'de'],['Eintracht Frankfurt','Frankfurt',74,'de'],['Kaiserslautern','K\'lautern',72,'de'],['VfB Stuttgart','Stuttgart',72,'de'],['Bayer Leverkusen','Leverkusen',70,'de'],
  ['PSV Eindhoven','PSV',78,'nl'],['Ajax','Ajax',78,'nl'],['Feyenoord','Feyenoord',74,'nl'],
  ['Marseille','Marseille',80,'fr'],['Monaco','Monaco',74,'fr'],['Paris Saint-Germain','PSG',72,'fr'],['Auxerre','Auxerre',70,'fr'],['Bordeaux','Bordeaux',70,'fr'],
  ['Benfica','Benfica',77,'pt'],['Porto','Porto',77,'pt'],['Sporting Lisbon','Sporting',72,'pt'],
  ['Anderlecht','Anderlecht',73,'nl'],['Club Brugge','Brugge',70,'nl'],['KV Mechelen','Mechelen',68,'nl'],
  ['Rangers','Rangers',72,'gb'],['Celtic','Celtic',70,'gb'],
  ['Red Star Belgrade','Red Star',76,'ea'],['Dynamo Kiev','Dyn Kiev',74,'ea'],['Spartak Moscow','Spartak',74,'ea'],['Steaua Bucharest','Steaua',72,'ea'],['Sparta Prague','Sparta',68,'ea'],['Dinamo Zagreb','Din Zagreb',68,'ea'],['Hajduk Split','Hajduk',66,'ea'],['Dinamo Bucharest','Din Buch',66,'ea'],['Legia Warsaw','Legia',64,'ea'],['Ferencváros','Ferencváros',64,'ea'],
  ['IFK Gothenburg','Gothenburg',70,'no'],['Brøndby','Brøndby',68,'no'],['Malmö FF','Malmö',64,'no'],['Grasshoppers','Grasshoppers',64,'de'],['Austria Vienna','A Vienna',64,'de'],['Rosenborg','Rosenborg',62,'no'],
  ['Galatasaray','Galatasaray',68,'tr'],['Panathinaikos','Panathinaikos',68,'gr'],['Fenerbahçe','Fenerbahçe',66,'tr'],['Olympiacos','Olympiacos',66,'gr'],['Beşiktaş','Beşiktaş',64,'tr'],
  ['Levski Sofia','Levski',60,'ea'],['APOEL Nicosia','APOEL',52,'gr'],['Linfield','Linfield',42,'gb'],['Valletta','Valletta',40,'it'],
];
const EURO_NAMES = {
  it: [['Paolo','Marco','Giuseppe','Roberto','Franco','Gianluca','Alessandro','Stefano','Luca','Antonio','Fabio','Claudio','Massimo','Andrea','Riccardo','Daniele','Giovanni','Sandro'],['Rossi','Bianchi','Ferrari','Esposito','Romano','Colombo','Ricci','Marino','Greco','Bruno','Gallo','Conti','De Luca','Costa','Giordano','Mancini','Rizzo','Lombardi','Moretti','Barbieri','Fontana','Caruso','Ferrara','Serra']],
  es: [['José','Antonio','Manuel','Francisco','Juan','Javier','Miguel','Rafael','Carlos','Fernando','Luis','Alberto','Sergio','Julio','Andoni','Txiki','Quique','Paco'],['García','Fernández','González','Rodríguez','López','Martínez','Sánchez','Pérez','Gómez','Martín','Jiménez','Ruiz','Hernández','Díaz','Moreno','Álvarez','Romero','Alonso','Gutiérrez','Navarro','Torres','Vázquez','Serrano','Blanco']],
  de: [['Thomas','Michael','Andreas','Stefan','Jürgen','Klaus','Uwe','Lothar','Karl-Heinz','Olaf','Matthias','Jörg','Frank','Dieter','Rudi','Stefan','Bernd','Christian'],['Müller','Schmidt','Schneider','Fischer','Weber','Meyer','Wagner','Becker','Schulz','Hoffmann','Koch','Richter','Klein','Wolf','Neumann','Schwarz','Braun','Zimmermann','Krüger','Hartmann','Lange','Werner','Krause','Lehmann']],
  nl: [['Jan','Dennis','Ruud','Frank','Ronald','Marco','Wim','Erwin','Bryan','Peter','Aron','Hans','Johnny','Edwin','Pieter','Stan','Marc','Danny'],['de Jong','Jansen','de Vries','van den Berg','van Dijk','Bakker','Visser','Smit','Meijer','de Boer','Mulder','de Groot','Bos','Vos','Peters','Hendriks','van Leeuwen','Dekker','Brouwer','Koster','Willems','Claes','Maes','Wouters']],
  fr: [['Jean','Pierre','Michel','Philippe','Alain','Laurent','Eric','Didier','Christophe','Franck','Bernard','Patrick','Basile','Jocelyn','Fabien','Manuel','Vincent','Bruno'],['Martin','Bernard','Dubois','Thomas','Robert','Richard','Petit','Durand','Leroy','Moreau','Simon','Laurent','Lefebvre','Michel','Garcia','David','Bertrand','Roux','Vincent','Fournier','Morel','Girard','Andre','Mercier']],
  pt: [['João','Rui','Paulo','Fernando','Carlos','Nuno','Vítor','Jorge','António','Luís','Pedro','Sérgio','Manuel','José','Ricardo','Domingos','Hélder','Abel'],['Silva','Santos','Ferreira','Pereira','Oliveira','Costa','Rodrigues','Martins','Sousa','Fernandes','Gonçalves','Gomes','Lopes','Marques','Alves','Almeida','Ribeiro','Pinto','Carvalho','Teixeira','Moreira','Correia','Mendes','Nunes']],
  ea: [['Dragan','Zoran','Dejan','Darko','Goran','Ivan','Milan','Robert','Pavel','Petr','Tomáš','Andrzej','Jerzy','Marek','Gheorghe','Marius','Florin','Oleg','Sergei','Igor','Andrei','Viktor','Tibor','László'],['Petrović','Jovanović','Marković','Popović','Novák','Svoboda','Dvořák','Kowalski','Nowak','Wójcik','Popescu','Ionescu','Dumitrescu','Ivanov','Petrov','Kuznetsov','Bondarenko','Kovalenko','Horváth','Nagy','Kiss','Stojković','Đukić','Vasilev']],
  no: [['Lars','Anders','Mikael','Henrik','Peter','Kim','Brian','Morten','Jesper','Kenneth','Tomas','Jan','Ole','Thor','Michael','Klas','Stefan','Bo'],['Andersson','Johansson','Karlsson','Nilsson','Eriksson','Larsen','Hansen','Jensen','Nielsen','Pedersen','Olsen','Kristiansen','Berg','Lund','Halvorsen','Dahl','Lindqvist','Bergström','Sørensen','Madsen']],
  tr: [['Mehmet','Ahmet','Mustafa','Hakan','Rıza','Tanju','Oğuz','Bülent','Erdal','Ünal','Feyyaz','Metin','Uğur','Gökhan'],['Yılmaz','Kaya','Demir','Şahin','Çelik','Yıldız','Aydın','Öztürk','Arslan','Doğan','Kılıç','Aslan','Çetin','Kara']],
  gr: [['Giorgos','Dimitris','Nikos','Kostas','Vasilis','Yannis','Stelios','Christos','Andreas','Michalis','Panagiotis','Spyros'],['Papadopoulos','Nikolaidis','Georgiou','Antoniou','Ioannou','Konstantinou','Dimitriou','Christodoulou','Pavlou','Vlachos','Alexandrou','Makris']],
};

const EURO_CLUBS = EURO_POOL.map(x=>x[0]);

const FIRST = ['Dave','Steve','Gary','Paul','Mark','Kevin','Ian','Neil','Andy','Tony','John','Lee','Darren','Wayne','Dean','Craig','Stuart','Alan','Peter','Phil','Colin','Nigel','Trevor','Keith','Barry','Terry','Graham','Martin','Chris','Simon','Nicky','Micky','Danny','Jason','Carl','Jimmy','Robbie','Gordon','Kenny','Roy','Brian','Dennis','Frank','Tommy','Billy','Ray','Les','Vince','Gerry','Clive','Glenn','Dale','Adrian','Scott','Matt','Ashley','Gareth','Owen','Rhys','Alun','Duncan','Iain','Fraser','Brendan','Declan','Liam','Niall','Eamonn','Warren','Russell','Malcolm','Derek','Geoff','Bobby','Ronnie','Mel','Kerry','Trevor','Perry','Jon','Justin','Shaun','Carlton','Ian','Dave','Steve','Paul','Mark'];
const LAST = ['Smith','Jones','Williams','Taylor','Brown','Davies','Evans','Wilson','Thomas','Roberts','Johnson','Lewis','Walker','Robinson','Wood','Thompson','White','Watson','Jackson','Wright','Green','Harris','Cooper','King','Martin','Clarke','James','Morgan','Hughes','Edwards','Hill','Moore','Harrison','Scott','Young','Morris','Hall','Ward','Turner','Carter','Phillips','Mitchell','Adams','Campbell','Anderson','Allen','Cook','Bailey','Parker','Miller','Murphy','Price','Bell','Baker','Griffiths','Kelly','Simpson','Marshall','Collins','Bennett','Cox','Richardson','Fox','Gray','Chapman','Hunt','Robertson','Shaw','Reynolds','Lloyd','Ellis','Holmes','Mason','Palmer','Barker','Webb','Stevens','Butler','Gibson','Rogers','Knight','Hudson','Pearson','Fletcher','Dixon','Reid','Ferguson','McDonald','McAllister','McCarthy','Sutton','Sharp','Barton','Whelan','Sinclair','Dawson','Nixon','Rudd','Burrows','Fenwick','Hodges','Pemberton','Blackmore','Kendrick','Musgrove','Tanner','Speakman','Heywood','Marsden','Quinn','Molloy','Dwyer','Hanlon','Fairclough','Ashcroft','Thornton','Bradshaw','Duffy','Nolan','Kavanagh','Pritchard','Haynes','Goddard','Wallace','Lowe','Sheridan','Cartwright','Elliott','Foster','Hollis','Kerr','Lomax','Oakes','Slater','Tierney','Vaughan','Whitworth','Yates'];

const POSITIONS = ['GK','DEF','MID','FWD'];
const SQUAD_TEMPLATE = ['GK','GK','DEF','DEF','DEF','DEF','DEF','MID','MID','MID','MID','MID','FWD','FWD','FWD','FWD'];
const FORMATIONS = {
  '4-4-2': {d:4,m:4,f:2}, '4-3-3': {d:4,m:3,f:3}, '5-3-2': {d:5,m:3,f:2},
  '3-5-2': {d:3,m:5,f:2}, '5-4-1': {d:5,m:4,f:1}, '4-5-1': {d:4,m:5,f:1},
};

// ---------- Player helpers ----------
let nextPlayerId = 1;
function wageFor(skill){ return Math.max(60, Math.round(CFG.WAGE_A*Math.pow(skill, CFG.WAGE_P)/5)*5); }
function ageFactor(age){
  if (age<=20) return 1.15; if (age<=23) return 1.1; if (age<=28) return 1.0;
  if (age===29) return 0.9; if (age===30) return 0.8; if (age===31) return 0.65;
  if (age===32) return 0.5; if (age===33) return 0.4; return 0.3;
}
function valueFor(p){ return round500(wageFor(p.skill)*CFG.VALUE_MULT*ageFactor(p.age)); }
function randomAge(){ const a = Math.round(rNorm(25.5, 4)); return clamp(a, 17, 34); }
function makePlayer(state, pos, skill, age, clubId){
  const grp = (state.clubs[clubId]||{}).group; const pool = grp && EURO_NAMES[grp];
  const name = pool? pick(pool[0])+' '+pick(pool[1]) : pick(FIRST)+' '+pick(LAST);
  const p = { id: nextPlayerId++, name, pos, skill: clamp(Math.round(skill),10,99),
    age, fitness: 100, injury: 0, club: clubId, goals: 0, apps: 0, listed: null };
  p.pot = clamp(p.skill + (age<=21? rInt(6,26) : age<=24? rInt(3,15) : age<=27? rInt(0,7) : 0), p.skill, 99);
  state.players[p.id] = p;
  return p;
}
function refreshValues(p){ p.wage = wageFor(p.skill); p.value = valueFor(p); }
function posPenalty(natural, slot){
  if (natural===slot) return 1;
  if (natural==='GK') return 0.5;
  if (slot==='GK') return 0.45;
  if ((natural==='DEF'&&slot==='MID')||(natural==='MID'&&slot==='DEF')) return 0.85;
  if ((natural==='MID'&&slot==='FWD')||(natural==='FWD'&&slot==='MID')) return 0.85;
  return 0.7;
}
function effSkill(p, slot){ return p.skill*(0.8+0.2*p.fitness/100)*posPenalty(p.pos, slot); }

// ---------- Club helpers ----------
function prestigeFor(div, idx){ return (4-div)*16 + (15-idx); }
function capacityFor(div, idx){ const [hi,lo] = CFG.CAPACITY[div]; return Math.round((hi - (hi-lo)*idx/15)/100)*100; }
function squadOf(state, club){ return club.players.map(id=>state.players[id]); }
function divClubs(state, div){ return state.clubs.filter(c=>c.div===div); }
function expectedPos(state, club){
  const peers = divClubs(state, club.div).slice().sort((a,b)=>b.prestige-a.prestige);
  return peers.indexOf(club)+1;
}

// ---------- Squad selection ----------
function autoSelect(state, club, formationName){
  const fm = FORMATIONS[formationName||club.formation||'4-4-2'];
  const avail = squadOf(state, club).filter(p=>p.injury===0);
  const used = new Set(); const xi = [];
  const need = [['GK',1],['DEF',fm.d],['MID',fm.m],['FWD',fm.f]];
  // pass 1: natural positions
  for (const [slot,n] of need){
    const cands = avail.filter(p=>p.pos===slot && !used.has(p.id)).sort((a,b)=>effSkill(b,slot)-effSkill(a,slot));
    for (let i=0;i<n && i<cands.length;i++){ used.add(cands[i].id); xi.push({p:cands[i], slot}); }
  }
  // pass 2: fill shortages out of position
  for (const [slot,n] of need){
    let have = xi.filter(x=>x.slot===slot).length;
    if (have<n){
      const cands = avail.filter(p=>!used.has(p.id)).sort((a,b)=>effSkill(b,slot)-effSkill(a,slot));
      for (const c of cands){ if (have>=n) break; used.add(c.id); xi.push({p:c, slot}); have++; }
    }
  }
  return xi; // may be <11 if squad is decimated
}

function teamStrength(xi){
  const grp = s => xi.filter(x=>x.slot===s).map(x=>effSkill(x.p, s));
  const mean = a => a.length? a.reduce((s,v)=>s+v,0)/a.length : 15;
  const unit = (arr, ref) => mean(arr)*Math.pow(Math.max(arr.length,0.5)/ref, CFG.UNIT_POW);
  const gk = mean(grp('GK'));
  const def = unit(grp('DEF'),4), mid = unit(grp('MID'),4), att = unit(grp('FWD'),2);
  return { gk, def, mid, att, defEff: 0.7*def+0.3*gk };
}

// ---------- Match ----------
function demandTarget(state, club){
  if (club.div===0) return club.support || Math.round(club.capacity*0.7);
  const exp = expectedPos(state, club);
  return Math.round(CFG.DEMAND[club.div]*(0.7 + 0.6*(16-exp)/15));
}
function supportOf(state, club){
  if (club.support===undefined) club.support = Math.round((club.capacity*CFG.FILL[club.div] + demandTarget(state, club))/2);
  return club.support;
}
function attendanceFor(state, home, away, leaguePos, mult=1){
  const posF = 1 + 0.3*((8.5-leaguePos)/16);
  const oppF = 1 + 0.3*((away.prestige - home.prestige)/32);
  const att = supportOf(state, home)*priceFactor(home)*posF*oppF*(0.85+0.3*rand())*mult;
  const cap = home.safety<CFG.SAFETY_RESTRICT_BELOW? Math.round(home.capacity*0.6) : home.capacity;
  const hm = managerOf(state, home.id); const sold = (hm && hm.seasonTicket)? hm.seasonTicket.sold : 0;
  return clamp(Math.max(sold, Math.round(att/50)*50), 500, cap);
}

function playMatch(state, home, away, opts={}){
  const xiH = opts.xiH || autoSelect(state, home);
  const xiA = opts.xiA || autoSelect(state, away);
  const sH = teamStrength(xiH), sA = teamStrength(xiA);
  const k = CFG.MID_K;
  const pH = Math.pow(sH.mid,k)/(Math.pow(sH.mid,k)+Math.pow(sA.mid,k));
  const underdogHome = opts.knockout && !opts.neutral && home.div>away.div;
  const hAdv = opts.neutral? 1 : (underdogHome? CFG.CUP_HOME_UNDERDOG : CFG.HOME_ADV), aAdv = opts.neutral? 1 : CFG.AWAY_ADV;
  const xgH = CFG.BASE_GOALS*hAdv*Math.pow(2*pH,CFG.POSS_POW)*Math.pow(sH.att/sA.defEff,CFG.ATTDEF_POW)*Math.exp(rNorm(0,CFG.MATCH_NOISE));
  const xgA = CFG.BASE_GOALS*aAdv*Math.pow(2*(1-pH),CFG.POSS_POW)*Math.pow(sA.att/sH.defEff,CFG.ATTDEF_POW)*Math.exp(rNorm(0,CFG.MATCH_NOISE));
  let gH = poisson(xgH), gA = poisson(xgA);
  if (Math.abs(gH-gA)===1 && rand()<CFG.LATE_EQUALISER){ if (gH<gA) gH++; else gA++; }
  const scorers = [];
  const pickScorer = xi => {
    const w = xi.map(x=>({x, w: effSkill(x.p,x.slot)*({FWD:5,MID:2.5,DEF:0.7,GK:0.02}[x.slot])}));
    let t = rand()*w.reduce((s,v)=>s+v.w,0);
    for (const e of w){ t-=e.w; if (t<=0) return e.x.p; }
    return w[w.length-1].x.p;
  };
  for (let i=0;i<gH;i++) scorers.push({side:'H', p: pickScorer(xiH), min: rInt(1,90)});
  for (let i=0;i<gA;i++) scorers.push({side:'A', p: pickScorer(xiA), min: rInt(1,90)});
  scorers.sort((a,b)=>a.min-b.min);
  let extra = null;
  if (opts.knockout && gH===gA){
    // extra time then penalties
    const eH = poisson(xgH*0.3), eA = poisson(xgA*0.3);
    if (eH!==eA){ gH+=eH; gA+=eA; extra='aet'; }
    else { extra = rand()<0.5? 'pens-H':'pens-A'; }
  }
  // fitness, apps, injuries, goals
  const injuries = [];
  for (const x of [...xiH,...xiA]){
    x.p.apps++; x.p.fitness = clamp(x.p.fitness-7, 30, 100);
    const physio = (state.clubs[x.p.club]||{staff:{physio:1}}).staff.physio;
    const chance = CFG.INJURY_BASE*(x.p.fitness<70?2:1)*CFG.PHYSIO_INJ_CHANCE[physio];
    if (rand()<chance){ x.p.injury = Math.max(1, Math.round((1+Math.floor(Math.pow(rand(),2)*9))*CFG.PHYSIO_INJ_LEN[physio])); injuries.push(x.p); }
  }
  for (const s of scorers) s.p.goals++;
  const leaguePos = home.leaguePos||8;
  const att = opts.neutral? opts.finalAtt : attendanceFor(state, home, away, leaguePos, opts.demandMult||1);
  return { home, away, gH, gA, scorers, extra, att, injuries, xiH, xiA, xgH, xgA };
}

function recordGate(club, att){
  const cap = club.safety<CFG.SAFETY_RESTRICT_BELOW? Math.round(club.capacity*0.6) : club.capacity;
  club.gates = club.gates||[]; club.gates.push({a:att, s:att>=cap}); if (club.gates.length>10) club.gates.shift();
}
function gateSummary(state, club){
  const support = supportOf(state, club); const target = demandTarget(state, club);
  const g = club.gates||[];
  const base = { support, target, bigGame: Math.round(support*1.3*1.15), capacity: club.capacity };
  if (!g.length) return Object.assign(base, { n:0 });
  const avg = Math.round(g.reduce((s,x)=>s+x.a,0)/g.length); const max = Math.max(...g.map(x=>x.a)); const sellouts = g.filter(x=>x.s).length;
  return Object.assign(base, { n:g.length, avg, max, sellouts, fill: avg/club.capacity, list:g.map(x=>x.a+(x.s?'*':'')) });
}

// ---------- Fixtures ----------
function makeLeagueFixtures(clubIds){
  const ids = shuffle(clubIds.slice()); const n = ids.length; const rounds = [];
  for (let r=0;r<n-1;r++){
    const rd = [];
    for (let i=0;i<n/2;i++){
      const a = ids[i], b = ids[n-1-i];
      rd.push(r%2===0? {h:a,a:b} : {h:b,a:a});
    }
    rounds.push(rd);
    ids.splice(1,0,ids.pop());
  }
  const back = rounds.map(rd=>rd.map(m=>({h:m.a,a:m.h})));
  return rounds.concat(back); // 30 rounds
}
function buildSchedule(state){
  const weeks = [];
  let lr = 0; const cr = {lc:0, fa:0};
  for (let w=1; w<=CFG.WEEKS; w++){
    const key = Object.keys(CFG.CUPS).find(k=>CFG.CUPS[k].weeks.includes(w));
    if (key) weeks.push({type:'cup', cup:key, round: cr[key]++});
    else weeks.push({type:'league', round: lr++});
  }
  state.schedule = weeks;
  state.fixtures = {};
  for (const d of [1,2,3,4]) state.fixtures[d] = makeLeagueFixtures(divClubs(state,d).map(c=>c.id));
  state.cups = {}; state.cupWinners = {};
  for (const key in CFG.CUPS){
    state.cups[key] = { alive: state.clubs.filter(c=>c.div>=1).map(c=>c.id), ties: [], round: 0, history: [] };
    state.cupWinners[key] = null;
    for (const c of state.clubs) c.cup[key] = {round:0, out:false};
    cupDraw(state, key);
  }
  buildEuro(state);
}

// ---------- Europe ----------
function englishSeeds(state){
  const d1 = divClubs(state,1).slice().sort((a,b)=>b.prestige-a.prestige);
  return { ec:[d1[0].id], cwc:[d1[3].id], uefa:[d1[1].id, d1[2].id] };
}
function buildEuro(state){
  const entr = state.euroEntrants || englishSeeds(state);
  const pool = divClubs(state,0).slice().sort((a,b)=>b.rating-a.rating);
  const take = (idx) => idx.map(i=>pool[i]).filter(Boolean).map(c=>c.id);
  const range = (a,b)=>{ const o=[]; for (let i=a;i<=b;i++) o.push(i); return o; };
  const euros = { ec: take([...range(0,19), ...range(32,36), ...range(58,63)]), cwc: take([...range(20,25), ...range(37,45)]), uefa: take([...range(26,31), ...range(46,53)]) };
  state.euro = {};
  for (const c of state.clubs) c.euro = null;
  for (const key in CFG.EURO.comps){
    const def = CFG.EURO.comps[key];
    const alive = shuffle(entr[key].concat(euros[key]).slice(0, def.size));
    const startRound = def.size===32? 0 : 1;
    state.euro[key] = { alive, ties: [], round: startRound, winner: null, history: [], entrants: alive.slice() };
    for (const id of alive) state.clubs[id].euro = { comp:key, round: startRound, out:false };
    euroDraw(state, key);
  }
}
function euroDraw(state, key){
  const e = state.euro[key]; const alive = shuffle(e.alive.slice()); e.ties = [];
  for (let i=0;i<alive.length;i+=2) e.ties.push({ a:alive[i], b:alive[i+1], g1:null, g2:null });
  for (const t of e.ties) for (const id of [t.a,t.b]) if (isHuman(state, id)){ const opp = state.clubs[id===t.a? t.b : t.a]; newsTo(state, id, `${CFG.EURO.comps[key].name} ${euroRoundName(key, e.round)}: drawn against ${opp.name}, first leg ${id===t.a?'at home':'away'}.`, 'cup'); }
}
function euroRoundName(key, round){ const size = CFG.EURO.comps[key].size; return size===32? ['First Round','Second Round','Quarter-Final','Semi-Final','Final'][round] : ['','First Round','Quarter-Final','Semi-Final','Final'][round]; }
function euroSlot(week){
  const L = CFG.EURO.legWeeks;
  for (let i=0;i<L.length;i++){ if (L[i][0]===week) return {slot:i, leg:1}; if (L[i][1]===week) return {slot:i, leg:2}; }
  if (week===CFG.EURO.finalWeek) return {final:true};
  return null;
}
function euroTieFor(state, clubId){
  const c = state.clubs[clubId]; if (!c.euro || c.euro.out || !state.euro) return null;
  const e = state.euro[c.euro.comp]; const t = e.ties.find(x=>x.a===clubId||x.b===clubId);
  if (!t) return e.alive.length===2? { final:true, opp: state.clubs[e.alive.find(id=>id!==clubId)], comp:c.euro.comp } : null;
  const opp = state.clubs[t.a===clubId? t.b : t.a];
  return { tie:t, opp, comp:c.euro.comp, round:e.round, homeFirst: t.a===clubId, g1:t.g1 };
}
function euroXI(state, club){
  const mg = managerOf(state, club.id);
  return mg? buildXI(state, club, mg.euroSel||[], club.euroFormation||club.formation) : autoSelect(state, club);
}
function playEuroWeek(state, results){
  const es = euroSlot(state.week); if (!es || !state.euro) return;
  for (const key in CFG.EURO.comps){
    const def = CFG.EURO.comps[key]; const e = state.euro[key]; if (!e || e.winner!==null) continue;
    if (es.final){
      if (e.alive.length!==2) continue;
      const h = state.clubs[e.alive[0]], a = state.clubs[e.alive[1]];
      const m = playMatch(state, h, a, { knockout:true, neutral:true, finalAtt: def.finalAtt, xiH: euroXI(state,h), xiA: euroXI(state,a) });
      m.euro = { comp:key, round: e.round, final:true }; results.push(m);
      const hWins = m.gH>m.gA || m.extra==='pens-H'; const winner = hWins? h : a, loser = hWins? a : h;
      const g = Math.round(m.att*def.finalTicket/2); credit(state, h, g, `${def.name} final gate`); credit(state, a, g, `${def.name} final gate`);
      credit(state, winner, def.prize[def.prize.length-1], `${def.name} winners' prize`); credit(state, loser, def.runnerUp, `${def.name} runners-up`);
      winner.euro.round++; loser.euro.out = true; e.winner = winner.id; e.alive = [winner.id]; e.ties = [];
      const wm = managerOf(state, winner.id); if (wm) wm.trophies[key] = (wm.trophies[key]||0)+1;
      confMatch(winner, loser, 'W', true); confMatch(loser, winner, 'L', true);
      newsAll(state, `${winner.name} win the ${def.name}, beating ${loser.name} ${Math.max(m.gH,m.gA)}-${Math.min(m.gH,m.gA)}${m.extra?' ('+(m.extra.startsWith('pens')?'on penalties':'aet')+')':''}.`, 'cup');
      e.history.push({ round:e.round, final:true, h:h.id, a:a.id, gH:m.gH, gA:m.gA, extra:m.extra });
      continue;
    }
    const compRound = es.slot;
    if (compRound!==e.round || !e.ties.length) continue;
    const prizeIdx = def.size===32? compRound : compRound-1;
    const nextAlive = [];
    for (const t of e.ties){
      const A = state.clubs[t.a], B = state.clubs[t.b];
      const home = es.leg===1? A : B, away = es.leg===1? B : A;
      const m = playMatch(state, home, away, { demandMult: CFG.EURO.crowdMult, xiH: euroXI(state,home), xiA: euroXI(state,away) });
      m.euro = { comp:key, round: compRound, leg: es.leg };
      credit(state, home, Math.round(m.att*ticketOf(home)), `${def.name} gate`); recordGate(home, m.att);
      if (es.leg===1){ t.g1 = [m.gH, m.gA]; results.push(m); const rh = m.gH>m.gA?'W':m.gH<m.gA?'L':'D'; confMatch(home, away, rh, true); confMatch(away, home, rh==='W'?'L':rh==='L'?'W':'D', true); continue; }
      // second leg: aggregate, away goals, extra time, penalties
      let gH = m.gH, gA = m.gA;
      let aggA = t.g1[0] + gA, aggB = t.g1[1] + gH;   // A's goals: home in leg 1 + away in leg 2
      let winner = null;
      if (aggA!==aggB) winner = aggA>aggB? A : B;
      else if (gA!==t.g1[1]) winner = gA>t.g1[1]? A : B;   // away goals: A scored gA away, B scored g1[1] away
      else {
        const eH = poisson(m.xgH*0.3), eA = poisson(m.xgA*0.3);
        if (eH!==eA){ gH+=eH; gA+=eA; aggA+=eA; aggB+=eH; winner = aggA>aggB? A : B; m.extra='aet'; }
        else { const hp = rand()<0.5; winner = hp? home : away; m.extra = hp? 'pens-H':'pens-A'; }
      }
      m.gH = gH; m.gA = gA; m.agg = { a:aggA, b:aggB }; t.g2 = [gH, gA]; m.winner = winner.id; results.push(m);
      const loser = winner===A? B : A;
      credit(state, winner, def.prize[prizeIdx], `${def.name} prize money`);
      winner.euro.round = compRound+1; loser.euro.out = true; nextAlive.push(winner.id);
      confMatch(winner, loser, 'W', true); confMatch(loser, winner, 'L', true);
      for (const c of [A,B]) if (isHuman(state, c.id)) newsTo(state, c.id, `${def.name}: ${winner===c? 'through' : 'out'}, ${aggA===aggB? (m.extra&&m.extra.startsWith('pens')? 'on penalties' : m.extra==='aet'? 'after extra time' : 'on away goals') : aggA+'-'+aggB+' on aggregate'} against ${(winner===c? loser : winner).name}.`, winner===c? 'cup':'warn');
      e.history.push({ round:compRound, a:t.a, b:t.b, g1:t.g1, g2:t.g2, extra:m.extra, winner:winner.id });
    }
    if (es.leg!==2) continue;
    e.alive = nextAlive; e.round = compRound+1;
    if (nextAlive.length>2) euroDraw(state, key); else { e.ties = []; if (nextAlive.length===2) for (const id of nextAlive) if (isHuman(state,id)) newsTo(state, id, `${def.name} final: ${state.clubs[nextAlive.find(x=>x!==id)].name} at a neutral ground in week ${CFG.EURO.finalWeek}.`, 'cup'); }
  }
}
function euroQualifiers(state, summary){
  const tb = summary.tables[1].map(r=>r.id);
  const champ = tb[0]; const faW = summary.cupWinners.fa; const faRU = state.cupRunnersUp? state.cupRunnersUp.fa : null;
  const cwc = (faW!==null && faW!==undefined && faW!==champ)? faW : (faRU!==null && faRU!==undefined && faRU!==champ? faRU : tb[1]);
  const uefa = []; for (const id of tb.slice(1)){ if (uefa.length>=2) break; if (id!==champ && id!==cwc) uefa.push(id); }
  return { ec:[champ], cwc:[cwc], uefa };
}
function euroStatus(state, club){
  if (!club.euro || !state.euro) return null;
  const def = CFG.EURO.comps[club.euro.comp]; const e = state.euro[club.euro.comp];
  const won = e.winner===club.id;
  return { comp: club.euro.comp, name: def.name, short: def.short, out: club.euro.out, won, round: club.euro.round, roundName: euroRoundName(club.euro.comp, Math.min(club.euro.round, def.size===32?4:4)) };
}

// ---------- League table ----------
function tableFor(state, div){
  return divClubs(state, div).slice().sort((a,b)=>{
    const s=a.st, t=b.st;
    return (t.pts-s.pts)||((t.gf-t.ga)-(s.gf-s.ga))||(t.gf-s.gf)||a.name.localeCompare(b.name);
  });
}
function updatePositions(state){
  for (const d of [1,2,3,4]) tableFor(state,d).forEach((c,i)=>c.leaguePos=i+1);
}
function recordLeague(m){
  const h=m.home.st, a=m.away.st;
  h.p++; a.p++; h.gf+=m.gH; h.ga+=m.gA; a.gf+=m.gA; a.ga+=m.gH;
  if (m.gH>m.gA){ h.w++; a.l++; h.pts+=3; }
  else if (m.gH<m.gA){ a.w++; h.l++; a.pts+=3; }
  else { h.d++; a.d++; h.pts++; a.pts++; }
}

// ---------- Managers (hot-seat) ----------
const MGR_FIELDS = ['userClub','managerName','userSel','euroSel','sponsor','seasonTicket','loan','preseason','jobOffer','jobOfferExpires','sackOffer','gameOver','userResults','userEuro','offers','transferList','news','seasonSummary','scoutReport'];
function isHuman(state, clubId){ return state.managers.some(m=>!m.retired && m.userClub===clubId); }
function managerOf(state, clubId){ return state.managers.find(m=>!m.retired && m.userClub===clubId) || null; }
function activeManagers(state){ return state.managers.filter(m=>!m.retired); }
function setCurrent(state, idx){ const m = state.managers[idx]; if (!m) return; state.cur = idx; for (const f of MGR_FIELDS) state[f] = m[f]; }
function saveCurrent(state){ const m = state.managers[state.cur]; if (!m) return; for (const f of MGR_FIELDS) m[f] = state[f]; }
function withManager(state, idx, fn){ const keep = state.cur; saveCurrent(state); setCurrent(state, idx); const r = fn(state); saveCurrent(state); setCurrent(state, keep); return r; }
function newsTo(state, clubId, text, kind='info'){ const m = managerOf(state, clubId); if (!m) return; const arr = (state.managers[state.cur]===m)? state.news : m.news; arr.unshift({s:state.season, w:state.week, text, kind}); if (arr.length>40) arr.pop(); }
function newsAll(state, text, kind='info'){ for (const m of activeManagers(state)){ const arr = (state.managers[state.cur]===m)? state.news : m.news; arr.unshift({s:state.season, w:state.week, text, kind}); if (arr.length>40) arr.pop(); } }
function retireManager(state, idx){
  const m = state.managers[idx]; if (!m) return; saveCurrent(state); m.retired = true;
  const c = state.clubs[m.userClub]; if (c.players.length<16) youthFill(state, c, 16);
  const next = state.managers.findIndex(x=>!x.retired);
  if (next>=0) setCurrent(state, next);
}
function standings(state){
  return activeManagers(state).map(m=>{ const c = state.clubs[m.userClub]; const h = c.history[c.history.length-1]; const pos = (state.week===1 && h)? h.pos : c.leaguePos; return { m, c, pos, score: (5-c.div)*100 - pos + (c.balance>0? Math.min(c.balance,1e6)/1e7 : 0) }; })
    .sort((a,b)=>b.score-a.score);
}

// ---------- Finance ----------
function turnover(state, club){ return Math.min(supportOf(state, club)*priceFactor(club), club.capacity)*ticketOf(club)*15 + CFG.TV[club.div] + sponsorBase(state, club); }
function setTicketPrice(state, price){
  const u = state.clubs[state.userClub];
  price = Math.round(price*2)/2;
  if (!isFinite(price) || price<CFG.TICKET_MIN || price>CFG.TICKET_MAX) return `Tickets must be between £${CFG.TICKET_MIN} and £${CFG.TICKET_MAX}.`;
  u.ticket = price; return null;
}
function ticketAdvice(state, club){
  const going = CFG.TICKET[club.div], cur = ticketOf(club), e = CFG.TICKET_ELASTICITY;
  const support = supportOf(state, club), cap = club.capacity;
  const gateAt = p => Math.min(cap, Math.round(support*Math.pow(p/going, -e)));
  let suggested = going;
  if (support > cap) suggested = going*Math.pow(support/cap, 1/e);     // the price at which a typical crowd just fills the ground
  suggested = Math.round(clamp(suggested, going*0.8, going*2.5)*2)/2;
  return { current: cur, going, suggested, gateNow: gateAt(cur), gateSuggested: gateAt(suggested), revenueNow: Math.round(gateAt(cur)*cur), revenueSuggested: Math.round(gateAt(suggested)*suggested), sellingOut: gateAt(cur)>=cap };
}
function overdraftLimit(state, club){ return Math.max(CFG.OVERDRAFT_MIN, round500(turnover(state, club)*CFG.OVERDRAFT_TURNOVER)); }
function ticketOf(club){ return club.ticket || CFG.TICKET[club.div]; }
function priceFactor(club){ return Math.pow(ticketOf(club)/CFG.TICKET[club.div], -CFG.TICKET_ELASTICITY); }
function credit(state, club, amount, label){
  club.balance += amount;
  if (isHuman(state, club.id)){ club.ledger.push({s:state.season, w:state.week, label, amount}); if (club.ledger.length>200) club.ledger.shift(); }
}
function staffWages(club){ const m = CFG.STAFF_DIV_MULT[club.div]; return Math.round(m*(CFG.STAFF_WAGE[club.staff.coach]+CFG.STAFF_WAGE[club.staff.physio]+CFG.STAFF_WAGE[club.staff.scout])); }
function weeklyFinance(state, club){
  const wages = squadOf(state, club).reduce((s,p)=>s+p.wage,0);
  credit(state, club, -wages, 'Wages');
  credit(state, club, -staffWages(club), 'Staff wages');
  credit(state, club, -Math.round(club.capacity*CFG.GROUND_COST_PER_SEAT), 'Ground upkeep');
  if (club.balance<0) credit(state, club, -Math.round(-club.balance*CFG.INTEREST_WEEKLY), 'Overdraft interest');
  else if (club.balance>0) credit(state, club, Math.round(club.balance*CFG.DEPOSIT_WEEKLY), 'Bank interest');
}

// ---------- Board confidence ----------
function confMatch(club, opp, result, isCup){
  const strongerOpp = opp.prestige>club.prestige;
  let d = 0;
  if (result==='W') d = strongerOpp? 4 : 2;
  else if (result==='D') d = strongerOpp? 1 : 0;
  else d = strongerOpp? -2 : -4;
  if (isCup) d *= 0.5;
  club.confidence = clamp(club.confidence + d, 0, 100);
}

// ---------- News ----------
function news(state, text, kind='info'){ state.news.unshift({s:state.season, w:state.week, text, kind}); if (state.news.length>40) state.news.pop(); }

// ---------- Week ----------
function cupDraw(state, key){
  const cup = state.cups[key];
  const alive = shuffle(cup.alive.slice());
  cup.ties = [];
  for (let i=0;i<alive.length;i+=2) cup.ties.push({h:alive[i], a:alive[i+1]});
}
const CUP_ROUND_NAMES = ['First Round','Second Round','Third Round','Quarter-Final','Semi-Final','Final'];

function advanceWeek(state){
  const wk = state.schedule[state.week-1];
  const results = [];
  saveCurrent(state);
  const keepCur = state.cur;
  for (const m of activeManagers(state)){
    withManager(state, state.managers.indexOf(m), st=>{
      if (st.preseason && st.preseason.pending) applyPreseasonDefaults(st);
      const c = st.clubs[st.userClub]; c.xi = buildXI(st, c, st.userSel||[], c.formation);
    });
  }
  if (wk.type==='league'){
    for (const d of [1,2,3,4]){
      for (const f of state.fixtures[d][wk.round]){
        const h = state.clubs[f.h], a = state.clubs[f.a];
        const opts = {};
        if (h.xi) opts.xiH = h.xi;
        if (a.xi) opts.xiA = a.xi;
        const m = playMatch(state, h, a, opts);
        recordLeague(m); results.push(m);
        const hmg = managerOf(state, h.id); const holders = (hmg && hmg.seasonTicket)? Math.round(hmg.seasonTicket.sold*CFG.ST_HOLDER_WALKUP) : 0;
        credit(state, h, Math.round(Math.max(0, m.att-holders)*ticketOf(h)), 'Gate receipts');
        recordGate(h, m.att);
        const rh = m.gH>m.gA?'W':m.gH<m.gA?'L':'D', ra = rh==='W'?'L':rh==='L'?'W':'D';
        confMatch(h,a,rh,false); confMatch(a,h,ra,false);
      }
    }
    updatePositions(state);
  } else {
    const key = wk.cup, cup = state.cups[key], def = CFG.CUPS[key];
    const r = wk.round; cup.round = r;
    const neutral = r===5;
    const nextAlive = [];
    for (const t of cup.ties){
      const h = state.clubs[t.h], a = state.clubs[t.a];
      const opts = {knockout:true, neutral, finalAtt: def.finalAtt};
      if (h.xi) opts.xiH = h.xi;
      if (a.xi) opts.xiA = a.xi;
      const m = playMatch(state, h, a, opts); m.cup = r; m.cupKey = key; results.push(m);
      const hWins = m.gH>m.gA || m.extra==='pens-H';
      const winner = hWins? h : a, loser = hWins? a : h;
      if (neutral){ const g = Math.round(m.att*def.finalTicket/2); credit(state,h,g,`${def.name} final gate`); credit(state,a,g,`${def.name} final gate`); }
      else { credit(state, h, Math.round(m.att*ticketOf(h)), `${def.name} gate`); recordGate(h, m.att); }
      credit(state, winner, def.prize[r], `${def.name} prize money`);
      if (r===5) credit(state, loser, def.runnerUp, `${def.name} runner-up`);
      winner.cup[key].round = r+1; loser.cup[key].out = true; nextAlive.push(winner.id);
      confMatch(winner, loser, 'W', true); confMatch(loser, winner, 'L', true);
      if (r===5){ state.cupWinners[key] = winner.id; state.cupRunnersUp = state.cupRunnersUp||{}; state.cupRunnersUp[key] = loser.id; const wm = managerOf(state, winner.id); if (wm) wm.trophies[key]++; newsAll(state, `${winner.name} win the ${def.name}, beating ${loser.name} ${Math.max(m.gH,m.gA)}-${Math.min(m.gH,m.gA)}${m.extra?' ('+(m.extra.startsWith('pens')?'on penalties':'aet')+')':''}.`, 'cup'); }
    }
    cup.alive = nextAlive;
    if (nextAlive.length>1) cupDraw(state, key); else cup.ties = [];
    cup.history.push(results.map(m=>({h:m.home.id,a:m.away.id,gH:m.gH,gA:m.gA,extra:m.extra})));
  }
  playEuroWeek(state, results);
  // recovery + finance for all clubs
  const fresh = new Set(); for (const m of results) for (const p of m.injuries) fresh.add(p.id);
  for (const c of state.clubs){
    c.xi = null;
    const rec = 5 + CFG.PHYSIO_RECOVERY[c.staff.physio] + (isHuman(state, c.id)? CFG.TRAIN[c.training].fit : 0);
    for (const p of squadOf(state,c)){
      if (p.injury>0 && !fresh.has(p.id)) p.injury--;
      p.fitness = clamp(p.fitness+rec, 30, 100);
    }
    weeklyFinance(state, c);
  }
  for (const mg of activeManagers(state)){
    withManager(state, state.managers.indexOf(mg), st=>{
      const u = st.clubs[st.userClub];
      trainingWeek(st, u);
      groundWeek(st, u, results);
      loanWeek(st, u);
      eventsWeek(st, u, results);
      if (st.sponsor && st.sponsor.type==='perwin' && wk.type==='league'){
        const m = results.find(x=>x.home.id===u.id||x.away.id===u.id);
        if (m){ const won = (m.home.id===u.id && m.gH>m.gA) || (m.away.id===u.id && m.gA>m.gH); if (won) credit(st, u, st.sponsor.perWin, `${st.sponsor.name} win bonus`); }
      }
      const userMatch = results.find(m=>!m.euro && (m.home.id===u.id||m.away.id===u.id));
      if (userMatch){
        for (const p of userMatch.injuries) if (p.club===u.id) news(st, `${p.name} injured, out for ${p.injury} week${p.injury>1?'s':''}.`, 'injury');
        const home = userMatch.home.id===u.id;
        st.userResults[st.week] = { opp: home? userMatch.away.id : userMatch.home.id, home, gF: home? userMatch.gH : userMatch.gA, gA: home? userMatch.gA : userMatch.gH, extra: userMatch.extra, cup: userMatch.cupKey||null, round: userMatch.cup, club: u.id };
      }
      const euroMatch = results.find(m=>m.euro && (m.home.id===u.id||m.away.id===u.id));
      if (euroMatch){
        for (const p of euroMatch.injuries) if (p.club===u.id) news(st, `${p.name} injured in Europe, out for ${p.injury} week${p.injury>1?'s':''}.`, 'injury');
        const home = euroMatch.home.id===u.id;
        st.userEuro = st.userEuro||{};
        st.userEuro[st.week] = { opp: home? euroMatch.away.id : euroMatch.home.id, home, gF: home? euroMatch.gH : euroMatch.gA, gA: home? euroMatch.gA : euroMatch.gH, extra: euroMatch.extra, comp: euroMatch.euro.comp, round: euroMatch.euro.round, leg: euroMatch.euro.leg, final: !!euroMatch.euro.final, agg: euroMatch.agg? (euroMatch.home.id===u.id? [euroMatch.agg.b, euroMatch.agg.a] : [euroMatch.agg.a, euroMatch.agg.b]) : null, club: u.id };
        if (euroMatch.agg && u.id===euroMatch.away.id){ /* away side is A in leg 2 */ st.userEuro[st.week].agg = [euroMatch.agg.a, euroMatch.agg.b]; }
        if (euroMatch.agg && u.id===euroMatch.home.id){ st.userEuro[st.week].agg = [euroMatch.agg.b, euroMatch.agg.a]; }
      }
      transferWeek(st);
      u.confidence = clamp(u.confidence + CFG.CONF_REVERT*(50-u.confidence), 0, 100);
      u.overdraftWeeks = u.balance < -overdraftLimit(st, u) ? u.overdraftWeeks+1 : 0;
      if (u.overdraftWeeks===CFG.OVERDRAFT_SACK_WEEKS-4) news(st, 'The bank is threatening to call in the overdraft. Sort the finances out.', 'warn');
      if (u.overdraftWeeks>=CFG.OVERDRAFT_SACK_WEEKS){ st.gameOver = 'The bank called in the overdraft. The board have sacked you.'; }
      if (u.confidence<=CFG.SACK_CONF && st.week>8){ st.gameOver = 'The board have lost patience with results. You have been sacked.'; }
      midSeasonJobs(st, u);
      if (st.jobOffer!==null && st.jobOfferExpires!==undefined && st.week>st.jobOfferExpires){ news(st, `${st.clubs[st.jobOffer].name} have appointed someone else.`, 'job'); st.jobOffer = null; }
      if (st.gameOver && !st.sackOffer) st.sackOffer = bottomClub(st);
    });
  }
  state.lastResults = results;
  state.lastWeek = wk;
  state.lastSlim = results.map(m=>({h:m.home.id, a:m.away.id, gH:m.gH, gA:m.gA, extra:m.extra, div:m.home.div, cup:m.cup, cupKey:m.cupKey, att:m.att, euro:m.euro||null, agg:m.agg||null}));
  state.lastWeekInfo = { season: state.season, week: state.week, type: wk.type, cup: wk.cup, round: wk.round };
  for (const mg of state.managers) mg.ready = false;
  if (state.week>=CFG.WEEKS) endSeason(state); else state.week++;
  setCurrent(state, keepCur);
  return results;
}

// ---------- Training and ground ----------
function trainingWeek(state, club){
  const t = CFG.TRAIN[club.training]; const coach = CFG.COACH_MULT[club.staff.coach];
  for (const p of squadOf(state, club)){
    if (p.injury>0) continue;
    if (t.inj>0 && rand()<t.inj){ p.injury = Math.max(1, Math.round(rInt(1,4)*CFG.PHYSIO_INJ_LEN[club.staff.physio])); news(state, `${p.name} picked up a knock in training, out ${p.injury} week${p.injury>1?'s':''}.`, 'injury'); continue; }
    if (p.age>=30 || p.skill>=p.pot) continue;
    if (rand() < CFG.TRAIN_BASE*coach*t.gain){ p.skill++; p.value = valueFor(p); if (rand()<0.35) news(state, `${p.name} is coming on in training. Skill now ${p.skill}.`, 'info'); }
  }
}
function groundWeek(state, club, results){
  club.safety = Math.max(0, club.safety - CFG.SAFETY_DECAY);
  if (club.build){
    club.build.weeksLeft--;
    if (club.build.weeksLeft<=0){ club.capacity += club.build.seats; news(state, `The new stand is open. Capacity is now ${fmt(club.capacity)}.`, 'info'); club.build = null; }
  }
  const m = results.find(x=>x.home.id===club.id && !x.neutral);
  if (m && club.safety < CFG.CROWD_TROUBLE_BELOW){
    const chance = (CFG.CROWD_TROUBLE_BELOW - club.safety)/200;
    if (rand()<chance){
      const fine = round500(m.att*2);
      credit(state, club, -fine, 'Crowd trouble fine');
      club.safety = Math.max(0, club.safety-3);
      club.confidence = clamp(club.confidence-3, 0, 100);
      news(state, `Crowd trouble at the ${m.away.short} game. The FA fine you £${fmt(fine)} and want the ground sorted out.`, 'warn');
    }
  }
  if (club.safety < CFG.SAFETY_RESTRICT_BELOW && state.week%6===0) news(state, 'Your ground is a safety risk. Capacity is restricted until you spend on it.', 'warn');
}
function setStaff(state, role, tier){ const u = state.clubs[state.userClub]; if (['coach','physio','scout'].includes(role) && tier>=0 && tier<=3) u.staff[role] = tier; }
function setTraining(state, level){ if (CFG.TRAIN[level]) state.clubs[state.userClub].training = level; }
function buildCost(seats){ return seats*CFG.SEAT_COST; }
function startBuild(state, seats){
  const u = state.clubs[state.userClub]; const cost = buildCost(seats);
  if (u.build) return 'Builders are already in.';
  if (u.balance - cost < -overdraftLimit(state, u)) return 'The bank will not fund that.';
  credit(state, u, -cost, `New ${fmt(seats)}-seat stand`); u.build = { seats, weeksLeft: CFG.BUILD_WEEKS };
  news(state, `Work starts on a ${fmt(seats)}-seat stand. Ready in ${CFG.BUILD_WEEKS} weeks.`, 'info');
  return null;
}
function safetyCost(club, points){ return Math.max(5000, round500(club.capacity*CFG.SAFETY_COST_PER_SEAT*points)); }
function improveSafety(state, points){
  const u = state.clubs[state.userClub]; const cost = safetyCost(u, points);
  if (u.safety>=100) return 'The ground is as safe as it gets.';
  if (u.balance - cost < -overdraftLimit(state, u)) return 'The bank will not fund that.';
  credit(state, u, -cost, 'Ground safety work'); u.safety = Math.min(100, u.safety+points);
  return null;
}
function canSeePot(state, p){
  const u = state.clubs[state.userClub]; const scout = u.staff.scout;
  if (p.club===u.id) return scout>=1;
  if (state.transferList.some(t=>t.pid===p.id)) return scout>=2;
  if ((state.scoutReport||[]).includes(p.id)) return scout>=2;
  return scout>=3;
}
const SCOUT_REACH = [0, 1, 4, 4];      // divisions either side of yours the scout will cover
const SCOUT_RESULTS = [5, 10, 20, 40];
function scoutSearch(state, brief){
  const u = state.clubs[state.userClub]; const tier = u.staff.scout;
  const reach = SCOUT_REACH[tier];
  const out = [];
  for (const c of state.clubs){
    if (c.id===u.id || Math.abs(c.div-u.div)>reach) continue;
    if (c.div===0 && tier<3) continue;
    for (const id of c.players){
      const p = state.players[id];
      if (brief.pos && brief.pos!=='ANY' && p.pos!==brief.pos) continue;
      if (brief.ageMin!==undefined && p.age<brief.ageMin) continue;
      if (brief.ageMax!==undefined && p.age>brief.ageMax) continue;
      if (brief.minSkill && p.skill<brief.minSkill) continue;
      if (brief.maxValue && p.value>brief.maxValue) continue;
      out.push(p);
    }
  }
  out.sort((a,b)=>b.skill-a.skill || a.age-b.age || a.value-b.value);
  const list = tier===0? shuffle(out).slice(0, SCOUT_RESULTS[0]).sort((a,b)=>b.skill-a.skill) : out.slice(0, SCOUT_RESULTS[tier]);
  state.scoutReport = list.map(p=>p.id);
  return { list, total: out.length };
}

// ---------- Sponsors, season tickets, loans, events ----------
function sponsorBase(state, club){ const exp = expectedPos(state, club); return round500(CFG.SPONSOR_BASE[club.div]*(0.7 + 0.6*(16-exp)/15)); }
function sponsorOffers(state, club){
  const base = sponsorBase(state, club);
  const pool = club.div<=2? SPONSORS_NATIONAL : SPONSORS_LOCAL;
  const names = shuffle(pool.slice()).slice(0,3);
  return [
    { type:'safe', name:names[0], amount: base },
    { type:'perwin', name:names[1], perWin: round500(base/12) },
    { type:'bold', name:names[2], amount: round500(base*1.6), clawback: round500(base*1.3) },
  ];
}
function seasonTicketForecast(state, club, mult){
  const price = Math.round(ticketOf(club)*mult);
  const ratio = mult/15;
  const takeup = ratio<=0.53? 0.9 : ratio<=0.67? 0.7 : ratio<=0.8? 0.45 : 0.15;
  const last = club.history.length? club.history[club.history.length-1] : null;
  let form = 1;
  if (last){ form *= 1 + 0.3*(8.5-last.pos)/16; if (last.div>club.div) form *= 1.2; if (last.div<club.div) form *= 0.85; }
  const base = club.capacity*CFG.FILL[club.div]*0.5*form;
  const sold = Math.min(Math.round(base*takeup/10)*10, Math.round(club.capacity*0.6));
  return { mult, price, sold, income: sold*price };
}
function openPreseason(state){
  const club = state.clubs[state.userClub];
  state.preseason = { pending:true, offers: sponsorOffers(state, club), sponsorDone:false, ticketsDone:false };
  state.sponsor = null; state.seasonTicket = null;
}
function chooseSponsor(state, idx){
  const ps = state.preseason; if (!ps || ps.sponsorDone) return 'Already signed.';
  const o = ps.offers[idx]; if (!o) return 'No such offer.';
  const u = state.clubs[state.userClub];
  state.sponsor = Object.assign({}, o);
  if (o.type!=='perwin') credit(state, u, o.amount, `${o.name} sponsorship`);
  ps.sponsorDone = true; if (ps.ticketsDone) ps.pending = false;
  news(state, `${o.name} are the new shirt sponsor.`, 'info');
  return null;
}
function setSeasonTickets(state, mult){
  const ps = state.preseason; if (!ps || ps.ticketsDone) return 'Season tickets have already gone on sale.';
  const u = state.clubs[state.userClub];
  const f = seasonTicketForecast(state, u, mult);
  state.seasonTicket = { price: f.price, sold: f.sold, mult };
  credit(state, u, f.income, 'Season tickets');
  ps.ticketsDone = true; if (ps.sponsorDone) ps.pending = false;
  news(state, `${fmt(f.sold)} season tickets sold at £${f.price}.`, 'info');
  return null;
}
function applyPreseasonDefaults(state){
  const ps = state.preseason;
  if (!ps.sponsorDone) chooseSponsor(state, 0);
  if (!ps.ticketsDone) setSeasonTickets(state, 12);
  ps.pending = false;
}
function loanMax(state, club){ return 2*overdraftLimit(state, club); }
function takeLoan(state, amount){
  const u = state.clubs[state.userClub];
  if (state.loan) return 'You already have a loan. Pay it off first.';
  if (amount<=0) return 'Borrow something or nothing.';
  amount = Math.min(Math.round(amount), loanMax(state, u));
  const weekly = Math.round(amount*(1+CFG.LOAN_RATE)/CFG.LOAN_WEEKS);
  state.loan = { amount, weekly, weeksLeft: CFG.LOAN_WEEKS };
  credit(state, u, amount, 'Bank loan');
  news(state, `The bank lend you £${fmt(amount)}, repaid at £${fmt(weekly)} a week over ${CFG.LOAN_WEEKS} weeks.`, 'info');
  return null;
}
function repayLoan(state){
  const u = state.clubs[state.userClub]; const l = state.loan; if (!l) return 'No loan to repay.';
  const due = round500(l.weekly*l.weeksLeft*0.95);
  if (u.balance - due < -overdraftLimit(state, u)) return 'You cannot cover that.';
  credit(state, u, -due, 'Loan settled early'); state.loan = null;
  return null;
}
function loanWeek(state, club){
  const l = state.loan; if (!l) return;
  credit(state, club, -l.weekly, 'Loan repayment'); l.weeksLeft--;
  if (l.weeksLeft<=0){ state.loan = null; news(state, 'The bank loan is paid off.', 'info'); }
}
function eventsWeek(state, club, results){
  const em = results.find(x=>x.euro && x.home.id===club.id && !x.euro.final);
  if (em && rand()<0.5){ const amount = round500(CFG.EVENT_TV[club.div]*2); credit(state, club, amount, 'European television fee'); news(state, `The ${em.away.short} tie was shown live. Television money: £${fmt(amount)}.`, 'info'); }
  const m = results.find(x=>!x.euro && (x.home.id===club.id||x.away.id===club.id));
  const home = m && m.home.id===club.id && !m.neutral;
  // television
  if (home){
    let chance = 0.04 + (club.div===1? 0.1 : club.div===2? 0.04 : 0) + (m.cup!==undefined && m.cup>=2? 0.15 : 0);
    if (rand()<chance){
      const amount = round500(CFG.EVENT_TV[club.div]*(m.cup!==undefined? 1.5 : 1));
      credit(state, club, amount, 'Television fee');
      news(state, `The cameras were at the ${m.away.short} game. Television money: £${fmt(amount)}.`, 'info');
    }
  }
  // giant-killing bonus
  if (m && m.cup!==undefined){
    const opp = m.home.id===club.id? m.away : m.home;
    const won = (m.home.id===club.id && (m.gH>m.gA||m.extra==='pens-H')) || (m.away.id===club.id && (m.gA>m.gH||m.extra==='pens-A'));
    if (won && opp.div<=club.div-2){ const bonus = round500(CFG.TV[club.div]*0.15); credit(state, club, bonus, "Chairman's bonus"); news(state, `The chairman is beside himself after the ${opp.short} result and has found £${fmt(bonus)} for you.`, 'info'); }
  }
  // bruising match
  if (m && rand()<0.015){
    const xi = m.home.id===club.id? m.xiH : m.xiA;
    const victims = shuffle(xi.filter(x=>x.p.injury===0).slice()).slice(0,2);
    for (const x of victims){ x.p.injury = Math.max(1, Math.round(rInt(1,4)*CFG.PHYSIO_INJ_LEN[club.staff.physio])); }
    if (victims.length) news(state, `A bruising game. ${victims.map(x=>x.p.name).join(' and ')} limped off and will miss ${victims.map(x=>x.p.injury).join(' and ')} weeks.`, 'injury');
  }
  // the ground bites back
  if (rand()<0.015){
    const bill = round500(club.capacity*(0.5+rand()));
    credit(state, club, -bill, pick(['Floodlight repairs','Roof repairs','Drainage work','Turnstile repairs']));
    news(state, `${club.ledger[club.ledger.length-1].label} at the ground: £${fmt(bill)}.`, 'warn');
  }
}

// ---------- Top scorers ----------
function topScorers(state, div, n=10){
  const out = [];
  for (const c of state.clubs){ if (div && c.div!==div) continue; for (const id of c.players){ const p = state.players[id]; if (p.goals>0) out.push(p); } }
  out.sort((a,b)=>b.goals-a.goals || a.apps-b.apps || a.name.localeCompare(b.name));
  return out.slice(0, n);
}

// ---------- Renaming ----------
function cleanName(v, max){ return String(v||'').replace(/\s+/g,' ').trim().slice(0,max); }
function renameClub(state, name, short){
  const u = state.clubs[state.userClub];
  name = cleanName(name, 28); short = cleanName(short, 12) || name.slice(0,12);
  if (name.length<2) return 'The club needs a name.';
  const old = u.name; u.name = name; u.short = short;
  if (old!==name) newsAll(state, `${old} will now be known as ${name}.`, 'info');
  return null;
}
function renameAnyClub(state, clubId, name, short){
  const c = state.clubs[clubId]; if (!c) return 'No such club.';
  const hm = managerOf(state, clubId); if (hm && clubId!==state.userClub) return `${hm.managerName} manages that club. Only they can rename it.`;
  name = cleanName(name, 28); short = cleanName(short, 12) || name.slice(0,12);
  if (name.length<2) return 'The club needs a name.';
  const old = c.name; c.name = name; c.short = short;
  if (old!==name) newsAll(state, `${old} will now be known as ${name}.`, 'info');
  return null;
}
function renamePlayer(state, pid, name){
  const p = state.players[pid];
  if (!p || p.club!==state.userClub) return 'You can only rename your own players.';
  name = cleanName(name, 24);
  if (name.length<2) return 'He needs a name.';
  const old = p.name; p.name = name;
  news(state, `${old} is now registered as ${name}.`, 'info');
  return null;
}

// ---------- Careers: sackings, resignations, job offers ----------
function bottomClub(state){
  const tb = tableFor(state, 4).filter(c=>!isHuman(state, c.id));
  return tb[tb.length-1].id;
}
function moveManager(state, clubId){
  const old = state.clubs[state.userClub];
  old.xi = null; for (const p of squadOf(state,old)) p.listed = null;
  if (old.players.length<16 && !state.managers.some(m=>!m.retired && m!==state.managers[state.cur] && m.userClub===old.id)) youthFill(state, old, 16);
  const c = state.clubs[clubId];
  state.userClub = c.id; c.confidence = CFG.CONF_START; c.overdraftWeeks = 0; c.ledger = []; c.xi = null; c.training = 'normal';
  state.offers = []; state.loan = null; state.jobOffer = null; state.sackOffer = null; state.gameOver = null;
  if (state.preseason && state.preseason.pending){ state.preseason.offers = sponsorOffers(state, c); state.sponsor = null; state.seasonTicket = null; }
  else { state.sponsor = null; state.seasonTicket = null; }
  transferWeek(state);
}
function takeSackOffer(state){
  const id = state.sackOffer; if (id===null || id===undefined) return 'No offer on the table.';
  const c = state.clubs[id];
  moveManager(state, id);
  news(state, `You start again at ${c.name}, bottom of Division 4. The only way is up. Probably.`, 'job');
  return null;
}
function resign(state){
  const u = state.clubs[state.userClub];
  state.gameOver = `You resigned from ${u.name}.`;
  state.sackOffer = bottomClub(state);
}
function midSeasonJobs(state, user){
  if (![12,21,30].includes(state.week) || state.jobOffer!==null || state.gameOver) return;
  updatePositions(state);
  const exp = expectedPos(state, user);
  const cupRun = ['lc','fa'].some(k=>!user.cup[k].out && user.cup[k].round>=3);
  if (!(user.leaguePos <= exp-4 || cupRun) || rand()>0.3) return;
  const cands = state.clubs.filter(c=>c.div>=1 && !isHuman(state, c.id) && c.prestige>user.prestige+8 && c.prestige<=user.prestige+24);
  if (!cands.length) return;
  const c = pick(cands);
  state.jobOffer = c.id; state.jobOfferExpires = state.week+2;
  news(state, `${c.name} have sacked their manager and want to talk to you. Decide within two weeks.`, 'job');
}

// ---------- Transfers ----------
function transferWeek(state){
  const user = state.clubs[state.userClub];
  // refresh transfer list: 8 fringe players from nearby divisions
  const pool = [];
  for (const c of state.clubs){
    if (isHuman(state, c.id) || c.div===0 || Math.abs(c.div-user.div)>1 || c.players.length<15) continue;
    const sq = squadOf(state,c).slice().sort((a,b)=>b.skill-a.skill);
    for (const p of sq.slice(8)) pool.push(p);
  }
  shuffle(pool);
  const n = CFG.SCOUT_LIST[user.staff.scout];
  let list = pool.slice(0, n);
  if (user.staff.scout>=2){
    // a good scout finds a couple of young players with something about them
    const gems = pool.filter(p=>p.age<=23 && p.pot-p.skill>=10 && !list.includes(p)).slice(0, user.staff.scout>=3? 3 : 2);
    list = gems.concat(list).slice(0, n);
  }
  state.transferList = list.map(p=>({pid:p.id, price: round500(p.value*(0.9+0.2*rand()))}));
  // offers for listed players
  state.offers = state.offers.filter(o=>o.expires>state.week && o.season===state.season);
  for (const p of squadOf(state,user)){
    if (p.listed===null) continue;
    const askRatio = p.listed/Math.max(p.value,1);
    const chance = askRatio<=1? 0.35 : askRatio<=1.3? 0.2 : 0.08;
    if (rand()<chance){
      const buyers = state.clubs.filter(c=>!isHuman(state, c.id) && c.div<=Math.min(4,user.div+1) && c.players.length<20);
      if (!buyers.length) continue;
      const buyer = pick(buyers);
      const amount = round500(Math.min(p.listed, p.value*(0.85+0.3*rand())));
      state.offers.push({pid:p.id, club:buyer.id, name:buyer.name, amount, expires: state.week+2, season: state.season});
      news(state, `${buyer.name} offer £${fmt(amount)} for ${p.name}.`, 'offer');
    }
  }
  // european raid
  if (user.div<=3 && rand()<0.04){
    const best = squadOf(state,user).slice().sort((a,b)=>b.skill-a.skill)[0];
    const raiders = divClubs(state,0).filter(c=>c.rating>=72 && c.players.length<20);
    if (best && best.skill>=60 && best.age<=30 && raiders.length){
      const buyer = pick(raiders);
      const amount = round500(best.value*(1.8+1.2*rand()));
      state.offers.push({pid:best.id, club:buyer.id, name:buyer.name, amount, expires: state.week+2, season: state.season, euro:true});
      news(state, `${buyer.name} want ${best.name}. They are offering £${fmt(amount)}.`, 'offer');
    }
  }
}
function fmt(n){ return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

function buyFromList(state, pid){
  const user = state.clubs[state.userClub];
  const entry = state.transferList.find(t=>t.pid===pid); if (!entry) return 'Not on the list any more.';
  const p = state.players[pid]; const seller = p? state.clubs[p.club] : null;
  if (!p || !seller || seller.id===user.id){ state.transferList = state.transferList.filter(t=>t.pid!==pid); return 'He is no longer available.'; }
  if (user.players.length>=20) return 'Squad is full (20 max).';
  if (user.balance - entry.price < -overdraftLimit(state, user)) return 'The bank will not fund that.';
  movePlayer(state, p, seller, user, entry.price); credit(state, user, -entry.price, `Bought ${p.name}`);
  state.transferList = state.transferList.filter(t=>t.pid!==pid);
  news(state, `Signed ${p.name} from ${seller.name} for £${fmt(entry.price)}.`, 'transfer');
  return null;
}
function bidForPlayer(state, pid, amount){
  const user = state.clubs[state.userClub];
  const p = state.players[pid]; const seller = state.clubs[p.club];
  if (!seller || seller.id===user.id) return 'Not available.';
  if (user.players.length>=20) return 'Squad is full (20 max).';
  if (user.balance - amount < -overdraftLimit(state, user)) return 'The bank will not fund that.';
  const sm = managerOf(state, seller.id);
  if (sm){
    if (sm.offers.some(o=>o.pid===p.id && o.human===state.cur)) return 'You already have a bid in for him.';
    sm.offers.push({pid:p.id, club:user.id, name:`${user.name} (${state.managerName})`, amount, expires: state.week+2, season: state.season, human: state.cur});
    const arr = sm.news; arr.unshift({s:state.season, w:state.week, text:`${state.managerName} at ${user.name} have bid £${fmt(amount)} for ${p.name}.`, kind:'offer'}); if (arr.length>40) arr.pop();
    news(state, `Bid of £${fmt(amount)} for ${p.name} sent to ${sm.managerName}. They decide on their turn.`, 'transfer');
    return null;
  }
  if (seller.players.length<=14) return `${seller.name} will not sell, they are short of players.`;
  const since = weeksSinceSigning(state, p);
  if (since < CFG.RESALE_WEEKS) return `${seller.name} only signed him ${since===0? 'this week' : since+' week'+(since===1?'':'s')+' ago'}. They are not listening.`;
  const ratio = amount/Math.max(p.value, p.paid||0);
  const acc = ratio>=1.6? 0.95 : ratio>=1.3? 0.55 : ratio>=1.1? 0.2 : 0.03;
  if (rand()>acc){ news(state, `${seller.name} reject your £${fmt(amount)} bid for ${p.name}.`, 'transfer'); return 'Bid rejected.'; }
  movePlayer(state, p, seller, user, amount); credit(state, user, -amount, `Bought ${p.name}`);
  state.transferList = state.transferList.filter(t=>t.pid!==pid);
  news(state, `Signed ${p.name} from ${seller.name} for £${fmt(amount)}.`, 'transfer');
  return null;
}
function acceptOffer(state, offerIdx){
  const user = state.clubs[state.userClub];
  const o = state.offers[offerIdx]; if (!o) return 'Offer gone.';
  const p = state.players[o.pid];
  if (user.players.length<=11) return 'You cannot go below 11 players.';
  if (o.human!==undefined){
    const buyer = state.clubs[o.club]; const bm = state.managers[o.human];
    if (!bm || bm.retired || bm.userClub!==buyer.id){ state.offers = state.offers.filter(x=>x!==o); return 'That manager has moved on. Bid withdrawn.'; }
    if (buyer.players.length>=20){ state.offers = state.offers.filter(x=>x!==o); return `${buyer.name} have a full squad now. Bid withdrawn.`; }
    if (buyer.balance - o.amount < -overdraftLimit(state, buyer)){ state.offers = state.offers.filter(x=>x!==o); return `${bm.managerName} can no longer afford it. Bid withdrawn.`; }
    movePlayer(state, p, user, buyer, o.amount);
    credit(state, user, o.amount, `Sold ${p.name}`); credit(state, buyer, -o.amount, `Bought ${p.name}`);
    const arr = bm.news; arr.unshift({s:state.season, w:state.week, text:`${state.managerName} accepted. ${p.name} joins ${buyer.name} for £${fmt(o.amount)}.`, kind:'transfer'}); if (arr.length>40) arr.pop();
    news(state, `${p.name} sold to ${buyer.name} for £${fmt(o.amount)}.`, 'transfer');
    state.offers = state.offers.filter(x=>x.pid!==o.pid);
    return null;
  }
  if (o.euro && o.club<0){ removePlayer(state, p, user); } else { movePlayer(state, p, user, state.clubs[o.club], o.amount); }
  credit(state, user, o.amount, `Sold ${p.name}`);
  news(state, `${p.name} sold to ${o.name} for £${fmt(o.amount)}.`, 'transfer');
  state.offers = state.offers.filter(x=>x.pid!==o.pid);
  return null;
}
function weeksSinceSigning(state, p){ if (p.signedS===undefined) return 999; return (state.season-p.signedS)*CFG.WEEKS + (state.week-p.signedW); }
function movePlayer(state, p, from, to, price){
  from.players = from.players.filter(id=>id!==p.id); to.players.push(p.id); p.club = to.id; p.listed = null;
  p.paid = price!==undefined? price : p.value; p.signedS = state.season; p.signedW = state.week;
  if (from.players.length<14 && !isHuman(state, from.id)) youthFill(state, from, 14);
}
function humanListings(state){
  const out = [];
  for (const m of activeManagers(state)){ if (m.userClub===state.userClub) continue; for (const id of state.clubs[m.userClub].players){ const p = state.players[id]; if (p.listed!==null) out.push({p, m}); } }
  return out;
}
function removePlayer(state, p, from){ from.players = from.players.filter(id=>id!==p.id); p.club = -1; }

// ---------- Season end ----------
function prizeFor(div, pos){ const top = CFG.PRIZE_TOP[div], bot = CFG.PRIZE_BOT[div]; return Math.round(top - (top-bot)*(pos-1)/15); }
function youthFill(state, club, target){
  const sq = squadOf(state, club);
  const mean = sq.length? sq.reduce((s,p)=>s+p.skill,0)/sq.length : (club.div===0? club.rating : CFG.DIV_MEAN[club.div]);
  while (club.players.length<target){
    const counts = {GK:0,DEF:0,MID:0,FWD:0}; squadOf(state,club).forEach(p=>counts[p.pos]++);
    const want = counts.GK<2?'GK':counts.DEF<5?'DEF':counts.MID<5?'MID':counts.FWD<4?'FWD':pick(['DEF','MID','FWD']);
    const p = makePlayer(state, want, Math.max(15, rNorm(mean-9, 5)), rInt(17,19), club.id); refreshValues(p); club.players.push(p.id);
    if (isHuman(state, club.id)) newsTo(state, club.id, `${p.name}, ${p.age}, promoted from the youth team.`, 'info');
  }
}
function developPlayers(state){
  for (const c of state.clubs){
    for (const p of squadOf(state,c)){
      p.age++;
      let d;
      if (p.age<=27){ const room = p.pot - p.skill; d = room>0? Math.min(room, rInt(0,1) + Math.round(room/10)) : rInt(-1,0); }
      else if (p.age<=30) d = rInt(-2,1); else d = rInt(-6,-2);
      p.skill = clamp(p.skill+d, 10, 99);
      if (p.age>=28) p.pot = p.skill;
      p.fitness = 100; p.injury = 0; p.goals = 0; p.apps = 0;
      if ((p.age>=34 && rand()<0.5) || p.age>=36){ p.retired = true; }
      refreshValues(p);
    }
    const retired = squadOf(state,c).filter(p=>p.retired);
    for (const p of retired){ removePlayer(state,p,c); if (isHuman(state, c.id)) newsTo(state, c.id, `${p.name} has retired.`, 'info'); }
  }
}
function aiStrengthen(state){
  for (const c of state.clubs){
    if (isHuman(state, c.id)) continue;
    const target = c.div===0? c.rating : CFG.DIV_MEAN[c.div] + (7.5 - (expectedPos(state,c)-1))*CFG.PRESTIGE_SKILL_SPREAD;
    let sq = squadOf(state,c).slice().sort((a,b)=>a.skill-b.skill);
    let mean = sq.reduce((s,p)=>s+p.skill,0)/sq.length;
    if (mean > target+2){
      const n = clamp(Math.ceil((mean-target)/2), 1, 3);
      for (let i=0;i<n;i++){
        const star = sq[sq.length-1-i]; removePlayer(state, star, c);
        const np = makePlayer(state, star.pos, rNorm(target-4, 5), randomAge(), c.id); refreshValues(np); c.players.push(np.id);
      }
    } else if (mean < target-1){
      const n = clamp(Math.ceil((target-mean)/1.2), 1, 8);
      for (let i=0;i<n && i<sq.length;i++){
        const old = sq[i]; removePlayer(state, old, c);
        const np = makePlayer(state, old.pos, rNorm(target+4, 5), randomAge(), c.id); refreshValues(np); c.players.push(np.id);
      }
    }
    youthFill(state, c, 16);
  }
}
function endSeason(state){
  saveCurrent(state); const keepCur = state.cur;
  const summary = { season: state.season, tables: {}, promoted: [], relegated: [], cupWinners: Object.assign({}, state.cupWinners) };
  updatePositions(state);
  // prizes, promotion, relegation
  const moves = [];
  for (const d of [1,2,3,4]){
    const tb = tableFor(state,d); summary.tables[d] = tb.map(c=>({id:c.id, name:c.name, st:{...c.st}}));
    tb.forEach((c,i)=>{
      const pos=i+1; credit(state, c, prizeFor(d,pos), 'League prize money');
      credit(state, c, CFG.TV[d], 'Television money');
      if (!isHuman(state, c.id)) credit(state, c, sponsorBase(state, c), 'Sponsorship');
      credit(state, c, -squadOf(state,c).reduce((s,p)=>s+p.wage,0)*CFG.SUMMER_WEEKS, 'Summer wages');
      const exp = expectedPos(state,c);
      c.confidence = clamp(c.confidence + (exp-pos)*2.5, 0, 100);
      if (pos<=2 && d>1){ moves.push({c, to:d-1}); summary.promoted.push(c.id); c.confidence = clamp(c.confidence+15,0,100); credit(state,c,CFG.PROMO_BONUS[d-1],'Promotion bonus'); }
      if (pos>=15 && d<4){ moves.push({c, to:d+1}); summary.relegated.push(c.id); c.confidence = clamp(c.confidence-15,0,100); }
      if (pos===16 && d===4 && isHuman(state, c.id)) newsTo(state, c.id, 'You have won the League Joker trophy. It is not a compliment.', 'warn');
      { const mg = managerOf(state, c.id); if (mg){ if (pos===1) mg.trophies.league++; if (pos<=2 && d>1) mg.trophies.promo++; } }
      c.history.push({season: state.season, div: d, pos, pts: c.st.pts, lc: c.cup.lc.round, fa: c.cup.fa.round, euro: (c.euro && state.euro)? {comp:c.euro.comp, round:c.euro.round, won: state.euro[c.euro.comp].winner===c.id} : null});
      // prestige drifts toward performance
      c.prestige = 0.8*c.prestige + 0.2*prestigeFor(d, pos-1);
    });
  }
  for (const mg of activeManagers(state)){
    withManager(state, state.managers.indexOf(mg), st=>{
      const user = st.clubs[st.userClub];
      const sm = Object.assign({}, summary);
      sm.userPos = user.leaguePos; sm.userDiv = user.div; sm.userExpected = expectedPos(st,user); sm.userClubId = user.id;
      sm.summerWages = squadOf(st,user).reduce((s,p)=>s+p.wage,0)*CFG.SUMMER_WEEKS;
      if (st.sponsor && st.sponsor.type==='bold'){
        const down = sm.relegated.includes(user.id) || (user.div===4 && user.leaguePos>=13);
        if (down){ credit(st, user, -st.sponsor.clawback, `${st.sponsor.name} clawback`); sm.clawback = st.sponsor.clawback; news(st, `${st.sponsor.name} invoke the relegation clause and take back £${fmt(st.sponsor.clawback)}.`, 'warn'); }
      }
      sm.userBalance = user.balance; sm.userConfidence = user.confidence;
      sm.euro = euroStatus(st, user); sm.euroWinners = {}; if (st.euro) for (const k in st.euro) sm.euroWinners[k] = st.euro[k].winner;
      const q = euroQualifiers(st, sm); sm.qualified = Object.keys(q).find(k=>q[k].includes(user.id)) || null;
      if (user.confidence<=CFG.SACK_CONF) st.gameOver = 'The board reviewed the season and decided to make a change. You have been sacked.';
      st.jobOffer = null;
      if (!st.gameOver){
        const overach = (sm.userExpected - sm.userPos) >= 4 || sm.promoted.includes(user.id);
        if (overach && rand()<0.45){
          const cands = st.clubs.filter(c=>c.div>=1 && !isHuman(st, c.id) && c.prestige>user.prestige+8 && c.prestige<=user.prestige+28 && !sm.relegated.includes(c.id));
          if (cands.length){ const c = pick(cands); st.jobOffer = c.id; st.jobOfferExpires = 2; news(st, `${c.name} have approached you about their vacant manager's job.`, 'job'); }
        }
      }
      st.seasonSummary = sm; mg.pendingReview = true;
    });
  }
  for (const mv of moves){ const up = mv.to<mv.c.div; mv.c.div = mv.to; mv.c.prestige = up? Math.max(mv.c.prestige, prestigeFor(mv.to,12)) : Math.min(mv.c.prestige, prestigeFor(mv.to,3)); }
  state.euroEntrants = euroQualifiers(state, summary);
  for (const c of state.clubs){ if (c.div>=1) c.support = Math.round((1-CFG.SUPPORT_BLEND)*supportOf(state, c) + CFG.SUPPORT_BLEND*demandTarget(state, c)); }
  developPlayers(state);
  aiStrengthen(state);
  for (const mg of activeManagers(state)){ const c = state.clubs[mg.userClub]; if (c.players.length<16) youthFill(state, c, 16); }
  for (const id in state.players) if (state.players[id].club===-1) delete state.players[id];
  for (const c of state.clubs){ c.st = {p:0,w:0,d:0,l:0,gf:0,ga:0,pts:0}; }
  state.season++; state.week = 1;
  buildSchedule(state); updatePositionsByPrestige(state);
  for (const mg of activeManagers(state)){
    withManager(state, state.managers.indexOf(mg), st=>{
      openPreseason(st);
      st.userResults = {}; st.userEuro = {};
      if (st.gameOver && !st.sackOffer) st.sackOffer = bottomClub(st);
      st.offers = []; st.transferList = [];
      transferWeek(st);
    });
  }
  setCurrent(state, keepCur);
}
function updatePositionsByPrestige(state){ for (const d of [1,2,3,4]) divClubs(state,d).slice().sort((a,b)=>b.prestige-a.prestige).forEach((c,i)=>c.leaguePos=i+1); }
function acceptJob(state){
  const c = state.clubs[state.jobOffer]; if (!c) return;
  moveManager(state, c.id);
  news(state, `You have taken over at ${c.name}.`, 'job');
}

// ---------- New game ----------
function newGame(opts={}){
  if (opts.seed!==undefined) seedRng(opts.seed);
  nextPlayerId = 1;
  const state = { season: 1, week: 1, players: {}, clubs: [], managers: [], cur: 0, cupWinners: {}, lastSlim: [], lastWeekInfo: null };
  CLUB_DATA.forEach(([div,name,short],i)=>{
    const idx = i%16;
    const c = { id:i, name, short, div, prestige: prestigeFor(div,idx), capacity: capacityFor(div,idx),
      balance: 0, players: [], formation:'4-4-2', confidence: CFG.CONF_START, overdraftWeeks:0, ledger: [], history: [],
      st:{p:0,w:0,d:0,l:0,gf:0,ga:0,pts:0}, leaguePos: idx+1, cup:{lc:{round:0,out:false}, fa:{round:0,out:false}}, xi:null,
      staff:{coach:1, physio:1, scout:1}, training:'normal', safety: clamp(Math.round(45 + prestigeFor(div,idx)/64*40 + rInt(-8,8)), 20, 95), build:null };
    const [bHi,bLo] = CFG.START_BALANCE[div]; c.balance = round500(bHi - (bHi-bLo)*idx/15);
    c.support = Math.round(c.capacity*CFG.FILL[div]);
    const mean = CFG.DIV_MEAN[div] + (7.5-idx)*CFG.PRESTIGE_SKILL_SPREAD;
    for (const pos of SQUAD_TEMPLATE){ const p = makePlayer(state, pos, rNorm(mean, CFG.SKILL_SD), randomAge(), c.id); refreshValues(p); c.players.push(p.id); }
    state.clubs.push(c);
  });
  makeEuroClubs(state);
  const names = opts.managers && opts.managers.length? opts.managers : [opts.managerName || 'The Gaffer'];
  return finishNewGame(state, opts, names);
}
function makeEuroClubs(state){
  if (state.clubs.some(c=>c.div===0)) return;
  EURO_POOL.forEach(([name,short,rating,group],k)=>{
    const id = state.clubs.length;
    const capacity = Math.round((8000 + (rating-40)*1600)/100)*100;
    const c = { id, name, short, div:0, rating, group, prestige: clamp((rating-36)*1.4, 0, 70), capacity, support: Math.round(capacity*0.7), ticket: 8,
      balance: 3000000, players: [], formation:'4-4-2', confidence: 60, overdraftWeeks:0, ledger: [], history: [],
      st:{p:0,w:0,d:0,l:0,gf:0,ga:0,pts:0}, leaguePos: 8, cup:{lc:{round:0,out:false}, fa:{round:0,out:false}}, xi:null,
      staff:{coach:2, physio:2, scout:2}, training:'normal', safety: 85, build:null, euro:null };
    state.clubs.push(c);
    for (const pos of SQUAD_TEMPLATE){ const p = makePlayer(state, pos, rNorm(rating, 6), randomAge(), c.id); refreshValues(p); c.players.push(p.id); }
  });
}
function finishNewGame(state, opts, names){
  const pool = shuffle(divClubs(state,4).map(c=>c.id));
  state.managers = names.slice(0,8).map((name,i)=>({ userClub: (i===0 && opts.userClub!==undefined)? opts.userClub : pool[i], managerName: name, userSel: [], sponsor:null, seasonTicket:null, loan:null, preseason:null,
    jobOffer:null, jobOfferExpires:undefined, sackOffer:null, gameOver:null, userResults:{}, userEuro:{}, euroSel:[], offers:[], transferList:[], news:[], seasonSummary:null, scoutReport:[], retired:false, ready:false, pendingReview:false, trophies:{league:0, lc:0, fa:0, promo:0, ec:0, cwc:0, uefa:0} }));
  if (opts.userClub!==undefined) for (let i=1;i<state.managers.length;i++) if (state.managers[i].userClub===opts.userClub) state.managers[i].userClub = pool[8];
  buildSchedule(state);
  for (let i=0;i<state.managers.length;i++){
    setCurrent(state, i);
    openPreseason(state); transferWeek(state);
    news(state, `Welcome to ${state.clubs[state.userClub].name}, ${state.managerName}. The board expect a mid-table finish. Prove them wrong.`, 'info');
    saveCurrent(state);
  }
  setCurrent(state, 0);
  return state;
}


// ---------- UI helpers ----------
function nextFixture(state){
  const wk = state.schedule[state.week-1]; const uid = state.userClub;
  if (wk.type==='league'){
    const f = state.fixtures[state.clubs[uid].div][wk.round].find(x=>x.h===uid||x.a===uid);
    return {type:'league', home: f.h===uid, opp: state.clubs[f.h===uid?f.a:f.h]};
  }
  const t = state.cups[wk.cup].ties.find(x=>x.h===uid||x.a===uid);
  if (!t) return {type:'none', cup: wk.cup, round: wk.round};
  return {type:'cup', cup: wk.cup, round: wk.round, home: t.h===uid, opp: state.clubs[t.h===uid?t.a:t.h], neutral: wk.round===5};
}
function buildXI(state, club, selectedIds, formationName){
  const fm = FORMATIONS[formationName||club.formation||'4-4-2'];
  const sel = (selectedIds||[]).map(id=>state.players[id]).filter(p=>p && p.club===club.id && p.injury===0);
  const need = [['GK',1],['DEF',fm.d],['MID',fm.m],['FWD',fm.f]];
  const used = new Set(); const xi = [];
  for (const [slot,n] of need){
    const c = sel.filter(p=>p.pos===slot&&!used.has(p.id)).sort((a,b)=>b.skill-a.skill);
    for (let i=0;i<n&&i<c.length;i++){ used.add(c[i].id); xi.push({p:c[i],slot}); }
  }
  const fill = (pool) => {
    for (const [slot,n] of need){
      let have = xi.filter(x=>x.slot===slot).length; if (have>=n) continue;
      const c = pool.filter(p=>!used.has(p.id)).sort((a,b)=>effSkill(b,slot)-effSkill(a,slot));
      for (const p of c){ if (have>=n) break; used.add(p.id); xi.push({p,slot}); have++; }
    }
  };
  fill(sel);
  if (xi.length<11){
    const rest = squadOf(state,club).filter(p=>p.injury===0 && !used.has(p.id));
    for (const [slot,n] of need){
      let have = xi.filter(x=>x.slot===slot).length; if (have>=n) continue;
      const c = rest.filter(p=>p.pos===slot && !used.has(p.id)).sort((a,b)=>b.skill-a.skill);
      for (const p of c){ if (have>=n) break; used.add(p.id); xi.push({p,slot}); have++; }
    }
    fill(rest);
  }
  return xi;
}
function listPlayer(state, pid, price){ const p = state.players[pid]; if (p && p.club===state.userClub) p.listed = price; }
function unlistPlayer(state, pid){ const p = state.players[pid]; if (p) p.listed = null; state.offers = state.offers.filter(o=>o.pid!==pid); }
function rejectOffer(state, idx){ state.offers.splice(idx,1); }
function declineJob(state){ state.jobOffer = null; }
function boardMood(conf){ return conf>=75?'delighted':conf>=55?'content':conf>=35?'uneasy':conf>=18?'worried':'furious'; }
const SAVE_VERSION = 3;
function migrate(state){
  const from = state.v||1;
  if (!state.managers){ // pre-multiplayer save: wrap the single manager
    state.managers = [{ userClub: state.userClub, managerName: state.managerName||'The Gaffer', userSel: state.userSel||[], sponsor: state.sponsor||null, seasonTicket: state.seasonTicket||null, loan: state.loan||null, preseason: state.preseason||null,
      jobOffer: state.jobOffer===undefined? null : state.jobOffer, jobOfferExpires: state.jobOfferExpires, sackOffer: state.sackOffer||null, gameOver: state.gameOver||null, userResults: state.userResults||{}, offers: state.offers||[], transferList: state.transferList||[], news: state.news||[], seasonSummary: state.seasonSummary||null, retired:false, ready:false, pendingReview:false, trophies:{league:0, lc:0, fa:0, promo:0} }];
    state.cur = 0;
  }
  for (const m of state.managers){ m.euroSel = m.euroSel||[]; m.userEuro = m.userEuro||{}; m.scoutReport = m.scoutReport||[]; m.trophies = Object.assign({league:0, lc:0, fa:0, promo:0, ec:0, cwc:0, uefa:0}, m.trophies||{}); }
  for (const c of state.clubs){
    c.staff = c.staff||{coach:1, physio:1, scout:1}; c.training = c.training||'normal'; if (c.safety===undefined) c.safety = 55; if (c.build===undefined) c.build = null;
    c.cup = c.cup||{lc:{round:0,out:false}, fa:{round:0,out:false}}; if (c.euro===undefined) c.euro = null; c.gates = c.gates||[];
  }
  if (!state.clubs.some(c=>c.div===0)){ makeEuroClubs(state); state.euro = null; for (const c of state.clubs) c.euro = null; }   // Europe starts next season
  if (!state.cups && state.cup){ state.cups = { fa: state.cup }; }
  state.v = SAVE_VERSION;
  return from;
}
function restore(state){ let m=0; for (const id in state.players) m=Math.max(m, +id); nextPlayerId = m+1; migrate(state); if (state.managers) setCurrent(state, state.cur||0); return state; }

// ---------- Exports ----------
const Engine = { CFG, CLUB_DATA, FORMATIONS, newGame, advanceWeek, endSeason, autoSelect, tableFor, squadOf, divClubs, expectedPos,
  buyFromList, bidForPlayer, acceptOffer, acceptJob, teamStrength, effSkill, fmt, seedRng, CUP_ROUND_NAMES, refreshValues, wageFor, valueFor,
  nextFixture, buildXI, listPlayer, unlistPlayer, rejectOffer, declineJob, boardMood, restore, prizeFor, overdraftLimit,
  setStaff, setTraining, startBuild, buildCost, improveSafety, safetyCost, canSeePot, staffWages,
  chooseSponsor, setSeasonTickets, seasonTicketForecast, takeLoan, repayLoan, loanMax, sponsorBase,
  takeSackOffer, resign, bottomClub, updatePositions,
  isHuman, managerOf, activeManagers, setCurrent, saveCurrent, withManager, retireManager, standings, humanListings, renameClub, renamePlayer, scoutSearch, topScorers, gateSummary, supportOf, demandTarget, turnover, ticketOf, setTicketPrice, ticketAdvice, renameAnyClub,
  euroSlot, euroTieFor, euroStatus, euroRoundName, EURO_POOL, SAVE_VERSION, migrate };
if (typeof module!=='undefined') module.exports = Engine;


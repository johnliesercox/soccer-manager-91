// ============================================================================
//  Matchday: capture adapter
//  Turns a finished match record (what the game's playMatch returned, after
//  every post-processing step has run) into an immutable MatchPresentation.
//  It reads the official record and the state; it never calls playMatch,
//  never touches the game's random generator and never mutates game objects.
//
//  Call it only once the week has been fully resolved: for European second
//  legs the game adjusts the score and extra after playMatch returns, and the
//  adapter must see the finalised figures.
// ============================================================================
(function(root){
  const MD = root.Matchday;

  // Kit colours are presentation data, not game data. Approximate 1990-91
  // colours; anything not listed gets a deterministic colour from its id.
  const KITS = {
    'Arsenal':['#EF0107','#FFFFFF'],'Liverpool':['#C8102E','#FFFFFF'],'Crystal Palace':['#1B458F','#C4122E'],'Leeds United':['#FFFFFF','#1D428A'],
    'Manchester City':['#6CABDD','#FFFFFF'],'Manchester United':['#DA291C','#FFFFFF'],'Wimbledon':['#0A2B8C','#FFD200'],'Nottingham Forest':['#E53233','#FFFFFF'],
    'Everton':['#003399','#FFFFFF'],'Tottenham Hotspur':['#FFFFFF','#132257'],'Chelsea':['#034694','#FFFFFF'],'Queens Park Rangers':['#1D5BA4','#FFFFFF'],
    'Sheffield United':['#EC2227','#FFFFFF'],'Southampton':['#D71920','#FFFFFF'],'Norwich City':['#FFF200','#00A650'],'Coventry City':['#78D0F1','#1F3B70'],
    'Oldham Athletic':['#004A97','#FFFFFF'],'West Ham United':['#7A263A','#1BB1E7'],'Sheffield Wednesday':['#0E63AD','#FFFFFF'],'Notts County':['#000000','#FFFFFF'],
    'Millwall':['#001D5E','#FFFFFF'],'Brighton & Hove Albion':['#0057B8','#FFFFFF'],'Middlesbrough':['#E21C23','#FFFFFF'],'Barnsley':['#E31B23','#FFFFFF'],
    'Bristol City':['#E21C38','#FFFFFF'],'Oxford United':['#FFF200','#1A3B8C'],'Newcastle United':['#241F20','#FFFFFF'],'Wolverhampton Wanderers':['#FDB913','#231F20'],
    'Bristol Rovers':['#0054A6','#FFFFFF'],'Ipswich Town':['#0044A9','#FFFFFF'],'Port Vale':['#FFFFFF','#000000'],'Charlton Athletic':['#D4021D','#FFFFFF'],
    'Cambridge United':['#F4B223','#000000'],'Southend United':['#1E3C92','#FFFFFF'],'Grimsby Town':['#231F20','#FFFFFF'],'Bolton Wanderers':['#FFFFFF','#263C7E'],
    'Tranmere Rovers':['#FFFFFF','#0033A0'],'Brentford':['#E30613','#FFFFFF'],'Bury':['#FFFFFF','#0E2B6B'],'Bradford City':['#F7A700','#7B1113'],
    'Bournemouth':['#DA291C','#000000'],'Wigan Athletic':['#1D5BA4','#FFFFFF'],'Huddersfield Town':['#0E63AD','#FFFFFF'],'Birmingham City':['#0000FF','#FFFFFF'],
    'Leyton Orient':['#E21B23','#FFFFFF'],'Stoke City':['#E03A3E','#FFFFFF'],'Reading':['#004494','#FFFFFF'],'Exeter City':['#E8282E','#FFFFFF'],
    'Darlington':['#FFFFFF','#000000'],'Stockport County':['#0A3B8C','#FFFFFF'],'Hartlepool United':['#1F8BD6','#FFFFFF'],'Peterborough United':['#0F4C9A','#FFFFFF'],
    'Blackpool':['#F68712','#FFFFFF'],'Burnley':['#6C1D45','#99D6EA'],'Torquay United':['#FFEB3B','#1E3C92'],'Scunthorpe United':['#B21E2F','#FFFFFF'],
    'Scarborough':['#E51A26','#FFFFFF'],'Northampton Town':['#8B1E3F','#FFFFFF'],'Doncaster Rovers':['#D81E27','#FFFFFF'],'Rochdale':['#1F3B70','#FFFFFF'],
    'Cardiff City':['#0070B5','#FFFFFF'],'Lincoln City':['#D71920','#FFFFFF'],'Gillingham':['#0054A6','#FFFFFF'],'Walsall':['#E0262F','#FFFFFF'],
    'AC Milan':['#FB090B','#000000'],'Juventus':['#FFFFFF','#000000'],'Internazionale':['#010E80','#000000'],'Real Madrid':['#FFFFFF','#FEBE10'],'Barcelona':['#A50044','#004D98'],
    'Bayern Munich':['#DC052D','#FFFFFF'],'Marseille':['#FFFFFF','#2FAEE0'],'PSV Eindhoven':['#ED1C24','#FFFFFF'],'Ajax':['#FFFFFF','#D2122E'],'Benfica':['#E83030','#FFFFFF'],
    'Porto':['#0056A7','#FFFFFF'],'Napoli':['#12A0D7','#FFFFFF'],'Rangers':['#1B458F','#FFFFFF'],'Celtic':['#16A34A','#FFFFFF'],'Red Star Belgrade':['#E31E24','#FFFFFF'],
  };
  function hashColour(id){ const h = MD.hashString('kit'+id); const hue = h % 360; return ['hsl('+hue+',70%,42%)', '#FFFFFF']; }
  function kitFor(club){ const k = KITS[club.name]; return k? { primary:k[0], secondary:k[1] } : { primary: hashColour(club.id)[0], secondary: '#FFFFFF' }; }

  // Shirt numbers by slot within the XI (presentation only).
  const SHIRTS = { GK:[1], DEF:[2,5,6,3,4], MID:[7,4,8,10,11], FWD:[9,10,11,7] };
  function numberXI(xi, teamId){
    const used = new Set(); const out = [];
    const counters = {GK:0,DEF:0,MID:0,FWD:0};
    for (const x of xi){
      const pool = SHIRTS[x.slot]; let n = pool[Math.min(counters[x.slot], pool.length-1)]; counters[x.slot]++;
      while (used.has(n)) n++; used.add(n);
      out.push({ id: String(x.p.id), teamId, name: x.p.name, role: x.slot, naturalRole: x.p.pos, shirtNo: n, skill: x.p.skill });
    }
    return out;
  }

  // m: a finished match record from the game's results list. state: the game.
  // info: { season, week, competition, round, leg } for ids and labels.
  function capture(state, m, info){
    info = info||{};
    const home = m.home, away = m.away;
    const homeId = 'club-'+home.id, awayId = 'club-'+away.id;
    const matchId = ['s'+(info.season||state.season), 'w'+(info.week||state.week), home.id, away.id, info.competition||(m.euro? 'euro-'+m.euro.comp : m.cupKey? 'cup-'+m.cupKey : 'league')].join('-');
    const players = numberXI(m.xiH, homeId).concat(numberXI(m.xiA, awayId));
    const pid = new Set(players.map(p=>p.id));
    const scorers = (m.scorers||[]).map((s,i)=>({ eventId:'goal-'+(i+1), teamId: s.side==='H'? homeId : awayId, playerId: pid.has(String(s.p.id))? String(s.p.id) : null, playerName: s.p.name, minute: s.min, period: s.et? 'extraTime' : 'regulation' }));
    const cards = (m.cards||[]).map((c,i)=>({ eventId:'card-'+(i+1), teamId: c.side==='H'? homeId : awayId, playerId: pid.has(String(c.p.id))? String(c.p.id) : null, playerName: c.p.name, minute: c.min, card: c.type==='R'? 'red' : 'yellow' }));
    const extra = m.extra==='aet'? 'aet' : (m.extra && m.extra.startsWith('pens'))? 'pens' : null;
    const competition = m.euro? { kind:'euro', key: m.euro.comp, name: (root.Engine? root.Engine.CFG.EURO.comps[m.euro.comp].name : m.euro.comp), round: m.euro.round, leg: m.euro.leg||null, final: !!m.euro.final }
      : m.cupKey? { kind:'cup', key: m.cupKey, name: (root.Engine? root.Engine.CFG.CUPS[m.cupKey].name : m.cupKey), round: m.cup, neutral: !!m.neutral }
      : { kind:'league', key:'league', name:'League', division: home.div };
    const p = {
      schemaVersion: MD.SCHEMA_VERSION,
      matchId, seed: MD.hashString(matchId),
      competition,
      period: { regulationMinutes: 90, hasExtraTime: !!extra, hasPenalties: extra==='pens' },
      teams: { home: { id: homeId, clubId: home.id, name: home.name, short: home.short, kit: kitFor(home) }, away: { id: awayId, clubId: away.id, name: away.name, short: away.short, kit: kitFor(away) } },
      players,
      official: { homeGoals: m.gH, awayGoals: m.gA, scorers, extra, penaltiesWinnerTeamId: m.extra==='pens-H'? homeId : m.extra==='pens-A'? awayId : null, cards,
        injuries: (m.injuries||[]).map(x=>({ playerId: String(x.id), name: x.name, teamId: x.club===home.id? homeId : awayId, weeks: x.injury })),
        attendance: m.att, aggregate: m.agg? { home: m.agg.b, away: m.agg.a } : null,   // the game stores aggregates as (first-leg home, first-leg away); in the second leg those are away and home
        winnerTeamId: m.winner!==undefined? 'club-'+m.winner : null },
      events: null,   // filled by the timeline builder
    };
    // away kit clash: if the two primaries are close, the away side wears its second colour
    if (similar(p.teams.home.kit.primary, p.teams.away.kit.primary)) p.teams.away.kit = { primary: p.teams.away.kit.secondary, secondary: p.teams.away.kit.primary, changed: true };
    if (similar(p.teams.home.kit.primary, p.teams.away.kit.primary)) p.teams.away.kit = { primary: '#FFD200', secondary: '#202020', changed: true };
    return Object.freeze(p);
  }
  function rgb(c){ if (c[0]==='#'){ return [parseInt(c.slice(1,3),16), parseInt(c.slice(3,5),16), parseInt(c.slice(5,7),16)]; } const m = /hsl\((\d+),(\d+)%,(\d+)%\)/.exec(c); if (!m) return [128,128,128]; const h=+m[1]/360, s=+m[2]/100, l=+m[3]/100; const f=(n)=>{ const k=(n+h*12)%12; const a=s*Math.min(l,1-l); return Math.round(255*(l - a*Math.max(-1, Math.min(k-3, 9-k, 1)))); }; return [f(0),f(8),f(4)]; }
  function similar(a,b){ const x = rgb(a), y = rgb(b); const d = Math.sqrt((x[0]-y[0])**2 + (x[1]-y[1])**2 + (x[2]-y[2])**2); return d < 110; }

  MD.capture = capture; MD.kitFor = kitFor; MD.KITS = KITS;
})(typeof window!=='undefined'? window : globalThis);

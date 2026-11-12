// Soccer Manager '91 ladder: a tiny Cloudflare Worker with a D1 table.
// Boards: career (higher is better), fastest_title and fastest_euro (lower is better).
const BOARDS = { career: { dir: 'desc', min: 0, max: 5000 }, fastest_title: { dir: 'asc', min: 1, max: 100 }, fastest_euro: { dir: 'asc', min: 1, max: 100 } };
const SUBMIT_SECRET = '2a7f90e50ccfeefa95b4aac8af049fb6';   // must match the game; change both if you ever rotate it
const MIN_GAP_MS = 20000;

export default {
  async fetch(req, env){
    const url = new URL(req.url);
    const cors = { 'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*', 'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
    const json = (obj, status=200) => new Response(JSON.stringify(obj), { status, headers: cors });
    if (req.method==='OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      if (req.method==='GET' && url.pathname==='/top'){
        const board = url.searchParams.get('board')||'career'; const def = BOARDS[board]; if (!def) return json({ ok:false, error:'bad board' }, 400);
        const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit')||'50')));
        const { results } = await env.DB.prepare(`SELECT nick, score, detail, updated FROM scores WHERE board=? ORDER BY score ${def.dir==='asc'?'ASC':'DESC'}, updated ASC LIMIT ?`).bind(board, limit).all();
        return json({ ok:true, board, rows: results.map((r,i)=>({ rank:i+1, nick:r.nick, score:r.score, detail: safeJson(r.detail), updated:r.updated })) });
      }
      if (req.method==='GET' && url.pathname==='/me'){
        const player = url.searchParams.get('player')||''; if (!player) return json({ ok:false, error:'no player' }, 400);
        const out = {};
        for (const board in BOARDS){
          const row = await env.DB.prepare('SELECT score FROM scores WHERE board=? AND player=?').bind(board, player).first();
          if (!row) continue;
          const better = BOARDS[board].dir==='asc'? 'score < ?' : 'score > ?';
          const cnt = await env.DB.prepare(`SELECT COUNT(*) AS n FROM scores WHERE board=? AND ${better}`).bind(board, row.score).first();
          const tot = await env.DB.prepare('SELECT COUNT(*) AS n FROM scores WHERE board=?').bind(board).first();
          out[board] = { score: row.score, rank: (cnt.n||0)+1, of: tot.n||0 };
        }
        return json({ ok:true, me: out });
      }
      if (req.method==='POST' && url.pathname==='/submit'){
        const b = await req.json().catch(()=>null); if (!b) return json({ ok:false, error:'bad json' }, 400);
        const def = BOARDS[b.board]; if (!def) return json({ ok:false, error:'bad board' }, 400);
        const player = String(b.player||'').slice(0,64); const nick = cleanNick(b.nick); const score = Math.round(Number(b.score));
        if (!player || !nick) return json({ ok:false, error:'player and nick required' }, 400);
        if (!isFinite(score) || score<def.min || score>def.max) return json({ ok:false, error:'score out of range' }, 400);
        const expect = await sha256(`${SUBMIT_SECRET}|${b.board}|${player}|${score}`);
        if (b.sig!==expect) return json({ ok:false, error:'bad signature' }, 403);
        const detail = JSON.stringify(b.detail||{}).slice(0, 1500); const version = String(b.v||'').slice(0,16); const now = Date.now();
        const cur = await env.DB.prepare('SELECT score, updated FROM scores WHERE board=? AND player=?').bind(b.board, player).first();
        if (cur && now - cur.updated < MIN_GAP_MS) return json({ ok:true, kept: cur.score, note:'too soon' });
        const better = !cur || (def.dir==='asc'? score < cur.score : score > cur.score);
        if (cur && !better){ await env.DB.prepare('UPDATE scores SET nick=?, updated=? WHERE board=? AND player=?').bind(nick, now, b.board, player).run(); return json({ ok:true, kept: cur.score }); }
        await env.DB.prepare('INSERT INTO scores (board, player, nick, score, detail, version, updated) VALUES (?,?,?,?,?,?,?) ON CONFLICT(board, player) DO UPDATE SET nick=excluded.nick, score=excluded.score, detail=excluded.detail, version=excluded.version, updated=excluded.updated').bind(b.board, player, nick, score, detail, version, now).run();
        return json({ ok:true, saved: score });
      }
      if (req.method==='DELETE' && url.pathname==='/entry'){
        if (!env.ADMIN_KEY || url.searchParams.get('key')!==env.ADMIN_KEY) return json({ ok:false, error:'forbidden' }, 403);
        const board = url.searchParams.get('board'), player = url.searchParams.get('player');
        if (board) await env.DB.prepare('DELETE FROM scores WHERE board=? AND player=?').bind(board, player).run();
        else await env.DB.prepare('DELETE FROM scores WHERE player=?').bind(player).run();
        return json({ ok:true });
      }
      return json({ ok:false, error:'not found' }, 404);
    } catch (e){ return json({ ok:false, error: String(e.message||e) }, 500); }
  }
};
function cleanNick(v){ return String(v||'').replace(/[^\p{L}\p{N} _.'-]/gu,'').replace(/\s+/g,' ').trim().slice(0,16); }
function safeJson(s){ try{ return JSON.parse(s); }catch(e){ return {}; } }
async function sha256(s){ const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join(''); }

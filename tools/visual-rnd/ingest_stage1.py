#!/usr/bin/env python3
"""
Take a Floyo download of the Stage 1 paintings and turn it into style E.
  python3 tools/visual-rnd/ingest_stage1.py --download <dir with sm91-q-<stem_>-s1_0000N_.png> [--work <dir>] [--style E] [--audit-only]
Steps: 1. copy each figure painting to <work>/painted/<stem_>-painted.png (the first roll, -s1_) and any re-roll (-s1-rN_,
the highest N) to <work>/rerolls/; 2. report which of the 124 grids are missing; 3. audit_cells over the first roll
(<work>/audit.json) and over the re-rolls (<work>/audit-rerolls.json); 4. iso_paint the first roll into
assets/matchday/isometric/<style>, then, grid by grid, only the cells the first roll's audit flagged are taken from the
re-roll (so a re-roll never replaces cells that were already good); --whole-rerolls takes the whole re-rolled grid instead.
--audit-only stops after step 3. The stadium paintings (sm91-qs-*) are left for paint_pieces.py.
"""
import argparse, json, os, re, shutil, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--download', required=True); ap.add_argument('--work', default=''); ap.add_argument('--style', default='E')
    ap.add_argument('--frames', default=os.path.join(HERE, 'stage1', 'frames.json')); ap.add_argument('--refs', default=os.path.join(HERE, 'stage1', 'refs'))
    ap.add_argument('--audit-only', action='store_true'); ap.add_argument('--only', default='', help='comma list of stems to convert (default all present)')
    ap.add_argument('--whole-rerolls', action='store_true', help='a re-rolled grid replaces the whole first roll, not just its flagged cells')
    a = ap.parse_args()
    work = a.work or os.path.join(a.download, 'stage1-work'); painted = os.path.join(work, 'painted'); rerolls = os.path.join(work, 'rerolls')
    os.makedirs(painted, exist_ok=True); os.makedirs(rerolls, exist_ok=True)
    groups = json.load(open(a.frames))['groups']; stems = [g['stem'] for g in groups]
    pat = re.compile(r'^sm91-q-(.+?)-s1(?:-r(\d+))?_(\d{5})_\.png$')
    first = {}; best_roll = {}
    for root, _, files in os.walk(a.download):
        if os.path.abspath(root).startswith(os.path.abspath(work)): continue
        for f in files:
            m = pat.match(f)
            if not m: continue
            stem_, roll, n = m.group(1), int(m.group(2) or 0), int(m.group(3)); path = os.path.join(root, f)
            if roll == 0:
                if stem_ not in first or n > first[stem_][0]: first[stem_] = (n, path)
            elif stem_ not in best_roll or (roll, n) > best_roll[stem_][0]: best_roll[stem_] = ((roll, n), path)
    found = 0; missing = []; rerolled = []
    for stem in stems:
        stem_ = stem.replace('+', '_')
        if stem_ in first: shutil.copy(first[stem_][1], os.path.join(painted, f'{stem_}-painted.png')); found += 1
        elif stem_ in best_roll: shutil.copy(best_roll[stem_][1], os.path.join(painted, f'{stem_}-painted.png')); found += 1   # only a re-roll exists: it is the first roll
        else: missing.append(stem)
        if stem_ in first and stem_ in best_roll: shutil.copy(best_roll[stem_][1], os.path.join(rerolls, f'{stem_}-painted.png')); rerolled.append(stem)
    print(f'{found} of {len(stems)} grids found in {a.download}' + (f'; missing: {", ".join(missing)}' if missing else '') + (f'; re-rolls for {len(rerolled)}' if rerolled else ''))
    extra = sorted(set(first) | set(best_roll)); extra = [e for e in extra if e not in set(s.replace('+', '_') for s in stems)]
    if extra: print(f'  not in frames.json (ignored): {", ".join(extra)}')
    audit = os.path.join(work, 'audit.json')
    subprocess.run([sys.executable, os.path.join(HERE, 'audit_cells.py'), '--ref', a.refs, '--painted', painted, '--out', audit], check=True)
    audit_r = os.path.join(work, 'audit-rerolls.json')
    if rerolled: subprocess.run([sys.executable, os.path.join(HERE, 'audit_cells.py'), '--ref', a.refs, '--painted', rerolls, '--out', audit_r], check=True)
    if a.audit_only: return
    conv = [sys.executable, os.path.join(ROOT, 'tools', 'iso_paint.py'), '--ref', a.refs, '--style', a.style]
    cmd = conv + ['--painted', painted] + (['--only', a.only] if a.only else [])
    print('converting:', ' '.join(cmd)); subprocess.run(cmd, check=True, cwd=ROOT)
    if not rerolled: return
    rep = json.load(open(audit)); rep_r = json.load(open(audit_r)) if os.path.exists(audit_r) else { 'grids': {} }
    for stem in rerolled:
        if a.only and stem not in a.only.split(','): continue
        flagged = [c for c in rep['grids'].get(stem, { 'cells': [] })['cells'] if c['flag']]
        if a.whole_rerolls or not flagged:
            if not flagged and not a.whole_rerolls: print(f'  {stem}: first roll had no flagged cells, re-roll not used'); continue
            cells = ''
        else:
            cells = ';'.join(f"{c['pose']}:{c['frame']}:{c['dir']}" for c in flagged)
        still = [b for b in rep_r['grids'].get(stem, { 'bad': [] })['bad'] if not cells or any(b.startswith(f"{c['pose']}:{c['frame']}:{c['dir']} ") for c in flagged)]
        if still: print(f'  warning: {stem}: the re-roll is flagged too ({"; ".join(still)}); taking it anyway')
        cmd = conv + ['--painted', rerolls, '--only', stem] + (['--cells', cells] if cells else [])
        print(f'  {stem}: ' + ('whole grid' if not cells else f'cells {cells}') + ' from the re-roll'); subprocess.run(cmd, check=True, cwd=ROOT)

if __name__ == '__main__':
    main()

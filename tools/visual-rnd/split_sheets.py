#!/usr/bin/env python3
"""
Cut the Floyo contact sheets (sheet_runs.py) back into the single paintings. The sheets carry a solid red strip between
the pictures; every column that is pure red from top to bottom is a divider, the runs of non-divider columns are the
pictures, in the order sheets.json lists them. Pictures after the first were scaled to the first one's height with the
aspect kept, which the converter tolerates (it scales by width).
  python3 tools/visual-rnd/split_sheets.py --sheets <sheets.json> --download <dir with sm91-sheet-NN_0000N_.png> --out <dir>
Writes <out>/<original output name> for each picture and reports any sheet whose strip count disagrees with the list.
"""
import argparse, json, os, re
import numpy as np
from PIL import Image

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--sheets', required=True); ap.add_argument('--download', required=True); ap.add_argument('--out', required=True)
    a = ap.parse_args(); os.makedirs(a.out, exist_ok=True)
    spec = json.load(open(a.sheets)); files = {}
    for root, _, fs in os.walk(a.download):
        for f in fs:
            m = re.match(r'^(sm91-sheet-[\w-]+?)_(\d{5})_\.png$', f)     # sm91-sheet-00, sm91-sheet-r2-00, ...
            if m and (m.group(1) not in files or m.group(2) > files[m.group(1)][0]): files[m.group(1)] = (m.group(2), os.path.join(root, f))
    total = 0; problems = []
    for sh in spec['sheets']:
        if sh['prefix'] not in files: problems.append(f"{sh['prefix']}: not downloaded"); continue
        im = Image.open(files[sh['prefix']][1]).convert('RGB'); arr = np.array(im)
        red = (arr[..., 0] > 200) & (arr[..., 1] < 60) & (arr[..., 2] < 60)
        div = red.all(axis=0)                                            # a divider column is red from top to bottom
        runs = []; start = None
        for x, d in enumerate(np.concatenate([div, [True]])):
            if not d and start is None: start = x
            elif d and start is not None: runs.append((start, x)); start = None
        runs = [r for r in runs if r[1] - r[0] > 32]                      # ignore slivers
        if len(runs) != len(sh['names']):
            problems.append(f"{sh['prefix']}: found {len(runs)} pictures, expected {len(sh['names'])}"); continue
        for (x0, x1), name in zip(runs, sh['names']):
            Image.fromarray(arr[:, x0:x1]).save(os.path.join(a.out, name)); total += 1
        print(f"  {sh['prefix']}: {len(runs)} pictures")
    print(f'{total} pictures written to {a.out}' + (('; problems: ' + '; '.join(problems)) if problems else ''))

if __name__ == '__main__':
    main()

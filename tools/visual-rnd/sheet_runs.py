#!/usr/bin/env python3
"""
Contact sheets on Floyo: one run loads N painted outputs and stitches them side by side with a solid red strip between
them (core ImageStitch, image2 scaled to image1's height, aspect kept), so a set of 140 paintings is downloaded as a
handful of files; split_sheets.py cuts them back apart on the red strips, exactly.
  python3 tools/visual-rnd/sheet_runs.py --names <file with one output name per line> --out <dir> [--per 16] [--prefix sm91-sheet] [--spacing 24]
Writes sheet-NN.json graphs plus sheets.json (which outputs each sheet holds, in order).
"""
import argparse, json, os

def graph(names, prefix, spacing):
    g = {}
    for i, n in enumerate(names):
        g[f'L{i}'] = { 'class_type': 'LoadImage', 'inputs': { 'image': f'(as-input)#outputs/{n}' } }
    prev = ['L0', 0]
    for i in range(1, len(names)):
        g[f'S{i}'] = { 'class_type': 'ImageStitch', 'inputs': { 'image1': prev, 'image2': [f'L{i}', 0], 'direction': 'right', 'match_image_size': True, 'spacing_width': spacing, 'spacing_color': 'red' } }
        prev = [f'S{i}', 0]
    g['SAVE'] = { 'class_type': 'SaveImage', 'inputs': { 'images': prev, 'filename_prefix': prefix } }
    return g

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--names', required=True); ap.add_argument('--out', required=True); ap.add_argument('--per', type=int, default=16)
    ap.add_argument('--prefix', default='sm91-sheet'); ap.add_argument('--spacing', type=int, default=24)
    a = ap.parse_args(); os.makedirs(a.out, exist_ok=True)
    names = [l.strip() for l in open(a.names) if l.strip()]
    sheets = []
    for i in range(0, len(names), a.per):
        chunk = names[i:i+a.per]; n = len(sheets); prefix = f'{a.prefix}-{n:02d}'
        json.dump(graph(chunk, prefix, a.spacing), open(os.path.join(a.out, f'sheet-{n:02d}.json'), 'w'))
        sheets.append({ 'index': n, 'prefix': prefix, 'names': chunk })
    json.dump({ 'spacing': a.spacing, 'sheets': sheets }, open(os.path.join(a.out, 'sheets.json'), 'w'), indent=1)
    print(f'{len(sheets)} sheets of up to {a.per} from {len(names)} outputs -> {a.out}')

if __name__ == '__main__':
    main()

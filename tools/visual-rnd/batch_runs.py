#!/usr/bin/env python3
"""
Merge several single-image Floyo graphs (make_runs_rnd.py / make_runs_pieces.py) into one run: the model, CLIP, VAE, LoRA and
ControlNet loaders are shared, every per-image node is copied under a prefix, so one run paints N grids and the submission is
N times fewer calls. Each chain keeps its own SaveImage prefix, so the outputs are named exactly as the single runs would be.
  python3 tools/visual-rnd/batch_runs.py --manifest <dir>/manifest.json --out <dir>/batches --size 4 [--tag s1]
Writes batch-<n>.json plus batches.json (which stems each batch holds and a run name).
"""
import argparse, json, os

SHARED = { 'VAELoader', 'CLIPLoader', 'UNETLoader', 'LoraLoaderModelOnly', 'ModelSamplingAuraFlow', 'ControlNetLoader' }

def merge(graphs):
    out = {}; shared_by_sig = {}
    for i, g in enumerate(graphs):
        rename = {}
        # shared loaders: one copy per identical node (same class and inputs)
        for k, v in g.items():
            if v['class_type'] in SHARED:
                sig = json.dumps(v, sort_keys=True)
                if sig not in shared_by_sig: shared_by_sig[sig] = k if k not in out else f'{k}_{i}'; out[shared_by_sig[sig]] = json.loads(sig)
                rename[k] = shared_by_sig[sig]
        for k, v in g.items():
            if k in rename: continue
            rename[k] = f'c{i}_{k}'
        for k, v in g.items():
            if v['class_type'] in SHARED: continue
            nv = json.loads(json.dumps(v))
            for a, b in nv['inputs'].items():
                if isinstance(b, list) and len(b) == 2 and isinstance(b[0], str) and b[0] in rename: nv['inputs'][a] = [rename[b[0]], b[1]]
            out[rename[k]] = nv
    # shared loaders referenced by chain nodes keep their original ids; chain copies that still point at an un-renamed
    # shared id (first graph) are fine because the first graph's ids were kept as-is
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--manifest', required=True); ap.add_argument('--out', required=True); ap.add_argument('--size', type=int, default=4); ap.add_argument('--tag', default='')
    ap.add_argument('--only', default='', help='comma list of stems/pieces to include')
    a = ap.parse_args(); os.makedirs(a.out, exist_ok=True)
    man = json.load(open(a.manifest)); d = os.path.dirname(a.manifest)
    if a.only:
        keep = set(a.only.split(',')); man = [m for m in man if (m.get('stem') or m.get('piece')) in keep]
    batches = []
    for b in range(0, len(man), a.size):
        chunk = man[b:b+a.size]; graphs = []
        for m in chunk:
            f = m.get('file') or f"run-{m['piece']}-{m['route']}.json"
            graphs.append(json.load(open(os.path.join(d, f))))
        g = merge(graphs); n = len(batches)
        json.dump(g, open(os.path.join(a.out, f'batch-{n:02d}.json'), 'w'))
        label = ', '.join((m.get('stem') or f"{m['piece']} {m['route']}") for m in chunk)
        batches.append({ 'index': n, 'file': f'batch-{n:02d}.json', 'items': chunk, 'name': f'SM91 {a.tag} batch {n:02d}: {label}'[:200], 'nodes': len(g) })
    json.dump(batches, open(os.path.join(a.out, 'batches.json'), 'w'), indent=1)
    print(f'{len(batches)} batches of up to {a.size} from {len(man)} runs -> {a.out}')

if __name__ == '__main__':
    main()

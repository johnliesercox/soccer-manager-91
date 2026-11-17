import json, sys
d = json.load(open(sys.argv[1])); L = d['log']; F = d['raf']
def pct(a, q):
    a = sorted(a); return a[min(len(a)-1, int(len(a)*q))] if a else 0
print('draws', len(L), 'raf frames', len(F))
# classify each draw
def kind(x, prev):
    k = []
    if x['painted'] > 0: k.append('tile%d' % min(x['painted'], 9))
    if x['sprites'] > 0: k.append('sprite')
    if x['cut'] is not None and x['cut'] < 0.03: k.append('cut')
    if x['ff']: k.append('ff')
    return '+'.join(k) or 'plain'
from collections import defaultdict
G = defaultdict(list); prev = None
for x in L:
    G[kind(x, prev)].append(x['d']); prev = x
tot = sum(x['d'] for x in L)
print('%-22s %6s %8s %8s %8s %8s %7s' % ('kind', 'n', 'avg', 'p50', 'p95', 'max', 'share'))
for k, a in sorted(G.items(), key=lambda kv: -sum(kv[1])):
    print('%-22s %6d %8.1f %8.1f %8.1f %8.1f %6.1f%%' % (k, len(a), sum(a)/len(a), pct(a, .5), pct(a, .95), max(a), 100*sum(a)/tot))
slow = [x for x in L if x['d'] > 16.7]; print('draws over 16.7 ms:', len(slow)); S = defaultdict(int)
for i, x in enumerate(L):
    if x['d'] > 16.7: S[kind(x, None)] += 1
print(dict(S))
slow2 = [x for x in L if x['d'] > 33.3]; S = defaultdict(int)
for x in slow2: S[kind(x, None)] += 1
print('draws over 33.3 ms:', len(slow2), dict(S))
print('worst ten draws:')
for x in sorted(L, key=lambda x: -x['d'])[:10]: print('  ', x)
# raf deltas not explained by draw: match each raf frame to draw time in that interval
import bisect
ts = [x['t'] for x in L]
un = 0; big = [f for f in F if f['dt'] > 33.4]
for f in big:
    i = bisect.bisect_left(ts, f['t'] - f['dt'] - 1); j = bisect.bisect_right(ts, f['t'] + 1)
    dsum = sum(L[k]['d'] for k in range(i, j))
    if dsum < 0.5*f['dt']: un += 1
print('raf frames over 33.4 ms:', len(big), 'of which drawing explains less than half:', un)

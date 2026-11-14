import os
# Builds the single-file game: engine.js + src/matchday/*.js are inlined into ui.html.
# soccer-manager-91.html is the standalone file (open it from disk); index.html is the same game with the
# PWA links and is what GitHub Pages serves, alongside manifest.webmanifest, sw.js, the icons and worker/.
MATCHDAY_FILES = ['schema.js', 'capture.js', 'timeline.js', 'behaviour.js', 'trajectories.js', 'interactions.js', 'scene.js', 'playback.js', 'sprites.js',
                  'renderers/canvas2d.js', 'renderers/pixelart.js', 'renderers/wireframe.js',
                  'renderers/iso-projection.js', 'iso-sprites.js', 'iso-assets.js', 'renderers/iso-pitch.js', 'renderers/iso-stadium.js', 'renderers/iso-camera.js', 'renderers/iso-actors.js', 'renderers/isometric.js',
                  'audio.js', 'matchday-ui.js']
eng = open('engine.js').read()
ui = open('ui.html').read()
parts = []
for f in MATCHDAY_FILES:
    path = os.path.join('src/matchday', f)
    if os.path.exists(path):
        parts.append(open(path).read())
    else:
        print('missing', path)
# isometric art assets (tools/iso-art.js) inlined as data URIs; ISO_STYLES picks which styles ship (default B)
import base64, json
styles = [s for s in os.environ.get('ISO_STYLES', 'B').split(',') if s]
assets = {}
for style in styles:
    for spr in (24, 16, 12):
        base = os.path.join('assets/matchday/isometric', style)
        man = os.path.join(base, 'players-%d.json' % spr)
        if not os.path.exists(man): continue
        entry = { 'manifest': json.load(open(man)) }
        optional = { 'overrides': 'overrides', 'overrides-keepers': 'overridesKeepers', 'stand': 'stand' }   # painted cells and textures, same layout; absent = generated art
        for name in ('players', 'patterns', 'keepers', 'crowd', 'grass', 'overrides', 'overrides-keepers', 'stand'):
            png = os.path.join(base, '%s-%d.png' % (name, spr))
            if name in optional and not os.path.exists(png): continue
            entry[optional.get(name, name)] = 'data:image/png;base64,' + base64.b64encode(open(png, 'rb').read()).decode('ascii')
        standMeta = os.path.join(base, 'stand-%d.json' % spr)
        if 'stand' in entry and os.path.exists(standMeta): entry['standMeta'] = json.load(open(standMeta))
        # painted stadium pieces (tools/iso_paint.py --piece): piece-<name>-<spr>.png or .webp plus its json
        pieces = {}
        for name in ('near', 'left', 'right', 'boards', 'dugout'):
            meta = os.path.join(base, 'piece-%s-%d.json' % (name, spr))
            if not os.path.exists(meta): continue
            for ext, mime in (('webp', 'image/webp'), ('png', 'image/png')):
                img = os.path.join(base, 'piece-%s-%d.%s' % (name, spr, ext))
                if os.path.exists(img):
                    pieces[name] = { 'image': 'data:%s;base64,' % mime + base64.b64encode(open(img, 'rb').read()).decode('ascii'), 'meta': json.load(open(meta)) }; break
        if pieces: entry['pieces'] = pieces
        assets['%s/%d' % (style, spr)] = entry
if assets:
    parts.append('(function(root){ root.Matchday.isoAssetData = ' + json.dumps(assets, separators=(',', ':')) + '; })(typeof window!==\'undefined\'? window : globalThis);')
md = '\n'.join(parts)
assert '/*ENGINE*/' in ui and '/*MATCHDAY*/' in ui, 'ui.html is missing the script slots'
out = ui.replace('/*ENGINE*/', eng).replace('/*MATCHDAY*/', md)
open('soccer-manager-91.html', 'w').write(out.replace('<!--SITE-->', ''))
site = out.replace('<!--SITE-->', '<link rel="manifest" href="manifest.webmanifest">\n<link rel="apple-touch-icon" href="icon-192.png">')
open('index.html', 'w').write(site)
print(len(out), 'bytes, matchday modules:', len(MATCHDAY_FILES), 'asset sets:', ', '.join(assets.keys()) or 'none')

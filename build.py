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
# isometric art assets inlined as data URIs. ISO_STYLES picks which styles ship and ISO_DEFAULT which one the plain Iso
# view draws: from 1.6.0 the release is E alone (`python3 build.py` with nothing set is the release build; the 1.5.0
# release was B, still made by ISO_STYLES=B). A style's `inherit` file names the style it falls back on for any file it
# lacks; when that parent is not in the build, only the files the child lacks are copied in, not the parent's whole set.
import base64, json
styles = [s for s in os.environ.get('ISO_STYLES', 'E').split(',') if s]
assets = {}
for style in styles:
    base = os.path.join('assets/matchday/isometric', style)
    # a style folder may hold an `inherit` file naming another style: any file it lacks is taken from that style, and
    # when the parent ships in the same build the entry is a '@parent/spr/field' reference rather than a second copy
    def parent_of(st):
        f = os.path.join('assets/matchday/isometric', st, 'inherit')
        return open(f).read().strip() if os.path.exists(f) else None
    def find(name):
        st, seen = style, set()
        while st and st not in seen:
            p = os.path.join('assets/matchday/isometric', st, name)
            if os.path.exists(p): return p, (None if st == style else st)
            seen.add(st); st = parent_of(st)
        return None, None
    for spr in (24, 16, 12):
        man, _ = find('players-%d.json' % spr)
        if not man: continue
        def ref_or(path, src, field, make):
            return ('@%s/%d/%s' % (src, spr, field)) if (src and src in styles) else make(path)
        datauri = lambda mime: (lambda path: 'data:%s;base64,' % mime + base64.b64encode(open(path, 'rb').read()).decode('ascii'))
        entry = { 'manifest': json.load(open(man)) }
        optional = { 'overrides': 'overrides', 'overrides-keepers': 'overridesKeepers', 'stand': 'stand' }   # painted cells and textures, same layout; absent = generated art
        for name in ('players', 'patterns', 'keepers', 'crowd', 'grass', 'overrides', 'overrides-keepers', 'stand'):
            png, src = find('%s-%d.png' % (name, spr))
            if not png: continue
            entry[optional.get(name, name)] = ref_or(png, src, optional.get(name, name), datauri('image/png'))
        standMeta, src = find('stand-%d.json' % spr)
        if 'stand' in entry and standMeta: entry['standMeta'] = ref_or(standMeta, src, 'standMeta', lambda p: json.load(open(p)))
        # painted stadium pieces (tools/iso_paint.py --piece): piece-<name>-<spr>.png or .webp plus its json
        pieces = {}
        goal_names = [n for e in (0, 1) for n in ['goal%ds' % e, 'goal%db' % e, 'goal%df' % e] + ['goal%db-%s%d' % (e, st, k) for st in ('bulge', 'settle') for k in range(3)]]   # the shadow on the grass, the back and front parts, the back net after a goal
        for name in ['near', 'left', 'right', 'boards', 'dugout'] + goal_names + ['cornerA', 'cornerB', 'cornerC', 'cornerD', 'pylonA', 'pylonB']:
            meta, msrc = find('piece-%s-%d.json' % (name, spr))
            if not meta: continue
            for ext, mime in (('webp', 'image/webp'), ('png', 'image/png')):
                img, isrc = find('piece-%s-%d.%s' % (name, spr, ext))
                if img:
                    if isrc and isrc in styles and msrc == isrc: pieces[name] = '@%s/%d/pieces/%s' % (isrc, spr, name)
                    else: pieces[name] = { 'image': datauri(mime)(img), 'meta': json.load(open(meta)) }
                    break
        if pieces: entry['pieces'] = pieces
        assets['%s/%d' % (style, spr)] = entry
if assets:
    parts.append('(function(root){ root.Matchday.isoAssetData = ' + json.dumps(assets, separators=(',', ':')) + '; })(typeof window!==\'undefined\'? window : globalThis);')
# ISO_DEFAULT names the style the plain Iso view draws with: the first style in ISO_STYLES unless set (E for the release;
# a review build is ISO_STYLES=B,E ISO_DEFAULT=E, and the 1.5.0 look is ISO_STYLES=B)
default_style = os.environ.get('ISO_DEFAULT') or (styles[0] if styles else '')
if default_style:
    assert default_style in styles, 'ISO_DEFAULT must be one of ISO_STYLES'
    parts.append('(function(root){ root.Matchday.isoDefaultStyle = ' + json.dumps(default_style) + '; })(typeof window!==\'undefined\'? window : globalThis);')
md = '\n'.join(parts)
assert '/*ENGINE*/' in ui and '/*MATCHDAY*/' in ui, 'ui.html is missing the script slots'
out = ui.replace('/*ENGINE*/', eng).replace('/*MATCHDAY*/', md)
open('soccer-manager-91.html', 'w').write(out.replace('<!--SITE-->', ''))
site = out.replace('<!--SITE-->', '<link rel="manifest" href="manifest.webmanifest">\n<link rel="apple-touch-icon" href="icon-192.png">')
open('index.html', 'w').write(site)
print(len(out), 'bytes, matchday modules:', len(MATCHDAY_FILES), 'asset sets:', ', '.join(assets.keys()) or 'none', '| Iso draws', default_style or 'the generated art')

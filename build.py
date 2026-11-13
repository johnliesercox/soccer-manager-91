import os
# Builds the single-file game: engine.js + src/matchday/*.js are inlined into ui.html.
# soccer-manager-91.html is the standalone file (open it from disk); index.html is the same game with the
# PWA links and is what GitHub Pages serves, alongside manifest.webmanifest, sw.js, the icons and worker/.
MATCHDAY_FILES = ['schema.js', 'capture.js', 'timeline.js', 'behaviour.js', 'trajectories.js', 'interactions.js', 'scene.js', 'playback.js', 'sprites.js',
                  'renderers/canvas2d.js', 'renderers/pixelart.js', 'renderers/wireframe.js', 'audio.js', 'matchday-ui.js']
eng = open('engine.js').read()
ui = open('ui.html').read()
parts = []
for f in MATCHDAY_FILES:
    path = os.path.join('src/matchday', f)
    if os.path.exists(path):
        parts.append(open(path).read())
    else:
        print('missing', path)
md = '\n'.join(parts)
assert '/*ENGINE*/' in ui and '/*MATCHDAY*/' in ui, 'ui.html is missing the script slots'
out = ui.replace('/*ENGINE*/', eng).replace('/*MATCHDAY*/', md)
open('soccer-manager-91.html', 'w').write(out.replace('<!--SITE-->', ''))
site = out.replace('<!--SITE-->', '<link rel="manifest" href="manifest.webmanifest">\n<link rel="apple-touch-icon" href="icon-192.png">')
open('index.html', 'w').write(site)
print(len(out), 'bytes, matchday modules:', len(parts))

#!/usr/bin/env python3
"""
Visual R&D run builder: one Comfy API graph per test grid for each route.
  z   Z-Image Turbo + Fun ControlNet Union 2.1 (the Phase 3 route) with the concept-led prompt; depth map in, preprocessor none
  q   Qwen Image 2512 + Fun ControlNet Union 2602 (depth); 8-step lightning
  f   Flux.1 dev + Shakker Labs Union Pro 2.0 ControlNet (depth); 20 steps
  nb  Nano Banana Pro (Gemini 3 Pro image, Partner Nodes) editing the colour render directly
  python3 tools/visual-rnd/make_runs_rnd.py --frames tools/visual-rnd/frames.json --out <dir> --input-prefix '#inputs/soccer-manager/sm91-rnd' [--routes z,q,f,nb] [--seed N] [--tag s2]
Writes run-<route>-<stem>.json files and a manifest. Outputs are saved as sm91-<route>-<stem>[-tag].
"""
import argparse, json, os, copy, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'floyo'))
from make_runs import POSE, KIT   # the pose vocabulary and the template kit, shared with the Phase 3 pipeline
HAIR = { 0: 'short dark brown hair', 1: 'very short cropped dark hair, almost shaved at the sides', 2: 'longer dark brown hair over the ears and collar with a fringe over the brow' }

STYLE_CN = ('Detailed 16-bit pixel art in the style of classic 1990s Amiga and SNES football games: crisp dark outlines, strong cel shading '
            'with a lit side and a shadow side, clear volume in the limbs and torso, a limited palette, clean readable silhouettes, '
            'no anti-aliasing blur, no gradients, no ground shadow, no ball, no text, no logos, no background objects.')
NB_PROMPT = ('Redraw this sprite sheet as detailed 16-bit pixel art in the style of classic 1990s Amiga and SNES football games. '
             'Keep the grid layout, every cell position, the exact poses and the camera angle unchanged. It is the same {who} in every cell, '
             'seen from eight directions in an isometric three-quarter view from above: {kit}{gloves}, {hair}, light skin, a slightly large round head, '
             'stylised chunky proportions. Give him proper volume: cel shading with a lit side and a shadow side, crisp dark outlines, clearly '
             'readable arms and legs. Plain flat light grey background, no ball, no shadow on the ground, no text, no logos.')

def cn_prompt(frames, gk, hair, wide):
    poses = []
    for f in frames:
        p = f.split(':')[0]
        if gk and p == 'set': p = 'gkset'
        if POSE[p] not in poses: poses.append(POSE[p])
    n = 8*len(frames)
    per = 2 if wide else 4; rows = n // per
    WORDS = { 2: 'two', 4: 'four', 8: 'eight' }
    grid = f'arranged in a grid of {WORDS[rows]} rows of {WORDS[per]}'
    posetxt = poses[0] if len(poses) == 1 else (f'the top two rows {poses[0]}, the bottom two rows {poses[1]}' if len(frames) == 2 else ', '.join(poses))
    who = 'goalkeeper' if gk else 'footballer'; gloves = ', wearing white goalkeeper gloves' if gk else ''
    return (f'Retro 16-bit video game sprite sheet of a {who}, {n} views of the same character {grid} on a plain flat light grey background. '
            f'Same character in every cell, {posetxt}{gloves}, each cell seen from a different angle in an isometric three-quarter view from above. '
            f'Athletic build with natural proportions, {HAIR[hair]}, light skin, a clearly drawn face with eyes, nose and mouth. Kit: {KIT}. {STYLE_CN}')

def nb_prompt(gk, hair):
    return NB_PROMPT.format(who='goalkeeper' if gk else 'footballer', kit=KIT, gloves=', white goalkeeper gloves' if gk else '', hair=HAIR[hair])

def graph_z(tpl, image, prompt, prefix, seed):
    w = copy.deepcopy(tpl)
    w['58']['inputs']['image'] = image; w['45']['inputs']['text'] = prompt; w['9']['inputs']['filename_prefix'] = prefix
    w['73:70']['inputs']['preprocessor'] = 'none'; w['73:44']['inputs']['seed'] = seed
    return w

def graph_q(image, prompt, prefix, seed):
    return {
      '103': { 'class_type': 'VAELoader', 'inputs': { 'vae_name': 'qwen_image_vae.safetensors' } },
      '104': { 'class_type': 'CLIPLoader', 'inputs': { 'type': 'qwen_image', 'device': 'default', 'clip_name': 'qwen_2.5_vl_7b.safetensors' } },
      '109': { 'class_type': 'UNETLoader', 'inputs': { 'unet_name': 'qwen_image_2512_bf16.safetensors', 'weight_dtype': 'default' } },
      '112': { 'class_type': 'LoraLoaderModelOnly', 'inputs': { 'model': ['109', 0], 'lora_name': 'Qwen-Image-2512-Lightning-8steps-V1.0-bf16.safetensors', 'strength_model': 1 } },
      '105': { 'class_type': 'ModelSamplingAuraFlow', 'inputs': { 'model': ['112', 0], 'shift': 3.1 } },
      '128': { 'class_type': 'LoadImage', 'inputs': { 'image': image } },
      '160': { 'class_type': 'ImageScaleToTotalPixels', 'inputs': { 'image': ['128', 0], 'megapixels': 1, 'upscale_method': 'lanczos', 'resolution_steps': 1 } },
      '161': { 'class_type': 'VAEEncode', 'inputs': { 'vae': ['103', 0], 'pixels': ['160', 0] } },
      '162': { 'class_type': 'VAEDecode', 'inputs': { 'vae': ['103', 0], 'samples': ['161', 0] } },
      '163': { 'class_type': 'GetImageSize', 'inputs': { 'image': ['162', 0] } },
      '164': { 'class_type': 'ImageScale', 'inputs': { 'crop': 'center', 'image': ['128', 0], 'width': ['163', 0], 'height': ['163', 1], 'upscale_method': 'lanczos' } },
      '165': { 'class_type': 'AIO_Preprocessor', 'inputs': { 'image': ['164', 0], 'resolution': 1024, 'preprocessor': 'none' } },
      '107': { 'class_type': 'EmptySD3LatentImage', 'inputs': { 'width': ['163', 0], 'height': ['163', 1], 'batch_size': 1 } },
      '111': { 'class_type': 'CLIPTextEncode', 'inputs': { 'clip': ['104', 0], 'text': prompt } },
      '108': { 'class_type': 'CLIPTextEncode', 'inputs': { 'clip': ['104', 0], 'text': 'blurry, photographic, realistic, smooth gradients, text, watermark, ball, shadow on the ground, extra limbs' } },
      '151': { 'class_type': 'ControlNetLoader', 'inputs': { 'control_net_name': 'Qwen-Image-2512-Fun-Controlnet-Union-2602.safetensors' } },
      '152': { 'class_type': 'ControlNetApplyAdvanced', 'inputs': { 'vae': ['103', 0], 'image': ['165', 0], 'negative': ['108', 0], 'positive': ['111', 0], 'strength': 0.85, 'control_net': ['151', 0], 'end_percent': 1, 'start_percent': 0 } },
      '110': { 'class_type': 'KSampler', 'inputs': { 'cfg': 1, 'seed': seed, 'model': ['105', 0], 'steps': 8, 'denoise': 1, 'negative': ['152', 1], 'positive': ['152', 0], 'scheduler': 'simple', 'latent_image': ['107', 0], 'sampler_name': 'euler' } },
      '106': { 'class_type': 'VAEDecode', 'inputs': { 'vae': ['103', 0], 'samples': ['110', 0] } },
      '90': { 'class_type': 'SaveImage', 'inputs': { 'images': ['106', 0], 'filename_prefix': prefix } },
    }

def graph_f(image, prompt, prefix, seed):
    return {
      '159': { 'class_type': 'VAELoader', 'inputs': { 'vae_name': 'ae.safetensors' } },
      '310': { 'class_type': 'DualCLIPLoader', 'inputs': { 'type': 'flux', 'device': 'default', 'clip_name1': 't5xxl_fp16.safetensors', 'clip_name2': 'clip_l.safetensors' } },
      '362': { 'class_type': 'UNETLoader', 'inputs': { 'unet_name': 'flux1-dev-fp8.safetensors', 'weight_dtype': 'default' } },
      '214': { 'class_type': 'LoadImage', 'inputs': { 'image': image } },
      '363': { 'class_type': 'ImageResize+', 'inputs': { 'image': ['214', 0], 'width': 1024, 'height': 1024, 'method': 'keep proportion', 'condition': 'always', 'multiple_of': 16, 'interpolation': 'nearest' } },
      '370': { 'class_type': 'ControlNetLoader', 'inputs': { 'control_net_name': 'FLUX.1/flux_shakker_labs_union_pro-2.0.safetensors' } },
      '366': { 'class_type': 'SetUnionControlNetType', 'inputs': { 'type': 'depth', 'control_net': ['370', 0] } },
      '199': { 'class_type': 'CLIPTextEncode', 'inputs': { 'clip': ['310', 0], 'text': prompt } },
      '367': { 'class_type': 'ConditioningZeroOut', 'inputs': { 'conditioning': ['199', 0] } },
      '175': { 'class_type': 'ControlNetApplyAdvanced', 'inputs': { 'vae': ['159', 0], 'image': ['363', 0], 'negative': ['367', 0], 'positive': ['199', 0], 'strength': 0.85, 'control_net': ['366', 0], 'end_percent': 0.75, 'start_percent': 0 } },
      '307': { 'class_type': 'FluxGuidance', 'inputs': { 'guidance': 3.5, 'conditioning': ['175', 0] } },
      '335': { 'class_type': 'FluxGuidance', 'inputs': { 'guidance': 3.5, 'conditioning': ['175', 1] } },
      '344': { 'class_type': 'EmptyLatentImage', 'inputs': { 'width': ['363', 1], 'height': ['363', 2], 'batch_size': 1 } },
      '308': { 'class_type': 'KSampler', 'inputs': { 'cfg': 1, 'seed': seed, 'model': ['362', 0], 'steps': 20, 'denoise': 1, 'negative': ['335', 0], 'positive': ['307', 0], 'scheduler': 'normal', 'latent_image': ['344', 0], 'sampler_name': 'euler' } },
      '311': { 'class_type': 'VAEDecode', 'inputs': { 'vae': ['159', 0], 'samples': ['308', 0] } },
      '263': { 'class_type': 'SaveImage', 'inputs': { 'images': ['311', 0], 'filename_prefix': prefix } },
    }

def graph_qi(depth, colour, prompt, prefix, seed, denoise):
    """the Qwen route started from the Blender colour render (image to image at `denoise`) with the depth map as the control:
    the kit colours and the figure's placement come from the render, the paint from the model"""
    w = graph_q(depth, prompt, prefix, seed)
    w['128']['inputs']['image'] = colour                                  # 160/161 encode this as the starting latent
    w['129'] = { 'class_type': 'LoadImage', 'inputs': { 'image': depth } }
    w['166'] = { 'class_type': 'ImageScale', 'inputs': { 'crop': 'center', 'image': ['129', 0], 'width': ['163', 0], 'height': ['163', 1], 'upscale_method': 'lanczos' } }
    w['165']['inputs']['image'] = ['166', 0]
    w['110']['inputs']['latent_image'] = ['161', 0]; w['110']['inputs']['denoise'] = denoise
    return w

def graph_nb(image, prompt, prefix):
    return {
      '38': { 'class_type': 'LoadImage', 'inputs': { 'image': image } },
      '39': { 'class_type': 'NanoBananaEdit_floyo', 'inputs': { 'prompt': prompt, 'image_1': ['38', 0], 'num_images': 1, 'output_format': 'png', 'safety_tolerance': '6', 'enable_safety_checker': False } },
      '9': { 'class_type': 'SaveImage', 'inputs': { 'images': ['39', 0], 'filename_prefix': prefix } },
    }

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--frames', required=True); ap.add_argument('--out', required=True); ap.add_argument('--input-prefix', required=True)
    ap.add_argument('--routes', default='z,q,f,nb'); ap.add_argument('--seed', type=int, default=19910502); ap.add_argument('--tag', default='')
    ap.add_argument('--only', default=''); ap.add_argument('--hair', type=int, default=0)
    ap.add_argument('--template', default=os.path.join(os.path.dirname(__file__), '..', 'floyo', 'z-image-turbo-controlnet.template.json'))
    ap.add_argument('--input-suffix', default='')   # e.g. '-b' for the Blender references
    ap.add_argument('--denoise', type=float, default=0.6)   # route qi: how much of the colour render the model repaints
    a = ap.parse_args()
    tpl = json.load(open(a.template)); groups = json.load(open(a.frames))['groups']; os.makedirs(a.out, exist_ok=True)
    if a.only: groups = [g for g in groups if g['stem'] in a.only.split(',')]
    manifest = []
    for g in groups:
        stem = g['stem']; u = stem.replace('+', '_'); gk = bool(g.get('gk')); wide = bool(g.get('wide'))
        depth = f"{a.input_prefix}/sm91-{u}{a.input_suffix}.png"; colour = f"{a.input_prefix}/sm91-{u}{a.input_suffix}-c.png"
        for route in a.routes.split(','):
            prefix = f'sm91-{route}-{u}' + (f'-{a.tag}' if a.tag else '')
            hair = int(g.get('hair', a.hair))
            if route == 'z': w = graph_z(tpl, depth, cn_prompt(g['frames'], gk, hair, wide), prefix, a.seed)
            elif route == 'q': w = graph_q(depth, cn_prompt(g['frames'], gk, hair, wide), prefix, a.seed)
            elif route == 'f': w = graph_f(depth, cn_prompt(g['frames'], gk, hair, wide), prefix, a.seed)
            elif route == 'nb': w = graph_nb(colour, nb_prompt(gk, hair), prefix)
            elif route == 'qi': w = graph_qi(depth, colour, cn_prompt(g['frames'], gk, hair, wide), prefix, a.seed, a.denoise)
            else: raise SystemExit('unknown route '+route)
            name = f'SM91 rnd {route} {u}' + (f' {a.tag}' if a.tag else '')
            json.dump(w, open(os.path.join(a.out, f'run-{route}-{u}.json'), 'w'))
            manifest.append({ 'route': route, 'stem': stem, 'name': name, 'output_prefix': prefix, 'file': f'run-{route}-{u}.json' })
    json.dump(manifest, open(os.path.join(a.out, 'manifest.json'), 'w'), indent=1)
    print(f'{len(manifest)} runs written to {a.out}')

if __name__ == '__main__':
    main()

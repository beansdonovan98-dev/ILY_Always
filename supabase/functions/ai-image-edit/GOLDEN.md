# Golden Standard — stylized buckets

Source of truth: `ily_retry-1794485964_00001_.json` (the run that produced her face,
the greenhouse background, glasses and red hair together).

**Do not change anything in this file, or the constants it describes, unless the user
explicitly says to. Experiments are request-level overrides, never edits here.**

Applies to: `anime_2d_toon`, `framed_card`, `fine_art_medium`, `toy_3d_sculpt`,
`macro_object_embed`.

## Node graph (must not be rewired)

```
75 LoadImage
 └─ 87 ImageScale            832x1216, lanczos, crop center
     ├─ 84  RMBG-2.0         background_color #000000 (unused by lineart; kept)
     └─ 103 AnimeLineArtPreprocessor   image <- ["87", 0], resolution 512
         └─ 180 ImageInvert  image <- ["103", 0]
             └─ 105 ControlNetApplyAdvanced
                    image    <- ["180", 0]
                    cnet     <- 104 diffusers_xl_canny_full.safetensors
                    strength 0.50 / start 0.0 / end 0.55
                    positive <- 73, negative <- 74

201 EmptyLatentImage         832x1216, batch 1
  └─ 77 KSampler             denoise 1.0, steps 30, cfg 6.5, dpmpp_2m / karras
        model    <- 86 IPAdapterFaceID
        positive <- 105,0    negative <- 105,1
        latent   <- 201,0

71 LoraLoader                ashley_v1_1200_steps_00001_.safetensors
        strength_model 0.85 / strength_clip 0.85
        model <- 72,0        clip <- 72,1
  └─ 85 IPAdapterUnifiedLoaderFaceID  preset FACEID, lora_strength 0.35, provider CPU
      └─ 86 IPAdapterFaceID
             weight 0.35, weight_faceidv2 1.0, weight_type linear
             combine_embeds concat, start 0.0, end_at 0.40
             embeds_scaling "V only"
             image <- 94,0

93 ImageScaleToMaxDimension  largest 1024, image <- 75,0
  └─ 94 ImageScale           1024x1024, lanczos, crop disabled

81 CLIPSetLastLayer          stop_at_clip_layer -2, clip <- 71,1
  ├─ 73 CLIPTextEncode (positive)
  └─ 74 CLIPTextEncode (negative)

151 KSampler                 neon blend only, denoise 0.05
```

## Locked values

| Setting | Value |
| --- | --- |
| Seed | **300661729** (default for every stylized bucket) |
| Latent | `EmptyLatentImage` 832×1216 — never `VAEEncode` of the source |
| KSampler 77 | denoise 1.0, steps 30, cfg 6.5 |
| LoRA | ashley_v1, 0.85 model / 0.85 clip |
| FaceID | weight 0.35, end_at 0.40, lora_strength 0.35 |
| ControlNet | AnimeLineArt → ImageInvert → Canny, 0.50 / 0.55 |
| Subject tags | `ashley, long straight cherry red hair falling past the shoulders, round wireframe glasses, (thick thighs:1.10), (soft lower belly:1.05), (curvy figure:1.05)` |
| Framing | bucket framing string; current experiment is `cowboy shot` |
| Negative | includes `freckles, freckled skin` |

## What is allowed to vary per request

- `backgroundPrompt` (rotates the weed environment)
- `seed` (explicit override; otherwise the golden seed above)
- `subject`, `isNude`, `poseImageBase64`
- `subjectTraits` (defaults to the anchored string above)

## What is NOT allowed without an explicit instruction

- Rewiring any node above, adding/removing FaceID, changing the latent type
- Editing LoRA strengths, ControlNet strength, or the golden seed
- Replacing the lineart preprocessor or the invert
- Changing `EmptyLatentImage` to `VAEEncode`

## Preset: `gta_25d` (single-pass stylized look)

Saved from the `ily_wide2` render, before the two-pass restyle work. This is the
glossy 2.5D anime look. It is a request-level preset, not a change to golden.

- Pipeline: ONE sampler. No pass 2, no second LoRA, no second prompt.
- Canvas: pose mode forces 1216x832 landscape.
- Pass: `EmptyLatentImage` -> `KSampler` at bucket denoise; ControlNet `none` in
  pose mode (pose text at 1.15).
- LoRA: `ashley_v1` at bucket strength (0.85 anime).
- FaceID: not wired in pose mode.
- Prompt shape: three BREAK chunks — identity/camera/pose, colour light + style +
  body, environment + static props + sign.
- Colours: `LIGHT_COLORS` clause at 1.5, `stripBakedLighting` first.
- Sign: prompt element plus the composited `team_no_lackin_neon.png` overlay.

Use `styleMode: 'adult-anime'` with `poseMode: 'random'`, `lightColor` set, and no
`restylePass2` flag. That reproduces the wide2 look.

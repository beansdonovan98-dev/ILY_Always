# RESUME — Darkroom / AI editor

State as of commit `dd6d1de` on `main`. Read this plus `GOLDEN.md` before touching anything.

## What is locked

See `GOLDEN.md`. Golden = **ab2-B**: seed `300661729`, EmptyLatent 832×1216,
LoRA `ashley_v1` 0.85/0.85, FaceID 0.35 / end 0.40, AnimeLineArt → ImageInvert →
Canny 0.50 / 0.55, subject tags with `(thick thighs:1.10) (soft lower belly:1.05)
(curvy figure:1.05)`, mid-thigh framing, 90-entry random room pool.

**Do not change these without the user explicitly saying so.**

## Current state

- `styleBuckets.ts` is the source of truth: 98 styles, 7 buckets, `generateFinalOpenCodePayload`.
- App path (`handleStyleStart`) runs the same bucket system as the benchmark.
- FaceID removed from toy/macro only; present on anime/fine-art/framed at 0.35.
- Neon "Team No Lackin" sign composites from `assets/ai/team_no_lackin_neon.png`
  with an inverted alpha mask, blend denoise 0.05.
- Pose mode: `poseMode: 'match_photo' | 'random' | 'custom'`, `posePrompt`.
  Pose goes first at `:1.25`, ControlNet off, body weights stripped
  (`proportional body, moderate bust`), 64 poses including explicit ones.
- Wide mode: `wide: true` → 1216×832, lineart 0.32, wide framing.
- Request overrides available for testing: `seed`, `wide`, `bodyTags`,
  `faceIdWeight`, `poseMode`, `posePrompt`, `subjectTraits`, `subject`, `isNude`.

## Known dead ends — do not retry

- Reducing bust post-hoc: weighted tags re-roll the frame, inpaint makes texture,
  cross-image composite mismatches anatomy, flat-fill leaves a visible patch.
  It is baked into the LoRA; only retraining changes it.
- Removing FaceID on stylized buckets: identity collapses to a stranger.
- Global denoise above ~0.3 on a finished frame: destroys the composited neon sign.

## Open items

1. **Pose test never completed** — Supabase edge gateway returned 504 for ~160s
   while ComfyUI was idle. Timeouts were added to Runpod discovery, upload and
   `/prompt`. Re-run when Supabase is healthy:
   `poseMode: 'random'` on `adult-anime`, expect a different pose, no extra limbs,
   no horizontal inflation.
2. Pose at denoise 1.0 invents the body — if anatomy distorts on lying/spread
   poses, add a low-denoise refine pass instead of more prompt weight.
3. App UI still needs: pose toggle (random vs match photo), wide toggle,
   subject/nude toggles, Room field (already added), background editor.
4. Couple mode is built (two masked passes) but unreachable from the app.
5. Pending app features, untouched: playtime chat (done), inline photo comments
   (done), love notes clearing daily into the Stash Box (**not done**).

## Environment

- Supabase project `wufeovcmunfqtjanudta`; function `ai-image-edit`.
- Pod `64g74uxnppd82i`, ComfyUI on `/workspace/runpod-slim/ComfyUI` (persists on stop).
- LoRAs live only on the pod: `models/loras/ashley_v1_…`, `mbboi_v1_…`.
- Assets to re-upload after a pod rebuild: see `assets/ai/README.md`.

## Unrelated project — do not mix

A separate PC app (the two of them, LAN only, no cloud) is being planned in
`C:\ILY\`. Its notes live in `C:\ILY\RESUME.md`, outside this repo. Trigger phrase:
"back to the ILY PC app". Nothing there affects this function or this app.

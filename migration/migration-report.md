# ILY_Always — RunPod → Kaggle migration report

Generated 2026-11-13. Packaging done from the local working copy
`C:\Users\ashle\OneDrive\Desktop\ILY_Always`.

## What is in this folder

| File | Contents | Size / checksum |
|---|---|---|
| `project-source.zip` | Application source + edge function + presets + this folder | 1.2 MB, 158 entries, `06274CF9…A5F7` |
| `model-manifest.json` | Every checkpoint / LoRA / ControlNet / FaceID / RMBG the graphs reference | — |
| `custom-nodes.txt` | Node packs, repos, why each is needed, commit = UNKNOWN | `C8015CFE…A1C7` |
| `requirements.txt` | Python deps for a clean ComfyUI rebuild | `747A74FC…EC66` |
| `kaggle_setup.py` | Installs ComfyUI, nodes, links models from a Kaggle dataset | `FF83CE66…975E` |
| `kaggle_start.py` | Launches ComfyUI and can drive the pose/style audit | `A0B432D9…B89F` |
| `checksums.txt` | SHA-256 of every artifact in this folder | — |
| `presets/poses.json` | **150** poses, numbered, with text | — |
| `presets/environments.json` | **89** environments | — |
| `presets/styles.json` | **98** styles with bucket mapping | — |
| `presets/buckets.json` | Counts: realism 20, outfit 5, anime 14, toy 12, fine art 17, framed 22, macro 8 | — |
| `workflows/belly2-squat.json` | Approved squat golden workflow, raw ComfyUI graph | 9.2 KB |
| `workflows/stand.json` | Standing workflow from the same session | 9.6 KB |

`project-source.zip` includes: `app/`, `components/`, `lib/`, `hooks/`, `contexts/`,
`constants/`, `assets/`, `supabase/functions/ai-image-edit/` (all TypeScript,
including `styleBuckets.ts`, `comfyWorkflow.ts`, `index.ts`, `GOLDEN.md`,
`RESUME.md`), `scripts/`, `docs/`, `migration/`, plus `package.json`, configs.

Excluded from the archive: `node_modules/`, `.git/`, `dist/`, `dist-test/`,
`.expo/`, `exports/`, `android/`, `ios/`, `audit/`. Nothing excluded is source —
these are build output, dependencies, or previously-produced images.

## Could not be packaged — pod unreachable

Every ComfyUI endpoint returned **404** at packaging time
(`/system_stats`, `/queue`, `/object_info/*`, `/history`, `/extensions`), i.e. the
pod `64g74uxnppd82i` is stopped or no longer behind the proxy. This is a blocker
for the following, and none of it can be read from the repository:

1. **Model files** — Pony V6 XL (~6.5 GB), Ashley LoRA, mbboi LoRA, three
   ControlNets, IPAdapter FaceID, InsightFace buffalo_l, RMBG-2.0. Names are
   recorded in `model-manifest.json`; **sizes and SHA-256 are null**.
2. **Custom node commit hashes** — the node *names* are known from the graphs,
   the commits are not. `custom-nodes.txt` marks them UNKNOWN.
3. **Python freeze / system packages** — `requirements.txt` is a reconstruction,
   not a `pip freeze`.
4. **ComfyUI config** — `extra_model_paths.yaml`, launch flags, and any
   `custom_nodes` settings live only on the pod.
5. **Audit results** — the audit never ran to completion. `audit/poses/` is empty;
   the last attempt returned HTTP 401 on every job. The approved sample renders
   from this session exist only as PNGs in the agent temp directory, not as an
   audit dataset.

### Complete the inventory on the pod (5 minutes, once it is started)

```bash
cd /workspace/runpod-slim/ComfyUI
find models -type f \( -name '*.safetensors' -o -name '*.bin' -o -name '*.pth' \) \
  -printf '%p %s\n' -exec sha256sum {} \; > /workspace/model-inventory.txt

for d in custom_nodes/*/; do
  echo "$d $(git -C "$d" rev-parse HEAD 2>/dev/null)" >> /workspace/custom-nodes.txt
done

pip freeze > /workspace/pip-freeze.txt
cat extra_model_paths.yaml 2>/dev/null > /workspace/extra_model_paths.yaml
tar -czf /workspace/comfy-config.tgz extra_model_paths.yaml user 2>/dev/null
```

Download those four files with `runpodctl` or the console, then merge
`model-inventory.txt` into `model-manifest.json` (sizes + hashes) and the commits
into `custom-nodes.txt`.

## Complete export from the pod (everything, not a hash list)

`pod-export.sh` runs on the pod and produces `/workspace/ily-export/`:

| Folder | Contents |
|---|---|
| `models/` | **The actual model files** — checkpoints, LoRAs, ControlNets, IPAdapter, InsightFace, RMBG, VAE, upscalers. Each folder tarred; anything over 4 GB split into `<3.8 GB` parts. |
| `comfy/` | `comfyui-source.tgz` (code only), `custom-nodes.tgz` (full node source **with** .git), `workflows-user.tgz`, `input-assets.tgz` |
| `config/` | `inventory.txt` (path \| bytes \| sha256 for every model, plus node commits/remotes/dirty state), `extra_model_paths.yaml`, user settings, any startup `.sh` |
| `env/` | `pip-freeze.txt`, `torch.txt` (torch + CUDA + device), `apt.txt`, `dpkg.txt`, `system.txt`, `env.txt` (secret values redacted, names kept) |
| `outputs/` | last 500 renders + ComfyUI log |
| `MANIFEST.sha256` | checksum of every file in the export |

Then pull it off the pod (`runpodctl send` for >2 GB, or scp) and merge on this machine:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File migration\merge-export.ps1 -ExportDir D:\ily-export
```

That writes real sizes and hashes into `model-manifest.json`, replaces `custom-nodes.txt`
with actual repos and **pinned commits**, produces `export-inventory.md`, and refreshes
`checksums.txt`.

Expected size: **~15–20 GB** (Pony 6.5 GB + controlnets 3–4 GB + LoRAs + IPAdapter/RMBG).
Plan the download and the Kaggle dataset upload around that.

## Kaggle path

1. Upload the model tree as a **private Kaggle Dataset** (one dataset, folder
   layout as documented at the top of `kaggle_setup.py`). Keep it separate from
   `project-source.zip` so the source archive stays small.
2. New Kaggle notebook, GPU **T4 ×2**, attach both the model dataset and this
   source archive.
3. `!python kaggle_setup.py` — installs ComfyUI + the five node packs, symlinks
   models from the dataset.
4. `!python kaggle_start.py --audit poses` — boots ComfyUI on 127.0.0.1:8188 and
   runs the 150-pose matrix; results land in `/kaggle/working/audit`.
5. `!python kaggle_start.py --audit styles` — the 98-style sweep.

Note: `kaggle_start.py` builds a **skeleton** graph (checkpoint + LoRA + sampler +
save). It does not yet reproduce the neon composite, the pass-2 restyle, the
lineart chain, or the prompt builder. For parity, port
`buildBucketStyleWorkflow` / `generateFinalOpenCodePayload` from
`supabase/functions/ai-image-edit/` rather than re-deriving the prompts.

## Known state of the pipeline at hand-off

- **Golden:** `ab2-B` — Pony, 832×1216, EmptyLatent, denoise 1.0, LoRA 0.85/0.85,
  FaceID 0.35/end 0.40, AnimeLineArt→Canny 0.50/0.55. Documented in `GOLDEN.md`.
- **Pose lane:** deliberately different — 1216×832, lineart off, LoRA 0.72/0.72,
  header `anime style, anime screencap, cel shaded flat colors … :1.45`. Best
  results: `squatbody` (squat), `kneel3` (kneeling), `restyle1` (standing).
- **Restoring lineart in pose mode was tried and rejected** — it re-locked the
  composition to the source selfie and produced a second character on one pose.
- **Locked audit mode** exists in `index.ts` (`lockedAudit` override): explicit
  seed, pinned room/pose/colour, `Math.random` swapped for a mulberry32 PRNG for
  the generation window, resolved config persisted to
  `ai_image_jobs.final_prompt` and logged as `[lockedAudit] …`.
- **Kneeling family** pruned to three anchored variants; the other 18 poses were
  converted to seated/lying/standing so indices stayed stable.
- **Hair dye removed then restored** at user request; head hair is set by
  `SUBJECT_TAGS`, dye applies to pubic styling only.

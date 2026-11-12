# ComfyUI assets the workflow depends on

The edge function references these files **by name inside ComfyUI's `input/`
folder**, not from the repo. A freshly rebuilt pod has none of them, so the graph
fails at `LoadImage` until they are uploaded.

Run this once after a pod rebuild, from the repo root:

```powershell
$base = "https://<POD_ID>-8188.proxy.runpod.net"

curl.exe -s -X POST "$base/upload/image" -F "image=@assets/ai/team_no_lackin_neon.png;type=image/png" -F "overwrite=true" -F "name=team_no_lackin_neon.png"
curl.exe -s -X POST "$base/upload/image" -F "image=@assets/ai/kingvon.png;type=image/png" -F "overwrite=true" -F "name=kingvon.png"
curl.exe -s -X POST "$base/upload/image" -F "image=@assets/ai/husband_ref.jpg;type=image/jpeg" -F "subfolder=boi" -F "overwrite=true" -F "name=boi_001.jpg"
```

## What each file is for

| File | Used by | Purpose |
| --- | --- | --- |
| `team_no_lackin_neon.png` | `buildBucketStyleWorkflow` | Neon sign composited and blended into every stylized frame. Transparent PNG, 1024x320. |
| `kingvon.png` | `buildRipShirtWorkflow` | FaceID reference for the rip-shirt host. |
| `husband_ref.jpg` | `buildCoupleWorkflow` | FaceID reference for the right half of couple renders. |

## LoRAs are not here

`ashley_v1_1200_steps_00001_.safetensors` and `mbboi_v1_1200_steps_00001_.safetensors`
were trained on the pod and live only in `ComfyUI/models/loras/`. They are **not**
recoverable from this repo — a pod without a network volume loses them on stop and
both need retraining (~30 min each) from the photo zips.

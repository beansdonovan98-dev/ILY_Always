#!/usr/bin/env bash
# Full ILY_Always ComfyUI export from the RunPod pod.
# Run inside the pod's web terminal:  bash pod-export.sh
# Produces /workspace/ily-export/ with archives + a checksum manifest.
#
# Nothing is deleted or modified. Read-only apart from writing into /workspace/ily-export.

set -euo pipefail

COMFY="${COMFY_DIR:-/workspace/runpod-slim/ComfyUI}"
OUT="${OUT_DIR:-/workspace/ily-export}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

say() { printf '\n== %s\n' "$*"; }

mkdir -p "$OUT/logs" "$OUT/config" "$OUT/env" "$OUT/models" "$OUT/comfy" "$OUT/outputs"

say "system + driver"
{
  uname -a
  echo
  nvidia-smi || true
  echo
  nvcc --version 2>/dev/null || true
  echo
  python3 --version
  echo
  cat /etc/os-release
} > "$OUT/env/system.txt" 2>&1

say "python environment"
python3 -m pip freeze > "$OUT/env/pip-freeze.txt" 2>&1 || true
python3 - <<'PY' > "$OUT/env/torch.txt" 2>&1 || true
import torch, torchvision
print("torch", torch.__version__, "cuda", torch.version.cuda, "available", torch.cuda.is_available())
print("torchvision", torchvision.__version__)
print("device", torch.cuda.get_device_name(0) if torch.cuda.is_available() else "none")
PY
(dpkg -l > "$OUT/env/dpkg.txt" 2>&1) || true
(apt list --installed > "$OUT/env/apt.txt" 2>&1) || true

say "environment variables (secrets filtered)"
{
  echo "# names only for anything that looks secret; values for the rest"
  printenv | sort | while IFS='=' read -r k v; do
    case "$k" in
      *KEY*|*TOKEN*|*SECRET*|*PASSWORD*|*ANON*|*SERVICE_ROLE*) echo "$k=<redacted len=${#v}>" ;;
      *) echo "$k=$v" ;;
    esac
  done
} > "$OUT/env/env.txt"

say "comfyui tree + sizes"
{
  echo "# top level"
  ls -la "$COMFY"
  echo
  echo "# git state"
  git -C "$COMFY" rev-parse HEAD 2>/dev/null || echo "not a git repo"
  git -C "$COMFY" status --porcelain 2>/dev/null | head -100 || true
  echo
  echo "# custom nodes (commit + remote + dirty?)"
  for d in "$COMFY"/custom_nodes/*/; do
    [ -d "$d" ] || continue
    name=$(basename "$d")
    commit=$(git -C "$d" rev-parse HEAD 2>/dev/null || echo "no-git")
    remote=$(git -C "$d" remote get-url origin 2>/dev/null || echo "no-remote")
    dirty=$(git -C "$d" status --porcelain 2>/dev/null | wc -l)
    echo "$name | $commit | $remote | dirty_files=$dirty"
  done
  echo
  echo "# model files: path, bytes, sha256"
  find "$COMFY/models" -type f \( -name '*.safetensors' -o -name '*.bin' -o -name '*.pth' -o -name '*.pt' -o -name '*.ckpt' -o -name '*.onnx' \) \
    -printf '%p|%s|' -exec sha256sum {} \; 2>/dev/null | awk -F'|' '{print $1 "|" $2 "|" substr($3,1,64)}'
  echo
  echo "# disk usage"
  du -sh "$COMFY" "$COMFY"/models/* 2>/dev/null || true
} > "$OUT/config/inventory.txt" 2>&1

say "comfyui config files"
for f in extra_model_paths.yaml config.yaml comfy.settings.json; do
  [ -f "$COMFY/$f" ] && cp "$COMFY/$f" "$OUT/config/" || true
done
[ -d "$COMFY/user" ] && tar -czf "$OUT/config/user-settings.tgz" -C "$COMFY" user 2>/dev/null || true
for f in /workspace/runpod-slim/*.sh /workspace/*.sh /root/*.sh /start.sh /app/start.sh; do
  [ -f "$f" ] && cp "$f" "$OUT/config/$(basename "$f")" || true
done
(docker info > "$OUT/config/docker-info.txt" 2>&1) || true

say "comfyui source (code only, no models)"
tar -czf "$OUT/comfy/comfyui-source.tgz" \
  --exclude='models' --exclude='output' --exclude='temp' --exclude='input' \
  --exclude='__pycache__' --exclude='*.pyc' --exclude='.git' \
  -C "$(dirname "$COMFY")" "$(basename "$COMFY")" 2>/dev/null || true
tar -czf "$OUT/comfy/custom-nodes.tgz" --exclude='__pycache__' --exclude='*.pyc' -C "$COMFY" custom_nodes 2>/dev/null || true
[ -d "$COMFY/user/default/workflows" ] && tar -czf "$OUT/comfy/workflows-user.tgz" -C "$COMFY/user/default" workflows 2>/dev/null || true
[ -d "$COMFY/input" ] && tar -czf "$OUT/comfy/input-assets.tgz" -C "$COMFY" input 2>/dev/null || true

say "models (the large ones — split so each part stays under 4 GB)"
for d in checkpoints loras controlnet ipadapter insightface RMBG clip_vision vae upscale_models embeddings; do
  [ -d "$COMFY/models/$d" ] || continue
  size=$(du -sm "$COMFY/models/$d" | awk '{print $1}')
  [ "$size" -eq 0 ] && continue
  echo "  packing models/$d (${size} MB)"
  if [ "$size" -gt 4000 ]; then
    tar -czf - -C "$COMFY/models" "$d" | split -b 3800M - "$OUT/models/${d}.tar.gz.part."
  else
    tar -czf "$OUT/models/${d}.tar.gz" -C "$COMFY/models" "$d"
  fi
done

say "outputs and history (last 500 renders, so the record survives)"
mkdir -p "$OUT/outputs/renders"
ls -t "$COMFY"/output/*.png 2>/dev/null | head -500 | while read -r f; do cp "$f" "$OUT/outputs/renders/"; done || true
[ -f "$COMFY/output/comfyui.log" ] && cp "$COMFY/output/comfyui.log" "$OUT/logs/" || true

say "checksums for everything in the export"
( cd "$OUT" && find . -type f ! -name 'MANIFEST.sha256' -printf '%P\n' | sort | while read -r f; do sha256sum "$f"; done ) > "$OUT/MANIFEST.sha256"

say "summary"
du -sh "$OUT"/* | sort -h
echo
echo "export complete: $OUT"
echo "checksums:       $OUT/MANIFEST.sha256"
echo "inventory:       $OUT/config/inventory.txt"
echo
echo "Pull it off the pod with one of:"
echo "  runpodctl send $OUT                      # prints a one-time code, fastest for >2 GB"
echo "  or scp -r root@<pod-ip>:/workspace/ily-export ./"
echo
echo "Then, on the machine holding the package: bash merge-export.sh <path-to-ily-export>"

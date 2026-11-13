#!/usr/bin/env bash
# One-shot: push ILY art assets from THIS POD to the private Kaggle dataset
# beansbudziespector/ily-comfy-assets. No PC round-trip.
#
# Run in the RunPod web terminal:
#   export KAGGLE_API_TOKEN=<your KGAT_... token>
#   bash kaggle-push-pod.sh
#
# Or paste the token inline below and run it.

set -euo pipefail

DATASET="beansbudziespector/ily-comfy-assets"
OUT="/tmp/kaggle_export"

say() { printf '\n== %s\n' "$*"; }

# ---------------------------------------------------------------- locate ComfyUI
COMFY="${COMFY_DIR:-}"
if [ -z "$COMFY" ]; then
  for c in /workspace/ComfyUI /workspace/runpod-slim/ComfyUI /opt/ComfyUI; do
    [ -f "$c/main.py" ] && COMFY="$c" && break
  done
fi
if [ -z "$COMFY" ]; then
  COMFY="$(dirname "$(find /workspace -maxdepth 4 -type f -name main.py -path '*ComfyUI*' 2>/dev/null | head -1)")"
fi
[ -f "$COMFY/main.py" ] || { echo "ComfyUI not found; set COMFY_DIR"; exit 1; }
echo "ComfyUI: $COMFY"

# ---------------------------------------------------------------- auth
python3 -m pip install -q "kaggle>=1.8.0" kagglehub

mkdir -p "$HOME/.kaggle"
if [ -n "${KAGGLE_API_TOKEN:-}" ]; then
  echo "$KAGGLE_API_TOKEN" > "$HOME/.kaggle/access_token"
  chmod 600 "$HOME/.kaggle/access_token"
  export KAGGLE_API_TOKEN
elif [ -f "$HOME/.kaggle/access_token" ]; then
  echo "using existing ~/.kaggle/access_token"
elif [ -f "$HOME/.kaggle/kaggle.json" ]; then
  echo "using existing ~/.kaggle/kaggle.json"
else
  echo "ERROR: no Kaggle credentials (export KAGGLE_API_TOKEN first)"; exit 1
fi

# ---------------------------------------------------------------- stage
say "staging in $OUT"
rm -rf "$OUT"
mkdir -p "$OUT/loras" "$OUT/workflows" "$OUT/proofs" "$OUT/manifests" "$OUT/scripts"

say "LoRAs"
find "$COMFY/models/loras" -maxdepth 1 -type f \( -name 'ashley_v1*' -o -name 'mbboi_v1*' \) \
  -exec cp -v {} "$OUT/loras/" \;

say "workflows"
if [ -d "$COMFY/user/default/workflows" ]; then
  cp -v "$COMFY"/user/default/workflows/*.json "$OUT/workflows/" 2>/dev/null || true
fi
find /workspace -maxdepth 3 -type f -name '*.json' \
  \( -name 'ily_*' -o -name 'belly2*' -o -name 'stand*' \) \
  -exec cp -v {} "$OUT/workflows/" \; 2>/dev/null || true

say "proof renders"
ls -t "$COMFY"/output/ily_proof2* "$COMFY"/output/ily_restyle1* "$COMFY"/output/ily_belly2* 2>/dev/null \
  | head -60 | while read -r f; do cp "$f" "$OUT/proofs/"; done
if [ -z "$(ls -A "$OUT/proofs" 2>/dev/null)" ]; then
  echo "  named proofs not found; taking the 40 most recent renders instead"
  ls -t "$COMFY"/output/*.png 2>/dev/null | head -40 | while read -r f; do cp "$f" "$OUT/proofs/"; done
fi

say "scripts + manifests"
find /workspace -maxdepth 2 -type f \( -name '*.sh' -o -name '*audit*.py' -o -name '*proof*.py' \) \
  -exec cp -v {} "$OUT/scripts/" \; 2>/dev/null || true
{
  echo "# models on pod (path|bytes|sha256)"
  find "$COMFY/models" -type f \( -name '*.safetensors' -o -name '*.bin' -o -name '*.pth' \) \
    -printf '%P|%s|' -exec sha256sum {} \; 2>/dev/null | awk -F'|' '{print $1 "|" $2 "|" substr($3,1,64)}'
} > "$OUT/manifests/pod-models.txt"
{
  echo "# custom nodes (name|commit|remote)"
  for d in "$COMFY"/custom_nodes/*/; do
    [ -d "$d" ] || continue
    echo "$(basename "$d")|$(git -C "$d" rev-parse HEAD 2>/dev/null || echo no-git)|$(git -C "$d" remote get-url origin 2>/dev/null || echo no-remote)"
  done
} > "$OUT/manifests/pod-nodes.txt"
{ uname -a; nvidia-smi 2>/dev/null | head -12; python3 -V; } > "$OUT/manifests/pod-system.txt"
python3 -m pip freeze > "$OUT/manifests/pip-freeze.txt" 2>/dev/null || true
[ -f "$COMFY/extra_model_paths.yaml" ] && cp "$COMFY/extra_model_paths.yaml" "$OUT/manifests/" || true

say "dataset metadata"
cat > "$OUT/dataset-metadata.json" <<'META'
{"title": "ily-comfy-assets", "id": "beansbudziespector/ily-comfy-assets", "licenses": [{"name": "CC0-1.0"}]}
META

say "payload"
du -sh "$OUT" "$OUT"/* | sort -h
find "$OUT" -type f | wc -l | xargs echo "files:"

# ---------------------------------------------------------------- push
say "creating private dataset"
if kaggle datasets status "$DATASET" >/dev/null 2>&1; then
  kaggle datasets version -p "$OUT" -m "update $(date -u +%Y-%m-%dT%H:%MZ)" --dir-mode zip
else
  kaggle datasets create -p "$OUT" --dir-mode zip
fi

say "verify"
kaggle datasets status "$DATASET" || true
echo
echo "https://www.kaggle.com/datasets/$DATASET"
echo "Safe to stop the pod once status reports ready."

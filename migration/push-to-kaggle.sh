#!/usr/bin/env bash
# Push art assets from the pod straight to a PRIVATE Kaggle Dataset.
# No download to the PC, no re-upload.
#
# Usage (in the pod's web terminal):
#   export KAGGLE_USERNAME=your_user
#   export KAGGLE_KEY=xxxxxxxxxxxxxxxxxxxx
#   bash push-to-kaggle.sh [owner/dataset-slug]
#
# If /root/.kaggle/kaggle.json already exists, the env vars are optional.

set -euo pipefail

COMFY="${COMFY_DIR:-/workspace/runpod-slim/ComfyUI}"
STAGE="${STAGE_DIR:-/workspace/kaggle-push}"
DATASET="${1:-${KAGGLE_DATASET:-}}"
PROOFS="${PROOF_COUNT:-80}"

say() { printf '\n== %s\n' "$*"; }

# ---------------------------------------------------------------- credentials
if [ ! -f "$HOME/.kaggle/kaggle.json" ] && [ -z "${KAGGLE_KEY:-}" ]; then
  echo "ERROR: no Kaggle credentials."
  echo "Either place kaggle.json at ~/.kaggle/kaggle.json or export KAGGLE_USERNAME and KAGGLE_KEY."
  exit 1
fi
if [ -n "${KAGGLE_KEY:-}" ]; then
  mkdir -p "$HOME/.kaggle"
  printf '{"username":"%s","key":"%s"}\n' "$KAGGLE_USERNAME" "$KAGGLE_KEY" > "$HOME/.kaggle/kaggle.json"
  chmod 600 "$HOME/.kaggle/kaggle.json"
fi

command -v kaggle >/dev/null 2>&1 || python3 -m pip install -q kaggle

if [ -z "$DATASET" ]; then
  USER="$(python3 -c 'import json,os;print(json.load(open(os.path.expanduser("~/.kaggle/kaggle.json")))["username"])')"
  DATASET="$USER/ily-always-comfy-artifacts"
fi
echo "target dataset: $DATASET"

# ---------------------------------------------------------------- stage
say "staging in $STAGE"
rm -rf "$STAGE"
mkdir -p "$STAGE/loras" "$STAGE/workflows" "$STAGE/proofs" "$STAGE/manifests"

say "LoRAs"
find "$COMFY/models/loras" -maxdepth 1 -type f \( -name 'ashley_v1*' -o -name 'mbboi_v1*' \) \
  -exec cp -v {} "$STAGE/loras/" \;
[ -n "$(ls -A "$STAGE/loras")" ] || echo "  WARNING: no LoRAs matched"

say "workflows"
if [ -d "$COMFY/user/default/workflows" ]; then
  cp -v "$COMFY"/user/default/workflows/*.json "$STAGE/workflows/" 2>/dev/null || true
fi
# golden graphs saved anywhere on the volume
find /workspace -maxdepth 3 -type f -name '*.json' \
  \( -name 'ily_*' -o -name 'belly2*' -o -name 'stand*' \) \
  -exec cp -v {} "$STAGE/workflows/" \; 2>/dev/null || true

say "output proofs (latest $PROOFS renders)"
ls -t "$COMFY"/output/*.png 2>/dev/null | head -"$PROOFS" | while read -r f; do
  cp "$f" "$STAGE/proofs/"
done
[ -n "$(ls -A "$STAGE/proofs")" ] || echo "  WARNING: no renders found in $COMFY/output"

say "manifests"
{
  echo "# models present on this pod"
  find "$COMFY/models" -type f \( -name '*.safetensors' -o -name '*.bin' -o -name '*.pth' \) \
    -printf '%P|%s|' -exec sha256sum {} \; 2>/dev/null | awk -F'|' '{print $1 "|" $2 "|" substr($3,1,64)}'
} > "$STAGE/manifests/pod-models.txt"
{
  echo "# custom nodes"
  for d in "$COMFY"/custom_nodes/*/; do
    [ -d "$d" ] || continue
    echo "$(basename "$d")|$(git -C "$d" rev-parse HEAD 2>/dev/null || echo no-git)|$(git -C "$d" remote get-url origin 2>/dev/null || echo no-remote)"
  done
} > "$STAGE/manifests/pod-nodes.txt"
{ uname -a; nvidia-smi 2>/dev/null | head -12; python3 -V; } > "$STAGE/manifests/pod-system.txt"
python3 -m pip freeze > "$STAGE/manifests/pip-freeze.txt" 2>/dev/null || true
[ -f "$COMFY/extra_model_paths.yaml" ] && cp "$COMFY/extra_model_paths.yaml" "$STAGE/manifests/" || true

say "dataset metadata"
USER_FOR_ID="${DATASET%%/*}"
SLUG_FOR_ID="${DATASET##*/}"
cat > "$STAGE/dataset-metadata.json" <<META
{
  "title": "ILY Always Comfy artifacts",
  "id": "$USER_FOR_ID/$SLUG_FOR_ID",
  "licenses": [{ "name": "CC0-1.0" }],
  "keywords": ["stable-diffusion", "loras", "comfyui", "workflows"]
}
META

say "size to upload"
du -sh "$STAGE" "$STAGE"/* | sort -h

# ---------------------------------------------------------------- push
say "pushing to Kaggle (private by default)"
if kaggle datasets status "$DATASET" >/dev/null 2>&1; then
  kaggle datasets version -p "$STAGE" -m "update $(date -u +%Y-%m-%dT%H:%MZ)" --dir-mode zip
else
  kaggle datasets create -p "$STAGE" --dir-mode zip
fi

echo
echo "done — https://www.kaggle.com/datasets/$DATASET"

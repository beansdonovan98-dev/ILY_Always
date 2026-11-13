"""Kaggle environment setup for the ILY_Always ComfyUI stack.

Run once per fresh Kaggle session (GPU T4 x2 recommended):

    !python kaggle_setup.py

Assumes a private Kaggle Dataset named by MODELS_DATASET containing this tree:

    models/checkpoints/ponyDiffusionV6XL_v6StartWithThisOne.safetensors
    models/loras/ashley_v1_1200_steps_00001_.safetensors
    models/loras/mbboi_v1_1200_steps_00001_.safetensors
    models/controlnet/diffusers_xl_canny_full.safetensors
    models/controlnet/thibaud_xl_openpose.safetensors
    models/controlnet/SDXL/depth-zoe-xl-v1.0-controlnet.safetensors
    models/ipadapter/ip-adapter-faceid-plusv2_sdxl.bin          (optional)
    models/insightface/models/buffalo_l/                        (optional)
    models/RMBG/RMBG-2.0/                                       (optional)
    input/team_no_lackin_neon.png

It installs ComfyUI and the pinned custom nodes, then symlinks the dataset models
into place so nothing is copied twice.
"""

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

COMFY_DIR = Path("/kaggle/working/ComfyUI")
DATASET_ROOT = Path(os.environ.get("MODELS_DATASET", "/kaggle/input/ily-comfy-models"))
WORK = Path("/kaggle/working")

CUSTOM_NODES = [
    ("https://github.com/Fannovel16/comfyui_controlnet_aux", None),
    ("https://github.com/ltdrdata/ComfyUI-Impact-Pack", None),
    ("https://github.com/ltdrdata/ComfyUI-Impact-Subpack", None),
    ("https://github.com/cubiq/ComfyUI_IPAdapter_plus", None),
    ("https://github.com/ZHO-ZHO-ZHO/ComfyUI-BRIA_AI-RMBG", None),
]


def run(cmd, cwd=None, check=True):
    print("+", " ".join(cmd) if isinstance(cmd, list) else cmd)
    return subprocess.run(cmd, cwd=cwd, shell=isinstance(cmd, str), check=check)


def main():
    if COMFY_DIR.exists():
        print(f"ComfyUI already present at {COMFY_DIR}")
    else:
        run(["git", "clone", "--depth", "1", "https://github.com/comfyanonymous/ComfyUI", str(COMFY_DIR)])

    run([sys.executable, "-m", "pip", "install", "-q", "-r", str(Path(__file__).parent / "requirements.txt")])

    nodes_dir = COMFY_DIR / "custom_nodes"
    nodes_dir.mkdir(parents=True, exist_ok=True)
    for repo, commit in CUSTOM_NODES:
        name = repo.rstrip("/").split("/")[-1]
        dest = nodes_dir / name
        if dest.exists():
            print(f"node present: {name}")
            continue
        run(["git", "clone", "--depth", "1", repo, str(dest)])
        if commit:
            run(["git", "fetch", "--depth", "1", "origin", commit], cwd=dest)
            run(["git", "checkout", commit], cwd=dest)
        req = dest / "requirements.txt"
        if req.exists():
            run([sys.executable, "-m", "pip", "install", "-q", "-r", str(req)], check=False)

    # Link models from the attached dataset instead of copying multi-GB files.
    if DATASET_ROOT.exists():
        for sub in ["checkpoints", "loras", "controlnet", "ipadapter", "insightface", "RMBG"]:
            src = DATASET_ROOT / "models" / sub
            dst = COMFY_DIR / "models" / sub
            dst.mkdir(parents=True, exist_ok=True)
            if not src.exists():
                print(f"missing model dir in dataset: {src}")
                continue
            for item in src.iterdir():
                target = dst / item.name
                if target.exists():
                    continue
                os.symlink(item, target)
                print(f"linked {target}")
        neon = DATASET_ROOT / "input" / "team_no_lackin_neon.png"
        if neon.exists():
            (COMFY_DIR / "input").mkdir(parents=True, exist_ok=True)
            shutil.copy2(neon, COMFY_DIR / "input" / "team_no_lackin_neon.png")
    else:
        print(f"WARNING: dataset root not found: {DATASET_ROOT}")

    print("\nSetup complete. Start with: python kaggle_start.py")


if __name__ == "__main__":
    main()

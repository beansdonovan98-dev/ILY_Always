"""Start ComfyUI locally on Kaggle and run the audit matrix against it.

    python kaggle_start.py                # ComfyUI only
    python kaggle_start.py --audit poses  # then run all 150 poses, adult-anime
    python kaggle_start.py --audit styles # then run all 98 styles

The audit talks to http://127.0.0.1:8188 directly, so no edge function and no
Supabase are involved. Graphs are built here from the same constants the edge
function uses, reproduced in presets/ (see migration/presets/*.json).
"""

import argparse
import json
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

COMFY_DIR = Path("/kaggle/working/ComfyUI")
WORK = Path("/kaggle/working/audit")
PRESETS = Path(__file__).parent / "presets"
PORT = 8188
BASE = f"http://127.0.0.1:{PORT}"


def wait_for_server(timeout=900):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(f"{BASE}/system_stats", timeout=5) as r:
                if r.status == 200:
                    print("ComfyUI is up")
                    return True
        except Exception:
            time.sleep(3)
    print("ComfyUI did not come up in time")
    return False


def start_comfy():
    WORK.mkdir(parents=True, exist_ok=True)
    log = open(WORK / "comfyui.log", "w")
    proc = subprocess.Popen(
        [sys.executable, "main.py", "--listen", "127.0.0.1", "--port", str(PORT)],
        cwd=str(COMFY_DIR),
        stdout=log,
        stderr=subprocess.STDOUT,
    )
    if not wait_for_server():
        proc.terminate()
        raise SystemExit(1)
    return proc


def load(name):
    with open(PRESETS / name, "r", encoding="utf-8") as f:
        return json.load(f)


def submit_and_wait(graph, timeout=300):
    data = json.dumps({"prompt": graph, "client_id": "kaggle-audit"}).encode()
    req = urllib.request.Request(
        f"{BASE}/prompt", data=data, headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        prompt_id = json.loads(r.read())["prompt_id"]
    deadline = time.time() + timeout
    while time.time() < deadline:
        with urllib.request.urlopen(f"{BASE}/history/{prompt_id}", timeout=30) as r:
            hist = json.loads(r.read())
        if prompt_id in hist:
            return hist[prompt_id]
        time.sleep(2)
    return None


def build_graph(positive, negative, seed, width=1216, height=832):
    """Minimal Pony graph: checkpoint + LoRA + sampler + save.

    NOTE: this is the skeleton. Copy the full node set from
    supabase/functions/ai-image-edit/comfyWorkflow.ts (buildBucketStyleWorkflow)
    if you need the neon composite or the pass-2 restyle.
    """
    return {
        "72": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "ponyDiffusionV6XL_v6StartWithThisOne.safetensors"}},
        "71": {"class_type": "LoraLoader", "inputs": {"model": ["72", 0], "clip": ["72", 1], "lora_name": "ashley_v1_1200_steps_00001_.safetensors", "strength_model": 0.72, "strength_clip": 0.72}},
        "73": {"class_type": "CLIPTextEncode", "inputs": {"text": positive, "clip": ["71", 1]}},
        "74": {"class_type": "CLIPTextEncode", "inputs": {"text": negative, "clip": ["71", 1]}},
        "201": {"class_type": "EmptyLatentImage", "inputs": {"width": width, "height": height, "batch_size": 1}},
        "77": {"class_type": "KSampler", "inputs": {"seed": seed, "steps": 30, "cfg": 6.5, "sampler_name": "dpmpp_2m", "scheduler": "karras", "denoise": 1.0, "model": ["71", 0], "positive": ["73", 0], "negative": ["74", 0], "latent_image": ["201", 0]}},
        "78": {"class_type": "VAEDecode", "inputs": {"samples": ["77", 0], "vae": ["72", 2]}},
        "79": {"class_type": "SaveImage", "inputs": {"filename_prefix": "audit", "images": ["78", 0]}},
    }


def audit(kind):
    WORK.mkdir(parents=True, exist_ok=True)
    if kind == "poses":
        poses = load("poses.json")["poses"]
        items = [(f"pose-{i+1:03d}", poses[i]) for i in range(len(poses))]
        style = "adult-anime"
    else:
        styles = load("styles.json")["styles"]
        items = [(f"style-{s['id']}", "standing with her weight on one hip, a lit joint in one hand, looking at the viewer") for s in styles]
        style = None

    manifest = []
    for name, text in items:
        positive = f"score_9, score_8_up, score_7_up, source_anime, (anime style, anime screencap, cel shaded flat colors, 2d cel shading, clean bold lineart, vibrant colors:1.45), ({text}:1.35), 1girl, solo, nude woman, ashley, round wireframe glasses"
        negative = "score_6, score_5, score_4, deformed, bad anatomy, extra limbs, photorealistic, 3d render, watercolor, plush toy, teddy bear"
        graph = build_graph(positive, negative, seed=300661729)
        result = submit_and_wait(graph)
        ok = result is not None
        manifest.append({"name": name, "style": style, "pose": text, "completed": ok})
        print(f"{name} {'ok' if ok else 'FAILED'}")
    with open(WORK / f"{kind}-manifest.json", "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--audit", choices=["poses", "styles"], default=None)
    args = ap.parse_args()
    proc = start_comfy()
    try:
        if args.audit:
            audit(args.audit)
        else:
            print("ComfyUI running; press Ctrl-C to stop")
            while True:
                time.sleep(30)
    finally:
        proc.terminate()


if __name__ == "__main__":
    main()

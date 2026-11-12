const HARMONIZE_POSITIVE =
  'score_9, score_8_up, score_7_up, cinematic lighting, unified color grade, matching shadows, cohesive composition, film grain, detailed';

export type ComfyWorkflowOptions = {
  imageName: string;
  positive: string;
  negative: string;
  denoise: number;
  seed: number;
  filenamePrefix: string;
  checkpoint?: string;
  faceIdProvider?: string;
  faceIdWeight?: number;
  /** Set false to skip the FaceID branch for images where no face is present. */
  useFaceId?: boolean;
  /** Anime styles use OpenPose ControlNet to hold body shape and pose. */
  useControlNet?: boolean;
  /** Optional depth ControlNet strength for tuning. */
  depthStrength?: number;
  /** Anime styles run ReActor to put the original face back on the styled image. */
  useFaceSwap?: boolean;
  /** Anime styles re-render detected faces at high resolution. */
  useFaceDetail?: boolean;
  /** Anime styles paste the original face back for exact likeness. */
  useFaceComposite?: boolean;
};

/**
 * Where the inpaint mask comes from:
 * - brush: a PNG the Edge Function rasterized from the app's finger strokes.
 * - background/hair: a segmentation node on the pod (RMBG / HumanParts).
 */
export type InpaintMaskSource =
  | { kind: 'brush'; maskImage: string }
  | { kind: 'background'; node: string; model: string }
  | { kind: 'hair'; node: string };

export type InpaintWorkflowOptions = {
  imageName: string;
  mask: InpaintMaskSource;
  positive: string;
  negative: string;
  /** 0.3 = subtle touch-up, 0.9 = replace the masked area. */
  denoise: number;
  seed: number;
  filenamePrefix: string;
  checkpoint?: string;
  faceIdProvider?: string;
  faceIdWeight?: number;
  /** Set false to skip the FaceID branch for images where no face is present. */
  useFaceId?: boolean;
  /** Pixels to expand the mask so the repaint blends past its edge. */
  growMaskBy?: number;
};

/**
 * API-format workflow exported from the working ComfyUI pod.
 * Node IDs match the exported app.json so the graph stays identical.
 */
export function buildComfyWorkflow(options: ComfyWorkflowOptions): Record<string, unknown> {
  const checkpoint = options.checkpoint || 'ponyDiffusionV6XL_v6StartWithThisOne.safetensors';
  const faceIdProvider = options.faceIdProvider || 'CPU';
  const faceIdWeight = options.faceIdWeight ?? 0.65;
  const useFaceId = options.useFaceId !== false;
  const depthStrength = Number.isFinite(options.depthStrength) ? (options.depthStrength as number) : 0.35;

  const workflow: Record<string, unknown> = {
    '72': {
      class_type: 'CheckpointLoaderSimple',
      inputs: { ckpt_name: checkpoint },
    },
    '73': {
      class_type: 'CLIPTextEncode',
      inputs: { text: options.positive, clip: ['81', 0] },
    },
    '74': {
      class_type: 'CLIPTextEncode',
      inputs: { text: options.negative, clip: ['81', 0] },
    },
    '75': {
      class_type: 'LoadImage',
      inputs: { image: options.imageName },
    },
    '76': {
      class_type: 'VAEEncode',
      inputs: { pixels: ['80', 0], vae: ['72', 2] },
    },
    '77': {
      class_type: 'KSampler',
      inputs: {
        seed: options.seed,
        steps: 32,
        cfg: 5.5,
        sampler_name: 'dpmpp_2m',
        scheduler: 'karras',
        denoise: options.denoise,
        model: ['72', 0],
        positive: ['73', 0],
        negative: ['74', 0],
        latent_image: ['76', 0],
      },
    },
    '78': {
      class_type: 'VAEDecode',
      inputs: { samples: ['77', 0], vae: ['72', 2] },
    },
    '79': {
      class_type: 'SaveImage',
      inputs: { filename_prefix: options.filenamePrefix, images: ['78', 0] },
    },
    '80': {
      class_type: 'ImageScaleToMaxDimension',
      inputs: {
        upscale_method: 'area',
        largest_size: 1536,
        image: ['75', 0],
      },
    },
    '81': {
      class_type: 'CLIPSetLastLayer',
      inputs: { stop_at_clip_layer: -2, clip: ['72', 1] },
    },
  };

  if (useFaceId) {
    workflow['85'] = {
      class_type: 'IPAdapterUnifiedLoaderFaceID',
      inputs: {
        preset: 'FACEID',
        lora_strength: 0.5,
        provider: faceIdProvider,
        model: ['72', 0],
      },
    };
    workflow['86'] = {
      class_type: 'IPAdapterFaceID',
      inputs: {
        weight: faceIdWeight,
        weight_faceidv2: 1,
        weight_type: 'linear',
        combine_embeds: 'concat',
        start_at: 0,
        end_at: 1,
        embeds_scaling: 'V only',
        model: ['85', 0],
        ipadapter: ['85', 1],
        image: ['80', 0],
      },
    };
    (workflow['77'] as { inputs: Record<string, unknown> }).inputs.model = ['86', 0];
  }

  if (options.useControlNet) {
    workflow['102'] = {
      class_type: 'OpenposePreprocessor',
      inputs: { image: ['80', 0] },
    };
    workflow['103'] = {
      class_type: 'ControlNetLoader',
      inputs: { control_net_name: 'thibaud_xl_openpose.safetensors' },
    };
    workflow['104'] = {
      class_type: 'ControlNetApplyAdvanced',
      inputs: {
        positive: ['73', 0],
        negative: ['74', 0],
        control_net: ['103', 0],
        image: ['102', 0],
        strength: 0.95,
        start_percent: 0,
        end_percent: 1,
      },
    };
    // Depth holds body volume/weight (curves, stomach) that OpenPose alone
    // cannot. Kept moderate so the anime style still reads.
    workflow['108'] = {
      class_type: 'Zoe-DepthMapPreprocessor',
      inputs: { image: ['80', 0] },
    };
    // Smooth the depth map so belly folds/creases are not redrawn as abs.
    workflow['112'] = {
      class_type: 'ImageBlur',
      inputs: { image: ['108', 0], blur_radius: 10, sigma: 5 },
    };
    workflow['109'] = {
      class_type: 'ControlNetLoader',
      inputs: { control_net_name: 'SDXL/depth-zoe-xl-v1.0-controlnet.safetensors' },
    };
    workflow['110'] = {
      class_type: 'ControlNetApplyAdvanced',
      inputs: {
        positive: ['104', 0],
        negative: ['104', 1],
        control_net: ['109', 0],
        image: ['112', 0],
        strength: depthStrength,
        start_percent: 0,
        end_percent: 1,
      },
    };
    (workflow['77'] as { inputs: Record<string, unknown> }).inputs.positive = ['110', 0];
    (workflow['77'] as { inputs: Record<string, unknown> }).inputs.negative = ['110', 1];
  }

  if (options.useFaceSwap) {
    workflow['111'] = {
      class_type: 'ReActorFaceSwap',
      inputs: {
        enabled: true,
        input_image: ['78', 0],
        source_image: ['75', 0],
        swap_model: 'inswapper_128.onnx',
        facedetection: 'retinaface_resnet50',
        face_restore_model: 'codeformer-v0.1.0.pth',
        face_restore_visibility: 0.75,
        codeformer_weight: 0.35,
        detect_gender_input: 'no',
        detect_gender_source: 'no',
        input_faces_index: '0',
        source_faces_index: '0',
        console_log_level: 1,
      },
    };
    (workflow['79'] as { inputs: Record<string, unknown> }).inputs.images = ['111', 0];
  }

  if (options.useFaceDetail) {
    workflow['113'] = {
      class_type: 'MediaPipeFaceMeshToSEGS',
      inputs: {
        image: ['78', 0],
        crop_factor: 3.0,
        bbox_fill: false,
        crop_min_size: 50,
        drop_size: 1,
        dilation: 0,
        face: true,
        mouth: false,
        left_eyebrow: false,
        left_eye: false,
        left_pupil: false,
        right_eyebrow: false,
        right_eye: false,
        right_pupil: false,
      },
    };
    workflow['114'] = {
      class_type: 'DetailerForEach',
      inputs: {
        image: ['78', 0],
        segs: ['113', 0],
        model: options.useFaceId ? ['86', 0] : ['72', 0],
        clip: ['81', 0],
        vae: ['72', 2],
        guide_size: 512,
        guide_size_for: true,
        max_size: 1024,
        seed: options.seed + 2,
        steps: 24,
        cfg: 5.0,
        sampler_name: 'dpmpp_2m',
        scheduler: 'karras',
        positive: ['73', 0],
        negative: ['74', 0],
        denoise: 0.4,
        feather: 5,
        noise_mask: true,
        force_inpaint: true,
        wildcard: '',
        cycle: 1,
      },
    };
    (workflow['79'] as { inputs: Record<string, unknown> }).inputs.images = ['114', 0];
  }

  if (options.useFaceComposite) {
    // Detect the face on the ORIGINAL image and paste those exact pixels over
    // the anime result. This is the only path that preserves real features
    // without ReActor's black-frame failure.
    workflow['115'] = {
      class_type: 'MediaPipeFaceMeshToSEGS',
      inputs: {
        // Detect the face on the STYLED image so the paste lands where the
        // anime face actually is, not where the original face was.
        image: ['78', 0],
        crop_factor: 3.0,
        bbox_fill: false,
        crop_min_size: 50,
        drop_size: 1,
        dilation: 0,
        face: true,
        mouth: false,
        left_eyebrow: false,
        left_eye: false,
        left_pupil: false,
        right_eyebrow: false,
        right_eye: false,
        right_pupil: false,
      },
    };
    // Keep only the largest face so background/phone reflections are ignored.
    workflow['122'] = {
      class_type: 'ImpactSEGSOrderedFilter',
      inputs: {
        segs: ['115', 0],
        target: 'area(=w*h)',
        order: true,
        take_start: 0,
        take_count: 1,
      },
    };
    workflow['116'] = {
      class_type: 'SegsToCombinedMask',
      inputs: { segs: ['122', 0] },
    };
    workflow['117'] = {
      class_type: 'GrowMask',
      inputs: { mask: ['116', 0], expand: 24, tapered_corners: true },
    };
    workflow['118'] = {
      class_type: 'ImageCompositeMasked',
      inputs: {
        destination: ['78', 0],
        source: ['75', 0],
        x: 0,
        y: 0,
        resize_source: false,
        mask: ['117', 0],
      },
    };
    // Paste last: no diffusion on the face, so the model cannot redraw the
    // eyes/mouth. GrowMask's tapered edge provides the blend.
    (workflow['79'] as { inputs: Record<string, unknown> }).inputs.images = ['118', 0];
  }

  return workflow;
}

export type RealismWorkflowOptions = {
  imageName: string;
  positive: string;
  negative: string;
  editPositive?: string;
  seed: number;
  filenamePrefix: string;
  checkpoint?: string;
  width: number;
  height: number;
};

function realismBase(options: RealismWorkflowOptions): Record<string, unknown> {
  const checkpoint = options.checkpoint || 'ponyDiffusionV6XL_v6StartWithThisOne.safetensors';
  const width = Math.max(512, Math.round(options.width / 8) * 8);
  const height = Math.max(512, Math.round(options.height / 8) * 8);

  return {
    '72': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: checkpoint } },
    '81': { class_type: 'CLIPSetLastLayer', inputs: { stop_at_clip_layer: -2, clip: ['72', 1] } },
    '73': { class_type: 'CLIPTextEncode', inputs: { text: options.positive, clip: ['81', 0] } },
    '74': { class_type: 'CLIPTextEncode', inputs: { text: options.negative, clip: ['81', 0] } },
    '75': { class_type: 'LoadImage', inputs: { image: options.imageName } },
    '80': {
      class_type: 'ImageScaleToMaxDimension',
      inputs: { upscale_method: 'area', largest_size: 1536, image: ['75', 0] },
    },
    '200': {
      class_type: 'ImageScale',
      inputs: { image: ['75', 0], upscale_method: 'lanczos', width, height, crop: 'disabled' },
    },
    '84': {
      class_type: 'RMBG',
      inputs: {
        image: ['200', 0],
        model: 'RMBG-2.0',
        sensitivity: 1.0,
        process_res: 1024,
        mask_blur: 0,
        mask_offset: 0,
        invert_output: false,
        refine_foreground: true,
        background: 'Alpha',
        background_color: '#222222',
      },
    },
    '95': { class_type: 'GrowMask', inputs: { mask: ['84', 1], expand: 4, tapered_corners: true } },
    '96': {
      class_type: 'ImpactGaussianBlurMask',
      inputs: { mask: ['95', 0], kernel_size: 12, sigma: 6 },
    },
    '201': { class_type: 'EmptyLatentImage', inputs: { width, height, batch_size: 1 } },
    '202': {
      class_type: 'KSampler',
      inputs: {
        seed: options.seed,
        steps: 30,
        cfg: 5.5,
        sampler_name: 'dpmpp_2m',
        scheduler: 'karras',
        denoise: 1.0,
        model: ['72', 0],
        positive: ['73', 0],
        negative: ['74', 0],
        latent_image: ['201', 0],
      },
    },
    '203': { class_type: 'VAEDecode', inputs: { samples: ['202', 0], vae: ['72', 2] } },
    '204': {
      class_type: 'ImageCompositeMasked',
      inputs: {
        destination: ['203', 0],
        source: ['200', 0],
        x: 0,
        y: 0,
        resize_source: false,
        mask: ['96', 0],
      },
    },
    // Face mask from the original subject; used to exclude the face from
    // harmonization and body edits.
    '113': {
      class_type: 'MediaPipeFaceMeshToSEGS',
      inputs: {
        image: ['200', 0],
        crop_factor: 3.0,
        bbox_fill: false,
        crop_min_size: 50,
        drop_size: 1,
        dilation: 0,
        face: true,
        mouth: false,
        left_eyebrow: false,
        left_eye: false,
        left_pupil: false,
        right_eyebrow: false,
        right_eye: false,
        right_pupil: false,
      },
    },
    '122': {
      class_type: 'ImpactSEGSOrderedFilter',
      inputs: { segs: ['113', 0], target: 'area(=w*h)', order: true, take_start: 0, take_count: 1 },
    },
    '116': { class_type: 'SegsToCombinedMask', inputs: { segs: ['122', 0] } },
    // Grow the face mask so her glasses are protected too, not just the inner face.
    '117': { class_type: 'GrowMask', inputs: { mask: ['116', 0], expand: 22, tapered_corners: true } },
    '118': { class_type: 'SolidMask', inputs: { value: 1.0, width, height } },
    '119': {
      class_type: 'MaskComposite',
      inputs: { destination: ['118', 0], source: ['117', 0], x: 0, y: 0, operation: 'subtract' },
    },
    '120': {
      class_type: 'ImpactGaussianBlurMask',
      inputs: { mask: ['119', 0], kernel_size: 10, sigma: 5 },
    },
    '124': {
      class_type: 'CLIPTextEncode',
      inputs: { text: HARMONIZE_POSITIVE, clip: ['81', 0] },
    },
  };
}

/** Mode 1A: new background + exact subject composite + face-protected blend. */
export function buildRealismCompositeWorkflow(
  options: RealismWorkflowOptions
): Record<string, unknown> {
  const workflow = realismBase(options);
  workflow['205'] = { class_type: 'VAEEncode', inputs: { pixels: ['204', 0], vae: ['72', 2] } };
  workflow['206'] = {
    class_type: 'SetLatentNoiseMask',
    inputs: { samples: ['205', 0], mask: ['120', 0] },
  };
  workflow['207'] = {
    class_type: 'KSampler',
    inputs: {
      seed: options.seed + 1,
      steps: 12,
      cfg: 5.0,
      sampler_name: 'dpmpp_2m',
      scheduler: 'karras',
      denoise: 0.16,
      model: ['72', 0],
      positive: ['124', 0],
      negative: ['74', 0],
      latent_image: ['206', 0],
    },
  };
  workflow['208'] = { class_type: 'VAEDecode', inputs: { samples: ['207', 0], vae: ['72', 2] } };
  workflow['79'] = {
    class_type: 'SaveImage',
    inputs: { filename_prefix: options.filenamePrefix, images: ['208', 0] },
  };
  return workflow;
}

/** Mode 1B: new background + body/outfit edit with face fully excluded. */
export function buildRealismOutfitWorkflow(
  options: RealismWorkflowOptions
): Record<string, unknown> {
  const workflow = realismBase(options);
  // Body mask = foreground minus face. Background and face stay untouched.
  workflow['121'] = {
    class_type: 'MaskComposite',
    inputs: { destination: ['95', 0], source: ['117', 0], x: 0, y: 0, operation: 'subtract' },
  };
  workflow['123'] = {
    class_type: 'ImpactGaussianBlurMask',
    inputs: { mask: ['121', 0], kernel_size: 10, sigma: 5 },
  };
  workflow['209'] = {
    class_type: 'CLIPTextEncode',
    inputs: { text: options.editPositive || options.positive, clip: ['81', 0] },
  };
  workflow['210'] = { class_type: 'VAEEncode', inputs: { pixels: ['204', 0], vae: ['72', 2] } };
  workflow['211'] = {
    class_type: 'SetLatentNoiseMask',
    inputs: { samples: ['210', 0], mask: ['123', 0] },
  };
  workflow['212'] = {
    class_type: 'KSampler',
    inputs: {
      seed: options.seed + 2,
      steps: 24,
      cfg: 5.5,
      sampler_name: 'dpmpp_2m',
      scheduler: 'karras',
      denoise: 0.6,
      model: ['72', 0],
      positive: ['209', 0],
      negative: ['74', 0],
      latent_image: ['211', 0],
    },
  };
  workflow['213'] = { class_type: 'VAEDecode', inputs: { samples: ['212', 0], vae: ['72', 2] } };
  workflow['205'] = { class_type: 'VAEEncode', inputs: { pixels: ['213', 0], vae: ['72', 2] } };
  workflow['206'] = {
    class_type: 'SetLatentNoiseMask',
    inputs: { samples: ['205', 0], mask: ['120', 0] },
  };
  workflow['207'] = {
    class_type: 'KSampler',
    inputs: {
      seed: options.seed + 3,
      steps: 12,
      cfg: 5.0,
      sampler_name: 'dpmpp_2m',
      scheduler: 'karras',
      denoise: 0.16,
      model: ['72', 0],
      positive: ['124', 0],
      negative: ['74', 0],
      latent_image: ['206', 0],
    },
  };
  workflow['208'] = { class_type: 'VAEDecode', inputs: { samples: ['207', 0], vae: ['72', 2] } };
  workflow['79'] = {
    class_type: 'SaveImage',
    inputs: { filename_prefix: options.filenamePrefix, images: ['208', 0] },
  };
  return workflow;
}

export type BucketStyleWorkflowOptions = {
  imageName: string;
  positive: string;
  negative: string;
  seed: number;
  filenamePrefix: string;
  checkpoint?: string;
  width: number;
  height: number;
  controlNet: 'depth' | 'anime_line' | 'depth_line' | 'openpose' | 'none';
  controlNetStrength: number;
  controlNetEndPercent: number;
  lineartStrength?: number;
  lineartEndPercent?: number;
  /** FaceID stops early so the style can finish the surface. */
  faceIdEndAt?: number;
  /** true = img2img from her gray-replaced cutout instead of empty latent. */
  initFromSource?: boolean;
  /** Scale for the subject when padded (0.7 leaves a 15% margin per side). */
  padScale?: number;
  /** Trained subject LoRA (e.g. ashley_v1). */
  loraName?: string;
  loraStrength?: number;
  /** Separate positive stream for the room, combined at reduced strength. */
  backgroundPositive?: string;
  /** Optional pose reference image; drives OpenPose instead of her silhouette. */
  poseImage?: string;
  /** Composite the Team No Lackin neon sign and blend it into the scene. */
  neonSign?: boolean;
  /** Sampler CFG from the bucket config. */
  cfgScale?: number;
  faceIdWeight: number;
  faceIdLoraStrength: number;
  faceIdProvider?: string;
  /** Blur radius for the color-block latent. 0 disables the blurred base. */
  blurRadius?: number;
  denoise?: number;
  /** Shrink the masked subject to 50% and center it, leaving room for an object around her. */
  padSubject?: boolean;
};

/**
 * Style pass for anime/toy/fine-art/framed/macro buckets.
 *
 * Likeness comes from three stacked signals instead of a trained LoRA:
 *  1. A tight face crop (MediaPipe bbox) fed to IPAdapterFaceID, so InsightFace
 *     spends its pixels on her eyes/glasses/lips instead of torso and bedroom.
 *  2. A blurred color-block latent: segmented subject over neutral gray, blurred
 *     hard, VAE-encoded at 0.86 denoise. Keeps skin tone, hair shade and body
 *     mass while destroying photo grain so the style fully takes over.
 *  3. Depth + lineart ControlNets stacked on the same masked subject: depth holds
 *     volume/weight, lineart holds glasses, eye shape, lip contour, hair.
 */
export function buildBucketStyleWorkflow(
  options: BucketStyleWorkflowOptions
): Record<string, unknown> {
  const checkpoint = options.checkpoint || 'ponyDiffusionV6XL_v6StartWithThisOne.safetensors';
  const width = Math.max(512, Math.round(options.width / 8) * 8);
  const height = Math.max(512, Math.round(options.height / 8) * 8);
  const blurRadius = options.blurRadius ?? 20;
  const denoise = options.denoise ?? 0.86;
  const useBlurredBase = blurRadius > 0;

  const workflow: Record<string, unknown> = {
    '72': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: checkpoint } },
    '81': { class_type: 'CLIPSetLastLayer', inputs: { stop_at_clip_layer: -2, clip: ['72', 1] } },
    '73': { class_type: 'CLIPTextEncode', inputs: { text: options.positive, clip: ['81', 0] } },
    '74': { class_type: 'CLIPTextEncode', inputs: { text: options.negative, clip: ['81', 0] } },
    '75': { class_type: 'LoadImage', inputs: { image: options.imageName } },
    '87': {
      class_type: 'ImageScale',
      inputs: { image: ['75', 0], upscale_method: 'lanczos', width, height, crop: 'center' },
    },
    // Subject over neutral gray: bedroom is gone, silhouette stays.
    '84': {
      class_type: 'RMBG',
      inputs: {
        image: ['87', 0],
        model: 'RMBG-2.0',
        sensitivity: 1.0,
        process_res: 1024,
        mask_blur: 0,
        mask_offset: 0,
        invert_output: false,
        refine_foreground: true,
        background: 'Color',
        background_color: '#808080',
      },
    },
    // Deterministic head-and-shoulders crop for FaceID. MediaPipe returns empty
    // SEGS on this pod, so this is fixed geometry — keep it generous (full width,
    // top 62%) or a differently-framed upload puts her face outside the crop and
    // InsightFace reports "No face detected".
    '93': {
      class_type: 'ImageCrop',
      inputs: {
        image: ['87', 0],
        width,
        height: Math.round(height * 0.62),
        x: 0,
        y: 0,
      },
    },
    '94': {
      class_type: 'ImageScale',
      inputs: { image: ['93', 0], upscale_method: 'lanczos', width: 1024, height: 1024, crop: 'center' },
    },
    '85': {
      class_type: 'IPAdapterUnifiedLoaderFaceID',
      inputs: {
        preset: 'FACEID',
        lora_strength: options.faceIdLoraStrength,
        provider: options.faceIdProvider || 'CPU',
        model: ['72', 0],
      },
    },
    '86': {
      class_type: 'IPAdapterFaceID',
      inputs: {
        weight: options.faceIdWeight,
        weight_faceidv2: 1,
        weight_type: 'linear',
        combine_embeds: 'concat',
        start_at: 0,
        // FaceID builds structure early; the tail renders style over it.
        end_at: options.faceIdEndAt ?? 0.72,
        embeds_scaling: 'V only',
        model: ['85', 0],
        ipadapter: ['85', 1],
        image: ['94', 0],
      },
    },
    '77': {
      class_type: 'KSampler',
      inputs: {
        seed: options.seed,
        steps: 30,
        cfg: 5.5,
        sampler_name: 'dpmpp_2m',
        scheduler: 'karras',
        denoise,
        model: ['86', 0],
        positive: ['73', 0],
        negative: ['74', 0],
        latent_image: ['201', 0],
      },
    },
    '78': { class_type: 'VAEDecode', inputs: { samples: ['77', 0], vae: ['72', 2] } },
    '79': { class_type: 'SaveImage', inputs: { filename_prefix: options.filenamePrefix, images: ['78', 0] } },
  };

  // Subject LoRA: her trained face/body, applied before CLIP skip and FaceID.
  if (options.loraName) {
    const loraStrength = options.loraStrength ?? 0.7;
    workflow['71'] = {
      class_type: 'LoraLoader',
      inputs: {
        model: ['72', 0],
        clip: ['72', 1],
        lora_name: options.loraName,
        strength_model: loraStrength,
        strength_clip: loraStrength,
      },
    };
    (workflow['81'] as { inputs: Record<string, unknown> }).inputs.clip = ['71', 1];
    (workflow['85'] as { inputs: Record<string, unknown> }).inputs.model = ['71', 0];
  }

  // Bucket CFG applies to every sampler in this graph.
  if (options.cfgScale) {
    for (const nodeId of ['77', '121']) {
      const node = workflow[nodeId] as { inputs?: Record<string, unknown> } | undefined;
      if (node?.inputs) node.inputs.cfg = options.cfgScale;
    }
  }

  if (options.initFromSource !== false) {
    // Plain img2img from her photo. An empty latent cannot carry her face — the
    // LoRA only nudges toward "a red-haired woman" — so identity wins here and
    // the scene comes from the background conditioning stream instead.
    workflow['201'] = { class_type: 'VAEEncode', inputs: { pixels: ['87', 0], vae: ['72', 2] } };
  } else if (useBlurredBase) {
    workflow['88'] = {
      class_type: 'ImageBlur',
      inputs: { image: ['116', 0], blur_radius: blurRadius, sigma: blurRadius / 2 },
    };
    workflow['201'] = { class_type: 'VAEEncode', inputs: { pixels: ['88', 0], vae: ['72', 2] } };
  } else if (options.initFromSource !== false) {
    // Straight img2img on her gray-replaced cutout: keeps her real face and
    // body weight under the style instead of inventing them from noise.
    workflow['201'] = { class_type: 'VAEEncode', inputs: { pixels: ['116', 0], vae: ['72', 2] } };
  } else {
    workflow['201'] = { class_type: 'EmptyLatentImage', inputs: { width, height, batch_size: 1 } };
  }

  // Background regeneration: the RMBG subject mask now drives the latent. The
  // background region is fully noised so the campsite can actually generate,
  // while her pixels stay at the low denoise.
  if (options.initFromSource !== false) {
    workflow['170'] = { class_type: 'SolidMask', inputs: { value: 1, width, height } };
    workflow['171'] = {
      class_type: 'MaskComposite',
      inputs: { destination: ['170', 0], source: ['112', 0], x: 0, y: 0, operation: 'subtract' },
    };
    workflow['172'] = {
      class_type: 'GrowMask',
      inputs: { mask: ['171', 0], expand: 8, tapered_corners: true },
    };
    workflow['173'] = {
      class_type: 'ImpactGaussianBlurMask',
      inputs: { mask: ['172', 0], kernel_size: 24, sigma: 12 },
    };
    workflow['174'] = {
      class_type: 'SetLatentNoiseMask',
      inputs: { samples: ['201', 0], mask: ['173', 0] },
    };
    (workflow['77'] as { inputs: Record<string, unknown> }).inputs.latent_image = ['174', 0];
  }

  // ControlNets stack on the masked subject, not on the raw photo.
  let subjectRef: [string, number] = ['84', 0];

  // Mirror selfies make RMBG keep the reflection as a second blob. Keep only the
  // largest connected component so nothing but her reaches ControlNet or FaceID.
  workflow['110'] = {
    class_type: 'MaskToSEGS',
    inputs: {
      mask: ['84', 1],
      combined: false,
      crop_factor: 1.0,
      bbox_fill: false,
      drop_size: 1,
      contour_fill: false,
    },
  };
  workflow['111'] = {
    class_type: 'ImpactSEGSOrderedFilter',
    inputs: { segs: ['110', 0], target: 'area(=w*h)', order: true, take_start: 0, take_count: 1 },
  };
  workflow['112'] = { class_type: 'SegsToCombinedMask', inputs: { segs: ['111', 0] } };
  workflow['115'] = {
    class_type: 'EmptyImage',
    inputs: { width, height, batch_size: 1, color: 8421504 },
  };
  workflow['116'] = {
    class_type: 'ImageCompositeMasked',
    inputs: {
      destination: ['115', 0],
      source: ['84', 0],
      x: 0,
      y: 0,
      resize_source: false,
      mask: ['112', 0],
    },
  };
  subjectRef = ['116', 0];

  if (options.padSubject) {
    // Shrink her and center her on gray so a container or card border can form around her.
    const padScale = options.padScale ?? 0.5;
    const padX = Math.round((width * (1 - padScale)) / 2);
    const padY = Math.round((height * (1 - padScale)) / 2);
    workflow['89'] = {
      class_type: 'ImageScaleBy',
      inputs: { image: ['84', 0], upscale_method: 'lanczos', scale_by: padScale },
    };
    workflow['98'] = {
      class_type: 'EmptyImage',
      inputs: { width, height, batch_size: 1, color: 8421504 },
    };
    workflow['99'] = {
      class_type: 'ImageCompositeMasked',
      inputs: {
        destination: ['98', 0],
        source: ['89', 0],
        x: padX,
        y: padY,
        resize_source: false,
      },
    };
    subjectRef = ['99', 0];
  }

  let posRef: [string, number] = ['73', 0];
  let negRef: [string, number] = ['74', 0];

  // The room is encoded separately and combined at 0.6, so it stops competing
  // with the subject tags for the first 77-token CLIP chunk.
  if (options.backgroundPositive) {
    workflow['130'] = {
      class_type: 'CLIPTextEncode',
      inputs: { text: options.backgroundPositive, clip: ['81', 0] },
    };
    workflow['131'] = {
      class_type: 'ConditioningSetArea',
      inputs: {
        conditioning: ['130', 0],
        width,
        height,
        x: 0,
        y: 0,
        strength: 0.6,
      },
    };
    workflow['132'] = {
      class_type: 'ConditioningCombine',
      inputs: { conditioning_1: ['73', 0], conditioning_2: ['131', 0] },
    };
    posRef = ['132', 0];
  }

  if (options.controlNet === 'depth' || options.controlNet === 'depth_line') {
    workflow['100'] = { class_type: 'Zoe-DepthMapPreprocessor', inputs: { image: subjectRef } };
    workflow['101'] = {
      class_type: 'ControlNetLoader',
      inputs: { control_net_name: 'SDXL/depth-zoe-xl-v1.0-controlnet.safetensors' },
    };
    workflow['102'] = {
      class_type: 'ControlNetApplyAdvanced',
      inputs: {
        positive: posRef,
        negative: negRef,
        control_net: ['101', 0],
        image: ['100', 0],
        strength: options.controlNetStrength,
        start_percent: 0,
        end_percent: options.controlNetEndPercent,
      },
    };
    posRef = ['102', 0];
    negRef = ['102', 1];
  }

  if (options.controlNet === 'openpose') {
    // Pose only: where head/shoulders/hands are, with zero human flesh volume.
    // With a pose reference, the skeleton comes from that image instead of her.
    let poseRef: [string, number] = subjectRef;
    if (options.poseImage) {
      workflow['160'] = { class_type: 'LoadImage', inputs: { image: options.poseImage } };
      workflow['161'] = {
        class_type: 'ImageScale',
        inputs: { image: ['160', 0], upscale_method: 'lanczos', width, height, crop: 'center' },
      };
      poseRef = ['161', 0];
    }
    workflow['106'] = {
      class_type: 'OpenposePreprocessor',
      inputs: {
        image: poseRef,
        detect_hand: 'enable',
        detect_body: 'enable',
        detect_face: 'enable',
        resolution: 1024,
        scale_stick_for_xinsr_cn: 'disable',
      },
    };
    workflow['107'] = {
      class_type: 'ControlNetLoader',
      inputs: { control_net_name: 'thibaud_xl_openpose.safetensors' },
    };
    workflow['108'] = {
      class_type: 'ControlNetApplyAdvanced',
      inputs: {
        positive: posRef,
        negative: negRef,
        control_net: ['107', 0],
        image: ['106', 0],
        strength: options.controlNetStrength,
        start_percent: 0,
        end_percent: options.controlNetEndPercent,
      },
    };
    posRef = ['108', 0];
    negRef = ['108', 1];
  }

  if (options.controlNet === 'anime_line' || options.controlNet === 'depth_line') {
    // Stylized buckets have no latent from her photo, so the lineart itself is the
    // composition anchor: it is traced from the scaled source image.
    const lineartSource: [string, number] =
      options.initFromSource === false ? ['87', 0] : subjectRef;
    // AnimeLineArt draws clean lines; the Canny ControlNet accepts them.
    workflow['103'] = { class_type: 'AnimeLineArtPreprocessor', inputs: { image: lineartSource } };
    workflow['104'] = {
      class_type: 'ControlNetLoader',
      inputs: { control_net_name: 'diffusers_xl_canny_full.safetensors' },
    };
    workflow['105'] = {
      class_type: 'ControlNetApplyAdvanced',
      inputs: {
        positive: posRef,
        negative: negRef,
        control_net: ['104', 0],
        image: ['103', 0],
        strength: options.controlNet === 'anime_line' ? options.controlNetStrength : options.lineartStrength ?? 0.55,
        start_percent: 0,
        end_percent: options.controlNet === 'anime_line' ? options.controlNetEndPercent : options.lineartEndPercent ?? 0.65,
      },
    };
    posRef = ['105', 0];
    negRef = ['105', 1];
  }

  (workflow['77'] as { inputs: Record<string, unknown> }).inputs.positive = posRef;
  (workflow['77'] as { inputs: Record<string, unknown> }).inputs.negative = negRef;

  // Team No Lackin neon sign: composited from a real asset so the text is always
  // legible, then a masked 0.18 pass pulls the tube glow into the wall lighting.
  if (options.neonSign) {
    const signW = Math.round(width * 0.34);
    const signH = Math.round(signW * 0.3125);
    workflow['140'] = { class_type: 'LoadImage', inputs: { image: 'team_no_lackin_neon.png' } };
    workflow['141'] = {
      class_type: 'ImageScale',
      inputs: { image: ['140', 0], upscale_method: 'lanczos', width: signW, height: signH, crop: 'disabled' },
    };
    workflow['142'] = { class_type: 'MaskToImage', inputs: { mask: ['140', 1] } };
    workflow['143'] = {
      class_type: 'ImageScale',
      inputs: { image: ['142', 0], upscale_method: 'lanczos', width: signW, height: signH, crop: 'disabled' },
    };
    workflow['144'] = { class_type: 'ImageToMask', inputs: { image: ['143', 0], channel: 'red' } };
    workflow['145'] = {
      class_type: 'ImpactGaussianBlurMask',
      inputs: { mask: ['144', 0], kernel_size: 6, sigma: 3 },
    };
    // LoadImage's MASK is the inverted alpha, so invert it or the composite
    // paints the transparent background as a solid black rectangle.
    workflow['153'] = { class_type: 'InvertMask', inputs: { mask: ['145', 0] } };
    workflow['146'] = {
      class_type: 'ImageCompositeMasked',
      inputs: {
        destination: ['78', 0],
        source: ['141', 0],
        x: Math.round(width * 0.06),
        y: Math.round(height * 0.07),
        resize_source: false,
        mask: ['153', 0],
      },
    };
    workflow['147'] = { class_type: 'GrowMask', inputs: { mask: ['153', 0], expand: 48, tapered_corners: true } };
    workflow['148'] = {
      class_type: 'ImpactGaussianBlurMask',
      inputs: { mask: ['147', 0], kernel_size: 32, sigma: 16 },
    };
    workflow['149'] = { class_type: 'VAEEncode', inputs: { pixels: ['146', 0], vae: ['72', 2] } };
    workflow['150'] = {
      class_type: 'SetLatentNoiseMask',
      inputs: { samples: ['149', 0], mask: ['148', 0] },
    };
    workflow['151'] = {
      class_type: 'KSampler',
      inputs: {
        seed: options.seed + 3,
        steps: 18,
        cfg: options.cfgScale ?? 6,
        sampler_name: 'dpmpp_2m',
        scheduler: 'karras',
        denoise: 0.05,
        model: ['86', 0],
        positive: posRef,
        negative: negRef,
        latent_image: ['150', 0],
      },
    };
    workflow['152'] = { class_type: 'VAEDecode', inputs: { samples: ['151', 0], vae: ['72', 2] } };
    (workflow['79'] as { inputs: Record<string, unknown> }).inputs.images = ['152', 0];
  }

  return workflow;
}

export type RipShirtWorkflowOptions = {
  imageName: string;
  hostPositive: string;
  portraitPositive: string;
  negative: string;
  seed: number;
  filenamePrefix: string;
  checkpoint?: string;
  width: number;
  height: number;
  faceIdWeight: number;
  faceIdLoraStrength: number;
  faceIdProvider?: string;
  /** Reference photo of the host (King Von) so his face is actually his. */
  hostFaceImage?: string;
  hostFaceIdWeight?: number;
};

/** Two-pass macro: King Von in a blank tee + her portrait printed on the chest. */
export function buildRipShirtWorkflow(
  options: RipShirtWorkflowOptions
): Record<string, unknown> {
  const checkpoint = options.checkpoint || 'ponyDiffusionV6XL_v6StartWithThisOne.safetensors';
  const width = Math.max(512, Math.round(options.width / 8) * 8);
  const height = Math.max(512, Math.round(options.height / 8) * 8);
  const chestX = Math.round(width * 0.3);
  const chestY = Math.round(height * 0.6);
  const chestW = Math.round(width * 0.4);
  const chestH = Math.round(height * 0.3);
  const hostFaceImage = options.hostFaceImage || 'kingvon.png';

  return {
    '72': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: checkpoint } },
    '81': { class_type: 'CLIPSetLastLayer', inputs: { stop_at_clip_layer: -2, clip: ['72', 1] } },
    '73': { class_type: 'CLIPTextEncode', inputs: { text: options.hostPositive, clip: ['81', 0] } },
    '74': { class_type: 'CLIPTextEncode', inputs: { text: options.negative, clip: ['81', 0] } },
    // Host: King Von in a blank black tee.
    '201': { class_type: 'EmptyLatentImage', inputs: { width, height, batch_size: 1 } },
    '202': {
      class_type: 'KSampler',
      inputs: {
        seed: options.seed,
        steps: 30,
        cfg: 5.5,
        sampler_name: 'dpmpp_2m',
        scheduler: 'karras',
        denoise: 1.0,
        model: ['88', 0],
        positive: ['73', 0],
        negative: ['74', 0],
        latent_image: ['201', 0],
      },
    },
    '203': { class_type: 'VAEDecode', inputs: { samples: ['202', 0], vae: ['72', 2] } },
    // Host face reference: fixed head crop (MediaPipe SEGS is empty on this pod).
    '70': { class_type: 'LoadImage', inputs: { image: hostFaceImage } },
    '93': {
      class_type: 'ImageCrop',
      inputs: {
        image: ['70', 0],
        width: 280,
        height: 260,
        x: 95,
        y: 20,
      },
    },
    '94': {
      class_type: 'ImageScale',
      inputs: { image: ['93', 0], upscale_method: 'lanczos', width: 1024, height: 1024, crop: 'center' },
    },
    '88': {
      class_type: 'IPAdapterFaceID',
      inputs: {
        weight: options.hostFaceIdWeight ?? 0.8,
        weight_faceidv2: 1,
        weight_type: 'linear',
        combine_embeds: 'concat',
        start_at: 0,
        end_at: 0.9,
        embeds_scaling: 'V only',
        model: ['85', 0],
        ipadapter: ['85', 1],
        image: ['94', 0],
      },
    },
    // Portrait branch: her likeness on a clean graphic.
    '75': { class_type: 'LoadImage', inputs: { image: options.imageName } },
    '80': {
      class_type: 'ImageScaleToMaxDimension',
      inputs: { upscale_method: 'area', largest_size: 1536, image: ['75', 0] },
    },
    '95': {
      class_type: 'ImageCrop',
      inputs: {
        image: ['80', 0],
        width: 700,
        height: 620,
        x: 300,
        y: 20,
      },
    },
    '99': {
      class_type: 'ImageScale',
      inputs: { image: ['95', 0], upscale_method: 'lanczos', width: 1024, height: 1024, crop: 'center' },
    },
    '85': {
      class_type: 'IPAdapterUnifiedLoaderFaceID',
      inputs: {
        preset: 'FACEID',
        lora_strength: options.faceIdLoraStrength,
        provider: options.faceIdProvider || 'CPU',
        model: ['72', 0],
      },
    },
    '86': {
      class_type: 'IPAdapterFaceID',
      inputs: {
        weight: options.faceIdWeight,
        weight_faceidv2: 1,
        weight_type: 'linear',
        combine_embeds: 'concat',
        start_at: 0,
        end_at: 1,
        embeds_scaling: 'V only',
        model: ['85', 0],
        ipadapter: ['85', 1],
        image: ['99', 0],
      },
    },
    '206': {
      class_type: 'CLIPTextEncode',
      inputs: { text: options.portraitPositive, clip: ['81', 0] },
    },
    '204': { class_type: 'EmptyLatentImage', inputs: { width, height, batch_size: 1 } },
    '205': {
      class_type: 'KSampler',
      inputs: {
        seed: options.seed + 1,
        steps: 30,
        cfg: 5.5,
        sampler_name: 'dpmpp_2m',
        scheduler: 'karras',
        denoise: 1.0,
        model: ['86', 0],
        positive: ['206', 0],
        negative: ['74', 0],
        latent_image: ['204', 0],
      },
    },
    '207': { class_type: 'VAEDecode', inputs: { samples: ['205', 0], vae: ['72', 2] } },
    // Fit the whole portrait inside the chest print box, then mask only the chest.
    '208': {
      class_type: 'ImageScale',
      inputs: {
        image: ['207', 0],
        upscale_method: 'lanczos',
        width: chestW,
        height: chestH,
        crop: 'center',
      },
    },
    '209': { class_type: 'SolidMask', inputs: { value: 0.0, width, height } },
    '210': { class_type: 'SolidMask', inputs: { value: 1.0, width: chestW, height: chestH } },
    '211': {
      class_type: 'MaskComposite',
      inputs: {
        destination: ['209', 0],
        source: ['210', 0],
        x: chestX,
        y: chestY,
        operation: 'add',
      },
    },
    '212': {
      class_type: 'ImpactGaussianBlurMask',
      inputs: { mask: ['211', 0], kernel_size: 8, sigma: 4 },
    },
    '213': {
      class_type: 'ImageCompositeMasked',
      inputs: {
        destination: ['203', 0],
        source: ['208', 0],
        x: chestX,
        y: chestY,
        resize_source: false,
        mask: ['212', 0],
      },
    },
    // Light print/fabric blend only inside the chest area.
    '214': { class_type: 'VAEEncode', inputs: { pixels: ['213', 0], vae: ['72', 2] } },
    '215': {
      class_type: 'SetLatentNoiseMask',
      inputs: { samples: ['214', 0], mask: ['212', 0] },
    },
    '216': {
      class_type: 'KSampler',
      inputs: {
        seed: options.seed + 2,
        steps: 16,
        cfg: 5.0,
        sampler_name: 'dpmpp_2m',
        scheduler: 'karras',
        denoise: 0.25,
        model: ['72', 0],
        positive: ['73', 0],
        negative: ['74', 0],
        latent_image: ['215', 0],
      },
    },
    '217': { class_type: 'VAEDecode', inputs: { samples: ['216', 0], vae: ['72', 2] } },
    '79': { class_type: 'SaveImage', inputs: { filename_prefix: options.filenamePrefix, images: ['217', 0] } },
  };
}

export type CoupleWorkflowOptions = {
  imageName: string;
  /** Reference photo of him, used only for FaceID. */
  husbandFaceImage?: string;
  positive: string;
  husbandPositive: string;
  negative: string;
  seed: number;
  filenamePrefix: string;
  checkpoint?: string;
  width: number;
  height: number;
  loraWife: string;
  loraHusband: string;
  loraStrength?: number;
  faceIdProvider?: string;
};

/**
 * Couple mode, two masked passes.
 *
 * Pass 1 paints the whole frame with her LoRA. Pass 2 switches to his LoRA and
 * repaints the right half through a feathered mask, with his FaceID confined to
 * that half via attn_mask. LoRA weights cannot be made regional in one sampler,
 * so two passes is the only way both faces stay themselves.
 */
export function buildCoupleWorkflow(options: CoupleWorkflowOptions): Record<string, unknown> {
  const checkpoint = options.checkpoint || 'ponyDiffusionV6XL_v6StartWithThisOne.safetensors';
  const width = Math.max(512, Math.round(options.width / 8) * 8);
  const height = Math.max(512, Math.round(options.height / 8) * 8);
  const provider = options.faceIdProvider || 'CPU';
  const strength = options.loraStrength ?? 0.8;
  const halfW = Math.round(width / 2);
  const husbandFaceImage = options.husbandFaceImage || 'boi/boi_001.jpg';

  return {
    '72': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: checkpoint } },

    // Branch A: her.
    '71': {
      class_type: 'LoraLoader',
      inputs: {
        model: ['72', 0],
        clip: ['72', 1],
        lora_name: options.loraWife,
        strength_model: strength,
        strength_clip: strength,
      },
    },
    '81': { class_type: 'CLIPSetLastLayer', inputs: { stop_at_clip_layer: -2, clip: ['71', 1] } },
    '73': { class_type: 'CLIPTextEncode', inputs: { text: options.positive, clip: ['81', 0] } },
    '74': { class_type: 'CLIPTextEncode', inputs: { text: options.negative, clip: ['81', 0] } },
    '75': { class_type: 'LoadImage', inputs: { image: options.imageName } },
    '76': {
      class_type: 'ImageScale',
      inputs: { image: ['75', 0], upscale_method: 'lanczos', width, height, crop: 'center' },
    },
    '77': {
      class_type: 'ImageCrop',
      inputs: {
        image: ['76', 0],
        width,
        height: Math.round(height * 0.62),
        x: 0,
        y: 0,
      },
    },
    '78': {
      class_type: 'ImageScale',
      inputs: { image: ['77', 0], upscale_method: 'lanczos', width: 1024, height: 1024, crop: 'center' },
    },
    '82': {
      class_type: 'IPAdapterUnifiedLoaderFaceID',
      inputs: { preset: 'FACEID', lora_strength: 0.6, provider, model: ['71', 0] },
    },
    '83': {
      class_type: 'IPAdapterFaceID',
      inputs: {
        weight: 0.85,
        weight_faceidv2: 1,
        weight_type: 'linear',
        combine_embeds: 'concat',
        start_at: 0,
        end_at: 0.85,
        embeds_scaling: 'V only',
        model: ['82', 0],
        ipadapter: ['82', 1],
        image: ['78', 0],
      },
    },
    '201': { class_type: 'EmptyLatentImage', inputs: { width, height, batch_size: 1 } },
    '202': {
      class_type: 'KSampler',
      inputs: {
        seed: options.seed,
        steps: 30,
        cfg: 6,
        sampler_name: 'dpmpp_2m',
        scheduler: 'karras',
        denoise: 1,
        model: ['83', 0],
        positive: ['73', 0],
        negative: ['74', 0],
        latent_image: ['201', 0],
      },
    },
    '203': { class_type: 'VAEDecode', inputs: { samples: ['202', 0], vae: ['72', 2] } },

    // Branch B: him, confined to the right half.
    '91': {
      class_type: 'LoraLoader',
      inputs: {
        model: ['72', 0],
        clip: ['72', 1],
        lora_name: options.loraHusband,
        strength_model: strength,
        strength_clip: strength,
      },
    },
    '92': { class_type: 'CLIPSetLastLayer', inputs: { stop_at_clip_layer: -2, clip: ['91', 1] } },
    '93': { class_type: 'CLIPTextEncode', inputs: { text: options.husbandPositive, clip: ['92', 0] } },

    '100': { class_type: 'SolidMask', inputs: { value: 0, width, height } },
    '101': { class_type: 'SolidMask', inputs: { value: 1, width: halfW, height } },
    '102': {
      class_type: 'MaskComposite',
      inputs: { destination: ['100', 0], source: ['101', 0], x: halfW, y: 0, operation: 'add' },
    },
    '103': {
      class_type: 'ImpactGaussianBlurMask',
      inputs: { mask: ['102', 0], kernel_size: 48, sigma: 24 },
    },

    '104': { class_type: 'LoadImage', inputs: { image: husbandFaceImage } },
    '105': {
      class_type: 'ImageCrop',
      inputs: { image: ['104', 0], width: 700, height: 620, x: 300, y: 20 },
    },
    '106': {
      class_type: 'ImageScale',
      inputs: { image: ['105', 0], upscale_method: 'lanczos', width: 1024, height: 1024, crop: 'center' },
    },
    '107': {
      class_type: 'IPAdapterUnifiedLoaderFaceID',
      inputs: { preset: 'FACEID', lora_strength: 0.6, provider, model: ['91', 0] },
    },
    '108': {
      class_type: 'IPAdapterFaceID',
      inputs: {
        weight: 0.85,
        weight_faceidv2: 1,
        weight_type: 'linear',
        combine_embeds: 'concat',
        start_at: 0,
        end_at: 0.8,
        embeds_scaling: 'V only',
        model: ['107', 0],
        ipadapter: ['107', 1],
        image: ['106', 0],
        attn_mask: ['103', 0],
      },
    },

    '204': { class_type: 'VAEEncode', inputs: { pixels: ['203', 0], vae: ['72', 2] } },
    '205': { class_type: 'SetLatentNoiseMask', inputs: { samples: ['204', 0], mask: ['103', 0] } },
    '206': {
      class_type: 'KSampler',
      inputs: {
        seed: options.seed + 7,
        steps: 26,
        cfg: 6,
        sampler_name: 'dpmpp_2m',
        scheduler: 'karras',
        denoise: 0.6,
        model: ['108', 0],
        positive: ['93', 0],
        negative: ['74', 0],
        latent_image: ['205', 0],
      },
    },
    '207': { class_type: 'VAEDecode', inputs: { samples: ['206', 0], vae: ['72', 2] } },
    '79': {
      class_type: 'SaveImage',
      inputs: { filename_prefix: options.filenamePrefix, images: ['207', 0] },
    },
  };
}

export type GeneratedBackgroundOptions = {
  imageName: string;
  positive: string;
  negative: string;
  seed: number;
  filenamePrefix: string;
  checkpoint?: string;
  width: number;
  height: number;
};

/**
 * Full generated scene: text-to-image background from an empty latent, then
 * composite the untouched subject back on top and harmonize. This is for
 * "make the background a weed grow room / Walmart / moon" rather than
 * reinterpreting the original room.
 */
export function buildGeneratedBackgroundWorkflow(
  options: GeneratedBackgroundOptions
): Record<string, unknown> {
  const checkpoint = options.checkpoint || 'ponyDiffusionV6XL_v6StartWithThisOne.safetensors';
  const width = Math.max(512, Math.round(options.width / 8) * 8);
  const height = Math.max(512, Math.round(options.height / 8) * 8);

  return {
    '72': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: checkpoint } },
    '81': { class_type: 'CLIPSetLastLayer', inputs: { stop_at_clip_layer: -2, clip: ['72', 1] } },
    '73': { class_type: 'CLIPTextEncode', inputs: { text: options.positive, clip: ['81', 0] } },
    '74': { class_type: 'CLIPTextEncode', inputs: { text: options.negative, clip: ['81', 0] } },
    '75': { class_type: 'LoadImage', inputs: { image: options.imageName } },
    '200': {
      class_type: 'ImageScale',
      inputs: {
        image: ['75', 0],
        upscale_method: 'lanczos',
        width,
        height,
        crop: 'disabled',
      },
    },
    '84': {
      class_type: 'RMBG',
      inputs: {
        image: ['200', 0],
        model: 'RMBG-2.0',
        sensitivity: 1.0,
        process_res: 1024,
        mask_blur: 0,
        mask_offset: 0,
        invert_output: false,
        refine_foreground: true,
        background: 'Alpha',
        background_color: '#222222',
      },
    },
    '95': {
      class_type: 'GrowMask',
      inputs: { mask: ['84', 1], expand: 24, tapered_corners: true },
    },
    '96': {
      class_type: 'ImpactGaussianBlurMask',
      inputs: { mask: ['95', 0], kernel_size: 16, sigma: 8 },
    },
    '201': {
      class_type: 'EmptyLatentImage',
      inputs: { width, height, batch_size: 1 },
    },
    '202': {
      class_type: 'KSampler',
      inputs: {
        seed: options.seed,
        steps: 30,
        cfg: 5.5,
        sampler_name: 'dpmpp_2m',
        scheduler: 'karras',
        denoise: 1.0,
        model: ['72', 0],
        positive: ['73', 0],
        negative: ['74', 0],
        latent_image: ['201', 0],
      },
    },
    '203': { class_type: 'VAEDecode', inputs: { samples: ['202', 0], vae: ['72', 2] } },
    '204': {
      class_type: 'ImageCompositeMasked',
      inputs: {
        destination: ['203', 0],
        source: ['200', 0],
        x: 0,
        y: 0,
        resize_source: false,
        mask: ['96', 0],
      },
    },
    '208': {
      class_type: 'CLIPTextEncode',
      inputs: { text: HARMONIZE_POSITIVE, clip: ['81', 0] },
    },
    '205': { class_type: 'VAEEncode', inputs: { pixels: ['204', 0], vae: ['72', 2] } },
    '206': {
      class_type: 'KSampler',
      inputs: {
        seed: options.seed + 1,
        steps: 20,
        cfg: 5.0,
        sampler_name: 'dpmpp_2m',
        scheduler: 'karras',
        denoise: 0.18,
        model: ['72', 0],
        positive: ['208', 0],
        negative: ['74', 0],
        latent_image: ['205', 0],
      },
    },
    '207': { class_type: 'VAEDecode', inputs: { samples: ['206', 0], vae: ['72', 2] } },
    '79': { class_type: 'SaveImage', inputs: { filename_prefix: options.filenamePrefix, images: ['207', 0] } },
  };
}

/**
 * Masked inpaint pass.
 *
 * Loads the current image (plus a brush mask PNG or a segmentation node),
 * samples only inside the mask with `SetLatentNoiseMask`, then composites the
 * decoded result back over the original so untouched pixels stay bit-identical.
 */
export function buildInpaintWorkflow(options: InpaintWorkflowOptions): Record<string, unknown> {
  const checkpoint = options.checkpoint || 'ponyDiffusionV6XL_v6StartWithThisOne.safetensors';
  const faceIdProvider = options.faceIdProvider || 'CPU';
  const faceIdWeight = options.faceIdWeight ?? 0.6;
  // Growing a background mask eats into the subject's silhouette; a large
  // grow makes hands/feet hallucinate at the edge. Keep background tight.
  const growMaskBy = options.growMaskBy ?? (options.mask.kind === 'background' ? 0 : 10);
  const useFaceId = options.useFaceId !== false;

  // RMBG outputs: IMAGE(0), MASK(1), MASK_IMAGE(2).
  // Brush and HumanParts expose the mask on output 0.
  const maskOutput: [string, number] =
    options.mask.kind === 'brush'
      ? ['83', 0]
      : options.mask.kind === 'background'
        ? ['96', 0]
        : ['84', 0];

  const workflow: Record<string, unknown> = {
    '72': {
      class_type: 'CheckpointLoaderSimple',
      inputs: { ckpt_name: checkpoint },
    },
    '81': {
      class_type: 'CLIPSetLastLayer',
      inputs: { stop_at_clip_layer: -2, clip: ['72', 1] },
    },
    '73': {
      class_type: 'CLIPTextEncode',
      inputs: { text: options.positive, clip: ['81', 0] },
    },
    '74': {
      class_type: 'CLIPTextEncode',
      inputs: { text: options.negative, clip: ['81', 0] },
    },
    '75': {
      class_type: 'LoadImage',
      inputs: { image: options.imageName },
    },
    '80': {
      class_type: 'ImageScaleToMaxDimension',
      inputs: {
        upscale_method: 'area',
        largest_size: 1536,
        image: ['75', 0],
      },
    },
    // Regular VAE encode + noise mask gives graded denoise control.
    '76': {
      class_type: 'VAEEncode',
      inputs: { pixels: ['75', 0], vae: ['72', 2] },
    },
    '87': {
      class_type: 'GrowMask',
      inputs: { mask: maskOutput, expand: growMaskBy, tapered_corners: true },
    },
    '89': {
      class_type: 'SetLatentNoiseMask',
      inputs: { samples: ['76', 0], mask: ['87', 0] },
    },
    '77': {
      class_type: 'KSampler',
      inputs: {
        seed: options.seed,
        steps: 32,
        cfg: 5.5,
        sampler_name: 'dpmpp_2m',
        scheduler: 'karras',
        denoise: options.denoise,
        model: ['72', 0],
        positive: ['73', 0],
        negative: ['74', 0],
        latent_image: ['89', 0],
      },
    },
    '78': {
      class_type: 'VAEDecode',
      inputs: { samples: ['77', 0], vae: ['72', 2] },
    },
    '90': {
      class_type: 'ImageCompositeMasked',
      inputs: {
        destination: ['75', 0],
        source: ['78', 0],
        x: 0,
        y: 0,
        resize_source: false,
        // HumanParts returns a byte mask; ComfyUI's ImageBlur crashes on it.
        // GrowMask's tapered edge is enough for auto masks. Brush strokes keep
        // the extra blur below.
        mask: options.mask.kind === 'hair' ? ['87', 0] : ['93', 0],
      },
    },
    '79': {
      class_type: 'SaveImage',
      inputs: { filename_prefix: options.filenamePrefix, images: ['90', 0] },
    },
  };

  if (options.mask.kind !== 'hair') {
    // Blur the mask as an image so each brush stroke gets its own soft edge.
    // (FeatherMask feathers from the whole mask's bounding box, which can
    // erase thin strokes.)
    workflow['91'] = {
      class_type: 'MaskToImage',
      inputs: { mask: ['87', 0] },
    };
    workflow['92'] = {
      class_type: 'ImageBlur',
      inputs: { image: ['91', 0], blur_radius: 8, sigma: 4 },
    };
    workflow['93'] = {
      class_type: 'ImageToMask',
      inputs: { image: ['92', 0], channel: 'red' },
    };
  }

  if (options.mask.kind === 'brush') {
    workflow['82'] = {
      class_type: 'LoadImage',
      inputs: { image: options.mask.maskImage },
    };
    workflow['83'] = {
      class_type: 'ImageToMask',
      inputs: { image: ['82', 0], channel: 'red' },
    };
  } else if (options.mask.kind === 'background') {
    // ComfyUI-RMBG: MASK output (index 1) is the foreground, so invert it to
    // select the background for inpainting.
    workflow['84'] = {
      class_type: options.mask.node,
      inputs: {
        image: ['75', 0],
        model: options.mask.model,
        sensitivity: 1.0,
        process_res: 1536,
        mask_blur: 0,
        // Negative offset shrinks the background mask so it cannot eat into
        // the subject's legs/feet and repaint them as a second limb.
        mask_offset: -8,
        invert_output: true,
        refine_foreground: true,
        // The node reads this directly even though it is marked optional.
        background: 'Alpha',
        background_color: '#222222',
      },
    };

    // Protect the subject: invert the RMBG background mask to get the
    // foreground, grow it so the whole silhouette is covered, then invert it
    // again for the actual background inpaint mask.
    workflow['94'] = {
      class_type: 'InvertMask',
      inputs: { mask: ['84', 1] },
    };
    workflow['95'] = {
      class_type: 'GrowMask',
      inputs: { mask: ['94', 0], expand: 16, tapered_corners: true },
    };
    workflow['96'] = {
      class_type: 'InvertMask',
      inputs: { mask: ['95', 0] },
    };
    // Paste the untouched original subject back over the repainted scene.
    // This is what stops high-denoise background passes inventing feet/hands.
    workflow['97'] = {
      class_type: 'ImageCompositeMasked',
      inputs: {
        destination: ['90', 0],
        source: ['75', 0],
        x: 0,
        y: 0,
        resize_source: false,
        mask: ['95', 0],
      },
    };
    // Final cohesion pass: low denoise over the whole image so the pasted
    // subject and the new background share lighting, colour, grain, and edges.
    workflow['98'] = {
      class_type: 'VAEEncode',
      inputs: { pixels: ['97', 0], vae: ['72', 2] },
    };
    workflow['101'] = {
      class_type: 'CLIPTextEncode',
      inputs: { text: HARMONIZE_POSITIVE, clip: ['81', 0] },
    };
    workflow['99'] = {
      class_type: 'KSampler',
      inputs: {
        seed: options.seed + 1,
        steps: 20,
        cfg: 5.0,
        sampler_name: 'dpmpp_2m',
        scheduler: 'karras',
        denoise: 0.18,
        model: useFaceId ? ['86', 0] : ['72', 0],
        positive: ['101', 0],
        negative: ['74', 0],
        latent_image: ['98', 0],
      },
    };
    workflow['100'] = {
      class_type: 'VAEDecode',
      inputs: { samples: ['99', 0], vae: ['72', 2] },
    };
    (workflow['79'] as { inputs: Record<string, unknown> }).inputs.images = ['100', 0];
  } else {
    // ComfyUI_Human_Parts: one node, boolean class switches, single MASK out.
    workflow['84'] = {
      class_type: options.mask.node,
      inputs: {
        image: ['75', 0],
        background: false,
        hat: false,
        hair: true,
        glove: false,
        glasses: false,
        upper_clothes: false,
        face_mask: false,
        coat: false,
        socks: false,
        pants: false,
        'torso-skin': false,
        scarf: false,
        skirt: false,
        face: false,
        'left-arm': false,
        'right-arm': false,
        'left-leg': false,
        'right-leg': false,
        'left-shoe': false,
        'right-shoe': false,
        bag: false,
      },
    };
  }

  if (useFaceId) {
    workflow['85'] = {
      class_type: 'IPAdapterUnifiedLoaderFaceID',
      inputs: {
        preset: 'FACEID',
        lora_strength: 0.5,
        provider: faceIdProvider,
        model: ['72', 0],
      },
    };
    workflow['86'] = {
      class_type: 'IPAdapterFaceID',
      inputs: {
        weight: faceIdWeight,
        weight_faceidv2: 1,
        weight_type: 'linear',
        combine_embeds: 'concat',
        start_at: 0,
        end_at: 1,
        embeds_scaling: 'V only',
        model: ['85', 0],
        ipadapter: ['85', 1],
        image: ['80', 0],
      },
    };
    (workflow['77'] as { inputs: Record<string, unknown> }).inputs.model = ['86', 0];
  }

  return workflow;
}

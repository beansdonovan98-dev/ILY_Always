export type ComfyWorkflowOptions = {
  imageName: string;
  positive: string;
  negative: string;
  denoise: number;
  seed: number;
  filenamePrefix: string;
  checkpoint?: string;
  faceIdProvider?: string;
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

  return {
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
        model: ['86', 0],
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
        largest_size: 1216,
        image: ['75', 0],
      },
    },
    '81': {
      class_type: 'CLIPSetLastLayer',
      inputs: { stop_at_clip_layer: -2, clip: ['72', 1] },
    },
    '85': {
      class_type: 'IPAdapterUnifiedLoaderFaceID',
      inputs: {
        preset: 'FACEID',
        lora_strength: 0.5,
        provider: faceIdProvider,
        model: ['72', 0],
      },
    },
    '86': {
      class_type: 'IPAdapterFaceID',
      inputs: {
        weight: 0.65,
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
    },
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
  const growMaskBy = options.growMaskBy ?? 10;

  const maskNodeId = options.mask.kind === 'brush' ? '83' : '84';

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
        largest_size: 1216,
        image: ['75', 0],
      },
    },
    '85': {
      class_type: 'IPAdapterUnifiedLoaderFaceID',
      inputs: {
        preset: 'FACEID',
        lora_strength: 0.5,
        provider: faceIdProvider,
        model: ['72', 0],
      },
    },
    '86': {
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
    },
    // Regular VAE encode + noise mask gives graded denoise control.
    '76': {
      class_type: 'VAEEncode',
      inputs: { pixels: ['75', 0], vae: ['72', 2] },
    },
    '87': {
      class_type: 'GrowMask',
      inputs: { mask: [maskNodeId, 0], expand: growMaskBy, tapered_corners: true },
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
        model: ['86', 0],
        positive: ['73', 0],
        negative: ['74', 0],
        latent_image: ['89', 0],
      },
    },
    '78': {
      class_type: 'VAEDecode',
      inputs: { samples: ['77', 0], vae: ['72', 2] },
    },
    // Blur the mask as an image so each brush stroke gets its own soft edge.
    // (FeatherMask feathers from the whole mask's bounding box, which can
    // erase thin strokes.)
    '91': {
      class_type: 'MaskToImage',
      inputs: { mask: ['87', 0] },
    },
    '92': {
      class_type: 'ImageBlur',
      inputs: { image: ['91', 0], blur_radius: 8, sigma: 4 },
    },
    '93': {
      class_type: 'ImageToMask',
      inputs: { image: ['92', 0], channel: 'red' },
    },
    '90': {
      class_type: 'ImageCompositeMasked',
      inputs: {
        destination: ['75', 0],
        source: ['78', 0],
        x: 0,
        y: 0,
        resize_source: false,
        mask: ['93', 0],
      },
    },
    '79': {
      class_type: 'SaveImage',
      inputs: { filename_prefix: options.filenamePrefix, images: ['90', 0] },
    },
  };

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
        process_res: 1024,
        mask_blur: 0,
        mask_offset: 0,
        invert_output: true,
        refine_foreground: false,
        background_color: '#222222',
      },
    };
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

  return workflow;
}

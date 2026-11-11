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

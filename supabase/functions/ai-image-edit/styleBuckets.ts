export type SubjectMode = 'wife' | 'husband' | 'couple';

export type BucketId =
  | 'realism_composite'
  | 'realism_outfit_nsfw'
  | 'anime_2d_toon'
  | 'toy_3d_sculpt'
  | 'fine_art_medium'
  | 'framed_card'
  | 'macro_object_embed';

export interface BucketConfig {
  id: BucketId;
  checkpoint: string;
  basePrefix: string;
  baseNegative: string;
  defaultDenoise: number;
  defaultCfg: number;
  loraModelStrength: number;
}

export interface StyleDefinition {
  id: string;
  bucket: BucketId;
  prompt: string;
  negativeAdd?: string;
  denoiseOverride?: number;
  loraStrengthOverride?: number;
  subjectTraits?: string;
}

export const LORA_FILES = {
  wife: 'ashley_v1_1200_steps_00001_.safetensors',
  husband: 'mbboi_v1_1200_steps_00001_.safetensors',
};

const COMMON_EXPLICIT_POS = 'rating_explicit, explicit anatomical details';
const COMMON_EXPLICIT_NEG =
  'score_6, score_5, score_4, worst quality, low quality, blurry, censored, mosaic censorship, bar censor, deformed, bad anatomy, bad hands, extra limbs, missing fingers, mutated hands, asymmetric eyes, cross-eyed, deformed mouth, bad teeth';

export const BUCKET_CONFIGS: Record<BucketId, BucketConfig> = {
  realism_composite: {
    id: 'realism_composite',
    checkpoint: 'ponyDiffusionV6XL_v6StartWithThisOne.safetensors',
    basePrefix: `${COMMON_EXPLICIT_POS}, raw photo, 35mm photograph, photorealistic, detailed skin pores, cinematic volumetric lighting, natural eye size, symmetrical eyes, realistic face proportions, natural lips`,
    baseNegative: `${COMMON_EXPLICIT_NEG}, cgi, 3d render, anime, cartoon, illustration, painting, big eyes, anime eyes, plastic skin`,
    defaultDenoise: 0.35, // Handled via 1.0 base + 0.16 harmonization pass in execution
    defaultCfg: 5.5,
    loraModelStrength: 0.85,
  },
  realism_outfit_nsfw: {
    id: 'realism_outfit_nsfw',
    checkpoint: 'ponyDiffusionV6XL_v6StartWithThisOne.safetensors',
    basePrefix: `${COMMON_EXPLICIT_POS}, raw photo, 35mm photograph, photorealistic, detailed skin pores, cinematic volumetric lighting, natural eye size, symmetrical eyes, realistic face and body proportions, natural lips`,
    baseNegative: `${COMMON_EXPLICIT_NEG}, cgi, 3d render, anime, cartoon, illustration, painting, big eyes, anime eyes, plastic skin`,
    defaultDenoise: 0.5, // Strict likeness cap for lifelike outfits/dungeon/superhero
    defaultCfg: 6.0,
    loraModelStrength: 0.85,
  },
  anime_2d_toon: {
    id: 'anime_2d_toon',
    checkpoint: 'ponyDiffusionV6XL_v6StartWithThisOne.safetensors',
    basePrefix: `${COMMON_EXPLICIT_POS}, source_anime, 2d illustration, clean bold lineart, vibrant colors, expressive eyes, stylized proportions`,
    baseNegative: `${COMMON_EXPLICIT_NEG}, photorealistic, raw photo, 35mm photograph, real human skin pores, real skin texture, 3d render, cgi, messy lines`,
    defaultDenoise: 0.5, // Capped to preserve facial geometry for anime styles
    defaultCfg: 6.5,
    loraModelStrength: 0.85,
  },
  toy_3d_sculpt: {
    id: 'toy_3d_sculpt',
    checkpoint: 'ponyDiffusionV6XL_v6StartWithThisOne.safetensors',
    basePrefix: `${COMMON_EXPLICIT_POS}, 3d render, octane render, studio product lighting, macro miniature photography, tactile physical material texture`,
    baseNegative: `${COMMON_EXPLICIT_NEG}, 2d illustration, flat drawing, sketch, anime, real human skin pores, photorealistic flesh, broken geometry`,
    defaultDenoise: 0.72, // Allowed to be high ONLY because toy molds don't use real facial geometry
    defaultCfg: 6.5,
    loraModelStrength: 0.45,
  },
  fine_art_medium: {
    id: 'fine_art_medium',
    checkpoint: 'ponyDiffusionV6XL_v6StartWithThisOne.safetensors',
    basePrefix: `${COMMON_EXPLICIT_POS}, fine art masterpiece, authentic traditional media texture, artistic composition, symmetrical eyes`,
    baseNegative: `${COMMON_EXPLICIT_NEG}, raw photo, smartphone selfie, 3d render, cgi, plastic texture, watermark, signature`,
    defaultDenoise: 0.5, // Capped for tarot, watercolor, paintings
    defaultCfg: 6.0,
    loraModelStrength: 0.85,
  },
  framed_card: {
    id: 'framed_card',
    checkpoint: 'ponyDiffusionV6XL_v6StartWithThisOne.safetensors',
    basePrefix: `${COMMON_EXPLICIT_POS}, ornate vintage tarot card and magazine cover illustration style, detailed occult line etching, rich parchment paper texture, decorative gold-foil border frame, Roman numerals, bottom title banner, professional illustration masterwork`,
    baseNegative: `${COMMON_EXPLICIT_NEG}, photorealistic photo, 3d render, modern flat vector, clean digital art, cropped frame, cut-off border, unframed, gibberish text`,
    defaultDenoise: 0.5,
    defaultCfg: 6.5,
    loraModelStrength: 0.85,
  },
  macro_object_embed: {
    id: 'macro_object_embed',
    checkpoint: 'ponyDiffusionV6XL_v6StartWithThisOne.safetensors',
    basePrefix: `${COMMON_EXPLICIT_POS}, commercial product photography, isolated physical object, professional studio lighting, blank surface template ready for graphic inlay`,
    baseNegative: `${COMMON_EXPLICIT_NEG}, flat 2d paste, unblended edges, floating disembodied head, bad perspective`,
    defaultDenoise: 0.65,
    defaultCfg: 6.0,
    loraModelStrength: 0.65,
  },
};

export const STYLE_DEFINITIONS: Record<string, StyleDefinition> = {
  // 1. REALISM COMPOSITE (20)
  realistic: { id: 'realistic', bucket: 'realism_composite', prompt: 'high-end DSLR portrait, 85mm f/1.4 lens, natural soft daylight, crisp facial details, subtle bokeh background', denoiseOverride: 0.3 },
  'double-exposure': { id: 'double-exposure', bucket: 'realism_composite', prompt: 'artistic double exposure photography, silhouette blended with misty pine forest and starry night sky, translucent overlapping layers, ethereal mood', denoiseOverride: 0.4 },
  polaroid: { id: 'polaroid', bucket: 'realism_composite', prompt: 'vintage 1990s Polaroid instant film photo, direct on-camera flash, warm faded color cast, soft vignette, chemical film grain', denoiseOverride: 0.35 },
  'glitch-art': { id: 'glitch-art', bucket: 'realism_composite', prompt: 'cyberpunk datamosh glitch art, VHS tracking distortion, RGB chromatic aberration split, CRT scanlines, digital pixel sorting effects', denoiseOverride: 0.4 },
  'neon-noir': { id: 'neon-noir', bucket: 'realism_composite', prompt: 'cinematic neon noir portrait, drenched in magenta and cyan neon sign reflections, wet rainy night street background, dramatic high-contrast shadows', denoiseOverride: 0.38 },
  'color-swap': { id: 'color-swap', bucket: 'realism_composite', prompt: 'surreal infrared Aerochrome color-swap photography, dramatic complementary split-toning, vibrant shifted environmental hues, preserved natural skin texture', denoiseOverride: 0.38 },
  luminescence: { id: 'luminescence', bucket: 'realism_composite', prompt: 'bioluminescent portrait, glowing ultraviolet freckles and ethereal light particles floating around face, dark enchanted atmosphere, subsurface scattering glow', denoiseOverride: 0.4 },
  '20s-era': { id: '20s-era', bucket: 'realism_composite', prompt: '1920s roaring twenties silver gelatin portrait, vintage Art Deco studio backdrop, antique large-format camera lens softness, sepia-tinted monochrome, film dust and scratches', denoiseOverride: 0.4 },
  prism: { id: 'prism', bucket: 'realism_composite', prompt: 'optical glass prism photography, rainbow spectral light refraction streaks across face, kaleidoscopic crystal lens flare, dreamy sunbeams', denoiseOverride: 0.35 },
  'black-and-white': { id: 'black-and-white', bucket: 'realism_composite', prompt: 'classic Ilford HP5 black and white film photography, dramatic Leica monochrome contrast, rich silver halide grain, deep shadows and bright highlights', denoiseOverride: 0.32 },
  'y2k-film': { id: 'y2k-film', bucket: 'realism_composite', prompt: 'early 2000s Y2K disposable camera aesthetic, harsh point-and-shoot flash, cool cyan-green film tint, glossy metallic sheen, nostalgic party vibe', denoiseOverride: 0.36 },
  'candle-light': { id: 'candle-light', bucket: 'realism_composite', prompt: 'intimate chiaroscuro portrait lit strictly by flickering warm candlelight, deep golden-amber glow on skin, dark moody surroundings, soft flickering shadows', denoiseOverride: 0.38 },
  'dream-diffusion': { id: 'dream-diffusion', bucket: 'realism_composite', prompt: 'ethereal Pro-Mist diffusion filter portrait, halation bloom around highlights, soft-focus pastel haze, angelic dreamy atmosphere', denoiseOverride: 0.36 },
  'velvet-glow': { id: 'velvet-glow', bucket: 'realism_composite', prompt: 'rich velvet-toned studio portrait, warm golden-hour rim lighting, satin skin sheen, deep burgundy and warm cocoa shadow grading', denoiseOverride: 0.34 },
  'polaroid-after-dark': { id: 'polaroid-after-dark', bucket: 'realism_composite', prompt: 'late-night Polaroid 600 flash photo in a dark room, harsh direct flash falloff, pitch-black background, raw candid nightlife aesthetic, heavy film grain', denoiseOverride: 0.38 },
  'plum-and-espresso': { id: 'plum-and-espresso', bucket: 'realism_composite', prompt: 'editorial color grading with deep plum purples and rich espresso browns, moody autumn coffeehouse lighting, matte film finish', denoiseOverride: 0.34 },
  'walmart-security-cam': { id: 'walmart-security-cam', bucket: 'realism_composite', prompt: 'high-angle fisheye CCTV security camera footage inside a fluorescent-lit retail store aisle, low-bitrate digital compression artifacts, timestamp overlay aesthetic', denoiseOverride: 0.42 },
  'alien-abduction-beam': { id: 'alien-abduction-beam', bucket: 'realism_composite', prompt: 'cinematic sci-fi night scene, intense volumetric emerald-green tractor beam shining down from a UFO in the night sky, floating dust motes, dramatic upward lighting', denoiseOverride: 0.42 },
  'park-bench': { id: 'park-bench', bucket: 'realism_composite', prompt: 'candid outdoor portrait sitting on a weathered wooden park bench, dappled sunlight filtering through lush green trees, golden hour bokeh', denoiseOverride: 0.4 },
  'product-photo': { id: 'product-photo', bucket: 'realism_composite', prompt: 'high-fashion commercial luxury campaign photography, seamless studio cyclorama backdrop, precision three-point strobe lighting, razor-sharp editorial polish', denoiseOverride: 0.35 },

  // 2. REALISM OUTFIT NSFW (5) - Locked to 0.50 denoise & 0.85 strength
  superhero: { id: 'superhero', bucket: 'realism_outfit_nsfw', prompt: 'wearing a form-fitting textured comic-book superhero bodysuit with metallic armor accents, dramatic cape, cinematic rooftop city night backdrop, heroic lighting', denoiseOverride: 0.5, loraStrengthOverride: 0.85 },
  'lord-of-the-rings': { id: 'lord-of-the-rings', bucket: 'realism_outfit_nsfw', prompt: 'high-fantasy Middle-earth elven royal attire, intricate silver filigree chestplate and sheer flowing silk robes, ancient Rivendell forest sanctuary, ethereal moonlight', denoiseOverride: 0.5, loraStrengthOverride: 0.85 },
  'change-outfit': { id: 'change-outfit', bucket: 'realism_outfit_nsfw', prompt: 'wearing provocative luxury designer evening wear, sheer lace and tailored satin couture, upscale penthouse suite lighting, alluring pose', denoiseOverride: 0.5, loraStrengthOverride: 0.85 },
  'olympian-greek-god': { id: 'olympian-greek-god', bucket: 'realism_outfit_nsfw', prompt: 'Olympian Greek deity, draped in sheer white silk chiton and hammered gold body jewelry, golden laurel wreath, marble Mount Olympus temple in clouds, divine golden glow', denoiseOverride: 0.5, loraStrengthOverride: 0.85 },
  dungeon: { id: 'dungeon', bucket: 'realism_outfit_nsfw', prompt: 'dark fantasy underground stone dungeon, wearing provocative gothic leather harness and metal chains, flickering wall torches, dramatic moody shadows, glossy skin sheen', denoiseOverride: 0.5, loraStrengthOverride: 0.85 },

  // 3. ANIME 2D TOON (14) - Locked to 0.50 denoise & 0.85 strength for likeness protection
  'comic-book': { id: 'comic-book', bucket: 'anime_2d_toon', prompt: 'modern American superhero comic book art, Jim Lee style heavy black ink crosshatching, bold dynamic outlines, vibrant cel-shaded coloring', denoiseOverride: 0.5, loraStrengthOverride: 0.85 },
  anime: { id: 'anime', bucket: 'anime_2d_toon', prompt: 'modern seasonal key visual anime illustration, Makoto Shinkai lighting, detailed glossy anime eyes, clean cel-shading, cinematic sky backdrop', denoiseOverride: 0.5, loraStrengthOverride: 0.85 },
  'adult-anime': { id: 'adult-anime', bucket: 'anime_2d_toon', prompt: 'mature late-night anime aesthetic, seductive expression, glossy blushed skin, detailed adult anime proportions, moody bedroom lighting', denoiseOverride: 0.5, loraStrengthOverride: 0.85 },
  cartoon: { id: 'cartoon', bucket: 'anime_2d_toon', prompt: 'Saturday morning 2D Western cartoon character design, expressive bold outlines, flat vibrant vector colors, playful exaggerated proportions', denoiseOverride: 0.5, loraStrengthOverride: 0.85 },
  'powerpuff-girls': { id: 'powerpuff-girls', bucket: 'anime_2d_toon', prompt: 'Powerpuff Girls Craig McCracken 1998 cartoon style, chibi proportions, giant oval eyes, thick black vector outlines, pastel heart background', denoiseOverride: 0.72, loraStrengthOverride: 0.45 },
  'sticker-pack': { id: 'sticker-pack', bucket: 'anime_2d_toon', prompt: 'die-cut vinyl kiss-cut sticker design, thick white offset border around character, glossy vector chibi illustration, simple solid background', denoiseOverride: 0.5, loraStrengthOverride: 0.85 },
  'pixel-art': { id: 'pixel-art', bucket: 'anime_2d_toon', prompt: '32-bit indie game pixel art portrait, crisp hand-placed pixel clusters, dithering shading, limited retro color palette, visible pixel grid', denoiseOverride: 0.7, loraStrengthOverride: 0.5 },
  'manga-memoir': { id: 'manga-memoir', bucket: 'anime_2d_toon', prompt: 'black and white Japanese seinen manga page illustration, G-pen ink linework, halftone screentone shading, speedlines, dramatic manga panel framing', denoiseOverride: 0.5, loraStrengthOverride: 0.85 },
  '90s-anime': { id: '90s-anime', bucket: 'anime_2d_toon', prompt: '1990s retro hand-painted cel anime, Sailor Moon and Evangelion VHS aesthetic, soft film grain, muted vintage anime palette, retro hair highlights', denoiseOverride: 0.5, loraStrengthOverride: 0.85 },
  gameboy: { id: 'gameboy', bucket: 'anime_2d_toon', prompt: '1989 Nintendo Game Boy 8-bit dot-matrix screen graphic, strict 4-shade olive green monochrome pixel palette, chunky retro handheld LCD pixels', denoiseOverride: 0.75, loraStrengthOverride: 0.45 },
  'south-park': { id: 'south-park', bucket: 'anime_2d_toon', prompt: 'South Park construction paper cutout animation style, flat 2D paper texture, simple geometric oval eyes, crude cutout shapes, snowy Colorado town background', denoiseOverride: 0.76, loraStrengthOverride: 0.4 },
  'adventure-time': { id: 'adventure-time', bucket: 'anime_2d_toon', prompt: 'Adventure Time Pendleton Ward cartoon style, noodle arms, simple dot eyes, thin clean outlines, candy kingdom vibrant pastel background', denoiseOverride: 0.75, loraStrengthOverride: 0.45 },
  atla: { id: 'atla', bucket: 'anime_2d_toon', prompt: 'Avatar: The Last Airbender animation style, Studio Mir expressive character design, elemental bending aura, warm painterly background', denoiseOverride: 0.5, loraStrengthOverride: 0.85 },
  '16-bit-arcade': { id: '16-bit-arcade', bucket: 'anime_2d_toon', prompt: '1990s Capcom CPS2 16-bit arcade fighting game character select portrait, vibrant pixel sprite art, CRT scanlines, dynamic arcade UI vibes', denoiseOverride: 0.65, loraStrengthOverride: 0.52 },

  // 4. TOY 3D SCULPT (12) - Mold styles keep high denoise / low strength
  lego: { id: 'lego', bucket: 'toy_3d_sculpt', prompt: 'official LEGO minifigure character, glossy yellow cylindrical plastic head with stud on top, claw hands, ABS plastic brick environment, macro toy photo', denoiseOverride: 0.76, loraStrengthOverride: 0.45 },
  figurine: { id: 'figurine', bucket: 'toy_3d_sculpt', prompt: '1/7 scale painted PVC anime collector figurine standing on an acrylic display base, smooth airbrushed plastic shading, glass display cabinet lighting', denoiseOverride: 0.5, loraStrengthOverride: 0.85 },
  pixar: { id: 'pixar', bucket: 'toy_3d_sculpt', prompt: 'Disney Pixar 3D animated movie character portrait, expressive large eyes, soft subsurface skin scattering, groomed 3D hair strands, warm cinematic render', denoiseOverride: 0.5, loraStrengthOverride: 0.85 },
  claymation: { id: 'claymation', bucket: 'toy_3d_sculpt', prompt: 'Aardman stop-motion plasticine claymation figure, visible thumbprints and sculpted clay tool marks, miniature handcrafted studio set lighting', denoiseOverride: 0.7, loraStrengthOverride: 0.5 },
  'plush-doll': { id: 'plush-doll', bucket: 'toy_3d_sculpt', prompt: 'cute handmade stuffed fabric plushie doll, soft felt and fleece textures, visible embroidered thread stitching, button eyes, cozy bedroom shelf background', denoiseOverride: 0.74, loraStrengthOverride: 0.45 },
  'kawaii-collector': { id: 'kawaii-collector', bucket: 'toy_3d_sculpt', prompt: 'Pop Mart blind-box designer vinyl art toy, chibi proportions, smooth matte pastel vinyl finish, oversized head, cute studio showcase', denoiseOverride: 0.72, loraStrengthOverride: 0.48 },
  statue: { id: 'statue', bucket: 'toy_3d_sculpt', prompt: 'classical Renaissance carved Carrara white marble bust statue, smooth chiselled stone surface, blank sculpted marble eyes, museum gallery spotlight', denoiseOverride: 0.5, loraStrengthOverride: 0.85 },
  '3d-avatar': { id: '3d-avatar', bucket: 'toy_3d_sculpt', prompt: 'stylized glossy 3D metaverse avatar portrait, Unreal Engine 5 render, smooth stylized proportions, soft neon rim lighting', denoiseOverride: 0.5, loraStrengthOverride: 0.85 },
  bobblehead: { id: 'bobblehead', bucket: 'toy_3d_sculpt', prompt: 'hand-painted polyresin dashboard bobblehead figure, oversized caricature head mounted on a metal neck spring, miniature body on a display stand', denoiseOverride: 0.7, loraStrengthOverride: 0.58 },
  minecraft: { id: 'minecraft', bucket: 'toy_3d_sculpt', prompt: 'Minecraft voxel character model, cubic blocky head and limbs, low-res pixel skin texture, sunlit blocky voxel landscape with shaders', denoiseOverride: 0.78, loraStrengthOverride: 0.4 },
  'mini-me': { id: 'mini-me', bucket: 'toy_3d_sculpt', prompt: 'chibi Nendoroid-style articulated miniature figure, interchangeable faceplate look, glossy plastic hair, standing on a real wooden desk next to a coffee mug', denoiseOverride: 0.7, loraStrengthOverride: 0.52 },
  'paper-people': { id: 'paper-people', bucket: 'toy_3d_sculpt', prompt: '3D origami and layered papercraft diorama character, folded matte cardstock facets, sharp paper creases, warm drop-shadow lighting', denoiseOverride: 0.72, loraStrengthOverride: 0.48 },

  // 5. FINE ART MEDIUM (17) - Locked to 0.50 denoise & 0.85 strength
  watercolor: { id: 'watercolor', bucket: 'fine_art_medium', prompt: 'expressive wet-on-wet watercolor painting on cold-press cotton paper, translucent pigment blooms, paint splatter edges, visible paper grain', denoiseOverride: 0.5, loraStrengthOverride: 0.85 },
  'ink-illustration': { id: 'ink-illustration', bucket: 'fine_art_medium', prompt: 'fine-liner black India ink dip-pen illustration on cream paper, intricate crosshatching and stippling shading, high-contrast linework', denoiseOverride: 0.5, loraStrengthOverride: 0.85 },
  posterize: { id: 'posterize', bucket: 'fine_art_medium', prompt: 'Shepard Fairey Obey-style screenprint posterized portrait, bold 4-color flat tonal separation in crimson, cream, navy, and black, distressed paper texture', denoiseOverride: 0.5, loraStrengthOverride: 0.85 },
  'coloring-book': { id: 'coloring-book', bucket: 'fine_art_medium', prompt: 'adult coloring book page, pure black-and-white clean vector line art on stark white background, zero shading, uncolored open spaces ready for coloring', negativeAdd: 'color, shading, gradients, greyscale, filled colors, photo', denoiseOverride: 0.55, loraStrengthOverride: 0.85 },
  stencil: { id: 'stencil', bucket: 'fine_art_medium', prompt: 'Banksy-style multi-layer cardboard cutout spray-paint stencil art on a rough concrete wall, aerosol overspray mist and paint drips, high contrast', denoiseOverride: 0.5, loraStrengthOverride: 0.85 },
  astrology: { id: 'astrology', bucket: 'fine_art_medium', prompt: 'celestial golden zodiac alchemy illustration, ornate gold foil constellation lines, crescent moons and stars on deep midnight-blue parchment', denoiseOverride: 0.5, loraStrengthOverride: 0.85 },
  psychedelic: { id: 'psychedelic', bucket: 'fine_art_medium', prompt: '1960s LSD psychedelic blacklight poster art, Alex Grey swirling neon fractals, melting kaleidoscopic rainbow aura, trippy visionary patterns', denoiseOverride: 0.5, loraStrengthOverride: 0.85 },
  'comic-dot': { id: 'comic-dot', bucket: 'fine_art_medium', prompt: 'Roy Lichtenstein 1960s Pop Art painting, bold black outlines filled with oversized Ben-Day cyan, magenta, and yellow halftone dots', denoiseOverride: 0.5, loraStrengthOverride: 0.85 },
  'pop-garden': { id: 'pop-garden', bucket: 'fine_art_medium', prompt: 'Takashi Murakami Superflat pop-art portrait surrounded by smiling vibrant botanical flowers, glossy graphic vector colors, joyful maximalist composition', denoiseOverride: 0.5, loraStrengthOverride: 0.85 },
  pointillism: { id: 'pointillism', bucket: 'fine_art_medium', prompt: 'Georges Seurat Neo-Impressionist oil pointillism painting, composed entirely of thousands of distinct small dabs and dots of pure oil paint on canvas', denoiseOverride: 0.5, loraStrengthOverride: 0.85 },
  'negative-space-invasion': { id: 'negative-space-invasion', bucket: 'fine_art_medium', prompt: 'minimalist high-contrast negative space optical illusion illustration, stark black and white figure-ground reversal silhouette, surreal graphic design', denoiseOverride: 0.5, loraStrengthOverride: 0.85 },
  'drawn-to-life': { id: 'drawn-to-life', bucket: 'fine_art_medium', prompt: 'Take On Me trompe-l-oeil hybrid art, half photorealistic human emerging out of a rough graphite pencil sketchbook page on a wooden desk, torn paper boundary', denoiseOverride: 0.5, loraStrengthOverride: 0.85 },
  'stained-glass': { id: 'stained-glass', bucket: 'fine_art_medium', prompt: 'Gothic cathedral illuminated stained-glass window mosaic, translucent jewel-toned glass pieces separated by thick black lead came solder lines, sunlight shining through', denoiseOverride: 0.5, loraStrengthOverride: 0.85 },
  mural: { id: 'mural', bucket: 'fine_art_medium', prompt: 'large-scale urban outdoor brick wall mural painting, visible red brick mortar texture beneath vibrant acrylic brushwork, daylight street angle', denoiseOverride: 0.5, loraStrengthOverride: 0.85 },
  graffiti: { id: 'graffiti', bucket: 'fine_art_medium', prompt: 'street art aerosol graffiti character portrait surrounded by wildstyle spray-paint lettering tags, neon paint drips, gritty subway wall texture', denoiseOverride: 0.5, loraStrengthOverride: 0.85 },
  blueprint: { id: 'blueprint', bucket: 'fine_art_medium', prompt: 'cyanotype architectural engineering blueprint schematic, glowing white technical drafting lines, measurement callouts, and geometric grid on Prussian blue paper', denoiseOverride: 0.55, loraStrengthOverride: 0.85 },
  sketch: { id: 'sketch', bucket: 'fine_art_medium', prompt: 'expressive charcoal and graphite pencil portrait sketch on toothy toned sketchbook paper, smudged shading, dynamic construction lines, white chalk highlights', denoiseOverride: 0.5, loraStrengthOverride: 0.85 },

  // 6. FRAMED CARD (22) - Locked to 0.50 denoise & 0.85 strength (Tarot cards, etc.)
  'tarot-card': { id: 'tarot-card', bucket: 'framed_card', prompt: 'ornate Rider-Waite-Smith and Art Nouveau gold-foil Tarot card, decorative celestial border frame, Roman numeral header and bottom title banner', denoiseOverride: 0.5, loraStrengthOverride: 0.85 },
  'holiday-cards': { id: 'holiday-cards', bucket: 'framed_card', prompt: 'festive embossed holiday greeting card layout, decorative winter holly and gold ribbon border frame, warm cozy seasonal lighting, cardstock texture', denoiseOverride: 0.5, loraStrengthOverride: 0.85 },
  'magazine-cover': { id: 'magazine-cover', bucket: 'framed_card', prompt: 'glossy Vogue and GQ high-fashion magazine cover layout, bold masthead title behind head, editorial coverlines and barcode in corner, studio portrait', denoiseOverride: 0.5, loraStrengthOverride: 0.85 },
  'pokemon-card': { id: 'pokemon-card', bucket: 'framed_card', prompt: 'holographic foil Full-Art Pokemon TCG trading card frame, HP stats in top corner, attack move text box overlay, sparkling rainbow holo pattern', denoiseOverride: 0.5, loraStrengthOverride: 0.85 },
  'yugioh-card': { id: 'yugioh-card', bucket: 'framed_card', prompt: 'Yu-Gi-Oh! Secret Rare trading card layout, metallic stone card border, level stars along top, ornate foil artwork box, ATK/DEF stat box at bottom', denoiseOverride: 0.5, loraStrengthOverride: 0.85 },
  'playing-card': { id: 'playing-card', bucket: 'framed_card', prompt: 'vintage Bicycle poker playing card court face (King/Queen of Hearts), mirrored two-way symmetrical royal illustration, corner suit indices, linen card texture', denoiseOverride: 0.5, loraStrengthOverride: 0.85 },
  'myspace-glitter': { id: 'myspace-glitter', bucket: 'framed_card', prompt: '2006 MySpace Blingee graphic edit, sparkling animated-style pink and silver diamond glitter border, pixelated cursive heart stamps, nostalgic Y2K web aesthetic', denoiseOverride: 0.5, loraStrengthOverride: 0.85 },
  'magazine-ransom-note': { id: 'magazine-ransom-note', bucket: 'framed_card', prompt: '1990s punk zine collage portrait framed by cut-out magazine ransom-note letters, torn halftone newspaper clippings, Scotch tape and safety pins', denoiseOverride: 0.5, loraStrengthOverride: 0.85 },
  'album-cover': { id: 'album-cover', bucket: 'framed_card', prompt: 'iconic square vinyl LP music album cover design, Parental Advisory Explicit Content sticker in bottom corner, dramatic moody lighting, ring-wear sleeve texture', denoiseOverride: 0.5, loraStrengthOverride: 0.85 },
  'record-vinyl': { id: 'record-vinyl', bucket: 'framed_card', prompt: 'circular center paper label printed on a grooved black 12-inch vinyl record disc, central spindle hole, glossy vinyl microgrooves catching studio light', denoiseOverride: 0.5, loraStrengthOverride: 0.85 },
  'app-icon': { id: 'app-icon', bucket: 'framed_card', prompt: 'iOS squircle mobile app icon design, rounded glossy 3D bevel frame, vibrant gradient background, punchy stylized portrait popping out of icon frame', denoiseOverride: 0.5, loraStrengthOverride: 0.85 },
  scrapbook: { id: 'scrapbook', bucket: 'framed_card', prompt: 'handmade memory scrapbook page layout, portrait photo attached with pastel washi tape, dried pressed flowers, stickers, and Kraft paper background', denoiseOverride: 0.5, loraStrengthOverride: 0.85 },
  'backwoods-wrapper': { id: 'backwoods-wrapper', bucket: 'framed_card', prompt: 'custom foil cigarillo pouch packaging wrapper design, bold street-wear graphic banner header, metallic crinkle foil bag texture, high-contrast portrait', denoiseOverride: 0.5, loraStrengthOverride: 0.85 },
  'post-card': { id: 'post-card', bucket: 'framed_card', prompt: 'vintage mid-century "Greetings From" souvenir travel postcard, scalloped white border, retro 3D block lettering, postage stamp and ink postmark overlay', denoiseOverride: 0.5, loraStrengthOverride: 0.85 },
  photobooth: { id: 'photobooth', bucket: 'framed_card', prompt: 'vertical mall photo-booth film strip showing expressive candid poses inside a glossy white paper frame, harsh flash, nostalgic chemical photo texture', denoiseOverride: 0.5, loraStrengthOverride: 0.85 },
  'wanted-poster': { id: 'wanted-poster', bucket: 'framed_card', prompt: '1880s Old West "WANTED DEAD OR ALIVE" reward poster nailed to a weathered wooden saloon post, sepia woodcut-style portrait, burnt parchment edges', denoiseOverride: 0.5, loraStrengthOverride: 0.85 },
  'book-cover': { id: 'book-cover', bucket: 'framed_card', prompt: 'New York Times bestselling hardcover novel dust-jacket book cover, embossed metallic foil title typography, dramatic painterly portrait illustration', denoiseOverride: 0.5, loraStrengthOverride: 0.85 },
  thumbnail: { id: 'thumbnail', bucket: 'framed_card', prompt: 'viral high-CTR YouTube thumbnail composition, glowing white outline cutout around subject, hyper-saturated background, dramatic rim lighting and bold graphic arrows', denoiseOverride: 0.5, loraStrengthOverride: 0.85 },
  advertisement: { id: 'advertisement', bucket: 'framed_card', prompt: '1950s Madison Avenue vintage magazine print advertisement layout, retro mid-century slogan typography, warm Technicolor commercial illustration', denoiseOverride: 0.5, loraStrengthOverride: 0.85 },
  'missing-poster': { id: 'missing-poster', bucket: 'framed_card', prompt: 'urban photocopy "HAVE YOU SEEN ME?" missing person flyer stapled to a wooden telephone pole, high-contrast xerox halftone portrait, tear-off tabs at bottom', denoiseOverride: 0.5, loraStrengthOverride: 0.85 },
  'fbi-wanted': { id: 'fbi-wanted', bucket: 'framed_card', prompt: 'official federal FBI Ten Most Wanted fugitive dossier sheet, red header banner, mugshot height-chart grid and biometric data boxes', denoiseOverride: 0.5, loraStrengthOverride: 0.85 },
  'post-it-note': { id: 'post-it-note', bucket: 'framed_card', prompt: 'ballpoint pen doodle portrait drawn on a square canary-yellow 3M Post-it sticky note stuck to a computer monitor bezel, curled bottom paper corner', denoiseOverride: 0.55, loraStrengthOverride: 0.85 },

  // 7. MACRO OBJECT EMBED (8)
  snowglobe: { id: 'snowglobe', bucket: 'macro_object_embed', prompt: 'miniature 3D portrait scene enclosed inside a glass water snowglobe on an ornate wooden base, swirling white glitter snow flakes, curved glass refraction', denoiseOverride: 0.65 },
  'rip-shirt': { id: 'rip-shirt', bucket: 'macro_object_embed', prompt: '90s airbrushed memorial graphic T-shirt design printed on heavy vintage cotton fabric, fluffy clouds and doves frame, visible knit cotton fabric folds', denoiseOverride: 0.65 },
  merchandise: { id: 'merchandise', bucket: 'macro_object_embed', prompt: 'custom tour merchandise showcase featuring the portrait printed on a ceramic coffee mug and streetwear hoodie on a retail display table', denoiseOverride: 0.65 },
  billboard: { id: 'billboard', bucket: 'macro_object_embed', prompt: 'massive illuminated Times Square highway billboard sign displaying the portrait advertisement, steel scaffolding structure, dusk city twilight sky', denoiseOverride: 0.65 },
  'side-of-bus': { id: 'side-of-bus', bucket: 'macro_object_embed', prompt: 'full-scale vinyl transit advertisement wrap printed across the side of a city double-decker bus on a busy downtown street, window perforations and metal seams', denoiseOverride: 0.65 },
  'milk-carton': { id: 'milk-carton', bucket: 'macro_object_embed', prompt: 'vintage 1980s waxed paperboard milk carton on a kitchen table with the portrait printed in a "Missing" box on the side panel, halftone ink print texture', denoiseOverride: 0.65 },
  'perc-in-bong': { id: 'perc-in-bong', bucket: 'macro_object_embed', prompt: 'custom heady borosilicate art glass water pipe featuring an intricate sculpted glass percolator of the character inside the chamber, colorful UV glass accents, bubbling water', denoiseOverride: 0.68 },
  'car-wrap': { id: 'car-wrap', bucket: 'macro_object_embed', prompt: 'glossy custom JDM itasha vinyl car wrap printed across the hood and doors of a tuned sports car under neon parking garage lights, metallic paint reflections', denoiseOverride: 0.65 },
};

/* ---------------------------------------------------------------------------
 * Execution layer
 *
 * Everything above is the source of truth. Below maps a style onto the concrete
 * node parameters the workflow builders consume, so nothing else in the backend
 * needs to know about buckets.
 * ------------------------------------------------------------------------- */

export type BucketMode = BucketId;

export type BucketParams = {
  checkpoint: 'pony' | 'anime';
  controlNet: 'depth' | 'depth_line' | 'anime_line' | 'openpose' | 'none';
  controlNetStrength: number;
  controlNetEndPercent: number;
  lineartStrength?: number;
  lineartEndPercent?: number;
  faceIdWeight: number;
  faceIdLoraStrength: number;
  faceIdEndAt?: number;
  stylePrefix: string;
  negativeAdditions: string;
  extraPositive?: string;
  blurRadius: number;
  denoise: number;
  initFromSource?: boolean;
  portrait?: boolean;
  padScale?: number;
  loraStrength?: number;
  loraClipStrength?: number;
  useFaceId?: boolean;
  cfgScale?: number;
};

/** Which ControlNet each bucket runs. Realism builds its own graphs. */
const CONTROL_NET_BY_BUCKET: Record<BucketId, BucketParams['controlNet']> = {
  realism_composite: 'none',
  realism_outfit_nsfw: 'openpose',
  anime_2d_toon: 'anime_line',
  toy_3d_sculpt: 'none',
  fine_art_medium: 'anime_line',
  framed_card: 'anime_line',
  macro_object_embed: 'none',
};

/** Per-bucket LoRA strength. Stylized buckets run a weak CLIP side so the style wins. */
const LORA_BY_BUCKET: Record<BucketId, { model: number; clip: number }> = {
  realism_composite: { model: 0.85, clip: 0.85 },
  realism_outfit_nsfw: { model: 0.85, clip: 0.85 },
  anime_2d_toon: { model: 0.85, clip: 0.85 },
  toy_3d_sculpt: { model: 0.5, clip: 0.4 },
  fine_art_medium: { model: 0.85, clip: 0.85 },
  framed_card: { model: 0.85, clip: 0.85 },
  macro_object_embed: { model: 0.65, clip: 0.4 },
};

/** FaceID only where the LoRA is not already carrying her. */
const FACE_ID_BUCKETS: ReadonlySet<BucketId> = new Set<BucketId>([
  'realism_composite',
  'realism_outfit_nsfw',
  'anime_2d_toon',
  'fine_art_medium',
  'framed_card',
]);

/** Lineart is the composition anchor for stylized buckets. */
const CONTROL_STRENGTH: Record<BucketId, { strength: number; end: number }> = {
  realism_composite: { strength: 0.4, end: 0.4 },
  realism_outfit_nsfw: { strength: 0.65, end: 0.6 },
  anime_2d_toon: { strength: 0.5, end: 0.55 },
  toy_3d_sculpt: { strength: 0.4, end: 0.4 },
  fine_art_medium: { strength: 0.5, end: 0.55 },
  framed_card: { strength: 0.45, end: 0.5 },
  macro_object_embed: { strength: 0.4, end: 0.4 },
};

/** Portrait canvas for the buckets that need room around her. */
const PORTRAIT_BUCKETS: ReadonlySet<BucketId> = new Set<BucketId>([
  'anime_2d_toon',
  'toy_3d_sculpt',
  'fine_art_medium',
  'framed_card',
]);

/** FaceID: strong on realism, deliberately weak where the LoRA carries her. */
const FACE_ID_BY_BUCKET: Record<BucketId, { weight: number; lora: number; endAt: number }> = {
  realism_composite: { weight: 0.85, lora: 0.65, endAt: 0.85 },
  realism_outfit_nsfw: { weight: 0.85, lora: 0.65, endAt: 0.85 },
  anime_2d_toon: { weight: 0.35, lora: 0.35, endAt: 0.4 },
  toy_3d_sculpt: { weight: 0.35, lora: 0.35, endAt: 0.4 },
  fine_art_medium: { weight: 0.35, lora: 0.35, endAt: 0.4 },
  framed_card: { weight: 0.35, lora: 0.35, endAt: 0.4 },
  macro_object_embed: { weight: 0.5, lora: 0.45, endAt: 0.6 },
};

export const STYLE_BUCKET: Record<string, BucketId> = Object.fromEntries(
  Object.values(STYLE_DEFINITIONS).map((def) => [def.id, def.bucket])
);

export function styleDefinition(style: string): StyleDefinition {
  return STYLE_DEFINITIONS[style] ?? STYLE_DEFINITIONS.realistic;
}

export function bucketForStyle(style: string): BucketId {
  return styleDefinition(style).bucket;
}

/** Buckets that keep img2img from her photo. Only the clothed composite path. */
const IMG2IMG_BUCKETS: ReadonlySet<BucketId> = new Set<BucketId>(['realism_composite']);

export function bucketConfig(style: string): BucketParams {
  const def = styleDefinition(style);
  const bucket = BUCKET_CONFIGS[def.bucket];
  const faceId = FACE_ID_BY_BUCKET[def.bucket];
  const initFromSource = IMG2IMG_BUCKETS.has(def.bucket);

  return {
    checkpoint: 'pony',
    controlNet: CONTROL_NET_BY_BUCKET[def.bucket],
    controlNetStrength: CONTROL_STRENGTH[def.bucket].strength,
    controlNetEndPercent: CONTROL_STRENGTH[def.bucket].end,
    lineartStrength: 0.55,
    lineartEndPercent: 0.6,
    faceIdWeight: faceId.weight,
    faceIdLoraStrength: faceId.lora,
    faceIdEndAt: faceId.endAt,
    stylePrefix: bucket.basePrefix,
    negativeAdditions: [bucket.baseNegative, def.negativeAdd].filter(Boolean).join(', '),
    blurRadius: 0,
    // An EmptyLatent canvas must start at 1.0; a partial denoise on pure noise
    // would sample a half-finished blur instead of an image. Per-style denoise
    // values therefore only apply to the img2img buckets.
    denoise: initFromSource ? (def.denoiseOverride ?? bucket.defaultDenoise) : 1.0,
    initFromSource,
    portrait: PORTRAIT_BUCKETS.has(def.bucket),
    loraStrength: LORA_BY_BUCKET[def.bucket].model,
    loraClipStrength: LORA_BY_BUCKET[def.bucket].clip,
    useFaceId: FACE_ID_BUCKETS.has(def.bucket),
    cfgScale: bucket.defaultCfg,
  };
}

/** Prompt fragment for a style: its own text plus the bucket's medium tags. */
export function stylePrompt(style: string): string {
  const def = styleDefinition(style);
  return `${def.prompt}, ${BUCKET_CONFIGS[def.bucket].basePrefix}`;
}

export function loraForSubject(subject: SubjectMode): string | null {
  if (subject === 'wife') return LORA_FILES.wife;
  if (subject === 'husband') return LORA_FILES.husband;
  return null;
}

/** Trigger tokens. Only these go into the image prompt. */
export const SUBJECT_TAGS: Record<SubjectMode, string> = {
  wife: 'ashley, long straight cherry red hair falling past the shoulders, round wireframe glasses, (thick thighs:1.10), (soft lower belly:1.05), (curvy figure:1.05)',
  husband: 'mbboi',
  couple: 'ashley with long straight cherry red hair wearing glasses and (thick thighs:1.10), (curvy figure:1.05), and mbboi',
};

// ==========================================
// MASTER STONER ENVIRONMENT POOL
// ==========================================
export const MASSIVE_AUTHENTIC_WEED_ENVIRONMENTS = [
  'high-rise Chicago apartment living room at 2:00 AM, glowing purple and green LED strip lighting framing the windows, heavy snow falling against the glass outside, city lights blurring in the background, thick aromatic smoke hanging in the air',
  'cozy vintage Chicago brick-loft apartment at midnight, exposed brick walls adorned with cannabis tapestries and vintage weed posters, glowing green and purple neon lights, coffee table covered in rolling trays, raw papers, and glass bongs',
  'chic downtown apartment balcony during late twilight, overlooking the Chicago skyline twinkling in the dark, string fairy lights weaving through potted outdoor cannabis plants, crisp night air carrying thick smoke',
  'darkened basement apartment smoke den at 4:20 AM, blacklight posters glowing on the walls, purple and green laser lights cutting through heavy smoke clouds, vinyl records playing in the corner',
  'artistic bohemian loft studio at midnight, floor cushions scattered around a massive wooden coffee table loaded with blunts, joints, packs of raw papers, grinders, and fresh bud',
  'cozy studio apartment at 3:00 AM, heavy velvet curtains closed, purple and green fairy lights strung across the ceiling, rolling supplies, tip booklets, and amber mason jars lining the shelves',
  'urban penthouse hotbox session at midnight, floor-to-ceiling windows showing a glowing city skyline, velvet couches, massive glass percolator bongs, golden rolling trays, and thick aromatic smoke haze',
  'suburban apartment living room late at night under glowing blacklights, string weed leaf fairy lights, glass bong and scattered swisher sweets and white owl wrappers on the table',
  'creative music producer apartment studio at 2:30 AM, synthesizers and DJ decks glowing with green and purple LEDs, soundproofing foam on walls, hazy smoke filling the room',
  'vintage retro apartment living room at midnight, 70s shag carpet, green and purple lava lamps, cannabis leaf tapestries, heavy fragrant smoke hanging in the air',
  'cozy wooden cabin deep in the snowy woods at 1:00 AM, warm yellow light spilling from windows mixed with green and purple fairy lights inside, crackling stone fireplace, rolling up a fresh Backwood on the wooden table',
  'isolated cabin porch in the deep forest at midnight, surrounded by towering pine trees and outdoor cannabis crops, starry night sky, glowing campfire embers casting warm light',
  'rustic timber-framed cabin living room at 3:00 AM, massive stone fireplace throwing warm amber light, green and purple accent lighting, leather couch, heavy smoke hanging in the air',
  'cozy wooden treehouse tucked deep in the forest at midnight, fairy lights woven through the branches, open windows letting in the crisp night air, blankets and pillows piled high, packing a fresh bowl',
  'mystic forest clearing at 2:00 AM illuminated by glowing green bio-luminescent moss and cannabis fairy lights strung between trees, peaceful secluded smoke spot under the stars',
  'remote mountain cabin at midnight, snow-covered roof, windows glowing with green and purple interior ambient light, thick aromatic smoke rising from the chimney into the cold night air',
  'rustic log cabin back porch at 4:00 AM, rocking chairs, tiki torches casting purple and green hues, tall pine trees surrounding the property, peaceful wilderness night vibe',
  'secluded woodland campsite at midnight, glowing campfire lighting up surrounding cannabis bushes, string fairy lights on tent poles, thick smoke rising into the dark sky',
  'mountain-view cabin living room at 1:30 AM, floor-to-ceiling glass looking out into the dark forest, glowing neon weed sign on the wall, bongs and rolling trays on the coffee table',
  'rustic hunting cabin at midnight, wood-paneled walls, taxidermy, green and purple LED mood lighting, heavy smoke hanging low over a wooden table covered in papers and flower',
  'authentic underground grow room and sesh spot at 2:00 AM, glowing purple full-spectrum horticulture lights, drying colas hanging overhead, crystal trichome resin glistening under moody colored lights',
  'secret indoor hydroponic grow room at midnight, glowing red and purple LED grow panels, rows of resinous flowering cannabis plants framing the shot, heavy aromatic pine and skunk scent in the air',
  'mystical ancient greenhouse sanctuary at 3:00 AM, overgrown exotic cannabis strains winding up ancient stone pillars, shafts of moonlight piercing through glass roofs and thick resinous smoke',
  'sunlit commercial cultivation room at dawn, bright natural morning light mixing with purple supplemental grow beams, manicuring trays full of fresh trim',
  'rustic wooden barn greenhouse at midnight, strings of warm Edison bulbs and green fairy lights, potted cannabis plants stretching toward the rafters, quiet rural night atmosphere',
  'tropical jungle greenhouse at 2:00 AM, giant palm leaves and exotic cannabis plants, glowing green and purple accent lights, misty air thick with fragrant smoke',
  'desert greenhouse oasis at midnight, cacti and flowering cannabis plants under glass panels, purple grow lights reflecting off glass jars and rolling trays',
  'hidden outdoor hoop-house greenhouse at 1:00 AM, plastic walls glowing from green and purple interior lights, rows of sticky flowering colas, peaceful night atmosphere',
  'overgrown botanical garden greenhouse at midnight, moonlight and green fairy lights illuminating giant cannabis fan leaves, stone pathways, heavy smoke haze',
  'clandestine garage grow room at 3:00 AM, makeshift reflective Mylar walls, purple LED grow lights casting a moody glow over jars, grinders, and fresh harvests',
  'late night outdoor patio session under the stars at midnight, string fairy lights weaving through giant cannabis plants, hazy smoke clouds drifting into the cool night air, comfortable outdoor couches',
  'backyard porch at 2:00 AM lit by glowing green and purple tiki torches and cannabis fairy lights, hazy smoke in the crisp air, relaxing chill atmosphere',
  'rooftop balcony overlooking a quiet neighborhood at 1:00 AM, string lights, comfortable patio chairs, rolling tray on an iron table, cool evening breeze carrying smoke away',
  'camper van interior parked deep in nature at midnight, custom fairy lights, velvet upholstery, rolling tray on the dashboard, hazy smoke filling the small cozy space',
  'hidden desert oasis patio at 3:00 AM, warm breeze, tiki torches, string lights, comfortable wicker furniture surrounded by potted outdoor cannabis plants',
  'VIP backroom of a private lounge at midnight, deep leather armchairs, low amber and green mood lighting, crystal ashtrays, glass jars of top-shelf exotic strains, heavy fragrant air',
  'hotel suite balcony at 2:00 AM, city lights blurred in the background, plush robes, room service table covered in gourmet snacks and high-end smoking accessories',
  'retro 70s van interior converted into a mobile smoke lounge at midnight, shag carpeting, velvet walls, green and purple fairy lights, rolling tray between the front seats',
  'private yacht deck docked at 1:00 AM, gentle ocean waves, glowing green and purple ambient deck lighting, cannabis fairy lights, hazy smoke drifting over the water',
  'secluded beach bonfire at midnight, crashing ocean waves casting light, tiki torches, heavy smoke mixing with the salty ocean breeze',
  'backyard gazebo at 2:30 AM draped in cannabis tapestries and fairy lights, comfortable cushioned seating, rolling trays, bongs, and backwoods on the table',
  'historic brick courtyard at midnight, ivy-covered walls, string lights weaving through trees, outdoor table covered in smoking accessories and mason jars',
  'cliffside ocean-view terrace at 1:00 AM, starry sky, glowing neon weed sign on the stone wall, comfortable lounge chairs, thick smoke rolling across the patio',
  'countryside farmhouse porch at 3:00 AM, rocking chairs, green and purple porch lights, crickets chirping, rolling up a fresh blunt in the cool night air',
  'abandoned urban rooftop hideout at midnight, city skyline in the distance, graffiti-covered walls, lawn chairs, fairy lights, and heavy smoke haze',
  'sunken living room in a 1970s split-level house, conversation pit with orange shag cushions, wood paneling, lava lamps, thick smoke drifting through a sunbeam from the skylight',
  'converted industrial warehouse loft, exposed steel beams and ductwork, huge factory windows, industrial pendant lights, a heavy glass bong on a steel workbench',
  'tiny Tokyo capsule apartment at 3 AM, neon signs bleeding through frosted glass, futon on the floor, manga stacked in corners, a small bong on a low tray',
  'Parisian attic studio under a mansard roof, sloped ceiling, rainy skylight, unmade bed, wine bottle, rolling papers on a paint-stained table',
  'Moroccan riad courtyard at midnight, mosaic tile fountain, lanterns casting patterned light, cannabis plants in clay pots, cushions around a low brass table',
  'Airstream trailer parked in the desert at 2 AM, warm string lights inside, turquoise upholstery, a bong on the tiny dinette, stars through the windows',
  'basement recording studio, acoustic foam walls, mixing desk lit by VU meters, thick smoke, a bong balanced on a monitor speaker',
  'vintage bookshop back room at midnight, floor-to-ceiling shelves, rolling ladder, dusty lamp light, a hidden sesh corner with a leather armchair',
  'art deco hotel suite, curved velvet sofa, brass fixtures, tall windows over a rainy boulevard, crystal ashtray and a glass bong on the marble table',
  'submarine-style bunker lounge, riveted steel walls, amber emergency lighting, bolted metal table with a bong and scattered papers',
  'Japanese ryokan room at night, tatami mats, shoji screens, low table with a bong and tea set, paper lantern glow',
  'glass igloo in the Arctic, aurora through the dome, fur throws, a bong on a wooden crate, breath fogging in the cold air',
  'greenhouse train car parked on abandoned tracks, overgrown vines through broken windows, moonlight, cannabis plants reclaiming the seats',
  '1950s diner after closing, chrome stools, checkered floor, neon sign buzzing outside, a bong on the counter beside a half-finished milkshake',
  'underground speakeasy behind a bookcase door, velvet booths, jazz posters, dim amber sconces, thick smoke and a glass bong on the bar',
  'treehouse bar built into an oak canopy, rope bridges, lanterns, cannabis plants potted along the railing, a bong on the plank counter',
  'snowed-in alpine chalet, stone hearth, drying firewood, wool blankets, a bong on the low table beside a mug of something hot',
  'retro arcade back room, cabinet glow, sticky carpet, a bong on the stool beside a pinball machine, smoke catching the CRT light',
  'floating houseboat cabin, gentle water sounds, brass portholes, a bong on the galley table, mist over the river outside',
  'converted chapel studio, stained glass throwing colour across the floor, vaulted ceiling, a bong on a stone ledge',
  'rooftop greenhouse in a city, glass panels fogged, tomato and cannabis plants in rows, a bong on a potting bench',
  'private library with a rolling ladder, leather chairs, green banker lamps, a bong on the reading table beside an open book',
  'desert airstream camp at dusk, fire pit, folding chairs, cannabis plants in buckets, a bong on a crate and smoke against the sunset',
  'bohemian beach shack, driftwood walls, open window with ocean sound, sarongs drying, a bong on a crate beside shells',
  'old cinema projection booth, film reels stacked, dust in the projector beam, a bong on the console',
  'Victorian parlour, heavy drapes, patterned wallpaper, tarnished silver tray with a bong and a decanter',
  'mountain fire lookout tower, 360-degree windows, storm outside, a bong on the narrow desk, radio crackling',
  'fairy-light strung garden shed, potting tools, terracotta pots, cannabis seedlings under a grow bulb, a bong on the workbench',
  'underground parking garage at 3 AM, sodium lights, concrete pillars, a car with its door open, a bong on the hood',
  'Scandinavian cabin with a glass roof, snowy pines above, sheepskin rugs, a bong on a pale wood table',
  'art studio with half-finished canvases, turpentine smell, paint-splattered floor, a bong on a stool beside the easel',
  'converted lighthouse lantern room, sweeping beam outside, circular windows, a bong on the iron railing ledge',
  'hidden karaoke room, red velvet walls, mirrored ceiling, a bong on the table between microphones',
  'winterized camper in a snowy field, condensation on the windows, blankets, a bong on the fold-out table',
  'rooftop pool deck at night, glowing water, loungers, cannabis plants in planters, a bong on a side table',
  'old train station waiting room, wooden benches, dusty light through tall windows, a bong on the ticket counter',
  'basement workshop with power tools, pegboard walls, sawdust, a bong on the bench beside a half-built shelf',
  'greenhouse attached to a farmhouse, misting system, tomato vines, a bong on a stack of seed trays',
  'secluded hot spring at night, steam rising, snow on the rocks, a bong on a flat stone beside folded towels',
  'attic bedroom with sloped beams, string lights, record player, a bong on the floor beside a mattress',
  'abandoned observatory dome, telescope silhouette, dust motes in moonlight, a bong on the control desk',
  'tiki bar on a pier at midnight, torches, thatch roof, cannabis plants in barrels, a bong on the bamboo counter',
  'converted bank vault lounge, steel door open, led lighting, a bong on the polished floor beside cushions',
  'snowbound bus shelter on a mountain pass, glass walls, emergency light, a bong on the bench, snowfall outside',
];

export const GLASS_COLORS = [
  'vibrant neon green and purple accented',
  'deep electric blue and black gradient',
  'iridescent pink and gold shifting',
  'glowing UV reactive neon green',
  'translucent smoke gray with purple accents',
  'custom tie-dye colored glass',
  'classic crystal clear with gold lettering',
];

export const FLAVORED_WRAPS = [
  'honey bourbon Backwoods',
  'sweet aromatic Swisher Sweets',
  'classic White Owl blunts',
  'grape flavored blunt wraps',
  'natural leaf Backwoods',
  'strawberry fusion Swishers',
  'russian cream Backwoods',
  'tropical twist White Owls',
  'banana flavored blunt wraps',
];

export const SMOKING_HARDWARE_PROPS: Array<() => string> = [
  () => `rolling a joint with Raw papers and tips next to a massive ${getRandomItem(GLASS_COLORS)} beaker bong, with open packs of ${getRandomItem(FLAVORED_WRAPS)} and ${getRandomItem(FLAVORED_WRAPS)} on the table`,
  () => `packing a fat ${getRandomItem(FLAVORED_WRAPS)} blunt while a sleek ${getRandomItem(GLASS_COLORS)} straight tube bong bubbles nearby, surrounded by loose ${getRandomItem(FLAVORED_WRAPS)} wrappers`,
  () => `passing around a smooth-hitting ${getRandomItem(GLASS_COLORS)} bubbler filled with water, featuring a rotation of ${getRandomItem(FLAVORED_WRAPS)} and raw paper tips`,
  () => `taking a dab out of a complex ${getRandomItem(GLASS_COLORS)} dab rig featuring an intricate spinning recycler perc, with an ashtray holding smoked ${getRandomItem(FLAVORED_WRAPS)} remnants`,
  () => `smoking out of a heavy-duty ${getRandomItem(GLASS_COLORS)} hand pipe, surrounded by loose Raw papers, grinders, and open packs of ${getRandomItem(FLAVORED_WRAPS)} and ${getRandomItem(FLAVORED_WRAPS)}`,
  () => `breaking down sticky bud on a tray next to ${getRandomItem(FLAVORED_WRAPS)} wrappers, a lighter, and a bubbling ${getRandomItem(GLASS_COLORS)} beaker bong`,
];

/**
 * Background weed objects. These deliberately repeat whatever she may be holding,
 * but in another colour and another shape, so a pose with a bong in hand still gets
 * a bong in the room without the two being the same piece.
 */
export const BACKGROUND_WEED_PROPS: Array<() => string> = [
  () => `in the background a ${getRandomItem(GLASS_COLORS)} beaker bong sits on a low table beside a jar of cured buds and a loaded ashtray`,
  () => `behind her, a ${getRandomItem(GLASS_COLORS)} straight-tube bong and a row of mason jars of buds line the shelf`,
  () => `in the background a ${getRandomItem(GLASS_COLORS)} recycler dab rig and a grinder sit on a stack of rolling trays`,
  () => `behind her, a ${getRandomItem(GLASS_COLORS)} bubbler and open packs of ${getRandomItem(FLAVORED_WRAPS)} are scattered across a side table`,
  () => `in the background a heavy ${getRandomItem(GLASS_COLORS)} hand pipe rests on an ashtray next to a half-rolled blunt`,
  () => `behind her, a ${getRandomItem(GLASS_COLORS)} bong and a cluster of glass jars of top-shelf flower catch the light`,
  () => `in the background a long ${getRandomItem(GLASS_COLORS)} steamroller and a tipped-over jar of buds sit on a low crate`,
  () => `behind her, a ${getRandomItem(GLASS_COLORS)} gravity bong and a tangle of ${getRandomItem(FLAVORED_WRAPS)} wrappers sit on the floor`,
];

export const HIDDEN_TEAM_NO_LACKIN_ELEMENTS = [
  'a vintage military-style canvas flag hanging on the wall clearly bearing the bold stenciled text "Team No Lackin"',
  'a framed poster hanging in the background with clean typography reading "Team No Lackin"',
  'spray-painted graffiti art on a wall or surface in the room clearly spelling out "Team No Lackin"',
  'an embroidered decorative banner hanging across a shelf or mantelpiece with the words "Team No Lackin"',
  'a glowing neon wall sign casting ambient light and spelling out "Team No Lackin"',
  'a custom sticker slapped onto a rolling tray or storage box with legible text reading "Team No Lackin"',
  'a handwritten sticky note stuck to a computer monitor or tabletop with bold marker writing saying "Team No Lackin"',
  'a woven throw pillow on a couch featuring bold embroidered text that reads "Team No Lackin"',
  'a custom matchbox sitting on the table with crisp vintage branding reading "Team No Lackin"',
  'a brass plaque screwed onto a wooden shelf or box engraved with the words "Team No Lackin"',
  'a screen-printed graphic on a skateboard deck leaned up against the wall reading "Team No Lackin"',
  'chalkboard menu lettering on the wall cleanly written out to say "Team No Lackin"',
  'a custom pin badge attached to a clothing collar or bag strap reading "Team No Lackin"',
  'embossed metallic foil text stamped onto the cover of a rolling paper booklet reading "Team No Lackin"',
  'a neon light-box decoration resting on a bookshelf spelling out "Team No Lackin"',
];

export const CLOTHED_OUTFIT_OPTIONS = [
  'wearing matching custom streetwear hoodies and sweatpants patterned with green cannabis leaf prints, gold cannabis leaf pendant chains',
  'wearing casual loungewear with embroidered trichome-dusted cannabis patterns and snapback caps',
  'wearing relaxed jersey shorts and t-shirts featuring classic cannabis culture graphics',
  'wearing comfortable sleepwear decorated with weed leaf patterns and stoner graphics',
];

export const NUDE_BODY_DETAILS = [
  'completely nude, showing intricate full-sleeve cannabis botanical tattoos and weed leaf body art across arms, chest, and torso',
  'completely nude, showing full-sleeve cannabis botanical tattoos and weed leaf body art, natural body hair',
  'artfully draped in giant, dew-kissed cannabis fan leaves instead of clothes, natural and raw aesthetic',
];

export const HAIR_DYE_OPTIONS = ['dyed vibrant neon green', 'dyed vibrant electric purple', 'with natural colored hair'];

/**
 * Solid room lighting she can pick, from the app. Each phrase is the wording that
 * actually renders: SDXL resolves colour names, not hex, so the label is only for
 * the swatch. Kept to colours that survive a Pony checkpoint without wrecking skin.
 */
export type LightColor = { id: string; label: string; hex: string; phrase: string };

export const LIGHT_COLORS: LightColor[] = [
  { id: 'red', label: 'Red', hex: '#FF2D2D', phrase: 'deep red' },
  { id: 'orange', label: 'Orange', hex: '#FF7A1A', phrase: 'burnt orange' },
  { id: 'amber', label: 'Amber', hex: '#FFB000', phrase: 'warm amber' },
  { id: 'acid', label: 'Acid Green', hex: '#8CFF3D', phrase: 'acid green' },
  { id: 'emerald', label: 'Emerald', hex: '#1FD37A', phrase: 'emerald green' },
  { id: 'teal', label: 'Teal', hex: '#17E0C6', phrase: 'teal' },
  { id: 'cyan', label: 'Cyan', hex: '#2EC8FF', phrase: 'cyan' },
  { id: 'blue', label: 'Electric Blue', hex: '#2F6BFF', phrase: 'electric blue' },
  { id: 'violet', label: 'Violet', hex: '#8B5CFF', phrase: 'violet' },
  { id: 'magenta', label: 'Magenta', hex: '#FF2BD1', phrase: 'magenta' },
  { id: 'pink', label: 'Hot Pink', hex: '#FF4D9E', phrase: 'hot pink' },
  { id: 'white', label: 'Warm White', hex: '#FFE3BC', phrase: 'warm white' },
];

export function findLightColor(value?: string): LightColor | undefined {
  const v = (value ?? '').trim().toLowerCase();
  if (!v) return undefined;
  return LIGHT_COLORS.find((c) => c.id === v || c.label.toLowerCase() === v);
}

/** Lighting nouns that make the colour words in a clause worth stripping. */
const LIGHT_NOUN =
  /\b(light|lights|lighting|lit|glow|glowing|neon|led|laser|fairy|lantern|sconce|bulb|blacklight|moonlight|daylight|sunlight|sunset|sunrise|torch|campfire|crt|vu meter|mood lighting|accent lighting)\b/i;

const LIGHT_COLOUR_WORDS =
  /\b(purple|green|red|amber|yellow|blue|pink|teal|orange|violet|magenta|cyan|rainbow|multicolou?red)\b/gi;

const LIGHT_TEMPERATURE_WORDS = /\b(warm|cool|dim|low|soft|harsh)\b/gi;

/**
 * The room pool bakes in its own lighting ("glowing purple and green LED strip
 * lighting"). When she picks a colour those words have to go, or they win. We strip
 * colour and temperature words per comma-clause, and only in clauses that mention a
 * light source, so "amber mason jars" and "golden rolling trays" survive intact.
 */
export function stripBakedLighting(env: string): string {
  const clauses = env.split(',').map((clause) => {
    if (!LIGHT_NOUN.test(clause)) return clause.trim();
    let cleaned = clause
      .replace(LIGHT_COLOUR_WORDS, '')
      .replace(LIGHT_TEMPERATURE_WORDS, '')
      .replace(/\band\s*(?=,|$)/gi, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/\s+([,)])/g, '$1')
      .replace(/^\s*and\s+/i, '')
      .trim();
    return cleaned;
  });
  return clauses
    .map((c) => c.trim())
    .filter((c) => c.length > 0)
    .join(', ')
    .replace(/,\s*,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Outdoors reads better as an ambient wash than as strip lights along a ceiling. */
const OUTDOOR_ROOM =
  /\b(porch|patio|balcony|terrace|rooftop|forest|clearing|campsite|camp|backyard|garden|greenhouse|woods|deck|dock|yacht|oasis|field|trail)\b/i;

export function lightOverrideClause(env: string, colour: LightColor): string {
  if (OUTDOOR_ROOM.test(env)) {
    return `the whole scene washed in ${colour.phrase} light, everything tinted ${colour.phrase}, ${colour.phrase} ambient glow on her skin, ${colour.phrase} rim light along her body, no daylight`;
  }
  return `the whole room lit only by ${colour.phrase} LED strip lights running along the walls and ceiling, every surface washed in ${colour.phrase} light, ${colour.phrase} ambient glow on her skin, ${colour.phrase} rim light along her body, no daylight`;
}

export const HUSBAND_GROOMING_OPTIONS = [
  'chest hair trimmed into a cannabis leaf shape, neatly edged',
  'natural chest hair with a cannabis leaf shape shaved into it',
  'chest hair dyed vibrant neon green, shaped into a cannabis leaf',
  'chest hair dyed rich electric purple, trimmed low across the pecs',
  'chest hair grown out and shaped into a broad cannabis leaf',
];

export const WIFE_PUBIC_WEED_STYLES = [
  'pubic hair neatly trimmed into the precise shape of a cannabis leaf, close cropped',
  'pubic hair trimmed into a cannabis leaf shape, slightly grown out and soft',
  'full natural pubic bush shaped into a large cannabis leaf, edges sharply defined',
  'pubic hair with a clean cannabis leaf shape carved into the centre, natural length',
  'thick natural pubic hair trimmed into a bold cannabis leaf silhouette',
];

export function getRandomItem(arr: unknown[]): any {
  const item = arr[Math.floor(Math.random() * arr.length)];
  return typeof item === 'function' ? (item as () => unknown)() : item;
}


/** Subject anchor. Comes first so the model cannot fill the frame with scenery. */
const SUBJECT_ANCHOR: Record<SubjectMode, string> = {
  wife: '1girl, solo, nude woman, mid-thigh up, standing, looking at viewer',
  husband: '1man, solo, nude man, mid-thigh up, standing, looking at viewer',
  couple: '1girl and 1man, two people, nude couple, mid-thigh up, standing',
};

/** Medium tags placed immediately after the score tags, before anything else. */
const MEDIUM_FRONT: Record<BucketId, string> = {
  realism_composite: 'raw photo, 35mm photograph, photorealistic, detailed skin pores, natural eye size',
  realism_outfit_nsfw: 'raw photo, 35mm photograph, photorealistic, detailed skin pores, natural eye size',
  anime_2d_toon: 'source_anime, anime style, 2d cel shading, clean bold lineart, vibrant colors',
  toy_3d_sculpt: '3d render, octane render, studio product lighting, macro miniature photography',
  fine_art_medium: 'fine art masterpiece, authentic traditional media texture',
  framed_card: 'ornate vintage tarot card illustration, detailed occult line etching, parchment paper texture, gold-foil border frame',
  macro_object_embed: 'commercial product photography, professional studio lighting',
};

/** Keeps the model from zooming into a body close-up. */
const FRAMING_BY_BUCKET: Record<BucketId, string> = {
  realism_composite: ', cowboy shot, mid-thigh up framing, standing, thighs visible, room visible around her',
  realism_outfit_nsfw: ', cowboy shot, mid-thigh up framing, standing, thighs visible, room visible around her',
  anime_2d_toon: ', cowboy shot, mid-thigh up framing, standing, thighs visible, background visible around her',
  toy_3d_sculpt: ', mid-thigh up figure, standing, diorama visible around her',
  fine_art_medium: ', cowboy shot, mid-thigh up framing, standing, thighs visible, painted room visible around her',
  framed_card: ', centred mid-thigh up figure inside the card border, room visible around her',
  macro_object_embed: ', product shot framing, object centred in frame',
};

const WIDE_FRAMING =
  ', wide establishing shot, full room interior visible, subject standing to one side, environment prominent';

/** Same as SUBJECT_TAGS without the body-weight nudges, used in pose mode. */
export const SUBJECT_TAGS_PLAIN: Record<SubjectMode, string> = {
  wife: 'ashley, long straight cherry red hair falling past the shoulders, round wireframe glasses',
  husband: 'mbboi',
  couple: 'ashley with long straight cherry red hair wearing glasses and mbboi',
};

/** Pose pool: SFW and NSFW interleaved on purpose, one flat list. */
export const POSE_OPTIONS = [
  'leaning back with one arm raised, lighting a kief-dusted joint, flame at the tip',
  'sitting with legs crossed at the ankle, leaning back on her hands, a lit joint between her lips, smoke curling from the tip',
  'standing with her back to the viewer, a lit blunt tucked between two fingers at her side, looking over her shoulder',
  'sitting up on her heels, thighs apart, holding a glowing pink bong in one hand, the other between her legs',
  'lying on her back with her legs folded behind her head, a realistic skin-toned dildo inside her, one hand on its base, a lit joint between her lips, toes curled',
  'lying on her side with her head tipped back, hand between her thighs, mouth open, smoke curling from her lips, hair spilling',
  'crouched low with knees wide, a dildo between her thighs, one hand spreading herself, the other holding a lit joint hovering over the dildo, tongue out, heavy blush',
  'kneeling with her hands on her thighs, shoulders back, a lit blunt resting against her thigh, exhaling through her nose, smoke curling from her nostrils',
  'close-up on her face and shoulders, leaning forward, a kief-dusted joint in one hand, ash tipping, gazing away',
  'sitting with her legs folded to one side, hands on the ground, an open mason jar of buds, a pack of blunts, a dab rig and a small digital scale set down in front of her',
  'top-down overhead shot, lying on her back, arms above her head, a lit joint in one hand, smoke drifting up, legs toward the top of frame',
  'on her back viewed from directly above, her legs folded behind her head and spread toward the camera, a glass dildo inside her, a lit blunt resting on her stomach, mouth open',
  'sitting with her legs crossed at the ankle and spread wide, hand between her thighs, a grinder and a small digital scale resting on her stomach, biting her lip',
  'kneeling with her weight on her forearms, hips raised, a rolling tray and a small digital scale balanced on her lower back',
  'straddling, hips rolled forward, chest pushed out, a pink leather harness across her chest, green fuzzy handcuffs on her wrists, hands behind her head, eyes closed',
  'sitting with her knees together, a rolling tray with an Adventure Time print on her lap, hands between her knees',
  'lying back with her legs up over the edge, head hanging back, a lit joint hanging from her fingers, smoke drifting down',
  'lying back taking a selfie with a polaroid camera, holding it up, legs spread, other hand between her legs, grinning at the lens',
  'kneeling upright with a mason jar of buds in one hand, the other between her legs, head tipped back',
  'sitting with one leg folded under her, the other hanging down, licking a blunt closed, a lighter in her other hand',
  'sitting with her knees together, towel slipping, one knee raised, a glowing bong held to her lips mid-hit',
  'leaning over with both palms flat, a rolling tray of loose weed balanced on her ass, looking back over her shoulder',
  'crouching low on her heels, elbows on knees, a lighter in one hand, looking up at the viewer, tongue out, a little dirt on the soles of her feet',
  'lying back with one knee raised, arm behind her head, a pack of blunts resting on her chest below her collarbones',
  'kneeling with her back arched, both hands on her breasts, thighs apart, silk rope wrapped loosely around her waist, a dildo inside her, mouth open',
  'lying on her back, one knee raised high, hand between her legs, other arm above her head, a kief-dusted joint between her lips, smoke drifting, back arched',
  'reclining back, left leg down, right ankle resting on her left knee, a rolling tray balanced on her shin, her bare foot a little dirty',
  'standing on tiptoe, one hand braced high, the other wrapped around the realistic skin-toned dildo of a black strap-on harness, a black collar that reads BAD KITTY around her neck, body stretched long',
  'legs crossed, one elbow raised, chin resting on her hand, a lit joint tucked behind her ear',
  'on all fours, hips raised, looking back over her shoulder, a pink buttplug with a heart-shaped base, smirk, arched spine',
  'lying back with an ice cube melting on her stomach, one hand between her legs, eyes half closed, shivering',
  'kneeling upright with her hands clasped behind her neck, chest lifted, exhaling a long plume of smoke',
  'sunk low and sprawled back, legs splayed, an ashtray balanced on her stomach',
  'standing with her hands behind her back holding a lit joint, green fuzzy handcuffs on her wrists, chin lifted, defiant, smoke curling behind her',
  'crouched low, one hand lifting the lid of a wooden stash box, a grinder visible inside',
  'standing with her head tipped back, water running over her, wet hair',
  'kneeling with her chest low and hips high, one arm stretched forward, other hand between her legs, a leather crop resting across her back',
  'sitting with her elbows on her knees, chin in her hands, a lit joint between her fingers',
  'pulling her panties aside with one hand, the other between her legs, standing with legs apart',
  'bent over with her cheek down and hips raised, looking back at the camera, one hand between her legs, a ballgag hanging around her neck, the heart-shaped base of a buttplug showing',
  'sitting with her knees drawn up and open, elbows on her knees, two fingers at her mouth, a lip gloss tube in her other hand, watching the viewer',
  'crouched low with her arms around her knees, a pack of Backwoods in one hand',
  'sitting with her knees wide apart, leaning back on one hand, two fingers inside, a glass pipe between her lips, mouth open',
  'lying on her side, head propped on one hand, a lit blunt in the other resting on her hip, smoke curling',
  'lying on her stomach, hips raised, one hand underneath her, a polaroid camera in her other hand, face turned to the camera, biting her lip',
  'shot from a low angle near her feet, lying on her back, looking up at the camera, a lit joint between her lips, one knee raised, a little dirt on the soles of her feet',
  'sitting cross-legged with a bong balanced on her knee, a mason jar of buds between her crossed legs',
  'leaning back with one leg raised, wet skin, wet hair, hand between her thighs, the other holding a bong, water dripping',
  'standing with arms stretched overhead, body arched, blowing smoke upward from her mouth and nose, eyes closed',
  'kneeling with her arms folded across her chest, a lit blunt between two fingers, smoke drifting past her face',
  'sitting with her legs stretched out in front of her, a rolling tray and a small digital scale across her thighs, a lit joint in one hand, leaning back on the other',
  'sitting with her legs stretched wide, hands bound to her own ankles with green fuzzy handcuffs, leaning forward, bare feet with a little dirt on the soles',
  'kneeling with one knee up, forearm resting on it, a lit joint in that hand, the other hand down',
  'viewed from directly above, lying on her back, head toward the bottom of the frame, a rolling tray and a small digital scale resting on her stomach, body stretched out',
  'reclining with one leg raised and bent over the other, a mason jar of buds held against her chest, relaxed and unhurried',
  'standing, legs apart, a black leather strap-on harness with a realistic skin-toned dildo, one hand wrapped around it, the other sliding down her stomach, head tipped back, tongue out',
  'sitting with one knee up, elbow on the knee, chin on her hand, a pink bullet vibrator in her other hand between her legs, watching the viewer',
  'crouched on her toes, knees wide, one hand spreading herself, the other holding a lit joint to her lips, a little dirt on her toes, eyes locked on the viewer',
  'sitting with her knees up, head tipped back, blowing smoke from her lips, a lit joint in one hand',
  'sitting cross-legged, leaning forward, holding a glowing bong, a mason jar of buds beside her knee',
  'kneeling with her thighs apart, phone held up filming herself, other hand between her legs, grin',
  'curled up under a blanket, only her shoulders and knees showing',
  'lying on her side, top leg lifted high, holding her own ankle, a black collar that reads BAD KITTY around her neck, a bullet vibrator buzzing between her thighs, looking at viewer',
  'stretching on tiptoe, arms high, spine long, bare feet on tiptoe with a little dirt on the soles',
  'standing with her back arched, a lit blunt between two fingers, the other hand tugging her own hair',
  'lounging back propped on one elbow, legs relaxed, holding a dab rig, a mason jar of buds resting against her hip, looking at the viewer',
  'bent forward with hips high, looking back over her shoulder, a lit joint in her braced hand, tongue out',
  'lying diagonally, a lit joint in her loose hand, a bottle of body oil resting on her stomach, smoke drifting from her lips, skin slick with oil',
  'on all fours with her face close to the camera, hips high behind her, a leash trailing from her collar, mascara running down her cheeks, looking up at the viewer',
  'reclining with one leg raised over the other, lazily touching herself, a Coors Banquet stubby bottle in her other hand, oil shining on her skin',
  'standing with her weight on one hip, one hand in her hair, a lit joint in the other',
  'sitting with her knees drawn up and her back to the viewer, a grinder resting in her lap, glancing back over her shoulder',
  'sitting sideways, one leg dangling, shoulder leaned back, a lit joint in one hand, her dangling bare foot a little dirty',
  'lying on her side with her legs scissored wide, a dab rig in one hand, oil shining on her thighs, watching the viewer',
  'lying back with one arm over her eyes, a lit joint in that hand, the other arm across her stomach',
  'sitting with legs tucked, holding a mug',
  'leaning back with one knee bent, hip cocked, holding a lit joint',
  'kneeling upright, thighs apart, one hand pinching her nipple, the other between her legs, a silk blindfold over her eyes, a black collar around her neck, head tipped back',
  'sitting with both knees up, hugging her shins, a lit joint pinched between her fingers, bare feet with a little dirt on the soles',
  'leaning back, legs stretched out, ankles crossed, a lit joint between her fingers',
  'sitting with her knees bent and feet up, hands clasped behind her head, gently rocking, bare feet with a little dirt on the soles',
  'kneeling upright, hands resting on her thighs, leaning slightly back, a dab rig in one hand, exhaling a thick plume of smoke through her mouth and nose',
  'lying on her back with knees bent and feet flat, holding a bong up with both hands, smoke rising',
  'standing with her back arched, both hands in her hair, thighs pressed together, a sheer robe slipping off her shoulders, oily skin, eyes closed',
  'standing turned away, looking back over her shoulder, one hand reaching behind between her legs, tongue out',
  'sitting with her knees splayed wide, chest resting on her folded arms, a dab rig between two fingers',
  'sitting back on her heels, thighs apart, a pink bullet vibrator pressed against herself, a bottle of body oil in her other hand, oily skin, mouth open, eyes half closed',
  'lying back with both legs folded behind her head, a realistic skin-toned dildo inside her, eyes rolled back, tongue out, oily skin',
  'standing with one foot up, elbow on the knee, smoking a lit joint, smoke drifting past her face, a little dirt on the sole of the raised foot',
  'kneeling with one hand in her hair, a lit joint in the hand on her hip',
  'standing with one leg raised, hand between her thighs, the other hand holding a lit joint, smoke curling up',
  'lying back with her legs up and apart, a mason jar of buds balanced on her stomach, ankles crossed overhead, three fingers inside, head tipped back, dirty soles facing up',
  'lying on her stomach, chin propped on folded arms, bare feet up with a little dirt on the soles',
  'standing with her shoulders back and her chin lifted, a lit joint in one hand, a mason jar of buds in the other',
  'standing before her reflection in a tall mirror, palm flat on the glass, watching herself, the other hand wrapped around the realistic skin-toned dildo of a black strap-on harness',
  'sprawled out on her back, one arm above her head holding a bottle of body oil, oil pooling on her stomach, legs hanging loose, biting her lip, a dildo in the hand between her thighs',
  'sitting with her shoulders slumped and her chin on her chest, a lit joint dangling from her fingers, ash falling',
  'sitting back on one hip, one leg draped over the other, hand between her thighs, a dab rig in her other hand, smirk',
  'squatting deep over a suction-cup dildo, riding it hands-free, palms braced on her knees, mouth open, looking at the viewer',
  'half-kneeling with one knee up and the other down, a lit blunt between two fingers, smoke drifting past her face',
  'standing in profile with her back arched, a mason jar of buds held against her stomach, oily skin catching the light',
  'kneeling with her forehead resting on her folded arms and her hips up, a lit joint resting between her shoulder blades',
  'tying her hair up with both hands, a lit blunt tucked behind her ear, bare feet a little dirty',
  'sitting with her legs in a butterfly stretch, picking stems out of a sticky bud over a rolling tray on her lap, bits of leaf stuck to her thigh',
  'lying on her back with her knees drawn to her chest, a dab rig resting on her stomach, eyes closed',
  'standing with her weight on one leg, her other foot resting on her own ankle, a lit joint between her lips, oily skin',
  'sitting with her back arched and her palms planted behind her, a lit blunt hanging from her lips, smoke curling up her face',
  'leaning forward over an open bag of buds, breaking a cola apart with both hands over a rolling tray, a small digital scale beside it',
  'kneeling with her back to the viewer, a lit joint in one hand, glancing over her shoulder, bare feet with dirty soles',
  'standing with her arms crossed under her chest, a dab rig in one hand, smoke drifting from her nose',
  'lying on her side with one arm stretched overhead, a mason jar of buds in that hand, watching the viewer',
  'sitting with her knees wide and her elbows on them, breaking down a sticky bud on a tray balanced between her knees, a grinder beside her',
  'standing on tiptoe with her hands behind her head, a lit blunt between her lips, back arched',
  'crouched with one knee up, rolling a blunt on her thigh, an open pack of Backwoods beside her knee',
  'sitting with her legs folded to one side and her back turned, a dab rig in one hand, glancing back at the camera',
  'kneeling with a rolling tray balanced across her knees, rolling a joint, eyes closed, a lit one smoking in the ashtray beside her',
  'lying on her back with her legs crossed at the knee, a lit joint resting on her stomach, one arm behind her head',
  'standing with her hips forward and her back arched, a mason jar of buds held in both hands, oily skin',
  'sitting with her legs stretched wide and her hands behind her, a lit blunt between her lips, smoke curling around her face',
  'close-up on her hands rolling a blunt, a lit joint smoking in an ashtray beside her, a grinder just out of focus',
  'lying on her back with her legs folded behind her head, a realistic skin-toned dildo inside her, a dab rig in one hand, eyes half closed',
  'standing bent at the waist, looking back between her legs at the camera, a lit blunt between her lips, a black strap-on harness with a realistic skin-toned dildo hanging beneath her',
  'sitting back on her heels with her chest arched, the heart-shaped base of a pink buttplug showing between her cheeks, a black collar around her neck',
  'on all fours with her cheek down and hips raised, a lit joint between her lips, the heart-shaped base of a buttplug showing',
  'straddling the camera, looking down at the viewer, palms flat on her own thighs, a black strap-on harness with a realistic skin-toned dildo at her hips',
  'lying on her back with a bottle of body oil tipped over her chest, oil pooling on her stomach, one hand between her legs',
  'sitting with her legs in a V, pouring body oil down her stomach from a bottle, head tipped back, oily skin',
  'kneeling with a rolling tray between her thighs, breaking down a bud, one hand between her legs, a mason jar of buds beside her knee',
  'standing with one leg raised high, holding her own ankle, a lit joint in the other hand, oily skin, a dirty foot',
  'sitting with her knees wide, a small digital scale balanced on one thigh, one hand between her legs, biting her lip',
  'crouched low over a rolling tray, breaking down a bud, one hand between her legs, a lit joint smoking beside the tray',
  'viewed from between her legs, lying back with her legs folded behind her head, a suction-cup dildo inside her, a lit joint in one hand, oily skin',
  'kneeling upright with her hands behind her back, a lit blunt between her lips, a black collar around her neck, back arched',
  'lying on her back with her hips lifted off the ground, one hand between her legs, a lit joint resting on her stomach',
  'sitting back on one hip, one leg draped over the other, a mason jar of buds resting between her thighs, one hand between her legs',
  'standing with her legs apart and her back arched, looking back over her shoulder, the heart-shaped base of a buttplug showing, a black collar around her neck',
  'lying on her stomach with her hips raised, a dab rig in one hand, face turned to the camera, oily skin',
  'sitting with her back to the viewer and her legs spread, a lit joint in one hand, glancing back over her shoulder, the heart-shaped base of a buttplug showing',
  'crouched with a grinder in one hand, a rolling tray on the floor between her feet, the other hand spreading herself',
  'kneeling with her thighs apart, pouring body oil over her chest from a bottle, mouth open, oily skin',
  'lying on her back with one leg hooked over her arm, a lit blunt between her lips, smoke curling from her nose',
  'standing before the mirror, oily skin, a dab rig in one hand, watching her own reflection, one hand between her legs',
  'on all fours with her hips low and her shoulders down, breaking down a bud on a tray under her chest, oily skin, looking at the viewer',
  'sitting with one knee up, a black strap-on harness with a realistic skin-toned dildo at her hips, one hand wrapped around the shaft, tongue out',
  'standing with her back to the viewer, bent slightly at the waist, a lit blunt in one hand, the heart-shaped base of a buttplug showing',
  'kneeling upright with oily skin, a dab rig in one hand, smoke pouring from her mouth and nose',
  'sitting with her knees up and apart, rolling a blunt on her thigh, a grinder and scattered stems between her feet',
  'standing with her weight on one leg, a lit joint in one hand, the other between her thighs, bare feet a little dirty',
  'lying on her side with both knees pulled up and apart, a pink bullet vibrator in one hand, oily skin, the other behind her head',
  'kneeling over a suction-cup dildo, easing down onto it, hands on her own thighs, eyes closed',
];

/** Uniform draw. The pool is 3:2 SFW to NSFW by construction (59/39). */
export function pickRandomPose(): string {
  return getRandomItem(POSE_OPTIONS);
}

export function generateFinalOpenCodePayload(
  styleId: string,
  subject: SubjectMode,
  isNude: boolean,
  customBackground?: string,
  subjectTraits?: string,
  wide?: boolean,
  pose?: string,
  lightColor?: string
) {
  const style = STYLE_DEFINITIONS[styleId];
  if (!style) throw new Error(`Unknown style: ${styleId}`);
  const bucket = BUCKET_CONFIGS[style.bucket];

  // Universal environments: any room can be pushed into any of the 98 styles
  // natively, because the bucket basePrefix carries the medium.
  const rawEnv = customBackground?.trim() || getRandomItem(MASSIVE_AUTHENTIC_WEED_ENVIRONMENTS);
  // A chosen light colour replaces the room's baked-in lighting. realism_composite
  // is img2img from her photo, so its light comes from the source and is left alone.
  const chosenLight = style.bucket === 'realism_composite' ? undefined : findLightColor(lightColor);
  const env = chosenLight ? stripBakedLighting(rawEnv) : rawEnv;
  // A colour clause is only useful if it outranks the lighting already in the style
  // text ("moody bedroom lighting", "studio product lighting"), so those clauses go,
  // and the colour is weighted and placed before the medium's own descriptors.
  const mediumFront = chosenLight
    ? MEDIUM_FRONT[style.bucket]
        .split(',')
        .filter((clause) => !/\blighting\s*$/i.test(clause.trim()))
        .join(', ')
    : MEDIUM_FRONT[style.bucket];
  const hardwareProp = getRandomItem(SMOKING_HARDWARE_PROPS);
  const backgroundProp = getRandomItem(BACKGROUND_WEED_PROPS);
  const easterEgg = getRandomItem(HIDDEN_TEAM_NO_LACKIN_ELEMENTS);

  let bodyDetailPrompt = '';
  if (isNude) {
    const nudeBody = getRandomItem(NUDE_BODY_DETAILS);
    const pubicDye = getRandomItem(HAIR_DYE_OPTIONS);
    const wifePubic = getRandomItem(WIFE_PUBIC_WEED_STYLES);
    const husbandGrooming = getRandomItem(HUSBAND_GROOMING_OPTIONS);

    // Grooming is subject-specific: a wife-only render must not inherit his.
    // The dye belongs to the pubic styling only â€” head hair stays cherry red
    // from SUBJECT_TAGS.
    if (subject === 'wife') {
      bodyDetailPrompt = `, ${nudeBody}, wife intimate styling: ${wifePubic}, pubic hair ${pubicDye}`;
    } else if (subject === 'husband') {
      bodyDetailPrompt = `, completely nude man, natural body, husband ${husbandGrooming}, pubic styling: ${wifePubic}, pubic hair ${pubicDye}`;
    } else {
      bodyDetailPrompt = `, ${nudeBody}, husband ${husbandGrooming}, wife intimate styling: ${wifePubic}, pubic hair ${pubicDye}`;
    }
  } else {
    bodyDetailPrompt = `, ${getRandomItem(CLOTHED_OUTFIT_OPTIONS)}`;
  }

  // Subject first: with an empty latent the model will happily fill the frame
  // with scenery if the medium tags lead, so she is anchored at the very start.
  // One score-tag prefix only, then the medium, then her. Anime style tokens land
  // inside the first chunk instead of after the body description.
  const SCORE_TAGS = 'score_9, score_8_up, score_7_up';
  const styleText =
    style.bucket === 'anime_2d_toon'
      ? style.prompt.replace(/glossy blushed skin,?\s*/gi, '')
      : style.prompt;
  // Same reason as the medium: a style that names its own light would fight the pick.
  const styleTextLit = chosenLight
    ? styleText
        .split(',')
        .filter((clause) => !/\blighting\s*$/i.test(clause.trim()))
        .join(', ')
    : styleText;
  const lightLead = chosenLight
    ? `, (${lightOverrideClause(rawEnv, chosenLight)}:1.3)`
    : '';
  // Weed room and hardware sit early ï¿½ before the easter egg ï¿½ so they land inside
  // the first CLIP chunk instead of being buried at token 130.
  const traits = (subjectTraits ?? '').replace(/[\r\n\t]+/g, ' ').replace(/[{}]/g, '').trim().slice(0, 120);
  const poseAnchor = pose
    ? subject === 'couple'
      ? '1girl and 1man, two people, nude'
      : subject === 'husband'
        ? '1man, solo, nude man'
        : '1girl, solo, nude woman'
    : SUBJECT_ANCHOR[subject];
  const subjectTagText = pose
    ? `${SUBJECT_TAGS_PLAIN[subject]}, proportional body, moderate bust`
    : SUBJECT_TAGS[subject];
  const poseLead = pose ? `(${pose}:1.25), ` : '';
  const framingText = pose
    ? wide
      ? ', wide shot, full body in frame, the room visible around her'
      : ', full scene, environment visible around her'
    : wide
      ? WIDE_FRAMING
      : FRAMING_BY_BUCKET[style.bucket];
  const positive = `${SCORE_TAGS}, ${mediumFront}, ${poseLead}${poseAnchor}, ${subjectTagText}${lightLead}${traits ? `, ${traits}` : ''}${bodyDetailPrompt}, ${styleTextLit}, ${hardwareProp}, surrounded by ${env}, with ${easterEgg}, ${backgroundProp}${framingText}`;
  const negative = `${bucket.baseNegative}, no humans, empty scene, plants only, flowers only, no person, scenery only, plain background, gray background, simple background, freckles, freckled skin${chosenLight ? ', multicolored lighting, rainbow lighting, mixed color lighting, neutral lighting, white lighting, daylight' : ''}`;

  return {
    checkpoint: bucket.checkpoint,
    positive,
    negative,
    denoise: style.denoiseOverride ?? bucket.defaultDenoise,
    cfg: bucket.defaultCfg,
  };
}

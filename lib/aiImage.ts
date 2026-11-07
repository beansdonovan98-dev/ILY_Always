import { supabase } from '@/lib/supabase';

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function editImageWithAI(imageUrl: string, prompt: string): Promise<string> {
  const res = await fetch(imageUrl);
  const blob = await res.blob();
  const base64 = await blobToBase64(blob);

  const { data, error } = await supabase.functions.invoke('ai-image-edit', {
    body: { imageBase64: base64, prompt },
  });
  if (error) throw error;
  if (!data?.b64) throw new Error('No edited image returned');
  return `data:image/png;base64,${data.b64}`;
}
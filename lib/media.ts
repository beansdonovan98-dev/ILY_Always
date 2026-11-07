import { supabase } from '@/lib/supabase';

export type MediaKind = 'shared' | 'private';

export const MEDIA_BUCKETS: Record<MediaKind, string> = {
  shared: 'couple-media',
  private: 'couple-private',
};

export const MAX_MEDIA_BYTES = 60 * 1024 * 1024;

export interface MediaRow {
  id: string;
  couple_id: string;
  kind: MediaKind;
  storage_path: string;
  file_name: string;
  mime_type: string;
  byte_size: number;
  width: number | null;
  height: number | null;
  caption: string | null;
  captions: Record<string, string> | null;
  comments: Array<{ id: string; author: string; text: string; created_at: string }> | null;
  daily_date: string | null;
  uploaded_by: string;
  created_at: string;
}

export function resolveMime(asset: { mimeType?: string | null; fileName?: string | null; uri?: string | null }): string {
  if (asset.mimeType) return asset.mimeType;
  const name = asset.fileName || asset.uri || '';
  const ext = name.split('.').pop()?.toLowerCase().split('?')[0];
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
  };
  if (ext && map[ext]) return map[ext];
  return 'image/jpeg';
}

export function validateSize(byteSize: number): void {
  if (!Number.isFinite(byteSize) || byteSize <= 0) {
    throw new Error('Invalid file size.');
  }
  if (byteSize > MAX_MEDIA_BYTES) {
    throw new Error(`File is too large. Maximum size is 60 MB.`);
  }
}

export async function uploadMedia(params: {
  coupleId: string;
  kind: MediaKind;
  localUri: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  width?: number | null;
  height?: number | null;
  caption?: string | null;
  uploadedBy: string;
  dailyDate?: string | null;
}): Promise<MediaRow> {
  validateSize(params.byteSize);

  const bucket = MEDIA_BUCKETS[params.kind];
  const safeName = params.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${params.coupleId}/${params.kind}/${Date.now()}-${safeName}`;

  const response = await fetch(params.localUri);
  const blob = await response.blob();

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(storagePath, blob, { contentType: params.mimeType, upsert: false });

  if (uploadError) throw uploadError;

  const { data, error: insertError } = await supabase
    .from('media')
    .insert({
      couple_id: params.coupleId,
      kind: params.kind,
      storage_path: storagePath,
      file_name: params.fileName,
      mime_type: params.mimeType,
      byte_size: params.byteSize,
      width: params.width ?? null,
      height: params.height ?? null,
      caption: params.caption ?? null,
      captions: {},
      comments: [],
      daily_date: params.dailyDate ?? null,
      uploaded_by: params.uploadedBy,
    })
    .select()
    .single();

  if (insertError) {
    // best-effort cleanup
    await supabase.storage.from(bucket).remove([storagePath]);
    throw insertError;
  }
  return data as MediaRow;
}

export async function getSignedUrl(row: MediaRow, expiresIn = 3600): Promise<string> {
  const bucket = MEDIA_BUCKETS[row.kind];
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(row.storage_path, expiresIn);
  if (error || !data?.signedUrl) throw error || new Error('Failed to create signed URL');
  return data.signedUrl;
}

export async function deleteMedia(row: MediaRow): Promise<void> {
  const bucket = MEDIA_BUCKETS[row.kind];
  await supabase.storage.from(bucket).remove([row.storage_path]);
  const { error } = await supabase.from('media').delete().eq('id', row.id);
  if (error) throw error;
}

export async function updateCaption(rowId: string, partnerKey: string, text: string): Promise<void> {
  // Read current captions, merge own, never overwrite partner's.
  const { data, error } = await supabase.from('media').select('captions').eq('id', rowId).single();
  if (error) throw error;
  const current = (data?.captions || {}) as Record<string, string>;
  const next = { ...current, [partnerKey]: text };
  const { error: updError } = await supabase.from('media').update({ captions: next }).eq('id', rowId);
  if (updError) throw updError;
}
export async function updateMediaComments(mediaId: string, comments: MediaRow['comments']): Promise<void> {
  const { error } = await supabase.from('media').update({ comments }).eq('id', mediaId);
  if (error) throw error;
}


/** Max per file when embedding in onboarding JSON (~1.5 MB binary as base64). */
export const ONBOARDING_DOC_MAX_BYTES = 1_500_000;

export function isViewableDataUrl(url: string | undefined): boolean {
  if (!url?.startsWith('data:')) return false;
  return /^data:(image\/|application\/pdf)/i.test(url);
}

export function readFileAsDataUrl(file: File): Promise<{ dataUrl: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    if (file.size > ONBOARDING_DOC_MAX_BYTES) {
      reject(new Error(`File is too large (max ${Math.round(ONBOARDING_DOC_MAX_BYTES / 1024 / 1024)} MB).`));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) {
        reject(new Error('Could not read file.'));
        return;
      }
      resolve({ dataUrl, mimeType: file.type || 'application/octet-stream' });
    };
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.readAsDataURL(file);
  });
}

export function resolveNidPhotoView(
  nidPhotoMeta: unknown,
  documents?: { id: string; dataUrl?: string; mimeType?: string; fileName?: string }[],
): { label: string; dataUrl: string | null; mimeType: string | null } {
  const nidDoc = documents?.find((d) => d.id === 'nid' || d.id === 'photo');
  if (nidDoc?.dataUrl && isViewableDataUrl(nidDoc.dataUrl)) {
    return {
      label: nidDoc.fileName || 'National ID',
      dataUrl: nidDoc.dataUrl,
      mimeType: nidDoc.mimeType || null,
    };
  }
  if (nidPhotoMeta && typeof nidPhotoMeta === 'object') {
    const o = nidPhotoMeta as { file_name?: string; data_url?: string; thumb_data_url?: string; mime_type?: string };
    const url = o.data_url || o.thumb_data_url;
    if (url && isViewableDataUrl(url)) {
      return { label: o.file_name || 'National ID', dataUrl: url, mimeType: o.mime_type || null };
    }
    return { label: o.file_name || 'National ID', dataUrl: null, mimeType: null };
  }
  if (typeof nidPhotoMeta === 'string' && nidPhotoMeta.trim()) {
    return { label: nidPhotoMeta.trim(), dataUrl: null, mimeType: null };
  }
  return { label: '', dataUrl: null, mimeType: null };
}

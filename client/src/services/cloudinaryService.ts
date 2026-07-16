const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME ?? '';
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET ?? '';

export interface CloudinaryUploadResult {
  url: string;
  publicId: string;
  durationSec: number;
}

interface CloudinaryUploadApiResponse {
  secure_url: string;
  public_id: string;
  duration?: number;
  error?: { message: string };
}

/**
 * Upload a video file directly to Cloudinary using an unsigned upload preset.
 * The preset must be configured (in the Cloudinary dashboard) to allow
 * `resource_type: video` — image-only presets will reject this.
 */
export async function uploadVideo(file: File): Promise<CloudinaryUploadResult> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error(
      'Cloudinary is not configured. Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET.'
    );
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('resource_type', 'video');

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`,
    { method: 'POST', body: formData }
  );

  const data = (await response.json()) as CloudinaryUploadApiResponse;

  if (!response.ok || !data.secure_url) {
    throw new Error(data.error?.message || 'Video upload to Cloudinary failed.');
  }

  return {
    url: data.secure_url,
    publicId: data.public_id,
    durationSec: data.duration ?? 0,
  };
}

// src/lib/cloudinary.ts
// Upload a single File to Cloudinary via unsigned upload preset
// Returns the secure_url of the uploaded image

export async function uploadToCloudinary(file: File): Promise<string> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error(
      "Missing NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME or NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET in .env.local"
    );
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);
  formData.append("folder", "sokxay-issues");

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: "POST", body: formData }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `Upload failed: ${res.status}`);
  }

  const data = await res.json();
  return data.secure_url as string;
}

export async function uploadMultiple(
  files: File[],
  onProgress?: (done: number, total: number) => void
): Promise<string[]> {
  const urls: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const url = await uploadToCloudinary(files[i]);
    urls.push(url);
    onProgress?.(i + 1, files.length);
  }
  return urls;
}

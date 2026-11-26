/**
 * Compresses an image File on-device using an HTMLCanvasElement to stay under maxBytes (default 1 MB).
 */
export async function compressImageFile(file, maxBytes = 950 * 1024) {
  if (!file || !file.type.startsWith('image/') || file.size <= maxBytes) {
    return file;
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  let quality = 0.82;
  let blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  while (blob && blob.size > maxBytes && quality > 0.35) {
    quality -= 0.12;
    blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  }
  return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
}

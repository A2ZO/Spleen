import { AVATAR_SIZE_PX } from "@spleen/validators";

/**
 * Center-crops an image to a square and resizes it in the browser. Re-encoding also drops
 * EXIF metadata (GPS position...). WebP where supported, PNG otherwise (Safari).
 */
export async function squareImage(file: Blob, size = AVATAR_SIZE_PX): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D is not available.");
  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    size,
    size,
  );
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Encoding failed."))),
      "image/webp",
      0.9,
    ),
  );
}

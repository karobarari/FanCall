import fs from 'node:fs';
import path from 'node:path';
import { HttpError } from './errors';

const MAX_BYTES = 2 * 1024 * 1024; // 2MB, generous for a profile picture

const MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

// Configurable so a real deployment can point this at a mounted persistent
// disk; defaults to a folder next to wherever the process is run from,
// which is fine for local dev (single instance, no redeploy in between).
const UPLOADS_DIR =
  process.env.AVATAR_UPLOADS_DIR ?? path.join(process.cwd(), 'uploads', 'avatars');

export const AVATAR_UPLOADS_DIR = UPLOADS_DIR;

function filenamesFor(userId: string): string[] {
  return Object.values(MIME_TO_EXT).map((ext) => `${userId}.${ext}`);
}

// Accepts a data URL ("data:image/png;base64,...."), validates its declared
// mime type and decoded size, and writes it to disk keyed by user id
// (overwriting any previous upload of a different type too, so switching
// from a .png to a .jpg doesn't leave the old file behind). Returns the
// public path to serve it from, cache-busted so the browser doesn't keep
// showing a stale image after a re-upload with the same filename.
export function saveAvatarUpload(userId: string, dataUrl: string): string {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([a-zA-Z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new HttpError(400, 'Upload must be a PNG, JPEG, or WEBP image');

  const [, mime, base64] = match;
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length === 0) throw new HttpError(400, 'Empty image upload');
  if (buffer.length > MAX_BYTES) throw new HttpError(400, 'Image must be under 2MB');

  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  for (const filename of filenamesFor(userId)) {
    const filePath = path.join(UPLOADS_DIR, filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  const filename = `${userId}.${MIME_TO_EXT[mime]}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);

  return `/uploads/avatars/${filename}?v=${Date.now()}`;
}

export function deleteAvatarUpload(userId: string): void {
  for (const filename of filenamesFor(userId)) {
    const filePath = path.join(UPLOADS_DIR, filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
}

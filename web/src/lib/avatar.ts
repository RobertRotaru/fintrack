import type { User } from '@ft/core';
import { api } from './api';

/** Largest side of a stored profile photo, in pixels: sharp on retina at 256px, small on disk. */
const PHOTO_SIZE = 512;

interface UploadTicket {
  key: string;
  upload: { method: string; url: string; headers: Record<string, string>; maxBytes: number; expiresAt: string };
}

/** Centre-crops an image file to a square and re-encodes it (WebP where supported, else JPEG). */
export async function squarePhoto(file: File, size = PHOTO_SIZE): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('That file isn’t an image');
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('That image couldn’t be read');
  });
  const side = Math.min(bitmap.width, bitmap.height);
  const out = Math.min(size, side);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = out;
  canvas.getContext('2d')!.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, out, out);
  bitmap.close();
  const encode = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.86));
  const webp = await encode('image/webp');
  const blob = webp?.type === 'image/webp' ? webp : await encode('image/jpeg');
  if (!blob) throw new Error('That image couldn’t be processed');
  return blob;
}

/**
 * Uploads a profile photo without it ever touching the database:
 * 1. ask the API for a short-lived upload link, 2. PUT the file straight to
 * object storage, 3. tell the API to use the new key.
 */
export async function uploadAvatar(file: File): Promise<User> {
  const photo = await squarePhoto(file);
  const ticket = await api<UploadTicket>('/me/avatar/uploads', { body: { contentType: photo.type, size: photo.size } });
  // A plain fetch: no session header, the signed link is the permission (as with S3 / R2).
  const res = await fetch(ticket.upload.url, { method: ticket.upload.method, headers: ticket.upload.headers, body: photo }).catch(() => null);
  if (!res?.ok) throw new Error('The photo didn’t upload. Please try again.');
  return api<User>('/me/avatar', { method: 'PUT', body: { key: ticket.key } });
}

export const removeAvatar = () => api<User>('/me/avatar', { method: 'DELETE' });

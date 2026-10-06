import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { User } from '@ft/core';
import { api } from './api';
import { absoluteUrl } from './config';

/** Largest side of a stored profile photo: sharp at any avatar size, small to store. */
const PHOTO_SIZE = 512;

interface UploadTicket {
  key: string;
  upload: { method: string; url: string; headers: Record<string, string>; size: number; expiresAt: string };
}

/** Lets the person pick (and square-crop) a photo. Null when they cancel. */
export async function pickPhoto(source: 'library' | 'camera'): Promise<string | null> {
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 };
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('Allow camera access in Settings to take a photo.');
  }
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  return result.canceled ? null : (result.assets[0]?.uri ?? null);
}

/** Resizes to 512px and re-encodes as JPEG (well under 100 KB). */
async function prepare(uri: string): Promise<{ uri: string; type: string }> {
  const rendered = await ImageManipulator.manipulate(uri).resize({ width: PHOTO_SIZE }).renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
  return { uri: saved.uri, type: 'image/jpeg' };
}

/**
 * The same flow as the web app, so the photo never touches the database:
 * 1. ask the API for a short-lived upload link, 2. PUT the file straight to
 * storage (Cloudflare R2), 3. tell the API to use the new key.
 */
export async function uploadAvatar(uri: string): Promise<User> {
  const photo = await prepare(uri);
  const blob = await (await fetch(photo.uri)).blob();
  const ticket = await api<UploadTicket>('/me/avatar/uploads', { body: { contentType: photo.type, size: blob.size } });
  const target = absoluteUrl(ticket.upload.url)!;
  const res = await fetch(target, { method: ticket.upload.method, headers: ticket.upload.headers, body: blob }).catch(() => null);
  if (!res?.ok) throw new Error('The photo didn’t upload. Please try again.');
  return api<User>('/me/avatar', { method: 'PUT', body: { key: ticket.key } });
}

export const removeAvatar = () => api<User>('/me/avatar', { method: 'DELETE' });

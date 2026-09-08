import crypto from 'node:crypto';
import { getEnv } from './env';

export async function uploadTelegramPhotoToCloudinary(fileBuffer: Buffer, filename: string) {
  const env = getEnv();
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary belum dikonfigurasi. Kirim URL gambar sebagai alternatif.');
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const signatureBase = `folder=toko-online&timestamp=${timestamp}${env.CLOUDINARY_API_SECRET}`;
  const signature = crypto.createHash('sha1').update(signatureBase).digest('hex');
  const form = new FormData();
  form.set('file', new Blob([fileBuffer]), filename);
  form.set('api_key', env.CLOUDINARY_API_KEY);
  form.set('timestamp', String(timestamp));
  form.set('folder', 'toko-online');
  form.set('signature', signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: 'POST', body: form
  });
  if (!response.ok) throw new Error(`Cloudinary upload gagal: ${await response.text()}`);
  const json = await response.json() as { secure_url?: string };
  if (!json.secure_url) throw new Error('Cloudinary tidak mengembalikan secure_url.');
  return json.secure_url;
}

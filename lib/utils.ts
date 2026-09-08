import { z } from 'zod';

export function slugify(input: string) {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'produk';
}

export function rupiah(value: number | string | { toString(): string }) {
  const numeric = typeof value === 'number' ? value : Number(value.toString());
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(numeric);
}

export function normalizeIndonesiaPhone(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('08')) return `62${digits.slice(1)}`;
  if (digits.startsWith('8')) return `62${digits}`;
  if (digits.startsWith('62')) return digits;
  return digits;
}

export function isValidIndonesiaPhone(value: string) {
  return /^628\d{7,13}$/.test(normalizeIndonesiaPhone(value));
}

export function getBaseUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
}

export async function readJson<T>(request: Request): Promise<T> {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) throw new Error('Request body must be JSON.');
  return request.json() as Promise<T>;
}

export const productTypeSchema = z.enum(['DIGITAL', 'PHYSICAL']);
export const paymentStatusSchema = z.enum(['PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'COMPLETED', 'CANCELLED']);

export function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

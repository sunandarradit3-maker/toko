import { getEnv } from './env';

export function createAdminWhatsAppLink(orderCode: string, buyerName: string, totalPrice: number | string) {
  const env = getEnv();
  const message = [
    'Halo Admin, saya ingin mengirim bukti pembayaran.',
    `Order ID: ${orderCode}`,
    `Nama: ${buyerName}`,
    `Total: Rp${Number(totalPrice).toLocaleString('id-ID')}`,
    '',
    'Saya lampirkan bukti transfer di chat ini.'
  ].join('\n');

  return `https://wa.me/${env.WHATSAPP_ADMIN_NUMBER}?text=${encodeURIComponent(message)}`;
}

import { db } from './db';
import type { PaymentStatus } from '@/generated/prisma/client';

const transitions: Record<PaymentStatus, PaymentStatus[]> = {
  PENDING: ['PAID', 'CANCELLED'],
  PAID: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'COMPLETED', 'CANCELLED'],
  SHIPPED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: []
};

export function canTransition(from: PaymentStatus, to: PaymentStatus) {
  return transitions[from].includes(to);
}

export async function changeOrderStatus(params: {
  orderCode: string;
  status: PaymentStatus;
  adminTelegramId: string;
  shippingResi?: string;
}) {
  const result = await db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { orderCode: params.orderCode } });
    if (!order) throw new Error('Order tidak ditemukan.');
    if (!canTransition(order.paymentStatus, params.status)) {
      throw new Error(`Perubahan status ${order.paymentStatus} → ${params.status} tidak diizinkan.`);
    }
    if (params.status === 'SHIPPED' && order.productType !== 'PHYSICAL') {
      throw new Error('Produk digital tidak boleh diubah menjadi SHIPPED.');
    }
    if (params.status === 'SHIPPED' && !params.shippingResi) {
      throw new Error('Nomor resi wajib diisi untuk status SHIPPED.');
    }

    const updated = await tx.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: params.status,
        shippingResi: params.shippingResi || undefined,
        confirmedAt: params.status === 'PAID' ? new Date() : order.confirmedAt,
        confirmedByAdminTelegramId: params.status === 'PAID' ? params.adminTelegramId : order.confirmedByAdminTelegramId
      },
      include: { product: true }
    });

    if (params.status === 'CANCELLED' && order.paymentStatus !== 'CANCELLED') {
      if (order.productId) {
        await tx.product.update({
          where: { id: order.productId },
          data: { stock: { increment: order.qty } }
        });
      }
    }

    return updated;
  });

  return result;
}

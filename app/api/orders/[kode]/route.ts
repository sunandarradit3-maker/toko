import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { changeOrderStatus } from '@/lib/order';
import { getEnv, getTelegramAdminIds } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ kode: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { kode } = await params;
  const order = await db.order.findUnique({ where:{ orderCode:kode.toUpperCase() }, select:{ orderCode:true, productNameSnapshot:true, productType:true, qty:true, totalPrice:true, paymentStatus:true, paymentMethod:true, shippingResi:true, createdAt:true, confirmedAt:true } });
  if (!order) return NextResponse.json({ ok:false, message:'Order tidak ditemukan.' }, { status:404 });
  return NextResponse.json({ ok:true, order:{...order,totalPrice:Number(order.totalPrice)} });
}

export async function POST(request: Request, { params }: Params) {
  try {
    const env = getEnv();
    if (request.headers.get('x-admin-action-secret') !== env.ADMIN_ACTION_SECRET) return NextResponse.json({ ok:false, message:'Unauthorized.' }, { status:401 });
    const { kode } = await params;
    const body = z.object({ status:z.enum(['PAID','PROCESSING','SHIPPED','COMPLETED','CANCELLED']), adminTelegramId:z.string().regex(/^\d+$/), shippingResi:z.string().trim().min(5).max(80).optional() }).safeParse(await request.json());
    if (!body.success) return NextResponse.json({ ok:false, message:'Payload tidak valid.' }, { status:400 });
    if (!getTelegramAdminIds().has(body.data.adminTelegramId)) return NextResponse.json({ ok:false, message:'Admin Telegram tidak terdaftar.' }, { status:403 });
    if (body.data.status==='SHIPPED' && !body.data.shippingResi) return NextResponse.json({ ok:false, message:'Resi wajib untuk SHIPPED.' }, { status:400 });
    const order = await changeOrderStatus({ orderCode:kode.toUpperCase(), ...body.data });
    return NextResponse.json({ ok:true, order:{...order,totalPrice:Number(order.totalPrice)} });
  } catch(error) {
    return NextResponse.json({ ok:false, message:error instanceof Error?error.message:'Gagal mengubah status order.' }, { status:400 });
  }
}

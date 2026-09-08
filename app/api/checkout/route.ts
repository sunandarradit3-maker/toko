import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { notifyAdmins } from '@/lib/telegram';
import { isValidIndonesiaPhone, normalizeIndonesiaPhone, readJson } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  productId: z.coerce.number().int().positive(),
  qty: z.coerce.number().int().min(1).max(100),
  productType: z.enum(['DIGITAL', 'PHYSICAL']),
  paymentMethod: z.enum(['DANA', 'GOPAY', 'OVO']),
  buyerName: z.string().trim().min(2).max(100),
  buyerEmail: z.string().trim().email().max(254),
  buyerWhatsapp: z.string().trim().min(8).max(20),
  buyerAddress: z.string().trim().max(500).optional(),
  buyerProvince: z.string().trim().max(100).optional(),
  buyerCity: z.string().trim().max(100).optional(),
  buyerDistrict: z.string().trim().max(100).optional(),
  buyerSubdistrict: z.string().trim().max(100).optional(),
  buyerPostalCode: z.string().trim().regex(/^\d{5}$/).optional()
}).superRefine((value, ctx) => {
  if (!isValidIndonesiaPhone(value.buyerWhatsapp)) ctx.addIssue({ code: 'custom', path: ['buyerWhatsapp'], message: 'Nomor WhatsApp Indonesia tidak valid.' });
  const fields = ['buyerAddress','buyerProvince','buyerCity','buyerDistrict','buyerSubdistrict','buyerPostalCode'] as const;
  if (value.productType === 'PHYSICAL') for (const field of fields) if (!value[field]) ctx.addIssue({ code: 'custom', path: [field], message: 'Wajib diisi untuk barang fisik.' });
});

function makeOrderCode() {
  const date = new Date();
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}`;
  return `INV-${ymd}-${String(Math.floor(Math.random()*1000)).padStart(3,'0')}`;
}

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await readJson<unknown>(request));
    if (!parsed.success) return NextResponse.json({ ok:false, message:'Data checkout tidak valid.', errors:parsed.error.flatten() }, { status:400 });
    const data = parsed.data;
    const product = await db.product.findUnique({ where:{ id:data.productId } });
    if (!product) return NextResponse.json({ ok:false, message:'Produk tidak ditemukan.' }, { status:404 });
    if (data.productType !== product.type) return NextResponse.json({ ok:false, message:'Tipe produk berubah. Muat ulang halaman checkout.' }, { status:409 });
    if (product.type === 'PHYSICAL' && [data.buyerAddress,data.buyerProvince,data.buyerCity,data.buyerDistrict,data.buyerSubdistrict,data.buyerPostalCode].some(v=>!v)) return NextResponse.json({ ok:false, message:'Alamat lengkap wajib diisi untuk barang fisik.' }, { status:400 });

    for (let attempt=0; attempt<5; attempt++) {
      const orderCode = makeOrderCode();
      try {
        const order = await db.$transaction(async tx => {
          const reserved = await tx.product.updateMany({ where:{ id:product.id, stock:{ gte:data.qty } }, data:{ stock:{ decrement:data.qty } } });
          if (reserved.count !== 1) throw new Error('STOCK_NOT_ENOUGH');
          return tx.order.create({ data:{ orderCode, buyerName:data.buyerName, buyerEmail:data.buyerEmail.toLowerCase(), buyerWhatsapp:normalizeIndonesiaPhone(data.buyerWhatsapp), buyerAddress:product.type==='PHYSICAL'?data.buyerAddress:null, buyerProvince:product.type==='PHYSICAL'?data.buyerProvince:null, buyerCity:product.type==='PHYSICAL'?data.buyerCity:null, buyerDistrict:product.type==='PHYSICAL'?data.buyerDistrict:null, buyerSubdistrict:product.type==='PHYSICAL'?data.buyerSubdistrict:null, buyerPostalCode:product.type==='PHYSICAL'?data.buyerPostalCode:null, productType:product.type, productId:product.id, productNameSnapshot:product.name, unitPrice:product.price, qty:data.qty, totalPrice:Number(product.price)*data.qty, paymentStatus:'PENDING', paymentMethod:data.paymentMethod } });
        });
        await notifyAdmins(order);
        return NextResponse.json({ ok:true, orderCode:order.orderCode, totalPrice:Number(order.totalPrice) }, { status:201 });
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (message==='STOCK_NOT_ENOUGH') return NextResponse.json({ ok:false, message:'Stok tidak mencukupi.' }, { status:409 });
        if (typeof error==='object' && error && 'code' in error && (error as {code?:string}).code==='P2002') continue;
        throw error;
      }
    }
    return NextResponse.json({ ok:false, message:'Gagal membuat Order ID unik. Silakan coba lagi.' }, { status:503 });
  } catch (error) {
    console.error('checkout error', error);
    return NextResponse.json({ ok:false, message:'Terjadi kesalahan server. Silakan coba lagi.' }, { status:500 });
  }
}

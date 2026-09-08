import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getEnv, getTelegramAdminIds } from '@/lib/env';
import { changeOrderStatus } from '@/lib/order';
import { sendBuyerEmail } from '@/lib/email';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const schema=z.object({
  orderCode:z.string().regex(/^INV-\d{8}-\d{3}$/),
  status:z.enum(['PAID','PROCESSING','SHIPPED','COMPLETED','CANCELLED']),
  adminTelegramId:z.string().regex(/^\d+$/),
  shippingResi:z.string().trim().min(5).max(80).optional()
});

export async function POST(request:Request){
  try{
    const env=getEnv();
    if(request.headers.get('x-admin-action-secret')!==env.ADMIN_ACTION_SECRET) return NextResponse.json({ok:false,message:'Unauthorized.'},{status:401});
    const body=schema.safeParse(await request.json());
    if(!body.success) return NextResponse.json({ok:false,message:'Payload admin tidak valid.'},{status:400});
    if(!getTelegramAdminIds().has(body.data.adminTelegramId)) return NextResponse.json({ok:false,message:'Admin Telegram tidak terdaftar.'},{status:403});
    if(body.data.status==='SHIPPED'&&!body.data.shippingResi) return NextResponse.json({ok:false,message:'Resi wajib untuk SHIPPED.'},{status:400});
    const order=await changeOrderStatus(body.data);
    try{await sendBuyerEmail({to:order.buyerEmail,subject:`Update ${order.orderCode}: ${order.paymentStatus}`,html:`<p>Halo ${order.buyerName},</p><p>Status order <strong>${order.orderCode}</strong> sekarang <strong>${order.paymentStatus}</strong>.</p>${order.shippingResi?`<p>Resi: <strong>${order.shippingResi}</strong></p>`:''}`});}catch(emailError){console.error('buyer email failed',emailError);}
    return NextResponse.json({ok:true,order:{...order,totalPrice:Number(order.totalPrice)}});
  }catch(error){console.error('admin order action error',error);return NextResponse.json({ok:false,message:error instanceof Error?error.message:'Gagal mengubah status order.'},{status:400});}
}

export async function GET(){return NextResponse.json({ok:false,message:'Method not allowed.'},{status:405});}

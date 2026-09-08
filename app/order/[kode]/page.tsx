import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { db } from '@/lib/db';
import { createAdminWhatsAppLink } from '@/lib/whatsapp';
import { rupiah } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function OrderPage({ params }: { params: Promise<{ kode: string }> }) {
  const { kode } = await params;
  const order = await db.order.findUnique({ where: { orderCode: kode.toUpperCase() }, select: { orderCode: true, buyerName: true, totalPrice: true, paymentStatus: true, paymentMethod: true, productNameSnapshot: true, productType: true, qty: true } });
  if (!order) return <main className="min-h-screen bg-slate-50 px-5 py-12"><div className="mx-auto max-w-2xl"><Card className="p-8"><h1 className="text-2xl font-black">Order tidak ditemukan</h1><Link href="/" className="mt-5 inline-block font-semibold">← Kembali</Link></Card></div></main>;
  const wa = createAdminWhatsAppLink(order.orderCode, order.buyerName, Number(order.totalPrice));
  const label = order.paymentMethod === 'GOPAY' ? 'GoPay' : order.paymentMethod === 'OVO' ? 'OVO' : 'DANA';
  return <main className="min-h-screen bg-slate-50 px-5 py-10"><div className="mx-auto max-w-2xl"><Link href="/" className="text-sm font-semibold text-slate-600">← Kembali ke toko</Link><Card className="mt-6 p-7 md:p-9"><p className="text-sm text-slate-500">Order ID</p><h1 className="mt-1 text-3xl font-black">{order.orderCode}</h1><div className="mt-6 rounded-2xl bg-slate-950 p-5 text-white"><p className="text-sm text-slate-300">Total pembayaran</p><p className="mt-1 text-3xl font-black">{rupiah(Number(order.totalPrice))}</p></div><div className="mt-7"><p className="font-bold">Pembayaran via QRIS DANA Bisnis</p><p className="mt-2 text-sm leading-6 text-slate-600">Metode pilihan: <b>{label}</b>. Scan QRIS di bawah menggunakan aplikasi pembayaran yang kamu pilih.</p><div className="mt-4 rounded-2xl border border-slate-200 p-4"><p className="text-xs font-bold uppercase text-slate-500">QRIS DANA Bisnis</p>{process.env.PAYMENT_QRIS ? <img src={process.env.PAYMENT_QRIS} alt="QRIS DANA Bisnis" className="mx-auto mt-3 max-h-96 w-full object-contain" /> : <p className="mt-4 text-sm text-red-600">QRIS belum dikonfigurasi di environment.</p>}<p className="mt-3 text-center text-xs text-slate-500">Bayar tepat sebesar {rupiah(Number(order.totalPrice))}, lalu kirim bukti pembayaran.</p></div></div><a href={wa} target="_blank" rel="noreferrer" className="mt-7 block rounded-xl bg-green-600 px-5 py-3 text-center font-bold text-white hover:bg-green-700">Kirim Bukti ke WhatsApp</a><Link href={`/order/${order.orderCode}/tracking`} className="mt-3 block rounded-xl border border-slate-200 px-5 py-3 text-center font-semibold">Buka Tracking</Link></Card></div></main>;
}

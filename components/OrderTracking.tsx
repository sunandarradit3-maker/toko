'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { rupiah } from '@/lib/utils';

const labels: Record<string, string> = { PENDING: 'Menunggu Pembayaran', PAID: 'Pembayaran Dikonfirmasi', PROCESSING: 'Sedang Diproses', SHIPPED: 'Sudah Dikirim', COMPLETED: 'Selesai', CANCELLED: 'Dibatalkan' };

export function OrderTracking({ code }: { code: string }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(code)}`, { cache: 'no-store' });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.message || 'Order tidak ditemukan.');
      setData(json.order);
    } catch (err) { setError(err instanceof Error ? err.message : 'Gagal mengambil status order.'); }
    finally { setLoading(false); }
  }, [code]);

  useEffect(() => { load(); }, [load]);

  if (loading && !data) return <Card className="p-7 text-slate-600">Memuat tracking…</Card>;
  if (error) return <Card className="p-7"><p className="text-red-600">{error}</p><Button className="mt-4 bg-slate-950 text-white" onClick={load}>Coba lagi</Button></Card>;
  return <Card className="p-6 md:p-8">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div><p className="text-sm text-slate-500">Order ID</p><h1 className="text-2xl font-black">{data.orderCode}</h1></div>
      <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold">{labels[data.paymentStatus] || data.paymentStatus}</div>
    </div>
    <div className="mt-7 grid gap-4 sm:grid-cols-2">
      <Info label="Produk" value={`${data.productNameSnapshot} × ${data.qty}`} />
      <Info label="Tipe" value={data.productType} />
      <Info label="Total" value={rupiah(data.totalPrice)} />
      <Info label="Metode" value={data.paymentMethod} />
      <Info label="Dibuat" value={new Date(data.createdAt).toLocaleString('id-ID')} />
      <Info label="Resi" value={data.shippingResi || 'Belum tersedia'} />
    </div>
    <Button className="mt-7 border border-slate-200 bg-white text-slate-900 hover:bg-slate-50" onClick={load}>↻ Refresh status</Button>
  </Card>;
}
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-slate-100 bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 font-semibold text-slate-900">{value}</p></div>; }

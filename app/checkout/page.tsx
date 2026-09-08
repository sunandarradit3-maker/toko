'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckoutForm } from '@/components/CheckoutForm';

export default function CheckoutPage() {
  const params = useSearchParams();
  const id = params.get('product');
  const [product, setProduct] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) { setError('Produk checkout tidak dipilih.'); return; }
    fetch(`/api/products/${id}`, { cache: 'no-store' }).then(async (r) => { const j = await r.json(); if (!r.ok || !j.ok) throw new Error(j.message); setProduct(j.product); }).catch((e) => setError(e.message || 'Gagal memuat produk.'));
  }, [id]);

  return <main className="min-h-screen bg-slate-50 px-5 py-10"><div className="mx-auto max-w-3xl"><Link href="/" className="text-sm font-semibold text-slate-600">← Kembali ke toko</Link><h1 className="mt-5 text-3xl font-black">Checkout</h1><p className="mt-2 text-slate-600">Isi data pembeli sesuai jenis produk.</p>{error ? <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">{error}</div> : product ? <div className="mt-7"><CheckoutForm product={product} /></div> : <div className="mt-7 rounded-2xl border border-slate-200 bg-white p-7">Memuat produk…</div>}</div></main>;
}

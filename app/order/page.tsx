'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function OrderLookupPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  function submit(event: FormEvent) { event.preventDefault(); const clean = code.trim().toUpperCase(); if (clean) router.push(`/order/${encodeURIComponent(clean)}/tracking`); }
  return <main className="min-h-screen bg-slate-50 px-5 py-12"><div className="mx-auto max-w-lg"><Card className="p-7"><p className="text-sm font-bold uppercase tracking-wide text-slate-500">Tracking Order</p><h1 className="mt-2 text-3xl font-black">Cek status pesanan</h1><p className="mt-2 text-slate-600">Masukkan Order ID seperti INV-20260908-123.</p><form onSubmit={submit} className="mt-6 flex gap-3"><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="INV-YYYYMMDD-XXX" required /><Button className="shrink-0 bg-slate-950 text-white">Cari</Button></form></Card></div></main>;
}

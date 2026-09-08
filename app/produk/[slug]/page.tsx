import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { db } from '@/lib/db';
import { rupiah } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await db.product.findUnique({ where: { slug } });
  if (!product) notFound();
  const out = product.stock <= 0;
  return <main className="min-h-screen bg-slate-50 px-5 py-8"><div className="mx-auto max-w-5xl"><Link href="/" className="text-sm font-semibold text-slate-600">← Kembali</Link><Card className="mt-6 overflow-hidden"><div className="grid md:grid-cols-2"><div className="aspect-square bg-slate-100 md:aspect-auto">{product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="h-full min-h-80 w-full object-cover" /> : <div className="flex min-h-80 items-center justify-center text-slate-400">No image</div>}</div><div className="p-7 md:p-10"><div className="flex gap-2"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{product.type}</span><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">Stok {product.stock}</span></div><h1 className="mt-5 text-3xl font-black tracking-tight">{product.name}</h1><p className="mt-3 text-2xl font-black">{rupiah(Number(product.price))}</p><p className="mt-6 whitespace-pre-wrap leading-7 text-slate-600">{product.description}</p>{out ? <div className="mt-8 rounded-xl bg-slate-200 px-5 py-3 text-center font-bold text-slate-500">Stok habis</div> : <Link href={`/checkout?product=${product.id}`} className="mt-8 block w-full rounded-xl bg-slate-950 px-5 py-3 text-center font-bold text-white hover:bg-slate-800">Checkout sekarang</Link>}</div></div></Card></div></main>;
}

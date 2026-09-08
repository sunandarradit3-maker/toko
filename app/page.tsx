import Link from 'next/link';
import { ProductCard } from '@/components/ProductCard';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const products = await db.product.findMany({ orderBy: { createdAt: 'desc' } });
  return <main className="min-h-screen">
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <Link href="/" className="font-black tracking-tight">TOKO ONLINE</Link>
        <Link href="/order" className="text-sm font-semibold text-slate-600 hover:text-slate-950">Tracking Order</Link>
      </div>
    </header>
    <section className="mx-auto max-w-6xl px-5 pb-16 pt-14">
      <div className="max-w-2xl">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Digital & Physical Store</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">Belanja simpel. Konfirmasi pembayaran dengan cepat.</h1>
        <p className="mt-5 text-lg leading-8 text-slate-600">Pilih produk, checkout sesuai tipe barang, lalu pantau status pesanan dari satu Order ID.</p>
      </div>
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => <ProductCard key={product.id} product={product} />)}
      </div>
      {!products.length && <div className="mt-10 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">Belum ada produk.</div>}
    </section>
  </main>;
}

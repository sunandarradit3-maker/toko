import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { rupiah } from '@/lib/utils';

export function ProductCard({ product }: { product: { name: string; slug: string; type: string; price: unknown; stock: number; imageUrl: string | null } }) {
  return (
    <Link href={`/produk/${product.slug}`} className="group block">
      <Card className="overflow-hidden transition duration-200 group-hover:-translate-y-1 group-hover:shadow-lg">
        <div className="aspect-[4/3] overflow-hidden bg-slate-100">
          {product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center text-slate-400">No image</div>}
        </div>
        <div className="p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{product.type}</span>
            <span className="text-xs text-slate-500">Stok {product.stock}</span>
          </div>
          <h3 className="line-clamp-2 font-semibold text-slate-900">{product.name}</h3>
          <p className="mt-2 text-lg font-bold text-slate-950">{rupiah(Number(product.price))}</p>
        </div>
      </Card>
    </Link>
  );
}

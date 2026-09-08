import { OrderTracking } from '@/components/OrderTracking';

export default async function TrackingPage({ params }: { params: Promise<{ kode: string }> }) {
  const { kode } = await params;
  return <main className="min-h-screen bg-slate-50 px-5 py-12"><div className="mx-auto max-w-3xl"><OrderTracking code={kode} /></div></main>;
}

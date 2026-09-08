'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { rupiah } from '@/lib/utils';

type Product={id:number;name:string;type:'DIGITAL'|'PHYSICAL';price:number;stock:number};

export function CheckoutForm({product}:{product:Product}){
 const router=useRouter();
 const [qty,setQty]=useState(1);
 const [paymentMethod,setPaymentMethod]=useState<'DANA'|'GOPAY'|'OVO'>('DANA');
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 const [form,setForm]=useState({buyerName:'',buyerEmail:'',buyerWhatsapp:'',buyerAddress:'',buyerProvince:'',buyerCity:'',buyerDistrict:'',buyerSubdistrict:'',buyerPostalCode:''});
 const total=product.price*qty;
 const update=(key:keyof typeof form,value:string)=>setForm(p=>({...p,[key]:value}));
 async function submit(){
  setError('');setLoading(true);
  try{
   const response=await fetch('/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({productId:product.id,productType:product.type,qty,paymentMethod,...form})});
   const data=await response.json();
   if(!response.ok||!data.ok) throw new Error(data.message||'Checkout gagal.');
   router.push(`/order/${data.orderCode}`);
  }catch(err){setError(err instanceof Error?err.message:'Checkout gagal.');setLoading(false);}
 }
 return <Card className="p-5 md:p-7">
  <div className="mb-6 flex items-end justify-between gap-4 border-b border-slate-100 pb-5"><div><p className="text-sm text-slate-500">Produk</p><h2 className="text-xl font-bold">{product.name}</h2><p className="mt-1 text-slate-600">{rupiah(product.price)} / unit</p></div><div className="w-28"><label className="mb-1 block text-xs font-semibold text-slate-600">Qty</label><Select value={qty} onChange={e=>setQty(Number(e.target.value))}>{Array.from({length:Math.min(product.stock,10)},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</Select></div></div>
  <div className="grid gap-4 md:grid-cols-2"><Field label="Nama lengkap"><Input value={form.buyerName} onChange={e=>update('buyerName',e.target.value)} placeholder="Nama pembeli" /></Field><Field label="Email"><Input type="email" value={form.buyerEmail} onChange={e=>update('buyerEmail',e.target.value)} placeholder="nama@email.com" /></Field><Field label="WhatsApp"><Input inputMode="tel" value={form.buyerWhatsapp} onChange={e=>update('buyerWhatsapp',e.target.value)} placeholder="0812... / 62812..." /></Field></div>
  {product.type==='PHYSICAL'&&<div className="mt-5 grid gap-4 border-t border-slate-100 pt-5 md:grid-cols-2"><Field label="Alamat lengkap" full><Input value={form.buyerAddress} onChange={e=>update('buyerAddress',e.target.value)} placeholder="Nama jalan, nomor rumah, RT/RW" /></Field><Field label="Provinsi"><Input value={form.buyerProvince} onChange={e=>update('buyerProvince',e.target.value)} /></Field><Field label="Kota/Kabupaten"><Input value={form.buyerCity} onChange={e=>update('buyerCity',e.target.value)} /></Field><Field label="Kecamatan"><Input value={form.buyerDistrict} onChange={e=>update('buyerDistrict',e.target.value)} /></Field><Field label="Kelurahan/Desa"><Input value={form.buyerSubdistrict} onChange={e=>update('buyerSubdistrict',e.target.value)} /></Field><Field label="Kode pos"><Input inputMode="numeric" maxLength={5} value={form.buyerPostalCode} onChange={e=>update('buyerPostalCode',e.target.value)} /></Field></div>}
  <div className="mt-5 border-t border-slate-100 pt-5"><p className="text-sm font-semibold text-slate-700">Metode pembayaran</p><p className="mt-1 text-xs text-slate-500">Pembayaran menggunakan QRIS DANA Bisnis.</p><div className="mt-3 grid gap-3 sm:grid-cols-3">{([['DANA','DANA'],['GOPAY','GoPay'],['OVO','OVO']] as const).map(([value,label])=><label key={value} className={`cursor-pointer rounded-xl border p-4 transition ${paymentMethod===value?'border-slate-950 bg-slate-50 ring-1 ring-slate-950':'border-slate-200 hover:border-slate-400'}`}><input className="sr-only" type="radio" name="paymentMethod" value={value} checked={paymentMethod===value} onChange={()=>setPaymentMethod(value)} /><span className="block font-bold">{label}</span><span className="mt-1 block text-xs text-slate-500">Bayar dengan QRIS</span></label>)}</div></div>
  {product.type==='DIGITAL'&&<p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Produk digital dikirim secara manual setelah pembayaran dikonfirmasi admin.</p>}
  {error&&<p className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
  <div className="mt-6 flex flex-col gap-4 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm text-slate-500">Total pembayaran</p><p className="text-2xl font-black">{rupiah(total)}</p></div><Button disabled={loading} onClick={submit} className="bg-slate-950 text-white hover:bg-slate-800">{loading?'Memproses…':'Buat Pesanan'}</Button></div>
 </Card>;
}
function Field({label,children,full}:{label:string;children:React.ReactNode;full?:boolean}){return <label className={full?'md:col-span-2':''}><span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>{children}</label>}

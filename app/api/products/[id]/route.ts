import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const productId=Number(id);
  if(!Number.isInteger(productId)||productId<=0) return NextResponse.json({ok:false,message:'Produk tidak valid.'},{status:400});
  const product=await db.product.findUnique({where:{id:productId},select:{id:true,name:true,type:true,price:true,stock:true}});
  if(!product) return NextResponse.json({ok:false,message:'Produk tidak ditemukan.'},{status:404});
  return NextResponse.json({ok:true,product:{...product,price:Number(product.price)}});
}

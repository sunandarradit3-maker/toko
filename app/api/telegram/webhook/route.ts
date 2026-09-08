import { NextResponse } from 'next/server';
import { bot } from '@/lib/telegram';
import { getEnv } from '@/lib/env';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function POST(request:Request){
  try{
    const secret=getEnv().TELEGRAM_WEBHOOK_SECRET;
    if(secret && request.headers.get('x-telegram-bot-api-secret-token')!==secret) return NextResponse.json({ok:false},{status:401});
    await bot.handleUpdate(await request.json());
    return NextResponse.json({ok:true});
  }catch(error){
    console.error('telegram webhook error',error);
    return NextResponse.json({ok:false},{status:500});
  }
}

export async function GET(){return NextResponse.json({ok:true,message:'Telegram webhook endpoint is online.'});}

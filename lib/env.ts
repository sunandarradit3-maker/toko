import { z } from 'zod';

const envSchema=z.object({
 DATABASE_URL:z.string().min(1),
 TELEGRAM_BOT_TOKEN:z.string().min(1),
 TELEGRAM_ADMIN_IDS:z.string().min(1),
 WHATSAPP_ADMIN_NUMBER:z.string().regex(/^62\d{8,15}$/,'WHATSAPP_ADMIN_NUMBER must be an Indonesian number like 6281234567890'),
 NEXT_PUBLIC_SITE_URL:z.string().url(),
 PAYMENT_QRIS:z.string().url(),
 RESEND_API_KEY:z.string().optional(),
 EMAIL_FROM:z.string().optional(),
 CLOUDINARY_CLOUD_NAME:z.string().optional(),
 CLOUDINARY_API_KEY:z.string().optional(),
 CLOUDINARY_API_SECRET:z.string().optional(),
 ADMIN_ACTION_SECRET:z.string().min(24),
 TELEGRAM_WEBHOOK_SECRET:z.string().min(16)
});
let cached:z.infer<typeof envSchema>|null=null;
export function getEnv(){if(!cached) cached=envSchema.parse(process.env);return cached;}
export function getTelegramAdminIds():Set<string>{return new Set(getEnv().TELEGRAM_ADMIN_IDS.split(',').map(x=>x.trim()).filter(Boolean));}

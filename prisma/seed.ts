import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

const products = [
  { name: 'Contoh Produk Digital', slug: 'contoh-produk-digital', type: 'DIGITAL' as const, price: 150000, stock: 100, description: 'Produk digital contoh untuk pengujian checkout.', imageUrl: 'https://placehold.co/800x600/png?text=Digital' },
  { name: 'Contoh Produk Fisik', slug: 'contoh-produk-fisik', type: 'PHYSICAL' as const, price: 250000, stock: 20, description: 'Produk fisik contoh untuk pengujian alamat dan pengiriman.', imageUrl: 'https://placehold.co/800x600/png?text=Physical' }
];

async function main() {
  for (const product of products) await db.product.upsert({ where: { slug: product.slug }, update: product, create: product });
  const ids = (process.env.TELEGRAM_ADMIN_IDS || '').split(',').map((x) => x.trim()).filter(Boolean);
  for (const [index, telegramId] of ids.entries()) {
    await db.admin.upsert({ where: { telegramId }, update: {}, create: { telegramId, name: `Telegram Admin ${index + 1}`, role: index === 0 ? 'SUPER_ADMIN' : 'STAFF' } });
  }
}

main().finally(() => db.$disconnect());

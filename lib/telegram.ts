import { Bot, InlineKeyboard, type Context } from 'grammy';
import { db } from './db';
import { getEnv, getTelegramAdminIds } from './env';
import { rupiah, slugify } from './utils';
import { uploadTelegramPhotoToCloudinary } from './cloudinary';
import type { BotSessionKind, PaymentStatus, ProductType } from '@/generated/prisma/client';

const env = getEnv();
export const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

function isAdmin(ctx: Context) {
  const id = ctx.from?.id;
  return Boolean(id && getTelegramAdminIds().has(String(id)));
}

async function requireAdmin(ctx: Context) {
  if (!isAdmin(ctx)) {
    if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: 'Akses ditolak.', show_alert: true }).catch(() => undefined);
    else await ctx.reply('⛔ Akses ditolak.');
    return false;
  }
  return true;
}

async function ensureAdmin(telegramId: string, name: string) {
  const configured = Array.from(getTelegramAdminIds());
  const role = configured[0] === telegramId ? 'SUPER_ADMIN' : 'STAFF';
  await db.admin.upsert({
    where: { telegramId },
    update: { name },
    create: { telegramId, name, role }
  });
}

function formatOrder(order: any) {
  const address = order.productType === 'PHYSICAL'
    ? `\nAlamat: ${order.buyerAddress || '-'}, ${order.buyerSubdistrict || '-'}, ${order.buyerDistrict || '-'}, ${order.buyerCity || '-'}, ${order.buyerProvince || '-'} ${order.buyerPostalCode || ''}`
    : '';
  return [
    `🧾 <b>${order.orderCode}</b>`,
    `👤 ${escapeTelegram(order.buyerName)}`,
    `📧 ${escapeTelegram(order.buyerEmail)}`,
    `📱 ${escapeTelegram(order.buyerWhatsapp)}`,
    `📦 ${escapeTelegram(order.productNameSnapshot)} × ${order.qty}`,
    `🏷️ Tipe: <b>${order.productType}</b>`,
    `💰 Total: <b>${rupiah(order.totalPrice)}</b>`,
    `💳 Status: <b>${order.paymentStatus}</b>`,
    `💵 Metode: ${escapeTelegram(order.paymentMethod)}`,
    `🕐 ${new Date(order.createdAt).toLocaleString('id-ID')}`,
    address,
    order.shippingResi ? `🚚 Resi: <b>${escapeTelegram(order.shippingResi)}</b>` : ''
  ].filter(Boolean).join('\n');
}

function escapeTelegram(value: string) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function orderKeyboard(orderCode: string, status: PaymentStatus, productType: ProductType) {
  const kb = new InlineKeyboard();
  if (status === 'PENDING') kb.text('✅ Konfirmasi Lunas', `order:${orderCode}:PAID`).text('❌ Batalkan', `order:${orderCode}:CANCELLED`).row();
  if (status === 'PAID') kb.text('📦 Diproses', `order:${orderCode}:PROCESSING`).text('❌ Batalkan', `order:${orderCode}:CANCELLED`).row();
  if (status === 'PROCESSING' && productType === 'PHYSICAL') kb.text('🚚 Sudah Dikirim', `order:${orderCode}:SHIPPED`).row();
  if (status === 'PROCESSING' && productType === 'DIGITAL') kb.text('📧 Digital Terkirim', `order:${orderCode}:COMPLETED`).row();
  if (status === 'SHIPPED') kb.text('✅ Selesai', `order:${orderCode}:COMPLETED`).row();
  return kb;
}

async function sendOrderMessage(ctx: Context, order: any) {
  await ctx.reply(formatOrder(order), {
    parse_mode: 'HTML',
    reply_markup: orderKeyboard(order.orderCode, order.paymentStatus, order.productType)
  });
}

async function notifyAdmins(order: any) {
  const text = `🔔 <b>ORDER BARU</b>\n\n${formatOrder(order)}\n\nSilakan cek pembayaran secara manual sebelum menekan Konfirmasi Lunas.`;
  const keyboard = orderKeyboard(order.orderCode, order.paymentStatus, order.productType);
  for (const chatId of getTelegramAdminIds()) {
    try {
      await bot.api.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: keyboard });
    } catch (error) {
      console.error('Telegram notification failed', chatId, error);
    }
  }
}

export { notifyAdmins };

async function setSession(telegramId: string, kind: BotSessionKind, step: number, payload: Record<string, unknown>) {
  await db.botSession.upsert({
    where: { telegramId },
    update: { kind, step, payload: payload as any },
    create: { telegramId, kind, step, payload: payload as any }
  });
}

async function clearSession(telegramId: string) {
  await db.botSession.deleteMany({ where: { telegramId } });
}

async function handleSessionText(ctx: Context, text: string) {
  const telegramId = String(ctx.from!.id);
  const session = await db.botSession.findUnique({ where: { telegramId } });
  if (!session) return false;

  const payload = (session.payload || {}) as Record<string, unknown>;

  if (session.kind === 'SHIP_ORDER') {
    const resi = text.trim();
    if (!/^[A-Za-z0-9\-_.\/]{5,80}$/.test(resi)) {
      await ctx.reply('❗ Format resi tidak valid. Kirim hanya nomor resi (5–80 karakter).');
      return true;
    }
    const orderCode = String(payload.orderCode || '');
    try {
      await callOrderActionApi({ orderCode, status: 'SHIPPED', adminTelegramId: telegramId, shippingResi: resi });
      await clearSession(telegramId);
      await ctx.reply(`✅ ${orderCode} berhasil diubah ke SHIPPED.\nResi: ${resi}`);
      return true;
    } catch (error) {
      await ctx.reply(`❌ ${error instanceof Error ? error.message : 'Gagal memperbarui order.'}`);
      return true;
    }
  }

  if (session.kind === 'ADD_PRODUCT') {
    switch (session.step) {
      case 1:
        if (text.length < 2 || text.length > 120) { await ctx.reply('Nama produk 2–120 karakter. Coba lagi.'); return true; }
        await setSession(telegramId, session.kind, 2, { ...payload, name: text.trim() });
        await ctx.reply('2/6 — Tipe produk? Balas DIGITAL atau PHYSICAL.');
        return true;
      case 2: {
        const type = text.trim().toUpperCase();
        if (type !== 'DIGITAL' && type !== 'PHYSICAL') { await ctx.reply('Kirim DIGITAL atau PHYSICAL.'); return true; }
        await setSession(telegramId, session.kind, 3, { ...payload, type });
        await ctx.reply('3/6 — Harga dalam Rupiah, angka saja. Contoh: 150000');
        return true;
      }
      case 3: {
        const price = Number(text.replace(/[^\d.]/g, ''));
        if (!Number.isFinite(price) || price <= 0 || price > 1_000_000_000) { await ctx.reply('Harga harus angka > 0 dan maksimal Rp1 miliar.'); return true; }
        await setSession(telegramId, session.kind, 4, { ...payload, price });
        await ctx.reply('4/6 — Stok, angka bulat 0–1.000.000.');
        return true;
      }
      case 4: {
        const stock = Number(text.replace(/\D/g, ''));
        if (!Number.isInteger(stock) || stock < 0 || stock > 1_000_000) { await ctx.reply('Stok tidak valid.'); return true; }
        await setSession(telegramId, session.kind, 5, { ...payload, stock });
        await ctx.reply('5/6 — Deskripsi produk (maks 2.000 karakter).');
        return true;
      }
      case 5:
        if (!text.trim() || text.length > 2000) { await ctx.reply('Deskripsi wajib diisi dan maksimal 2.000 karakter.'); return true; }
        await setSession(telegramId, session.kind, 6, { ...payload, description: text.trim() });
        await ctx.reply('6/6 — Kirim URL gambar HTTPS. Contoh: https://cdn.example.com/produk.jpg\nAtau kirim foto produk langsung ke bot.');
        return true;
      case 6: {
        const imageUrl = text.trim();
        if (!/^https:\/\//i.test(imageUrl)) { await ctx.reply('URL gambar harus HTTPS.'); return true; }
        const product = await createProductFromPayload({ ...payload, imageUrl });
        await clearSession(telegramId);
        await ctx.reply(`✅ Produk dibuat.\nID: ${product.id}\nSlug: ${product.slug}`);
        return true;
      }
    }
  }

  if (session.kind === 'EDIT_PRODUCT') {
    const productId = Number(payload.productId);
    const field = String(payload.field || '');
    const product = await db.product.findUnique({ where: { id: productId } });
    if (!product) { await clearSession(telegramId); await ctx.reply('Produk tidak ditemukan.'); return true; }
    try {
      if (field === 'name') {
        if (text.length < 2 || text.length > 120) throw new Error('Nama 2–120 karakter.');
        const updated = await db.product.update({ where: { id: productId }, data: { name: text.trim(), slug: await uniqueSlug(slugify(text)) } });
        await ctx.reply(`✅ Nama diperbarui menjadi ${updated.name}.`);
      } else if (field === 'price') {
        const price = Number(text.replace(/[^\d.]/g, ''));
        if (!Number.isFinite(price) || price <= 0 || price > 1_000_000_000) throw new Error('Harga tidak valid.');
        await db.product.update({ where: { id: productId }, data: { price } });
        await ctx.reply('✅ Harga diperbarui.');
      } else if (field === 'stock') {
        const stock = Number(text.replace(/\D/g, ''));
        if (!Number.isInteger(stock) || stock < 0 || stock > 1_000_000) throw new Error('Stok tidak valid.');
        await db.product.update({ where: { id: productId }, data: { stock } });
        await ctx.reply('✅ Stok diperbarui.');
      } else if (field === 'description') {
        if (!text.trim() || text.length > 2000) throw new Error('Deskripsi tidak valid.');
        await db.product.update({ where: { id: productId }, data: { description: text.trim() } });
        await ctx.reply('✅ Deskripsi diperbarui.');
      } else if (field === 'imageUrl') {
        if (!/^https:\/\//i.test(text.trim())) throw new Error('URL harus HTTPS.');
        await db.product.update({ where: { id: productId }, data: { imageUrl: text.trim() } });
        await ctx.reply('✅ Gambar diperbarui.');
      }
      await clearSession(telegramId);
    } catch (error) {
      await ctx.reply(`❌ ${error instanceof Error ? error.message : 'Gagal menyimpan perubahan.'}`);
    }
    return true;
  }

  return true;
}

async function handlePhoto(ctx: Context) {
  if (!(await requireAdmin(ctx))) return;
  const telegramId = String(ctx.from!.id);
  const session = await db.botSession.findUnique({ where: { telegramId } });
  if (!session || session.kind !== 'ADD_PRODUCT' || session.step !== 6) {
    await ctx.reply('Tidak ada sesi tambah produk yang sedang menunggu foto.');
    return;
  }
  const photo = ctx.message?.photo?.at(-1);
  if (!photo) return;
  try {
    const file = await bot.api.getFile(photo.file_id);
    if (!file.file_path) throw new Error('Telegram file path tidak tersedia.');
    const fileUrl = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error('Gagal mengambil foto dari Telegram.');
    const buffer = Buffer.from(await response.arrayBuffer());
    const imageUrl = await uploadTelegramPhotoToCloudinary(buffer, `product-${Date.now()}.jpg`);
    const payload = (session.payload || {}) as Record<string, unknown>;
    const product = await createProductFromPayload({ ...payload, imageUrl });
    await clearSession(telegramId);
    await ctx.reply(`✅ Produk dibuat dari foto.\nID: ${product.id}\nSlug: ${product.slug}`);
  } catch (error) {
    await ctx.reply(`❌ ${error instanceof Error ? error.message : 'Upload foto gagal.'}`);
  }
}

async function createProductFromPayload(payload: Record<string, unknown>) {
  const name = String(payload.name || '');
  const type = String(payload.type || 'DIGITAL') as ProductType;
  const price = Number(payload.price);
  const stock = Number(payload.stock);
  const description = String(payload.description || '');
  const imageUrl = String(payload.imageUrl || '');
  return db.product.create({
    data: {
      name,
      slug: await uniqueSlug(slugify(name)),
      type,
      price,
      stock,
      description,
      imageUrl
    }
  });
}

async function uniqueSlug(base: string, excludeId?: number) {
  let slug = base;
  let counter = 2;
  while (true) {
    const existing = await db.product.findUnique({ where: { slug }, select: { id: true } });
    if (!existing || existing.id === excludeId) return slug;
    slug = `${base}-${counter++}`;
  }
}

bot.use(async (ctx, next) => {
  if (ctx.from && isAdmin(ctx)) await ensureAdmin(String(ctx.from.id), ctx.from.first_name + (ctx.from.last_name ? ` ${ctx.from.last_name}` : ''));
  await next();
});

bot.command('start', async (ctx) => {
  if (!(await requireAdmin(ctx))) return;
  await ctx.reply('🤖 Toko Admin siap.\n\n/pending\n/orders [STATUS]\n/stats\n/products\n/addproduct\n/editproduct ID\n/deleteproduct ID');
});

bot.command('pending', async (ctx) => {
  if (!(await requireAdmin(ctx))) return;
  const orders = await db.order.findMany({ where: { paymentStatus: 'PENDING' }, orderBy: { createdAt: 'desc' }, take: 25 });
  if (!orders.length) return ctx.reply('✅ Tidak ada order yang menunggu pembayaran.');
  for (const order of orders) await sendOrderMessage(ctx, order);
});

bot.command('orders', async (ctx) => {
  if (!(await requireAdmin(ctx))) return;
  const raw = ctx.match?.trim().toUpperCase();
  const valid = ['PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'COMPLETED', 'CANCELLED'];
  const where = raw && valid.includes(raw) ? { paymentStatus: raw as PaymentStatus } : {};
  const orders = await db.order.findMany({ where, orderBy: { createdAt: 'desc' }, take: 50 });
  if (!orders.length) return ctx.reply('Tidak ada order.');
  await ctx.reply(`📋 ${orders.length} order${raw ? ` dengan status ${raw}` : ''}.`);
  for (const order of orders.slice(0, 20)) await sendOrderMessage(ctx, order);
});

bot.command('stats', async (ctx) => {
  if (!(await requireAdmin(ctx))) return;
  const now = new Date();
  const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(dayStart); weekStart.setDate(dayStart.getDate() - 6);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const sums = await Promise.all([dayStart, weekStart, monthStart].map(async (start) => {
    const rows = await db.order.findMany({ where: { createdAt: { gte: start }, paymentStatus: { in: ['PAID', 'PROCESSING', 'SHIPPED', 'COMPLETED'] } }, select: { totalPrice: true } });
    return { count: rows.length, total: rows.reduce((sum, row) => sum + Number(row.totalPrice), 0) };
  }));
  await ctx.reply([
    '📊 <b>Statistik Penjualan</b>',
    `Hari ini: ${sums[0].count} order · ${rupiah(sums[0].total)}`,
    `7 hari: ${sums[1].count} order · ${rupiah(sums[1].total)}`,
    `Bulan ini: ${sums[2].count} order · ${rupiah(sums[2].total)}`
  ].join('\n'), { parse_mode: 'HTML' });
});

bot.command('products', async (ctx) => {
  if (!(await requireAdmin(ctx))) return;
  const products = await db.product.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
  if (!products.length) return ctx.reply('Belum ada produk.');
  for (const p of products) {
    const kb = new InlineKeyboard()
      .text('✏️ Edit nama', `product:${p.id}:name`)
      .text('💰 Harga', `product:${p.id}:price`).row()
      .text('📦 Stok', `product:${p.id}:stock`)
      .text('📝 Deskripsi', `product:${p.id}:description`).row()
      .text('🖼️ Gambar', `product:${p.id}:imageUrl`)
      .text('🗑️ Hapus', `product:${p.id}:delete`);
    await ctx.reply(`🛍️ <b>#${p.id} ${escapeTelegram(p.name)}</b>\n${p.type} · ${rupiah(p.price)} · stok ${p.stock}\n${escapeTelegram(p.slug)}`, { parse_mode: 'HTML', reply_markup: kb });
  }
});

bot.command('addproduct', async (ctx) => {
  if (!(await requireAdmin(ctx))) return;
  await setSession(String(ctx.from!.id), 'ADD_PRODUCT', 1, {});
  await ctx.reply('1/6 — Nama produk?\nKetik /cancel untuk membatalkan.');
});

bot.command('editproduct', async (ctx) => {
  if (!(await requireAdmin(ctx))) return;
  const id = Number(ctx.match?.trim());
  if (!Number.isInteger(id)) return ctx.reply('Gunakan: /editproduct ID');
  const p = await db.product.findUnique({ where: { id } });
  if (!p) return ctx.reply('Produk tidak ditemukan.');
  const kb = new InlineKeyboard()
    .text('Nama', `product:${id}:name`).text('Harga', `product:${id}:price`).row()
    .text('Stok', `product:${id}:stock`).text('Deskripsi', `product:${id}:description`).row()
    .text('Gambar', `product:${id}:imageUrl`);
  await ctx.reply(`Pilih field yang ingin diedit: <b>${escapeTelegram(p.name)}</b>`, { parse_mode: 'HTML', reply_markup: kb });
});

bot.command('deleteproduct', async (ctx) => {
  if (!(await requireAdmin(ctx))) return;
  const id = Number(ctx.match?.trim());
  if (!Number.isInteger(id)) return ctx.reply('Gunakan: /deleteproduct ID');
  const p = await db.product.findUnique({ where: { id } });
  if (!p) return ctx.reply('Produk tidak ditemukan.');
  const kb = new InlineKeyboard().text('✅ Ya, hapus', `product:${id}:confirm-delete`).text('Batal', `product:${id}:cancel-delete`);
  await ctx.reply(`⚠️ Hapus produk #${id} <b>${escapeTelegram(p.name)}</b>?`, { parse_mode: 'HTML', reply_markup: kb });
});

bot.command('cancel', async (ctx) => {
  if (!(await requireAdmin(ctx))) return;
  await clearSession(String(ctx.from!.id));
  await ctx.reply('✅ Sesi dibatalkan.');
});

bot.on('callback_query:data', async (ctx) => {
  if (!(await requireAdmin(ctx))) return;
  const data = ctx.callbackQuery.data;
  const parts = data.split(':');
  await ctx.answerCallbackQuery().catch(() => undefined);

  if (parts[0] === 'order' && parts.length === 3) {
    const [, orderCode, action] = parts;
    const statuses = new Set<PaymentStatus>(['PAID', 'PROCESSING', 'SHIPPED', 'COMPLETED', 'CANCELLED']);
    if (!statuses.has(action as PaymentStatus)) return;
    if (action === 'SHIPPED') {
      await setSession(String(ctx.from!.id), 'SHIP_ORDER', 1, { orderCode });
      await ctx.reply(`🚚 Masukkan nomor resi untuk ${orderCode}.`);
      return;
    }
    try {
      const order = await callOrderActionApi({
        orderCode,
        status: action as PaymentStatus,
        adminTelegramId: String(ctx.from!.id)
      });
      if (ctx.callbackQuery.message?.text) {
        await ctx.editMessageText(formatOrder(order), { parse_mode: 'HTML', reply_markup: orderKeyboard(order.orderCode, order.paymentStatus, order.productType) });
      }
    } catch (error) {
      await ctx.reply(`❌ ${error instanceof Error ? error.message : 'Gagal mengubah status.'}`);
    }
    return;
  }

  if (parts[0] === 'product' && parts.length === 3) {
    const productId = Number(parts[1]);
    const action = parts[2];
    const p = await db.product.findUnique({ where: { id: productId } });
    if (!p) return ctx.reply('Produk tidak ditemukan.');

    if (action === 'delete') {
      const kb = new InlineKeyboard().text('✅ Ya, hapus', `product:${productId}:confirm-delete`).text('Batal', `product:${productId}:cancel-delete`);
      await ctx.reply(`Konfirmasi hapus #${productId} <b>${escapeTelegram(p.name)}</b>?`, { parse_mode: 'HTML', reply_markup: kb });
      return;
    }
    if (action === 'confirm-delete') {
      await db.product.delete({ where: { id: productId } });
      await ctx.editMessageText(`🗑️ Produk #${productId} dihapus.`).catch(() => undefined);
      return;
    }
    if (action === 'cancel-delete') {
      await ctx.editMessageText('❎ Penghapusan dibatalkan.').catch(() => undefined);
      return;
    }
    if (['name', 'price', 'stock', 'description', 'imageUrl'].includes(action)) {
      await setSession(String(ctx.from!.id), 'EDIT_PRODUCT', 1, { productId, field: action });
      await ctx.reply(`Kirim nilai baru untuk field <b>${action}</b> pada produk #${productId}.`, { parse_mode: 'HTML' });
      return;
    }
  }
});

bot.on('message:photo', handlePhoto);
bot.on('message:text', async (ctx) => {
  if (!(await requireAdmin(ctx))) return;
  if (ctx.message.text.startsWith('/')) return;
  await handleSessionText(ctx, ctx.message.text);
});


async function callOrderActionApi(input: { orderCode: string; status: PaymentStatus; adminTelegramId: string; shippingResi?: string }) {
  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  const response = await fetch(`${base}/api/admin/order-action`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-admin-action-secret': env.ADMIN_ACTION_SECRET || ''
    },
    body: JSON.stringify(input)
  });
  const json = await response.json() as { ok: boolean; message?: string; order?: any };
  if (!response.ok || !json.ok || !json.order) throw new Error(json.message || 'Admin action gagal.');
  return json.order;
}


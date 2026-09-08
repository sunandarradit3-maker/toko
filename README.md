# Toko Online — Next.js + Prisma + PostgreSQL + Telegram Webhook

Toko online full-stack untuk barang **DIGITAL** dan **PHYSICAL** dengan admin panel sepenuhnya melalui **Telegram bot webhook**.

## Arsitektur

- Buyer: Next.js App Router + Tailwind CSS.
- Backend: Next.js Route Handlers di `app/api/*`.
- Database: PostgreSQL melalui Prisma ORM 7 + `@prisma/adapter-pg`.
- Admin: grammY webhook pada `POST /api/telegram/webhook`.
- Image storage: URL HTTPS atau upload foto Telegram ke Cloudinary (opsional).
- Payment: transfer manual BCA/Mandiri/BRI + QRIS.
- Buyer status email: Resend opsional.
- Deploy: Vercel.

## Struktur penting

```text
app/
  page.tsx
  checkout/page.tsx
  produk/[slug]/page.tsx
  order/page.tsx
  order/[kode]/page.tsx
  order/[kode]/tracking/page.tsx
  api/products/[id]/route.ts
  api/checkout/route.ts
  api/orders/[kode]/route.ts
  api/admin/order-action/route.ts
  api/telegram/webhook/route.ts
components/
  ProductCard.tsx
  CheckoutForm.tsx
  OrderTracking.tsx
  ui/*
lib/
  db.ts
  env.ts
  email.ts
  order.ts
  telegram.ts
  whatsapp.ts
  cloudinary.ts
  utils.ts
prisma/
  schema.prisma
  migrations/0001_init/migration.sql
  seed.ts
prisma.config.ts
```

## 1. Instalasi lokal

Prasyarat: Node.js 20+ (Node 24 juga cocok), PostgreSQL dan akun Telegram Bot.

```bash
npm install
cp .env.example .env.local
npm run db:generate
npm run db:migrate
npx tsx prisma/seed.ts
npm run dev
```

> `prisma generate` adalah bagian penting dari build Vercel karena Client Prisma harus dibuat berdasarkan schema terbaru.

## 2. Environment variables

Salin `.env.example` menjadi `.env.local`.

**Wajib**

```env
DATABASE_URL="postgresql://..."
TELEGRAM_BOT_TOKEN="..."
TELEGRAM_ADMIN_IDS="123456789,987654321"
WHATSAPP_ADMIN_NUMBER="6281234567890"
NEXT_PUBLIC_SITE_URL="https://domain-kamu.vercel.app"
PAYMENT_BCA="1234567890 a.n. Nama Toko"
PAYMENT_MANDIRI="1234567890 a.n. Nama Toko"
PAYMENT_BRI="1234567890 a.n. Nama Toko"
PAYMENT_QRIS="https://cdn.domain.com/qris.png"
ADMIN_ACTION_SECRET="random-secret-min-24-chars"
TELEGRAM_WEBHOOK_SECRET="random-secret-min-16-chars"
```

**Opsional**

```env
RESEND_API_KEY="re_..."
EMAIL_FROM="Toko Online <noreply@domain.com>"
CLOUDINARY_CLOUD_NAME="..."
CLOUDINARY_API_KEY="..."
CLOUDINARY_API_SECRET="..."
```

`ADMIN_ACTION_SECRET` digunakan antara Telegram webhook handler dan endpoint `/api/admin/order-action`. Jangan pernah ditaruh di kode frontend.

## 3. Database PostgreSQL

### Opsi A — Neon

Buat database PostgreSQL di Neon lalu salin connection string ke `DATABASE_URL`.

```bash
npm run db:generate
npm run db:migrate
npx tsx prisma/seed.ts
```

Neon/Prisma Postgres cocok dengan workload serverless karena koneksi dapat dipooling; gunakan koneksi pooled untuk runtime bila provider menyediakannya.

### Opsi B — Supabase

Buat project PostgreSQL di Supabase lalu gunakan connection string PostgreSQL yang sesuai untuk runtime. Untuk migrasi, gunakan koneksi yang diizinkan oleh project Supabase dan jalankan `prisma migrate deploy` dari CI/local.

Schema utama dibuat pada `prisma/schema.prisma` dan migration awal ada pada `prisma/migrations/0001_init/migration.sql`.

## 4. Seed

`prisma/seed.ts` membuat dua produk contoh dan mendaftarkan ID Telegram yang ada di `TELEGRAM_ADMIN_IDS`.

Admin pertama pada list env akan diberi role `SUPER_ADMIN`; admin berikutnya `STAFF`.

## 5. Buat bot Telegram

1. Buka `@BotFather` di Telegram.
2. Jalankan `/newbot`.
3. Simpan token bot ke `TELEGRAM_BOT_TOKEN`.
4. Masukkan Telegram numeric user ID admin ke `TELEGRAM_ADMIN_IDS`.
5. Deploy ke Vercel.
6. Setelah URL produksi aktif, set webhook:

```bash
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://domain-kamu.vercel.app/api/telegram/webhook",
    "secret_token": "GANTI_DENGAN_TELEGRAM_WEBHOOK_SECRET",
    "allowed_updates": ["message","callback_query"]
  }'
```

Untuk cek:

```bash
curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
```

Jangan gunakan polling (`bot.start()`) pada deployment Vercel. Webhook akan masuk ke Route Handler dan diproses pada invocation serverless.

## 6. Command admin

```text
/pending
/orders
/orders PAID
/orders PROCESSING
/orders SHIPPED
/orders COMPLETED
/orders CANCELLED
/stats
/products
/addproduct
/editproduct ID
/deleteproduct ID
/cancel
```

### `/addproduct`

Bot menjalankan wizard 6 tahap:

1. Nama
2. `DIGITAL` / `PHYSICAL`
3. Harga
4. Stok
5. Deskripsi
6. URL gambar HTTPS atau foto Telegram

State wizard disimpan pada tabel `bot_sessions`, bukan memory Node.js, sehingga aman saat invocation berpindah instance.

Jika mengirim foto Telegram, bot akan mencoba upload ke Cloudinary. Tanpa konfigurasi Cloudinary, gunakan URL gambar HTTPS.

### `/editproduct ID`

Bot menampilkan inline keyboard untuk mengubah:

- Nama
- Harga
- Stok
- Deskripsi
- Gambar

### `/deleteproduct ID`

Bot meminta konfirmasi inline. Karena `orders.productId` memakai `ON DELETE SET NULL` dan order menyimpan snapshot nama/harga, histori order tidak hilang jika produk dihapus.

## 7. Workflow checkout

1. Buyer membuka `/` dan memilih produk.
2. Buyer diarahkan ke `/checkout?product=ID`.
3. Backend memvalidasi email, WhatsApp Indonesia, tipe produk dan alamat bila `PHYSICAL`.
4. Stok dikurangi secara atomik dalam transaction.
5. Order dibuat dengan `INV-YYYYMMDD-XXX` dan status `PENDING`.
6. Bot menerima notifikasi order baru.
7. Buyer diarahkan ke `/order/INV-...`.
8. Halaman order menampilkan rekening BCA/Mandiri/BRI dan QRIS.
9. Tombol WhatsApp membuat pesan dengan Order ID, nama dan total harga.
10. Admin cek mutasi rekening secara manual lalu klik `✅ Konfirmasi Lunas`.
11. Bot memanggil `/api/admin/order-action` dengan secret internal.
12. Status menjadi `PAID` dan email buyer dikirim bila Resend dikonfigurasi.
13. Barang digital: admin bisa mengubah `PROCESSING` → `COMPLETED` setelah produk/link/kode dikirim.
14. Barang fisik: admin mengubah `PROCESSING` → `SHIPPED`, bot meminta resi, lalu status dapat ditutup ke `COMPLETED`.

## 8. Security model

- Semua admin command/callback memeriksa `TELEGRAM_ADMIN_IDS`.
- Endpoint `order-action` memerlukan `X-Admin-Action-Secret` dan Telegram ID yang terdaftar.
- Tracking publik hanya mengembalikan data yang diperlukan untuk tracking; email, nomor WA dan alamat buyer tidak diekspos.
- Input checkout divalidasi menggunakan Zod.
- Order code memiliki unique constraint database.
- Stock reservation dilakukan menggunakan conditional `UPDATE` di transaction untuk menghindari overselling sederhana.
- Tidak ada polling atau worker permanen.
- Secret hanya dibaca dari environment variable.

## 9. Deploy ke Vercel

1. Push repository ke GitHub.
2. Import project ke Vercel.
3. Tambahkan semua env variable pada **Settings → Environment Variables**.
4. Pastikan `NEXT_PUBLIC_SITE_URL` sudah memakai domain production.
5. Deploy.
6. Jalankan migration production dari environment yang memiliki akses database:

```bash
npx prisma migrate deploy
```

7. Set webhook Telegram ke URL production.

Vercel mendeploy file route di `app/api` sebagai Functions, sesuai model Route Handler Next.js.

## 10. Automatic WhatsApp buyer notification

Sesuai spesifikasi ini, WhatsApp digunakan melalui `wa.me` untuk pengiriman bukti pembayaran ke admin. Pengiriman WhatsApp otomatis dari server ke buyer memerlukan provider/WhatsApp Cloud API dan kredensial tambahan; kode saat ini sengaja tidak mengarang integrasi API yang belum dikonfigurasi.

## 11. Catatan produksi

- Tambahkan rate limiting/WAF di depan checkout bila trafik publik tinggi.
- Tambahkan idempotency key jika checkout akan menerima retry dari client/proxy yang agresif.
- Untuk settlement yang benar-benar otomatis, ganti transfer manual dengan payment gateway webhook yang terverifikasi signature-nya.
- Untuk pengiriman digital, sebaiknya tambahkan tabel entitlement/delivery log bila produk digital perlu delivery audit trail.

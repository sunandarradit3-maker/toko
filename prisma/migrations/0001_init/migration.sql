CREATE TYPE "ProductType" AS ENUM ('DIGITAL', 'PHYSICAL');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'STAFF');
CREATE TYPE "BotSessionKind" AS ENUM ('ADD_PRODUCT', 'EDIT_PRODUCT', 'SHIP_ORDER');

CREATE TABLE "users" (
  "id" SERIAL NOT NULL,
  "telegram_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "whatsapp" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_telegram_id_key" ON "users"("telegram_id");

CREATE TABLE "products" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "type" "ProductType" NOT NULL,
  "price" DECIMAL(14,2) NOT NULL,
  "stock" INTEGER NOT NULL,
  "description" TEXT NOT NULL,
  "image_url" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");
CREATE INDEX "products_type_idx" ON "products"("type");
CREATE INDEX "products_created_at_idx" ON "products"("created_at");

CREATE TABLE "orders" (
  "id" SERIAL NOT NULL,
  "order_code" TEXT NOT NULL,
  "buyer_name" TEXT NOT NULL,
  "buyer_email" TEXT NOT NULL,
  "buyer_whatsapp" TEXT NOT NULL,
  "buyer_address" TEXT,
  "buyer_province" TEXT,
  "buyer_city" TEXT,
  "buyer_district" TEXT,
  "buyer_subdistrict" TEXT,
  "buyer_postal_code" TEXT,
  "product_type" "ProductType" NOT NULL,
  "product_id" INTEGER,
  "product_name_snapshot" TEXT NOT NULL,
  "unit_price" DECIMAL(14,2) NOT NULL,
  "qty" INTEGER NOT NULL,
  "total_price" DECIMAL(14,2) NOT NULL,
  "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "payment_method" TEXT NOT NULL DEFAULT 'MANUAL_TRANSFER',
  "payment_proof_url" TEXT,
  "shipping_resi" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confirmed_at" TIMESTAMP(3),
  "confirmed_by_admin_telegram_id" TEXT,
  CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "orders_order_code_key" ON "orders"("order_code");
CREATE INDEX "orders_payment_status_idx" ON "orders"("payment_status");
CREATE INDEX "orders_created_at_idx" ON "orders"("created_at");
CREATE INDEX "orders_buyer_email_idx" ON "orders"("buyer_email");

CREATE TABLE "admins" (
  "id" SERIAL NOT NULL,
  "telegram_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" "AdminRole" NOT NULL DEFAULT 'STAFF',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "admins_telegram_id_key" ON "admins"("telegram_id");

CREATE TABLE "bot_sessions" (
  "id" SERIAL NOT NULL,
  "telegram_id" TEXT NOT NULL,
  "kind" "BotSessionKind" NOT NULL,
  "step" INTEGER NOT NULL DEFAULT 1,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "bot_sessions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "bot_sessions_telegram_id_key" ON "bot_sessions"("telegram_id");
CREATE INDEX "bot_sessions_updated_at_idx" ON "bot_sessions"("updated_at");

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

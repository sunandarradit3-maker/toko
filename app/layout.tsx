import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Toko Online',
  description: 'Toko online dengan pembayaran QRIS DANA Bisnis dan admin Telegram.'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}

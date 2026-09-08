import { getEnv } from './env';

export async function sendBuyerEmail(params: { to: string; subject: string; html: string }) {
  const env = getEnv();
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return { skipped: true } as const;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [params.to], subject: params.subject, html: params.html })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Email provider error: ${detail.slice(0, 300)}`);
  }

  return { skipped: false } as const;
}

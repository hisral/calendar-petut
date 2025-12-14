import { Context } from 'hono';
import { getCookie } from 'hono/cookie';
import { Bindings } from './bindings';

export async function hashPassword(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const formatRupiah = (number: number) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number);
};

export async function getSession(c: Context<{ Bindings: Bindings }>) {
  const sessionId = getCookie(c, 'session_id');
  if (!sessionId) return null;
  const userDataString = await c.env.SESSION_KV.get(sessionId);
  if (!userDataString) return null;
  return JSON.parse(userDataString);
}

// Helper Baru: Cek apakah user boleh nulis (Admin & Contributor)
export function canWrite(user: any) {
    return user && (user.role === 'admin' || user.role === 'contributor');
}

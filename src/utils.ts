import { Context } from 'hono';
import { getCookie } from 'hono/cookie';
import { Bindings } from './bindings';

// Enkripsi Password SHA-256
export async function hashPassword(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Format Rupiah
export const formatRupiah = (number: number) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number);
};

// Ambil Session User
export async function getSession(c: Context<{ Bindings: Bindings }>) {
  const sessionId = getCookie(c, 'session_id');
  if (!sessionId) return null;
  const userDataString = await c.env.SESSION_KV.get(sessionId);
  if (!userDataString) return null;
  return JSON.parse(userDataString);
}

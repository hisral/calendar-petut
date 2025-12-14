import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { html } from 'hono/html';
import { Bindings } from '../bindings';
import { Layout } from '../layout';
import { getSession, hashPassword } from '../utils';

const app = new Hono<{ Bindings: Bindings }>();

// Login & Home Redirect (Sama seperti sebelumnya)
app.get('/', async (c) => {
  const session = await getSession(c);
  if (session) return c.redirect('/home');
  return c.html(Layout(html`
    <div class="flex items-center justify-center h-full w-full bg-[#f8fafc] px-4">
      <div class="w-full max-w-sm p-6 bg-white rounded-2xl shadow-xl border border-slate-100">
        <div class="text-center mb-6"><h1 class="text-2xl font-bold text-slate-800">Team App</h1><p class="text-slate-500 text-xs mt-1">Login sistem</p></div>
        <form action="/login" method="post" class="space-y-4">
          <div><label class="block text-slate-700 text-xs font-bold mb-1">Username</label><input type="text" name="username" class="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 outline-none text-sm" required></div>
          <div><label class="block text-slate-700 text-xs font-bold mb-1">Password</label><input type="password" name="password" class="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 outline-none text-sm" required></div>
          <button class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg transition text-sm" type="submit">Masuk</button>
        </form>
      </div>
    </div>
  `, 'Login'));
});

app.post('/login', async (c) => {
  const body = await c.req.parseBody();
  const { username, password } = body;
  const user: any = await c.env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();
  if (!user || (await hashPassword(String(password))) !== user.password) {
     return c.html(Layout(html`<div class="h-full flex items-center justify-center flex-col gap-4 px-4 text-center"><div class="text-red-500 text-lg font-bold">Login Gagal</div><a href="/" class="text-blue-600 hover:underline bg-blue-50 px-4 py-2 rounded-lg">Coba Lagi</a></div>`, 'Error'));
  }
  const sessionId = crypto.randomUUID();
  // Simpan data user ke Session KV (termasuk role)
  // Kita hapus password dari object session
  const sessionData = { id: user.id, username: user.username, role: user.role };
  await c.env.SESSION_KV.put(sessionId, JSON.stringify(sessionData), { expirationTtl: 86400 });
  setCookie(c, 'session_id', sessionId, { httpOnly: true, secure: true, maxAge: 86400, path: '/' });
  return c.redirect('/home');
});

// LOGOUT
app.post('/logout', async (c) => {
  const sessionId = getCookie(c, 'session_id');
  if(sessionId) await c.env.SESSION_KV.delete(sessionId);
  deleteCookie(c, 'session_id');
  return c.redirect('/');
});

// CHANGE PASSWORD (BARU)
app.post('/api/change-password', async (c) => {
    const session: any = await getSession(c);
    if (!session) return c.redirect('/');
    
    const body = await c.req.parseBody();
    const oldPass = String(body.old_password);
    const newPass = String(body.new_password);

    // Ambil password asli dari DB untuk verifikasi
    const user: any = await c.env.DB.prepare('SELECT password FROM users WHERE id = ?').bind(session.id).first();
    
    if (!user || (await hashPassword(oldPass)) !== user.password) {
        return c.text('Password lama salah!', 400);
    }

    // Update password baru
    const newHash = await hashPassword(newPass);
    await c.env.DB.prepare('UPDATE users SET password = ? WHERE id = ?').bind(newHash, session.id).run();
    
    return c.html(Layout(html`
        <div class="h-full flex items-center justify-center flex-col gap-4 px-4 text-center">
            <div class="text-emerald-600 text-lg font-bold">Password Berhasil Diganti!</div>
            <a href="/home" class="bg-slate-800 text-white px-4 py-2 rounded-lg">Kembali ke Home</a>
        </div>
    `, 'Sukses', session));
});

export default app;

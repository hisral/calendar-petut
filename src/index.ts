import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { html } from 'hono/html';

type Bindings = {
  DB: D1Database;
  SESSION_KV: KVNamespace;
};

const app = new Hono<{ Bindings: Bindings }>();

// --- SECURITY HELPER (SHA-256) ---
// Fungsi ini mengubah password menjadi hash SHA-256
async function hashPassword(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// --- TEMPLATE HTML (Sama seperti sebelumnya) ---
const Layout = (content: any, title: string, user?: any) => html`
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src='https://cdn.jsdelivr.net/npm/fullcalendar@6.1.10/index.global.min.js'></script>
</head>
<body class="bg-gray-100 font-sans h-screen flex overflow-hidden">
  ${user ? html`
  <aside class="w-64 bg-slate-900 text-white flex flex-col hidden md:flex transition-all">
    <div class="h-16 flex items-center justify-center text-xl font-bold border-b border-slate-700 bg-slate-800">
      📅 Team Planner
    </div>
    <nav class="flex-1 px-4 py-6 space-y-2">
      <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Menu</div>
      <a href="/dashboard" class="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-blue-600 transition ${title === 'Dashboard' ? 'bg-blue-700' : ''}">
        <span>Kalender</span>
      </a>
      ${user.role === 'admin' ? html`
      <a href="/admin" class="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-blue-600 transition text-yellow-300 ${title === 'Admin Panel' ? 'bg-slate-700' : ''}">
        <span>⚙️ Admin Panel</span>
      </a>
      ` : ''}
    </nav>
    <div class="p-4 border-t border-slate-700 bg-slate-800">
      <div class="flex items-center gap-3 mb-3">
        <div class="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center font-bold text-sm">
          ${user.username.charAt(0).toUpperCase()}
        </div>
        <div>
          <p class="text-sm font-medium">${user.username}</p>
          <p class="text-xs text-slate-400 capitalize">${user.role}</p>
        </div>
      </div>
      <form action="/logout" method="post">
        <button type="submit" class="w-full bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white py-2 rounded text-sm transition border border-red-600/30">Logout</button>
      </form>
    </div>
  </aside>
  ` : ''}
  <main class="flex-1 flex flex-col overflow-hidden relative">
    ${content}
  </main>
</body>
</html>
`;

// --- HELPER AUTH ---
async function getSession(c: any) {
  const sessionId = getCookie(c, 'session_id');
  if (!sessionId) return null;
  const userDataString = await c.env.SESSION_KV.get(sessionId);
  if (!userDataString) return null;
  return JSON.parse(userDataString);
}

// --- ROUTES ---

app.get('/', async (c) => {
  const session = await getSession(c);
  if (session) return c.redirect('/dashboard');

  return c.html(Layout(html`
    <div class="flex items-center justify-center h-full bg-gray-200 w-full bg-[url('https://images.unsplash.com/photo-1506784983877-45594efa4cbe?q=80&w=2068&auto=format&fit=crop')] bg-cover bg-center">
      <div class="absolute inset-0 bg-black/50"></div>
      <div class="relative bg-white/90 backdrop-blur p-8 rounded-xl shadow-2xl w-96 border border-white/50">
        <h2 class="text-3xl font-bold mb-6 text-center text-slate-800">Login</h2>
        <form action="/login" method="post">
          <div class="mb-4">
            <label class="block text-gray-700 text-sm font-bold mb-2">Username</label>
            <input type="text" name="username" class="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none" required>
          </div>
          <div class="mb-6">
            <label class="block text-gray-700 text-sm font-bold mb-2">Password</label>
            <input type="password" name="password" class="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none" required>
          </div>
          <button class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow transition transform hover:scale-[1.02]" type="submit">
            Sign In
          </button>
        </form>
        <p class="mt-4 text-xs text-center text-gray-500">Default: admin/admin123 or user/user123</p>
      </div>
    </div>
  `, 'Login'));
});

// LOGIN PROCESSS (UPDATED WITH HASH)
app.post('/login', async (c) => {
  const body = await c.req.parseBody();
  const { username, password } = body;

  // 1. Ambil user berdasarkan username saja
  const user: any = await c.env.DB.prepare('SELECT * FROM users WHERE username = ?')
    .bind(username)
    .first();

  if (!user) {
    return c.html(Layout(html`<div class="p-10 text-center text-red-500 bg-white">User not found <a href="/" class="underline">Try Again</a></div>`, 'Error'));
  }

  // 2. Hash password yang diinput user saat ini
  const inputHash = await hashPassword(String(password));

  // 3. Bandingkan Hash Input dengan Hash di Database
  if (inputHash !== user.password) {
     return c.html(Layout(html`<div class="p-10 text-center text-red-500 bg-white">Wrong Password <a href="/" class="underline">Try Again</a></div>`, 'Error'));
  }

  // Jika cocok, buat sesi
  const sessionId = crypto.randomUUID();
  // Hapus password dari object session sebelum disimpan ke KV agar aman
  delete user.password; 
  
  await c.env.SESSION_KV.put(sessionId, JSON.stringify(user), { expirationTtl: 86400 });
  setCookie(c, 'session_id', sessionId, { httpOnly: true, secure: true, maxAge: 86400, path: '/' });
  
  return c.redirect('/dashboard');
});

app.post('/logout', async (c) => {
  const sessionId = getCookie(c, 'session_id');
  if(sessionId) await c.env.SESSION_KV.delete(sessionId);
  deleteCookie(c, 'session_id');
  return c.redirect('/');
});

app.get('/dashboard', async (c) => {
  const user = await getSession(c);
  if (!user) return c.redirect('/');

  return c.html(Layout(html`
    <div class="p-4 md:p-8 h-full overflow-auto flex flex-col">
      <div class="flex justify-between items-center mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-800">Jadwal Tim</h1>
          <p class="text-gray-500 text-sm">Kelola kegiatan bersama</p>
        </div>
        <button onclick="document.getElementById('eventModal').classList.remove('hidden')" class="bg-blue-600 text-white px-5 py-2.5 rounded-lg shadow-lg hover:bg-blue-700 transition flex items-center gap-2">
          <span>+ Tambah Event</span>
        </button>
      </div>
      <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex-1 overflow-hidden">
         <div id="calendar" class="h-full"></div>
      </div>
    </div>

    <div id="eventModal" class="hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div class="p-6 border-b">
          <h2 class="text-xl font-bold text-gray-800">Tambah Event</h2>
        </div>
        <form id="addEventForm" class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Nama Kegiatan</label>
            <input type="text" name="title" class="w-full border rounded-lg p-2.5 outline-none" required>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Mulai</label>
              <input type="datetime-local" name="start" class="w-full border rounded-lg p-2.5 outline-none" required>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Selesai</label>
              <input type="datetime-local" name="end" class="w-full border rounded-lg p-2.5 outline-none" required>
            </div>
          </div>
          <div class="flex justify-end gap-3 mt-6">
            <button type="button" onclick="document.getElementById('eventModal').classList.add('hidden')" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Batal</button>
            <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Simpan</button>
          </div>
        </form>
      </div>
    </div>

    <script>
      document.addEventListener('DOMContentLoaded', function() {
        var calendarEl = document.getElementById('calendar');
        var calendar = new FullCalendar.Calendar(calendarEl, {
          initialView: 'dayGridMonth',
          headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,listWeek' },
          events: '/api/events',
          height: '100%',
          eventColor: '#3b82f6',
          eventClick: function(info) {
             alert('📅 ' + info.event.title + '\\n👤 ' + info.event.extendedProps.created_by);
          }
        });
        calendar.render();

        document.getElementById('addEventForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const formData = new FormData(e.target);
          const data = Object.fromEntries(formData);
          if(new Date(data.start) >= new Date(data.end)) { alert('Waktu selesai harus lebih besar'); return; }
          
          const res = await fetch('/api/events', {
            method: 'POST', body: JSON.stringify({ title: data.title, start_time: data.start, end_time: data.end })
          });
          if(res.ok) {
            calendar.refetchEvents();
            document.getElementById('eventModal').classList.add('hidden');
            e.target.reset();
          }
        });
      });
    </script>
  `, 'Dashboard', user));
});

app.get('/admin', async (c) => {
  const user = await getSession(c);
  if (!user || user.role !== 'admin') return c.redirect('/dashboard');

  const { results: allUsers } = await c.env.DB.prepare('SELECT * FROM users').all();
  const { results: allEvents } = await c.env.DB.prepare('SELECT * FROM events ORDER BY id DESC LIMIT 50').all();

  return c.html(Layout(html`
    <div class="p-8 h-full overflow-auto">
      <h1 class="text-3xl font-bold text-gray-800 mb-8">Admin Dashboard</h1>
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div class="p-5 border-b bg-gray-50"><h3 class="font-bold text-gray-700">Manajemen Pengguna</h3></div>
          <div class="p-5">
            <form action="/api/users" method="POST" class="flex gap-2 mb-6 bg-blue-50 p-4 rounded-lg">
               <input name="username" placeholder="Username" class="border p-2 rounded w-full text-sm" required>
               <input name="password" placeholder="Password" class="border p-2 rounded w-full text-sm" required>
               <select name="role" class="border p-2 rounded text-sm bg-white"><option value="member">Member</option><option value="admin">Admin</option></select>
               <button class="bg-blue-600 text-white px-4 py-2 rounded text-sm font-bold whitespace-nowrap">Add User</button>
            </form>
            <table class="w-full text-sm text-left">
              <thead class="bg-gray-100 uppercase text-xs"><tr><th class="px-4 py-3">User</th><th class="px-4 py-3">Role</th><th class="px-4 py-3">Aksi</th></tr></thead>
              <tbody class="divide-y">${allUsers.map((u: any) => html`<tr class="hover:bg-gray-50"><td class="px-4 py-3">${u.username}</td><td class="px-4 py-3">${u.role}</td><td class="px-4 py-3"><button class="text-red-500" onclick="deleteItem('users', ${u.id})">Hapus</button></td></tr>`)}</tbody>
            </table>
          </div>
        </div>
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
           <div class="p-5 border-b bg-gray-50"><h3 class="font-bold text-gray-700">Daftar Event</h3></div>
           <div class="max-h-[500px] overflow-auto">
            <table class="w-full text-sm text-left">
                <thead class="bg-gray-100 uppercase text-xs sticky top-0"><tr><th class="px-4 py-3">Event</th><th class="px-4 py-3">Waktu</th><th class="px-4 py-3">Aksi</th></tr></thead>
                <tbody class="divide-y">${allEvents.map((e: any) => html`<tr class="hover:bg-gray-50"><td class="px-4 py-3">${e.title}</td><td class="px-4 py-3">${e.start_time}</td><td class="px-4 py-3"><button class="text-red-500" onclick="deleteItem('events', ${e.id})">Hapus</button></td></tr>`)}</tbody>
              </table>
          </div>
        </div>
      </div>
    </div>
    <script>async function deleteItem(t,i){if(confirm('Hapus?')) await fetch('/api/'+t+'/'+i,{method:'DELETE'});window.location.reload();}</script>
  `, 'Admin Panel', user));
});

// --- API ---

app.get('/api/events', async (c) => {
  const session = await getSession(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);
  const { results } = await c.env.DB.prepare('SELECT * FROM events').all();
  return c.json(results.map((e: any) => ({ id: e.id, title: e.title, start: e.start_time, end: e.end_time, extendedProps: { created_by: e.created_by } })));
});

app.post('/api/events', async (c) => {
  const session = await getSession(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);
  const body = await c.req.json();
  await c.env.DB.prepare('INSERT INTO events (title, start_time, end_time, created_by) VALUES (?, ?, ?, ?)').bind(body.title, body.start_time, body.end_time, session.username).run();
  return c.json({ success: true });
});

app.delete('/api/events/:id', async (c) => {
  const session = await getSession(c);
  if (!session || session.role !== 'admin') return c.json({ error: 'Forbidden' }, 403);
  await c.env.DB.prepare('DELETE FROM events WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ success: true });
});

// CREATE USER (HASH PASSWORD DULU)
app.post('/api/users', async (c) => {
  const session = await getSession(c);
  if (!session || session.role !== 'admin') return c.redirect('/admin');
  const body = await c.req.parseBody();
  
  try {
    // Hash password sebelum disimpan
    const hashedPassword = await hashPassword(String(body.password));
    
    await c.env.DB.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)')
      .bind(body.username, hashedPassword, body.role).run();
  } catch(e) {}
  return c.redirect('/admin');
});

app.delete('/api/users/:id', async (c) => {
  const session = await getSession(c);
  if (!session || session.role !== 'admin') return c.json({ error: 'Forbidden' }, 403);
  await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ success: true });
});

export default app;

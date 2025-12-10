import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { html } from 'hono/html';

type Bindings = {
  DB: D1Database;
  SESSION_KV: KVNamespace;
};

const app = new Hono<{ Bindings: Bindings }>();

// --- SECURITY (SHA-256) ---
async function hashPassword(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// --- HTML LAYOUT ---
const Layout = (content: any, title: string, user?: any) => html`
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src='https://cdn.jsdelivr.net/npm/fullcalendar@6.1.10/index.global.min.js'></script>
  <style>
    /* Tooltip Custom Style */
    #customTooltip {
        position: fixed;
        z-index: 9999;
        pointer-events: none; /* Agar mouse tidak bisa hover di tooltipnya sendiri */
        transform: translate(10px, 10px);
    }
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: #f1f1f1; }
    ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
  </style>
</head>
<body class="bg-gray-100 font-sans h-screen flex overflow-hidden text-slate-800">
  
  ${user ? html`
  <aside class="w-64 bg-slate-900 text-white flex flex-col hidden md:flex shadow-xl z-20">
    <div class="h-16 flex items-center px-6 text-xl font-bold border-b border-slate-700 bg-slate-800 tracking-tight">
      📅 Team Planner
    </div>
    <nav class="flex-1 px-3 py-6 space-y-1">
      <div class="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Main</div>
      <a href="/dashboard" class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 transition ${title === 'Dashboard' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'text-slate-300'}">
        <span>Kalender</span>
      </a>
      ${user.role === 'admin' ? html`
      <a href="/admin" class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 transition ${title === 'Admin Panel' ? 'bg-slate-800 text-white' : 'text-slate-300'}">
        <span>⚙️ Admin Panel</span>
      </a>
      ` : ''}
    </nav>
    <div class="p-4 border-t border-slate-700 bg-slate-800/50">
      <div class="flex items-center gap-3 mb-3">
        <div class="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center font-bold text-sm shadow-lg">
          ${user.username.charAt(0).toUpperCase()}
        </div>
        <div>
          <p class="text-sm font-medium text-white">${user.username}</p>
          <p class="text-xs text-slate-400 capitalize">${user.role}</p>
        </div>
      </div>
      <form action="/logout" method="post">
        <button type="submit" class="w-full bg-slate-700 hover:bg-red-600 hover:text-white text-slate-300 py-2 rounded-lg text-xs font-medium transition duration-200">Sign Out</button>
      </form>
    </div>
  </aside>
  ` : ''}

  <main class="flex-1 flex flex-col overflow-hidden relative">
    ${content}
  </main>

  <!-- Global Tooltip Element -->
  <div id="customTooltip" class="hidden max-w-xs bg-slate-800 text-white text-sm p-3 rounded-lg shadow-xl border border-slate-600 leading-relaxed opacity-0 transition-opacity duration-300">
    <div id="tooltipTitle" class="font-bold text-blue-300 mb-1 border-b border-slate-600 pb-1"></div>
    <div id="tooltipContent" class="text-slate-200"></div>
    <div id="tooltipMeta" class="mt-2 text-xs text-slate-500 italic"></div>
  </div>

</body>
</html>
`;

// --- AUTH HELPER ---
async function getSession(c: any) {
  const sessionId = getCookie(c, 'session_id');
  if (!sessionId) return null;
  const userDataString = await c.env.SESSION_KV.get(sessionId);
  if (!userDataString) return null;
  return JSON.parse(userDataString);
}

// --- ROUTES ---

// 1. LOGIN
app.get('/', async (c) => {
  const session = await getSession(c);
  if (session) return c.redirect('/dashboard');

  return c.html(Layout(html`
    <div class="flex items-center justify-center h-full w-full bg-[#f8fafc]">
      <div class="w-full max-w-md p-8 bg-white rounded-2xl shadow-[0_20px_50px_rgba(8,_112,_184,_0.07)] border border-slate-100">
        <div class="text-center mb-8">
            <h1 class="text-3xl font-bold text-slate-800 mb-2">Welcome Back</h1>
            <p class="text-slate-500 text-sm">Please sign in to access your calendar</p>
        </div>
        <form action="/login" method="post" class="space-y-5">
          <div>
            <label class="block text-slate-700 text-sm font-semibold mb-2">Username</label>
            <input type="text" name="username" class="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition" required>
          </div>
          <div>
            <label class="block text-slate-700 text-sm font-semibold mb-2">Password</label>
            <input type="password" name="password" class="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition" required>
          </div>
          <button class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-500/30 transition transform hover:-translate-y-0.5" type="submit">Sign In</button>
        </form>
      </div>
    </div>
  `, 'Login'));
});

// LOGIN PROCESS
app.post('/login', async (c) => {
  const body = await c.req.parseBody();
  const { username, password } = body;
  const user: any = await c.env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();
  if (!user || (await hashPassword(String(password))) !== user.password) {
     return c.html(Layout(html`<div class="h-full flex items-center justify-center flex-col gap-4"><div class="text-red-500 text-lg font-bold">Invalid Credentials</div><a href="/" class="text-blue-600 hover:underline">Try Again</a></div>`, 'Error'));
  }
  const sessionId = crypto.randomUUID();
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

// 2. DASHBOARD
app.get('/dashboard', async (c) => {
  const user = await getSession(c);
  if (!user) return c.redirect('/');

  return c.html(Layout(html`
    <div class="h-full flex flex-col">
      <div class="bg-white border-b border-gray-200 px-8 py-5 flex justify-between items-center shadow-sm z-10">
        <div>
          <h1 class="text-2xl font-bold text-slate-800">Jadwal Tim</h1>
          <p class="text-slate-500 text-sm">Organize your events efficiently</p>
        </div>
        <button onclick="openModal()" class="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium shadow-md shadow-blue-500/20 transition flex items-center gap-2">
          <span class="text-lg">+</span> Tambah Event
        </button>
      </div>
      <div class="flex-1 bg-white p-6 overflow-hidden relative">
         <div id="calendar" class="h-full font-sans"></div>
      </div>
    </div>

    <!-- Universal Modal -->
    <div id="eventModal" class="hidden fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-opacity">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md transform scale-100 transition-all overflow-hidden max-h-full overflow-y-auto">
        <div class="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 id="modalTitle" class="text-lg font-bold text-slate-800">Event Baru</h2>
          <button onclick="closeModal()" class="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
        </div>
        
        <form id="eventForm" class="p-6 space-y-4">
          <input type="hidden" name="id" id="eventId">

          <!-- Title -->
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Judul Event</label>
            <input type="text" name="title" id="eventTitle" class="w-full border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition" placeholder="Contoh: Meeting Proyek" required>
          </div>

          <!-- Description (NEW) -->
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Keterangan / Deskripsi</label>
            <textarea name="description" id="eventDescription" rows="3" class="w-full border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition resize-none" placeholder="Tambahkan detail event (opsional)..."></textarea>
          </div>

          <!-- Colors -->
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase mb-2">Label Warna</label>
            <div class="flex gap-3">
                <label class="cursor-pointer"><input type="radio" name="color" value="#3b82f6" class="peer sr-only" checked><div class="w-8 h-8 rounded-full bg-blue-500 peer-checked:ring-2 peer-checked:ring-offset-2 peer-checked:ring-blue-500 hover:scale-110 transition"></div></label>
                <label class="cursor-pointer"><input type="radio" name="color" value="#10b981" class="peer sr-only"><div class="w-8 h-8 rounded-full bg-emerald-500 peer-checked:ring-2 peer-checked:ring-offset-2 peer-checked:ring-emerald-500 hover:scale-110 transition"></div></label>
                <label class="cursor-pointer"><input type="radio" name="color" value="#f59e0b" class="peer sr-only"><div class="w-8 h-8 rounded-full bg-amber-500 peer-checked:ring-2 peer-checked:ring-offset-2 peer-checked:ring-amber-500 hover:scale-110 transition"></div></label>
                <label class="cursor-pointer"><input type="radio" name="color" value="#ef4444" class="peer sr-only"><div class="w-8 h-8 rounded-full bg-red-500 peer-checked:ring-2 peer-checked:ring-offset-2 peer-checked:ring-red-500 hover:scale-110 transition"></div></label>
                <label class="cursor-pointer"><input type="radio" name="color" value="#8b5cf6" class="peer sr-only"><div class="w-8 h-8 rounded-full bg-violet-500 peer-checked:ring-2 peer-checked:ring-offset-2 peer-checked:ring-violet-500 hover:scale-110 transition"></div></label>
            </div>
          </div>

          <!-- Dates -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Mulai</label>
              <input type="datetime-local" name="start" id="eventStart" class="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50" required>
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Selesai</label>
              <input type="datetime-local" name="end" id="eventEnd" class="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50" required>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex justify-between items-center pt-4 border-t border-slate-100 mt-2">
            <button type="button" id="btnDelete" class="hidden text-red-500 text-sm font-semibold hover:bg-red-50 px-3 py-2 rounded transition">Hapus</button>
            <div class="flex gap-2 ml-auto">
                <button type="button" onclick="closeModal()" class="px-4 py-2 text-slate-500 font-medium hover:bg-slate-100 rounded-lg text-sm transition">Batal</button>
                <button type="submit" class="px-5 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 shadow-md transition text-sm">Simpan</button>
            </div>
          </div>
        </form>
      </div>
    </div>

    <script>
      let calendar;
      const modal = document.getElementById('eventModal');
      const form = document.getElementById('eventForm');
      const btnDelete = document.getElementById('btnDelete');
      
      // TOOLTIP ELEMENTS
      const tooltip = document.getElementById('customTooltip');
      const tooltipTitle = document.getElementById('tooltipTitle');
      const tooltipContent = document.getElementById('tooltipContent');
      const tooltipMeta = document.getElementById('tooltipMeta');
      let tooltipTimer;

      function openModal(eventData = null) {
        modal.classList.remove('hidden');
        if (eventData) {
            document.getElementById('modalTitle').textContent = 'Edit Event';
            document.getElementById('eventId').value = eventData.id;
            document.getElementById('eventTitle').value = eventData.title;
            // Load Description
            document.getElementById('eventDescription').value = eventData.extendedProps.description || '';
            
            document.getElementById('eventStart').value = eventData.startStr.slice(0, 16); 
            document.getElementById('eventEnd').value = eventData.endStr ? eventData.endStr.slice(0, 16) : eventData.startStr.slice(0, 16);
            
            const color = eventData.backgroundColor;
            const radio = document.querySelector(\`input[name="color"][value="\${color}"]\`);
            if(radio) radio.checked = true;

            btnDelete.classList.remove('hidden');
            btnDelete.onclick = () => deleteEvent(eventData.id);
        } else {
            document.getElementById('modalTitle').textContent = 'Event Baru';
            form.reset();
            document.getElementById('eventId').value = '';
            document.getElementById('eventDescription').value = ''; // Clear desc
            btnDelete.classList.add('hidden');
        }
      }

      function closeModal() {
        modal.classList.add('hidden');
      }

      async function deleteEvent(id) {
          if(!confirm('Hapus event ini secara permanen?')) return;
          const res = await fetch('/api/events/' + id, { method: 'DELETE' });
          if(res.ok) { calendar.getEventById(id).remove(); closeModal(); } 
          else { alert('Gagal menghapus (Anda bukan pemilik/admin)'); }
      }

      document.addEventListener('DOMContentLoaded', function() {
        var calendarEl = document.getElementById('calendar');
        calendar = new FullCalendar.Calendar(calendarEl, {
          initialView: 'dayGridMonth',
          headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,listWeek' },
          events: '/api/events',
          height: '100%',
          editable: true,
          dayMaxEvents: true,
          
          eventClick: function(info) {
            openModal(info.event);
          },

          // --- LOGIKA TOOLTIP 2 DETIK ---
          eventDidMount: function(info) {
            const el = info.el;
            
            el.addEventListener('mouseenter', (e) => {
                // Set Timer 2 Detik (2000 ms)
                tooltipTimer = setTimeout(() => {
                    const props = info.event.extendedProps;
                    
                    // Isi Konten Tooltip
                    tooltipTitle.innerText = info.event.title;
                    tooltipContent.innerText = props.description ? props.description : "Tidak ada keterangan tambahan.";
                    tooltipMeta.innerText = "Dibuat oleh: " + props.created_by;
                    
                    // Posisi Tooltip (Ikuti Mouse + Sedikit Offset)
                    tooltip.style.left = (e.pageX + 15) + 'px';
                    tooltip.style.top = (e.pageY + 15) + 'px';
                    
                    // Tampilkan
                    tooltip.classList.remove('hidden');
                    // Kecilkan opacity dulu biar smooth transition
                    setTimeout(() => tooltip.classList.remove('opacity-0'), 10);
                }, 2000); 
            });

            el.addEventListener('mouseleave', () => {
                // Jika mouse keluar sebelum 2 detik, batalkan timer
                clearTimeout(tooltipTimer);
                // Sembunyikan tooltip
                tooltip.classList.add('opacity-0');
                tooltip.classList.add('hidden');
            });
            
            // Update posisi jika mouse bergerak (opsional, tapi bagus untuk UX)
            el.addEventListener('mousemove', (e) => {
               if(!tooltip.classList.contains('hidden')) {
                  tooltip.style.left = (e.pageX + 15) + 'px';
                  tooltip.style.top = (e.pageY + 15) + 'px';
               }
            });
          },

          eventDrop: async function(info) {
             await fetch('/api/events/' + info.event.id, {
                method: 'PUT',
                body: JSON.stringify({
                    title: info.event.title,
                    description: info.event.extendedProps.description, // Keep desc
                    start_time: info.event.start.toISOString(),
                    end_time: info.event.end ? info.event.end.toISOString() : info.event.start.toISOString(),
                    color: info.event.backgroundColor
                })
             });
          }
        });
        calendar.render();

        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const formData = new FormData(e.target);
          const data = Object.fromEntries(formData);
          const id = data.id;

          if(new Date(data.start) >= new Date(data.end)) { alert('Waktu selesai harus lebih besar'); return; }

          const payload = {
            title: data.title,
            description: data.description, // Kirim deskripsi
            start_time: data.start,
            end_time: data.end,
            color: data.color
          };

          let res;
          if (id) res = await fetch('/api/events/' + id, { method: 'PUT', body: JSON.stringify(payload) });
          else res = await fetch('/api/events', { method: 'POST', body: JSON.stringify(payload) });

          if(res.ok) { calendar.refetchEvents(); closeModal(); } 
          else { alert('Gagal menyimpan'); }
        });
      });
    </script>
  `, 'Dashboard', user));
});

// 3. ADMIN
app.get('/admin', async (c) => {
  const user = await getSession(c);
  if (!user || user.role !== 'admin') return c.redirect('/dashboard');
  const { results: allUsers } = await c.env.DB.prepare('SELECT * FROM users').all();
  return c.html(Layout(html`
    <div class="p-8 h-full overflow-auto">
      <h1 class="text-3xl font-bold text-slate-800 mb-8">Admin Dashboard</h1>
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden max-w-4xl">
          <div class="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center"><h3 class="font-bold text-slate-700">Manajemen User</h3></div>
          <div class="p-6">
            <form action="/api/users" method="POST" class="flex gap-3 mb-8 bg-blue-50 p-5 rounded-xl border border-blue-100 items-end">
               <div class="flex-1"><label class="text-xs font-bold text-blue-800 uppercase mb-1 block">Username</label><input name="username" class="border border-blue-200 p-2 rounded w-full text-sm" required></div>
               <div class="flex-1"><label class="text-xs font-bold text-blue-800 uppercase mb-1 block">Password</label><input name="password" class="border border-blue-200 p-2 rounded w-full text-sm" required></div>
               <div class="w-32"><label class="text-xs font-bold text-blue-800 uppercase mb-1 block">Role</label><select name="role" class="border border-blue-200 p-2 rounded w-full text-sm bg-white"><option value="member">Member</option><option value="admin">Admin</option></select></div>
               <button class="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded font-bold text-sm shadow-md transition h-[38px]">Tambah</button>
            </form>
            <table class="w-full text-sm text-left"><thead class="bg-slate-100 text-slate-600 uppercase text-xs font-bold"><tr><th class="px-4 py-3">User</th><th class="px-4 py-3">Role</th><th class="px-4 py-3 text-right">Aksi</th></tr></thead>
              <tbody class="divide-y divide-gray-100">${allUsers.map((u: any) => html`<tr class="hover:bg-slate-50"><td class="px-4 py-3 font-medium text-slate-700">${u.username}</td><td class="px-4 py-3">${u.role}</td><td class="px-4 py-3 text-right"><button class="text-red-500 hover:bg-red-50 px-3 py-1 rounded text-xs font-bold" onclick="if(confirm('Hapus?')) fetch('/api/users/${u.id}',{method:'DELETE'}).then(()=>location.reload())">HAPUS</button></td></tr>`)}</tbody>
            </table>
          </div>
        </div>
    </div>
  `, 'Admin Panel', user));
});

// --- API ---

// GET (Include description)
app.get('/api/events', async (c) => {
  const session = await getSession(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);
  const { results } = await c.env.DB.prepare('SELECT * FROM events').all();
  return c.json(results.map((e: any) => ({
    id: e.id,
    title: e.title,
    start: e.start_time,
    end: e.end_time,
    backgroundColor: e.color || '#3b82f6',
    borderColor: e.color || '#3b82f6',
    extendedProps: { created_by: e.created_by, description: e.description } // Send Description
  })));
});

// CREATE (Handle description)
app.post('/api/events', async (c) => {
  const session = await getSession(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);
  const body = await c.req.json();
  await c.env.DB.prepare('INSERT INTO events (title, description, start_time, end_time, color, created_by) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(body.title, body.description, body.start_time, body.end_time, body.color, session.username).run();
  return c.json({ success: true });
});

// UPDATE (Handle description)
app.put('/api/events/:id', async (c) => {
  const session = await getSession(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);
  const id = c.req.param('id');
  const body = await c.req.json();
  
  const event: any = await c.env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(id).first();
  if (!event) return c.json({ error: 'Not found' }, 404);
  if (session.role !== 'admin' && event.created_by !== session.username) return c.json({ error: 'Forbidden' }, 403);

  await c.env.DB.prepare('UPDATE events SET title=?, description=?, start_time=?, end_time=?, color=? WHERE id=?')
    .bind(body.title, body.description, body.start_time, body.end_time, body.color, id).run();
  return c.json({ success: true });
});

app.delete('/api/events/:id', async (c) => {
  const session = await getSession(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);
  const id = c.req.param('id');
  const event: any = await c.env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(id).first();
  if (!event) return c.json({ error: 'Not found' }, 404);
  if (session.role !== 'admin' && event.created_by !== session.username) return c.json({ error: 'Forbidden' }, 403);
  await c.env.DB.prepare('DELETE FROM events WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

app.post('/api/users', async (c) => {
  const session = await getSession(c);
  if (!session || session.role !== 'admin') return c.redirect('/admin');
  const body = await c.req.parseBody();
  try {
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

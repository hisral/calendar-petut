import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { html } from 'hono/html';

type Bindings = {
  DB: D1Database;
  SESSION_KV: KVNamespace;
};

const app = new Hono<{ Bindings: Bindings }>();

// --- HELPER FUNCTIONS ---
async function hashPassword(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const formatRupiah = (number: number) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number);
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
    /* Tooltip & Scrollbar */
    #customTooltip { position: fixed; z-index: 9999; pointer-events: none; transform: translate(10px, 10px); }
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
      <a href="/dashboard" class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 transition ${title === 'Dashboard' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-slate-300'}">
        <span>🗓️ Kalender</span>
      </a>
      <a href="/cashflow" class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 transition ${title === 'Buku Kas' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/50' : 'text-slate-300'}">
        <span>💰 Buku Kas</span>
      </a>
      ${user.role === 'admin' ? html`
      <div class="mt-4 px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">System</div>
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
      <div class="w-full max-w-md p-8 bg-white rounded-2xl shadow-xl border border-slate-100">
        <div class="text-center mb-8">
            <h1 class="text-3xl font-bold text-slate-800 mb-2">Team App</h1>
            <p class="text-slate-500 text-sm">Masuk untuk melihat Jadwal & Kas</p>
        </div>
        <form action="/login" method="post" class="space-y-5">
          <div><label class="block text-slate-700 text-sm font-semibold mb-2">Username</label><input type="text" name="username" class="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" required></div>
          <div><label class="block text-slate-700 text-sm font-semibold mb-2">Password</label><input type="password" name="password" class="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" required></div>
          <button class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl shadow-lg transition transform hover:-translate-y-0.5" type="submit">Sign In</button>
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

// 2. DASHBOARD (CALENDAR)
app.get('/dashboard', async (c) => {
  const user = await getSession(c);
  if (!user) return c.redirect('/');

  return c.html(Layout(html`
    <div class="h-full flex flex-col">
      <div class="bg-white border-b border-gray-200 px-8 py-5 flex justify-between items-center shadow-sm z-10">
        <div><h1 class="text-2xl font-bold text-slate-800">Jadwal Tim</h1><p class="text-slate-500 text-sm">Kelola kegiatan bersama</p></div>
        <button onclick="openModal()" class="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium shadow-md transition flex items-center gap-2"><span class="text-lg">+</span> Tambah Event</button>
      </div>
      <div class="flex-1 bg-white p-6 overflow-hidden relative"><div id="calendar" class="h-full font-sans"></div></div>
    </div>

    <!-- Calendar Modal -->
    <div id="eventModal" class="hidden fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div class="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50"><h2 id="modalTitle" class="text-lg font-bold text-slate-800">Event Baru</h2><button onclick="closeModal()" class="text-slate-400 text-2xl">&times;</button></div>
        <form id="eventForm" class="p-6 space-y-4">
          <input type="hidden" name="id" id="eventId">
          <div><label class="block text-xs font-bold text-slate-500 uppercase mb-1">Judul Event</label><input type="text" name="title" id="eventTitle" class="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" required></div>
          <div><label class="block text-xs font-bold text-slate-500 uppercase mb-1">Deskripsi</label><textarea name="description" id="eventDescription" rows="2" class="w-full border rounded-lg p-3 text-sm resize-none"></textarea></div>
          <div><label class="block text-xs font-bold text-slate-500 uppercase mb-2">Warna</label><div class="flex gap-3"><label class="cursor-pointer"><input type="radio" name="color" value="#3b82f6" class="peer sr-only" checked><div class="w-8 h-8 rounded-full bg-blue-500 peer-checked:ring-2 peer-checked:ring-offset-2 peer-checked:ring-blue-500"></div></label><label class="cursor-pointer"><input type="radio" name="color" value="#10b981" class="peer sr-only"><div class="w-8 h-8 rounded-full bg-emerald-500 peer-checked:ring-2 peer-checked:ring-offset-2 peer-checked:ring-emerald-500"></div></label><label class="cursor-pointer"><input type="radio" name="color" value="#ef4444" class="peer sr-only"><div class="w-8 h-8 rounded-full bg-red-500 peer-checked:ring-2 peer-checked:ring-offset-2 peer-checked:ring-red-500"></div></label></div></div>
          <div class="grid grid-cols-2 gap-4">
            <div><label class="block text-xs font-bold text-slate-500 uppercase mb-1">Mulai</label><input type="datetime-local" name="start" id="eventStart" class="w-full border rounded-lg p-2.5 text-sm" required></div>
            <div><label class="block text-xs font-bold text-slate-500 uppercase mb-1">Selesai</label><input type="datetime-local" name="end" id="eventEnd" class="w-full border rounded-lg p-2.5 text-sm" required></div>
          </div>
          <div class="flex justify-between items-center pt-4 border-t mt-2"><button type="button" id="btnDelete" class="hidden text-red-500 text-sm font-bold">Hapus</button><div class="flex gap-2 ml-auto"><button type="button" onclick="closeModal()" class="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg text-sm">Batal</button><button type="submit" class="px-5 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 shadow-md text-sm">Simpan</button></div></div>
        </form>
      </div>
    </div>
    <script>
      let calendar; const modal=document.getElementById('eventModal'), form=document.getElementById('eventForm'), btnDelete=document.getElementById('btnDelete');
      const tooltip=document.getElementById('customTooltip'), tooltipTitle=document.getElementById('tooltipTitle'), tooltipContent=document.getElementById('tooltipContent'), tooltipMeta=document.getElementById('tooltipMeta'); let tooltipTimer;
      function openModal(e){modal.classList.remove('hidden'); if(e){document.getElementById('modalTitle').textContent='Edit Event'; document.getElementById('eventId').value=e.id; document.getElementById('eventTitle').value=e.title; document.getElementById('eventDescription').value=e.extendedProps.description||''; document.getElementById('eventStart').value=e.startStr.slice(0,16); document.getElementById('eventEnd').value=e.endStr?e.endStr.slice(0,16):e.startStr.slice(0,16); const r=document.querySelector(\`input[name="color"][value="\${e.backgroundColor}"]\`);if(r)r.checked=true; btnDelete.classList.remove('hidden'); btnDelete.onclick=()=>deleteEvent(e.id)}else{document.getElementById('modalTitle').textContent='Event Baru'; form.reset(); document.getElementById('eventId').value=''; btnDelete.classList.add('hidden')}}
      function closeModal(){modal.classList.add('hidden')}
      async function deleteEvent(id){if(confirm('Hapus?')) await fetch('/api/events/'+id,{method:'DELETE'}).then(r=>{if(r.ok){calendar.getEventById(id).remove();closeModal()}else alert('Gagal')})}
      document.addEventListener('DOMContentLoaded',function(){
        calendar=new FullCalendar.Calendar(document.getElementById('calendar'),{
          initialView:'dayGridMonth', headerToolbar:{left:'prev,next today',center:'title',right:'dayGridMonth,listWeek'}, events:'/api/events', height:'100%', editable:true, dayMaxEvents:true,
          eventClick:i=>openModal(i.event),
          eventDidMount:function(i){
             const el=i.el;
             el.addEventListener('mouseenter',e=>{ tooltipTimer=setTimeout(()=>{ tooltipTitle.innerText=i.event.title; tooltipContent.innerText=i.event.extendedProps.description||"-"; tooltipMeta.innerText="Oleh: "+i.event.extendedProps.created_by; tooltip.style.left=(e.pageX+15)+'px'; tooltip.style.top=(e.pageY+15)+'px'; tooltip.classList.remove('hidden'); setTimeout(()=>tooltip.classList.remove('opacity-0'),10) },2000)});
             el.addEventListener('mouseleave',()=>{ clearTimeout(tooltipTimer); tooltip.classList.add('opacity-0'); tooltip.classList.add('hidden')});
          },
          eventDrop:async i=> fetch('/api/events/'+i.event.id,{method:'PUT',body:JSON.stringify({title:i.event.title,description:i.event.extendedProps.description,start_time:i.event.start.toISOString(),end_time:i.event.end?i.event.end.toISOString():i.event.start.toISOString(),color:i.event.backgroundColor})})
        }); calendar.render();
        form.addEventListener('submit',async e=>{ e.preventDefault(); const d=Object.fromEntries(new FormData(e.target)); if(new Date(d.start)>=new Date(d.end)){alert('Waktu salah');return} const url=d.id?'/api/events/'+d.id:'/api/events'; const m=d.id?'PUT':'POST'; await fetch(url,{method:m,body:JSON.stringify({title:d.title,description:d.description,start_time:d.start,end_time:d.end,color:d.color})}).then(r=>{if(r.ok){calendar.refetchEvents();closeModal()}else alert('Error')}) })
      });
    </script>
  `, 'Dashboard', user));
});

// 3. CASHFLOW PAGE (NEW)
app.get('/cashflow', async (c) => {
  const user = await getSession(c);
  if (!user) return c.redirect('/');

  // Ambil Data & Hitung Saldo Running
  const { results } = await c.env.DB.prepare('SELECT * FROM cashflow ORDER BY transaction_date ASC, id ASC').all();
  
  let runningBalance = 0;
  const data = results.map((row: any) => {
    runningBalance += row.amount;
    return { ...row, balance: runningBalance };
  });

  // Balik urutan agar yang terbaru diatas (tapi saldo tetap benar sesuai urutan waktu)
  const displayData = data.reverse(); 

  return c.html(Layout(html`
    <div class="h-full flex flex-col bg-slate-50">
      <!-- Header -->
      <div class="bg-white border-b border-gray-200 px-8 py-6 flex justify-between items-center shadow-sm">
        <div>
          <h1 class="text-2xl font-bold text-slate-800">Buku Kas</h1>
          <p class="text-slate-500 text-sm">Pencatatan pemasukan & pengeluaran tim</p>
        </div>
        <div class="text-right mr-6">
            <span class="text-xs text-gray-500 uppercase font-bold">Saldo Saat Ini</span>
            <div class="text-3xl font-bold ${runningBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}">
                ${formatRupiah(runningBalance)}
            </div>
        </div>
        <button onclick="document.getElementById('cashModal').classList.remove('hidden')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg font-medium shadow-md transition flex items-center gap-2">
          <span>+ Transaksi</span>
        </button>
      </div>

      <!-- Table Wrapper -->
      <div class="flex-1 p-6 overflow-auto">
         <div class="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
            <table class="w-full text-left border-collapse">
                <thead class="bg-slate-100 text-slate-600 uppercase text-xs font-bold sticky top-0">
                    <tr>
                        <th class="px-6 py-4 border-b">Tanggal</th>
                        <th class="px-6 py-4 border-b">Keterangan</th>
                        <th class="px-6 py-4 border-b text-right text-emerald-600">Masuk (Debit)</th>
                        <th class="px-6 py-4 border-b text-right text-red-600">Keluar (Kredit)</th>
                        <th class="px-6 py-4 border-b text-right">Saldo</th>
                        <th class="px-6 py-4 border-b text-center">Aksi</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 text-sm">
                    ${displayData.length === 0 ? html`<tr><td colspan="6" class="p-8 text-center text-gray-400">Belum ada transaksi</td></tr>` : ''}
                    ${displayData.map((item: any) => html`
                    <tr class="hover:bg-slate-50 transition group">
                        <td class="px-6 py-3 font-medium text-slate-700 whitespace-nowrap">${item.transaction_date}</td>
                        <td class="px-6 py-3 text-slate-600 w-full">${item.description}</td>
                        <td class="px-6 py-3 text-right font-medium text-emerald-600">
                            ${item.amount > 0 ? formatRupiah(item.amount) : '-'}
                        </td>
                        <td class="px-6 py-3 text-right font-medium text-red-600">
                            ${item.amount < 0 ? formatRupiah(Math.abs(item.amount)) : '-'}
                        </td>
                        <td class="px-6 py-3 text-right font-bold text-slate-700 bg-slate-50/50">
                            ${formatRupiah(item.balance)}
                        </td>
                        <td class="px-6 py-3 text-center">
                            <button onclick="deleteCash(${item.id})" class="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition">Hapus</button>
                        </td>
                    </tr>
                    `)}
                </tbody>
            </table>
         </div>
      </div>
    </div>

    <!-- Add Transaction Modal -->
    <div id="cashModal" class="hidden fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div class="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h2 class="text-lg font-bold text-slate-800">Catat Transaksi</h2>
                <button onclick="document.getElementById('cashModal').classList.add('hidden')" class="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
            </div>
            <form action="/api/cashflow" method="POST" class="p-6 space-y-4">
                <div>
                    <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Tanggal</label>
                    <input type="date" name="date" class="w-full border rounded-lg p-2.5 text-sm bg-slate-50 focus:ring-2 focus:ring-emerald-500 outline-none" required value="${new Date().toISOString().split('T')[0]}">
                </div>
                <div>
                    <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Jenis Transaksi</label>
                    <div class="grid grid-cols-2 gap-3">
                        <label class="cursor-pointer">
                            <input type="radio" name="type" value="IN" class="peer sr-only" checked>
                            <div class="text-center py-2 rounded-lg border border-slate-200 peer-checked:bg-emerald-100 peer-checked:border-emerald-500 peer-checked:text-emerald-700 font-medium transition">
                                💰 Uang Masuk
                            </div>
                        </label>
                        <label class="cursor-pointer">
                            <input type="radio" name="type" value="OUT" class="peer sr-only">
                            <div class="text-center py-2 rounded-lg border border-slate-200 peer-checked:bg-red-100 peer-checked:border-red-500 peer-checked:text-red-700 font-medium transition">
                                💸 Uang Keluar
                            </div>
                        </label>
                    </div>
                </div>
                <div>
                    <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Keterangan</label>
                    <input type="text" name="description" placeholder="Contoh: Bayar Hosting / Dapat Proyek A" class="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" required>
                </div>
                <div>
                    <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Jumlah (Rp)</label>
                    <input type="number" name="amount" placeholder="0" class="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-mono" required min="1">
                </div>
                <div class="pt-2">
                    <button class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg shadow-md transition">Simpan Transaksi</button>
                </div>
            </form>
        </div>
    </div>

    <script>
        async function deleteCash(id) {
            if(!confirm('Hapus transaksi ini? Saldo akan dihitung ulang.')) return;
            const res = await fetch('/api/cashflow/' + id, { method: 'DELETE' });
            if(res.ok) window.location.reload();
            else alert('Gagal menghapus');
        }
    </script>
  `, 'Buku Kas', user));
});

// 4. ADMIN PAGE
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

// --- API ROUTES ---

// EVENT API
app.get('/api/events', async (c) => {
  const session = await getSession(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);
  const { results } = await c.env.DB.prepare('SELECT * FROM events').all();
  return c.json(results.map((e: any) => ({
    id: e.id, title: e.title, start: e.start_time, end: e.end_time, backgroundColor: e.color||'#3b82f6', borderColor: e.color||'#3b82f6', extendedProps: { created_by: e.created_by, description: e.description }
  })));
});
app.post('/api/events', async (c) => {
  const session = await getSession(c); if(!session) return c.json({error:'401'},401); const b=await c.req.json();
  await c.env.DB.prepare('INSERT INTO events (title,description,start_time,end_time,color,created_by) VALUES (?,?,?,?,?,?)').bind(b.title,b.description,b.start_time,b.end_time,b.color,session.username).run(); return c.json({ok:true});
});
app.put('/api/events/:id', async (c) => {
  const session = await getSession(c); if(!session) return c.json({error:'401'},401); const b=await c.req.json();
  const e:any=await c.env.DB.prepare('SELECT * FROM events WHERE id=?').bind(c.req.param('id')).first();
  if(session.role!=='admin' && e.created_by!==session.username) return c.json({error:'403'},403);
  await c.env.DB.prepare('UPDATE events SET title=?,description=?,start_time=?,end_time=?,color=? WHERE id=?').bind(b.title,b.description,b.start_time,b.end_time,b.color,c.req.param('id')).run(); return c.json({ok:true});
});
app.delete('/api/events/:id', async (c) => {
  const session = await getSession(c); if(!session) return c.json({error:'401'},401);
  const e:any=await c.env.DB.prepare('SELECT * FROM events WHERE id=?').bind(c.req.param('id')).first();
  if(session.role!=='admin' && e.created_by!==session.username) return c.json({error:'403'},403);
  await c.env.DB.prepare('DELETE FROM events WHERE id=?').bind(c.req.param('id')).run(); return c.json({ok:true});
});

// CASHFLOW API (NEW)
app.post('/api/cashflow', async (c) => {
    const session = await getSession(c);
    if (!session) return c.redirect('/');
    
    const body = await c.req.parseBody();
    const amount = Number(body.amount);
    
    // Jika tipe 'OUT' (Uang Keluar), jadikan negatif
    const finalAmount = body.type === 'OUT' ? -Math.abs(amount) : Math.abs(amount);

    await c.env.DB.prepare('INSERT INTO cashflow (transaction_date, description, amount, created_by) VALUES (?, ?, ?, ?)')
        .bind(body.date, body.description, finalAmount, session.username)
        .run();
    
    return c.redirect('/cashflow');
});

app.delete('/api/cashflow/:id', async (c) => {
    const session = await getSession(c);
    if (!session || session.role !== 'admin') {
        // Hanya admin atau pembuat data yang boleh hapus (di sini disederhanakan hanya admin/pembuat)
        const item: any = await c.env.DB.prepare('SELECT created_by FROM cashflow WHERE id = ?').bind(c.req.param('id')).first();
        if(!item || (item.created_by !== session.username && session.role !== 'admin')) return c.json({error: 'Forbidden'}, 403);
    }
    
    await c.env.DB.prepare('DELETE FROM cashflow WHERE id = ?').bind(c.req.param('id')).run();
    return c.json({ success: true });
});

// USER API
app.post('/api/users', async (c) => {
  const session = await getSession(c); if(!session||session.role!=='admin') return c.redirect('/admin'); const b=await c.req.parseBody();
  try{await c.env.DB.prepare('INSERT INTO users (username,password,role) VALUES (?,?,?)').bind(b.username, await hashPassword(String(b.password)), b.role).run()}catch(e){} return c.redirect('/admin');
});
app.delete('/api/users/:id', async (c) => {
  const session = await getSession(c); if(!session||session.role!=='admin') return c.json({error:'403'},403);
  await c.env.DB.prepare('DELETE FROM users WHERE id=?').bind(c.req.param('id')).run(); return c.json({ok:true});
});

export default app;

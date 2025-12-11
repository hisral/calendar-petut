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
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${title}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src='https://cdn.jsdelivr.net/npm/fullcalendar@6.1.10/index.global.min.js'></script>
  <!-- Ikon Lucide untuk tampilan folder yang lebih cantik -->
  <script src="https://unpkg.com/lucide@latest"></script>
  <style>
    body { -webkit-tap-highlight-color: transparent; }
    #customTooltip { position: fixed; z-index: 9999; pointer-events: none; transform: translate(10px, 10px); }
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    
    /* Calendar Mobile Tweak */
    @media (max-width: 768px) {
        .fc-col-header-cell-cushion { font-size: 0.75rem; font-weight: normal; }
        .fc-daygrid-day-number { font-size: 0.8rem; padding: 2px 4px !important; }
        .fc-event { font-size: 0.65rem !important; border-radius: 2px !important; }
        .fc-toolbar-title { font-size: 1.1rem !important; }
        .fc-button { padding: 0.2rem 0.5rem !important; font-size: 0.8rem !important; }
    }
  </style>
</head>
<body class="bg-gray-100 font-sans h-screen flex flex-col md:flex-row overflow-hidden text-slate-800">
  
  ${user ? html`
  <!-- DESKTOP SIDEBAR -->
  <aside class="w-64 bg-slate-900 text-white flex-col hidden md:flex shadow-xl z-20 h-full">
    <div class="h-16 flex items-center px-6 text-xl font-bold border-b border-slate-700 bg-slate-800 tracking-tight">
      📅 Team App
    </div>
    <nav class="flex-1 px-3 py-6 space-y-1">
      <div class="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Menu</div>
      <a href="/dashboard" class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 transition ${title === 'Dashboard' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-300'}">
        <span>🗓️ Kalender</span>
      </a>
      <a href="/cashflow" class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 transition ${title === 'Buku Kas' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-300'}">
        <span>💰 Buku Kas</span>
      </a>
      <a href="/notes" class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 transition ${title === 'Catatan' ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-300'}">
        <span>📝 Catatan</span>
      </a>
      ${user.role === 'admin' ? html`
      <div class="mt-4 px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Admin</div>
      <a href="/admin" class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 transition ${title === 'Admin Panel' ? 'bg-slate-800 text-white' : 'text-slate-300'}">
        <span>⚙️ Panel</span>
      </a>
      ` : ''}
    </nav>
    <div class="p-4 border-t border-slate-700 bg-slate-800/50">
       <div class="flex items-center gap-3 mb-3">
        <div class="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center font-bold text-xs shadow-lg">
          ${user.username.charAt(0).toUpperCase()}
        </div>
        <div><p class="text-sm font-medium text-white">${user.username}</p></div>
      </div>
      <form action="/logout" method="post">
        <button type="submit" class="w-full bg-slate-700 hover:bg-red-600 text-slate-300 py-2 rounded-lg text-xs font-medium transition">Logout</button>
      </form>
    </div>
  </aside>

  <!-- MOBILE BOTTOM NAV -->
  <nav class="md:hidden fixed bottom-0 w-full bg-white border-t border-gray-200 flex justify-around items-center h-16 z-40 pb-safe">
    <a href="/dashboard" class="flex flex-col items-center justify-center w-full h-full ${title === 'Dashboard' ? 'text-blue-600' : 'text-gray-400'}">
      <i data-lucide="calendar" class="w-5 h-5"></i><span class="text-[10px] font-medium mt-1">Jadwal</span>
    </a>
    <a href="/cashflow" class="flex flex-col items-center justify-center w-full h-full ${title === 'Buku Kas' ? 'text-emerald-600' : 'text-gray-400'}">
      <i data-lucide="wallet" class="w-5 h-5"></i><span class="text-[10px] font-medium mt-1">Kas</span>
    </a>
    <a href="/notes" class="flex flex-col items-center justify-center w-full h-full ${title === 'Catatan' ? 'text-amber-600' : 'text-gray-400'}">
      <i data-lucide="sticky-note" class="w-5 h-5"></i><span class="text-[10px] font-medium mt-1">Catatan</span>
    </a>
    ${user.role === 'admin' ? html`
    <a href="/admin" class="flex flex-col items-center justify-center w-full h-full ${title === 'Admin Panel' ? 'text-slate-800' : 'text-gray-400'}">
      <i data-lucide="settings" class="w-5 h-5"></i><span class="text-[10px] font-medium mt-1">Admin</span>
    </a>
    ` : ''}
    <form action="/logout" method="post" class="w-full h-full">
        <button type="submit" class="flex flex-col items-center justify-center w-full h-full text-red-400 hover:text-red-600">
            <i data-lucide="log-out" class="w-5 h-5"></i><span class="text-[10px] font-medium mt-1">Keluar</span>
        </button>
    </form>
  </nav>
  ` : ''}

  <main class="flex-1 flex flex-col overflow-hidden relative w-full pb-16 md:pb-0">
    ${content}
  </main>

  <!-- Tooltip -->
  <div id="customTooltip" class="hidden max-w-[200px] bg-slate-800 text-white text-xs p-2 rounded shadow-xl border border-slate-600 opacity-0 transition-opacity duration-300">
    <div id="tooltipTitle" class="font-bold text-blue-300 mb-1 border-b border-slate-600 pb-1"></div>
    <div id="tooltipContent" class="text-slate-200"></div>
    <div id="tooltipMeta" class="mt-1 text-[10px] text-slate-500 italic"></div>
  </div>

  <script>
    // Initialize Lucide Icons
    lucide.createIcons();
  </script>
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
      <div class="bg-white border-b border-gray-200 px-4 md:px-8 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 shadow-sm z-10">
        <div><h1 class="text-xl md:text-2xl font-bold text-slate-800">Jadwal Tim</h1><p class="text-slate-500 text-xs">Kegiatan & Agenda</p></div>
        <button onclick="openModal()" class="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-md transition text-sm flex justify-center items-center gap-2 active:bg-blue-800">
          <i data-lucide="plus" class="w-4 h-4"></i> Tambah Event
        </button>
      </div>
      <div class="flex-1 bg-white p-2 md:p-6 overflow-hidden relative">
         <div id="calendar" class="h-full font-sans text-xs md:text-sm"></div>
      </div>
    </div>
    <!-- Modal (Code same as before, truncated for brevity, but functionality preserved) -->
    <div id="eventModal" class="hidden fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4">
       <!-- ... Isi modal sama seperti sebelumnya ... -->
       <div class="bg-white rounded-t-2xl md:rounded-2xl shadow-2xl w-full md:max-w-md h-[85vh] md:h-auto flex flex-col animate-slide-up md:animate-none">
        <div class="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
            <h2 id="modalTitle" class="text-lg font-bold text-slate-800">Event</h2>
            <button onclick="closeModal()" class="text-slate-400 text-2xl p-2">&times;</button>
        </div>
        <form id="eventForm" class="p-6 space-y-4 overflow-y-auto flex-1">
          <input type="hidden" name="id" id="eventId">
          <div><label class="block text-xs font-bold text-slate-500 uppercase mb-1">Judul</label><input type="text" name="title" id="eventTitle" class="w-full border rounded-lg p-3 text-sm" required></div>
          <div><label class="block text-xs font-bold text-slate-500 uppercase mb-1">Deskripsi</label><textarea name="description" id="eventDescription" rows="3" class="w-full border rounded-lg p-3 text-sm resize-none"></textarea></div>
          <div><label class="block text-xs font-bold text-slate-500 uppercase mb-2">Warna</label>
            <div class="flex gap-4 overflow-x-auto pb-2">
                <label class="cursor-pointer"><input type="radio" name="color" value="#3b82f6" class="peer sr-only" checked><div class="w-10 h-10 rounded-full bg-blue-500 peer-checked:ring-2 peer-checked:ring-offset-2 peer-checked:ring-blue-500"></div></label>
                <label class="cursor-pointer"><input type="radio" name="color" value="#10b981" class="peer sr-only"><div class="w-10 h-10 rounded-full bg-emerald-500 peer-checked:ring-2 peer-checked:ring-offset-2 peer-checked:ring-emerald-500"></div></label>
                <label class="cursor-pointer"><input type="radio" name="color" value="#ef4444" class="peer sr-only"><div class="w-10 h-10 rounded-full bg-red-500 peer-checked:ring-2 peer-checked:ring-offset-2 peer-checked:ring-red-500"></div></label>
                <label class="cursor-pointer"><input type="radio" name="color" value="#f59e0b" class="peer sr-only"><div class="w-10 h-10 rounded-full bg-amber-500 peer-checked:ring-2 peer-checked:ring-offset-2 peer-checked:ring-amber-500"></div></label>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div><label class="block text-xs font-bold text-slate-500 uppercase mb-1">Mulai</label><input type="datetime-local" name="start" id="eventStart" class="w-full border rounded-lg p-2 text-sm" required></div>
            <div><label class="block text-xs font-bold text-slate-500 uppercase mb-1">Selesai</label><input type="datetime-local" name="end" id="eventEnd" class="w-full border rounded-lg p-2 text-sm" required></div>
          </div>
          <div class="flex flex-col-reverse md:flex-row justify-between gap-3 pt-4 border-t mt-2">
            <button type="button" id="btnDelete" class="hidden w-full md:w-auto text-red-500 border border-red-200 py-3 md:py-2 px-4 rounded-lg text-sm font-bold hover:bg-red-50">Hapus Event</button>
            <div class="flex flex-col md:flex-row gap-3 w-full md:w-auto ml-auto">
                <button type="button" onclick="closeModal()" class="w-full md:w-auto px-4 py-3 md:py-2 text-slate-500 bg-slate-100 rounded-lg text-sm font-medium">Batal</button>
                <button type="submit" class="w-full md:w-auto px-6 py-3 md:py-2 bg-blue-600 text-white font-medium rounded-lg shadow-md text-sm">Simpan</button>
            </div>
          </div>
        </form>
      </div>
    </div>
    <script>
      let calendar; const modal=document.getElementById('eventModal'), form=document.getElementById('eventForm'), btnDelete=document.getElementById('btnDelete');
      const tooltip=document.getElementById('customTooltip'), tooltipTitle=document.getElementById('tooltipTitle'), tooltipContent=document.getElementById('tooltipContent'), tooltipMeta=document.getElementById('tooltipMeta'); let tooltipTimer;
      const isMobile = window.innerWidth < 768;
      function openModal(e){modal.classList.remove('hidden');if(e){document.getElementById('modalTitle').textContent='Edit Event';document.getElementById('eventId').value=e.id;document.getElementById('eventTitle').value=e.title;document.getElementById('eventDescription').value=e.extendedProps.description||'';document.getElementById('eventStart').value=e.startStr.slice(0,16);document.getElementById('eventEnd').value=e.endStr?e.endStr.slice(0,16):e.startStr.slice(0,16);const r=document.querySelector(\`input[name="color"][value="\${e.backgroundColor}"]\`);if(r)r.checked=true;btnDelete.classList.remove('hidden');btnDelete.onclick=()=>deleteEvent(e.id)}else{document.getElementById('modalTitle').textContent='Event Baru';form.reset();document.getElementById('eventId').value='';btnDelete.classList.add('hidden')}}
      function closeModal(){modal.classList.add('hidden')}
      async function deleteEvent(id){if(confirm('Hapus?')) await fetch('/api/events/'+id,{method:'DELETE'}).then(r=>{if(r.ok){calendar.getEventById(id).remove();closeModal()}else alert('Gagal')})}
      document.addEventListener('DOMContentLoaded',function(){calendar=new FullCalendar.Calendar(document.getElementById('calendar'),{initialView:'dayGridMonth',headerToolbar:isMobile?{left:'prev,next',center:'title',right:''}:{left:'prev,next today',center:'title',right:'dayGridMonth,timeGridWeek,listWeek'},events:'/api/events',height:'100%',editable:true,dayMaxEvents:true,eventClick:i=>openModal(i.event),eventDidMount:function(i){const el=i.el;if(!isMobile){el.addEventListener('mouseenter',e=>{tooltipTimer=setTimeout(()=>{tooltipTitle.innerText=i.event.title;tooltipContent.innerText=i.event.extendedProps.description||"-";tooltipMeta.innerText="Oleh: "+i.event.extendedProps.created_by;tooltip.style.left=(e.pageX+15)+'px';tooltip.style.top=(e.pageY+15)+'px';tooltip.classList.remove('hidden');setTimeout(()=>tooltip.classList.remove('opacity-0'),10)},2000)});el.addEventListener('mouseleave',()=>{clearTimeout(tooltipTimer);tooltip.classList.add('opacity-0');tooltip.classList.add('hidden')})}},eventDrop:async i=>fetch('/api/events/'+i.event.id,{method:'PUT',body:JSON.stringify({title:i.event.title,description:i.event.extendedProps.description,start_time:i.event.start.toISOString(),end_time:i.event.end?i.event.end.toISOString():i.event.start.toISOString(),color:i.event.backgroundColor})})});calendar.render();form.addEventListener('submit',async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));if(new Date(d.start)>=new Date(d.end)){alert('Waktu salah');return}const url=d.id?'/api/events/'+d.id:'/api/events';const m=d.id?'PUT':'POST';await fetch(url,{method:m,body:JSON.stringify({title:d.title,description:d.description,start_time:d.start,end_time:d.end,color:d.color})}).then(r=>{if(r.ok){calendar.refetchEvents();closeModal()}else alert('Error')})})});
    </script>
  `, 'Dashboard', user));
});

// 3. CASHFLOW
app.get('/cashflow', async (c) => {
  const user = await getSession(c);
  if (!user) return c.redirect('/');
  const { results } = await c.env.DB.prepare('SELECT * FROM cashflow ORDER BY transaction_date ASC, id ASC').all();
  let runningBalance = 0;
  const data = results.map((row: any) => { runningBalance += row.amount; return { ...row, balance: runningBalance }; }).reverse(); 
  return c.html(Layout(html`
    <div class="h-full flex flex-col bg-slate-50">
      <div class="bg-white border-b border-gray-200 px-4 md:px-8 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm">
        <div class="w-full md:w-auto flex justify-between items-center">
            <div><h1 class="text-xl md:text-2xl font-bold text-slate-800">Buku Kas</h1><p class="text-slate-500 text-xs">Pemasukan & Pengeluaran</p></div>
            <div class="md:hidden text-right"><span class="text-[10px] text-gray-500 uppercase font-bold">Saldo</span><div class="text-lg font-bold ${runningBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}">${formatRupiah(runningBalance)}</div></div>
        </div>
        <div class="w-full md:w-auto flex flex-col md:flex-row gap-3 items-end md:items-center">
            <div class="hidden md:block text-right mr-4"><span class="text-xs text-gray-500 uppercase font-bold">Saldo Saat Ini</span><div class="text-3xl font-bold ${runningBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}">${formatRupiah(runningBalance)}</div></div>
            <button onclick="document.getElementById('cashModal').classList.remove('hidden')" class="w-full md:w-auto bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium shadow-md transition flex justify-center items-center gap-2 active:bg-emerald-800"><span>+</span> Transaksi</button>
        </div>
      </div>
      <div class="flex-1 p-0 md:p-6 overflow-hidden flex flex-col">
         <div class="md:rounded-xl shadow border-t md:border border-gray-200 overflow-x-auto bg-white flex-1">
            <table class="w-full text-left border-collapse min-w-[600px] md:min-w-full">
                <thead class="bg-slate-100 text-slate-600 uppercase text-[10px] md:text-xs font-bold sticky top-0 z-10"><tr><th class="px-4 md:px-6 py-3 border-b">Tanggal</th><th class="px-4 md:px-6 py-3 border-b">Keterangan</th><th class="px-4 md:px-6 py-3 border-b text-right text-emerald-600">Masuk</th><th class="px-4 md:px-6 py-3 border-b text-right text-red-600">Keluar</th><th class="px-4 md:px-6 py-3 border-b text-right">Saldo</th><th class="px-4 md:px-6 py-3 border-b text-center">Aksi</th></tr></thead>
                <tbody class="divide-y divide-gray-100 text-xs md:text-sm bg-white">${data.length === 0 ? html`<tr><td colspan="6" class="p-8 text-center text-gray-400">Belum ada transaksi</td></tr>` : ''}${data.map((item: any) => html`<tr class="hover:bg-slate-50 transition group"><td class="px-4 md:px-6 py-3 font-medium text-slate-700 whitespace-nowrap">${item.transaction_date}</td><td class="px-4 md:px-6 py-3 text-slate-600 max-w-[150px] truncate">${item.description}</td><td class="px-4 md:px-6 py-3 text-right font-medium text-emerald-600">${item.amount > 0 ? formatRupiah(item.amount) : '-'}</td><td class="px-4 md:px-6 py-3 text-right font-medium text-red-600">${item.amount < 0 ? formatRupiah(Math.abs(item.amount)) : '-'}</td><td class="px-4 md:px-6 py-3 text-right font-bold text-slate-700 bg-slate-50/50">${formatRupiah(item.balance)}</td><td class="px-4 md:px-6 py-3 text-center"><button onclick="deleteCash(${item.id})" class="text-red-400 hover:text-red-600 md:opacity-0 group-hover:opacity-100 transition p-2">🗑️</button></td></tr>`)}</tbody>
            </table>
         </div>
      </div>
    </div>
    <!-- Cash Modal Hidden -->
    <div id="cashModal" class="hidden fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4">
        <div class="bg-white rounded-t-2xl md:rounded-2xl shadow-2xl w-full md:max-w-md animate-slide-up md:animate-none">
            <div class="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl"><h2 class="text-lg font-bold text-slate-800">Catat Transaksi</h2><button onclick="document.getElementById('cashModal').classList.add('hidden')" class="text-slate-400 text-2xl p-2">&times;</button></div>
            <form action="/api/cashflow" method="POST" class="p-6 space-y-4"><div><label class="block text-xs font-bold text-slate-500 uppercase mb-1">Tanggal</label><input type="date" name="date" class="w-full border rounded-lg p-3 text-sm bg-slate-50" required value="${new Date().toISOString().split('T')[0]}"></div><div><label class="block text-xs font-bold text-slate-500 uppercase mb-1">Tipe</label><div class="grid grid-cols-2 gap-3"><label class="cursor-pointer"><input type="radio" name="type" value="IN" class="peer sr-only" checked><div class="text-center py-3 rounded-lg border border-slate-200 peer-checked:bg-emerald-100 peer-checked:border-emerald-500 peer-checked:text-emerald-700 font-bold transition text-sm">💰 Masuk</div></label><label class="cursor-pointer"><input type="radio" name="type" value="OUT" class="peer sr-only"><div class="text-center py-3 rounded-lg border border-slate-200 peer-checked:bg-red-100 peer-checked:border-red-500 peer-checked:text-red-700 font-bold transition text-sm">💸 Keluar</div></label></div></div><div><label class="block text-xs font-bold text-slate-500 uppercase mb-1">Keterangan</label><input type="text" name="description" placeholder="Contoh: Beli Snack" class="w-full border rounded-lg p-3 text-sm outline-none" required></div><div><label class="block text-xs font-bold text-slate-500 uppercase mb-1">Jumlah</label><input type="number" name="amount" placeholder="0" class="w-full border rounded-lg p-3 text-sm outline-none font-mono" required min="1"></div><div class="pt-2"><button class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg shadow-md transition text-sm">Simpan</button></div></form>
        </div>
    </div>
    <script>async function deleteCash(id){if(!confirm('Hapus transaksi ini?'))return;const res=await fetch('/api/cashflow/'+id,{method:'DELETE'});if(res.ok)window.location.reload();else alert('Gagal')}</script>
  `, 'Buku Kas', user));
});

// 4. NOTES PAGE (NEW FEATURE)
app.get('/notes', async (c) => {
  const user = await getSession(c);
  if (!user) return c.redirect('/');
  
  return c.html(Layout(html`
    <div class="h-full flex flex-col bg-slate-50">
        <!-- Header -->
        <div class="bg-white border-b border-gray-200 px-4 md:px-8 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 shadow-sm">
            <div>
                <h1 class="text-xl md:text-2xl font-bold text-slate-800">Catatan & Dokumen</h1>
                <p id="statusSync" class="text-slate-500 text-xs flex items-center gap-1">
                    <span class="w-2 h-2 rounded-full bg-slate-400"></span> Memuat data...
                </p>
            </div>
            <div class="flex gap-2 w-full md:w-auto">
                 <button onclick="createNote(true)" class="flex-1 md:flex-none bg-amber-100 hover:bg-amber-200 text-amber-800 px-4 py-2 rounded-lg font-medium transition text-sm flex justify-center items-center gap-2">
                    <i data-lucide="folder-plus" class="w-4 h-4"></i> Folder
                </button>
                <button onclick="createNote(false)" class="flex-1 md:flex-none bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg font-medium shadow-md transition text-sm flex justify-center items-center gap-2">
                    <i data-lucide="plus" class="w-4 h-4"></i> Catatan
                </button>
            </div>
        </div>

        <!-- Breadcrumbs Navigation -->
        <div class="bg-white border-b border-gray-100 px-4 md:px-8 py-2 overflow-x-auto whitespace-nowrap">
            <div id="breadcrumbs" class="flex items-center text-sm text-slate-600">
                <!-- Injected via JS -->
            </div>
        </div>

        <!-- Notes Grid/List -->
        <div class="flex-1 p-4 md:p-6 overflow-y-auto">
            <div id="notesContainer" class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                <!-- Injected via JS -->
            </div>
        </div>
    </div>

    <!-- Note Editor Modal -->
    <div id="noteModal" class="hidden fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-0 md:p-4">
        <div class="bg-white w-full h-full md:h-auto md:max-w-2xl md:rounded-2xl shadow-2xl flex flex-col animate-slide-up md:animate-none">
            <div class="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 md:rounded-t-2xl">
                <input id="noteTitleInput" class="text-lg font-bold text-slate-800 bg-transparent border-none focus:ring-0 w-full" placeholder="Judul Catatan...">
                <button onclick="closeNoteModal()" class="text-slate-400 text-2xl p-2">&times;</button>
            </div>
            <div class="flex-1 p-6 overflow-y-auto bg-amber-50/30">
                <textarea id="noteContentInput" class="w-full h-full bg-transparent border-none outline-none resize-none text-slate-700 leading-relaxed" placeholder="Tulis sesuatu..."></textarea>
            </div>
            <div class="p-4 border-t border-slate-100 bg-white flex justify-between items-center md:rounded-b-2xl">
                 <button id="btnDeleteNote" class="text-red-500 hover:bg-red-50 px-4 py-2 rounded-lg text-sm font-bold">Hapus</button>
                 <div class="flex gap-2">
                    <button onclick="closeNoteModal()" class="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg text-sm font-medium">Batal</button>
                    <button onclick="saveCurrentNote()" class="px-6 py-2 bg-amber-600 text-white font-medium rounded-lg shadow-md text-sm">Simpan</button>
                 </div>
            </div>
        </div>
    </div>

    <!-- Logic Script -->
    <script>
        // --- INDEXED DB HELPER ---
        const DB_NAME = 'TeamAppDB';
        const STORE_NAME = 'notes';
        const dbPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });

        async function idbGetAll() {
            const db = await dbPromise;
            return new Promise((resolve) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const req = store.getAll();
                req.onsuccess = () => resolve(req.result);
            });
        }

        async function idbPut(note) {
            const db = await dbPromise;
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put(note);
            return tx.complete;
        }
        
        async function idbDelete(id) {
            const db = await dbPromise;
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).delete(id);
            return tx.complete;
        }

        // --- APP LOGIC ---
        let allNotes = [];
        let currentFolderId = null; // null = root
        let currentNoteId = null;

        const container = document.getElementById('notesContainer');
        const breadcrumbs = document.getElementById('breadcrumbs');
        const statusSync = document.getElementById('statusSync');

        // 1. SYNC LOGIC (The Core Feature)
        async function syncNotes() {
            // A. Load Local First (Instant UI)
            const localData = await idbGetAll();
            if(localData.length > 0) {
                allNotes = localData;
                renderNotes();
                updateStatus('Offline Mode (Data Lokal)', 'bg-orange-400');
            }

            // B. Try Fetch from Server
            try {
                const res = await fetch('/api/notes');
                if (!res.ok) throw new Error('Network error');
                const serverData = await res.json();
                
                // C. Update Local DB
                allNotes = serverData;
                const db = await dbPromise;
                const tx = db.transaction(STORE_NAME, 'readwrite');
                // Clear old data and put new (Simplified sync strategy)
                tx.objectStore(STORE_NAME).clear(); 
                serverData.forEach(note => tx.objectStore(STORE_NAME).put(note));
                
                renderNotes();
                updateStatus('Tersinkronisasi (Online)', 'bg-emerald-500');
            } catch (e) {
                console.log('Offline or Sync Error', e);
                // Keep showing local data
            }
        }

        function updateStatus(text, colorClass) {
            statusSync.innerHTML = \`<span class="w-2 h-2 rounded-full \${colorClass}"></span> \${text}\`;
        }

        // 2. RENDER LOGIC
        function renderNotes() {
            container.innerHTML = '';
            
            // Filter by current folder
            const visibleItems = allNotes.filter(n => n.parent_id === currentFolderId);
            
            // Sort: Folders first, then Notes
            visibleItems.sort((a, b) => b.is_folder - a.is_folder || a.title.localeCompare(b.title));

            if (visibleItems.length === 0) {
                container.innerHTML = '<div class="col-span-full text-center text-gray-400 py-10">Folder ini kosong</div>';
            }

            visibleItems.forEach(item => {
                const el = document.createElement('div');
                const isFolder = item.is_folder === 1;
                el.className = isFolder 
                    ? 'bg-amber-50 border border-amber-200 p-4 rounded-xl cursor-pointer hover:bg-amber-100 transition shadow-sm flex flex-col items-center justify-center text-center h-32'
                    : 'bg-white border border-gray-200 p-4 rounded-xl cursor-pointer hover:shadow-md transition shadow-sm h-32 flex flex-col justify-between relative';
                
                if(isFolder) {
                    el.innerHTML = \`<i data-lucide="folder" class="w-10 h-10 text-amber-400 mb-2"></i><span class="font-bold text-sm text-slate-700 line-clamp-2">\${item.title}</span>\`;
                    el.onclick = () => openFolder(item.id);
                } else {
                    el.innerHTML = \`
                        <div><h3 class="font-bold text-sm text-slate-800 line-clamp-1 mb-1">\${item.title}</h3><p class="text-xs text-slate-500 line-clamp-3">\${item.content || '...'}</p></div>
                        <div class="text-[10px] text-gray-400 mt-2 self-end">\${new Date(item.updated_at).toLocaleDateString()}</div>
                    \`;
                    el.onclick = () => openNote(item);
                }
                container.appendChild(el);
            });
            lucide.createIcons();
            renderBreadcrumbs();
        }

        function renderBreadcrumbs() {
            let path = [{id: null, title: '🏠 Home'}];
            let tempId = currentFolderId;
            
            // Traverse up
            while(tempId) {
                const folder = allNotes.find(n => n.id === tempId);
                if(folder) {
                    path.unshift({id: folder.id, title: folder.title});
                    tempId = folder.parent_id;
                } else {
                    tempId = null;
                }
            }

            breadcrumbs.innerHTML = path.map((p, idx) => {
                const isLast = idx === path.length - 1;
                return \`
                    <span class="flex items-center cursor-pointer \${isLast ? 'font-bold text-slate-800' : 'hover:underline'}" onclick="openFolder('\${p.id}')">
                        \${p.title}
                    </span>
                    \${!isLast ? '<i data-lucide="chevron-right" class="w-4 h-4 mx-1 text-slate-400"></i>' : ''}
                \`;
            }).join('');
            lucide.createIcons();
        }

        function openFolder(id) {
            currentFolderId = id === 'null' ? null : id;
            renderNotes();
        }

        // 3. EDIT/CREATE LOGIC
        const modal = document.getElementById('noteModal');
        const titleInput = document.getElementById('noteTitleInput');
        const contentInput = document.getElementById('noteContentInput');
        const btnDelete = document.getElementById('btnDeleteNote');

        function createNote(isFolder) {
            currentNoteId = null;
            titleInput.value = '';
            contentInput.value = '';
            
            if(isFolder) {
                const name = prompt("Nama Folder:");
                if(name) saveItem({ title: name, is_folder: 1, content: '' });
            } else {
                // Open Modal
                modal.classList.remove('hidden');
                titleInput.focus();
                btnDelete.classList.add('hidden'); // Cannot delete new note
            }
        }

        function openNote(note) {
            currentNoteId = note.id;
            titleInput.value = note.title;
            contentInput.value = note.content;
            modal.classList.remove('hidden');
            btnDelete.classList.remove('hidden');
            btnDelete.onclick = () => deleteItem(note.id);
        }

        function closeNoteModal() {
            modal.classList.add('hidden');
        }

        async function saveCurrentNote() {
            const title = titleInput.value || 'Tanpa Judul';
            const content = contentInput.value;
            await saveItem({ title, content, is_folder: 0 });
            closeNoteModal();
        }

        async function saveItem(data) {
            updateStatus('Menyimpan...', 'bg-yellow-400');
            
            const payload = {
                id: currentNoteId,
                title: data.title,
                content: data.content,
                is_folder: data.is_folder,
                parent_id: currentFolderId
            };

            const url = currentNoteId ? \`/api/notes/\${currentNoteId}\` : '/api/notes';
            const method = currentNoteId ? 'PUT' : 'POST';

            try {
                const res = await fetch(url, {
                    method: method,
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(payload)
                });
                if(res.ok) {
                    await syncNotes(); // Refresh from server
                } else {
                    alert('Gagal menyimpan ke server');
                }
            } catch(e) {
                alert('Gagal koneksi. Perubahan belum disimpan (Offline Write belum didukung di demo ini).');
            }
        }

        async function deleteItem(id) {
            if(!confirm('Hapus item ini?')) return;
            try {
                await fetch(\`/api/notes/\${id}\`, { method: 'DELETE' });
                closeNoteModal();
                await syncNotes();
            } catch(e) { alert('Gagal menghapus'); }
        }

        // Init
        document.addEventListener('DOMContentLoaded', syncNotes);

    </script>
  `, 'Catatan', user));
});

// 5. ADMIN
app.get('/admin', async (c) => {
  const user = await getSession(c);
  if (!user || user.role !== 'admin') return c.redirect('/dashboard');
  const { results: allUsers } = await c.env.DB.prepare('SELECT * FROM users').all();
  return c.html(Layout(html`
    <div class="p-4 md:p-8 h-full overflow-auto pb-20 md:pb-8">
      <h1 class="text-2xl md:text-3xl font-bold text-slate-800 mb-6 md:mb-8">Admin Panel</h1>
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden max-w-4xl">
          <div class="p-4 md:p-6 border-b border-gray-100 bg-gray-50"><h3 class="font-bold text-slate-700">Manajemen User</h3></div>
          <div class="p-4 md:p-6">
            <form action="/api/users" method="POST" class="flex flex-col md:flex-row gap-3 mb-8 bg-blue-50 p-4 rounded-xl border border-blue-100">
               <div class="flex-1"><label class="text-xs font-bold text-blue-800 uppercase mb-1 block">Username</label><input name="username" class="border border-blue-200 p-2 rounded w-full text-sm" required></div>
               <div class="flex-1"><label class="text-xs font-bold text-blue-800 uppercase mb-1 block">Password</label><input name="password" class="border border-blue-200 p-2 rounded w-full text-sm" required></div>
               <div class="w-full md:w-32"><label class="text-xs font-bold text-blue-800 uppercase mb-1 block">Role</label><select name="role" class="border border-blue-200 p-2 rounded w-full text-sm bg-white"><option value="member">Member</option><option value="admin">Admin</option></select></div>
               <button class="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded font-bold text-sm shadow-md h-[38px] mt-auto">Tambah</button>
            </form>
            <div class="overflow-x-auto">
                <table class="w-full text-sm text-left min-w-[300px]"><thead class="bg-slate-100 text-slate-600 uppercase text-xs font-bold"><tr><th class="px-4 py-3">User</th><th class="px-4 py-3">Role</th><th class="px-4 py-3 text-right">Aksi</th></tr></thead>
                <tbody class="divide-y divide-gray-100">${allUsers.map((u: any) => html`<tr class="hover:bg-slate-50"><td class="px-4 py-3 font-medium text-slate-700">${u.username}</td><td class="px-4 py-3">${u.role}</td><td class="px-4 py-3 text-right"><button class="text-red-500 hover:bg-red-50 px-3 py-1 rounded text-xs font-bold" onclick="if(confirm('Hapus?')) fetch('/api/users/${u.id}',{method:'DELETE'}).then(()=>location.reload())">HAPUS</button></td></tr>`)}</tbody>
                </table>
            </div>
          </div>
        </div>
    </div>
  `, 'Admin Panel', user));
});

// --- API ---

// NOTES API (NEW)
app.get('/api/notes', async (c) => {
    const session = await getSession(c); if (!session) return c.json({error:'401'},401);
    // Fetch ALL notes (hierarchy handled in frontend)
    const { results } = await c.env.DB.prepare('SELECT * FROM notes ORDER BY updated_at DESC').all();
    return c.json(results);
});
app.post('/api/notes', async (c) => {
    const session = await getSession(c); if (!session) return c.json({error:'401'},401);
    const b = await c.req.json();
    const id = crypto.randomUUID();
    const now = Date.now();
    await c.env.DB.prepare('INSERT INTO notes (id, parent_id, title, content, is_folder, updated_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(id, b.parent_id || null, b.title, b.content, b.is_folder, now, session.username).run();
    return c.json({ success: true, id });
});
app.put('/api/notes/:id', async (c) => {
    const session = await getSession(c); if (!session) return c.json({error:'401'},401);
    const b = await c.req.json();
    const id = c.req.param('id');
    const now = Date.now();
    await c.env.DB.prepare('UPDATE notes SET title=?, content=?, updated_at=? WHERE id=?')
        .bind(b.title, b.content, now, id).run();
    return c.json({ success: true });
});
app.delete('/api/notes/:id', async (c) => {
    const session = await getSession(c); if (!session) return c.json({error:'401'},401);
    const id = c.req.param('id');
    // Recursive delete is hard in pure SQL without triggers, for MVP we delete just the item.
    // In production, you should check if it's a folder and delete children too.
    await c.env.DB.prepare('DELETE FROM notes WHERE id=?').bind(id).run();
    return c.json({ success: true });
});

// PREVIOUS API (Events, Cashflow, Users) - Keep them minimal to save space
app.get('/api/events', async (c) => { const s=await getSession(c); if(!s)return c.json({},401); const {results}=await c.env.DB.prepare('SELECT * FROM events').all(); return c.json(results.map((e:any)=>({...e, extendedProps:{created_by:e.created_by,description:e.description},backgroundColor:e.color||'#3b82f6',borderColor:e.color}))); });
app.post('/api/events', async (c) => { const s=await getSession(c); if(!s)return c.json({},401); const b=await c.req.json(); await c.env.DB.prepare('INSERT INTO events (title,description,start_time,end_time,color,created_by) VALUES (?,?,?,?,?,?)').bind(b.title,b.description,b.start_time,b.end_time,b.color,s.username).run(); return c.json({ok:true}); });
app.put('/api/events/:id', async (c) => { const s=await getSession(c); if(!s)return c.json({},401); const b=await c.req.json(); await c.env.DB.prepare('UPDATE events SET title=?,description=?,start_time=?,end_time=?,color=? WHERE id=?').bind(b.title,b.description,b.start_time,b.end_time,b.color,c.req.param('id')).run(); return c.json({ok:true}); });
app.delete('/api/events/:id', async (c) => { const s=await getSession(c); if(!s)return c.json({},401); await c.env.DB.prepare('DELETE FROM events WHERE id=?').bind(c.req.param('id')).run(); return c.json({ok:true}); });
app.post('/api/cashflow', async (c) => { const s=await getSession(c); if(!s)return c.redirect('/'); const b=await c.req.parseBody(); const a=Number(b.amount); await c.env.DB.prepare('INSERT INTO cashflow (transaction_date,description,amount,created_by) VALUES (?,?,?,?)').bind(b.date,b.description,b.type==='OUT'?-Math.abs(a):Math.abs(a),s.username).run(); return c.redirect('/cashflow'); });
app.delete('/api/cashflow/:id', async (c) => { const s=await getSession(c); if(!s||s.role!=='admin')return c.json({},403); await c.env.DB.prepare('DELETE FROM cashflow WHERE id=?').bind(c.req.param('id')).run(); return c.json({ok:true}); });
app.post('/api/users', async (c) => { const s=await getSession(c); if(!s||s.role!=='admin')return c.redirect('/admin'); const b=await c.req.parseBody(); try{await c.env.DB.prepare('INSERT INTO users (username,password,role) VALUES (?,?,?)').bind(b.username,await hashPassword(String(b.password)),b.role).run()}catch{} return c.redirect('/admin'); });
app.delete('/api/users/:id', async (c) => { const s=await getSession(c); if(!s||s.role!=='admin')return c.json({},403); await c.env.DB.prepare('DELETE FROM users WHERE id=?').bind(c.req.param('id')).run(); return c.json({ok:true}); });

export default app;

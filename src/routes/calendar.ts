import { Hono } from 'hono';
import { html } from 'hono/html';
import { Bindings } from '../bindings';
import { Layout } from '../layout';
import { getSession } from '../utils';

const app = new Hono<{ Bindings: Bindings }>();

// PAGE
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
    
    <!-- Modal HTML (Sama seperti sebelumnya) -->
    <div id="eventModal" class="hidden fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4">
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

// API
app.get('/api/events', async (c) => {
  const session = await getSession(c);
  if (!session) return c.json({ error: 'Unauthorized' }, 401);
  const { results } = await c.env.DB.prepare('SELECT * FROM events').all();
  return c.json(results.map((e: any) => ({
    id: e.id, title: e.title, start: e.start_time, end: e.end_time, backgroundColor: e.color || '#3b82f6', borderColor: e.color || '#3b82f6', extendedProps: { created_by: e.created_by, description: e.description }
  })));
});
app.post('/api/events', async (c) => { const s=await getSession(c); if(!s)return c.json({},401); const b=await c.req.json(); await c.env.DB.prepare('INSERT INTO events (title,description,start_time,end_time,color,created_by) VALUES (?,?,?,?,?,?)').bind(b.title,b.description,b.start_time,b.end_time,b.color,s.username).run(); return c.json({ok:true}); });
app.put('/api/events/:id', async (c) => { const s=await getSession(c); if(!s)return c.json({},401); const b=await c.req.json(); await c.env.DB.prepare('UPDATE events SET title=?,description=?,start_time=?,end_time=?,color=? WHERE id=?').bind(b.title,b.description,b.start_time,b.end_time,b.color,c.req.param('id')).run(); return c.json({ok:true}); });
app.delete('/api/events/:id', async (c) => { const s=await getSession(c); if(!s)return c.json({},401); await c.env.DB.prepare('DELETE FROM events WHERE id=?').bind(c.req.param('id')).run(); return c.json({ok:true}); });

export default app;

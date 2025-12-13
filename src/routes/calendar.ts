import { Hono } from 'hono';
import { html } from 'hono/html';
import { Bindings } from '../bindings';
import { Layout } from '../layout';
import { getSession } from '../utils';

const app = new Hono<{ Bindings: Bindings }>();

// PAGE
app.get('/calendar', async (c) => {
  const user = await getSession(c);
  if (!user) return c.redirect('/');

  return c.html(Layout(html`
    <div class="h-full flex flex-col">
      <!-- Header Utama -->
      <div class="bg-white border-b border-gray-200 px-4 md:px-8 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 shadow-sm z-20">
        <div>
          <h1 class="text-xl md:text-2xl font-bold text-slate-800">Jadwal Tim</h1>
          <p class="text-slate-500 text-xs">Kegiatan & Agenda</p>
        </div>
        <button onclick="openModal()" class="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-md transition text-sm flex justify-center items-center gap-2 active:bg-blue-800">
          <i data-lucide="plus" class="w-4 h-4"></i> Tambah Event
        </button>
      </div>

      <!-- Legend / Keterangan Warna -->
      <div class="bg-slate-50 border-b border-gray-200 px-4 md:px-8 py-2 flex flex-wrap gap-x-4 gap-y-2 text-[10px] md:text-xs text-slate-600 z-10">
         <div class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-violet-600"></span> <span>BPH</span></div>
         <div class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-blue-600"></span> <span>Bidang</span></div>
         <div class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-emerald-600"></span> <span>Bipeka</span></div>
         <div class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-amber-600"></span> <span>Struktural DPC+</span></div>
         <div class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full bg-red-600"></span> <span>Aleg</span></div>
      </div>
      
      <!-- Calendar Wrapper -->
      <div class="flex-1 bg-white p-2 md:p-6 overflow-hidden relative">
         <div id="calendar" class="h-full font-sans text-xs md:text-sm"></div>
      </div>
    </div>

    <!-- Modal Form -->
    <div id="eventModal" class="hidden fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4 transition-opacity">
      <div class="bg-white rounded-t-2xl md:rounded-2xl shadow-2xl w-full md:max-w-md h-[90vh] md:h-auto flex flex-col animate-slide-up md:animate-none">
        <div class="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
            <h2 id="modalTitle" class="text-lg font-bold text-slate-800">Event</h2>
            <button onclick="closeModal()" class="text-slate-400 text-2xl p-2">&times;</button>
        </div>
        
        <form id="eventForm" class="p-6 space-y-4 overflow-y-auto flex-1">
          <input type="hidden" name="id" id="eventId">
          
          <!-- Judul -->
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Judul Agenda</label>
            <input type="text" name="title" id="eventTitle" class="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" required placeholder="Contoh: Rapat Koordinasi">
          </div>

          <!-- Kategori (Radio Button List) -->
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase mb-2">Kategori (Wajib Pilih)</label>
            <div class="flex flex-col gap-2">
                
                <label class="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-violet-50 has-[:checked]:border-violet-500 has-[:checked]:bg-violet-50 transition">
                    <input type="radio" name="color" value="#7c3aed" class="peer w-4 h-4 text-violet-600 focus:ring-violet-500" checked>
                    <span class="w-3 h-3 rounded-full bg-violet-600"></span>
                    <span class="text-sm font-medium text-slate-700">Agenda BPH</span>
                </label>

                <label class="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-blue-50 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50 transition">
                    <input type="radio" name="color" value="#2563eb" class="peer w-4 h-4 text-blue-600 focus:ring-blue-500">
                    <span class="w-3 h-3 rounded-full bg-blue-600"></span>
                    <span class="text-sm font-medium text-slate-700">Agenda Bidang</span>
                </label>

                <label class="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-emerald-50 has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50 transition">
                    <input type="radio" name="color" value="#059669" class="peer w-4 h-4 text-emerald-600 focus:ring-emerald-500">
                    <span class="w-3 h-3 rounded-full bg-emerald-600"></span>
                    <span class="text-sm font-medium text-slate-700">Agenda Bipeka</span>
                </label>

                <label class="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-amber-50 has-[:checked]:border-amber-500 has-[:checked]:bg-amber-50 transition">
                    <input type="radio" name="color" value="#d97706" class="peer w-4 h-4 text-amber-600 focus:ring-amber-500">
                    <span class="w-3 h-3 rounded-full bg-amber-600"></span>
                    <span class="text-sm font-medium text-slate-700">Agenda Struktural DPC+</span>
                </label>

                <label class="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-red-50 has-[:checked]:border-red-500 has-[:checked]:bg-red-50 transition">
                    <input type="radio" name="color" value="#dc2626" class="peer w-4 h-4 text-red-600 focus:ring-red-500">
                    <span class="w-3 h-3 rounded-full bg-red-600"></span>
                    <span class="text-sm font-medium text-slate-700">Agenda Aleg</span>
                </label>

            </div>
          </div>

          <!-- Deskripsi -->
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Deskripsi</label>
            <textarea name="description" id="eventDescription" rows="2" class="w-full border border-slate-300 rounded-lg p-3 text-sm resize-none focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Detail tambahan..."></textarea>
          </div>

          <!-- Waktu -->
          <div class="grid grid-cols-2 gap-3">
            <div>
                <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Mulai</label>
                <input type="datetime-local" name="start" id="eventStart" class="w-full border border-slate-300 rounded-lg p-2 text-sm" required>
            </div>
            <div>
                <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Selesai</label>
                <input type="datetime-local" name="end" id="eventEnd" class="w-full border border-slate-300 rounded-lg p-2 text-sm" required>
            </div>
          </div>

          <!-- Tombol Aksi -->
          <div class="flex flex-col-reverse md:flex-row justify-between gap-3 pt-4 border-t mt-2">
            <button type="button" id="btnDelete" class="hidden w-full md:w-auto text-red-500 border border-red-200 py-3 md:py-2 px-4 rounded-lg text-sm font-bold hover:bg-red-50 transition">Hapus Event</button>
            <div class="flex flex-col md:flex-row gap-3 w-full md:w-auto ml-auto">
                <button type="button" onclick="closeModal()" class="w-full md:w-auto px-4 py-3 md:py-2 text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium transition">Batal</button>
                <button type="submit" class="w-full md:w-auto px-6 py-3 md:py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-md text-sm transition">Simpan</button>
            </div>
          </div>
        </form>
      </div>
    </div>

    <script>
      let calendar; 
      const modal=document.getElementById('eventModal'); 
      const form=document.getElementById('eventForm'); 
      const btnDelete=document.getElementById('btnDelete');
      
      // Tooltip elements
      const tooltip=document.getElementById('customTooltip'); 
      const tooltipTitle=document.getElementById('tooltipTitle'); 
      const tooltipContent=document.getElementById('tooltipContent'); 
      const tooltipMeta=document.getElementById('tooltipMeta'); 
      let tooltipTimer;
      
      const isMobile = window.innerWidth < 768;

      function openModal(e){
          modal.classList.remove('hidden'); 
          if(e){
              // EDIT MODE
              document.getElementById('modalTitle').textContent='Edit Event'; 
              document.getElementById('eventId').value=e.id; 
              document.getElementById('eventTitle').value=e.title; 
              document.getElementById('eventDescription').value=e.extendedProps.description||''; 
              document.getElementById('eventStart').value=e.startStr.slice(0,16); 
              document.getElementById('eventEnd').value=e.endStr?e.endStr.slice(0,16):e.startStr.slice(0,16); 
              
              // Pilih radio button berdasarkan warna hex
              const r=document.querySelector(\`input[name="color"][value="\${e.backgroundColor}"]\`);
              if(r) r.checked=true; 
              
              btnDelete.classList.remove('hidden'); 
              btnDelete.onclick=()=>deleteEvent(e.id)
          } else {
              // CREATE MODE
              document.getElementById('modalTitle').textContent='Event Baru'; 
              form.reset(); 
              document.getElementById('eventId').value=''; 
              btnDelete.classList.add('hidden');
              // Default select BPH
              document.querySelector('input[name="color"][value="#7c3aed"]').checked = true;
          }
      }

      function closeModal(){modal.classList.add('hidden')}

      async function deleteEvent(id){
          if(confirm('Hapus event ini?')) 
          await fetch('/api/events/'+id,{method:'DELETE'}).then(r=>{
              if(r.ok){ calendar.getEventById(id).remove(); closeModal(); }
              else alert('Gagal menghapus')
          })
      }
      
      document.addEventListener('DOMContentLoaded',function(){
        calendar=new FullCalendar.Calendar(document.getElementById('calendar'),{
          initialView: 'dayGridMonth', 
          headerToolbar: isMobile 
            ? { left: 'prev,next', center: 'title', right: '' } 
            : { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,listWeek' },
          events:'/api/events', 
          height:'100%', 
          editable:true, 
          dayMaxEvents: true,
          
          eventClick:i=>openModal(i.event),
          
          eventDidMount:function(i){
             const el=i.el;
             if(!isMobile) { 
                el.addEventListener('mouseenter',e=>{ 
                    tooltipTimer=setTimeout(()=>{ 
                        tooltipTitle.innerText=i.event.title; 
                        tooltipContent.innerText=i.event.extendedProps.description||"-"; 
                        tooltipMeta.innerText="Oleh: "+i.event.extendedProps.created_by; 
                        tooltip.style.left=(e.pageX+15)+'px'; 
                        tooltip.style.top=(e.pageY+15)+'px'; 
                        tooltip.classList.remove('hidden'); 
                        setTimeout(()=>tooltip.classList.remove('opacity-0'),10) 
                    },2000)
                });
                el.addEventListener('mouseleave',()=>{ 
                    clearTimeout(tooltipTimer); 
                    tooltip.classList.add('opacity-0'); 
                    tooltip.classList.add('hidden')
                });
             }
          },
          
          eventDrop:async i=> fetch('/api/events/'+i.event.id,{
              method:'PUT',
              body:JSON.stringify({
                  title:i.event.title,
                  description:i.event.extendedProps.description,
                  start_time:i.event.start.toISOString(),
                  end_time:i.event.end?i.event.end.toISOString():i.event.start.toISOString(),
                  color:i.event.backgroundColor
              })
          })
        }); 
        calendar.render();

        form.addEventListener('submit',async e=>{ 
            e.preventDefault(); 
            const d=Object.fromEntries(new FormData(e.target)); 
            if(new Date(d.start)>=new Date(d.end)){alert('Waktu selesai harus lebih besar dari waktu mulai');return} 
            
            const url=d.id?'/api/events/'+d.id:'/api/events'; 
            const m=d.id?'PUT':'POST'; 
            
            await fetch(url,{
                method:m,
                body:JSON.stringify({
                    title:d.title,
                    description:d.description,
                    start_time:d.start,
                    end_time:d.end,
                    color:d.color
                })
            }).then(r=>{
                if(r.ok){ calendar.refetchEvents(); closeModal(); }
                else alert('Error menyimpan event')
            }) 
        })
      });
    </script>
  `, 'Kalender', user));
});

// API Routes
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
    extendedProps: { created_by: e.created_by, description: e.description }
  })));
});

app.post('/api/events', async (c) => { 
  const s = await getSession(c); 
  if(!s) return c.json({},401); 
  const b = await c.req.json(); 
  await c.env.DB.prepare('INSERT INTO events (title,description,start_time,end_time,color,created_by) VALUES (?,?,?,?,?,?)').bind(b.title,b.description,b.start_time,b.end_time,b.color,s.username).run(); 
  return c.json({ok:true}); 
});

app.put('/api/events/:id', async (c) => { 
  const s = await getSession(c); 
  if(!s) return c.json({},401); 
  const b = await c.req.json(); 
  await c.env.DB.prepare('UPDATE events SET title=?,description=?,start_time=?,end_time=?,color=? WHERE id=?').bind(b.title,b.description,b.start_time,b.end_time,b.color,c.req.param('id')).run(); 
  return c.json({ok:true}); 
});

app.delete('/api/events/:id', async (c) => { 
  const s = await getSession(c); 
  if(!s) return c.json({},401); 
  await c.env.DB.prepare('DELETE FROM events WHERE id=?').bind(c.req.param('id')).run(); 
  return c.json({ok:true}); 
});

export default app;

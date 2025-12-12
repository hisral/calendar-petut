import { Hono } from 'hono';
import { html } from 'hono/html';
import { Bindings } from '../bindings';
import { Layout } from '../layout';
import { getSession, formatRupiah } from '../utils';

const app = new Hono<{ Bindings: Bindings }>();

app.get('/home', async (c) => {
  const user = await getSession(c);
  if (!user) return c.redirect('/');

  // 1. Ambil Saldo Kas
  const balanceQuery: any = await c.env.DB.prepare('SELECT SUM(amount) as total FROM cashflow').first();
  const currentBalance = balanceQuery.total || 0;

  // 2. Ambil 5 Event Mendatang (Hari ini & Kedepan)
  // SQLite date('now') menggunakan UTC. Jika ingin WIB, bisa pakai datetime('now', '+7 hours')
  const events = await c.env.DB.prepare(`
    SELECT * FROM events 
    WHERE date(start_time) >= date('now') 
    ORDER BY start_time ASC 
    LIMIT 5
  `).all();

  // 3. Ambil 4 Catatan Terakhir Diupdate
  const notes = await c.env.DB.prepare('SELECT * FROM notes WHERE is_folder = 0 ORDER BY updated_at DESC LIMIT 4').all();

  return c.html(Layout(html`
    <div class="p-6 h-full overflow-y-auto bg-slate-50">
      <div class="mb-8">
        <h1 class="text-2xl font-bold text-slate-800">Halo, ${user.username}! 👋</h1>
        <p class="text-slate-500 text-sm">Berikut ringkasan aktivitas tim hari ini.</p>
      </div>

      <!-- WIDGETS GRID -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        
        <!-- Widget Saldo -->
        <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between h-32 relative overflow-hidden group">
            <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:scale-110 transition"><i data-lucide="wallet" class="w-16 h-16 text-emerald-500"></i></div>
            <div class="text-sm font-bold text-slate-500 uppercase tracking-wider">Saldo Kas</div>
            <div class="text-3xl font-bold ${currentBalance >= 0 ? 'text-slate-800' : 'text-red-500'}">
                ${formatRupiah(currentBalance)}
            </div>
            <a href="/cashflow" class="text-xs text-emerald-600 font-bold hover:underline mt-2">Lihat Detail →</a>
        </div>

        <!-- Widget Event Hari Ini -->
        <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between h-32 relative overflow-hidden group">
            <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:scale-110 transition"><i data-lucide="calendar" class="w-16 h-16 text-blue-500"></i></div>
            <div class="text-sm font-bold text-slate-500 uppercase tracking-wider">Agenda Mendatang</div>
            <div class="text-3xl font-bold text-slate-800">
                ${events.results.length} <span class="text-sm font-normal text-slate-400">Event</span>
            </div>
            <a href="/calendar" class="text-xs text-blue-600 font-bold hover:underline mt-2">Buka Kalender →</a>
        </div>

        <!-- Widget Catatan -->
        <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between h-32 relative overflow-hidden group">
            <div class="absolute right-0 top-0 p-4 opacity-10 group-hover:scale-110 transition"><i data-lucide="sticky-note" class="w-16 h-16 text-amber-500"></i></div>
            <div class="text-sm font-bold text-slate-500 uppercase tracking-wider">Catatan Terbaru</div>
            <div class="text-3xl font-bold text-slate-800">
                ${notes.results.length} <span class="text-sm font-normal text-slate-400">Update</span>
            </div>
            <a href="/notes" class="text-xs text-amber-600 font-bold hover:underline mt-2">Kelola Catatan →</a>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <!-- LIST EVENT -->
        <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h3 class="font-bold text-slate-700 mb-4 flex items-center gap-2"><i data-lucide="clock" class="w-4 h-4"></i> Segera Datang</h3>
            <div class="space-y-3">
                ${events.results.length === 0 ? html`<p class="text-sm text-slate-400 italic">Tidak ada agenda dekat.</p>` : ''}
                ${events.results.map((e: any) => html`
                    <div class="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition border-l-4" style="border-color: ${e.color || '#3b82f6'}">
                        <div class="flex-1">
                            <div class="font-bold text-sm text-slate-800">${e.title}</div>
                            <div class="text-xs text-slate-500">
                                ${new Date(e.start_time).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })} 
                                • ${new Date(e.start_time).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}
                            </div>
                        </div>
                    </div>
                `)}
            </div>
        </div>

        <!-- LIST NOTES -->
        <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h3 class="font-bold text-slate-700 mb-4 flex items-center gap-2"><i data-lucide="edit-3" class="w-4 h-4"></i> Catatan Terakhir</h3>
            <div class="space-y-3">
                 ${notes.results.length === 0 ? html`<p class="text-sm text-slate-400 italic">Belum ada catatan.</p>` : ''}
                 ${notes.results.map((n: any) => html`
                    <div class="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition">
                        <i data-lucide="file-text" class="w-5 h-5 text-amber-400"></i>
                        <div class="flex-1">
                            <div class="font-bold text-sm text-slate-800 line-clamp-1">${n.title}</div>
                            <div class="text-xs text-slate-500">Oleh ${n.created_by} • ${new Date(n.updated_at).toLocaleDateString('id-ID')}</div>
                        </div>
                    </div>
                `)}
            </div>
        </div>
      </div>
    </div>
  `, 'Home', user));
});

export default app;

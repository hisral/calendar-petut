import { Hono } from 'hono';
import { html } from 'hono/html';
import { Bindings } from '../bindings';
import { Layout } from '../layout';
import { getSession, formatRupiah, canWrite } from '../utils';

const app = new Hono<{ Bindings: Bindings }>();

// PAGE
app.get('/cashflow', async (c) => {
  const user = await getSession(c);
  if (!user) return c.redirect('/');
  
  const isWriter = canWrite(user);
  
  // 1. Ambil Parameter Filter dari URL
  const categoryFilter = c.req.query('cat') || 'all'; // Default 'all'

  // 2. Siapkan Query SQL
  let query = 'SELECT * FROM cashflow';
  let params: any[] = [];

  if (categoryFilter !== 'all') {
      query += ' WHERE category = ?';
      params.push(categoryFilter);
  }
  
  query += ' ORDER BY transaction_date ASC, id ASC';

  // 3. Eksekusi Query
  const { results } = await c.env.DB.prepare(query).bind(...params).all();

  // 4. Hitung Saldo Berjalan (Running Balance) sesuai data yang ditarik
  let runningBalance = 0;
  const data = results.map((row: any) => { 
      runningBalance += row.amount; 
      return { ...row, balance: runningBalance }; 
  }).reverse(); // Balik urutan agar yang terbaru diatas

  // Helper untuk styling tombol filter aktif
  const activeClass = "bg-emerald-600 text-white shadow-md";
  const inactiveClass = "bg-white text-slate-600 hover:bg-emerald-50 border border-slate-200";

  return c.html(Layout(html`
    <div class="h-full flex flex-col bg-slate-50">
      
      <!-- HEADER & FILTER -->
      <div class="bg-white border-b border-gray-200 px-4 md:px-8 py-4 flex flex-col gap-4 shadow-sm z-10">
        
        <!-- Top Row: Judul & Saldo -->
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 class="text-xl md:text-2xl font-bold text-slate-800">Buku Kas</h1>
              <p class="text-slate-500 text-xs">
                Filter: <span class="font-bold text-emerald-600 uppercase">${categoryFilter === 'all' ? 'Gabungan' : categoryFilter.replace('_', ' ')}</span>
              </p>
            </div>
            
            <div class="flex flex-col items-end">
                <span class="text-[10px] text-gray-500 uppercase font-bold">Saldo ${categoryFilter === 'all' ? 'Total' : 'Kategori Ini'}</span>
                <div class="text-2xl md:text-3xl font-bold ${runningBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}">
                    ${formatRupiah(runningBalance)}
                </div>
            </div>
        </div>

        <!-- Bottom Row: Tabs Filter & Tombol Aksi -->
        <div class="flex flex-col md:flex-row justify-between items-center gap-3">
            <!-- Filter Tabs -->
            <div class="flex p-1 bg-slate-100 rounded-lg overflow-x-auto max-w-full no-scrollbar gap-1">
                <a href="/cashflow" class="px-4 py-1.5 rounded-md text-xs font-bold transition whitespace-nowrap ${categoryFilter === 'all' ? 'bg-white text-emerald-600 shadow' : 'text-slate-500 hover:text-emerald-600'}">Semua</a>
                <a href="/cashflow?cat=umum" class="px-4 py-1.5 rounded-md text-xs font-bold transition whitespace-nowrap ${categoryFilter === 'umum' ? 'bg-white text-emerald-600 shadow' : 'text-slate-500 hover:text-emerald-600'}">Umum</a>
                <a href="/cashflow?cat=yatim" class="px-4 py-1.5 rounded-md text-xs font-bold transition whitespace-nowrap ${categoryFilter === 'yatim' ? 'bg-white text-emerald-600 shadow' : 'text-slate-500 hover:text-emerald-600'}">Dana Yatim</a>
                <a href="/cashflow?cat=beras" class="px-4 py-1.5 rounded-md text-xs font-bold transition whitespace-nowrap ${categoryFilter === 'beras' ? 'bg-white text-emerald-600 shadow' : 'text-slate-500 hover:text-emerald-600'}">Patungan Beras</a>
            </div>

            ${isWriter ? html`
            <button onclick="document.getElementById('cashModal').classList.remove('hidden')" class="w-full md:w-auto bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium shadow-md transition flex justify-center items-center gap-2 text-sm active:bg-emerald-800">
                <i data-lucide="plus-circle" class="w-4 h-4"></i> Catat Transaksi
            </button>
            ` : ''}
        </div>
      </div>

      <!-- TABLE -->
      <div class="flex-1 p-0 md:p-6 overflow-hidden flex flex-col">
         <div class="md:rounded-xl shadow border-t md:border border-gray-200 overflow-x-auto bg-white flex-1">
            <table class="w-full text-left border-collapse min-w-[700px] md:min-w-full">
                <thead class="bg-slate-100 text-slate-600 uppercase text-[10px] md:text-xs font-bold sticky top-0 z-10">
                    <tr>
                        <th class="px-4 md:px-6 py-3 border-b w-32">Tanggal</th>
                        <th class="px-4 md:px-6 py-3 border-b">Keterangan</th>
                        <th class="px-4 md:px-6 py-3 border-b w-32">Kategori</th>
                        <th class="px-4 md:px-6 py-3 border-b text-right text-emerald-600 w-32">Masuk</th>
                        <th class="px-4 md:px-6 py-3 border-b text-right text-red-600 w-32">Keluar</th>
                        <th class="px-4 md:px-6 py-3 border-b text-right w-36">Saldo</th>
                        <th class="px-4 md:px-6 py-3 border-b text-center w-16">Aksi</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 text-xs md:text-sm bg-white">
                    ${data.length === 0 ? html`<tr><td colspan="7" class="p-8 text-center text-gray-400">Belum ada transaksi di kategori ini.</td></tr>` : ''}
                    ${data.map((item: any) => html`
                    <tr class="hover:bg-slate-50 transition group">
                        <td class="px-4 md:px-6 py-3 font-medium text-slate-700 whitespace-nowrap">${item.transaction_date}</td>
                        <td class="px-4 md:px-6 py-3 text-slate-600">
                            ${item.description}
                            <div class="text-[10px] text-gray-400 md:hidden mt-1 capitalize">${item.category.replace('_', ' ')}</div>
                        </td>
                        <td class="px-4 md:px-6 py-3">
                            <span class="inline-flex items-center px-2 py-1 rounded text-[10px] font-bold uppercase
                                ${item.category === 'yatim' ? 'bg-purple-100 text-purple-700 border border-purple-200' : 
                                  item.category === 'beras' ? 'bg-orange-100 text-orange-700 border border-orange-200' : 
                                  'bg-slate-100 text-slate-600 border border-slate-200'}">
                                ${item.category.replace('_', ' ')}
                            </span>
                        </td>
                        <td class="px-4 md:px-6 py-3 text-right font-medium text-emerald-600">
                            ${item.amount > 0 ? formatRupiah(item.amount) : '-'}
                        </td>
                        <td class="px-4 md:px-6 py-3 text-right font-medium text-red-600">
                            ${item.amount < 0 ? formatRupiah(Math.abs(item.amount)) : '-'}
                        </td>
                        <td class="px-4 md:px-6 py-3 text-right font-bold text-slate-700 bg-slate-50/50">
                            ${formatRupiah(item.balance)}
                        </td>
                        <td class="px-4 md:px-6 py-3 text-center">
                            ${isWriter ? html`
                            <button onclick="deleteCash(${item.id})" class="text-red-400 hover:text-red-600 md:opacity-0 group-hover:opacity-100 transition p-2" title="Hapus">
                                <i data-lucide="trash-2" class="w-4 h-4"></i>
                            </button>
                            ` : html`<span class="text-gray-300">-</span>`}
                        </td>
                    </tr>
                    `)}
                </tbody>
            </table>
         </div>
      </div>
    </div>

    <!-- MODAL ADD TRANSAKSI -->
    <div id="cashModal" class="hidden fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4">
        <div class="bg-white rounded-t-2xl md:rounded-2xl shadow-2xl w-full md:max-w-md animate-slide-up md:animate-none">
            <div class="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
                <h2 class="text-lg font-bold text-slate-800">Catat Transaksi</h2>
                <button onclick="document.getElementById('cashModal').classList.add('hidden')" class="text-slate-400 text-2xl p-2 hover:text-red-500">&times;</button>
            </div>
            
            <form action="/api/cashflow" method="POST" class="p-6 space-y-4">
                
                <!-- Tanggal -->
                <div>
                    <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Tanggal</label>
                    <input type="date" name="date" class="w-full border rounded-lg p-2.5 text-sm bg-slate-50 focus:ring-2 focus:ring-emerald-500 outline-none" required value="${new Date().toISOString().split('T')[0]}">
                </div>

                <!-- Kategori (NEW) -->
                <div>
                    <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Kategori Dana</label>
                    <select name="category" class="w-full border rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none">
                        <option value="umum">Umum / Operasional</option>
                        <option value="yatim">Santunan Yatim</option>
                        <option value="beras">Patungan Beras</option>
                    </select>
                </div>

                <!-- Tipe (Masuk/Keluar) -->
                <div>
                    <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Jenis Transaksi</label>
                    <div class="grid grid-cols-2 gap-3">
                        <label class="cursor-pointer">
                            <input type="radio" name="type" value="IN" class="peer sr-only" checked>
                            <div class="flex items-center justify-center gap-2 py-3 rounded-lg border border-slate-200 peer-checked:bg-emerald-100 peer-checked:border-emerald-500 peer-checked:text-emerald-700 font-bold transition text-sm">
                                <i data-lucide="arrow-down-circle" class="w-4 h-4"></i> Masuk
                            </div>
                        </label>
                        <label class="cursor-pointer">
                            <input type="radio" name="type" value="OUT" class="peer sr-only">
                            <div class="flex items-center justify-center gap-2 py-3 rounded-lg border border-slate-200 peer-checked:bg-red-100 peer-checked:border-red-500 peer-checked:text-red-700 font-bold transition text-sm">
                                <i data-lucide="arrow-up-circle" class="w-4 h-4"></i> Keluar
                            </div>
                        </label>
                    </div>
                </div>

                <!-- Keterangan -->
                <div>
                    <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Keterangan</label>
                    <input type="text" name="description" placeholder="Contoh: Donasi dari Hamba Allah / Beli Karung" class="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" required>
                </div>

                <!-- Jumlah -->
                <div>
                    <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Jumlah (Rp)</label>
                    <input type="number" name="amount" placeholder="0" class="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-mono" required min="1">
                </div>

                <div class="pt-2">
                    <button class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg shadow-md transition text-sm flex justify-center items-center gap-2">
                        <i data-lucide="save" class="w-4 h-4"></i> Simpan
                    </button>
                </div>
            </form>
        </div>
    </div>

    <script>
      async function deleteCash(id){
          if(!confirm('Hapus transaksi ini?'))return;
          const res = await fetch('/api/cashflow/'+id,{method:'DELETE'});
          if(res.ok) window.location.reload();
          else alert('Gagal menghapus (Akses Ditolak)');
      }
      lucide.createIcons();
    </script>
  `, 'Buku Kas', user));
});

// API POST (Updated to save category)
app.post('/api/cashflow', async (c) => { 
    const s = await getSession(c); 
    if(!s || !canWrite(s)) return c.text('Forbidden', 403);
    
    const b = await c.req.parseBody(); 
    const a = Number(b.amount); 
    
    // Simpan Category ke DB
    await c.env.DB.prepare('INSERT INTO cashflow (transaction_date, description, amount, category, created_by) VALUES (?, ?, ?, ?, ?)')
        .bind(
            b.date, 
            b.description, 
            b.type==='OUT' ? -Math.abs(a) : Math.abs(a), // Logic Minus untuk keluar
            b.category, // Field baru
            s.username
        ).run(); 
        
    return c.redirect('/cashflow'); 
});

app.delete('/api/cashflow/:id', async (c) => { 
    const s = await getSession(c); 
    if(!s || !canWrite(s)) return c.json({error:'Forbidden'}, 403); 
    
    await c.env.DB.prepare('DELETE FROM cashflow WHERE id=?').bind(c.req.param('id')).run(); 
    return c.json({success:true}); 
});

export default app;

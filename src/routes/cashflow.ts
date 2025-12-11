import { Hono } from 'hono';
import { html } from 'hono/html';
import { Bindings } from '../bindings';
import { Layout } from '../layout';
import { getSession, formatRupiah } from '../utils';

const app = new Hono<{ Bindings: Bindings }>();

// PAGE
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
    <div id="cashModal" class="hidden fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4">
        <div class="bg-white rounded-t-2xl md:rounded-2xl shadow-2xl w-full md:max-w-md animate-slide-up md:animate-none">
            <div class="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl"><h2 class="text-lg font-bold text-slate-800">Catat Transaksi</h2><button onclick="document.getElementById('cashModal').classList.add('hidden')" class="text-slate-400 text-2xl p-2">&times;</button></div>
            <form action="/api/cashflow" method="POST" class="p-6 space-y-4"><div><label class="block text-xs font-bold text-slate-500 uppercase mb-1">Tanggal</label><input type="date" name="date" class="w-full border rounded-lg p-3 text-sm bg-slate-50" required value="${new Date().toISOString().split('T')[0]}"></div><div><label class="block text-xs font-bold text-slate-500 uppercase mb-1">Tipe</label><div class="grid grid-cols-2 gap-3"><label class="cursor-pointer"><input type="radio" name="type" value="IN" class="peer sr-only" checked><div class="text-center py-3 rounded-lg border border-slate-200 peer-checked:bg-emerald-100 peer-checked:border-emerald-500 peer-checked:text-emerald-700 font-bold transition text-sm">💰 Masuk</div></label><label class="cursor-pointer"><input type="radio" name="type" value="OUT" class="peer sr-only"><div class="text-center py-3 rounded-lg border border-slate-200 peer-checked:bg-red-100 peer-checked:border-red-500 peer-checked:text-red-700 font-bold transition text-sm">💸 Keluar</div></label></div></div><div><label class="block text-xs font-bold text-slate-500 uppercase mb-1">Keterangan</label><input type="text" name="description" placeholder="Contoh: Beli Snack" class="w-full border rounded-lg p-3 text-sm outline-none" required></div><div><label class="block text-xs font-bold text-slate-500 uppercase mb-1">Jumlah</label><input type="number" name="amount" placeholder="0" class="w-full border rounded-lg p-3 text-sm outline-none font-mono" required min="1"></div><div class="pt-2"><button class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg shadow-md transition text-sm">Simpan</button></div></form>
        </div>
    </div>
    <script>async function deleteCash(id){if(!confirm('Hapus transaksi ini?'))return;const res=await fetch('/api/cashflow/'+id,{method:'DELETE'});if(res.ok)window.location.reload();else alert('Gagal')}</script>
  `, 'Buku Kas', user));
});

// API
app.post('/api/cashflow', async (c) => { const s=await getSession(c); if(!s)return c.redirect('/'); const b=await c.req.parseBody(); const a=Number(b.amount); await c.env.DB.prepare('INSERT INTO cashflow (transaction_date,description,amount,created_by) VALUES (?,?,?,?)').bind(b.date,b.description,b.type==='OUT'?-Math.abs(a):Math.abs(a),s.username).run(); return c.redirect('/cashflow'); });
app.delete('/api/cashflow/:id', async (c) => { const s=await getSession(c); if(!s||s.role!=='admin')return c.json({},403); await c.env.DB.prepare('DELETE FROM cashflow WHERE id=?').bind(c.req.param('id')).run(); return c.json({ok:true}); });

export default app;

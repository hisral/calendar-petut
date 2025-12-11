import { Hono } from 'hono';
import { html } from 'hono/html';
import { Bindings } from '../bindings';
import { Layout } from '../layout';
import { getSession, hashPassword } from '../utils';

const app = new Hono<{ Bindings: Bindings }>();

// PAGE
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

// API
app.post('/api/users', async (c) => { const s=await getSession(c); if(!s||s.role!=='admin')return c.redirect('/admin'); const b=await c.req.parseBody(); try{await c.env.DB.prepare('INSERT INTO users (username,password,role) VALUES (?,?,?)').bind(b.username,await hashPassword(String(b.password)),b.role).run()}catch{} return c.redirect('/admin'); });
app.delete('/api/users/:id', async (c) => { const s=await getSession(c); if(!s||s.role!=='admin')return c.json({},403); await c.env.DB.prepare('DELETE FROM users WHERE id=?').bind(c.req.param('id')).run(); return c.json({ok:true}); });

export default app;

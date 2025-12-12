import { Hono } from 'hono';
import { html } from 'hono/html';
import { Bindings } from '../bindings';
import { Layout } from '../layout';
import { getSession } from '../utils';

const app = new Hono<{ Bindings: Bindings }>();

// PAGE
app.get('/notes', async (c) => {
  const user = await getSession(c);
  if (!user) return c.redirect('/');
  
  return c.html(Layout(html`
    <div class="h-full flex flex-col bg-slate-50">
        <!-- Header -->
        <div class="bg-white border-b border-gray-200 px-4 md:px-8 py-4 flex flex-col md:flex-row justify-between items-center gap-3 shadow-sm">
            <div class="w-full md:w-auto">
                <h1 class="text-xl md:text-2xl font-bold text-slate-800">Catatan & Dokumen</h1>
                <p id="statusSync" class="text-slate-500 text-xs flex items-center gap-1">
                    <span class="w-2 h-2 rounded-full bg-slate-400"></span> Memuat data...
                </p>
            </div>

            <!-- SEARCH BAR (BARU) -->
            <div class="relative w-full md:w-64 order-last md:order-none">
                <input type="text" placeholder="Cari catatan..." oninput="searchNotes(this.value)" 
                    class="w-full pl-9 pr-4 py-2 bg-slate-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none transition">
                <i data-lucide="search" class="w-4 h-4 text-slate-400 absolute left-3 top-2.5"></i>
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
            <div id="breadcrumbs" class="flex items-center text-sm text-slate-600 min-h-[24px]">
                <!-- Diisi via JS -->
            </div>
        </div>

        <!-- Notes Grid/List -->
        <div class="flex-1 p-4 md:p-6 overflow-y-auto">
            <div id="notesContainer" class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                <!-- Diisi via JS -->
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

        // --- APP LOGIC ---
        let allNotes = [];
        let currentFolderId = null; // null = root
        let currentNoteId = null;
        let searchTerm = ''; // Variabel Pencarian

        const container = document.getElementById('notesContainer');
        const breadcrumbs = document.getElementById('breadcrumbs');
        const statusSync = document.getElementById('statusSync');

        // SYNC LOGIC
        async function syncNotes() {
            // Load Local
            const localData = await idbGetAll();
            if(localData.length > 0) {
                allNotes = localData;
                renderNotes();
                updateStatus('Offline Mode', 'bg-orange-400');
            }
            // Fetch Server
            try {
                const res = await fetch('/api/notes');
                if (!res.ok) throw new Error('Err');
                const serverData = await res.json();
                allNotes = serverData;
                const db = await dbPromise;
                const tx = db.transaction(STORE_NAME, 'readwrite');
                tx.objectStore(STORE_NAME).clear(); 
                serverData.forEach(note => tx.objectStore(STORE_NAME).put(note));
                renderNotes();
                updateStatus('Online', 'bg-emerald-500');
            } catch (e) { console.log(e); }
        }

        function updateStatus(text, colorClass) {
            statusSync.innerHTML = \`<span class="w-2 h-2 rounded-full \${colorClass}"></span> \${text}\`;
        }

        // SEARCH FUNCTION
        function searchNotes(val) {
            searchTerm = val.toLowerCase();
            renderNotes();
        }

        // RENDER LOGIC
        function renderNotes() {
            container.innerHTML = '';
            
            let visibleItems = [];

            if (searchTerm.trim() !== '') {
                // MODE PENCARIAN: Cari di semua catatan (abaikan folder)
                visibleItems = allNotes.filter(n => 
                    n.title.toLowerCase().includes(searchTerm) || 
                    (n.content && n.content.toLowerCase().includes(searchTerm))
                );
                // Update Breadcrumb Khusus Search
                breadcrumbs.innerHTML = \`<span class="font-bold text-amber-600 flex items-center gap-2"><i data-lucide="search" class="w-4 h-4"></i> Hasil Pencarian: "\${searchTerm}"</span>\`;
            } else {
                // MODE FOLDER: Filter berdasarkan Parent ID
                visibleItems = allNotes.filter(n => n.parent_id === currentFolderId);
                renderBreadcrumbs(); // Kembalikan breadcrumb normal
            }
            
            // Sort: Folder dulu, baru Note
            visibleItems.sort((a, b) => b.is_folder - a.is_folder || a.title.localeCompare(b.title));

            if (visibleItems.length === 0) {
                container.innerHTML = '<div class="col-span-full text-center text-gray-400 py-10">Tidak ditemukan item.</div>';
            }

            visibleItems.forEach(item => {
                const el = document.createElement('div');
                const isFolder = item.is_folder === 1;
                el.className = isFolder 
                    ? 'bg-amber-50 border border-amber-200 p-4 rounded-xl cursor-pointer hover:bg-amber-100 transition shadow-sm flex flex-col items-center justify-center text-center h-32'
                    : 'bg-white border border-gray-200 p-4 rounded-xl cursor-pointer hover:shadow-md transition shadow-sm h-32 flex flex-col justify-between relative';
                
                if(isFolder) {
                    el.innerHTML = \`<i data-lucide="folder" class="w-10 h-10 text-amber-400 mb-2"></i><span class="font-bold text-sm text-slate-700 line-clamp-2">\${item.title}</span>\`;
                    el.onclick = () => {
                         if(searchTerm !== '') {
                             // Jika sedang search, klik folder akan reset search dan masuk folder itu
                             document.querySelector('input[type="text"]').value = '';
                             searchTerm = '';
                             openFolder(item.id);
                         } else {
                             openFolder(item.id);
                         }
                    };
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
        }

        function renderBreadcrumbs() {
            let path = [{id: null, title: '🏠 Home'}];
            let tempId = currentFolderId;
            // Traverse up
            let safeCounter = 0;
            while(tempId && safeCounter < 10) { // Safety break
                const folder = allNotes.find(n => n.id === tempId);
                if(folder) {
                    path.unshift({id: folder.id, title: folder.title});
                    tempId = folder.parent_id;
                } else {
                    tempId = null;
                }
                safeCounter++;
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

        // CRUD LOGIC
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
                modal.classList.remove('hidden');
                titleInput.focus();
                btnDelete.classList.add('hidden');
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
            
            // Jika sedang search, simpan di root (atau folder terakhir dibuka)
            // Disini kita biarkan parent_id = currentFolderId
            
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
                    await syncNotes();
                } else {
                    alert('Gagal menyimpan ke server');
                }
            } catch(e) {
                alert('Gagal koneksi. Perubahan belum disimpan.');
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

// API (ENDPOINTS)
app.get('/api/notes', async (c) => {
    const session = await getSession(c); if (!session) return c.json({error:'401'},401);
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
    await c.env.DB.prepare('DELETE FROM notes WHERE id=?').bind(id).run();
    return c.json({ success: true });
});

export default app;

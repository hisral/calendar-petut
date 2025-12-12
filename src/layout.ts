import { html } from 'hono/html';

export const Layout = (content: any, title: string, user?: any) => html`
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${title}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src='https://cdn.jsdelivr.net/npm/fullcalendar@6.1.10/index.global.min.js'></script>
  <script src="https://unpkg.com/lucide@latest"></script>
  <style>
    body { -webkit-tap-highlight-color: transparent; }
    #customTooltip { position: fixed; z-index: 9999; pointer-events: none; transform: translate(10px, 10px); }
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
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
    <div class="h-16 flex items-center px-6 text-xl font-bold border-b border-slate-700 bg-slate-800 tracking-tight">📅 Team App</div>
    <nav class="flex-1 px-3 py-6 space-y-1">
      <div class="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Menu</div>
      
      <!-- Menu Home -->
      <a href="/home" class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 transition ${title === 'Home' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-300'}">
        <i data-lucide="layout-dashboard" class="w-4 h-4"></i> <span>Home</span>
      </a>

      <!-- Menu Kalender (Dipindah dari Dashboard) -->
      <a href="/calendar" class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 transition ${title === 'Kalender' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-300'}">
        <i data-lucide="calendar" class="w-4 h-4"></i> <span>Kalender</span>
      </a>

      <a href="/cashflow" class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 transition ${title === 'Buku Kas' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-300'}">
        <i data-lucide="wallet" class="w-4 h-4"></i> <span>Buku Kas</span>
      </a>
      
      <a href="/notes" class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 transition ${title === 'Catatan' ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-300'}">
        <i data-lucide="sticky-note" class="w-4 h-4"></i> <span>Catatan</span>
      </a>

      ${user.role === 'admin' ? html`<div class="mt-4 px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Admin</div><a href="/admin" class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 transition ${title === 'Admin Panel' ? 'bg-slate-800 text-white' : 'text-slate-300'}"><i data-lucide="settings" class="w-4 h-4"></i> <span>Panel</span></a>` : ''}
    </nav>
    <div class="p-4 border-t border-slate-700 bg-slate-800/50">
       <div class="flex items-center gap-3 mb-3"><div class="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center font-bold text-xs shadow-lg">${user.username.charAt(0).toUpperCase()}</div><div><p class="text-sm font-medium text-white">${user.username}</p></div></div>
      <form action="/logout" method="post"><button type="submit" class="w-full bg-slate-700 hover:bg-red-600 text-slate-300 py-2 rounded-lg text-xs font-medium transition">Logout</button></form>
    </div>
  </aside>

  <!-- MOBILE BOTTOM NAV -->
  <nav class="md:hidden fixed bottom-0 w-full bg-white border-t border-gray-200 flex justify-around items-center h-16 z-40 pb-safe">
    <a href="/home" class="flex flex-col items-center justify-center w-full h-full ${title === 'Home' ? 'text-indigo-600' : 'text-gray-400'}"><i data-lucide="home" class="w-5 h-5"></i><span class="text-[10px] font-medium mt-1">Home</span></a>
    <a href="/calendar" class="flex flex-col items-center justify-center w-full h-full ${title === 'Kalender' ? 'text-blue-600' : 'text-gray-400'}"><i data-lucide="calendar" class="w-5 h-5"></i><span class="text-[10px] font-medium mt-1">Jadwal</span></a>
    <a href="/cashflow" class="flex flex-col items-center justify-center w-full h-full ${title === 'Buku Kas' ? 'text-emerald-600' : 'text-gray-400'}"><i data-lucide="wallet" class="w-5 h-5"></i><span class="text-[10px] font-medium mt-1">Kas</span></a>
    <a href="/notes" class="flex flex-col items-center justify-center w-full h-full ${title === 'Catatan' ? 'text-amber-600' : 'text-gray-400'}"><i data-lucide="sticky-note" class="w-5 h-5"></i><span class="text-[10px] font-medium mt-1">Note</span></a>
  </nav>
  ` : ''}

  <main class="flex-1 flex flex-col overflow-hidden relative w-full pb-16 md:pb-0">
    ${content}
  </main>
  
  <div id="customTooltip" class="hidden max-w-[200px] bg-slate-800 text-white text-xs p-2 rounded shadow-xl border border-slate-600 opacity-0 transition-opacity duration-300">
    <div id="tooltipTitle" class="font-bold text-blue-300 mb-1 border-b border-slate-600 pb-1"></div>
    <div id="tooltipContent" class="text-slate-200"></div>
    <div id="tooltipMeta" class="mt-1 text-[10px] text-slate-500 italic"></div>
  </div>
  <script>lucide.createIcons();</script>
</body>
</html>
`;

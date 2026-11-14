{
'use strict';
/* =====================================================================
   Klecks – Nachhilfe-Plattform
   Rollen: Lehrkraft (Editor/Owner des Artifacts) & Schüler (Profil + PIN)
   Speicher: claude db (geteilte Sammlungen), Dateien: claude assets
   ===================================================================== */

const COLS = ['settings','groups','students','entries','homework','hwstatus','courses','progress','exams','termine','notifs','notifread'];
const KD = window.KlecksData;
const FACH = {
  Mathe:{c:'var(--mathe)',hex:'#2448d8',g:'÷'},
  Deutsch:{c:'var(--deutsch)',hex:'#ff6a4d',g:'Aa'},
  Englisch:{c:'var(--englisch)',hex:'#8a6cff',g:'En'},
  Sonstiges:{c:'var(--sonstiges)',hex:'#1fae84',g:'?'}
};
const FAECHER = Object.keys(FACH);
const COLORS = ['#2448d8','#ff6a4d','#8a6cff','#1fae84','#e84a8a','#f29e1f','#2fa4d8','#6b6680'];
const WD = ['So','Mo','Di','Mi','Do','Fr','Sa'];
const WDL = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
const MON = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

const S = {
  db:null, user:null, assets:null, preview:false, readOnly:false, isEditor:false,
  d:Object.fromEntries(COLS.map(c=>[c,[]])), loaded:{}, ready:false, slow:false,
  session:null, route:'start', ui:{fach:'Alle', hwTab:'offen', stud:'alle', course:null, calMonth:null, calDay:null, open:{}},
  m:null, p:null
};

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const pad = n => String(n).padStart(2,'0');
const ymd = d => d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const today = () => ymd(new Date());
const parse = s => { const [y,m,d] = String(s).split('-').map(Number); return new Date(y,(m||1)-1,d||1); };
const addDays = (s,n) => { const d = parse(s); d.setDate(d.getDate()+n); return ymd(d); };
const diffDays = s => Math.round((parse(s) - parse(today()))/864e5);
const fmt = s => { if(!s) return ''; const d = parse(s); return WD[d.getDay()]+', '+d.getDate()+'.'+(d.getMonth()+1)+'.'; };
const fmtLong = s => { const d = parse(s); return WDL[d.getDay()]+', '+d.getDate()+'. '+MON[d.getMonth()]; };
const rel = s => { const n = diffDays(s); if(n===0) return 'heute'; if(n===1) return 'morgen'; if(n===-1) return 'gestern'; if(n>1 && n<7) return 'in '+n+' Tagen'; if(n<0) return 'vor '+(-n)+' Tagen'; return fmt(s); };
const ago = t => { const m = Math.round((Date.now()-t)/6e4); if(m<1) return 'gerade eben'; if(m<60) return 'vor '+m+' Min.'; const h = Math.round(m/60); if(h<24) return 'vor '+h+' Std.'; const d = Math.round(h/24); return d===1?'gestern':'vor '+d+' Tagen'; };
const weekKey = (d=new Date()) => { const t = new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())); const day = t.getUTCDay()||7; t.setUTCDate(t.getUTCDate()+4-day); const y = new Date(Date.UTC(t.getUTCFullYear(),0,1)); return t.getUTCFullYear()+'-W'+Math.ceil(((t-y)/864e5+1)/7); };
const fc = f => (FACH[f]||FACH.Sonstiges).c;
const fg = f => (FACH[f]||FACH.Sonstiges).g;
const initials = n => String(n||'?').trim().split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase();
const by = (k,dir=1) => (a,b) => (a[k]>b[k]?1:a[k]<b[k]?-1:0)*dir;
const sortStr = (a,b) => String(a.name||'').localeCompare(String(b.name||''),'de');

const I = {
  home:'<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  book:'<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z"/><path d="M20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z"/>',
  task:'<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  rocket:'<path d="M12 15l-3-3a12 12 0 0 1 9-9 12 12 0 0 1-9 9"/><path d="M9 12H5l2-4h4M12 15v4l4-2v-4"/><path d="M6 17c-1 1-1.5 3-1.5 3s2-.5 3-1.5"/>',
  cal:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.5a5 5 0 0 1 5.5 5"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  trash:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  file:'<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/>',
  out:'<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
  bell:'<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x:'<path d="M6 6l12 12M18 6L6 18"/>',
  flame:'<path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-7 1.5 1 2.5 2 3 3 0-3 0-4 0-6z"/>',
  bolt:'<path d="M13 3L5 13h6l-1 8 8-10h-6z"/>',
  back:'<path d="M15 5l-7 7 7 7"/>',
  next:'<path d="M9 5l7 7-7 7"/>',
  clip:'<path d="M20 11l-8 8a5 5 0 0 1-7-7l8-8a3.5 3.5 0 0 1 5 5l-8 8a2 2 0 0 1-3-3l7-7"/>',
  exam:'<path d="M5 3h10l4 4v14H5z"/><path d="M9 12h6M9 16h6M9 8h3"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  msg:'<path d="M4 5h16v11H9l-5 4z"/>',
  lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  play:'<path d="M7 4l13 8-13 8z"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon:'<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  panel:'<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16"/>'
};
const ic = (n,cls='i') => '<svg class="'+cls+'" viewBox="0 0 24 24" aria-hidden="true">'+(I[n]||'')+'</svg>';
const star = on => '<svg viewBox="0 0 24 24" class="'+(on?'st-on':'st-off')+'" aria-hidden="true"><path stroke-width="1.5" stroke-linejoin="round" d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2 6.4 20.2l1.1-6.3L2.9 9.5l6.3-.9z"/></svg>';
const stars = (n,max=3) => '<span class="stars" aria-label="'+n+' von '+max+' Sternen">'+Array.from({length:max},(_,i)=>star(i<n)).join('')+'</span>';
const fchip = f => '<span class="chip f" style="background:'+fc(f)+'">'+esc(f)+'</span>';
const ava = (s,cls='') => '<span class="ava '+cls+'" style="background:'+esc(s?.color||'#5b6075')+'">'+esc(initials(s?.name))+'</span>';

const pref = (k,v) => { try{ if(v===undefined) return localStorage.getItem('lr-'+k); if(v===null) localStorage.removeItem('lr-'+k); else localStorage.setItem('lr-'+k, v); }catch(e){ return null; } };
const isDark = () => { const t = document.documentElement.dataset.theme; return t ? t==='dark' : matchMedia('(prefers-color-scheme: dark)').matches; };
{ const t = pref('theme'); if(t==='dark'||t==='light') document.documentElement.dataset.theme = t; }
S.navMin = pref('navmin')==='1'; S.navOpen = false;
const narrowMQ = matchMedia('(max-width:899px)');
narrowMQ.addEventListener?.('change', ()=>{ S.navOpen = false; schedule(); });
function toast(msg){ const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(()=>t.classList.remove('show'),2600); }

const normUser = u => String(u||'').trim().toLowerCase().replace(/\s+/g,'.');
const WORDS = ['Sonne','Tiger','Wolke','Stern','Apfel','Delfin','Rakete','Mond','Blume','Pirat','Drache','Komet','Panda','Insel','Falke','Kiwi'];
const genPw = () => WORDS[Math.floor(Math.random()*WORDS.length)]+'-'+WORDS[Math.floor(Math.random()*WORDS.length)]+'-'+(10+Math.floor(Math.random()*90));

/* ---------- Speichern ---------- */
const data = c => S.d[c];
const byId = (c,id) => S.d[c].find(x=>x.id===id);
async function save(c,id,body){
  if(S.readOnly){ toast('Speichern ist in dieser Ansicht nicht möglich.'); return false; }
  try{ await S.db.collection(c).doc(id).set(body); return true; }
  catch(e){ return fail(e); }
}
async function del(c,id){
  if(S.readOnly){ toast('Löschen ist in dieser Ansicht nicht möglich.'); return false; }
  try{ await S.db.collection(c).doc(id).delete(); return true; }
  catch(e){ return fail(e); }
}
function fail(e){
  const code = e?.code;
  if(code==='invalid_argument'){ toast('Dafür fehlt die Berechtigung.'); }
  else if(code==='quota_exceeded') toast('Speicher ist voll – bitte alte Einträge löschen.');
  else toast('Speichern fehlgeschlagen. Bitte nochmal versuchen.');
  return false;
}

/* ---------- Benachrichtigungen ---------- */
async function notify(to, text, link, kind='info'){
  if(S.readOnly || !to) return;
  const id = uid();
  try{ await S.db.collection('notifs').doc(id).set({to, text, link:link||'start', kind, at:Date.now()}); }catch(e){}
}
async function notifyMany(ids, text, link, kind){ for(const id of ids) await notify(id, text, link, kind); }
const myKey = () => S.session?.role==='teacher' ? 'teacher' : S.session?.id;
const readAt = () => (byId('notifread', myKey())?.at) || 0;
const myNotifs = () => data('notifs').filter(n=>n.to===myKey()).sort(by('at',-1)).slice(0,60);
const unread = () => myNotifs().filter(n=>n.at>readAt()).length;

function reminders(){
  const out = []; const t = today();
  if(S.session?.role==='student'){
    const sid = S.session.id;
    hwFor(sid).forEach(h=>{ if(!isDone(h.id,sid)){ const n = diffDays(h.due); if(n<=1) out.push({kind:n<0?'bad':'warn', text:(n<0?'Überfällig: ':'Fällig '+rel(h.due)+': ')+h.fach+' – '+short(h.text), link:'hausaufgaben'}); } });
    examsFor(sid).forEach(e=>{ const n = diffDays(e.date); if(n>=0 && n<=7) out.push({kind:n<=2?'bad':'warn', text:e.fach+'-Klausur '+rel(e.date)+(e.themen?' ('+short(e.themen,40)+')':''), link:'kalender'}); });
    termineFor(sid).forEach(x=>{ const n = diffDays(x.date); if(n>=0 && n<=1) out.push({kind:'info', text:'Nachhilfe '+rel(x.date)+(x.time?' um '+x.time+' Uhr':''), link:'kalender'}); });
  } else {
    data('exams').forEach(e=>{ const n = diffDays(e.date); const s = byId('students',e.studentId); if(s && n>=0 && n<=7) out.push({kind:n<=2?'bad':'warn', text:s.name+': '+e.fach+'-Klausur '+rel(e.date), link:'kalender'}); });
    data('homework').forEach(h=>{ if(h.due===t){ const open = h.studentIds.filter(id=>byId('students',id) && !isDone(h.id,id)).length; if(open) out.push({kind:'warn', text:'Heute fällig: '+h.fach+' – '+open+' noch offen', link:'hausaufgaben'}); } });
    data('termine').forEach(x=>{ const n = diffDays(x.date); if(n>=0 && n<=1) out.push({kind:'info', text:'Nachhilfe '+rel(x.date)+(x.time?' '+x.time:'')+' – '+names(x.studentIds), link:'kalender'}); });
  }
  return out;
}
const short = (s,n=60) => { s = String(s||'').replace(/\s+/g,' ').trim(); return s.length>n ? s.slice(0,n-1)+'…' : s; };
const names = ids => (ids||[]).map(id=>byId('students',id)?.name).filter(Boolean).join(', ') || '–';

/* ---------- Abfragen ---------- */
const students = () => data('students').slice().sort(sortStr);
const groups = () => data('groups').slice().sort(sortStr);
const groupOf = s => s?.groupId ? byId('groups', s.groupId) : null;
function grouped(){
  const out = groups().map(g=>({g, list:students().filter(s=>s.groupId===g.id)}));
  const rest = students().filter(s=>!s.groupId || !byId('groups',s.groupId));
  if(rest.length) out.push({g:null, list:rest});
  return out;
}
function matchF(ids){ const f = S.ui.stud; if(f==='alle') return true; if(f.startsWith('g:')){ const g = f.slice(2); return (ids||[]).some(id=>byId('students',id)?.groupId===g); } return (ids||[]).includes(f); }
function filterSel(){
  if(!students().length) return '';
  const gs = groups();
  return '<select class="inp fsel" data-a="studFilter" aria-label="Filtern"><option value="alle">Alle Schüler</option>'+
    (gs.length?'<optgroup label="Gruppen">'+gs.map(g=>'<option value="g:'+esc(g.id)+'" '+(S.ui.stud==='g:'+g.id?'selected':'')+'>'+esc(g.name)+'</option>').join('')+'</optgroup>':'')+
    '<optgroup label="Schüler">'+students().map(s=>'<option value="'+esc(s.id)+'" '+(S.ui.stud===s.id?'selected':'')+'>'+esc(s.name)+'</option>').join('')+'</optgroup></select>';
}
const hwIdsOf = e => e.hwIds || (e.hwId ? [e.hwId] : []);
const me = () => S.session?.role==='student' ? byId('students', S.session.id) : null;
const isTeacher = () => S.session?.role==='teacher';
const hwFor = sid => data('homework').filter(h=>(h.studentIds||[]).includes(sid));
const stOf = (hid,sid) => byId('hwstatus', hid+'__'+sid);
const isDone = (hid,sid) => !!stOf(hid,sid)?.done;
const entriesFor = sid => data('entries').filter(e=>(e.studentIds||[]).includes(sid));
const examsFor = sid => data('exams').filter(e=>e.studentId===sid);
const termineFor = sid => data('termine').filter(x=>(x.studentIds||[]).includes(sid));
const coursesFor = s => data('courses').filter(c => (c.studentIds?.length ? c.studentIds.includes(s.id) : (!c.klasse || c.klasse==='alle' || c.klasse===s.klasse)));
const prog = sid => byId('progress', sid) || {xp:0, stars:{}, weekXp:0, days:[]};
const level = xp => ({lv:Math.floor((xp||0)/100)+1, pct:((xp||0)%100)});
const courseStars = (c,p) => (c.lessons||[]).reduce((a,l)=>a+(p.stars?.[c.id+'__'+l.id]||0),0);
const streak = p => { const set = new Set(p.days||[]); let d = today(), n = 0; if(!set.has(d)) d = addDays(d,-1); while(set.has(d)){ n++; d = addDays(d,-1); } return n; };
function hwStats(sid){ const hw = hwFor(sid); const done = hw.filter(h=>isDone(h.id,sid)).length; return {total:hw.length, done, open:hw.length-done}; }
function lastActive(sid){
  const p = prog(sid); let t = p.lastActive || 0;
  data('hwstatus').forEach(x=>{ if(x.studentId===sid && x.at>t) t = x.at; });
  return t;
}

/* ---------- Start ---------- */
async function boot(){
  S.db = KD.db;
  window.addEventListener('hashchange', () => { S.route = (location.hash.slice(1) || 'start'); S.ui.course = S.pendingCourse || null; S.pendingCourse = null; S.ui.fach = 'Alle'; render(); window.scrollTo(0,0); });
  S.route = location.hash.slice(1) || 'start';
  let me = null; try{ me = await KD.whoami(); }catch(e){}
  if(me) await startData(me); else { S.ready = true; render(); }
}
function startData(me){
  return new Promise(resolve => {
    S.isEditor = me.role==='teacher'; S.assets = S.isEditor ? true : null;
    S.ready = false; S.d = Object.fromEntries(COLS.map(c=>[c,[]]));
    const pending = new Set(COLS);
    const done = () => { if(S.ready) return; S.ready = true; clearTimeout(timer); S.session = me.role==='teacher' ? {role:'teacher'} : {role:'student', id:me.uid}; if(me.role==='teacher') prune(); render(); resolve(); };
    const timer = setTimeout(()=>{ S.slow = true; done(); }, 10000);
    $('#app').innerHTML = '<div class="boot">'+logo().replace('width="34" height="34"','width="72" height="72"')+'<p>Klecks wird geladen …</p></div>';
    COLS.forEach(c => {
      S.db.collection(c).onSnapshot(snap => {
        S.d[c] = snap.docs.map(d => ({...d.data(), id:d.id}));
        pending.delete(c);
        if(!pending.size){ S.slow = false; done(); }
        schedule();
      }, () => { pending.delete(c); if(!pending.size) done(); schedule(); });
    });
  });
}
async function setSession(s){
  if(!s){ S.session = null; S.ready = true; S.lastLogin = null; await KD.signOut(); S.d = Object.fromEntries(COLS.map(c=>[c,[]])); render(); return; }
}
async function prune(){
  const old = data('notifs').filter(n=>n.at < Date.now()-45*864e5).slice(0,30);
  for(const n of old){ try{ await S.db.collection('notifs').doc(n.id).delete(); }catch(e){ break; } }
}
let rq = 0;
function schedule(){ if(rq) return; rq = requestAnimationFrame(()=>{ rq = 0; if(S.ready) render(); }); }

/* ---------- Rendering ---------- */
function render(){
  const app = $('#app');
  if(!S.ready){ return; }
  if(!S.session){ const mode = loginMode(); if(S.lastLogin===mode && $('#app .login')) return; S.lastLogin = mode; app.innerHTML = loginView(); const f = $('#app .login input'); if(f) f.focus(); return; }
  S.lastLogin = null;
  if(S.session.role==='student' && !me()){ setSession(null); return; }
  const teacher = isTeacher();
  const nav = teacher
    ? [['start','Übersicht','home','Start'],['unterricht','Unterricht','book','Stunden'],['hausaufgaben','Hausaufgaben','task','Aufgaben'],['lernen','Lernwelt','rocket','Lernen'],['kalender','Kalender','cal','Kalender'],['schueler','Schüler','users','Schüler']]
    : [['start','Start','home','Start'],['unterricht','Unterricht','book','Stunden'],['hausaufgaben','Hausaufgaben','task','Aufgaben'],['lernen','Lernwelt','rocket','Lernen'],['kalender','Kalender','cal','Kalender']];
  if(!nav.some(n=>n[0]===S.route)) S.route = 'start';
  const badges = navBadges();
  const nb = unread(), rem = reminders().length;
  const bell = '<button class="btn ghost icon bell" data-a="notifs" aria-label="Benachrichtigungen">'+ic('bell')+(nb?'<span class="bell-n">'+nb+'</span>':(rem?'<span class="bell-dot"></span>':''))+'</button>';
  const who = teacher ? {name:(set().teacherName||'Lehrkraft'), color:'#2448d8'} : me();
  const navHtml = nav.map(([r,l,i,sl])=>'<a href="#'+r+'" class="'+(S.route===r?'on':'')+'" title="'+l+'">'+ic(i)+'<span class="nl">'+l+'</span><span class="ns">'+sl+'</span>'+(badges[r]?'<span class="badge">'+badges[r]+'</span>':'')+'</a>').join('');
  app.innerHTML =
    '<div class="shell'+((narrowMQ.matches ? !S.navOpen : S.navMin)?' rail':'')+(narrowMQ.matches && S.navOpen?' open':'')+'">'+(narrowMQ.matches && S.navOpen?'<div class="scrim" data-a="navToggle"></div>':'')+
      '<aside class="side"><div class="brand">'+logo()+'<span>Klecks</span><button class="btn ghost icon sm navt" data-a="navToggle" aria-label="Navigation ein- oder ausklappen">'+ic('panel')+'</button></div><nav class="nav">'+navHtml+'</nav>'+
        '<div class="side-foot"><div class="me">'+ava(who,'sm')+'<div>'+esc(who.name)+'<small>'+(teacher?'Lehrkraft':'Klasse '+esc(who.klasse))+'</small></div></div>'+
        (teacher?'<button class="btn ghost sm" data-a="settings">'+ic('gear')+'Einstellungen</button>':'')+
        '<button class="btn line sm" data-a="logout">'+ic('out')+'Abmelden</button></div></aside>'+
      '<header class="top"><div class="brand">'+logo()+'<span>Klecks</span></div><span class="sp"></span>'+bell+'<button class="btn ghost icon" data-a="menu" aria-label="Konto">'+ava(who,'xs')+'</button></header>'+
      '<main class="main">'+
        '<div class="deskbar">'+(S.slow?'<span class="chip warn">Verbindung langsam – Daten evtl. nicht aktuell</span>':'')+'<span class="sp"></span><span class="muted small nowrap">'+fmtLong(today())+'</span><button class="btn ghost icon" data-a="theme" aria-label="'+(isDark()?'Heller Modus':'Dunkler Modus')+'" title="'+(isDark()?'Heller Modus':'Dunkler Modus')+'">'+ic(isDark()?'sun':'moon')+'</button>'+bell+'</div>'+
        view()+
      '</main>'+
      '<nav class="tabs">'+nav.map(([r,l,i,sl])=>'<a href="#'+r+'" class="'+(S.route===r?'on':'')+'">'+ic(i)+'<span>'+sl+'</span>'+(badges[r]?'<span class="badge">'+badges[r]+'</span>':'')+'</a>').join('')+'</nav>'+
    '</div>';
  afterRender();
}
const logo = () => '<svg viewBox="0 0 120 120" width="34" height="34" aria-hidden="true"><rect x="6" y="6" width="108" height="108" rx="28" fill="#8a6cff" stroke="#22203a" stroke-width="7"/><path d="M60 26c10 0 14 9 22 12s14 10 10 20 2 18-8 24-16 2-24 6-18-2-22-10-12-12-8-22 6-14 14-20 6-10 16-10z" fill="#ffd84d" stroke="#22203a" stroke-width="6" stroke-linejoin="round"/><circle cx="51" cy="58" r="5.5" fill="#22203a"/><circle cx="70" cy="58" r="5.5" fill="#22203a"/><path d="M50 72q10 9 20 0" fill="none" stroke="#22203a" stroke-width="6" stroke-linecap="round"/></svg>';
const set = () => byId('settings','main') || {};
function navBadges(){
  if(isTeacher()){ const ex = data('exams').filter(e=>byId('students',e.studentId) && diffDays(e.date)>=0 && diffDays(e.date)<=7).length; return {kalender:ex||0}; }
  const sid = S.session.id; const open = hwFor(sid).filter(h=>!isDone(h.id,sid)).length;
  return {hausaufgaben:open||0};
}
function view(){
  switch(S.route){
    case 'unterricht': return vUnterricht();
    case 'hausaufgaben': return vHausaufgaben();
    case 'lernen': return S.ui.course ? vCourse() : vLernen();
    case 'kalender': return vKalender();
    case 'schueler': return isTeacher() ? vSchueler() : vStart();
    default: return isTeacher() ? vStartT() : vStart();
  }
}
function afterRender(){ document.querySelectorAll('.fig-trail').forEach(drawTrail); }

/* ---------- Login ---------- */
const loginMode = () => 'login';
function loginArt(){
  return '<div class="login-art" aria-hidden="true">'+
    '<div class="sticker s1"><b>★ 18</b><span>Sterne</span></div>'+
    '<div class="sticker s2"><b>2</b><span>Hausaufgaben</span></div>'+
    '<div class="sticker s3"><b>Mathe</b><span>Klausur Fr</span></div>'+
    '<div class="nodes"><i class="n1">1</i><i class="n2">2</i><i class="n3">3</i></div></div>';
}
function loginView(){
  const mode = loginMode();
  let body;
  if(mode==='setup'){
    body = '<h1>Klecks <span class="hl">einrichten</span></h1><p class="muted">Lege deinen Lehrer-Zugang an. Nur damit kommt man in den Lehrerbereich.</p>'+
      '<form id="setupForm" class="auth" autocomplete="off">'+
      fld('Dein Name (sehen die Schüler)', '<input class="inp" id="su-name" placeholder="z. B. Omar" required>')+
      fld('Benutzername', '<input class="inp" id="su-user" placeholder="z. B. lehrer" autocapitalize="off" required>')+
      '<div class="two">'+fld('Passwort', '<input class="inp" id="su-pw" type="password" minlength="8" required>', 'Mindestens 8 Zeichen')+fld('Wiederholen', '<input class="inp" id="su-pw2" type="password" required>')+'</div>'+
      '<div class="auth-err" id="auth-err"></div><button class="btn big" type="submit">Zugang anlegen</button></form>';
  } else {
    body = '<h1>Willkommen bei <span class="hl">Klecks</span></h1><p class="muted">Melde dich mit deinem Benutzernamen und Passwort an.</p>'+

      '<form id="loginForm" class="auth" autocomplete="on">'+
      fld('Benutzername', '<input class="inp" id="lg-user" name="username" autocomplete="username" autocapitalize="off" placeholder="z. B. lea.schmidt" required>')+
      fld('Passwort', '<div class="pw"><input class="inp" id="lg-pw" name="password" type="password" autocomplete="current-password" required><button type="button" class="btn ghost sm" data-a="pwShow">Zeigen</button></div>')+
      '<div class="auth-err" id="auth-err"></div><button class="btn big" type="submit" id="lg-btn">Anmelden</button>'+
      '<p class="hand">Passwort vergessen? Sag deiner Lehrkraft Bescheid!</p></form>';
  }
  return '<div class="login"><div class="login-card"><div class="login-form"><div class="brand">'+logo()+'<span>Klecks</span></div>'+body+'</div>'+loginArt()+'</div></div>';
}
function authErr(t){ const e = $('#auth-err'); if(e){ e.textContent = t; const f = e.closest('form'); f?.classList.remove('shake'); void f?.offsetWidth; f?.classList.add('shake'); } }
S.fails = 0; S.lockUntil = 0;
async function doLogin(){
  const u = normUser($('#lg-user').value), pw = $('#lg-pw').value, btn = $('#lg-btn');
  if(Date.now() < S.lockUntil) return authErr('Zu viele Versuche. Bitte '+Math.ceil((S.lockUntil-Date.now())/1000)+' Sekunden warten.');
  if(!u || !pw) return authErr('Bitte Benutzername und Passwort eingeben.');
  btn.disabled = true; btn.textContent = 'Prüfe …';
  const r = await KD.signIn(u, pw);
  if(r.error){ btn.disabled = false; btn.textContent = 'Anmelden'; S.fails++; if(S.fails>=5){ S.lockUntil = Date.now()+30000; S.fails = 0; } return authErr(r.error); }
  S.fails = 0;
  const me = await KD.whoami();
  if(!me){ await KD.signOut(); btn.disabled = false; btn.textContent = 'Anmelden'; return authErr('Dieser Zugang ist nicht freigeschaltet.'); }
  location.hash = 'start'; S.route = 'start';
  await startData(me);
  if(me.role==='teacher') toast('Willkommen, '+(set().teacherName||'')+'!');
}
document.addEventListener('submit', e => { e.preventDefault(); if(e.target.id==='loginForm') doLogin(); });

/* ---------- Übersicht Lehrkraft ---------- */
function vStartT(){
  const studs = students();
  const exams = data('exams').filter(e=>byId('students',e.studentId) && diffDays(e.date)>=0).sort(by('date'));
  const nextT = data('termine').filter(x=>diffDays(x.date)>=0).sort((a,b)=>(a.date+(a.time||'')).localeCompare(b.date+(b.time||'')));
  const weekT = nextT.filter(x=>diffDays(x.date)<=7).length;
  const news = myNotifs().slice(0,6);
  const gs = grouped();
  const sRow = s => {
    const open = hwFor(s.id).filter(h=>!isDone(h.id,s.id)).sort(by('due'));
    const late = open.filter(h=>diffDays(h.due)<0).length;
    const ex = examsFor(s.id).filter(e=>diffDays(e.date)>=0).sort(by('date'))[0];
    const notes = hwFor(s.id).map(h=>stOf(h.id,s.id)).filter(st=>st?.note && !st?.feedback).length;
    const chips = [];
    if(open.length) chips.push('<span class="chip '+(late?'bad':'warn')+'">'+ic('task')+open.length+' offen'+(late?' · '+late+' überfällig':'')+'</span>');
    else chips.push('<span class="chip ok">'+ic('check')+'alles erledigt</span>');
    if(ex) chips.push('<span class="chip '+(diffDays(ex.date)<=7?'bad':'')+'">'+ic('exam')+esc(ex.fach)+' '+rel(ex.date)+'</span>');
    if(notes) chips.push('<span class="chip" style="background:var(--lilac)">'+ic('msg')+notes+' Frage'+(notes>1?'n':'')+'</span>');
    return '<div class="g-stud" data-a="studDetail" data-id="'+esc(s.id)+'">'+ava(s,'sm')+'<div class="grow"><b>'+esc(s.name)+'</b><span class="muted tiny">Kl. '+esc(s.klasse)+(open[0]?' · nächste Abgabe '+rel(open[0].due):'')+'</span><div class="row" style="gap:6px;margin-top:6px">'+chips.join('')+'</div></div></div>';
  };
  const gCard = ({g,list}) => {
    const ids = list.map(s=>s.id);
    const t = nextT.find(x=>(x.studentIds||[]).some(id=>ids.includes(id)));
    const last = data('entries').filter(e=>(e.studentIds||[]).some(id=>ids.includes(id))).sort(by('date',-1))[0];
    const col = g?.color || '#6b6680';
    return '<section class="gcard"><div class="g-head" style="background:'+esc(col)+'"><div><h2>'+esc(g?g.name:'Ohne Gruppe')+'</h2><span>'+list.length+' Schüler'+(g?.note?' · '+esc(short(g.note,40)):'')+'</span></div>'+(g?'<button class="btn ghost icon sm" data-a="editGroup" data-id="'+esc(g.id)+'" aria-label="Gruppe bearbeiten">'+ic('edit')+'</button>':'')+'</div>'+
      '<div class="g-body">'+(list.length?list.map(sRow).join(''):'<div class="empty">Noch niemand in dieser Gruppe.</div>')+'</div>'+
      '<div class="g-foot"><div class="g-meta"><span>'+ic('cal')+(t?'Nächster Termin: <b>'+fmt(t.date)+(t.time?' '+esc(t.time):'')+'</b>':'Kein Termin geplant')+'</span><span>'+ic('book')+(last?'Letzte Stunde: <b>'+esc(short(last.thema,32))+'</b> ('+fmt(last.date)+')':'Noch keine Stunde')+'</span></div>'+
      (list.length?'<div class="row"><button class="btn sm" data-a="newEntry" data-ids="'+esc(ids.join(','))+'">'+ic('plus')+'Stunde</button><button class="btn ghost sm" data-a="newHw" data-ids="'+esc(ids.join(','))+'">'+ic('task')+'Hausaufgabe</button><button class="btn ghost sm" data-a="newTermin" data-ids="'+esc(ids.join(','))+'">'+ic('cal')+'Termin</button></div>':'')+'</div></section>';
  };
  return ''+
  '<div class="ph"><div><h1>Guten '+gruss()+', <span class="hl">'+esc(set().teacherName||'Lehrkraft')+'</span></h1><p>Deine Gruppen auf einen Blick – was bei jedem Kind gerade offen ist.</p></div>'+
  '<div class="row"><button class="btn ghost" data-a="newGroup">'+ic('users')+'Gruppe</button><button class="btn" data-a="newStud">'+ic('plus')+'Schüler</button></div></div>'+
  '<div class="kpis">'+kpi(groups().length,'Gruppen',true)+kpi(studs.length,'Schüler')+kpi(exams.filter(e=>diffDays(e.date)<=14).length,'Klausuren in 14 Tagen')+kpi(weekT,'Termine in 7 Tagen')+'</div>'+
  '<div class="grid2"><div class="stack">'+
    (gs.length ? gs.map(gCard).join('') : '<section class="card">'+empty('Leg los mit deiner ersten Gruppe','Zum Beispiel „Familie Schmidt“ – danach die Kinder darin anlegen.','<div class="row" style="justify-content:center;margin-top:12px"><button class="btn sm" data-a="newGroup">'+ic('users')+'Gruppe anlegen</button></div>')+'</section>')+
  '</div><div class="stack">'+
    '<section class="card"><div class="card-h"><h2>Klausuren</h2><a class="btn ghost sm" href="#kalender">Kalender</a></div>'+
      (exams.length?'<div class="list">'+exams.slice(0,6).map(e=>examLi(e,true)).join('')+'</div>':empty('Keine Klausuren eingetragen','Deine Schüler tragen ihre Klausuren selbst ein.'))+'</section>'+
    '<section class="card"><div class="card-h"><h2>Nächste Termine</h2><button class="btn ghost sm" data-a="newTermin">'+ic('plus')+'Neu</button></div>'+
      (nextT.length?'<div class="list">'+nextT.slice(0,4).map(terminLi).join('')+'</div>':empty('Keine Termine geplant','Plane die nächste Nachhilfestunde.'))+'</section>'+
    '<section class="card"><div class="card-h"><h2>Neuigkeiten</h2><button class="btn ghost sm" data-a="notifs">Alle</button></div>'+
      (news.length?'<div class="list">'+news.map(n=>'<a class="li" href="#'+esc(n.link||'start')+'" style="text-decoration:none;color:inherit">'+ic(n.kind==='hw'?'task':n.kind==='exam'?'exam':n.kind==='course'?'rocket':'bell')+'<div class="grow"><b>'+esc(n.text)+'</b><span class="muted tiny">'+ago(n.at)+'</span></div></a>').join('')+'</div>':empty('Noch ruhig hier','Wenn Schüler etwas erledigen oder Klausuren eintragen, siehst du es hier.'))+'</section>'+
  '</div></div>';
}
const gruss = () => { const h = new Date().getHours(); return h<11?'Morgen':h<18?'Tag':'Abend'; };
const kpi = (v,l,hl) => '<div class="kpi'+(hl?' hl':'')+'"><b>'+esc(v)+'</b><span>'+esc(l)+'</span></div>';
const empty = (t,s,extra='') => '<div class="empty"><b>'+esc(t)+'</b>'+esc(s)+extra+'</div>';
function examLi(e,showName){
  const s = byId('students',e.studentId); const n = diffDays(e.date);
  const cls = n<0?'':n<=2?'bad':n<=7?'warn':'';
  return '<div class="li" data-a="examOpen" data-id="'+esc(e.id)+'" style="cursor:pointer"><span class="exam-d" style="background:'+fc(e.fach)+'"><b>'+parse(e.date).getDate()+'</b><span>'+MON[parse(e.date).getMonth()].slice(0,3)+'</span></span><div class="grow"><b>'+(showName&&s?esc(s.name)+' · ':'')+esc(e.fach)+'-Klausur</b><span class="muted small">'+(e.themen?esc(short(e.themen,70)):'Themen noch offen')+'</span></div>'+
    (e.note?'<span class="chip ok">Note '+esc(e.note)+'</span>':'<span class="chip '+cls+'">'+rel(e.date)+'</span>')+'</div>';
}
function terminLi(x){
  return '<div class="li" data-a="'+(isTeacher()?'editTermin':'noop')+'" data-id="'+esc(x.id)+'" style="cursor:'+(isTeacher()?'pointer':'default')+'"><span class="exam-d" style="background:var(--brand)"><b>'+parse(x.date).getDate()+'</b><span>'+WD[parse(x.date).getDay()]+'</span></span><div class="grow"><b>Nachhilfe'+(x.fach&&x.fach!=='Alle'?' '+esc(x.fach):'')+(x.time?' · '+esc(x.time)+' Uhr':'')+'</b><span class="muted small">'+(isTeacher()?esc(names(x.studentIds)):'')+(x.note?(isTeacher()?' · ':'')+esc(short(x.note,60)):'')+'</span></div><span class="chip">'+rel(x.date)+'</span></div>';
}

/* ---------- Start Schüler ---------- */
function vStart(){
  const s = me(), sid = s.id, p = prog(sid), L = level(p.xp);
  const hw = hwFor(sid).filter(h=>!isDone(h.id,sid)).sort(by('due'));
  const ex = examsFor(sid).filter(e=>diffDays(e.date)>=0).sort(by('date'));
  const cs = coursesFor(s);
  const totStars = cs.reduce((a,c)=>a+courseStars(c,p),0);
  const maxStars = cs.reduce((a,c)=>a+(c.lessons||[]).length*3,0);
  const cont = cs.map(c=>({c,done:courseStars(c,p),max:(c.lessons||[]).length*3})).filter(x=>x.max && x.done<x.max).sort((a,b)=>b.done-a.done).slice(0,3);
  const fbs = hwFor(sid).map(h=>({h,st:stOf(h.id,sid)})).filter(x=>x.st?.feedback).sort((a,b)=>(b.st.fbAt||0)-(a.st.fbAt||0)).slice(0,2);
  const nextT = termineFor(sid).filter(x=>diffDays(x.date)>=0).sort(by('date'))[0];
  const R = 40, C = 2*Math.PI*R;
  return ''+
  '<section class="hero"><div><h1>Hallo <span class="hl">'+esc(s.name.split(' ')[0])+'</span>!</h1><p class="muted">'+(hw.length?'Du hast '+hw.length+' offene Hausaufgabe'+(hw.length>1?'n':'')+'.':'Alle Hausaufgaben erledigt – stark!')+(ex[0]?' Nächste Klausur: '+esc(ex[0].fach)+' '+rel(ex[0].date)+'.':'')+'</p>'+
    '<div class="stats" style="margin-top:14px"><span class="stat" style="color:var(--warn)">'+ic('flame')+streak(p)+' Tage in Folge</span><span class="stat">'+star(true)+totStars+' / '+maxStars+' Sterne</span><span class="stat" style="color:var(--brand)">'+ic('bolt')+(p.xp||0)+' Punkte</span></div></div>'+
    '<div class="lvl"><div class="ring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="'+R+'" stroke="var(--card2)" stroke-width="12" fill="none"/><circle cx="50" cy="50" r="'+R+'" stroke="var(--sun)" stroke-width="12" fill="none" stroke-linecap="round" stroke-dasharray="'+(C*L.pct/100)+' '+C+'" '+(L.pct?'':'opacity="0"')+'/></svg><b><small>LEVEL</small>'+L.lv+'</b></div></div></section>'+
  '<div class="tiles">'+
    '<a class="tile" href="#hausaufgaben" style="background:var(--tomato)">'+(hw.length?'<span class="cnt">'+hw.length+'</span>':'')+'<span class="ti">'+ic('task')+'</span><div><b>Hausaufgaben</b><br><span>'+(hw.length?hw.length+' unerledigt':'Alles erledigt')+'</span></div></a>'+
    '<a class="tile" href="#lernen" style="background:var(--violet)"><span class="ti">'+ic('rocket')+'</span><div><b>Lernwelt</b><br><span>'+(cont[0]?'Weiter mit „'+esc(short(cont[0].c.title,26))+'“':'Kurse entdecken')+'</span></div></a>'+
    '<a class="tile" href="#kalender" style="background:var(--brand)"><span class="ti">'+ic('cal')+'</span><div><b>Kalender</b><br><span>'+(nextT?'Nachhilfe '+rel(nextT.date)+(nextT.time?', '+esc(nextT.time):''):'Klausuren & Termine')+'</span></div></a>'+
  '</div>'+
  '<div class="grid2"><div class="stack">'+
    '<section class="card"><div class="card-h"><h2>Als Nächstes fällig</h2><a class="btn ghost sm" href="#hausaufgaben">Alle</a></div>'+
      (hw.length?hw.slice(0,4).map(h=>hwCard(h,sid,true)).join(''):empty('Nichts offen','Neue Hausaufgaben erscheinen hier.'))+
    '</section>'+
    (fbs.length?'<section class="card"><h2>Rückmeldungen</h2>'+fbs.map(x=>'<div class="fb" style="margin-top:0;margin-bottom:10px"><b>'+esc(x.h.fach)+' – '+esc(short(x.h.text,50))+'</b><br>'+esc(x.st.feedback)+'</div>').join('')+'</section>':'')+
  '</div><div class="stack">'+
    '<section class="card"><div class="card-h"><h2>Meine Klausuren</h2><button class="btn sm" data-a="newExam">'+ic('plus')+'Eintragen</button></div>'+
      (ex.length?'<div class="list">'+ex.slice(0,5).map(e=>examLi(e,false)).join('')+'</div>':empty('Keine Klausur eingetragen','Trag deine nächste Klausur ein – dann können wir gezielt üben.'))+
    '</section>'+
    '<section class="card"><div class="card-h"><h2>Weiterlernen</h2><a class="btn ghost sm" href="#lernen">Lernwelt</a></div>'+
      (cont.length?'<div class="list">'+cont.map(x=>'<div class="li" data-a="openCourse" data-id="'+esc(x.c.id)+'" style="cursor:pointer"><span class="c-mini" style="background:'+fc(x.c.fach)+'">'+esc(fg(x.c.fach))+'</span><div class="grow"><b>'+esc(x.c.title)+'</b><div class="bar sun" style="margin-top:6px"><i style="width:'+(x.done/x.max*100)+'%"></i></div></div><span class="muted small nowrap">'+x.done+'/'+x.max+'</span></div>').join('')+'</div>':empty('Alles geschafft','Neue Kurse erscheinen hier.'))+
    '</section>'+
  '</div></div>';
}
function hwCard(h,sid,compact){
  const st = stOf(h.id,sid); const done = !!st?.done; const n = diffDays(h.due);
  const dueChip = done ? '<span class="chip ok">erledigt</span>' : '<span class="chip '+(n<0?'bad':n<=1?'warn':'')+'">'+(n<0?'überfällig · ':'')+'bis '+rel(h.due)+'</span>';
  return '<div class="hw '+(done?'done':'')+'"><button class="check '+(done?'on':'')+'" data-a="toggleHw" data-id="'+esc(h.id)+'" aria-label="'+(done?'Als offen markieren':'Als erledigt markieren')+'">'+ic('check')+'</button>'+
    '<div><div class="row" style="margin-bottom:6px">'+fchip(h.fach)+dueChip+'</div><div class="hw-t">'+esc(h.text)+'</div>'+
    filesHtml(h.files)+(st?.note?'<div class="note">Deine Notiz: '+esc(st.note)+'</div>':'')+(st?.feedback?'<div class="fb"><b>Rückmeldung:</b> '+esc(st.feedback)+'</div>':'')+'</div>'+
    (compact?'':'<div class="hw-r"><button class="btn ghost sm" data-a="hwNote" data-id="'+esc(h.id)+'">'+ic('msg')+'Notiz / Frage</button></div>')+'</div>';
}
const filesHtml = fs => (fs&&fs.length) ? '<div class="files">'+fs.map(f=>'<a class="file" href="#" data-a="openFile" data-p="'+esc(f.path||'')+'">'+ic(String(f.type||'').startsWith('image')?'file':'clip')+'<span>'+esc(f.name)+'</span></a>').join('')+'</div>' : '';

/* ---------- Unterricht (Kursmappe) ---------- */
function vUnterricht(){
  const teacher = isTeacher(); const sid = teacher ? null : S.session.id;
  let list = (teacher ? data('entries') : entriesFor(sid)).slice();
  if(S.ui.fach!=='Alle') list = list.filter(e=>e.fach===S.ui.fach);
  if(teacher) list = list.filter(e=>matchF(e.studentIds));
  list.sort((a,b)=>(b.date||'').localeCompare(a.date||'') || (b.createdAt||0)-(a.createdAt||0));
  let lastM = '';
  const items = list.map(e=>{
    const d = parse(e.date); const m = MON[d.getMonth()]+' '+d.getFullYear();
    const head = m!==lastM ? '<div class="month">'+m+'</div>' : ''; lastM = m;
    const hws = hwIdsOf(e).map(id=>byId('homework',id)).filter(h=>h && (teacher || h.studentIds.includes(sid)));
    const many = hws.length>1;
    const hwBox = hws.map(hw=>{
      if(teacher){ const ids = hw.studentIds.filter(id=>byId('students',id)); const dn = ids.filter(id=>isDone(hw.id,id)).length; return '<div class="e-hw"><b>'+(many?esc(names(ids))+' · ':'')+'Hausaufgabe bis '+fmt(hw.due)+' · '+dn+'/'+ids.length+' erledigt</b><span style="white-space:pre-wrap">'+esc(hw.text)+'</span></div>'; }
      const dn = isDone(hw.id,sid); return '<div class="e-hw"><b>Deine Hausaufgabe bis '+fmt(hw.due)+(dn?' · erledigt':'')+'</b><span style="white-space:pre-wrap">'+esc(hw.text)+'</span>'+(dn?'':'<a href="#hausaufgaben" class="small" style="font-weight:800">Zu den Hausaufgaben</a>')+'</div>';
    }).join('');
    return head+'<article class="entry"><div class="e-date" style="background:'+fc(e.fach)+'"><b>'+d.getDate()+'</b><span>'+WD[d.getDay()]+'</span></div><div class="e-body">'+
      '<div class="row">'+fchip(e.fach)+(teacher?'<span class="muted small">'+esc(names(e.studentIds))+'</span>':'')+(teacher?'<span class="e-acts"><button class="btn ghost icon" data-a="editEntry" data-id="'+esc(e.id)+'" aria-label="Bearbeiten">'+ic('edit')+'</button></span>':'')+'</div>'+
      '<h3>'+esc(e.thema)+'</h3>'+(e.inhalt?'<div class="e-text">'+esc(e.inhalt)+'</div>':'')+filesHtml(e.files)+hwBox+'</div></article>';
  }).join('');
  const studs = students();
  return '<div class="ph"><div><h1>Unterricht</h1><p>'+(teacher?'Deine Kursmappe: Was in jeder Nachhilfestunde gemacht wurde – mit Arbeitsblättern und Hausaufgaben.':'Hier siehst du, was wir in der Nachhilfe gemacht haben, mit allen Arbeitsblättern.')+'</p></div>'+(teacher?'<button class="btn" data-a="newEntry">'+ic('plus')+'Stunde eintragen</button>':'')+'</div>'+
    '<div class="filters">'+['Alle',...FAECHER].map(f=>'<button class="'+(S.ui.fach===f?'on':'')+'" data-a="fach" data-f="'+f+'">'+f+'</button>').join('')+
    (teacher?filterSel():'')+'</div>'+
    '<div class="heft">'+(items || empty('Noch keine Einträge', teacher?'Trag nach jeder Stunde ein, was ihr gemacht habt. Arbeitsblätter kannst du direkt anhängen.':'Sobald deine Lehrkraft eine Stunde einträgt, siehst du sie hier.'))+'</div>';
}

/* ---------- Hausaufgaben ---------- */
function vHausaufgaben(){
  if(!isTeacher()){
    const sid = S.session.id;
    const all = hwFor(sid);
    let list = all.filter(h=>S.ui.hwTab==='offen' ? !isDone(h.id,sid) : isDone(h.id,sid));
    if(S.ui.fach!=='Alle') list = list.filter(h=>h.fach===S.ui.fach);
    list.sort(S.ui.hwTab==='offen' ? by('due') : by('due',-1));
    const o = all.filter(h=>!isDone(h.id,sid)).length;
    return '<div class="ph"><div><h1>Hausaufgaben</h1><p>Hake ab, was du erledigt hast. Bei Fragen schreib eine Notiz.</p></div></div>'+
      '<div class="filters"><button class="'+(S.ui.hwTab==='offen'?'on':'')+'" data-a="hwTab" data-t="offen">Offen ('+o+')</button><button class="'+(S.ui.hwTab==='erledigt'?'on':'')+'" data-a="hwTab" data-t="erledigt">Erledigt ('+(all.length-o)+')</button><span style="width:10px"></span>'+['Alle',...FAECHER.slice(0,3)].map(f=>'<button class="'+(S.ui.fach===f?'on':'')+'" data-a="fach" data-f="'+f+'">'+f+'</button>').join('')+'</div>'+
      (list.length?list.map(h=>hwCard(h,sid,false)).join(''):empty(S.ui.hwTab==='offen'?'Keine offenen Hausaufgaben':'Noch nichts erledigt', S.ui.hwTab==='offen'?'Super, du bist auf dem neuesten Stand!':'Erledigte Aufgaben landen hier.'));
  }
  let list = data('homework').slice();
  if(S.ui.fach!=='Alle') list = list.filter(h=>h.fach===S.ui.fach);
  list = list.filter(h=>matchF(h.studentIds));
  const isOpen = h => h.studentIds.some(id=>byId('students',id) && !isDone(h.id,id));
  list = list.filter(h => S.ui.hwTab==='offen' ? isOpen(h) : !isOpen(h));
  list.sort(S.ui.hwTab==='offen' ? by('due') : by('due',-1));
  const studs = students();
  return '<div class="ph"><div><h1>Hausaufgaben</h1><p>Sieh auf einen Blick, wer fertig ist. Tippe auf einen Namen für Status oder Rückmeldung.</p></div><button class="btn" data-a="newHw">'+ic('plus')+'Hausaufgabe</button></div>'+
    '<div class="filters"><button class="'+(S.ui.hwTab==='offen'?'on':'')+'" data-a="hwTab" data-t="offen">Laufend</button><button class="'+(S.ui.hwTab==='erledigt'?'on':'')+'" data-a="hwTab" data-t="erledigt">Abgeschlossen</button><span style="width:10px"></span>'+['Alle',...FAECHER.slice(0,3)].map(f=>'<button class="'+(S.ui.fach===f?'on':'')+'" data-a="fach" data-f="'+f+'">'+f+'</button>').join('')+
    filterSel()+'</div>'+
    (list.length?list.map(h=>{
      const ids = h.studentIds.filter(id=>byId('students',id)); const dn = ids.filter(id=>isDone(h.id,id)).length; const n = diffDays(h.due);
      return '<div class="hw" style="grid-template-columns:minmax(0,1fr) auto"><div><div class="row" style="margin-bottom:6px">'+fchip(h.fach)+'<span class="chip '+(n<0&&dn<ids.length?'bad':n<=1?'warn':'')+'">bis '+rel(h.due)+'</span><span class="chip ok">'+dn+'/'+ids.length+' erledigt</span></div>'+
        '<div class="hw-t">'+esc(h.text)+'</div>'+filesHtml(h.files)+
        '<div class="who-row">'+ids.map(id=>{ const s = byId('students',id), st = stOf(h.id,id); return '<button class="who-st '+(st?.done?'done':'')+'" data-a="hwStudent" data-h="'+esc(h.id)+'" data-s="'+esc(id)+'">'+ava(s,'xs')+esc(s.name)+(st?.done?' ✓':'')+(st?.note?' '+ic('msg'):'')+'</button>'; }).join('')+'</div></div>'+
        '<div class="hw-r"><button class="btn ghost icon" data-a="editHw" data-id="'+esc(h.id)+'" aria-label="Bearbeiten">'+ic('edit')+'</button></div></div>';
    }).join(''):empty(S.ui.hwTab==='offen'?'Keine laufenden Hausaufgaben':'Noch keine abgeschlossenen Hausaufgaben','Neue Hausaufgaben kannst du direkt hier oder beim Eintragen einer Stunde vergeben.'));
}

/* ---------- Lernwelt ---------- */
function vLernen(){
  const teacher = isTeacher();
  let cs = teacher ? data('courses').slice() : coursesFor(me());
  if(S.ui.fach!=='Alle') cs = cs.filter(c=>c.fach===S.ui.fach);
  cs.sort((a,b)=>(a.fach||'').localeCompare(b.fach||'') || String(a.klasse).localeCompare(String(b.klasse)) || (a.title||'').localeCompare(b.title||''));
  const p = teacher ? null : prog(S.session.id);
  let head;
  if(teacher) head = '<div class="ph"><div><h1>Lernwelt</h1><p>Lernkurse mit Erklärungen und Übungen. Deine Schüler sammeln Sterne und Punkte – du siehst den Fortschritt.</p></div><button class="btn" data-a="newCourse">'+ic('plus')+'Neuer Kurs</button></div>';
  else { const L = level(p.xp); head = '<div class="ph"><div><h1>Lernwelt</h1><p>Wähle einen Kurs und sammle Sterne. Jede richtige Antwort gibt 10 Punkte.</p></div><div class="stats"><span class="stat" style="color:var(--warn)">'+ic('flame')+streak(p)+'</span><span class="stat" style="color:var(--brand)">'+ic('bolt')+(p.xp||0)+'</span><span class="chip">Level '+L.lv+'</span></div></div>'; }
  const prep = !teacher ? examsFor(S.session.id).filter(e=>diffDays(e.date)>=0 && diffDays(e.date)<=14).sort(by('date'))[0] : null;
  return head+
    (prep?'<div class="banner" style="background:var(--brand-soft);color:var(--brand)">'+ic('exam')+'<span>Deine '+esc(prep.fach)+'-Klausur ist '+rel(prep.date)+'. Übe jetzt mit den '+esc(prep.fach)+'-Kursen!</span><button class="btn sm" data-a="fach" data-f="'+esc(prep.fach)+'" style="margin-left:auto">Zeigen</button></div>':'')+
    '<div class="filters">'+['Alle',...FAECHER.slice(0,3)].map(f=>'<button class="'+(S.ui.fach===f?'on':'')+'" data-a="fach" data-f="'+f+'">'+f+'</button>').join('')+'</div>'+
    (cs.length?'<div class="courses">'+cs.map(c=>{
      const max = (c.lessons||[]).length*3, got = p?courseStars(c,p):0;
      const who = teacher ? (c.studentIds?.length ? names(c.studentIds) : 'Klasse '+(c.klasse||'alle')) : '';
      return '<article class="course" data-a="openCourse" data-id="'+esc(c.id)+'"><div class="c-cover" style="background:'+fc(c.fach)+'"><span class="glyph">'+esc(fg(c.fach))+'</span><div class="row"><span class="chip">'+esc(c.fach)+'</span><span class="chip">Klasse '+esc(c.klasse||'alle')+'</span></div></div>'+
        '<div class="c-body"><h3>'+esc(c.title)+'</h3>'+(c.desc?'<p>'+esc(short(c.desc,90))+'</p>':'')+
        '<div class="c-meta"><span>'+(c.lessons||[]).length+' Lektionen</span>'+(teacher?'<span class="small">'+esc(short(who,28))+'</span>':'<span class="nowrap">'+star(true).replace('<svg','<svg width="16" height="16"')+' '+got+'/'+max+'</span>')+'</div>'+
        (teacher?'':'<div class="bar sun"><i style="width:'+(max?got/max*100:0)+'%"></i></div>')+'</div></article>';
    }).join('')+'</div>':empty('Noch keine Kurse', teacher?'Erstelle einen Kurs mit Lektionen und Übungsfragen.':'Hier erscheinen bald Lernkurse für dich.'));
}
function vCourse(){
  const c = byId('courses',S.ui.course); if(!c){ S.ui.course = null; return vLernen(); }
  const teacher = isTeacher(); const p = teacher ? {stars:{}} : prog(S.session.id);
  const ls = c.lessons||[];
  let nextIdx = ls.findIndex(l=>!(p.stars?.[c.id+'__'+l.id]));
  const nodes = ls.map((l,i)=>{
    const st = p.stars?.[c.id+'__'+l.id]||0;
    const locked = !teacher && i>0 && !(p.stars?.[c.id+'__'+ls[i-1].id]) && st===0;
    return '<div class="node '+(locked?'lock':'')+(i===nextIdx&&!locked?' next':'')+'"><button data-a="'+(locked?'locked':'play')+'" data-i="'+i+'" style="background:'+fc(c.fach)+'" aria-label="Lektion '+(i+1)+': '+esc(l.title)+'">'+(locked?ic('lock'):st===3?ic('check'):(i+1))+'</button><b>'+esc(l.title)+'</b>'+stars(st)+'</div>';
  }).join('');
  return '<div class="row" style="margin-bottom:16px"><button class="btn ghost sm" data-a="closeCourse">'+ic('back')+'Alle Kurse</button>'+(teacher?'<span class="sp" style="flex:1"></span><button class="btn ghost sm" data-a="courseProgress" data-id="'+esc(c.id)+'">'+ic('users')+'Fortschritt</button><button class="btn sm" data-a="editCourse" data-id="'+esc(c.id)+'">'+ic('edit')+'Bearbeiten</button>':'')+'</div>'+
    '<div class="path-wrap"><div class="path-head" style="background:'+fc(c.fach)+'"><span class="glyph">'+esc(fg(c.fach))+'</span><div class="row"><span class="chip" style="background:rgba(255,255,255,.22);color:#fff">'+esc(c.fach)+' · Klasse '+esc(c.klasse||'alle')+'</span></div><h1 style="margin-top:10px">'+esc(c.title)+'</h1>'+(c.desc?'<p>'+esc(c.desc)+'</p>':'')+'</div>'+
    '<div class="path fig-trail">'+(nodes||'<div class="empty">Dieser Kurs hat noch keine Lektionen.</div>')+'</div></div>';
}
function drawTrail(el){
  const old = el.querySelector('svg.trail'); if(old) old.remove();
  const btns = [...el.querySelectorAll('.node button')]; if(btns.length<2) return;
  const r = el.getBoundingClientRect();
  const pts = btns.map(b=>{ const q = b.getBoundingClientRect(); return [q.left-r.left+q.width/2, q.top-r.top+q.height/2]; });
  let d = 'M'+pts[0].join(' ');
  for(let i=1;i<pts.length;i++){ const [x0,y0] = pts[i-1], [x1,y1] = pts[i]; const my = (y0+y1)/2; d += ' C'+x0+' '+my+' '+x1+' '+my+' '+x1+' '+y1; }
  el.insertAdjacentHTML('afterbegin','<svg class="trail" aria-hidden="true"><path d="'+d+'" fill="none" stroke="var(--edge)" stroke-width="5" stroke-linecap="round" stroke-dasharray="2 14" opacity=".55"/></svg>');
}
window.addEventListener('resize', ()=>document.querySelectorAll('.fig-trail').forEach(drawTrail));

/* ---------- Kalender ---------- */
function events(){
  const teacher = isTeacher(); const sid = teacher ? null : S.session.id; const ev = [];
  (teacher?data('homework'):hwFor(sid)).forEach(h=>ev.push({date:h.due, kind:'hw', color:fc(h.fach), title:'HA '+h.fach, sub:short(h.text,60)+(teacher?' · '+names(h.studentIds):''), done:!teacher && isDone(h.id,sid), link:'hausaufgaben'}));
  (teacher?data('exams').filter(e=>byId('students',e.studentId)):examsFor(sid)).forEach(e=>ev.push({date:e.date, kind:'exam', color:'var(--bad)', title:(teacher?byId('students',e.studentId).name+': ':'')+e.fach+'-Klausur', sub:e.themen||'', id:e.id, link:'exam'}));
  (teacher?data('termine'):termineFor(sid)).forEach(x=>ev.push({date:x.date, kind:'termin', color:'var(--brand)', title:'Nachhilfe'+(x.time?' '+x.time:'')+(x.fach&&x.fach!=='Alle'?' · '+x.fach:''), sub:(teacher?names(x.studentIds):'')+(x.note?' '+x.note:''), id:x.id, link:'termin'}));
  (teacher?data('entries'):entriesFor(sid)).forEach(e=>ev.push({date:e.date, kind:'stunde', color:'var(--ink2)', title:'Stunde: '+e.thema, sub:e.fach+(teacher?' · '+names(e.studentIds):''), link:'unterricht'}));
  return ev;
}
function vKalender(){
  const teacher = isTeacher();
  const base = S.ui.calMonth ? parse(S.ui.calMonth) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const y = base.getFullYear(), m = base.getMonth();
  const ev = events(); const map = {}; ev.forEach(e=>(map[e.date] ||= []).push(e));
  const first = new Date(y,m,1); const off = (first.getDay()+6)%7; const days = new Date(y,m+1,0).getDate();
  const t = today(); const sel = S.ui.calDay || t;
  let cells = ''; for(let i=0;i<off;i++) cells += '<div class="cd out"></div>';
  for(let d=1; d<=days; d++){
    const k = y+'-'+pad(m+1)+'-'+pad(d); const es = map[k]||[];
    cells += '<button class="cd '+(k===t?'today ':'')+(k===sel?'sel':'')+'" data-a="calDay" data-d="'+k+'"><span>'+d+'</span><span class="cdots">'+es.slice(0,4).map(e=>'<i style="background:'+e.color+'"></i>').join('')+'</span>'+(es.some(e=>e.kind==='exam')?'<em>Klausur</em>':'')+'</button>';
  }
  const dayEv = (map[sel]||[]);
  const up = ev.filter(e=>e.kind!=='stunde' && diffDays(e.date)>=0 && diffDays(e.date)<=21 && !e.done).sort(by('date'));
  const evLi = e => '<div class="li" data-a="calEv" data-k="'+e.kind+'" data-id="'+esc(e.id||'')+'" data-l="'+e.link+'" style="cursor:pointer"><span class="dot" style="background:'+e.color+'"></span><div class="grow"><b>'+esc(e.title)+'</b>'+(e.sub?'<span class="muted small">'+esc(e.sub)+'</span>':'')+'</div>'+(e.done?'<span class="chip ok">erledigt</span>':'')+'</div>';
  return '<div class="ph"><div><h1>Kalender</h1><p>'+(teacher?'Alle Nachhilfe-Termine, Klausuren deiner Schüler und Abgaben an einem Ort.':'Deine Klausuren, Hausaufgaben und Nachhilfe-Termine.')+'</p></div><div class="row">'+(teacher?'<button class="btn" data-a="newTermin">'+ic('plus')+'Termin</button>':'')+'<button class="btn '+(teacher?'ghost':'')+'" data-a="newExam">'+ic('exam')+'Klausur eintragen</button></div></div>'+
    '<div class="grid2"><section class="card"><div class="card-h"><button class="btn ghost icon" data-a="calNav" data-n="-1" aria-label="Vorheriger Monat">'+ic('back')+'</button><h2>'+MON[m]+' '+y+'</h2><button class="btn ghost icon" data-a="calNav" data-n="1" aria-label="Nächster Monat">'+ic('next')+'</button></div>'+
      '<div class="cal"><div class="cw">Mo</div><div class="cw">Di</div><div class="cw">Mi</div><div class="cw">Do</div><div class="cw">Fr</div><div class="cw">Sa</div><div class="cw">So</div>'+cells+'</div>'+
      '<div class="legend"><span><i style="background:var(--bad)"></i>Klausur</span><span><i style="background:var(--brand)"></i>Nachhilfe</span><span><i style="background:var(--mathe)"></i><i style="background:var(--deutsch)"></i><i style="background:var(--englisch)"></i>Hausaufgabe</span><span><i style="background:var(--ink2)"></i>Stunde</span></div>'+
      '<h3 style="margin:18px 0 8px">'+fmtLong(sel)+'</h3>'+(dayEv.length?'<div class="list">'+dayEv.map(evLi).join('')+'</div>':'<p class="muted small">Nichts eingetragen.</p>')+
    '</section><section class="card"><h2>Die nächsten 3 Wochen</h2>'+(up.length?'<div class="list">'+up.map(e=>'<div class="li" data-a="calEv" data-k="'+e.kind+'" data-id="'+esc(e.id||'')+'" data-l="'+e.link+'" style="cursor:pointer"><span class="exam-d" style="background:'+e.color+'"><b>'+parse(e.date).getDate()+'</b><span>'+WD[parse(e.date).getDay()]+'</span></span><div class="grow"><b>'+esc(e.title)+'</b>'+(e.sub?'<span class="muted small">'+esc(short(e.sub,70))+'</span>':'')+'</div><span class="chip">'+rel(e.date)+'</span></div>').join('')+'</div>':empty('Nichts geplant','Hier erscheinen Klausuren, Abgaben und Termine.'))+'</section></div>';
}

/* ---------- Schüler ---------- */
function vSchueler(){
  const card = s => { const h = hwStats(s.id), p = prog(s.id); const ex = examsFor(s.id).filter(e=>diffDays(e.date)>=0).sort(by('date'))[0];
    return '<article class="stud" data-a="studDetail" data-id="'+esc(s.id)+'"><div class="stud-h">'+ava(s)+'<div><b>'+esc(s.name)+'</b><span class="muted small">Klasse '+esc(s.klasse)+' · '+esc(s.username||'kein Zugang')+'</span></div></div>'+
      '<div class="row">'+(s.faecher||[]).map(fchip).join('')+'</div>'+
      '<div class="mini"><div><b>'+h.open+'</b><span>offen</span></div><div><b>'+level(p.xp).lv+'</b><span>Level</span></div><div><b>'+(p.xp||0)+'</b><span>Punkte</span></div></div>'+
      (ex?'<span class="chip '+(diffDays(ex.date)<=7?'warn':'')+'">'+ic('exam')+esc(ex.fach)+'-Klausur '+rel(ex.date)+'</span>':'<span class="muted small">Keine Klausur eingetragen</span>')+'</article>'; };
  const gs = grouped();
  return '<div class="ph"><div><h1>Schüler & <span class="hl">Gruppen</span></h1><p>Teile deine Schüler in Gruppen ein, z. B. nach Familie. Jeder Schüler bekommt einen eigenen Zugang.</p></div><div class="row"><button class="btn ghost" data-a="newGroup">'+ic('users')+'Gruppe</button><button class="btn" data-a="newStud">'+ic('plus')+'Schüler anlegen</button></div></div>'+
    (gs.length ? gs.map(({g,list})=>'<section class="grp"><div class="grp-h"><span class="grp-dot" style="background:'+esc(g?.color||'var(--ink2)')+'"></span><h2>'+esc(g?g.name:'Ohne Gruppe')+'</h2><span class="muted small">'+list.length+' Schüler</span><span class="sp"></span>'+(g?'<button class="btn ghost sm" data-a="newStud" data-g="'+esc(g.id)+'">'+ic('plus')+'Schüler</button><button class="btn ghost icon" data-a="editGroup" data-id="'+esc(g.id)+'" aria-label="Gruppe bearbeiten">'+ic('edit')+'</button>':'')+'</div>'+
      (g?.note?'<p class="hand" style="margin:-4px 0 12px">'+esc(g.note)+'</p>':'')+
      (list.length?'<div class="studs">'+list.map(card).join('')+'</div>':'<div class="empty">Noch niemand in dieser Gruppe.</div>')+'</section>').join('')
    : empty('Noch keine Schüler','Lege zuerst eine Gruppe an (z. B. „Familie Schmidt“) und dann die Schüler darin.'));
}

/* =====================================================================
   Modals
   ===================================================================== */
function openM(type, d={}){ S.m = {type, d}; renderM(); }
function closeM(){ S.m = null; $('#modal').innerHTML = ''; }
function renderM(){
  const m = S.m; if(!m){ $('#modal').innerHTML=''; return; }
  const fn = M[m.type]; if(!fn) return;
  const r = fn(m.d);
  $('#modal').innerHTML = '<div class="ov" data-a="ovClose"><div class="dlg '+(r.wide?'wide':'')+'" role="dialog" aria-modal="true" aria-label="'+esc(String(r.title).replace(/<[^>]+>/g,'').trim())+'"><div class="dlg-h"><h2>'+r.title+'</h2><button class="btn ghost icon" data-a="closeM" aria-label="Schließen">'+ic('x')+'</button></div><div class="dlg-b">'+r.body+'</div>'+(r.foot?'<div class="dlg-f">'+r.foot+'</div>':'')+'</div></div>';
  const f = $('#modal [autofocus]'); if(f && !renderM._noFocus) f.focus();
}
const fld = (label, inner, hint) => '<label class="fld"><span>'+label+'</span>'+inner+(hint?'<small>'+hint+'</small>':'')+'</label>';
const inp = (k, v, attrs='') => '<input class="inp" data-k="'+k+'" value="'+esc(v??'')+'" '+attrs+'>';
const ta = (k, v, attrs='') => '<textarea class="inp" data-k="'+k+'" '+attrs+'>'+esc(v??'')+'</textarea>';
const segF = (k, cur, opts) => '<div class="seg">'+opts.map(o=>'<button type="button" class="'+(cur===o?'on':'')+'" data-a="segSet" data-k="'+k+'" data-v="'+esc(o)+'">'+(FACH[o]?'<span class="dot" style="background:'+fc(o)+'"></span>':'')+esc(o)+'</button>').join('')+'</div>';
function studPick(k, sel){
  if(!students().length) return '<p class="muted small">Lege zuerst Schüler an.</p>';
  return '<div class="pick">'+grouped().map(({g,list})=>{ const ids = list.map(s=>s.id); const all = ids.length && ids.every(id=>sel.includes(id));
    return '<div class="pick-g"><div class="pick-h"><span class="dot" style="background:'+esc(g?.color||'var(--ink2)')+'"></span><b>'+esc(g?g.name:'Ohne Gruppe')+'</b>'+(ids.length>1?'<button type="button" class="btn ghost sm" data-a="multiGroup" data-k="'+k+'" data-ids="'+esc(ids.join(','))+'">'+(all?'Keinen':'Ganze Gruppe')+'</button>':'')+'</div>'+
      '<div class="seg">'+list.map(s=>'<button type="button" class="'+(sel.includes(s.id)?'on':'')+'" data-a="multiToggle" data-k="'+k+'" data-v="'+esc(s.id)+'">'+ava(s,'xs')+esc(s.name)+'</button>').join('')+'</div></div>'; }).join('')+'</div>';
}
function filesEd(d){
  if(!S.isEditor) return '';
  return '<div class="files" style="margin-top:0">'+(d.files||[]).map((f,i)=>'<span class="file">'+ic('clip')+'<span>'+esc(f.name)+'</span><button type="button" class="btn ghost icon" style="width:28px;min-height:28px" data-a="rmFile" data-i="'+i+'" aria-label="Entfernen">'+ic('x')+'</button></span>').join('')+
    '<label class="btn ghost sm" style="cursor:pointer">'+ic('plus')+(d.uploading?'Lädt hoch …':'Datei anhängen')+'<input type="file" data-a="upload" accept="application/pdf,image/*,.txt,.md,.csv" multiple hidden></label></div>';
}

const M = {};
M.confirm = d => ({ title:esc(d.title), body:'<p>'+esc(d.text)+'</p>', foot:'<button class="btn ghost" data-a="closeM">Abbrechen</button><button class="btn bad" data-a="confirmYes">'+esc(d.yes||'Löschen')+'</button>' });

M.entry = d => ({ title: d.id?'Stunde bearbeiten':'Stunde eintragen', wide:true, body:
  '<div class="two">'+fld('Datum', inp('date', d.date, 'type="date"'))+fld('Fach', segF('fach', d.fach, FAECHER))+'</div>'+
  fld('Schüler', studPick('studentIds', d.studentIds))+
  fld('Thema der Stunde', inp('thema', d.thema, 'placeholder="z. B. Brüche erweitern und kürzen" autofocus'))+
  fld('Was haben wir gemacht?', ta('inhalt', d.inhalt, 'placeholder="Inhalte, Übungen, was gut lief, woran wir weiterarbeiten …"'))+
  fld('Arbeitsblätter & Dateien', filesEd(d), 'PDF oder Foto – deine Schüler können sie öffnen.')+
  '<div class="box"><label class="toggle"><input type="checkbox" data-k="hwOn" '+(d.hwOn?'checked':'')+' data-rerender="1"> Hausaufgabe aufgeben</label>'+
  (d.hwOn?(d.studentIds.length>1?'<label class="toggle"><input type="checkbox" data-k="hwPer" '+(d.hwPer?'checked':'')+' data-rerender="1"> Jeder bekommt eine eigene Aufgabe</label>':'')+
    (d.hwPer&&d.studentIds.length>1 ? d.studentIds.map(id=>{ const s = byId('students',id); return fld(ava(s,'xs')+' '+esc(s?.name), ta('hwTexts.'+id, (d.hwTexts||{})[id], 'placeholder="Aufgabe für '+esc(s?.name)+'"')); }).join('') : fld(d.studentIds.length>1?'Aufgabe (für alle gleich)':'Aufgabe', ta('hwText', d.hwText, 'placeholder="z. B. Buch S. 42 Nr. 3a–c und Arbeitsblatt fertig machen"')))+
    fld('Fällig bis', inp('hwDue', d.hwDue, 'type="date"')):'')+'</div>',
  foot:(d.id?'<button class="btn ghost" data-a="delEntry">'+ic('trash')+'Löschen</button><span class="sp"></span>':'')+'<button class="btn ghost" data-a="closeM">Abbrechen</button><button class="btn" data-a="saveEntry">Speichern</button>' });

M.hw = d => { const per = d.per && d.studentIds.length>1 && !d.id; return { title: d.id?'Hausaufgabe bearbeiten':'Neue Hausaufgabe', wide:true, body:
  fld('Fach', segF('fach', d.fach, FAECHER))+fld('Für wen?', studPick('studentIds', d.studentIds))+
  (!d.id && d.studentIds.length>1 ? '<label class="toggle"><input type="checkbox" data-k="per" '+(d.per?'checked':'')+' data-rerender="1"> Jeder bekommt eine eigene Aufgabe</label>' : '')+
  (per ? d.studentIds.map(id=>{ const s = byId('students',id); return fld(ava(s,'xs')+' '+esc(s?.name), ta('texts.'+id, (d.texts||{})[id], 'placeholder="Aufgabe für '+esc(s?.name)+'"')); }).join('')
       : fld(d.studentIds.length>1?'Aufgabe (für alle gleich)':'Aufgabe', ta('text', d.text, 'placeholder="Was soll erledigt werden?"')))+
  fld('Fällig bis', inp('due', d.due, 'type="date"'))+fld('Dateien', filesEd(d)),
  foot:(d.id?'<button class="btn ghost" data-a="delHw">'+ic('trash')+'Löschen</button><span class="sp"></span>':'')+'<button class="btn ghost" data-a="closeM">Abbrechen</button><button class="btn" data-a="saveHw">Speichern</button>' }; };

M.hwStudent = d => { const h = byId('homework',d.h), s = byId('students',d.s), st = stOf(d.h,d.s)||{};
  return { title:esc(s?.name)+' · '+esc(h?.fach), body:
  '<p class="hw-t" style="font-weight:700">'+esc(h?.text)+'</p>'+
  '<div class="row"><span class="chip '+(st.done?'ok':'warn')+'">'+(st.done?'Erledigt '+(st.at?ago(st.at):''):'Noch offen')+'</span><button class="btn ghost sm" data-a="teacherToggle">'+(st.done?'Als offen markieren':'Als erledigt markieren')+'</button></div>'+
  (st.note?'<div class="fb" style="background:var(--card2)"><b>Notiz von '+esc(s?.name)+':</b> '+esc(st.note)+'</div>':'')+
  fld('Rückmeldung an '+esc(s?.name), ta('feedback', d.feedback, 'placeholder="z. B. Super gemacht! Bei Nr. 3 nochmal auf das Kürzen achten." autofocus')),
  foot:'<button class="btn ghost" data-a="closeM">Schließen</button><button class="btn" data-a="saveFeedback">Rückmeldung senden</button>' }; };

M.hwNote = d => ({ title:'Notiz an '+esc(set().teacherName||'deine Lehrkraft'), body: fld('Was möchtest du sagen oder fragen?', ta('note', d.note, 'placeholder="z. B. Bei Aufgabe 2 komme ich nicht weiter." autofocus')),
  foot:'<button class="btn ghost" data-a="closeM">Abbrechen</button><button class="btn" data-a="saveNote">Senden</button>' });

M.stud = d => ({ title: d.id?'Schüler bearbeiten':'Schüler anlegen', body:
  '<div class="two">'+fld('Name', inp('name', d.name, 'placeholder="Vorname (und Nachname)" autofocus'))+fld('Klasse', '<select class="inp" data-k="klasse">'+['5','6','7','8','9','10','11','12','13'].map(k=>'<option '+(d.klasse===k?'selected':'')+'>'+k+'</option>').join('')+'</select>')+'</div>'+
  fld('Gruppe', '<select class="inp" data-k="groupId"><option value="">Ohne Gruppe</option>'+groups().map(g=>'<option value="'+esc(g.id)+'" '+(d.groupId===g.id?'selected':'')+'>'+esc(g.name)+'</option>').join('')+'</select>', groups().length?'':'Tipp: Unter „Schüler“ kannst du Gruppen wie „Familie Schmidt“ anlegen.')+
  fld('Schule (optional)', inp('schule', d.schule, 'placeholder="z. B. Heinrich-von-Bibra-Schule"'))+
  fld('Fächer', '<div class="seg">'+FAECHER.map(f=>'<button type="button" class="'+(d.faecher.includes(f)?'on':'')+'" data-a="multiToggle" data-k="faecher" data-v="'+f+'"><span class="dot" style="background:'+fc(f)+'"></span>'+f+'</button>').join('')+'</div>')+
  '<div class="box"><b>Zugang zu Klecks</b><div class="two">'+fld('Benutzername', inp('username', d.username, 'autocapitalize="off" placeholder="z. B. lea.schmidt"'), 'Leer lassen = aus dem Namen')+
  fld(d.id?'Neues Passwort (leer = bleibt)':'Passwort', '<div class="row" style="flex-wrap:nowrap">'+inp('pw', d.pw, 'autocomplete="off"')+'<button type="button" class="btn ghost sm" data-a="genPw">Neu</button></div>', 'Mindestens 6 Zeichen')+'</div></div>'+
  fld('Farbe', '<div class="swatches">'+COLORS.map(c=>'<button type="button" class="'+(d.color===c?'on':'')+'" style="background:'+c+'" data-a="segSet" data-k="color" data-v="'+c+'" aria-label="Farbe '+c+'"></button>').join('')+'</div>'),
  foot:(d.id?'<button class="btn ghost" data-a="delStud">'+ic('trash')+'Löschen</button><span class="sp"></span>':'')+'<button class="btn ghost" data-a="closeM">Abbrechen</button><button class="btn" data-a="saveStud">Speichern</button>' });

M.creds = d => ({ title:'Zugangsdaten', body:'<p>Gib diese Daten <b>'+esc(d.name)+'</b> oder den Eltern. Das Passwort wird nur jetzt angezeigt – danach kannst du nur ein neues vergeben.</p>'+
  '<div class="creds"><div><span>Benutzername</span><b>'+esc(d.username)+'</b></div><div><span>Passwort</span><b>'+esc(d.pw)+'</b></div></div>',
  foot:'<button class="btn ghost" data-a="copyCreds">Kopieren</button><button class="btn" data-a="closeM">Fertig</button>' });

M.group = d => ({ title: d.id?'Gruppe bearbeiten':'Neue Gruppe', body:
  fld('Name der Gruppe', inp('name', d.name, 'placeholder="z. B. Familie Schmidt" autofocus'))+
  fld('Notiz (optional)', inp('note', d.note, 'placeholder="z. B. dienstags 15 Uhr bei Schmidts"'))+
  fld('Farbe', '<div class="swatches">'+COLORS.map(c=>'<button type="button" class="'+(d.color===c?'on':'')+'" style="background:'+c+'" data-a="segSet" data-k="color" data-v="'+c+'" aria-label="Farbe '+c+'"></button>').join('')+'</div>')+
  (students().length?fld('Wer gehört dazu?', '<div class="seg">'+students().map(s=>'<button type="button" class="'+(d.members.includes(s.id)?'on':'')+'" data-a="multiToggle" data-k="members" data-v="'+esc(s.id)+'">'+ava(s,'xs')+esc(s.name)+(s.groupId&&s.groupId!==d.id&&!d.members.includes(s.id)?' <span class="muted tiny">('+esc(byId('groups',s.groupId)?.name||'')+')</span>':'')+'</button>').join('')+'</div>'):''),
  foot:(d.id?'<button class="btn ghost" data-a="delGroup">'+ic('trash')+'Löschen</button><span class="sp"></span>':'')+'<button class="btn ghost" data-a="closeM">Abbrechen</button><button class="btn" data-a="saveGroup">Speichern</button>' });

M.studDetail = d => { const s = byId('students',d.id); if(!s) return {title:'Schüler',body:''};
  const p = prog(s.id), h = hwStats(s.id), L = level(p.xp);
  const ex = examsFor(s.id).sort(by('date',-1));
  const cs = coursesFor(s);
  const openHw = hwFor(s.id).filter(x=>!isDone(x.id,s.id)).sort(by('due'));
  return { title:ava(s,'sm')+' '+esc(s.name), wide:true, body:
    '<div class="kpis" style="margin:0">'+kpi(h.done+'/'+h.total,'Hausaufgaben erledigt')+kpi(L.lv,'Level')+kpi(p.xp||0,'Punkte')+kpi(streak(p),'Tage in Folge')+'</div>'+
    '<div class="row"><span class="chip">Klasse '+esc(s.klasse)+'</span>'+(s.schule?'<span class="chip">'+esc(s.schule)+'</span>':'')+(s.faecher||[]).map(fchip).join('')+(groupOf(s)?'<span class="chip" style="background:'+esc(groupOf(s).color)+';color:#fff;border-color:transparent">'+esc(groupOf(s).name)+'</span>':'')+'<span class="chip">'+ic('lock')+esc(s.username||'kein Zugang')+'</span>'+'</div>'+
    '<div class="grid2" style="gap:16px"><div><h3 style="margin-bottom:8px">Offene Hausaufgaben</h3>'+(openHw.length?'<div class="list">'+openHw.map(x=>'<div class="li"><span class="dot" style="background:'+fc(x.fach)+'"></span><div class="grow"><b>'+esc(short(x.text,60))+'</b><span class="muted small">bis '+rel(x.due)+'</span></div></div>').join('')+'</div>':'<p class="muted small">Alles erledigt.</p>')+
    '<h3 style="margin:16px 0 8px">Klausuren & Noten</h3>'+(ex.length?'<div class="list">'+ex.map(e=>examLi(e,false)).join('')+'</div>':'<p class="muted small">Keine Klausuren eingetragen.</p>')+'<button class="btn ghost sm" style="margin-top:8px" data-a="newExam" data-sid="'+esc(s.id)+'">'+ic('plus')+'Klausur eintragen</button></div>'+
    '<div><h3 style="margin-bottom:8px">Lernwelt</h3>'+(cs.length?'<div class="list">'+cs.map(c=>{ const max=(c.lessons||[]).length*3, got=courseStars(c,p); return '<div class="li"><span class="c-mini" style="background:'+fc(c.fach)+'">'+esc(fg(c.fach))+'</span><div class="grow"><b>'+esc(c.title)+'</b><div class="bar sun" style="margin-top:6px"><i style="width:'+(max?got/max*100:0)+'%"></i></div></div><span class="small muted nowrap">'+got+'/'+max+'</span></div>'; }).join('')+'</div>':'<p class="muted small">Keine Kurse zugewiesen.</p>')+'</div></div>',
    foot:'<button class="btn ghost" data-a="newHwFor" data-id="'+esc(s.id)+'">'+ic('task')+'Hausaufgabe</button><span class="sp"></span><button class="btn" data-a="editStud" data-id="'+esc(s.id)+'">'+ic('edit')+'Bearbeiten</button>' }; };

M.exam = d => { const teacher = isTeacher();
  return { title: d.id?'Klausur':'Klausur eintragen', body:
  (teacher&&!d.id?fld('Schüler', '<div class="seg">'+students().map(s=>'<button type="button" class="'+(d.studentId===s.id?'on':'')+'" data-a="segSet" data-k="studentId" data-v="'+esc(s.id)+'">'+ava(s,'xs')+esc(s.name)+'</button>').join('')+'</div>'):'')+
  '<div class="two">'+fld('Datum', inp('date', d.date, 'type="date"'))+fld('Fach', segF('fach', d.fach, FAECHER))+'</div>'+
  fld('Themen (optional)', ta('themen', d.themen, 'placeholder="z. B. Brüche kürzen, Teilbarkeitsregeln, Primfaktorzerlegung" autofocus'), 'Damit wir gezielt üben können.')+
  (d.id && diffDays(d.date)<=0 ? fld('Note (nach der Klausur)', '<div class="seg">'+['1','2','3','4','5','6'].map(n=>'<button type="button" class="'+(String(d.note)===n?'on':'')+'" data-a="segSet" data-k="note" data-v="'+n+'">'+n+'</button>').join('')+'<button type="button" data-a="segSet" data-k="note" data-v="">–</button></div>', 'Gerne auch mit + oder – im Kommentar.')+fld('Kommentar', inp('kommentar', d.kommentar, 'placeholder="z. B. 2-, Bruchrechnung lief super"')):'')+
  (d.id?examLinks(d):''),
  foot:(d.id?'<button class="btn ghost" data-a="delExam">'+ic('trash')+'Löschen</button><span class="sp"></span>':'')+'<button class="btn ghost" data-a="closeM">Abbrechen</button><button class="btn" data-a="saveExam">Speichern</button>' }; };
function examLinks(d){
  const s = byId('students', d.studentId); if(!s) return '';
  const cs = coursesFor(s).filter(c=>c.fach===d.fach);
  const ent = entriesFor(s.id).filter(e=>e.fach===d.fach).sort(by('date',-1)).slice(0,3);
  return '<div class="box"><b>Zur Vorbereitung</b>'+
    (cs.length?'<div class="list">'+cs.map(c=>'<div class="li" data-a="openCourse" data-id="'+esc(c.id)+'" style="cursor:pointer"><span class="c-mini" style="background:'+fc(c.fach)+'">'+esc(fg(c.fach))+'</span><div class="grow"><b>'+esc(c.title)+'</b><span class="muted small">Lernwelt-Kurs</span></div>'+ic('next')+'</div>').join('')+'</div>':'<p class="muted small">Noch kein passender Lernkurs.</p>')+
    (ent.length?'<div class="list">'+ent.map(e=>'<a class="li" href="#unterricht" data-a="closeM" style="text-decoration:none;color:inherit">'+ic('book')+'<div class="grow"><b>'+esc(e.thema)+'</b><span class="muted small">Stunde am '+fmt(e.date)+'</span></div></a>').join('')+'</div>':'')+'</div>';
}

M.termin = d => ({ title: d.id?'Termin bearbeiten':'Nachhilfe-Termin', body:
  '<div class="two">'+fld('Datum', inp('date', d.date, 'type="date"'))+fld('Uhrzeit', inp('time', d.time, 'type="time"'))+'</div>'+
  fld('Schüler', studPick('studentIds', d.studentIds))+fld('Fach', segF('fach', d.fach, ['Alle',...FAECHER.slice(0,3)]))+
  fld('Notiz (optional)', inp('note', d.note, 'placeholder="z. B. Ort, Vorbereitung auf die Klausur"'))+
  (!d.id?'<label class="toggle"><input type="checkbox" data-k="weekly" '+(d.weekly?'checked':'')+'> Wöchentlich wiederholen (4 Wochen)</label>':''),
  foot:(d.id?'<button class="btn ghost" data-a="delTermin">'+ic('trash')+'Löschen</button><span class="sp"></span>':'')+'<button class="btn ghost" data-a="closeM">Abbrechen</button><button class="btn" data-a="saveTermin">Speichern</button>' });

M.settings = d => ({ title:'Einstellungen', body:
  fld('Dein Name (wird den Schülern angezeigt)', inp('teacherName', d.teacherName, 'autofocus'))+
  fld('Benutzername', '<input class="inp" value="'+esc(set().teacherUser||'')+'" disabled>')+
  '<div class="box"><b>Passwort ändern</b><div class="two">'+fld('Neues Passwort', inp('pw', d.pw, 'type="password" autocomplete="new-password"'), 'Mindestens 8 Zeichen')+fld('Wiederholen', inp('pw2', d.pw2, 'type="password" autocomplete="new-password"'))+'</div></div>',
  foot:'<button class="btn ghost" data-a="closeM">Abbrechen</button><button class="btn" data-a="saveSettings">Speichern</button>' });

M.notifs = () => { const list = myNotifs(), rem = reminders(), ra = S.m.d.readAt;
  return { title:'Benachrichtigungen', body:
  (rem.length?'<div><h3 style="margin-bottom:8px">Erinnerungen</h3><div class="list">'+rem.map(r=>'<a class="li" href="#'+r.link+'" data-a="closeM" style="text-decoration:none;color:inherit"><span class="dot" style="background:'+(r.kind==='bad'?'var(--bad)':r.kind==='warn'?'var(--sun)':'var(--brand)')+'"></span><div class="grow"><b>'+esc(r.text)+'</b></div></a>').join('')+'</div></div>':'')+
  '<div><h3 style="margin-bottom:8px">Neuigkeiten</h3>'+(list.length?'<div class="list">'+list.map(n=>'<a class="li" href="#'+esc(n.link||'start')+'" data-a="closeM" style="text-decoration:none;color:inherit;'+(n.at>ra?'background:var(--brand-soft)':'')+'">'+ic(n.kind==='hw'?'task':n.kind==='exam'?'exam':n.kind==='course'?'rocket':n.kind==='entry'?'book':n.kind==='termin'?'cal':'bell')+'<div class="grow"><b>'+esc(n.text)+'</b><span class="muted small">'+ago(n.at)+'</span></div></a>').join('')+'</div>':'<p class="muted small">Noch keine Benachrichtigungen.</p>')+'</div>' }; };

M.menu = () => ({ title:'Konto', body:'<div class="me">'+ava(isTeacher()?{name:set().teacherName||'L',color:'#2448d8'}:me())+'<div>'+esc(isTeacher()?(set().teacherName||'Lehrkraft'):me().name)+'<small>'+(isTeacher()?'Lehrkraft':'Klasse '+esc(me().klasse))+'</small></div></div>',
  foot:(isTeacher()?'<button class="btn ghost" data-a="settings">'+ic('gear')+'Einstellungen</button>':'')+'<button class="btn" data-a="logout">'+ic('out')+'Abmelden</button>' });

M.courseProgress = d => { const c = byId('courses',d.id); const studs = students().filter(s=>coursesFor(s).some(x=>x.id===c.id));
  return { title:'Fortschritt: '+esc(c.title), wide:true, body: studs.length ? '<table class="tbl"><thead><tr><th>Schüler</th>'+(c.lessons||[]).map((l,i)=>'<th>L'+(i+1)+'</th>').join('')+'<th class="num">Summe</th></tr></thead><tbody>'+
    studs.map(s=>{ const p = prog(s.id); return '<tr style="cursor:default"><td class="first"><div class="who-cell">'+ava(s,'xs')+esc(s.name)+'</div></td>'+(c.lessons||[]).map((l,i)=>'<td data-l="'+esc(l.title)+'">'+stars(p.stars?.[c.id+'__'+l.id]||0)+'</td>').join('')+'<td class="num" data-l="Summe">'+courseStars(c,p)+'/'+(c.lessons||[]).length*3+'</td></tr>'; }).join('')+'</tbody></table>' : '<p class="muted">Diesem Kurs sind noch keine Schüler zugeordnet.</p>' }; };

M.course = d => {
  if(d.edit!=null){ const l = d.lessons[d.edit]; const base = 'lessons.'+d.edit;
    return { title:'Lektion bearbeiten', wide:true, body:
      fld('Titel der Lektion', inp(base+'.title', l.title, 'placeholder="z. B. Brüche kürzen" autofocus'))+
      fld('Erklärung (wird vor den Fragen gezeigt)', ta(base+'.intro', l.intro, 'placeholder="Kurz und kindgerecht erklären, mit Beispiel."'))+
      '<div class="row between"><h3>Fragen ('+l.questions.length+')</h3></div>'+
      l.questions.map((q,qi)=>{ const qb = base+'.questions.'+qi;
        return '<div class="qed"><div class="qed-h"><span>Frage '+(qi+1)+'</span><div class="row"><div class="seg"><button type="button" class="'+(q.type!=='input'?'on':'')+'" data-a="segSet" data-k="'+qb+'.type" data-v="mc">Auswahl</button><button type="button" class="'+(q.type==='input'?'on':'')+'" data-a="segSet" data-k="'+qb+'.type" data-v="input">Eingabe</button></div><button type="button" class="btn ghost icon" data-a="rmQ" data-i="'+qi+'" aria-label="Frage löschen">'+ic('trash')+'</button></div></div>'+
          ta(qb+'.q', q.q, 'placeholder="Frage" style="min-height:60px"')+
          (q.type==='input' ? fld('Richtige Antwort', inp(qb+'.answer', q.answer, 'placeholder="z. B. 3/4"'), 'Mehrere richtige Antworten mit | trennen, z. B. 0,5|1/2') :
            '<div class="tiny muted" style="font-weight:800">Antworten – richtige ankreuzen</div>'+[0,1,2,3].map(oi=>'<div class="optrow"><input type="radio" name="r'+qi+'" data-k="'+qb+'.answer" value="'+oi+'" '+(Number(q.answer)===oi?'checked':'')+' aria-label="Antwort '+(oi+1)+' ist richtig">'+inp(qb+'.options.'+oi, (q.options||[])[oi], 'placeholder="Antwort '+(oi+1)+(oi>1?' (optional)':'')+'"')+'</div>').join(''))+
          inp(qb+'.hint', q.hint, 'placeholder="Tipp / Erklärung bei falscher Antwort (optional)"')+'</div>'; }).join('')+
      '<button type="button" class="btn ghost" data-a="addQ">'+ic('plus')+'Frage hinzufügen</button>',
      foot:'<button class="btn" data-a="lessonDone">Fertig</button>' };
  }
  return { title: d.id?'Kurs bearbeiten':'Neuer Lernkurs', wide:true, body:
    fld('Titel', inp('title', d.title, 'placeholder="z. B. Bruchrechnung" autofocus'))+
    fld('Kurzbeschreibung', inp('desc', d.desc, 'placeholder="Worum geht es?"'))+
    '<div class="two">'+fld('Fach', segF('fach', d.fach, FAECHER))+fld('Klasse', segF('klasse', d.klasse, ['5','6','7','8','alle']))+'</div>'+
    fld('Nur für bestimmte Schüler? (optional)', studPick('studentIds', d.studentIds), 'Leer lassen = alle Schüler der gewählten Klasse.')+
    '<div><h3 style="margin-bottom:8px">Lektionen</h3><div class="stack" style="gap:8px">'+d.lessons.map((l,i)=>'<div class="les"><span class="c-mini" style="background:'+fc(d.fach)+'">'+(i+1)+'</span><span class="grow">'+esc(l.title||'Ohne Titel')+'<br><span class="muted small">'+l.questions.length+' Fragen</span></span><button type="button" class="btn ghost icon" data-a="mvL" data-i="'+i+'" data-n="-1" aria-label="Nach oben">↑</button><button type="button" class="btn ghost icon" data-a="editL" data-i="'+i+'" aria-label="Bearbeiten">'+ic('edit')+'</button><button type="button" class="btn ghost icon" data-a="rmL" data-i="'+i+'" aria-label="Löschen">'+ic('trash')+'</button></div>').join('')+'</div>'+
    '<button type="button" class="btn ghost" style="margin-top:10px" data-a="addL">'+ic('plus')+'Lektion hinzufügen</button></div>',
    foot:(d.id?'<button class="btn ghost" data-a="delCourse">'+ic('trash')+'Löschen</button><span class="sp"></span>':'')+'<button class="btn ghost" data-a="closeM">Abbrechen</button><button class="btn" data-a="saveCourse">Speichern</button>' };
};

/* ---------- Binding für Formularfelder ---------- */
function setPath(o, path, v){ const ks = path.split('.'); let t = o; for(let i=0;i<ks.length-1;i++){ const k = ks[i]; if(t[k]==null) t[k] = /^\d+$/.test(ks[i+1]) ? [] : {}; t = t[k]; } t[ks[ks.length-1]] = v; }
function getPath(o, path){ return path.split('.').reduce((t,k)=>t==null?t:t[k], o); }
document.addEventListener('input', e => {
  const k = e.target.dataset?.k; if(!k || !S.m) return;
  const el = e.target;
  const v = el.type==='checkbox' ? el.checked : el.type==='radio' ? Number(el.value) : el.value;
  setPath(S.m.d, k, v);
  if(el.dataset.rerender) renderM();
});
document.addEventListener('change', e => {
  const el = e.target;
  if(el.dataset?.k && S.m && (el.type==='checkbox' || el.type==='radio' || el.tagName==='SELECT')){ setPath(S.m.d, el.dataset.k, el.type==='checkbox'?el.checked:el.type==='radio'?Number(el.value):el.value); if(el.dataset.rerender) renderM(); }
  if(el.dataset?.a==='studFilter'){ S.ui.stud = el.value; render(); }
  if(el.dataset?.a==='upload') upload(el.files);
});
async function upload(files){
  if(!S.assets || !files?.length) return;
  S.m.d.uploading = true; renderM();
  for(const f of files){
    if(f.size > 20*1024*1024){ toast(f.name+' ist größer als 20 MB.'); continue; }
    try{ const r = await KD.uploadFile(f); (S.m.d.files ||= []).push(r); }
    catch(e){ toast('Upload fehlgeschlagen: '+f.name); }
  }
  if(S.m){ S.m.d.uploading = false; renderM(); }
}

/* =====================================================================
   Lern-Player
   ===================================================================== */
function shuffle(a){ a = a.slice(); for(let i=a.length-1;i>0;i--){ const j = Math.floor(Math.random()*(i+1)); [a[i],a[j]] = [a[j],a[i]]; } return a; }
function startLesson(ci, li){
  const c = byId('courses',ci); const l = c?.lessons?.[li]; if(!l) return;
  const qs = (l.questions||[]).filter(q=>q.q).map(q => q.type==='input' ? {...q} : {...q, opts:shuffle((q.options||[]).map((t,i)=>({t,i})).filter(o=>String(o.t||'').trim()))});
  S.p = {c, l, li, qs, i:0, phase: l.intro ? 'intro' : 'q', sel:null, val:'', right:0, wrong:[], ok:null};
  renderP();
}
const norm = s => String(s??'').trim().toLowerCase().replace(/\s+/g,' ').replace(/,/g,'.').replace(/[.!?]$/,'');
function checkAnswer(){
  const p = S.p, q = p.qs[p.i];
  let ok;
  if(q.type==='input'){ const alts = String(q.answer||'').split('|').map(norm).filter(Boolean); ok = alts.includes(norm(p.val)); }
  else ok = p.sel === Number(q.answer);
  p.ok = ok; p.phase = 'fb'; if(ok) p.right++; else p.wrong.push(p.i);
  renderP();
}
async function finishLesson(){
  const p = S.p; const total = p.qs.length || 1; const pct = p.right/total;
  const st = pct>=.9?3:pct>=.7?2:pct>=.4?1:0;
  p.phase = 'end'; p.stars = st; p.xp = p.right*10;
  if(!isTeacher()){
    const sid = S.session.id; const old = prog(sid); const key = p.c.id+'__'+p.l.id;
    const prev = old.stars?.[key]||0; if(st===3 && prev<3) p.xp += 20;
    const wk = weekKey(); const t = today();
    const days = [...new Set([...(old.days||[]), t])].sort().slice(-30);
    const body = { xp:(old.xp||0)+p.xp, stars:{...(old.stars||{}), [key]:Math.max(prev,st)}, plays:(old.plays||0)+1, lastActive:Date.now(), weekKey:wk, weekXp:(old.weekKey===wk?(old.weekXp||0):0)+p.xp, days };
    p.saved = await save('progress', sid, body);
    if(st===3 && prev<3) notify('teacher', me().name+' hat „'+p.l.title+'“ ('+p.c.title+') mit 3 Sternen geschafft', 'lernen', 'course');
  }
  renderP();
}
function renderP(){
  const p = S.p, el = $('#player'); if(!p){ el.innerHTML = ''; document.body.style.overflow=''; return; }
  document.body.style.overflow = 'hidden';
  const total = p.qs.length; const progress = p.phase==='end' ? 100 : (p.i + (p.phase==='fb'?1:0))/Math.max(1,total)*100;
  let main = '', foot = '', footCls = '';
  if(p.phase==='intro'){
    main = '<span class="chip f" style="background:'+fc(p.c.fach)+';justify-self:start">'+esc(p.c.title)+'</span><h1>'+esc(p.l.title)+'</h1><div class="p-explain">'+esc(p.l.intro)+'</div>';
    foot = '<div class="p-fb muted">'+total+' Fragen warten auf dich</div><button class="btn" data-a="pStart" autofocus>Los geht’s '+ic('next')+'</button>';
  } else if(p.phase==='end'){
    const msg = p.stars===3?'Perfekt!':p.stars===2?'Sehr gut!':p.stars===1?'Gut gemacht!':'Weiter üben!';
    main = '<div class="p-end"><div class="big-stars">'+[0,1,2].map(i=>star(i<p.stars)).join('')+'</div><h1>'+msg+'</h1><p class="muted" style="font-size:18px">'+p.right+' von '+total+' richtig'+(isTeacher()?' (Vorschau – nicht gespeichert)':'')+'</p>'+
      (isTeacher()?'':'<span class="chip" style="font-size:16px;padding:6px 14px;background:var(--brand-soft);color:var(--brand)">'+ic('bolt')+'+'+p.xp+' Punkte</span>')+
      (p.wrong.length?'<div class="hint" style="text-align:left;max-width:520px">Schau dir diese Fragen nochmal an:<br>'+p.wrong.map(i=>'• '+esc(short(p.qs[i].q,80))).join('<br>')+'</div>':'')+'</div>';
    foot = '<button class="btn ghost" data-a="pRetry">Nochmal</button><span style="flex:1"></span>'+(p.c.lessons[p.li+1]?'<button class="btn" data-a="pNext">Nächste Lektion '+ic('next')+'</button>':'<button class="btn" data-a="pClose">Fertig</button>');
  } else {
    const q = p.qs[p.i]; const fb = p.phase==='fb';
    main = '<div class="muted small" style="font-weight:800">Frage '+(p.i+1)+' von '+total+'</div><div class="p-q">'+esc(q.q)+'</div>';
    if(q.type==='input'){
      main += '<input class="p-input" id="pin-in" value="'+esc(p.val)+'" '+(fb?'disabled':'')+' placeholder="Deine Antwort" autocomplete="off" autofocus>';
    } else {
      main += '<div class="opts">'+q.opts.map(o=>{ let cls = ''; if(fb){ if(o.i===Number(q.answer)) cls='right'; else if(o.i===p.sel) cls='wrong'; } else if(o.i===p.sel) cls='sel';
        return '<button class="opt '+cls+'" data-a="pSel" data-i="'+o.i+'" '+(fb?'disabled':'')+'>'+esc(o.t)+'</button>'; }).join('')+'</div>';
    }
    if(fb){
      footCls = p.ok?'right':'wrong';
      const correct = q.type==='input' ? String(q.answer).split('|')[0] : (q.options||[])[Number(q.answer)];
      foot = '<div class="p-fb"><b>'+(p.ok?'Richtig! +10':'Nicht ganz')+'</b>'+(p.ok?'':'Richtig ist: '+esc(correct))+(q.hint&&!p.ok?'<div class="small" style="font-weight:700;margin-top:4px">'+esc(q.hint)+'</div>':'')+'</div><button class="btn '+(p.ok?'ok':'bad')+'" data-a="pCont" autofocus>Weiter</button>';
    } else {
      const can = q.type==='input' ? p.val.trim()!=='' : p.sel!=null;
      foot = '<div class="p-fb"></div><button class="btn" data-a="pCheck" '+(can?'':'disabled')+'>Prüfen</button>';
    }
  }
  el.innerHTML = '<div class="play"><div class="p-top"><button class="btn ghost icon" data-a="pClose" aria-label="Beenden">'+ic('x')+'</button><div class="bar"><i style="width:'+progress+'%"></i></div></div><div class="p-main">'+main+'</div><div class="p-foot '+footCls+'"><div class="p-foot-in">'+foot+'</div></div></div>';
  const af = el.querySelector('[autofocus]'); if(af) af.focus();
}
document.addEventListener('keydown', e => {
  if(e.key==='Escape'){ if(S.m){ closeM(); } return; }
  if(!S.p) return;
  if(e.target.id==='pin-in' && e.key==='Enter'){ e.preventDefault(); if(S.p.phase==='q' && S.p.val.trim()) checkAnswer(); else if(S.p.phase==='fb') pCont(); }
});
document.addEventListener('input', e => { if(e.target.id==='pin-in' && S.p){ S.p.val = e.target.value; const b = $('[data-a=pCheck]'); if(b) b.disabled = !S.p.val.trim(); } });
function pCont(){ const p = S.p; p.i++; p.sel = null; p.val = ''; p.ok = null; if(p.i>=p.qs.length) finishLesson(); else { p.phase = 'q'; renderP(); } }

/* =====================================================================
   Aktionen
   ===================================================================== */
const A = {};
A.noop = () => {};
A.openFile = async el => { const p = el.dataset.p; if(!p) return; const w = window.open('', '_blank'); try{ const url = await KD.fileUrl(p); if(w) w.location = url; else location.href = url; }catch(e){ if(w) w.close(); toast('Datei konnte nicht geöffnet werden.'); } };
A.theme = () => { const next = isDark() ? 'light' : 'dark'; document.documentElement.dataset.theme = next; pref('theme', next); render(); };
A.navToggle = () => { if(narrowMQ.matches) S.navOpen = !S.navOpen; else { S.navMin = !S.navMin; pref('navmin', S.navMin?'1':null); } render(); setTimeout(()=>document.querySelectorAll('.fig-trail').forEach(drawTrail), 250); };
A.pwShow = el => { const i = el.previousElementSibling; i.type = i.type==='password' ? 'text' : 'password'; el.textContent = i.type==='password' ? 'Zeigen' : 'Verbergen'; };
A.logout = () => { closeM(); S.p = null; renderP(); setSession(null); };
A.menu = () => openM('menu');
A.settings = () => openM('settings', {teacherName:set().teacherName||'', pw:'', pw2:''});
A.saveSettings = async () => { const d = S.m.d;
  if(d.pw){ if(d.pw.length<8) return toast('Das Passwort braucht mindestens 8 Zeichen.'); if(d.pw!==d.pw2) return toast('Die Passwörter stimmen nicht überein.');
    try{ await KD.changeOwnPassword(d.pw); }catch(e){ return toast('Passwort konnte nicht geändert werden.'); } }
  if(await save('settings','main',{...strip(set()), teacherName:d.teacherName.trim()})){ closeM(); toast(d.pw?'Gespeichert – neues Passwort aktiv':'Gespeichert'); } };
A.notifs = async () => { const ra = readAt(); openM('notifs', {readAt:ra}); if(myNotifs().some(n=>n.at>ra) && !S.readOnly){ try{ await S.db.collection('notifread').doc(myKey()).set({at:Date.now()}); }catch(e){} } };
A.closeM = () => closeM();
A.ovClose = (el, ev) => { if(ev.target===el) closeM(); };
A.fach = el => { S.ui.fach = el.dataset.f; render(); };
A.hwTab = el => { S.ui.hwTab = el.dataset.t; render(); };
A.segSet = el => { const k = el.dataset.k; if(k.endsWith('.type') && getPath(S.m.d,k)!==el.dataset.v) setPath(S.m.d, k.replace(/type$/,'answer'), el.dataset.v==='input'?'':0); setPath(S.m.d, k, el.dataset.v); renderM._noFocus = true; renderM(); renderM._noFocus = false; };
A.multiToggle = el => { const k = el.dataset.k, v = el.dataset.v; const arr = getPath(S.m.d,k) || []; setPath(S.m.d, k, arr.includes(v) ? arr.filter(x=>x!==v) : [...arr, v]); renderM._noFocus = true; renderM(); renderM._noFocus = false; };
A.multiGroup = el => { const k = el.dataset.k; const ids = el.dataset.ids.split(','); const arr = getPath(S.m.d,k)||[]; const all = ids.every(id=>arr.includes(id)); setPath(S.m.d, k, all ? arr.filter(x=>!ids.includes(x)) : [...new Set([...arr, ...ids])]); renderM._noFocus = true; renderM(); renderM._noFocus = false; };
A.multiAll = el => { const k = el.dataset.k; const all = students().map(s=>s.id); const arr = getPath(S.m.d,k)||[]; setPath(S.m.d, k, arr.length===all.length ? [] : all); renderM._noFocus = true; renderM(); renderM._noFocus = false; };
A.rmFile = el => { S.m.d.files.splice(Number(el.dataset.i),1); renderM(); };
A.confirmYes = async () => { const fn = S.m.d.onYes; closeM(); if(fn) await fn(); };
function ask(title, text, onYes, yes){ openM('confirm', {title, text, onYes, yes}); }
const defaultStuds = fach => students().filter(s=>!s.faecher?.length || s.faecher.includes(fach)).map(s=>s.id);

/* Stunde */
const preIds = el => el?.dataset?.ids ? el.dataset.ids.split(',').filter(Boolean) : (students().length===1?[students()[0].id]:[]);
A.newEntry = el => openM('entry', {date:today(), fach:'Mathe', studentIds:preIds(el), thema:'', inhalt:'', files:[], hwOn:false, hwPer:false, hwText:'', hwTexts:{}, hwDue:addDays(today(),7), oldHw:[]});
A.editEntry = el => { const e = byId('entries', el.dataset.id); const hws = hwIdsOf(e).map(id=>byId('homework',id)).filter(Boolean);
  const per = hws.length>1 || (hws.length===1 && hws[0].studentIds.length===1 && (e.studentIds||[]).length>1);
  const texts = {}; if(per) hws.forEach(h=>texts[h.studentIds[0]] = h.text);
  openM('entry', {id:e.id, date:e.date, fach:e.fach, studentIds:[...(e.studentIds||[])], thema:e.thema, inhalt:e.inhalt||'', files:[...(e.files||[])], hwOn:!!hws.length, hwPer:per, hwText:per?'':(hws[0]?.text||''), hwTexts:texts, hwDue:hws[0]?.due||addDays(e.date,7), oldHw:hws.map(h=>h.id), createdAt:e.createdAt}); };
A.saveEntry = async () => {
  const d = S.m.d;
  if(!d.thema.trim()) return toast('Bitte ein Thema eintragen.');
  if(!d.studentIds.length) return toast('Bitte mindestens einen Schüler auswählen.');
  const per = d.hwOn && d.hwPer && d.studentIds.length>1;
  if(d.hwOn && !per && !String(d.hwText||'').trim()) return toast('Bitte die Hausaufgabe beschreiben.');
  if(per){ const miss = d.studentIds.find(id=>!String((d.hwTexts||{})[id]||'').trim()); if(miss) return toast('Bitte die Aufgabe für '+byId('students',miss)?.name+' eintragen.'); }
  const id = d.id || uid(); const isNew = !d.id;
  const old = (d.oldHw||[]).map(h=>byId('homework',h)).filter(Boolean);
  const want = !d.hwOn ? [] : per ? d.studentIds.map(sid=>({ids:[sid], text:d.hwTexts[sid].trim()})) : [{ids:d.studentIds, text:d.hwText.trim()}];
  const used = new Set(), hwIds = [];
  for(const w of want){
    const reuse = old.find(h=>!used.has(h.id) && (per ? h.studentIds.length===1 && h.studentIds[0]===w.ids[0] : true));
    const hid = reuse?.id || uid(); used.add(hid);
    if(!await save('homework', hid, {fach:d.fach, studentIds:w.ids, text:w.text, due:d.hwDue||addDays(d.date,7), files:reuse?.files||[], entryId:id, createdAt:reuse?.createdAt||Date.now()})) return;
    hwIds.push(hid);
    const fresh = w.ids.filter(x=>!(reuse?.studentIds||[]).includes(x));
    await notifyMany(fresh, 'Neue Hausaufgabe in '+d.fach+' bis '+fmt(d.hwDue), 'hausaufgaben', 'hw');
  }
  for(const h of old) if(!used.has(h.id)) await del('homework', h.id);
  if(!await save('entries', id, {date:d.date||today(), fach:d.fach, studentIds:d.studentIds, thema:d.thema.trim(), inhalt:d.inhalt.trim(), files:d.files||[], hwIds, createdAt:d.createdAt||Date.now()})) return;
  if(isNew) await notifyMany(d.studentIds, 'Neue Stunde in der Kursmappe: '+d.thema.trim(), 'unterricht', 'entry');
  closeM(); toast('Stunde gespeichert');
};
A.delEntry = () => { const d = S.m.d; ask('Stunde löschen?', 'Der Eintrag „'+d.thema+'“ wird gelöscht. Eine verknüpfte Hausaufgabe bleibt erhalten.', async()=>{ if(await del('entries', d.id)) toast('Gelöscht'); }); };

/* Hausaufgaben */
A.newHw = el => openM('hw', {fach:'Mathe', studentIds:preIds(el), text:'', texts:{}, per:false, due:addDays(today(),7), files:[]});
A.newHwFor = el => openM('hw', {fach:byId('students',el.dataset.id)?.faecher?.[0]||'Mathe', studentIds:[el.dataset.id], text:'', due:addDays(today(),7), files:[]});
A.editHw = el => { const h = byId('homework', el.dataset.id); openM('hw', {id:h.id, fach:h.fach, studentIds:[...h.studentIds], text:h.text, due:h.due, files:[...(h.files||[])], entryId:h.entryId||null, createdAt:h.createdAt}); };
A.saveHw = async () => { const d = S.m.d;
  if(!d.studentIds.length) return toast('Bitte mindestens einen Schüler auswählen.');
  if(d.per && !d.id && d.studentIds.length>1){
    const miss = d.studentIds.find(id=>!String((d.texts||{})[id]||'').trim()); if(miss) return toast('Bitte die Aufgabe für '+byId('students',miss)?.name+' eintragen.');
    for(const sid of d.studentIds){ const id = uid(); if(!await save('homework', id, {fach:d.fach, studentIds:[sid], text:d.texts[sid].trim(), due:d.due||addDays(today(),7), files:d.files||[], entryId:null, createdAt:Date.now()})) return; await notify(sid, 'Neue Hausaufgabe in '+d.fach+' bis '+fmt(d.due), 'hausaufgaben', 'hw'); }
    closeM(); toast(d.studentIds.length+' Hausaufgaben verteilt'); return; }
  if(!String(d.text||'').trim()) return toast('Bitte die Aufgabe beschreiben.');
  const id = d.id || uid(); const prev = d.id ? byId('homework', d.id) : null;
  if(!await save('homework', id, {fach:d.fach, studentIds:d.studentIds, text:d.text.trim(), due:d.due||addDays(today(),7), files:d.files||[], entryId:d.entryId||null, createdAt:d.createdAt||Date.now()})) return;
  const added = d.studentIds.filter(x=>!(prev?.studentIds||[]).includes(x));
  await notifyMany(added, 'Neue Hausaufgabe in '+d.fach+' bis '+fmt(d.due), 'hausaufgaben', 'hw');
  closeM(); toast('Hausaufgabe gespeichert'); };
A.delHw = () => { const d = S.m.d; ask('Hausaufgabe löschen?', 'Die Hausaufgabe und alle Häkchen dazu werden gelöscht.', async()=>{ if(await del('homework', d.id)){ for(const sid of d.studentIds) await del('hwstatus', d.id+'__'+sid); const e = data('entries').find(x=>hwIdsOf(x).includes(d.id)); if(e){ const c = strip(e); delete c.hwId; c.hwIds = hwIdsOf(e).filter(x=>x!==d.id); await save('entries', e.id, c); } toast('Gelöscht'); } }); };
const strip = o => { const c = {...o}; delete c.id; return c; };
A.toggleHw = async el => { const hid = el.dataset.id, sid = S.session.id; const st = stOf(hid,sid)||{}; const h = byId('homework',hid);
  const done = !st.done;
  if(await save('hwstatus', hid+'__'+sid, {...strip(st), hwId:hid, studentId:sid, done, at:Date.now()})){
    if(done){ toast('Erledigt – super!'); notify('teacher', me().name+' hat die '+h.fach+'-Hausaufgabe erledigt', 'hausaufgaben', 'hw'); }
  } };
A.hwNote = el => { const st = stOf(el.dataset.id, S.session.id)||{}; openM('hwNote', {hid:el.dataset.id, note:st.note||''}); };
A.saveNote = async () => { const d = S.m.d, sid = S.session.id; const st = stOf(d.hid,sid)||{}; const h = byId('homework',d.hid);
  if(await save('hwstatus', d.hid+'__'+sid, {...strip(st), hwId:d.hid, studentId:sid, done:!!st.done, at:st.at||Date.now(), note:d.note.trim()})){
    if(d.note.trim()) notify('teacher', me().name+' ('+h.fach+'-HA): „'+short(d.note,80)+'“', 'hausaufgaben', 'hw');
    closeM(); toast('Notiz gesendet'); } };
A.hwStudent = el => { const st = stOf(el.dataset.h, el.dataset.s)||{}; openM('hwStudent', {h:el.dataset.h, s:el.dataset.s, feedback:st.feedback||''}); };
A.teacherToggle = async () => { const d = S.m.d; const st = stOf(d.h,d.s)||{};
  if(await save('hwstatus', d.h+'__'+d.s, {...strip(st), hwId:d.h, studentId:d.s, done:!st.done, at:Date.now()})) renderM(); };
A.saveFeedback = async () => { const d = S.m.d; const st = stOf(d.h,d.s)||{}; const h = byId('homework',d.h);
  if(await save('hwstatus', d.h+'__'+d.s, {...strip(st), hwId:d.h, studentId:d.s, done:!!st.done, at:st.at||Date.now(), feedback:d.feedback.trim(), fbAt:Date.now()})){
    if(d.feedback.trim()) notify(d.s, 'Rückmeldung zu deiner '+h.fach+'-Hausaufgabe', 'hausaufgaben', 'hw');
    closeM(); toast('Rückmeldung gesendet'); } };

/* Schüler */
A.newStud = el => openM('stud', {name:'', klasse:'5', schule:'', groupId:el?.dataset?.g || (S.ui.stud.startsWith('g:')?S.ui.stud.slice(2):''), faecher:['Mathe'], username:'', pw:genPw(), color:COLORS[students().length % COLORS.length]});
A.editStud = el => { const s = byId('students', el.dataset.id); openM('stud', {id:s.id, name:s.name, klasse:s.klasse, schule:s.schule||'', groupId:s.groupId||'', faecher:[...(s.faecher||[])], username:s.username||'', pw:'', color:s.color, createdAt:s.createdAt}); };
A.genPw = () => { S.m.d.pw = genPw(); renderM(); };
A.saveStud = async () => { const d = S.m.d;
  const name = d.name.trim(); if(!name) return toast('Bitte einen Namen eingeben.');
  const u = normUser(d.username || name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ß/g,'ss'));
  if(!/^[a-z0-9._-]{3,40}$/.test(u)) return toast('Benutzername: mind. 3 Zeichen, nur a–z, Zahlen, Punkt, Strich.');
  if(u===set().teacherUser || students().some(s=>s.id!==d.id && s.username===u)) return toast('Dieser Benutzername ist schon vergeben.');
  const old = d.id ? byId('students', d.id) : null;
  if(!d.id && String(d.pw||'').length<6) return toast('Das Passwort braucht mindestens 6 Zeichen.');
  if(d.pw && String(d.pw).length<6) return toast('Das Passwort braucht mindestens 6 Zeichen.');
  const btn = $('[data-a=saveStud]'); if(btn){ btn.disabled = true; btn.textContent = 'Speichere …'; }
  let id = d.id;
  if(!id){ const r = await KD.manageUser({action:'create', username:u, password:d.pw}); if(r.error){ if(btn){ btn.disabled=false; btn.textContent='Speichern'; } return toast(r.error); } id = r.uid; }
  else if(d.pw || old?.username!==u){ const r = await KD.manageUser({action:'update', uid:id, username: old?.username!==u ? u : '', password:d.pw||''}); if(r.error){ if(btn){ btn.disabled=false; btn.textContent='Speichern'; } return toast(r.error); } }
  if(!await save('students', id, {name, username:u, klasse:d.klasse, schule:d.schule.trim(), groupId:d.groupId||'', faecher:d.faecher, color:d.color, createdAt:d.createdAt||Date.now()})) return;
  if(d.pw) openM('creds', {name, username:u, pw:d.pw}); else { closeM(); toast('Gespeichert'); } };
A.copyCreds = async () => { const d = S.m.d; try{ await navigator.clipboard.writeText('Klecks – Zugang für '+d.name+'\nAdresse: '+location.href.split('#')[0]+'\nBenutzername: '+d.username+'\nPasswort: '+d.pw); toast('Kopiert'); }catch(e){ toast('Kopieren nicht möglich – bitte abschreiben.'); } };
A.delStud = () => { const d = S.m.d; ask(d.name+' löschen?', 'Profil, Zugang, Lernfortschritt und Klausuren werden gelöscht. Einträge in der Kursmappe bleiben.', async()=>{
  const r = await KD.manageUser({action:'delete', uid:d.id}); if(r.error) return toast(r.error);
  await del('students', d.id); await del('progress', d.id); for(const e of examsFor(d.id)) await del('exams', e.id); toast('Gelöscht'); }); };
A.newGroup = () => openM('group', {name:'', note:'', color:COLORS[groups().length % COLORS.length], members:[]});
A.editGroup = el => { const g = byId('groups', el.dataset.id); openM('group', {id:g.id, name:g.name, note:g.note||'', color:g.color, members:students().filter(s=>s.groupId===g.id).map(s=>s.id), createdAt:g.createdAt}); };
A.saveGroup = async () => { const d = S.m.d; if(!d.name.trim()) return toast('Bitte einen Namen eingeben.');
  const id = d.id || uid();
  if(!await save('groups', id, {name:d.name.trim(), note:(d.note||'').trim(), color:d.color, createdAt:d.createdAt||Date.now()})) return;
  for(const s of students()){ const inG = d.members.includes(s.id); if(inG && s.groupId!==id) await save('students', s.id, {...strip(s), groupId:id}); if(!inG && s.groupId===id) await save('students', s.id, {...strip(s), groupId:''}); }
  closeM(); toast(d.id?'Gespeichert':'Gruppe „'+d.name.trim()+'“ angelegt'); };
A.delGroup = () => { const d = S.m.d; ask('Gruppe „'+d.name+'“ löschen?', 'Die Schüler bleiben erhalten und landen unter „Ohne Gruppe“.', async()=>{ if(await del('groups', d.id)){ for(const s of students().filter(x=>x.groupId===d.id)) await save('students', s.id, {...strip(s), groupId:''}); toast('Gelöscht'); } }); };
A.studDetail = el => openM('studDetail', {id:el.dataset.id});

/* Klausuren */
A.newExam = el => { const t = isTeacher(); const s = t ? null : me(); const sid = el?.dataset?.sid || (t ? (students()[0]?.id||'') : s.id);
  openM('exam', {studentId:sid, date:addDays(today(),14), fach:(byId('students',sid)?.faecher||[])[0]||'Mathe', themen:''}); };
A.examOpen = el => { const e = byId('exams', el.dataset.id); if(!e) return; openM('exam', {...e}); };
A.saveExam = async () => { const d = S.m.d;
  if(!d.studentId) return toast('Bitte einen Schüler auswählen.');
  if(!d.date) return toast('Bitte ein Datum wählen.');
  const id = d.id || uid(); const isNew = !d.id;
  const body = {studentId:d.studentId, date:d.date, fach:d.fach, themen:(d.themen||'').trim(), note:d.note||'', kommentar:(d.kommentar||'').trim(), createdBy:isTeacher()?'teacher':'student', createdAt:d.createdAt||Date.now()};
  if(!await save('exams', id, body)) return;
  const s = byId('students', d.studentId);
  if(isTeacher()){ if(isNew) await notify(d.studentId, d.fach+'-Klausur am '+fmt(d.date)+' eingetragen', 'kalender', 'exam'); }
  else if(isNew) await notify('teacher', s.name+' hat eine '+d.fach+'-Klausur am '+fmt(d.date)+' eingetragen'+(body.themen?' – '+short(body.themen,60):''), 'kalender', 'exam');
  else if(body.note && body.note!==byId('exams',id)?.note) await notify('teacher', s.name+' hat die Note '+body.note+' in '+d.fach+' eingetragen', 'kalender', 'exam');
  closeM(); toast(isNew?'Klausur eingetragen – viel Erfolg beim Üben!':'Gespeichert'); };
A.delExam = () => { const d = S.m.d; ask('Klausur löschen?', 'Die '+d.fach+'-Klausur am '+fmt(d.date)+' wird gelöscht.', async()=>{ if(await del('exams', d.id)) toast('Gelöscht'); }); };

/* Termine */
A.newTermin = el => openM('termin', {date:addDays(today(),1), time:'15:00', studentIds:preIds(el), fach:'Alle', note:'', weekly:false});
A.editTermin = el => { const x = byId('termine', el.dataset.id); openM('termin', {...x, studentIds:[...(x.studentIds||[])]}); };
A.saveTermin = async () => { const d = S.m.d;
  if(!d.studentIds.length) return toast('Bitte mindestens einen Schüler auswählen.');
  const isNew = !d.id; const n = isNew && d.weekly ? 4 : 1;
  for(let i=0;i<n;i++){ const id = i===0 && d.id ? d.id : uid();
    if(!await save('termine', id, {date:addDays(d.date,i*7), time:d.time||'', studentIds:d.studentIds, fach:d.fach, note:(d.note||'').trim(), createdAt:d.createdAt||Date.now()})) return; }
  if(isNew) await notifyMany(d.studentIds, 'Nachhilfe-Termin am '+fmt(d.date)+(d.time?' um '+d.time+' Uhr':'')+(n>1?' (wöchentlich)':''), 'kalender', 'termin');
  closeM(); toast(n>1?'4 Termine eingetragen':'Termin gespeichert'); };
A.delTermin = () => { const d = S.m.d; ask('Termin löschen?', 'Der Termin am '+fmt(d.date)+' wird gelöscht.', async()=>{ if(await del('termine', d.id)) toast('Gelöscht'); }); };

/* Kalender */
A.calNav = el => { const b = S.ui.calMonth ? parse(S.ui.calMonth) : new Date(new Date().getFullYear(), new Date().getMonth(), 1); b.setMonth(b.getMonth()+Number(el.dataset.n)); S.ui.calMonth = ymd(b); render(); };
A.calDay = el => { S.ui.calDay = el.dataset.d; render(); };
A.calEv = el => { const k = el.dataset.k, l = el.dataset.l;
  if(k==='exam') return A.examOpen(el);
  if(k==='termin' && isTeacher()) return A.editTermin(el);
  if(l && l!=='termin') location.hash = l; };

/* Lernwelt */
A.openCourse = el => { closeM(); if(S.route!=='lernen'){ S.pendingCourse = el.dataset.id; location.hash = 'lernen'; } else { S.ui.course = el.dataset.id; render(); window.scrollTo(0,0); } };
A.closeCourse = () => { S.ui.course = null; render(); };
A.locked = () => toast('Schaffe zuerst die Lektion davor (mindestens 1 Stern).');
A.play = el => startLesson(S.ui.course, Number(el.dataset.i));
A.pStart = () => { S.p.phase = 'q'; renderP(); };
A.pSel = el => { if(S.p.phase!=='q') return; S.p.sel = Number(el.dataset.i); renderP(); };
A.pCheck = () => checkAnswer();
A.pCont = () => pCont();
A.pRetry = () => startLesson(S.p.c.id, S.p.li);
A.pNext = () => startLesson(S.p.c.id, S.p.li+1);
A.pClose = () => { S.p = null; renderP(); render(); };
A.courseProgress = el => openM('courseProgress', {id:el.dataset.id});
const blankQ = () => ({type:'mc', q:'', options:['','','',''], answer:0, hint:''});
A.newCourse = () => openM('course', {title:'', desc:'', fach:'Mathe', klasse:'5', studentIds:[], lessons:[], edit:null});
A.editCourse = el => { const c = byId('courses', el.dataset.id); openM('course', {...JSON.parse(JSON.stringify(c)), studentIds:[...(c.studentIds||[])], edit:null}); };
A.addL = () => { S.m.d.lessons.push({id:uid(), title:'', intro:'', questions:[blankQ()]}); S.m.d.edit = S.m.d.lessons.length-1; renderM(); };
A.editL = el => { S.m.d.edit = Number(el.dataset.i); renderM(); };
A.rmL = el => { S.m.d.lessons.splice(Number(el.dataset.i),1); renderM(); };
A.mvL = el => { const i = Number(el.dataset.i), j = i+Number(el.dataset.n); const L = S.m.d.lessons; if(j<0||j>=L.length) return; [L[i],L[j]] = [L[j],L[i]]; renderM(); };
A.addQ = () => { S.m.d.lessons[S.m.d.edit].questions.push(blankQ()); renderM(); const qs = document.querySelectorAll('.qed'); qs[qs.length-1]?.scrollIntoView({behavior:'smooth'}); };
A.rmQ = el => { S.m.d.lessons[S.m.d.edit].questions.splice(Number(el.dataset.i),1); renderM(); };
A.lessonDone = () => { S.m.d.edit = null; renderM(); };
A.saveCourse = async () => { const d = S.m.d;
  if(!d.title.trim()) return toast('Bitte einen Titel eingeben.');
  const lessons = d.lessons.map(l=>({id:l.id, title:(l.title||'').trim()||'Lektion', intro:(l.intro||'').trim(), questions:l.questions.filter(q=>String(q.q||'').trim()).map(q=>({type:q.type||'mc', q:q.q.trim(), options:q.type==='input'?[]:(q.options||[]).map(o=>String(o||'').trim()), answer:q.type==='input'?String(q.answer||'').trim():Number(q.answer||0), hint:(q.hint||'').trim()}))}));
  const bad = lessons.flatMap(l=>l.questions).find(q=>q.type==='input' ? !q.answer : !(q.options[q.answer]||'').trim());
  if(bad) return toast('Bei „'+short(bad.q,30)+'“ fehlt die richtige Antwort.');
  const id = d.id || uid(); const isNew = !d.id;
  if(!await save('courses', id, {title:d.title.trim(), desc:(d.desc||'').trim(), fach:d.fach, klasse:d.klasse, studentIds:d.studentIds||[], lessons, createdAt:d.createdAt||Date.now()})) return;
  if(isNew){ const targets = students().filter(s=>d.studentIds?.length ? d.studentIds.includes(s.id) : (d.klasse==='alle'||d.klasse===s.klasse)).map(s=>s.id); await notifyMany(targets, 'Neuer Lernkurs: '+d.title.trim(), 'lernen', 'course'); }
  closeM(); toast('Kurs gespeichert'); };
A.delCourse = () => { const d = S.m.d; ask('Kurs löschen?', '„'+d.title+'“ wird mit allen Lektionen gelöscht.', async()=>{ if(await del('courses', d.id)){ S.ui.course = null; render(); toast('Gelöscht'); } }); };

document.addEventListener('click', ev => {
  if(S.navOpen && ev.target.closest('.side .nav a')){ S.navOpen = false; setTimeout(render,0); }
  const same = ev.target.closest('a[href^="#"]');
  if(same && same.getAttribute('href')===location.hash && !same.dataset.a){ S.ui.course = null; S.ui.fach = 'Alle'; render(); window.scrollTo(0,0); return; }
  const el = ev.target.closest('[data-a]'); if(!el) return;
  const a = el.dataset.a; if(a==='upload' || a==='studFilter') return;
  if(!A[a]) return;
  if(el.tagName==='BUTTON') ev.preventDefault();
  if(a==='closeM' && el.tagName==='A'){ closeM(); return; }
  A[a](el, ev);
});

boot();
}

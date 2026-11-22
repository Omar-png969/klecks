{
'use strict';
/* =====================================================================
   Klecks – Nachhilfe-Plattform (App-Oberfläche)
   Daten: Supabase über data.js (collection/doc), Rechte serverseitig (RLS)
   ===================================================================== */
const KD = window.KlecksData;
const COLS = ['msgs','settings','groups','students','entries','homework','hwstatus','courses','progress','exams','termine','notifs','notifread'];
const FACH = {
  Mathe:{c:'#2f6fed',cov:'#0d5468',g:'÷'},
  Deutsch:{c:'#e8553e',cov:'#8f3424',g:'Aa'},
  Englisch:{c:'#8b5cf6',cov:'#3b2f6b',g:'En'},
  Biologie:{c:'#16a36a',cov:'#1f5a3a',g:'Bio'},
  Sonstiges:{c:'#6b7280',cov:'#374151',g:'+'}
};
const FAECHER = ['Mathe','Deutsch','Englisch','Biologie'];
const realF = f => FAECHER.includes(f);
const COLORS = ['#2f6fed','#e8553e','#8b5cf6','#16a36a','#e84a8a','#f29e1f','#0ea5b7','#6b7280'];
const WD = ['So','Mo','Di','Mi','Do','Fr','Sa'];
const WDL = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
const MON = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

const S = {
  db:KD.db, isEditor:false, d:Object.fromEntries(COLS.map(c=>[c,[]])), ready:false, slow:false,
  session:null, route:'start',
  ui:{fach:'Alle', klasse:'alle', hwTab:'offen', stud:'alle', mappe:'alle', course:null, calMonth:null, calDay:null, startTab:'anstehend', q:'', exTab:'anstehend'},
  m:null, p:null
};

/* ---------- Helfer ---------- */
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
const fcov = f => (FACH[f]||FACH.Sonstiges).cov;
const initials = n => String(n||'?').trim().split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase();
const by = (k,dir=1) => (a,b) => (a[k]>b[k]?1:a[k]<b[k]?-1:0)*dir;
const sortStr = (a,b) => String(a.name||'').localeCompare(String(b.name||''),'de');
const short = (s,n=60) => { s = String(s||'').replace(/\s+/g,' ').trim(); return s.length>n ? s.slice(0,n-1)+'…' : s; };
const normUser = u => String(u||'').trim().toLowerCase().replace(/\s+/g,'.');
const strip = o => { const c = {...o}; delete c.id; return c; };
const WORDS = ['Sonne','Tiger','Wolke','Stern','Apfel','Delfin','Rakete','Mond','Blume','Pirat','Drache','Komet','Panda','Insel','Falke','Kiwi'];
const genPw = () => WORDS[Math.floor(Math.random()*WORDS.length)]+'-'+WORDS[Math.floor(Math.random()*WORDS.length)]+'-'+(10+Math.floor(Math.random()*90));
const pref = (k,v) => { try{ if(v===undefined) return localStorage.getItem('kl-'+k); if(v===null) localStorage.removeItem('kl-'+k); else localStorage.setItem('kl-'+k, v); }catch(e){ return null; } };
const isDark = () => { const t = document.documentElement.dataset.theme; return t ? t==='dark' : matchMedia('(prefers-color-scheme: dark)').matches; };
{ const t = pref('theme'); if(t==='dark'||t==='light') document.documentElement.dataset.theme = t; }

/* ---------- Linien-Symbole ---------- */
const I = {
  home:'<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  plus:'<path d="M12 5v14M5 12h14"/>', edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  trash:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', out:'<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
  bell:'<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>', check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x:'<path d="M6 6l12 12M18 6L6 18"/>', back:'<path d="M15 5l-7 7 7 7"/>', next:'<path d="M9 5l7 7-7 7"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>', sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon:'<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>', gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  msg:'<path d="M4 5h16v11H9l-5 4z"/>', clip:'<path d="M20 11l-8 8a5 5 0 0 1-7-7l8-8a3.5 3.5 0 0 1 5 5l-8 8a2 2 0 0 1-3-3l7-7"/>',
  lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>', task:'<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  cal:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>', users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.5a5 5 0 0 1 5.5 5"/>',
  exam:'<path d="M5 3h10l4 4v14H5z"/><path d="M9 12h6M9 16h6M9 8h3"/>', flame:'<path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-7 1.5 1 2.5 2 3 3 0-3 0-4 0-6z"/>',
  bolt:'<path d="M13 3L5 13h6l-1 8 8-10h-6z"/>', send:'<path d="M4 12l16-8-6 16-3-7z"/>', book:'<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z"/><path d="M20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z"/>',
  play:'<path d="M7 4l13 8-13 8z"/>', refresh:'<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>'
};
const ic = (n,cls='i') => '<svg class="'+cls+'" viewBox="0 0 24 24" aria-hidden="true">'+(I[n]||'')+'</svg>';
const star = on => '<svg viewBox="0 0 24 24" class="'+(on?'st-on':'st-off')+'" aria-hidden="true"><path stroke-width="1.4" stroke-linejoin="round" d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2 6.4 20.2l1.1-6.3L2.9 9.5l6.3-.9z"/></svg>';
const stars = (n,max=3) => '<span class="stars" aria-label="'+n+' von '+max+' Sternen">'+Array.from({length:max},(_,i)=>star(i<n)).join('')+'</span>';
const kl = k => (!k||k==='alle') ? 'alle Klassen' : 'Klasse '+esc(k);
const examName = e => !realF(e.fach) ? short(String(e.themen||'Klausur').split('\n')[0],34) : e.fach+'-Klausur';
const fchip = f => !realF(f) ? '' : fchip0(f);
const fchip0 = f => '<span class="chip f" style="background:'+fc(f)+'">'+esc(f)+'</span>';
const ava = (s,cls='') => '<span class="ava '+cls+'" style="background:'+esc(s?.color||'#6b7280')+'">'+esc(initials(s?.name))+'</span>';

/* ---------- 3D-App-Symbole ---------- */
appIcon.n = 0;
function appIcon(k){
  const g = (id,a,b) => '<linearGradient id="'+id+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+a+'"/><stop offset="1" stop-color="'+b+'"/></linearGradient>';
  const hi = '<ellipse cx="24" cy="11" rx="15" ry="5" fill="#fff" opacity=".22"/>';
  const s = {
    start:'<defs>'+g('gs','#9aa4b5','#5f6b80')+'</defs><path d="M8 22L24 9l16 13v16a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3z" fill="url(#gs)"/><rect x="19" y="27" width="10" height="14" rx="2" fill="#fff" opacity=".9"/>',
    kursmappe:'<defs>'+g('gk1','#6aa2ff','#2457d6')+g('gk2','#ffffff','#e6ecf7')+'</defs><path d="M6 12a3 3 0 0 1 3-3h10l4 4h16a3 3 0 0 1 3 3v21a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3z" fill="url(#gk1)"/><rect x="12" y="16" width="24" height="20" rx="2.5" fill="url(#gk2)"/><path d="M16 22h16M16 27h16M16 32h10" stroke="#2f6fed" stroke-width="2.4" stroke-linecap="round"/>'+hi,
    aufgaben:'<defs>'+g('ga','#4ade80','#16a34a')+'</defs><rect x="6" y="6" width="36" height="36" rx="10" fill="url(#ga)"/><circle cx="16" cy="18" r="5" fill="#fff"/><path d="M13.6 18.2l1.7 1.7 3.2-3.4" stroke="#16a34a" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><rect x="24" y="15.5" width="13" height="5" rx="2.5" fill="#fff" opacity=".95"/><rect x="11" y="27" width="26" height="5" rx="2.5" fill="#fff" opacity=".7"/><rect x="11" y="34" width="18" height="4" rx="2" fill="#fff" opacity=".5"/>',
    kurse:'<defs>'+g('gb1','#fb7185','#e11d48')+g('gb2','#fdba74','#f97316')+g('gb3','#f87171','#b91c1c')+'</defs><rect x="8" y="30" width="32" height="9" rx="3" fill="url(#gb3)"/><rect x="11" y="20" width="28" height="9" rx="3" fill="url(#gb2)"/><rect x="9" y="10" width="26" height="9" rx="3" fill="url(#gb1)"/><path d="M13 14.5h14M15 24.5h16M12 34.5h20" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".85"/><rect x="33" y="5" width="5" height="11" rx="1.5" fill="#1f2937"/>',
    kalender:'<defs>'+g('gc1','#ffffff','#eef0f4')+g('gc2','#ff6b6b','#e03131')+'</defs><rect x="7" y="9" width="34" height="32" rx="7" fill="url(#gc1)" stroke="#e5e7eb"/><path d="M7 16a7 7 0 0 1 7-7h20a7 7 0 0 1 7 7v2H7z" fill="url(#gc2)"/><text x="24" y="36" text-anchor="middle" font-family="Plus Jakarta Sans,Arial" font-weight="800" font-size="15" fill="#1f2937">'+new Date().getDate()+'</text>',
    klausuren:'<defs>'+g('gx','#a78bfa','#6d28d9')+'</defs><path d="M11 6h18l9 9v24a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3z" fill="url(#gx)"/><path d="M29 6v6a3 3 0 0 0 3 3h6" fill="#c4b5fd"/><text x="23" y="34" text-anchor="middle" font-family="Plus Jakarta Sans,Arial" font-weight="800" font-size="14" fill="#fff">A+</text>'+hi,
    nachrichten:'<defs>'+g('gm1','#60a5fa','#2563eb')+g('gm2','#e5e7eb','#cbd5e1')+'</defs><path d="M20 8h18a4 4 0 0 1 4 4v12a4 4 0 0 1-4 4h-2v5l-6-5H20a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4z" fill="url(#gm2)"/><path d="M8 16h20a4 4 0 0 1 4 4v12a4 4 0 0 1-4 4H16l-7 6v-6H8a4 4 0 0 1-4-4V20a4 4 0 0 1 4-4z" fill="url(#gm1)"/><circle cx="12" cy="26" r="2.2" fill="#fff"/><circle cx="18" cy="26" r="2.2" fill="#fff"/><circle cx="24" cy="26" r="2.2" fill="#fff"/>',
    dateien:'<defs>'+g('gd1','#fcd34d','#f59e0b')+g('gd2','#fdba74','#f97316')+'</defs><path d="M5 13a3 3 0 0 1 3-3h11l4 4h17a3 3 0 0 1 3 3v3H5z" fill="url(#gd1)"/><path d="M5 19h38v17a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z" fill="url(#gd2)"/><rect x="5" y="19" width="38" height="4" fill="#fff" opacity=".25"/>',
    fortschritt:'<defs>'+g('gf','#d9f99d','#84cc16')+'</defs><path d="M8 8v32h32" stroke="#4d7c0f" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M13 32l8-10 6 6 11-15" stroke="url(#gf)" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="38" cy="13" r="3.5" fill="#65a30d"/>',
    schueler:'<defs>'+g('gu','#93c5fd','#4f46e5')+'</defs><path d="M24 5l16 6v11c0 10-7 17-16 21C15 39 8 32 8 22V11z" fill="url(#gu)"/><circle cx="24" cy="19" r="5" fill="#fff"/><path d="M15 32c1.5-5 5-7 9-7s7.5 2 9 7" fill="#fff"/>'+hi,
    karteikarten:'<defs>'+g('gv1','#f9a8d4','#db2777')+g('gv2','#c4b5fd','#7c3aed')+'</defs><rect x="12" y="7" width="28" height="20" rx="4" fill="url(#gv2)" transform="rotate(8 26 17)"/><rect x="7" y="16" width="30" height="22" rx="4" fill="url(#gv1)"/><text x="22" y="32" text-anchor="middle" font-family="Plus Jakarta Sans,Arial" font-weight="800" font-size="12" fill="#fff">Aa</text>',
    einstellungen:'<defs>'+g('ge','#d1d5db','#6b7280')+'</defs><circle cx="24" cy="24" r="16" fill="url(#ge)"/><circle cx="24" cy="24" r="6" fill="#fff"/>'
  };
  const n = ++appIcon.n; const body = (s[k]||s.start).replace(/id="(\w+)"/g,'id="$1_'+n+'"').replace(/url\(#(\w+)\)/g,'url(#$1_'+n+')');
  return '<svg class="ai" viewBox="0 0 48 48" aria-hidden="true">'+body+'</svg>';
}
const logo = (sz=34) => '<svg viewBox="0 0 120 120" width="'+sz+'" height="'+sz+'" aria-hidden="true"><rect x="6" y="6" width="108" height="108" rx="30" fill="#8b5cf6"/><path d="M60 26c10 0 14 9 22 12s14 10 10 20 2 18-8 24-16 2-24 6-18-2-22-10-12-12-8-22 6-14 14-20 6-10 16-10z" fill="#ffd84d"/><circle cx="51" cy="58" r="5.5" fill="#22203a"/><circle cx="70" cy="58" r="5.5" fill="#22203a"/><path d="M50 72q10 9 20 0" fill="none" stroke="#22203a" stroke-width="6" stroke-linecap="round"/></svg>';

const APPS = [
  {id:'kursmappe', name:'Kursmappe', d:'Stunden, Inhalte, Material'},
  {id:'aufgaben', name:'Aufgaben', d:'Hausaufgaben & Abgaben'},
  {id:'kurse', name:'Kurse', d:'Lernen mit Arbeitsblättern'},
  {id:'kalender', name:'Kalender', d:'Termine & Fristen'},
  {id:'klausuren', name:'Klausuren', d:'Klausuren & Noten'},
  {id:'nachrichten', name:'Nachrichten', d:'Mitteilungen'},
  {id:'dateien', name:'Dateien', d:'Alle Arbeitsblätter'},
  {id:'fortschritt', name:'Fortschritt', d:'Sterne, Punkte, Level'},
  {id:'schueler', name:'Schüler', d:'Gruppen & Zugänge', teacher:true}
];
const appsFor = () => APPS.filter(a => !a.teacher || isTeacher());

function toast(msg){ const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(()=>t.classList.remove('show'),2600); }

/* ---------- Speichern ---------- */
const data = c => S.d[c];
const byId = (c,id) => S.d[c].find(x=>x.id===id);
async function save(c,id,body){ try{ await S.db.collection(c).doc(id).set(body); return true; }catch(e){ return fail(e); } }
async function del(c,id){ try{ await S.db.collection(c).doc(id).delete(); return true; }catch(e){ return fail(e); } }
function fail(e){ toast(e?.code==='invalid_argument' ? 'Dafür fehlt die Berechtigung.' : 'Speichern fehlgeschlagen. Bitte nochmal versuchen.'); return false; }

/* ---------- Benachrichtigungen ---------- */
async function notify(to, text, link, kind='info', extra){ if(!to) return; try{ await S.db.collection('notifs').doc(uid()).set({to, text, link:link||'start', kind, at:Date.now(), ...(extra||{})}); }catch(e){} }
async function notifyMany(ids, text, link, kind){ for(const id of ids) await notify(id, text, link, kind); }
const myKey = () => isTeacher() ? 'teacher' : S.session?.id;
const readAt = () => (byId('notifread', myKey())?.at) || 0;
const myNotifs = () => data('notifs').filter(n=>n.to===myKey()).sort(by('at',-1)).slice(0,80);
const unread = () => myNotifs().filter(n=>n.at>readAt()).length;
const unreadMsgs = () => myNotifs().filter(n=>n.kind==='msg' && n.at>readAt()).length;

/* ---------- Abfragen ---------- */
const students = () => data('students').slice().sort(sortStr);
const groups = () => data('groups').slice().sort(sortStr);
const groupOf = s => s?.groupId ? byId('groups', s.groupId) : null;
const me = () => S.session?.role==='student' ? byId('students', S.session.id) : null;
const isTeacher = () => S.session?.role==='teacher';
function grouped(){ const out = groups().map(g=>({g, list:students().filter(s=>s.groupId===g.id)})); const rest = students().filter(s=>!s.groupId || !byId('groups',s.groupId)); if(rest.length) out.push({g:null, list:rest}); return out; }
const hwFor = sid => data('homework').filter(h=>(h.studentIds||[]).includes(sid));
const stOf = (hid,sid) => byId('hwstatus', hid+'__'+sid);
const isDone = (hid,sid) => !!stOf(hid,sid)?.done;
const entriesFor = sid => data('entries').filter(e=>(e.studentIds||[]).includes(sid));
const examsFor = sid => data('exams').filter(e=>e.studentId===sid);
const termineFor = sid => data('termine').filter(x=>(x.studentIds||[]).includes(sid));
const coursesFor = s => data('courses').filter(c => !c.draft && (c.studentIds?.length ? c.studentIds.includes(s.id) : (!c.klasse || c.klasse==='alle' || c.klasse===s.klasse || (c.klassen||[]).includes(s.klasse))));
const prog = sid => byId('progress', sid) || {xp:0, stars:{}, weekXp:0, days:[]};
const level = xp => ({lv:Math.floor((xp||0)/100)+1, pct:((xp||0)%100)});
const lessonKey = (c,l) => c.id+'__'+l.id;
const courseStars = (c,p) => (c.lessons||[]).reduce((a,l)=>a+(p.stars?.[lessonKey(c,l)]||0),0);
const streak = p => { const set = new Set(p.days||[]); let d = today(), n = 0; if(!set.has(d)) d = addDays(d,-1); while(set.has(d)){ n++; d = addDays(d,-1); } return n; };
function hwStats(sid){ const hw = hwFor(sid); const done = hw.filter(h=>isDone(h.id,sid)).length; return {total:hw.length, done, open:hw.length-done}; }
function lastActive(sid){ const p = prog(sid); let t = p.lastActive || 0; data('hwstatus').forEach(x=>{ if(x.studentId===sid && x.at>t) t = x.at; }); return t; }
const names = ids => (ids||[]).map(id=>byId('students',id)?.name).filter(Boolean).join(', ') || '–';
const set = () => byId('settings','main') || {};
const entryFaecher = e => ((e.faecher && e.faecher.length) ? e.faecher : [e.fach]).filter(realF);
const hwIdsOf = e => e.hwIds || (e.hwId ? [e.hwId] : []);
function matchF(ids){ const f = S.ui.stud; if(f==='alle') return true; if(f.startsWith('g:')){ const g = f.slice(2); return (ids||[]).some(id=>byId('students',id)?.groupId===g); } return (ids||[]).includes(f); }
const myCourses = () => isTeacher() ? data('courses').slice() : coursesFor(me());

function reminders(){
  const out = [];
  if(!isTeacher()){
    const sid = S.session.id;
    hwFor(sid).forEach(h=>{ if(!isDone(h.id,sid)){ const n = diffDays(h.due); if(n<=1) out.push({kind:n<0?'bad':'warn', text:(n<0?'Überfällig: ':'Fällig '+rel(h.due)+': ')+short(h.text,50), link:'aufgaben'}); } });
    examsFor(sid).forEach(e=>{ const n = diffDays(e.date); if(n>=0 && n<=7) out.push({kind:n<=2?'bad':'warn', text:examName(e)+' '+rel(e.date), link:'klausuren'}); });
    termineFor(sid).forEach(x=>{ const n = diffDays(x.date); if(n>=0 && n<=1) out.push({kind:'info', text:'Nachhilfe '+rel(x.date)+(x.time?' um '+x.time+' Uhr':''), link:'kalender'}); });
  } else {
    data('exams').forEach(e=>{ const n = diffDays(e.date); const s = byId('students',e.studentId); if(s && n>=0 && n<=7) out.push({kind:n<=2?'bad':'warn', text:s.name+': '+examName(e)+' '+rel(e.date), link:'klausuren'}); });
    data('homework').forEach(h=>{ if(h.due===today()){ const open = h.studentIds.filter(id=>byId('students',id) && !isDone(h.id,id)).length; if(open) out.push({kind:'warn', text:'Heute fällig: '+open+' Hausaufgabe(n) offen', link:'aufgaben'}); } });
    data('termine').forEach(x=>{ const n = diffDays(x.date); if(n>=0 && n<=1) out.push({kind:'info', text:'Nachhilfe '+rel(x.date)+(x.time?' '+x.time:'')+' – '+names(x.studentIds), link:'kalender'}); });
  }
  return out;
}


/* ---------- Mitgelieferte Kurse ---------- */
const BUILTIN = window.KLECKS_KURSE || [];
function mergeBuiltin(){
  S.d.courses = S.d.courses.filter(c=>!c.local);
  const have = new Set(S.d.courses.map(c=>c.id)); const gone = new Set(set().removedKurse||[]);
  BUILTIN.forEach(b=>{ if(!have.has(b.id) && !gone.has(b.id)) S.d.courses.push({...b, local:true}); });
}
async function syncGroups(){
  for(const g of groups()){ const ids = students().filter(s=>s.groupId===g.id).map(s=>s.id).sort();
    if(JSON.stringify((g.memberIds||[]).slice().sort())!==JSON.stringify(ids)){ try{ await S.db.collection('groups').doc(g.id).set({...strip(g), memberIds:ids}); }catch(e){} } }
}
async function seedCourses(){
  if(!isTeacher() || seedCourses.done) return; seedCourses.done = true;
  const gone = new Set(set().removedKurse||[]);
  for(const b of BUILTIN){
    if(gone.has(b.id)) continue;
    const cur = S.d.courses.find(c=>c.id===b.id && !c.local);
    if(cur && (cur.edited || (cur.ver||0) >= b.ver)) continue;
    try{ await S.db.collection('courses').doc(b.id).set(strip(b)); }catch(e){ break; }
  }
}

/* ---------- Start & Daten ---------- */
const ALIAS = {unterricht:'kursmappe', hausaufgaben:'aufgaben', lernen:'kurse', dashboard:'start'};
const fixRoute = r => { if(ALIAS[r]){ history.replaceState(null,'','#'+ALIAS[r]); return ALIAS[r]; } return r; };
async function boot(){
  window.addEventListener('hashchange', () => { S.route = fixRoute(location.hash.slice(1) || 'start'); S.ui.course = S.pendingCourse || null; S.pendingCourse = null; S.ui.q=''; render(); window.scrollTo(0,0); });
  S.route = fixRoute(location.hash.slice(1) || 'start');
  let who = null; try{ who = await KD.whoami(); }catch(e){}
  if(who) await startData(who); else { S.ready = true; render(); }
}
function startData(who){
  return new Promise(resolve => {
    S.isEditor = who.role==='teacher';
    S.ready = false; S.d = Object.fromEntries(COLS.map(c=>[c,[]]));
    const pending = new Set(COLS);
    const done = () => { if(S.ready) return; S.ready = true; clearTimeout(timer); S.session = who.role==='teacher' ? {role:'teacher'} : {role:'student', id:who.uid}; if(who.role==='teacher'){ prune(); setTimeout(seedCourses, 1500); setTimeout(syncGroups, 2500); } render(); resolve(); };
    const timer = setTimeout(()=>{ S.slow = true; done(); }, 10000);
    $('#app').innerHTML = '<div class="boot">'+logo(64)+'<p>Klecks wird geladen …</p></div>';
    COLS.forEach(c => {
      S.db.collection(c).onSnapshot(snap => { S.d[c] = snap.docs.map(d => ({...d.data(), id:d.id})); if(c==='courses'||c==='settings') mergeBuiltin(); pending.delete(c); if(!pending.size){ S.slow = false; done(); } schedule(); },
        () => { pending.delete(c); if(!pending.size) done(); schedule(); });
    });
  });
}
async function logout(){ S.ui.chat = null; S.chat.draft = {}; S.chat.pend = {}; S.session = null; S.ready = true; S.lastLogin = null; closeM(); S.p = null; renderP(); await KD.signOut(); S.d = Object.fromEntries(COLS.map(c=>[c,[]])); render(); }
async function prune(){ const old = data('notifs').filter(n=>n.at < Date.now()-60*864e5).slice(0,30); for(const n of old){ try{ await S.db.collection('notifs').doc(n.id).delete(); }catch(e){ break; } } }
let rq = 0;
function schedule(){ if(rq) return; rq = requestAnimationFrame(()=>{ rq = 0; if(S.ready) render(); }); }

/* ---------- Login ---------- */
function loginView(){
  const prev = ['kursmappe','aufgaben','kurse','kalender','klausuren','fortschritt'].map(k=>'<div class="app"><div class="tile">'+appIcon(k)+'</div><span>'+esc(APPS.find(a=>a.id===k).name)+'</span></div>').join('');
  return '<div class="login"><div class="login-card"><div class="login-form"><div class="login-brand">'+logo(36)+'Klecks</div>'+
    '<h1>Willkommen zurück</h1><p class="muted">Melde dich mit deinem Benutzernamen und Passwort an.</p>'+
    '<form id="loginForm" class="auth" autocomplete="on">'+
    fld('Benutzername', '<input class="inp" id="lg-user" name="username" autocomplete="username" autocapitalize="off" placeholder="z. B. amira" required>')+
    fld('Passwort', '<div class="pw"><input class="inp" id="lg-pw" name="password" type="password" autocomplete="current-password" required><button type="button" class="btn ghost sm" data-a="pwShow">Zeigen</button></div>')+
    '<div class="auth-err" id="auth-err"></div><button class="btn primary" type="submit" id="lg-btn" style="min-height:48px">Anmelden</button>'+
    '<p class="muted small">Passwort vergessen? Sag deiner Lehrkraft Bescheid.</p></form></div>'+
    '<div class="login-side"><b>Alles für die Nachhilfe an einem Ort</b><div class="apps" style="margin:0">'+prev+'</div></div></div></div>';
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
  const who = await KD.whoami();
  if(!who){ await KD.signOut(); btn.disabled = false; btn.textContent = 'Anmelden'; return authErr('Dieser Zugang ist nicht freigeschaltet.'); }
  location.hash = 'start'; S.route = 'start';
  await startData(who);
}
document.addEventListener('submit', e => { e.preventDefault(); if(e.target.id==='loginForm') doLogin(); if(e.target.id==='msgForm') A.sendMsg(); });

/* ---------- Rahmen ---------- */
function badges(){
  const b = {};
  if(isTeacher()){
    b.klausuren = data('exams').filter(e=>byId('students',e.studentId) && diffDays(e.date)>=0 && diffDays(e.date)<=7).length;
    b.aufgaben = data('hwstatus').filter(x=>x.note && !x.feedback && byId('homework',x.hwId)).length;
  } else {
    const sid = S.session.id;
    b.aufgaben = hwFor(sid).filter(h=>!isDone(h.id,sid)).length;
    b.klausuren = examsFor(sid).filter(e=>diffDays(e.date)>=0 && diffDays(e.date)<=7).length;
  }
  b.nachrichten = unreadChats();
  return b;
}
function render(){
  const app = $('#app');
  if(!S.ready) return;
  if(!S.session){ if($('#app .login')) return; app.innerHTML = loginView(); $('#lg-user')?.focus(); return; }
  if(S.session.role==='student' && !me()){ logout(); return; }
  if(S.route!=='start' && !appsFor().some(a=>a.id===S.route)) S.route = 'start';
  const b = badges(); const nb = unread(), rem = reminders().length;
  const who = isTeacher() ? {name:set().teacherName||'Lehrkraft', color:'#2f6fed'} : me();
  const cur = APPS.find(a=>a.id===S.route);
  const rail = '<a href="#start" class="'+(S.route==='start'?'on':'')+'">'+appIcon('start')+'Start</a>'+appsFor().map(a=>'<a href="#'+a.id+'" class="'+(S.route===a.id?'on':'')+'">'+appIcon(a.id)+esc(a.name)+(b[a.id]?'<span class="rb">'+b[a.id]+'</span>':'')+'</a>').join('');
  const mnav = '<a href="#start" class="'+(S.route==='start'?'on':'')+'">'+appIcon('start')+'Start</a>'+appsFor().map(a=>'<a href="#'+a.id+'" class="'+(S.route===a.id?'on':'')+'">'+appIcon(a.id)+esc(a.name)+(b[a.id]?' <span class="chip bad" style="padding:0 6px">'+b[a.id]+'</span>':'')+'</a>').join('');
  const activeSearch = document.activeElement?.id==='q';
  S.chat.focus = document.activeElement?.id==='chat-in';
  app.innerHTML =
    '<div class="shell"><nav class="rail" aria-label="Apps"><a class="rail-logo" href="#start" aria-label="Start" style="padding:0;width:auto">'+logo(36)+'</a>'+rail+
      '<div class="rail-foot"><button class="btn flat icon" data-a="settings" aria-label="Einstellungen">'+ic('gear')+'</button><button class="btn flat icon" data-a="logout" aria-label="Abmelden">'+ic('out')+'</button></div></nav>'+
    '<div><header class="topbar"><div class="crumb">'+(cur?appIcon(cur.id)+esc(cur.name):logo(26)+'Klecks')+'</div>'+
      '<div class="search">'+ic('search')+'<input id="q" placeholder="In Klecks suchen" value="'+esc(S.ui.q)+'" autocomplete="off" aria-label="Suchen">'+searchResults()+'</div>'+
      '<div class="tb-right"><button class="btn flat icon" data-a="theme" aria-label="'+(isDark()?'Heller Modus':'Dunkler Modus')+'">'+ic(isDark()?'sun':'moon')+'</button>'+
      '<button class="btn flat icon ib" data-a="notifs" aria-label="Benachrichtigungen">'+ic('bell')+(nb?'<span class="dotn">'+nb+'</span>':(rem?'<span class="dotw"></span>':''))+'</button>'+
      '<button class="btn flat icon" data-a="menu" aria-label="Konto" style="padding:0">'+ava(who,'sm')+'</button></div><nav class="mobile-nav" aria-label="Apps">'+mnav+'</nav></header>'+
      '<main class="main">'+(S.slow?'<div class="chip warn" style="margin-bottom:12px">Verbindung langsam – Daten evtl. nicht aktuell</div>':'')+view()+'</main></div></div>';
  if(activeSearch){ const q = $('#q'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
  afterChatRender();
}
function view(){
  switch(S.route){
    case 'kursmappe': return vKursmappe();
    case 'aufgaben': return vAufgaben();
    case 'kurse': return S.ui.course ? vCourse() : vKurse();
    case 'kalender': return vKalender();
    case 'klausuren': return vKlausuren();
    case 'nachrichten': return vNachrichten();
    case 'dateien': return vDateien();
    case 'fortschritt': return vFortschritt();
    case 'schueler': return vSchueler();
    default: return vStart();
  }
}
const pageHead = (id, title, sub, actions='') => '<div class="page-h">'+appIcon(id)+'<div class="ttl"><h1>'+title+'</h1>'+(sub?'<p>'+sub+'</p>':'')+'</div><span class="sp"></span><div class="row">'+actions+'</div></div>';
const empty = (t,s,extra='') => '<div class="empty"><b>'+esc(t)+'</b>'+esc(s)+extra+'</div>';
const kpi = (v,l) => '<div class="kpi"><b>'+esc(v)+'</b><span>'+esc(l)+'</span></div>';
const gruss = () => { const h = new Date().getHours(); return h<11?'Guten Morgen':h<18?'Guten Tag':'Guten Abend'; };

/* ---------- Suche ---------- */
function searchResults(){
  const q = S.ui.q.trim().toLowerCase(); if(q.length<2) return '';
  const hits = [];
  myCourses().forEach(c=>{ if((c.title+' '+(c.desc||'')+' '+(c.lessons||[]).map(l=>l.title).join(' ')).toLowerCase().includes(q)) hits.push({ic:'kurse', t:c.title, s:'Kurs · '+c.fach, a:'openCourse', id:c.id}); });
  (isTeacher()?data('entries'):entriesFor(S.session.id)).forEach(e=>{ if((e.thema+' '+(e.inhalt||'')).toLowerCase().includes(q)) hits.push({ic:'kursmappe', t:e.thema, s:'Stunde · '+fmt(e.date), href:'kursmappe'}); });
  (isTeacher()?data('homework'):hwFor(S.session.id)).forEach(h=>{ if(h.text.toLowerCase().includes(q)) hits.push({ic:'aufgaben', t:short(h.text,60), s:'Hausaufgabe · bis '+fmt(h.due), href:'aufgaben'}); });
  if(isTeacher()) students().forEach(s=>{ if(s.name.toLowerCase().includes(q)) hits.push({ic:'schueler', t:s.name, s:'Schüler · Klasse '+s.klasse, a:'studDetail', id:s.id}); });
  const body = hits.length ? hits.slice(0,12).map(h=>h.href?'<a class="li" href="#'+h.href+'" data-a="clearQ">'+appIcon(h.ic)+'<div class="grow"><b>'+esc(h.t)+'</b><span class="tiny muted">'+esc(h.s)+'</span></div></a>':'<div class="li" style="cursor:pointer" data-a="'+h.a+'" data-id="'+esc(h.id)+'">'+appIcon(h.ic)+'<div class="grow"><b>'+esc(h.t)+'</b><span class="tiny muted">'+esc(h.s)+'</span></div></div>').join('') : '<div class="muted small" style="padding:10px">Nichts gefunden.</div>';
  return '<div class="sres">'+body+'</div>';
}

/* =====================================================================
   START (Launcher)
   ===================================================================== */
function vStart(){
  const t = isTeacher(); const b = badges();
  const who = t ? (set().teacherName||'') : me().name.split(' ')[0];
  let sub;
  if(t){ const ex = data('exams').filter(e=>byId('students',e.studentId) && diffDays(e.date)>=0 && diffDays(e.date)<=7).length; const nt = data('termine').filter(x=>diffDays(x.date)>=0).sort(by('date'))[0]; sub = (nt?'Nächste Nachhilfe: '+fmt(nt.date)+(nt.time?' um '+nt.time+' Uhr':'')+'. ':'')+(ex?ex+' Klausur'+(ex>1?'en':'')+' in den nächsten 7 Tagen.':''); }
  else { const sid = S.session.id; const o = hwFor(sid).filter(h=>!isDone(h.id,sid)).length; const ex = examsFor(sid).filter(e=>diffDays(e.date)>=0).sort(by('date'))[0]; sub = (o?'Du hast '+o+' offene Hausaufgabe'+(o>1?'n':'')+'. ':'Alle Hausaufgaben erledigt. ')+(ex?'Nächste Klausur '+rel(ex.date)+'.':''); }
  const apps = appsFor().map(a=>'<a class="app" href="#'+a.id+'"><span class="tile">'+appIcon(a.id)+'</span>'+esc(a.name)+(b[a.id]?'<span class="cnt">'+b[a.id]+'</span>':'')+'</a>').join('');
  const paper = (col, wide) => '<span class="paper'+(wide?' wide':'')+'"><span class="bar" style="background:'+col+'"></span><i style="top:24px"></i><i style="top:32px"></i><i style="top:40px;right:22px"></i>'+(wide?'':'<i style="top:48px"></i><i style="top:56px;right:26px"></i>')+'</span>';
  const create = t ? [
      ['newEntry','Stunde eintragen','Kursmappe, Material, HA','#2f6fed'],
      ['newHw','Hausaufgabe','für Gruppe oder einzeln','#16a34a'],
      ['newTermin','Nachhilfe-Termin','auch wöchentlich','#e03131',1],
      ['newExam','Klausur eintragen','mit Themen','#7c3aed'],
      ['newCourse','Kurs erstellen','Arbeitsblätter & Test','#f97316'],
      ['newStud','Schüler anlegen','mit Zugangsdaten','#4f46e5',1]
    ] : [
      ['newExam','Klausur eintragen','damit wir üben können','#7c3aed'],
      ['newMsg','Nachricht schreiben','an '+(set().teacherName||'deine Lehrkraft'),'#2563eb',1],
      ['goKurse','Weiterlernen','Kurse & Arbeitsblätter','#f97316']
    ];
  return '<section class="hello"><h1>'+gruss()+(who?', '+esc(who):'')+'</h1>'+(sub?'<p>'+esc(sub)+'</p>':'')+'</section>'+
    '<div class="apps">'+apps+'</div>'+
    '<div class="sec-h"><h2>Neu erstellen</h2></div><div class="create">'+create.map(c=>'<button class="cr" data-a="'+c[0]+'"><span class="thumb">'+paper(c[3],c[4])+'</span><b>'+esc(c[1])+'</b><span>'+esc(c[2])+'</span></button>').join('')+'</div>'+
    '<div class="sec-h"><div class="tabs"><button class="'+(S.ui.startTab==='anstehend'?'on':'')+'" data-a="startTab" data-t="anstehend">Anstehend</button><button class="'+(S.ui.startTab==='zuletzt'?'on':'')+'" data-a="startTab" data-t="zuletzt">Zuletzt</button>'+(t?'<button class="'+(S.ui.startTab==='gruppen'?'on':'')+'" data-a="startTab" data-t="gruppen">Gruppen</button>':'<button class="'+(S.ui.startTab==='lernen'?'on':'')+'" data-a="startTab" data-t="lernen">Weiterlernen</button>')+'</div></div>'+
    '<div class="card">'+startTabBody()+'</div>';
}
function startTabBody(){
  const t = isTeacher(); const tab = S.ui.startTab;
  if(tab==='gruppen' && t) return groupOverview();
  if(tab==='lernen' && !t) return continueList();
  if(tab==='zuletzt'){
    const ents = (t?data('entries'):entriesFor(S.session.id)).slice().sort(by('date',-1)).slice(0,5);
    const news = myNotifs().slice(0,5);
    return '<div class="grid2"><div><h3 style="margin-bottom:6px">Letzte Stunden</h3>'+(ents.length?'<div class="list">'+ents.map(e=>'<a class="li" href="#kursmappe">'+dbox(e.date, fc(entryFaecher(e)[0]))+'<div class="grow"><b>'+esc(e.thema)+'</b><span class="tiny muted">'+entryFaecher(e).join(', ')+(t?' · '+esc(names(e.studentIds)):'')+'</span></div></a>').join('')+'</div>':empty('Noch keine Stunden','Hier erscheinen die letzten Einträge.'))+'</div>'+
      '<div><h3 style="margin-bottom:6px">Neuigkeiten</h3>'+(news.length?'<div class="list">'+news.map(n=>'<a class="li" href="#'+esc(n.link||'start')+'">'+ic(n.kind==='msg'?'msg':'bell')+'<div class="grow"><b style="font-weight:600">'+esc(n.text)+'</b><span class="tiny muted">'+ago(n.at)+'</span></div></a>').join('')+'</div>':empty('Noch ruhig hier','Neuigkeiten erscheinen automatisch.'))+'</div></div>';
  }
  const ev = events().filter(e=>e.kind!=='stunde' && diffDays(e.date)>=0 && diffDays(e.date)<=21 && !e.done).sort(by('date')).slice(0,8);
  const rem = reminders();
  return (rem.length?'<div class="row" style="margin-bottom:12px">'+rem.slice(0,4).map(r=>'<a href="#'+r.link+'" class="chip '+(r.kind==='bad'?'bad':r.kind==='warn'?'warn':'acc')+'" style="text-decoration:none;padding:5px 11px">'+esc(r.text)+'</a>').join('')+'</div>':'')+
    (ev.length?'<div class="list">'+ev.map(evLi).join('')+'</div>':empty('Nichts geplant in den nächsten 3 Wochen','Termine, Abgaben und Klausuren erscheinen hier.'));
}
function groupOverview(){
  const gs = grouped(); if(!gs.length) return empty('Noch keine Schüler','Lege unter „Schüler“ deine erste Gruppe an.');
  return '<div class="stack">'+gs.map(({g,list})=>'<div><div class="row" style="margin-bottom:6px"><span class="grp-dot" style="background:'+esc(g?.color||'#6b7280')+'"></span><h3>'+esc(g?g.name:'Ohne Gruppe')+'</h3><span class="tiny muted">'+list.length+' Schüler</span></div><div class="list">'+list.map(s=>{
    const h = hwStats(s.id), ex = examsFor(s.id).filter(e=>diffDays(e.date)>=0).sort(by('date'))[0], p = prog(s.id), la = lastActive(s.id);
    return '<div class="li" data-a="studDetail" data-id="'+esc(s.id)+'" style="cursor:pointer">'+ava(s,'sm')+'<div class="grow"><b>'+esc(s.name)+'</b><span class="tiny muted">Klasse '+esc(s.klasse)+' · Level '+level(p.xp).lv+(la?' · aktiv '+ago(la):'')+'</span></div><div class="row" style="gap:6px">'+(h.open?'<span class="chip warn">'+h.open+' offen</span>':'<span class="chip ok">alles erledigt</span>')+(ex?'<span class="chip '+(diffDays(ex.date)<=7?'bad':'')+'">'+ic('exam')+'Klausur '+rel(ex.date)+'</span>':'')+'</div></div>';
  }).join('')+'</div></div>').join('')+'</div>';
}
function continueList(){
  const s = me(), p = prog(s.id);
  const cs = coursesFor(s).map(c=>({c, got:courseStars(c,p), max:(c.lessons||[]).length*3})).filter(x=>x.max && x.got<x.max).sort((a,b)=>b.got-a.got).slice(0,6);
  if(!cs.length) return empty('Alles geschafft!','Neue Kurse erscheinen hier.');
  return '<div class="list">'+cs.map(x=>'<div class="li" data-a="openCourse" data-id="'+esc(x.c.id)+'" style="cursor:pointer"><span class="dbox" style="background:'+fcov(x.c.fach)+'"><b style="font-size:14px">'+esc(fg(x.c.fach))+'</b></span><div class="grow"><b>'+esc(x.c.title)+'</b><div class="bar sun" style="margin-top:6px;max-width:260px"><i style="width:'+(x.got/x.max*100)+'%"></i></div></div><span class="tiny muted nowrap">'+x.got+'/'+x.max+' Sterne</span></div>').join('')+'</div>';
}
const dbox = (date,col) => { const d = parse(date); return '<span class="dbox" style="background:'+col+'"><b>'+d.getDate()+'</b><span>'+WD[d.getDay()]+'</span></span>'; };

/* =====================================================================
   KURSMAPPE (wie „Mein Unterricht“)
   ===================================================================== */
function vKursmappe(){
  const t = isTeacher();
  let list = (t ? data('entries') : entriesFor(S.session.id)).slice();
  const mappen = [];
  if(t){ mappen.push({k:'alle', n:'Alle Stunden', c:'#18181b', g:'∑', cnt:list.length}); grouped().forEach(({g,list:ls})=>{ if(g) mappen.push({k:'g:'+g.id, n:g.name, c:g.color, g:initials(g.name), cnt:data('entries').filter(e=>(e.studentIds||[]).some(id=>ls.some(s=>s.id===id))).length}); else ls.forEach(s=>mappen.push({k:s.id, n:s.name, c:s.color, g:initials(s.name), cnt:entriesFor(s.id).length})); }); }
  else { mappen.push({k:'alle', n:'Alle Fächer', c:'#18181b', g:'∑', cnt:list.length}); FAECHER.forEach(f=>{ const n = list.filter(e=>entryFaecher(e).includes(f)).length; if(n) mappen.push({k:'f:'+f, n:f, c:fc(f), g:fg(f), cnt:n}); }); }
  const k = S.ui.mappe;
  if(k.startsWith('g:')){ const g = k.slice(2); list = list.filter(e=>(e.studentIds||[]).some(id=>byId('students',id)?.groupId===g)); }
  else if(k.startsWith('f:')) list = list.filter(e=>entryFaecher(e).includes(k.slice(2)));
  else if(k!=='alle') list = list.filter(e=>(e.studentIds||[]).includes(k));
  list.sort((a,b)=>(b.date||'').localeCompare(a.date||'') || (b.createdAt||0)-(a.createdAt||0));
  let lastM = '';
  const items = list.map(e=>{ const d = parse(e.date); const m = MON[d.getMonth()]+' '+d.getFullYear(); const head = m!==lastM ? '<div class="tl-month">'+m+'</div>' : ''; lastM = m; return head+entryCard(e); }).join('');
  return pageHead('kursmappe','Kursmappe', t?'Jede Stunde mit Inhalten, Material, Hausaufgabe und Anwesenheit – wie im Schulportal.':'Hier siehst du, was wir in jeder Stunde gemacht haben, mit allen Arbeitsblättern.', t?'<button class="btn primary" data-a="newEntry">'+ic('plus')+'Stunde eintragen</button>':'')+
    '<div class="km"><div class="km-side">'+mappen.map(x=>'<button class="'+(k===x.k?'on':'')+'" data-a="mappe" data-k="'+esc(x.k)+'"><span class="sw" style="background:'+esc(x.c)+'">'+esc(x.g)+'</span><span class="grow" style="flex:1">'+esc(x.n)+'</span><span class="tiny muted">'+x.cnt+'</span></button>').join('')+'</div>'+
    '<div class="tl">'+(items || empty('Noch keine Stunden', t?'Trag nach jeder Stunde ein, was ihr gemacht habt.':'Sobald eine Stunde eingetragen ist, siehst du sie hier.'))+'</div></div>';
}
function entryCard(e){
  const t = isTeacher(), sid = t ? null : S.session.id; const d = parse(e.date);
  const hws = hwIdsOf(e).map(id=>byId('homework',id)).filter(h=>h && (t || h.studentIds.includes(sid)));
  const lines = String(e.inhalt||'').split(/\n+/).map(l=>l.replace(/^[-•*]\s*/,'').trim()).filter(Boolean);
  const hwBox = hws.map(hw=>{ const ids = hw.studentIds.filter(id=>byId('students',id)); const dn = ids.filter(id=>isDone(hw.id,id)).length;
    return '<div class="e-sec ehw"><b>'+ic('task')+(t?(hws.length>1?esc(names(ids))+' · ':'')+'Hausaufgabe bis '+fmt(hw.due)+' · '+dn+'/'+ids.length+' erledigt':'Hausaufgabe bis '+fmt(hw.due)+(isDone(hw.id,sid)?' · erledigt':''))+'</b><span style="white-space:pre-wrap">'+esc(hw.text)+'</span></div>'; }).join('');
  const att = e.attendance || {};
  const attBox = t && Object.keys(att).length ? '<div class="e-sec eatt"><b class="tiny muted">Anwesenheit</b><div class="att-row">'+(e.studentIds||[]).map(id=>{ const s = byId('students',id); if(!s) return ''; const v = att[id]||'da'; const col = v==='da'?'var(--ok)':v==='entschuldigt'?'var(--warn)':'var(--bad)'; return '<span class="att">'+ava(s,'xs')+esc(s.name)+' <i style="background:'+col+'"></i>'+(v==='da'?'anwesend':v)+'</span>'; }).join('')+'</div></div>' : '';
  return '<article class="entry"><div class="e-date"><b>'+d.getDate()+'</b><span>'+WD[d.getDay()]+', '+MON[d.getMonth()].slice(0,3)+'</span></div><div class="e-body">'+
    '<div class="e-top">'+entryFaecher(e).map(fchip).join('')+(t?'<span class="tiny muted">'+esc(names(e.studentIds))+'</span><span class="sp"></span><button class="btn flat sm icon" data-a="editEntry" data-id="'+esc(e.id)+'" aria-label="Bearbeiten">'+ic('edit')+'</button>':'')+'</div>'+
    '<h3>'+esc(e.thema)+'</h3>'+(lines.length?'<div class="e-inhalt">'+lines.map(l=>'<div>'+esc(l)+'</div>').join('')+'</div>':'')+
    filesHtml(e.files)+hwBox+attBox+'</div></article>';
}
const ftype = f => { const n = String(f.name||'').toLowerCase(); if(/\.pdf$/.test(n)||/pdf/.test(f.type||'')) return ['PDF','#e03131']; if(/image|\.png|\.jpe?g|\.heic|\.webp/.test(n+(f.type||''))) return ['BILD','#2f6fed']; if(/\.docx?$/.test(n)) return ['DOC','#2563eb']; return ['DATEI','#6b7280']; };
const filesHtml = fs => (fs&&fs.length) ? '<div class="files">'+fs.map(f=>{ const [t,c] = ftype(f); return '<a class="file" href="#" data-a="openFile" data-p="'+esc(f.path||'')+'"><span class="ft" style="background:'+c+'">'+t+'</span><span>'+esc(f.name)+'</span></a>'; }).join('')+'</div>' : '';

/* =====================================================================
   AUFGABEN
   ===================================================================== */
function vAufgaben(){
  if(!isTeacher()){
    const sid = S.session.id; const all = hwFor(sid);
    let list = all.filter(h=>S.ui.hwTab==='offen' ? !isDone(h.id,sid) : isDone(h.id,sid));
    list.sort(S.ui.hwTab==='offen' ? by('due') : by('due',-1));
    const o = all.filter(h=>!isDone(h.id,sid)).length;
    return pageHead('aufgaben','Aufgaben','Hake ab, was du erledigt hast. Bei Fragen schreib eine Notiz.')+
      '<div class="filters"><div class="seg2"><button class="'+(S.ui.hwTab==='offen'?'on':'')+'" data-a="hwTab" data-t="offen">Offen ('+o+')</button><button class="'+(S.ui.hwTab==='erledigt'?'on':'')+'" data-a="hwTab" data-t="erledigt">Erledigt ('+(all.length-o)+')</button></div></div>'+
      (list.length?list.map(h=>hwCard(h,sid)).join(''):empty(S.ui.hwTab==='offen'?'Keine offenen Hausaufgaben':'Noch nichts erledigt', S.ui.hwTab==='offen'?'Super, du bist auf dem neuesten Stand!':'Erledigte Aufgaben landen hier.'));
  }
  let list = data('homework').filter(h=>matchF(h.studentIds));
  const isOpen = h => h.studentIds.some(id=>byId('students',id) && !isDone(h.id,id));
  list = list.filter(h => S.ui.hwTab==='offen' ? isOpen(h) : !isOpen(h)).sort(S.ui.hwTab==='offen' ? by('due') : by('due',-1));
  return pageHead('aufgaben','Aufgaben','Sieh auf einen Blick, wer fertig ist. Tippe auf einen Namen für Status oder Rückmeldung.','<button class="btn primary" data-a="newHw">'+ic('plus')+'Hausaufgabe</button>')+
    '<div class="filters"><div class="seg2"><button class="'+(S.ui.hwTab==='offen'?'on':'')+'" data-a="hwTab" data-t="offen">Laufend</button><button class="'+(S.ui.hwTab==='erledigt'?'on':'')+'" data-a="hwTab" data-t="erledigt">Abgeschlossen</button></div>'+filterSel()+'</div>'+
    (list.length?list.map(h=>{ const ids = h.studentIds.filter(id=>byId('students',id)); const dn = ids.filter(id=>isDone(h.id,id)).length; const n = diffDays(h.due);
      return '<div class="hw" style="grid-template-columns:minmax(0,1fr) auto"><div><div class="row" style="margin-bottom:6px;gap:6px">'+fchip(h.fach)+'<span class="chip '+(n<0&&dn<ids.length?'bad':n<=1?'warn':'')+'">bis '+rel(h.due)+'</span><span class="chip ok">'+dn+'/'+ids.length+' erledigt</span></div>'+
        '<div class="hw-t">'+esc(h.text)+'</div>'+filesHtml(h.files)+
        '<div class="who-row">'+ids.map(id=>{ const s = byId('students',id), st = stOf(h.id,id); return '<button class="who-st '+(st?.done?'done':'')+'" data-a="hwStudent" data-h="'+esc(h.id)+'" data-s="'+esc(id)+'">'+ava(s,'xs')+esc(s.name)+(st?.done?' ✓':'')+(st?.note?' '+ic('msg'):'')+'</button>'; }).join('')+'</div></div>'+
        '<div class="hw-r"><button class="btn flat icon" data-a="editHw" data-id="'+esc(h.id)+'" aria-label="Bearbeiten">'+ic('edit')+'</button></div></div>'; }).join('')
    :empty(S.ui.hwTab==='offen'?'Keine laufenden Hausaufgaben':'Noch keine abgeschlossenen Hausaufgaben','Neue Hausaufgaben vergibst du hier oder beim Eintragen einer Stunde.'));
}
function hwCard(h,sid){
  const st = stOf(h.id,sid); const done = !!st?.done; const n = diffDays(h.due);
  const due = done ? '<span class="chip ok">erledigt</span>' : '<span class="chip '+(n<0?'bad':n<=1?'warn':'')+'">'+(n<0?'überfällig · ':'')+'bis '+rel(h.due)+'</span>';
  return '<div class="hw '+(done?'done':'')+'"><button class="check '+(done?'on':'')+'" data-a="toggleHw" data-id="'+esc(h.id)+'" aria-label="'+(done?'Als offen markieren':'Als erledigt markieren')+'">'+ic('check')+'</button>'+
    '<div><div class="row" style="margin-bottom:6px;gap:6px">'+fchip(h.fach)+due+'</div><div class="hw-t">'+esc(h.text)+'</div>'+filesHtml(h.files)+(st?.note?'<div class="note">Deine Notiz: '+esc(st.note)+'</div>':'')+(st?.feedback?'<div class="fb"><b>Rückmeldung:</b> '+esc(st.feedback)+'</div>':'')+'</div>'+
    '<div class="hw-r"><button class="btn ghost sm" data-a="hwNote" data-id="'+esc(h.id)+'">'+ic('msg')+'Frage</button></div></div>';
}
function filterSel(){
  if(!students().length) return '';
  return '<select class="inp fsel" data-a="studFilter" aria-label="Filtern"><option value="alle">Alle Schüler</option>'+
    (groups().length?'<optgroup label="Gruppen">'+groups().map(g=>'<option value="g:'+esc(g.id)+'" '+(S.ui.stud==='g:'+g.id?'selected':'')+'>'+esc(g.name)+'</option>').join('')+'</optgroup>':'')+
    '<optgroup label="Schüler">'+students().map(s=>'<option value="'+esc(s.id)+'" '+(S.ui.stud===s.id?'selected':'')+'>'+esc(s.name)+'</option>').join('')+'</optgroup></select>';
}

/* =====================================================================
   KURSE (Deckblätter)
   ===================================================================== */
const pts = q => q.type==='gap' ? gapParts(q.text).filter(x=>x.ans).length : q.type==='tf' ? (q.items||[]).length : q.type==='sort' ? (q.items||[]).length : q.type==='cards' ? 0 : 1;
const lessonMax = l => (l.questions||[]).reduce((a,q)=>a+pts(q),0);
function cover(c, big){
  const p = isTeacher() ? null : prog(S.session.id);
  const max = (c.lessons||[]).length*3, got = p ? courseStars(c,p) : 0;
  return '<div class="cov-art"><span class="pg b"></span><span class="pg"></span><div class="cov-face" style="--cc:'+(c.cover||fcov(c.fach))+'"><small>'+esc(c.fach)+' · '+kl(c.klasse)+'</small><h3>'+esc(c.title)+'</h3><span class="big">'+esc(fg(c.fach))+'</span><div class="cg"><span>'+(c.lessons||[]).length+' Blätter</span>'+(p?'<span>'+got+'/'+max+' ★</span>':(c.draft?'<span>Entwurf</span>':''))+'</div></div></div>';
}
function vKurse(){
  const t = isTeacher();
  let cs = myCourses();
  if(S.ui.fach!=='Alle') cs = cs.filter(c=>c.fach===S.ui.fach);
  if(S.ui.klasse!=='alle') cs = cs.filter(c=>c.klasse===S.ui.klasse || c.klasse==='alle' || (c.klassen||[]).includes(S.ui.klasse));
  cs.sort((a,b)=>(a.order||999)-(b.order||999) || (a.fach||'').localeCompare(b.fach||'') || (a.title||'').localeCompare(b.title||''));
  const p = t ? null : prog(S.session.id);
  const prep = !t ? examsFor(S.session.id).filter(e=>diffDays(e.date)>=0 && diffDays(e.date)<=14).sort(by('date'))[0] : null;
  const fs = ['Alle', ...FAECHER.filter(f=>myCourses().some(c=>c.fach===f))];
  const ks = ['alle','5','6'];
  return pageHead('kurse','Kurse', t?'Jeder Kurs ist ein Heft aus Arbeitsblättern: Merkkasten, Übungen vom Leichten zum Schweren und ein Test zum Schluss.':'Wähle einen Kurs und arbeite die Blätter der Reihe nach durch. Für jedes Blatt gibt es bis zu 3 Sterne.', t?'<button class="btn primary" data-a="newCourse">'+ic('plus')+'Kurs erstellen</button>':'<span class="chip acc">'+ic('bolt')+(p.xp||0)+' Punkte · Level '+level(p.xp).lv+'</span>')+
    (prep?'<div class="card" style="margin-bottom:16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap">'+appIcon('klausuren')+'<div class="grow" style="flex:1"><b>'+esc(examName(prep))+' '+rel(prep.date)+'</b><div class="tiny muted">Übe jetzt mit den passenden Kursen.</div></div>'+(realF(prep.fach)?'<button class="btn ghost sm" data-a="fach" data-f="'+esc(prep.fach)+'">Kurse zeigen</button>':'')+'</div>':'')+
    '<div class="filters"><div class="seg2">'+fs.map(f=>'<button class="'+(S.ui.fach===f?'on':'')+'" data-a="fach" data-f="'+f+'">'+f+'</button>').join('')+'</div><div class="seg2">'+ks.map(k=>'<button class="'+(S.ui.klasse===k?'on':'')+'" data-a="klasse" data-k="'+k+'">'+(k==='alle'?'Alle Klassen':'Klasse '+k)+'</button>').join('')+'</div></div>'+
    (cs.length?'<div class="covers">'+cs.map(c=>{ const max = (c.lessons||[]).length*3, got = p?courseStars(c,p):0;
      return '<button class="cov" data-a="openCourse" data-id="'+esc(c.id)+'">'+cover(c)+'<div class="cov-meta"><b>'+esc(c.title)+'</b><span class="tiny muted">'+esc(short(c.desc||'',70))+'</span>'+(p?'<div class="bar sun"><i style="width:'+(max?got/max*100:0)+'%"></i></div>':'')+'</div></button>'; }).join('')+'</div>'
    :empty('Keine Kurse gefunden', 'Ändere den Filter oder lege einen neuen Kurs an.'));
}
function lessonUnlocked(c,i,p){ if(isTeacher() || i===0 || c.free) return true; const prev = c.lessons[i-1]; return !!(p.stars?.[lessonKey(c,prev)]); }
function vCourse(){
  const c = byId('courses',S.ui.course); if(!c){ S.ui.course = null; return vKurse(); }
  const t = isTeacher(); const p = t ? {stars:{},best:{}} : prog(S.session.id);
  const ls = c.lessons||[];
  return '<div class="row" style="margin:12px 0 18px"><button class="btn ghost sm" data-a="closeCourse">'+ic('back')+'Alle Kurse</button><span class="sp"></span>'+(t?'<button class="btn ghost sm" data-a="courseProgress" data-id="'+esc(c.id)+'">'+ic('users')+'Fortschritt</button><button class="btn ghost sm" data-a="editCourse" data-id="'+esc(c.id)+'">'+ic('edit')+'Bearbeiten</button>':'')+'</div>'+
    '<div class="cdet"><div>'+cover(c,true)+'</div><div class="stack"><div><span class="chip f" style="background:'+fc(c.fach)+'">'+esc(c.fach)+'</span> <span class="chip">'+kl(c.klasse)+'</span><h1 style="margin-top:10px">'+esc(c.title)+'</h1>'+(c.desc?'<p class="muted" style="margin-top:8px;max-width:62ch">'+esc(c.desc)+'</p>':'')+'</div>'+
    '<div class="sheets">'+(ls.length?ls.map((l,i)=>{ const st = p.stars?.[lessonKey(c,l)]||0; const lock = !lessonUnlocked(c,i,p); const best = p.best?.[lessonKey(c,l)];
      const isTest = l.test || /test|bist du fit/i.test(l.title);
      return '<button class="sheet '+(isTest?'test ':'')+(lock?'lock':'')+'" data-a="'+(lock?'locked':'play')+'" data-i="'+i+'"><span class="num">'+(isTest?'T':i+1)+'</span><span><b>'+esc(l.title)+'</b><span class="sub">'+(isTest?'Test · ':'Arbeitsblatt · ')+(l.questions||[]).length+' Aufgaben · '+lessonMax(l)+' Punkte'+(best!=null?' · beste: '+best+'%':'')+'</span></span><span>'+(lock?ic('lock'):stars(st))+'</span></button>'; }).join(''):empty('Noch keine Blätter','Füge im Bearbeiten-Modus Arbeitsblätter hinzu.'))+'</div></div></div>';
}

/* =====================================================================
   KALENDER
   ===================================================================== */
function events(){
  const t = isTeacher(); const sid = t ? null : S.session.id; const ev = [];
  (t?data('homework'):hwFor(sid)).forEach(h=>ev.push({date:h.due, kind:'hw', color:'var(--ok)', title:'Abgabe: '+short(h.text,40), sub:t?names(h.studentIds):h.fach, done:!t && isDone(h.id,sid), link:'aufgaben'}));
  (t?data('exams').filter(e=>byId('students',e.studentId)):examsFor(sid)).forEach(e=>ev.push({date:e.date, kind:'exam', color:'#7c3aed', title:(t?byId('students',e.studentId).name+': ':'')+examName(e), sub:!realF(e.fach)?String(e.themen||'').split('\n').slice(1).join(' '):(e.themen||''), id:e.id, link:'exam'}));
  (t?data('termine'):termineFor(sid)).forEach(x=>ev.push({date:x.date, kind:'termin', color:'#e03131', title:'Nachhilfe'+(x.time?' '+x.time+' Uhr':''), sub:(t?names(x.studentIds):'')+(x.note?' · '+x.note:''), id:x.id, link:'termin'}));
  (t?data('entries'):entriesFor(sid)).forEach(e=>ev.push({date:e.date, kind:'stunde', color:'#2f6fed', title:'Stunde: '+e.thema, sub:entryFaecher(e).join(', '), link:'kursmappe'}));
  return ev;
}
const evLi = e => '<div class="li" data-a="calEv" data-k="'+e.kind+'" data-id="'+esc(e.id||'')+'" data-l="'+e.link+'" style="cursor:pointer">'+dbox(e.date,e.color)+'<div class="grow"><b>'+esc(e.title)+'</b>'+(e.sub?'<span class="tiny muted">'+esc(short(e.sub,70))+'</span>':'')+'</div>'+(e.done?'<span class="chip ok">erledigt</span>':'<span class="chip">'+rel(e.date)+'</span>')+'</div>';
function vKalender(){
  const t = isTeacher();
  const base = S.ui.calMonth ? parse(S.ui.calMonth) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const y = base.getFullYear(), m = base.getMonth();
  const ev = events(); const map = {}; ev.forEach(e=>(map[e.date] ||= []).push(e));
  const off = (new Date(y,m,1).getDay()+6)%7; const days = new Date(y,m+1,0).getDate();
  const sel = S.ui.calDay || today();
  let cells = ''; for(let i=0;i<off;i++) cells += '<div class="cd out"></div>';
  for(let d=1; d<=days; d++){ const k = y+'-'+pad(m+1)+'-'+pad(d); const es = map[k]||[];
    cells += '<button class="cd '+(k===today()?'today ':'')+(k===sel?'sel':'')+'" data-a="calDay" data-d="'+k+'"><span>'+d+'</span><span class="cdots">'+es.slice(0,3).map(e=>'<i style="background:'+e.color+'"></i>').join('')+'</span></button>'; }
  const dayEv = map[sel]||[];
  const up = ev.filter(e=>e.kind!=='stunde' && diffDays(e.date)>=0 && diffDays(e.date)<=30 && !e.done).sort(by('date'));
  return pageHead('kalender','Kalender', t?'Nachhilfe-Termine, Klausuren und Abgaben deiner Schüler.':'Deine Termine, Klausuren und Abgaben.', (t?'<button class="btn primary" data-a="newTermin">'+ic('plus')+'Termin</button>':'')+'<button class="btn ghost" data-a="newExam">'+ic('exam')+'Klausur</button>')+
    '<div class="grid2"><section class="card"><div class="card-h"><button class="btn flat icon" data-a="calNav" data-n="-1" aria-label="Vorheriger Monat">'+ic('back')+'</button><h2>'+MON[m]+' '+y+'</h2><button class="btn flat icon" data-a="calNav" data-n="1" aria-label="Nächster Monat">'+ic('next')+'</button></div>'+
      '<div class="cal">'+['Mo','Di','Mi','Do','Fr','Sa','So'].map(w=>'<div class="cw">'+w+'</div>').join('')+cells+'</div>'+
      '<div class="legend"><span><i style="background:#e03131"></i>Nachhilfe</span><span><i style="background:#7c3aed"></i>Klausur</span><span><i style="background:var(--ok)"></i>Abgabe</span><span><i style="background:#2f6fed"></i>Stunde</span></div>'+
      '<h3 style="margin:16px 0 6px">'+fmtLong(sel)+'</h3>'+(dayEv.length?'<div class="list">'+dayEv.map(evLi).join('')+'</div>':'<p class="muted small">Nichts eingetragen.</p>')+
    '</section><section class="card"><h2 style="margin-bottom:8px">Die nächsten 30 Tage</h2>'+(up.length?'<div class="list">'+up.map(evLi).join('')+'</div>':empty('Nichts geplant','Hier erscheinen Termine, Klausuren und Abgaben.'))+'</section></div>';
}

/* =====================================================================
   KLAUSUREN & NOTEN
   ===================================================================== */
function vKlausuren(){
  const t = isTeacher();
  const all = (t?data('exams').filter(e=>byId('students',e.studentId)):examsFor(S.session.id)).filter(e=>!t || matchF([e.studentId]));
  const up = all.filter(e=>diffDays(e.date)>=0).sort(by('date'));
  const past = all.filter(e=>diffDays(e.date)<0).sort(by('date',-1));
  const graded = past.filter(e=>e.note);
  const avg = graded.length ? (graded.reduce((a,e)=>a+parseFloat(e.note),0)/graded.length).toFixed(1).replace('.',',') : '–';
  const row = e => { const s = byId('students',e.studentId); const n = diffDays(e.date);
    return '<tr class="cl" data-a="examOpen" data-id="'+esc(e.id)+'"><td class="first">'+(t?'<div class="who-cell">'+ava(s,'xs')+esc(s.name)+'</div>':'<b>'+esc(e.fach)+'</b>')+'</td>'+(t?'<td data-l="Fach">'+esc(e.fach)+'</td>':'')+'<td data-l="Datum" class="nowrap">'+fmt(e.date)+'</td><td data-l="Themen">'+esc(short(e.themen,60)||'–')+'</td><td data-l="'+(n>=0?'Noch':'Note')+'" class="num">'+(n>=0?'<span class="chip '+(n<=2?'bad':n<=7?'warn':'')+'">'+rel(e.date)+'</span>':(e.note?'<b style="font-size:17px">'+esc(e.note)+'</b>':'<span class="chip">Note eintragen</span>'))+'</td></tr>'; };
  const head = '<thead><tr><th>'+(t?'Schüler':'Fach')+'</th>'+(t?'<th>Fach</th>':'')+'<th>Datum</th><th>Themen</th><th class="num"></th></tr></thead>';
  return pageHead('klausuren','Klausuren & Noten', t?'Alle Klausuren deiner Schüler, mit Themen zur Vorbereitung und den Noten danach.':'Trag deine Klausuren ein – dann üben wir gezielt. Nach der Klausur kannst du die Note eintragen.', '<button class="btn primary" data-a="newExam">'+ic('plus')+'Klausur eintragen</button>')+
    '<div class="kpis">'+kpi(up.length,'anstehend')+kpi(up.filter(e=>diffDays(e.date)<=7).length,'in 7 Tagen')+kpi(graded.length,'mit Note')+kpi(avg,'Durchschnitt')+'</div>'+
    (t?'<div class="filters">'+filterSel()+'</div>':'')+
    '<div class="stack"><section class="card"><h2 style="margin-bottom:8px">Anstehend</h2>'+(up.length?'<div class="scroll"><table class="tbl">'+head+'<tbody>'+up.map(row).join('')+'</tbody></table></div>':empty('Keine Klausur eingetragen','Neue Klausuren erscheinen hier.'))+'</section>'+
    '<section class="card"><h2 style="margin-bottom:8px">Vergangen & Noten</h2>'+(past.length?'<div class="scroll"><table class="tbl">'+head+'<tbody>'+past.map(row).join('')+'</tbody></table></div>':empty('Noch keine vergangenen Klausuren','Nach der Klausur kannst du hier die Note eintragen.'))+'</section></div>';
}

/* =====================================================================
   NACHRICHTEN
   ===================================================================== */
/* =====================================================================
   NACHRICHTEN (Chat wie WhatsApp/Teams)
   ===================================================================== */
S.chat = {draft:{}, pend:{}, sending:false, urls:{}, last:null, n:0};
function chatList(){
  const out = [];
  if(isTeacher()){
    groups().forEach(g=>out.push({id:'g:'+g.id, name:g.name, sub:'Gruppe · '+names(students().filter(s=>s.groupId===g.id).map(s=>s.id)), color:g.color||'#2f6fed', group:true}));
    students().forEach(s=>out.push({id:'s:'+s.id, name:s.name, sub:'Klasse '+s.klasse, color:s.color}));
  } else {
    const s = me(); out.push({id:'s:'+s.id, name:set().teacherName||'Lehrkraft', sub:'Lehrkraft', color:'#2f6fed'});
    if(s.groupId){ const g = byId('groups', s.groupId); out.push({id:'g:'+s.groupId, name:g?.name||'Meine Gruppe', sub:'Gruppe', color:g?.color||'#8b5cf6', group:true}); }
  }
  out.forEach(c=>{ const ms = chatMsgs(c.id); c.lastMsg = ms[ms.length-1]; c.unread = chatUnread(c.id); });
  out.sort((a,b)=>(b.lastMsg?.at||0)-(a.lastMsg?.at||0));
  return out;
}
const chatMsgs = id => (data('msgs')||[]).filter(m=>m.chat===id).sort((a,b)=>(a.at||0)-(b.at||0));
const myId = () => isTeacher() ? 'teacher' : S.session.id;
const chatRead = id => (byId('notifread', myKey())?.chats||{})[id] || 0;
const chatUnread = id => chatMsgs(id).filter(m=>m.from!==myId() && (m.at||0)>chatRead(id)).length;
const unreadChats = () => chatList().reduce((a,c)=>a+c.unread,0);
async function markChatRead(id){
  const ms = chatMsgs(id); const last = ms[ms.length-1]; if(!last || (last.at||0)<=chatRead(id)) return;
  const cur = byId('notifread', myKey()) || {};
  try{ await S.db.collection('notifread').doc(myKey()).set({at:cur.at||0, chats:{...(cur.chats||{}), [id]:Math.max(Date.now(), last.at||0)}}); }catch(e){}
}
const timeOf = t => { const d = new Date(t); return pad(d.getHours())+':'+pad(d.getMinutes()); };
const dayLabel = t => { const k = ymd(new Date(t)); const n = diffDays(k); return n===0?'Heute':n===-1?'Gestern':fmtLong(k); };
const preview = m => !m ? 'Noch keine Nachrichten' : (m.text ? short(m.text,48) : (m.files?.length ? '📎 '+(m.files.length>1?m.files.length+' Dateien':m.files[0].name) : ''));
const isImg = f => /^image\//.test(f.type||'') || /\.(png|jpe?g|gif|webp|heic)$/i.test(f.name||'');
function chatAva(c){ return '<span class="ava" style="background:'+esc(c.color)+'">'+(c.group?ic('users'):esc(initials(c.name)))+'</span>'; }
function vNachrichten(){
  const list = chatList(); const cur = S.ui.chat;
  const listHtml = '<div class="c-list">'+
    '<div class="c-item news '+(cur==='news'?'on':'')+'" data-a="openChat" data-id="news"><span class="ava" style="background:#9ca3af">'+ic('bell')+'</span><div class="grow"><b>Klecks-Neuigkeiten</b><span class="tiny muted">'+esc(preview(myNotifs()[0]?{text:myNotifs()[0].text}:null))+'</span></div>'+(unread()?'<span class="c-badge">'+unread()+'</span>':'')+'</div>'+
    (list.length ? list.map(c=>'<div class="c-item '+(cur===c.id?'on':'')+'" data-a="openChat" data-id="'+esc(c.id)+'">'+chatAva(c)+'<div class="grow"><div class="c-top"><b>'+esc(c.name)+'</b><span class="tiny muted">'+(c.lastMsg?(diffDays(ymd(new Date(c.lastMsg.at)))===0?timeOf(c.lastMsg.at):fmt(ymd(new Date(c.lastMsg.at)))):'')+'</span></div><span class="tiny muted c-prev">'+esc(c.lastMsg?((c.lastMsg.from===myId()?'Du: ':(c.group&&c.lastMsg.from!==myId()?(c.lastMsg.from==='teacher'?(set().teacherName||'Lehrkraft'):(c.lastMsg.fromName||'')).split(' ')[0]+': ':''))+preview(c.lastMsg)):c.sub)+'</span></div>'+(c.unread?'<span class="c-badge">'+c.unread+'</span>':'')+'</div>').join('') : '<p class="muted small" style="padding:14px">Noch keine Schüler.</p>')+'</div>';
  let conv;
  if(cur==='news'){
    const ns = myNotifs(); const ra = readAt();
    conv = '<div class="c-conv"><div class="c-head"><button class="btn flat icon c-back" data-a="closeChat" aria-label="Zurück">'+ic('back')+'</button><span class="ava" style="background:#9ca3af">'+ic('bell')+'</span><div class="grow"><b>Klecks-Neuigkeiten</b><span class="tiny muted">Hausaufgaben, Stunden, Erinnerungen</span></div></div><div class="c-msgs">'+
      (ns.length?ns.slice().reverse().map(n=>'<div class="bub them sys'+(n.at>ra?' new':'')+'"><div style="white-space:pre-wrap">'+esc(n.text)+'</div><div class="b-meta">'+(n.link&&n.kind!=='msg'?'<a href="#'+esc(n.link)+'">öffnen</a> · ':'')+dayLabel(n.at)+', '+timeOf(n.at)+'</div></div>').join(''):'<div class="c-empty">Noch keine Neuigkeiten.</div>')+'</div></div>';
  } else if(cur){
    const c = list.find(x=>x.id===cur);
    if(!c){ S.ui.chat = null; return vNachrichten(); }
    const ms = chatMsgs(cur); let lastDay = '', lastFrom = '';
    const body = ms.map(m=>{ const mine = m.from===myId(); const day = dayLabel(m.at||Date.now()); let h = '';
      if(day!==lastDay){ h += '<div class="c-day"><span>'+day+'</span></div>'; lastDay = day; lastFrom = ''; }
      const who = m.from==='teacher' ? (set().teacherName||'Lehrkraft') : (m.fromName || byId('students',m.from)?.name || '');
      const showName = c.group && !mine && lastFrom!==m.from;
      const canDel = isTeacher() || mine;
      const imgs = (m.files||[]).filter(isImg), docs = (m.files||[]).filter(f=>!isImg(f));
      h += '<div class="bub '+(mine?'me':'them')+(lastFrom===m.from?' cont':'')+'">'+(showName?'<div class="b-name" style="color:'+esc(m.from==='teacher'?'#2f6fed':(byId('students',m.from)?.color||'#8b5cf6'))+'">'+esc(who)+'</div>':'')+
        (imgs.length?'<div class="b-imgs">'+imgs.map(f=>'<a href="#" data-a="openFile" data-p="'+esc(f.path)+'"><img class="lazy" data-path="'+esc(f.path)+'" alt="'+esc(f.name)+'"'+(S.chat.urls[f.path]?' src="'+esc(S.chat.urls[f.path].u)+'"':'')+'></a>').join('')+'</div>':'')+
        (docs.length?'<div class="b-files">'+docs.map(f=>{ const [t,col] = ftype(f); return '<a class="file" href="#" data-a="openFile" data-p="'+esc(f.path)+'"><span class="ft" style="background:'+col+'">'+t+'</span><span>'+esc(f.name)+'</span></a>'; }).join('')+'</div>':'')+
        (m.text?'<div class="b-text">'+linkify(esc(m.text))+'</div>':'')+
        '<div class="b-meta">'+timeOf(m.at||Date.now())+(canDel?' <button class="b-del" data-a="delMsg" data-id="'+esc(m.id)+'" aria-label="Nachricht löschen">'+ic('trash')+'</button>':'')+'</div></div>';
      lastFrom = m.from; return h; }).join('');
    const pend = S.chat.pend[cur]||[];
    conv = '<div class="c-conv"><div class="c-head"><button class="btn flat icon c-back" data-a="closeChat" aria-label="Zurück">'+ic('back')+'</button>'+chatAva(c)+'<div class="grow"><b>'+esc(c.name)+'</b><span class="tiny muted">'+esc(c.sub)+'</span></div></div>'+
      '<div class="c-msgs" id="c-msgs">'+(body||'<div class="c-empty">Schreib die erste Nachricht – auch Fotos, PDFs und Arbeitsblätter gehen.</div>')+'</div>'+
      (pend.length||S.chat.sending?'<div class="c-pend">'+pend.map((f,i)=>{ const [t,col] = ftype(f); return '<span class="file"><span class="ft" style="background:'+col+'">'+t+'</span><span>'+esc(f.name)+'</span><button type="button" class="btn flat sm icon" data-a="rmPend" data-i="'+i+'" aria-label="Entfernen">'+ic('x')+'</button></span>'; }).join('')+(S.chat.sending?'<span class="muted small">Lädt hoch …</span>':'')+'</div>':'')+
      '<div class="c-comp"><label class="btn flat icon" aria-label="Datei anhängen" title="Foto, PDF oder Arbeitsblatt anhängen">'+ic('clip')+'<input type="file" data-a="chatUpload" multiple accept="image/*,application/pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt" hidden></label>'+
      '<label class="btn flat icon c-cam" aria-label="Foto aufnehmen" title="Foto aufnehmen"><svg class="i" viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg><input type="file" data-a="chatUpload" accept="image/*" capture="environment" hidden></label>'+
      '<textarea id="chat-in" rows="1" placeholder="Nachricht schreiben …" aria-label="Nachricht">'+esc(S.chat.draft[cur]||'')+'</textarea>'+
      '<button class="btn primary icon c-send" data-a="chatSend" aria-label="Senden" '+(S.chat.sending?'disabled':'')+'>'+ic('send')+'</button></div></div>';
  } else conv = '<div class="c-conv c-none"><div class="c-empty">'+appIcon('nachrichten')+'<b>Wähle einen Chat</b><span>'+(isTeacher()?'Schreib einem Kind allein oder der ganzen Gruppe.':'Schreib deiner Lehrkraft oder deiner Gruppe.')+'</span></div></div>';
  return '<div class="chat '+(cur?'open':'')+'">'+listHtml+conv+'</div>';
}
const linkify = t => t.replace(/(https?:\/\/[^\s<]+)/g,'<a href="$1" target="_blank" rel="noopener">$1</a>');
function afterChatRender(){
  if(S.route!=='nachrichten') return;
  const box = $('#c-msgs');
  if(box){ const n = chatMsgs(S.ui.chat).length; if(S.chat.last!==S.ui.chat || n!==S.chat.n || S.chat.stick!==false) box.scrollTop = box.scrollHeight; S.chat.last = S.ui.chat; S.chat.n = n;
    box.onscroll = () => { S.chat.stick = box.scrollHeight - box.scrollTop - box.clientHeight < 60; }; }
  const ta = $('#chat-in'); if(ta){ grow(ta); if(S.chat.focus){ ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } }
  document.querySelectorAll('img.lazy').forEach(async img=>{ const p = img.dataset.path; const c = S.chat.urls[p];
    if(c && c.t > Date.now()-50*60e3){ if(!img.src) img.src = c.u; return; }
    try{ const u = await KD.fileUrl(p); S.chat.urls[p] = {u, t:Date.now()}; img.src = u; img.onload = () => { if(S.chat.stick!==false && box) box.scrollTop = box.scrollHeight; }; }catch(e){} });
  if(S.ui.chat && S.ui.chat!=='news') markChatRead(S.ui.chat);
  if(S.ui.chat==='news' && unread()) A.notifsSeen();
}
const grow = ta => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 140)+'px'; };

/* =====================================================================
   DATEIEN
   ===================================================================== */
function vDateien(){
  const t = isTeacher(); const sid = t?null:S.session.id;
  const rows = [];
  (t?data('entries'):entriesFor(sid)).forEach(e=>(e.files||[]).forEach(f=>rows.push({f, i:e.files.indexOf(f), col:'entries', id:e.id, date:e.date, src:'Stunde: '+e.thema, faecher:entryFaecher(e)})));
  (t?data('homework'):hwFor(sid)).forEach(h=>(h.files||[]).forEach(f=>rows.push({f, i:h.files.indexOf(f), col:'homework', id:h.id, date:h.createdAt?ymd(new Date(h.createdAt)):h.due, src:'Hausaufgabe', faecher:[h.fach]})));
  rows.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  const typeF = S.ui.ftype||'alle';
  const shown = rows.filter(r=>typeF==='alle' || ftype(r.f)[0]===typeF);
  return pageHead('dateien','Dateien','Alle Arbeitsblätter, Fotos und PDFs aus der Kursmappe und den Hausaufgaben.')+
    '<div class="filters"><div class="seg2">'+['alle','PDF','BILD'].map(x=>'<button class="'+(typeF===x?'on':'')+'" data-a="ftype" data-t="'+x+'">'+(x==='alle'?'Alle':x==='PDF'?'PDFs':'Bilder')+'</button>').join('')+'</div><span class="muted small">'+shown.length+' Dateien</span></div>'+
    (shown.length?'<section class="card"><div class="list">'+shown.map(r=>{ const [ty,c] = ftype(r.f); return '<a class="li" href="#" data-a="openFile" data-p="'+esc(r.f.path||'')+'"><span class="file" style="padding:0;border:0;background:none"><span class="ft" style="background:'+c+'">'+ty+'</span></span><div class="grow"><b>'+esc(r.f.name)+'</b><span class="tiny muted">'+fmt(r.date)+' · '+esc(short(r.src,60))+'</span></div>'+r.faecher.map(fchip).join(' ')+(isTeacher()?'<button class="btn flat sm icon" data-a="renameFile" data-c="'+r.col+'" data-id="'+esc(r.id)+'" data-i="'+r.i+'" aria-label="Umbenennen">'+ic('edit')+'</button>':'')+'</a>'; }).join('')+'</div></section>'
    :empty('Noch keine Dateien', t?'Hänge Arbeitsblätter an eine Stunde oder Hausaufgabe an.':'Arbeitsblätter erscheinen hier, sobald sie hochgeladen sind.'));
}

/* =====================================================================
   FORTSCHRITT
   ===================================================================== */
function vFortschritt(){
  if(isTeacher()){
    const studs = students();
    return pageHead('fortschritt','Fortschritt','Wie fleißig wird gelernt? Sterne, Punkte und Hausaufgaben pro Kind.')+
      (studs.length?'<section class="card"><div class="scroll"><table class="tbl"><thead><tr><th>Schüler</th><th>Hausaufgaben</th><th class="num">Sterne</th><th class="num">Punkte</th><th class="num">Diese Woche</th><th class="num">Serie</th><th class="num">Zuletzt aktiv</th></tr></thead><tbody>'+
      grouped().flatMap(x=>x.list).map(s=>{ const h = hwStats(s.id), p = prog(s.id), la = lastActive(s.id); const st = coursesFor(s).reduce((a,c)=>a+courseStars(c,p),0);
        return '<tr class="cl" data-a="studDetail" data-id="'+esc(s.id)+'"><td class="first"><div class="who-cell">'+ava(s,'xs')+esc(s.name)+'</div></td><td data-l="Hausaufgaben"><div class="tiny muted">'+h.done+' von '+h.total+' erledigt</div><div class="bar ok" style="max-width:150px"><i style="width:'+(h.total?h.done/h.total*100:0)+'%"></i></div></td><td class="num" data-l="Sterne">'+st+'</td><td class="num" data-l="Punkte">'+(p.xp||0)+'</td><td class="num" data-l="Woche">'+(p.weekKey===weekKey()?p.weekXp||0:0)+'</td><td class="num" data-l="Serie">'+streak(p)+' Tage</td><td class="num muted" data-l="Aktiv">'+(la?ago(la):'–')+'</td></tr>'; }).join('')+'</tbody></table></div></section>':empty('Noch keine Schüler','Lege unter „Schüler“ deine Schüler an.'));
  }
  const s = me(), p = prog(s.id), L = level(p.xp), cs = coursesFor(s);
  const tot = cs.reduce((a,c)=>a+courseStars(c,p),0), max = cs.reduce((a,c)=>a+(c.lessons||[]).length*3,0);
  const R = 44, C = 2*Math.PI*R;
  return pageHead('fortschritt','Mein Fortschritt','Jede richtige Antwort bringt Punkte. Alle 100 Punkte steigst du ein Level auf.')+
    '<div class="grid2"><section class="card" style="display:flex;gap:20px;align-items:center;flex-wrap:wrap"><svg viewBox="0 0 110 110" width="120" height="120" style="transform:rotate(-90deg)"><circle cx="55" cy="55" r="'+R+'" stroke="var(--card2)" stroke-width="12" fill="none"/><circle cx="55" cy="55" r="'+R+'" stroke="#f5b301" stroke-width="12" fill="none" stroke-linecap="round" stroke-dasharray="'+(C*L.pct/100)+' '+C+'" '+(L.pct?'':'opacity="0"')+'/></svg><div><div class="muted small" style="font-weight:700">LEVEL</div><b style="font-size:44px;line-height:1">'+L.lv+'</b><div class="muted small">'+(100-L.pct)+' Punkte bis Level '+(L.lv+1)+'</div></div></section>'+
    '<section class="kpis" style="grid-template-columns:repeat(2,minmax(0,1fr));margin:0">'+kpi(p.xp||0,'Punkte')+kpi(tot+'/'+max,'Sterne')+kpi(streak(p)+' Tage','Lernserie')+kpi(p.weekKey===weekKey()?p.weekXp||0:0,'Punkte diese Woche')+'</section></div>'+
    '<section class="card" style="margin-top:18px"><h2 style="margin-bottom:8px">Meine Kurse</h2>'+(cs.length?'<div class="list">'+cs.map(c=>{ const m = (c.lessons||[]).length*3, g = courseStars(c,p); return '<div class="li" data-a="openCourse" data-id="'+esc(c.id)+'" style="cursor:pointer"><span class="dbox" style="background:'+fcov(c.fach)+'"><b style="font-size:13px">'+esc(fg(c.fach))+'</b></span><div class="grow"><b>'+esc(c.title)+'</b><div class="bar sun" style="margin-top:6px;max-width:300px"><i style="width:'+(m?g/m*100:0)+'%"></i></div></div><span class="tiny muted">'+g+'/'+m+' ★</span></div>'; }).join('')+'</div>':empty('Noch keine Kurse','Kurse erscheinen hier.'))+'</section>';
}

/* =====================================================================
   SCHÜLER
   ===================================================================== */
function vSchueler(){
  const card = s => { const h = hwStats(s.id), p = prog(s.id); const ex = examsFor(s.id).filter(e=>diffDays(e.date)>=0).sort(by('date'))[0];
    return '<article class="stud" data-a="studDetail" data-id="'+esc(s.id)+'"><div class="stud-h">'+ava(s)+'<div><b>'+esc(s.name)+'</b><span class="tiny muted">Klasse '+esc(s.klasse)+' · '+esc(s.username||'kein Zugang')+'</span></div></div>'+
      '<div class="row" style="gap:6px">'+(s.faecher||[]).map(fchip).join('')+'</div>'+
      '<div class="mini"><div><b>'+h.open+'</b><span>offen</span></div><div><b>'+level(p.xp).lv+'</b><span>Level</span></div><div><b>'+(p.xp||0)+'</b><span>Punkte</span></div></div>'+
      (ex?'<span class="chip '+(diffDays(ex.date)<=7?'warn':'')+'">'+ic('exam')+'Klausur '+rel(ex.date)+'</span>':'<span class="tiny muted">Keine Klausur eingetragen</span>')+'</article>'; };
  const gs = grouped();
  return pageHead('schueler','Schüler & Gruppen','Teile deine Schüler in Gruppen ein, z. B. nach Familie. Jeder Schüler hat einen eigenen Zugang.','<button class="btn ghost" data-a="newGroup">'+ic('users')+'Gruppe</button><button class="btn primary" data-a="newStud">'+ic('plus')+'Schüler</button>')+
    (gs.length ? gs.map(({g,list})=>'<section class="grp"><div class="grp-h"><span class="grp-dot" style="background:'+esc(g?.color||'#6b7280')+'"></span><h2>'+esc(g?g.name:'Ohne Gruppe')+'</h2><span class="tiny muted">'+list.length+' Schüler</span><span class="sp"></span>'+(g?'<button class="btn ghost sm" data-a="newStud" data-g="'+esc(g.id)+'">'+ic('plus')+'Schüler</button><button class="btn flat sm icon" data-a="editGroup" data-id="'+esc(g.id)+'" aria-label="Gruppe bearbeiten">'+ic('edit')+'</button>':'')+'</div>'+
      (g?.note?'<p class="muted small" style="margin:-4px 0 12px">'+esc(g.note)+'</p>':'')+
      (list.length?'<div class="studs">'+list.map(card).join('')+'</div>':'<div class="empty">Noch niemand in dieser Gruppe.</div>')+'</section>').join('')
    : empty('Noch keine Schüler','Lege zuerst eine Gruppe an und dann die Schüler darin.'));
}

/* =====================================================================
   DIALOGE
   ===================================================================== */
function openM(type, d={}){ S.m = {type, d}; renderM(); }
function closeM(){ S.m = null; $('#modal').innerHTML = ''; }
function renderM(){
  const m = S.m; if(!m){ $('#modal').innerHTML=''; return; }
  const fn = M[m.type]; if(!fn) return; const r = fn(m.d);
  $('#modal').innerHTML = '<div class="ov" data-a="ovClose"><div class="dlg '+(r.wide?'wide':'')+'" role="dialog" aria-modal="true" aria-label="'+esc(String(r.title).replace(/<[^>]+>/g,'').trim())+'"><div class="dlg-h"><h2>'+r.title+'</h2><button class="btn flat icon" data-a="closeM" aria-label="Schließen">'+ic('x')+'</button></div><div class="dlg-b">'+r.body+'</div>'+(r.foot?'<div class="dlg-f">'+r.foot+'</div>':'')+'</div></div>';
  const f = $('#modal [autofocus]'); if(f && !renderM._noFocus) f.focus();
}
const rerenderM = () => { renderM._noFocus = true; renderM(); renderM._noFocus = false; };
const fld = (label, inner, hint) => '<label class="fld"><span>'+label+'</span>'+inner+(hint?'<small>'+hint+'</small>':'')+'</label>';
const inp = (k, v, attrs='') => '<input class="inp" data-k="'+k+'" value="'+esc(v??'')+'" '+attrs+'>';
const ta = (k, v, attrs='') => '<textarea class="inp" data-k="'+k+'" '+attrs+'>'+esc(v??'')+'</textarea>';
const segF = (k, cur, opts) => '<div class="seg">'+opts.map(o=>'<button type="button" class="'+(cur===o?'on':'')+'" data-a="segSet" data-k="'+k+'" data-v="'+esc(o)+'">'+(FACH[o]?'<span class="dot" style="background:'+fc(o)+'"></span>':'')+esc(o)+'</button>').join('')+'</div>';
const multiF = (k, sel, opts) => '<div class="seg">'+opts.map(o=>'<button type="button" class="'+(sel.includes(o)?'on':'')+'" data-a="multiToggle" data-k="'+k+'" data-v="'+esc(o)+'"><span class="dot" style="background:'+fc(o)+'"></span>'+esc(o)+'</button>').join('')+'</div>';
function studPick(k, sel){
  if(!students().length) return '<p class="muted small">Lege zuerst Schüler an.</p>';
  return '<div class="pick">'+grouped().map(({g,list})=>{ const ids = list.map(s=>s.id); const all = ids.length && ids.every(id=>sel.includes(id));
    return '<div><div class="pick-h"><span class="dot" style="background:'+esc(g?.color||'#6b7280')+'"></span>'+esc(g?g.name:'Ohne Gruppe')+(ids.length>1?'<button type="button" class="btn ghost sm" data-a="multiGroup" data-k="'+k+'" data-ids="'+esc(ids.join(','))+'">'+(all?'Keinen':'Ganze Gruppe')+'</button>':'')+'</div>'+
      '<div class="seg" style="margin-top:6px">'+list.map(s=>'<button type="button" class="'+(sel.includes(s.id)?'on':'')+'" data-a="multiToggle" data-k="'+k+'" data-v="'+esc(s.id)+'">'+ava(s,'xs')+esc(s.name)+'</button>').join('')+'</div></div>'; }).join('')+'</div>';
}
function filesEd(d){ if(!isTeacher()) return '';
  return '<div class="files">'+(d.files||[]).map((f,i)=>{ const [t,c] = ftype(f); return '<span class="file"><span class="ft" style="background:'+c+'">'+t+'</span><input class="inp fname" data-k="files.'+i+'.name" value="'+esc(f.name)+'" aria-label="Dateiname" title="Tippen zum Umbenennen">'+ic('edit','i fn-ic')+'<button type="button" class="btn flat sm icon" data-a="rmFile" data-i="'+i+'" aria-label="Entfernen">'+ic('x')+'</button></span>'; }).join('')+
    '<label class="btn ghost sm" style="cursor:pointer">'+ic('clip')+(d.uploading?'Lädt hoch …':'Datei anhängen')+'<input type="file" data-a="upload" accept="application/pdf,image/*,.doc,.docx,.txt" multiple hidden></label></div>'; }

const M = {};
M.rename = d => ({ title:'Datei umbenennen', body: fld('Neuer Name', inp('name', d.name, 'autofocus'), 'So wird die Datei überall angezeigt: in der Kursmappe, bei den Hausaufgaben und unter Dateien.'),
  foot:'<button class="btn ghost" data-a="closeM">Abbrechen</button><button class="btn primary" data-a="saveRename">Speichern</button>' });
M.confirm = d => ({ title:esc(d.title), body:'<p>'+esc(d.text)+'</p>', foot:'<button class="btn ghost" data-a="closeM">Abbrechen</button><button class="btn bad" data-a="confirmYes">'+esc(d.yes||'Löschen')+'</button>' });
M.entry = d => ({ title: d.id?'Stunde bearbeiten':'Stunde eintragen', wide:true, body:
  '<div class="two">'+fld('Datum', inp('date', d.date, 'type="date"'))+fld('Fächer (mehrere möglich)', multiF('faecher', d.faecher, FAECHER))+'</div>'+
  fld('Schüler', studPick('studentIds', d.studentIds))+
  fld('Thema der Stunde', inp('thema', d.thema, 'placeholder="z. B. Diktat, Flächeninhalt und Umfang" autofocus'))+
  fld('Was haben wir gemacht?', ta('inhalt', d.inhalt, 'placeholder="Jede Zeile wird ein Punkt, z. B.:\nDiktat „Der Spielplatzbesuch“\nFlächeninhalt Rechteck geübt"'), 'Jede Zeile wird als eigener Punkt angezeigt.')+
  fld('Arbeitsblätter & Dateien', filesEd(d), 'PDF oder Foto – deine Schüler können sie öffnen.')+
  (d.studentIds.length?'<div class="box"><b>Anwesenheit</b><div class="ent-att">'+d.studentIds.map(id=>{ const s = byId('students',id); if(!s) return ''; const v = d.attendance?.[id]||'da'; return '<div class="row">'+ava(s,'xs')+'<span style="flex:1;font-weight:600">'+esc(s.name)+'</span><div class="seg2">'+[['da','anwesend'],['fehlt','fehlt'],['entschuldigt','entschuldigt']].map(([k,l])=>'<button type="button" class="'+(v===k?'on':'')+'" data-a="segSet" data-k="attendance.'+id+'" data-v="'+k+'">'+l+'</button>').join('')+'</div></div>'; }).join('')+'</div></div>':'')+
  '<div class="box"><label class="toggle"><input type="checkbox" data-k="hwOn" '+(d.hwOn?'checked':'')+' data-rerender="1"> Hausaufgabe aufgeben</label>'+
  (d.hwOn?(d.studentIds.length>1?'<label class="toggle"><input type="checkbox" data-k="hwPer" '+(d.hwPer?'checked':'')+' data-rerender="1"> Jeder bekommt eine eigene Aufgabe</label>':'')+
    (d.hwPer&&d.studentIds.length>1 ? d.studentIds.map(id=>{ const s = byId('students',id); return fld(ava(s,'xs')+' '+esc(s?.name), ta('hwTexts.'+id, (d.hwTexts||{})[id], 'placeholder="Aufgabe für '+esc(s?.name)+'"')); }).join('') : fld(d.studentIds.length>1?'Aufgabe (für alle gleich)':'Aufgabe', ta('hwText', d.hwText, 'placeholder="z. B. Buch S. 42 Nr. 3a–c"')))+
    fld('Fällig bis', inp('hwDue', d.hwDue, 'type="date"')):'')+'</div>',
  foot:(d.id?'<button class="btn ghost" data-a="delEntry">'+ic('trash')+'Löschen</button><span class="sp"></span>':'')+'<button class="btn ghost" data-a="closeM">Abbrechen</button><button class="btn primary" data-a="saveEntry">Speichern</button>' });
M.hw = d => { const per = d.per && d.studentIds.length>1 && !d.id; return { title: d.id?'Hausaufgabe bearbeiten':'Neue Hausaufgabe', wide:true, body:
  fld('Fach', segF('fach', d.fach, FAECHER))+fld('Für wen?', studPick('studentIds', d.studentIds))+
  (!d.id && d.studentIds.length>1 ? '<label class="toggle"><input type="checkbox" data-k="per" '+(d.per?'checked':'')+' data-rerender="1"> Jeder bekommt eine eigene Aufgabe</label>' : '')+
  (per ? d.studentIds.map(id=>{ const s = byId('students',id); return fld(ava(s,'xs')+' '+esc(s?.name), ta('texts.'+id, (d.texts||{})[id], 'placeholder="Aufgabe für '+esc(s?.name)+'"')); }).join('') : fld(d.studentIds.length>1?'Aufgabe (für alle gleich)':'Aufgabe', ta('text', d.text, 'placeholder="Was soll erledigt werden?"')))+
  fld('Fällig bis', inp('due', d.due, 'type="date"'))+fld('Dateien', filesEd(d)),
  foot:(d.id?'<button class="btn ghost" data-a="delHw">'+ic('trash')+'Löschen</button><span class="sp"></span>':'')+'<button class="btn ghost" data-a="closeM">Abbrechen</button><button class="btn primary" data-a="saveHw">Speichern</button>' }; };
M.hwStudent = d => { const h = byId('homework',d.h), s = byId('students',d.s), st = stOf(d.h,d.s)||{};
  return { title:esc(s?.name)+' · Hausaufgabe', body:'<p class="hw-t">'+esc(h?.text)+'</p>'+
  '<div class="row"><span class="chip '+(st.done?'ok':'warn')+'">'+(st.done?'Erledigt '+(st.at?ago(st.at):''):'Noch offen')+'</span><button class="btn ghost sm" data-a="teacherToggle">'+(st.done?'Als offen markieren':'Als erledigt markieren')+'</button></div>'+
  (st.note?'<div class="fb" style="background:var(--card2)"><b>Frage von '+esc(s?.name)+':</b> '+esc(st.note)+'</div>':'')+
  fld('Rückmeldung an '+esc(s?.name), ta('feedback', d.feedback, 'placeholder="z. B. Super gemacht! Bei Nr. 3 nochmal auf die Einheit achten." autofocus')),
  foot:'<button class="btn ghost" data-a="closeM">Schließen</button><button class="btn primary" data-a="saveFeedback">Rückmeldung senden</button>' }; };
M.hwNote = d => ({ title:'Frage an '+esc(set().teacherName||'deine Lehrkraft'), body: fld('Was möchtest du sagen oder fragen?', ta('note', d.note, 'placeholder="z. B. Bei Aufgabe 2 komme ich nicht weiter." autofocus')),
  foot:'<button class="btn ghost" data-a="closeM">Abbrechen</button><button class="btn primary" data-a="saveNote">Senden</button>' });
M.stud = d => ({ title: d.id?'Schüler bearbeiten':'Schüler anlegen', body:
  '<div class="two">'+fld('Name', inp('name', d.name, 'placeholder="Vorname (und Nachname)" autofocus'))+fld('Klasse', '<select class="inp" data-k="klasse">'+['5','6','7','8','9','10','11','12','13'].map(k=>'<option '+(d.klasse===k?'selected':'')+'>'+k+'</option>').join('')+'</select>')+'</div>'+
  fld('Gruppe', '<select class="inp" data-k="groupId"><option value="">Ohne Gruppe</option>'+groups().map(g=>'<option value="'+esc(g.id)+'" '+(d.groupId===g.id?'selected':'')+'>'+esc(g.name)+'</option>').join('')+'</select>')+
  fld('Schule (optional)', inp('schule', d.schule, 'placeholder="z. B. Heinrich-von-Bibra-Schule"'))+
  fld('Fächer', multiF('faecher', d.faecher, FAECHER))+
  '<div class="box"><b>Zugang</b><div class="two">'+fld('Benutzername', inp('username', d.username, 'autocapitalize="off" placeholder="z. B. lea"'), 'Leer = aus dem Namen')+
  fld(d.id?'Neues Passwort (leer = bleibt)':'Passwort', '<div class="row" style="flex-wrap:nowrap">'+inp('pw', d.pw, 'autocomplete="off"')+'<button type="button" class="btn ghost sm" data-a="genPw">Neu</button></div>', 'Mindestens 6 Zeichen')+'</div></div>'+
  fld('Farbe', '<div class="swatches">'+COLORS.map(c=>'<button type="button" class="'+(d.color===c?'on':'')+'" style="background:'+c+'" data-a="segSet" data-k="color" data-v="'+c+'" aria-label="Farbe"></button>').join('')+'</div>'),
  foot:(d.id?'<button class="btn ghost" data-a="delStud">'+ic('trash')+'Löschen</button><span class="sp"></span>':'')+'<button class="btn ghost" data-a="closeM">Abbrechen</button><button class="btn primary" data-a="saveStud">Speichern</button>' });
M.creds = d => ({ title:'Zugangsdaten', body:'<p>Gib diese Daten <b>'+esc(d.name)+'</b> oder den Eltern. Das Passwort wird nur jetzt angezeigt.</p><div class="creds"><div><span>Benutzername</span><b>'+esc(d.username)+'</b></div><div><span>Passwort</span><b>'+esc(d.pw)+'</b></div></div>',
  foot:'<button class="btn ghost" data-a="copyCreds">Kopieren</button><button class="btn primary" data-a="closeM">Fertig</button>' });
M.group = d => ({ title: d.id?'Gruppe bearbeiten':'Neue Gruppe', body:
  fld('Name der Gruppe', inp('name', d.name, 'placeholder="z. B. Familie Schmidt" autofocus'))+fld('Notiz (optional)', inp('note', d.note, 'placeholder="z. B. samstags 16 Uhr"'))+
  fld('Farbe', '<div class="swatches">'+COLORS.map(c=>'<button type="button" class="'+(d.color===c?'on':'')+'" style="background:'+c+'" data-a="segSet" data-k="color" data-v="'+c+'" aria-label="Farbe"></button>').join('')+'</div>')+
  (students().length?fld('Wer gehört dazu?', '<div class="seg">'+students().map(s=>'<button type="button" class="'+(d.members.includes(s.id)?'on':'')+'" data-a="multiToggle" data-k="members" data-v="'+esc(s.id)+'">'+ava(s,'xs')+esc(s.name)+'</button>').join('')+'</div>'):''),
  foot:(d.id?'<button class="btn ghost" data-a="delGroup">'+ic('trash')+'Löschen</button><span class="sp"></span>':'')+'<button class="btn ghost" data-a="closeM">Abbrechen</button><button class="btn primary" data-a="saveGroup">Speichern</button>' });
M.studDetail = d => { const s = byId('students',d.id); if(!s) return {title:'Schüler',body:''};
  const p = prog(s.id), h = hwStats(s.id), L = level(p.xp); const ex = examsFor(s.id).sort(by('date',-1)); const cs = coursesFor(s); const openHw = hwFor(s.id).filter(x=>!isDone(x.id,s.id)).sort(by('due'));
  return { title:ava(s,'sm')+' '+esc(s.name), wide:true, body:
    '<div class="kpis" style="margin:0">'+kpi(h.done+'/'+h.total,'Hausaufgaben erledigt')+kpi(L.lv,'Level')+kpi(p.xp||0,'Punkte')+kpi(streak(p),'Tage in Folge')+'</div>'+
    '<div class="row" style="gap:6px"><span class="chip">Klasse '+esc(s.klasse)+'</span>'+(groupOf(s)?'<span class="chip f" style="background:'+esc(groupOf(s).color)+'">'+esc(groupOf(s).name)+'</span>':'')+(s.faecher||[]).map(fchip).join('')+'<span class="chip">'+ic('lock')+esc(s.username||'kein Zugang')+'</span></div>'+
    '<div class="grid2" style="gap:16px"><div><h3 style="margin-bottom:6px">Offene Hausaufgaben</h3>'+(openHw.length?'<div class="list">'+openHw.map(x=>'<div class="li"><span class="dot" style="background:var(--ok)"></span><div class="grow"><b>'+esc(short(x.text,60))+'</b><span class="tiny muted">bis '+rel(x.due)+'</span></div></div>').join('')+'</div>':'<p class="muted small">Alles erledigt.</p>')+
    '<h3 style="margin:16px 0 6px">Klausuren & Noten</h3>'+(ex.length?'<div class="list">'+ex.map(e=>'<div class="li" data-a="examOpen" data-id="'+esc(e.id)+'" style="cursor:pointer">'+dbox(e.date,'#7c3aed')+'<div class="grow"><b>'+esc(examName(e))+'</b><span class="tiny muted">'+esc(short(e.themen,50))+'</span></div>'+(e.note?'<b>'+esc(e.note)+'</b>':'<span class="chip">'+rel(e.date)+'</span>')+'</div>').join('')+'</div>':'<p class="muted small">Keine Klausuren.</p>')+'</div>'+
    '<div><h3 style="margin-bottom:6px">Kurse</h3>'+(cs.length?'<div class="list">'+cs.map(c=>{ const max=(c.lessons||[]).length*3, got=courseStars(c,p); return '<div class="li"><span class="dbox" style="background:'+fcov(c.fach)+'"><b style="font-size:12px">'+esc(fg(c.fach))+'</b></span><div class="grow"><b>'+esc(c.title)+'</b><div class="bar sun" style="margin-top:5px"><i style="width:'+(max?got/max*100:0)+'%"></i></div></div><span class="tiny muted">'+got+'/'+max+'</span></div>'; }).join('')+'</div>':'<p class="muted small">Keine Kurse.</p>')+'</div></div>',
    foot:'<button class="btn ghost" data-a="newHwFor" data-id="'+esc(s.id)+'">'+ic('task')+'Hausaufgabe</button><button class="btn ghost" data-a="newMsgTo" data-id="'+esc(s.id)+'">'+ic('send')+'Nachricht</button><span class="sp"></span><button class="btn primary" data-a="editStud" data-id="'+esc(s.id)+'">'+ic('edit')+'Bearbeiten</button>' }; };
M.exam = d => ({ title: d.id?'Klausur':'Klausur eintragen', body:
  (isTeacher()&&!d.id?fld('Schüler', '<div class="seg">'+students().map(s=>'<button type="button" class="'+(d.studentId===s.id?'on':'')+'" data-a="segSet" data-k="studentId" data-v="'+esc(s.id)+'">'+ava(s,'xs')+esc(s.name)+'</button>').join('')+'</div>'):'')+
  '<div class="two">'+fld('Datum', inp('date', d.date, 'type="date"'))+fld('Fach', segF('fach', d.fach, FAECHER))+'</div>'+
  fld('Themen', ta('themen', d.themen, 'placeholder="z. B. Flächeninhalt und Umfang, Einheiten umwandeln" autofocus'), 'Damit wir gezielt üben können.')+
  (d.id && diffDays(d.date)<=0 ? fld('Note', '<div class="seg">'+['1','2','3','4','5','6'].map(n=>'<button type="button" class="'+(String(d.note)===n?'on':'')+'" data-a="segSet" data-k="note" data-v="'+n+'">'+n+'</button>').join('')+'<button type="button" data-a="segSet" data-k="note" data-v="">–</button></div>')+fld('Kommentar', inp('kommentar', d.kommentar, 'placeholder="z. B. 2-, Geometrie lief super"')):'')+
  (d.id?examLinks(d):''),
  foot:(d.id?'<button class="btn ghost" data-a="delExam">'+ic('trash')+'Löschen</button><span class="sp"></span>':'')+'<button class="btn ghost" data-a="closeM">Abbrechen</button><button class="btn primary" data-a="saveExam">Speichern</button>' });
function examLinks(d){ const s = byId('students', d.studentId); if(!s) return '';
  const words = String(d.themen||'').toLowerCase().split(/[^a-zäöüß]+/).filter(w=>w.length>4);
  const cs = coursesFor(s).filter(c=>c.fach===d.fach || words.some(w=>(c.title+' '+(c.desc||'')).toLowerCase().includes(w.slice(0,6))));
  return '<div class="box"><b>Zur Vorbereitung</b>'+(cs.length?'<div class="list">'+cs.slice(0,5).map(c=>'<div class="li" data-a="openCourse" data-id="'+esc(c.id)+'" style="cursor:pointer"><span class="dbox" style="background:'+fcov(c.fach)+'"><b style="font-size:12px">'+esc(fg(c.fach))+'</b></span><div class="grow"><b>'+esc(c.title)+'</b><span class="tiny muted">Kurs öffnen</span></div>'+ic('next')+'</div>').join('')+'</div>':'<p class="muted small">Noch kein passender Kurs.</p>')+'</div>'; }
M.termin = d => ({ title: d.id?'Termin bearbeiten':'Nachhilfe-Termin', body:
  '<div class="two">'+fld('Datum', inp('date', d.date, 'type="date"'))+fld('Uhrzeit', inp('time', d.time, 'type="time"'))+'</div>'+fld('Schüler', studPick('studentIds', d.studentIds))+
  fld('Notiz (optional)', inp('note', d.note, 'placeholder="z. B. Vorbereitung auf die Bio-Klausur"'))+(!d.id?'<label class="toggle"><input type="checkbox" data-k="weekly" '+(d.weekly?'checked':'')+'> Wöchentlich wiederholen (4 Wochen)</label>':''),
  foot:(d.id?'<button class="btn ghost" data-a="delTermin">'+ic('trash')+'Löschen</button><span class="sp"></span>':'')+'<button class="btn ghost" data-a="closeM">Abbrechen</button><button class="btn primary" data-a="saveTermin">Speichern</button>' });
M.settings = d => ({ title:'Einstellungen', body:(isTeacher()?fld('Dein Name (sehen die Schüler)', inp('teacherName', d.teacherName, 'autofocus')):'')+
  '<div class="box"><b>Passwort ändern</b><div class="two">'+fld('Neues Passwort', inp('pw', d.pw, 'type="password" autocomplete="new-password"'), 'Mindestens 8 Zeichen')+fld('Wiederholen', inp('pw2', d.pw2, 'type="password" autocomplete="new-password"'))+'</div></div>',
  foot:'<button class="btn ghost" data-a="closeM">Abbrechen</button><button class="btn primary" data-a="saveSettings">Speichern</button>' });
M.notifs = () => { const list = myNotifs().slice(0,25), rem = reminders(), ra = S.m.d.readAt;
  return { title:'Benachrichtigungen', body:(rem.length?'<div><h3 style="margin-bottom:6px">Erinnerungen</h3><div class="list">'+rem.map(r=>'<a class="li" href="#'+r.link+'" data-a="closeM"><span class="dot" style="background:'+(r.kind==='bad'?'var(--bad)':r.kind==='warn'?'var(--orange)':'var(--accent)')+'"></span><div class="grow"><b style="font-weight:600">'+esc(r.text)+'</b></div></a>').join('')+'</div></div>':'')+
  '<div><h3 style="margin-bottom:6px">Neuigkeiten</h3>'+(list.length?'<div class="list">'+list.map(n=>'<a class="li" href="#'+esc(n.kind==='msg'?'nachrichten':(n.link||'start'))+'" data-a="closeM" style="'+(n.at>ra?'background:var(--accent-soft)':'')+'">'+ic(n.kind==='msg'?'msg':'bell')+'<div class="grow"><b style="font-weight:600">'+esc(n.text)+'</b><span class="tiny muted">'+ago(n.at)+'</span></div></a>').join('')+'</div>':'<p class="muted small">Noch keine Benachrichtigungen.</p>')+'</div>' }; };
M.menu = () => { const who = isTeacher()?{name:set().teacherName||'Lehrkraft',color:'#2f6fed'}:me(); return { title:'Konto', body:'<div class="row">'+ava(who,'lg')+'<div><b style="font-size:17px">'+esc(who.name)+'</b><div class="muted small">'+(isTeacher()?'Lehrkraft':'Klasse '+esc(who.klasse))+'</div></div></div>',
  foot:'<button class="btn ghost" data-a="settings">'+ic('gear')+'Einstellungen</button><button class="btn primary" data-a="logout">'+ic('out')+'Abmelden</button>' }; };
M.courseProgress = d => { const c = byId('courses',d.id); const studs = students().filter(s=>coursesFor(s).some(x=>x.id===c.id));
  return { title:'Fortschritt: '+esc(c.title), wide:true, body: studs.length ? '<div class="scroll"><table class="tbl"><thead><tr><th>Schüler</th>'+(c.lessons||[]).map((l,i)=>'<th>'+(i+1)+'</th>').join('')+'<th class="num">Summe</th></tr></thead><tbody>'+
    studs.map(s=>{ const p = prog(s.id); return '<tr><td class="first"><div class="who-cell">'+ava(s,'xs')+esc(s.name)+'</div></td>'+(c.lessons||[]).map(l=>'<td data-l="'+esc(l.title)+'">'+stars(p.stars?.[lessonKey(c,l)]||0)+'</td>').join('')+'<td class="num" data-l="Summe">'+courseStars(c,p)+'/'+(c.lessons||[]).length*3+'</td></tr>'; }).join('')+'</tbody></table></div>' : '<p class="muted">Diesem Kurs sind noch keine Schüler zugeordnet.</p>' }; };
M.course = d => {
  if(d.edit!=null){ const l = d.lessons[d.edit]; const base = 'lessons.'+d.edit;
    return { title:'Arbeitsblatt bearbeiten', wide:true, body:
      fld('Titel', inp(base+'.title', l.title, 'placeholder="z. B. Flächeninhalt des Rechtecks" autofocus'))+
      '<label class="toggle"><input type="checkbox" data-k="'+base+'.test" '+(l.test?'checked':'')+'> Dies ist ein Test (Abschluss)</label>'+
      fld('Merkkasten', ta(base+'.intro', l.intro, 'style="min-height:140px" placeholder="# Merke\n• Regel 1\n• Regel 2\n> Beispiel: …"'), 'Zeilen mit # = Überschrift, • = Aufzählung, > = Beispiel, **Wort** = hervorgehoben.')+
      '<h3>Aufgaben ('+l.questions.length+')</h3>'+
      l.questions.map((q,qi)=>{ const qb = base+'.questions.'+qi; const types = [['mc','Auswahl'],['input','Eingabe'],['gap','Lückentext'],['tf','Richtig/Falsch']];
        let inner;
        if(q.type==='input') inner = fld('Richtige Antwort', inp(qb+'.answer', q.answer, 'placeholder="z. B. 24 cm²"'), 'Mehrere richtige Antworten mit | trennen.');
        else if(q.type==='gap') inner = fld('Text mit Lücken', ta(qb+'.text', q.text, 'placeholder="Das [[Schwimmen]] tut gut. Wir [[schwimmen]] bis zur Boje."'), 'Lösungen in [[doppelte eckige Klammern]]. Groß-/Kleinschreibung zählt.');
        else if(q.type==='tf') inner = fld('Aussagen', ta(qb+'.tfText', q.tfText ?? (q.items||[]).map(it=>(it.a?'R: ':'F: ')+it.t).join('\n'), 'placeholder="R: Ein Quadrat hat vier gleich lange Seiten.\nF: Ein Dreieck hat vier Ecken."'), 'Jede Zeile eine Aussage: R: = richtig, F: = falsch.');
        else if(q.type==='mc' || !q.type) inner = '<div class="tiny muted" style="font-weight:700">Antworten – richtige ankreuzen</div>'+[0,1,2,3].map(oi=>'<div class="optrow"><input type="radio" name="r'+qi+'" data-k="'+qb+'.answer" value="'+oi+'" '+(Number(q.answer)===oi?'checked':'')+' aria-label="Antwort '+(oi+1)+' ist richtig">'+inp(qb+'.options.'+oi, (q.options||[])[oi], 'placeholder="Antwort '+(oi+1)+(oi>1?' (optional)':'')+'"')+'</div>').join('');
        else inner = '<p class="muted small">Spezialaufgabe ('+esc(q.type)+') – wird unverändert übernommen.</p>';
        return '<div class="qed"><div class="qed-h"><span>Aufgabe '+(qi+1)+'</span><div class="row"><div class="seg">'+types.map(([k,n])=>'<button type="button" class="'+((q.type||'mc')===k?'on':'')+'" data-a="segSet" data-k="'+qb+'.type" data-v="'+k+'">'+n+'</button>').join('')+'</div><button type="button" class="btn flat sm icon" data-a="rmQ" data-i="'+qi+'" aria-label="Aufgabe löschen">'+ic('trash')+'</button></div></div>'+
          ta(qb+'.q', q.q, 'placeholder="Arbeitsauftrag, z. B. „Berechne den Flächeninhalt.“" style="min-height:56px"')+inner+inp(qb+'.hint', q.hint, 'placeholder="Tipp bei falscher Antwort (optional)"')+'</div>'; }).join('')+
      '<button type="button" class="btn ghost" data-a="addQ">'+ic('plus')+'Aufgabe hinzufügen</button>',
      foot:'<button class="btn primary" data-a="lessonDone">Fertig</button>' };
  }
  return { title: d.id?'Kurs bearbeiten':'Neuer Kurs', wide:true, body:
    fld('Titel', inp('title', d.title, 'placeholder="z. B. Flächeninhalt und Umfang" autofocus'))+fld('Kurzbeschreibung', inp('desc', d.desc, 'placeholder="Worum geht es?"'))+
    '<div class="two">'+fld('Fach', segF('fach', d.fach, FAECHER))+fld('Klasse', segF('klasse', d.klasse, ['5','6','7','8','alle']))+'</div>'+
    fld('Nur für bestimmte Schüler? (optional)', studPick('studentIds', d.studentIds), 'Leer = alle Schüler der gewählten Klasse.')+
    '<label class="toggle"><input type="checkbox" data-k="draft" '+(d.draft?'checked':'')+'> Entwurf (für Schüler noch unsichtbar)</label>'+
    '<div><h3 style="margin-bottom:8px">Arbeitsblätter</h3><div class="stack" style="gap:8px">'+d.lessons.map((l,i)=>'<div class="les"><span class="dbox" style="background:'+(l.test?'var(--teal)':fcov(d.fach))+';width:36px;height:40px"><b style="font-size:14px">'+(l.test?'T':i+1)+'</b></span><span class="grow">'+esc(l.title||'Ohne Titel')+'<br><span class="muted tiny">'+l.questions.length+' Aufgaben</span></span><button type="button" class="btn flat sm icon" data-a="mvL" data-i="'+i+'" data-n="-1" aria-label="Nach oben">↑</button><button type="button" class="btn flat sm icon" data-a="editL" data-i="'+i+'" aria-label="Bearbeiten">'+ic('edit')+'</button><button type="button" class="btn flat sm icon" data-a="rmL" data-i="'+i+'" aria-label="Löschen">'+ic('trash')+'</button></div>').join('')+'</div>'+
    '<button type="button" class="btn ghost" style="margin-top:10px" data-a="addL">'+ic('plus')+'Arbeitsblatt hinzufügen</button></div>',
    foot:(d.id?'<button class="btn ghost" data-a="delCourse">'+ic('trash')+'Löschen</button><span class="sp"></span>':'')+'<button class="btn ghost" data-a="closeM">Abbrechen</button><button class="btn primary" data-a="saveCourse">Speichern</button>' };
};

/* ---------- Formular-Bindung ---------- */
function setPath(o, path, v){ const ks = path.split('.'); let t = o; for(let i=0;i<ks.length-1;i++){ const k = ks[i]; if(t[k]==null) t[k] = /^\d+$/.test(ks[i+1]) ? [] : {}; t = t[k]; } t[ks[ks.length-1]] = v; }
function getPath(o, path){ return path.split('.').reduce((t,k)=>t==null?t:t[k], o); }
document.addEventListener('input', e => {
  const el = e.target;
  if(el.id==='q'){ S.ui.q = el.value; render(); return; }
  if(el.id==='chat-in'){ S.chat.draft[S.ui.chat] = el.value; grow(el); return; }
  if(el.classList.contains('ln') || el.id==='p-in'){ pInput(el); return; }
  const k = el.dataset?.k; if(!k || !S.m) return;
  setPath(S.m.d, k, el.type==='checkbox' ? el.checked : el.type==='radio' ? Number(el.value) : el.value);
  if(el.dataset.rerender) rerenderM();
});
document.addEventListener('change', e => {
  const el = e.target;
  if(el.dataset?.k && S.m && (el.type==='checkbox' || el.type==='radio' || el.tagName==='SELECT')){ setPath(S.m.d, el.dataset.k, el.type==='checkbox'?el.checked:el.type==='radio'?Number(el.value):el.value); if(el.dataset.rerender) rerenderM(); }
  if(el.dataset?.a==='studFilter'){ S.ui.stud = el.value; render(); }
  if(el.dataset?.a==='upload') upload(el.files);
  if(el.dataset?.a==='chatUpload'){ chatUpload([...el.files]); el.value=''; }
});
async function upload(files){
  if(!files?.length) return; S.m.d.uploading = true; rerenderM();
  for(const f of files){ if(f.size > 20*1024*1024){ toast(f.name+' ist größer als 20 MB.'); continue; } try{ (S.m.d.files ||= []).push(await KD.uploadFile(f)); }catch(e){ toast('Upload fehlgeschlagen: '+f.name); } }
  if(S.m){ S.m.d.uploading = false; rerenderM(); }
}

/* =====================================================================
   ARBEITSBLATT-PLAYER
   ===================================================================== */
function shuffle(a){ a = a.slice(); for(let i=a.length-1;i>0;i--){ const j = Math.floor(Math.random()*(i+1)); [a[i],a[j]] = [a[j],a[i]]; } return a; }
function gapParts(text){ const out = []; const re = /\[\[(.+?)\]\]/g; let last = 0, m; const s = String(text||''); while((m = re.exec(s))){ if(m.index>last) out.push({t:s.slice(last,m.index)}); out.push({ans:m[1].split('|')}); last = re.lastIndex; } if(last<s.length) out.push({t:s.slice(last)}); return out; }
const normLoose = s => String(s??'').trim().replace(/\s+/g,' ').replace(/,/g,'.').replace(/[.!?]$/,'').toLowerCase();
const normCase = s => String(s??'').trim().replace(/\s+/g,' ').replace(/,/g,'.').replace(/[.!?]$/,'');
const normNum = s => normLoose(s).replace(/(\d)\s+(?=\d)/g,'$1').replace(/\s*(cm²|m²|mm²|dm²|km²|cm|mm|dm|km|m|kg|g|t|€|ct|min|h|s|°)$/,' $1').trim();
function matchAns(val, alts, cs){
  const v = cs ? normCase(val) : normLoose(val);
  return alts.some(a => { const x = cs ? normCase(a) : normLoose(a); return v===x || normNum(val)===normNum(a) && !cs || (cs && /^[\d.,\s]+[a-zäöü²°€]*$/i.test(a) && normNum(val)===normNum(a)); });
}
function renderMerk(text){
  if(!text) return '';
  const bold = s => esc(s).replace(/\*\*(.+?)\*\*/g,'<em>$1</em>');
  const lines = String(text).split('\n');
  let html = '', para = [];
  const flush = () => { if(para.length){ html += '<p>'+para.map(bold).join('<br>')+'</p>'; para = []; } };
  lines.forEach(l => { const t = l.trim(); if(!t){ flush(); return; }
    if(t.startsWith('# ')){ flush(); html += '<h4>'+bold(t.slice(2))+'</h4>'; }
    else if(/^[•\-*] /.test(t)){ flush(); html += '<div class="bul"><span>'+bold(t.slice(2))+'</span></div>'; }
    else if(t.startsWith('> ')){ flush(); html += '<div class="bsp">'+bold(t.slice(2))+'</div>'; }
    else para.push(t); });
  flush();
  return '<div class="merk">'+(/^#\s/.test(String(text).trim())?'':'<h4>Merke</h4>')+html+'</div>';
}
function startLesson(ci, li){
  const c = byId('courses',ci); const l = c?.lessons?.[li]; if(!l) return;
  const qs = (l.questions||[]).filter(q=>q.q||q.text||q.items).map(q => {
    const x = {...q, type:q.type||'mc'};
    if(x.type==='mc') x.opts = (x.noShuffle ? (q.options||[]).map((t,i)=>({t,i})) : shuffle((q.options||[]).map((t,i)=>({t,i})))).filter(o=>String(o.t??'').trim());
    if(x.type==='tf' && !x.items && x.tfText) x.items = parseTf(x.tfText);
    if(x.type==='sort') x.itemsS = shuffle((x.items||[]).map((it,i)=>({...it, i})));
    if(x.type==='order') x.itemsS = shuffle((x.items||[]).map((t,i)=>({t, i})));
    return x; });
  const max = qs.reduce((a,q)=>a+pts(q),0);
  S.p = {c, l, li, qs, i:0, phase: l.intro ? 'intro' : 'q', ans:{}, got:0, max, wrong:[], res:null};
  renderP();
}
const parseTf = txt => String(txt||'').split('\n').map(s=>s.trim()).filter(Boolean).map(s=>({a:/^r\s*:/i.test(s), t:s.replace(/^[rf]\s*:\s*/i,'')}));
function pInput(el){ const p = S.p; if(!p) return; if(el.id==='p-in') p.ans.v = el.value; else { (p.ans.g ||= {})[el.dataset.g] = el.value; } const b = $('[data-a=pCheck]'); if(b) b.disabled = !canCheck(); }
function canCheck(){ const p = S.p, q = p.qs[p.i], a = p.ans;
  if(q.type==='mc') return a.sel!=null;
  if(q.type==='input') return String(a.v||'').trim()!=='';
  if(q.type==='gap') { const n = gapParts(q.text).filter(x=>x.ans).length; return Object.values(a.g||{}).filter(v=>String(v).trim()).length===n; }
  if(q.type==='tf') return Object.keys(a.tf||{}).length===(q.items||[]).length;
  if(q.type==='sort') return Object.keys(a.so||{}).length===(q.items||[]).length;
  if(q.type==='order') return (a.ord||[]).length===(q.items||[]).length;
  return true; }
function checkAnswer(){
  const p = S.p, q = p.qs[p.i], a = p.ans; let got = 0, max = pts(q); const res = {};
  if(q.type==='mc'){ got = a.sel===Number(q.answer) ? 1 : 0; }
  else if(q.type==='input'){ got = matchAns(a.v, String(q.answer||'').split('|'), !!q.cs) ? 1 : 0; }
  else if(q.type==='gap'){ let gi = 0; res.g = {}; gapParts(q.text).forEach(x=>{ if(!x.ans) return; const ok = matchAns((a.g||{})[gi], x.ans, q.cs!==false); res.g[gi] = ok; if(ok) got++; gi++; }); }
  else if(q.type==='tf'){ res.tf = {}; (q.items||[]).forEach((it,i)=>{ const ok = a.tf[i]===!!it.a; res.tf[i] = ok; if(ok) got++; }); }
  else if(q.type==='sort'){ res.so = {}; (q.items||[]).forEach((it,i)=>{ const ok = Number(a.so[i])===Number(it.c); res.so[i] = ok; if(ok) got++; }); }
  else if(q.type==='order'){ got = (a.ord||[]).every((v,i)=>v===i) ? 1 : 0; }
  p.res = {got, max, ...res}; p.got += got; if(got<max) p.wrong.push(p.i); p.phase = 'fb'; renderP();
}
async function finishLesson(){
  const p = S.p; const pct = p.max ? p.got/p.max : 0;
  const st = pct>=.9?3:pct>=.7?2:pct>=.4?1:0;
  p.phase = 'end'; p.stars = st; p.xp = p.got*5; p.pct = Math.round(pct*100);
  if(!isTeacher()){
    const sid = S.session.id, old = prog(sid), key = lessonKey(p.c,p.l);
    const prev = old.stars?.[key]||0; if(st===3 && prev<3) p.xp += 20;
    const wk = weekKey(), t = today(); const days = [...new Set([...(old.days||[]), t])].sort().slice(-40);
    const body = { xp:(old.xp||0)+p.xp, stars:{...(old.stars||{}), [key]:Math.max(prev,st)}, best:{...(old.best||{}), [key]:Math.max(old.best?.[key]||0, p.pct)}, plays:(old.plays||0)+1, lastActive:Date.now(), weekKey:wk, weekXp:(old.weekKey===wk?(old.weekXp||0):0)+p.xp, days };
    await save('progress', sid, body);
    if(p.l.test || st===3 && prev<3) notify('teacher', me().name+(p.l.test?' hat den Test „'+p.c.title+'“ mit '+p.pct+'% abgeschlossen':' hat „'+p.l.title+'“ mit 3 Sternen geschafft'), 'fortschritt', 'course');
  }
  renderP();
}
function taskBody(q, fb){
  const p = S.p, a = p.ans, r = p.res || {};
  if(q.type==='mc') return '<div class="opts">'+q.opts.map(o=>{ let cls=''; if(fb){ if(o.i===Number(q.answer)) cls='right'; else if(o.i===a.sel) cls='wrong'; } else if(o.i===a.sel) cls='sel'; return '<button class="opt '+cls+'" data-a="pSel" data-i="'+o.i+'" '+(fb?'disabled':'')+'>'+esc(o.t)+'</button>'; }).join('')+'</div>';
  if(q.type==='input') return '<input class="big-in" id="p-in" value="'+esc(a.v||'')+'" '+(fb?'disabled':'')+' placeholder="Deine Antwort" autocomplete="off" autocapitalize="off" autofocus>';
  if(q.type==='gap'){ let gi = 0; return '<div class="gap-text">'+gapParts(q.text).map(x=>{ if(!x.ans) return esc(x.t); const i = gi++; const ok = r.g?.[i]; const w = Math.max(5, Math.min(18, x.ans[0].length+2));
      return '<input class="ln '+(fb?(ok?'right':'wrong'):'')+'" data-g="'+i+'" value="'+esc((a.g||{})[i]||'')+'" style="width:'+w+'ch" '+(fb?'disabled':'')+' autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Lücke '+(i+1)+'">'+(fb&&!ok?'<span class="fix">'+esc(x.ans[0])+'</span>':''); }).join('')+'</div>'; }
  if(q.type==='tf') return '<div class="tf">'+(q.items||[]).map((it,i)=>'<div class="tf-row '+(fb?(r.tf[i]?'right':'wrong'):'')+'"><span>'+esc(it.t)+'</span><div class="seg2"><button class="'+(a.tf?.[i]===true?'on':'')+'" data-a="pTf" data-i="'+i+'" data-v="1" '+(fb?'disabled':'')+'>richtig</button><button class="'+(a.tf?.[i]===false?'on':'')+'" data-a="pTf" data-i="'+i+'" data-v="0" '+(fb?'disabled':'')+'>falsch</button></div></div>').join('')+'</div>';
  if(q.type==='sort') return '<div class="sort'+((q.cats||[]).length>3?' many':'')+'">'+q.itemsS.map(it=>'<div class="sort-row '+(fb?(r.so[it.i]?'right':'wrong'):'')+'"><b>'+esc(it.t)+(fb&&!r.so[it.i]?' <span class="fix">→ '+esc(q.cats[it.c])+'</span>':'')+'</b><div class="seg2">'+q.cats.map((c,ci)=>'<button class="'+(Number(a.so?.[it.i])===ci && a.so?.[it.i]!=null?'on':'')+'" data-a="pSort" data-i="'+it.i+'" data-v="'+ci+'" '+(fb?'disabled':'')+'>'+esc(c)+'</button>').join('')+'</div></div>').join('')+'</div>';
  if(q.type==='order'){ const ord = a.ord||[]; return '<div class="order">'+q.itemsS.map(it=>{ const pos = ord.indexOf(it.i); return '<button class="ord '+(pos>=0?'picked':'')+'" data-a="pOrd" data-i="'+it.i+'" '+(fb?'disabled':'')+'><span class="on" style="'+(pos<0?'background:#d5dbe0':'')+'">'+(pos>=0?pos+1:'')+'</span>'+esc(it.t)+(fb?' <span class="fix">('+(it.i+1)+')</span>':'')+'</button>'; }).join('')+'</div>'+(ord.length&&!fb?'<button class="btn ghost sm" data-a="pOrdReset">Neu ordnen</button>':''); }
  return '';
}
function taskHead(q,i){ const m = String(q.q||'').match(/^Aufgabe (\w+):\s*/); return '<span class="n">'+(m?m[1]:i+1)+'.</span><span class="task-q">'+esc(m?q.q.slice(m[0].length):(q.q||''))+'</span>'; }
function renderP(){
  const p = S.p, el = $('#player'); if(!p){ el.innerHTML = ''; document.body.style.overflow=''; return; }
  document.body.style.overflow = 'hidden';
  const total = p.qs.length; const progress = p.phase==='end' ? 100 : p.phase==='intro' ? 0 : (p.i + (p.phase==='fb'?1:0))/Math.max(1,total)*100;
  const isTest = p.l.test;
  const head = '<div class="ws-h"><div><div class="tiny" style="color:#3a8aa4;font-weight:700">'+esc(p.c.fach)+' · '+esc(p.c.title)+'</div><h2>'+esc(p.l.title)+'</h2></div><div class="brand">'+logo(20)+'KLECKS</div></div>';
  let main = '', foot = '', fcls = '';
  if(p.phase==='intro'){
    main = '<div class="ws">'+head+renderMerk(p.l.intro)+'<p style="font-size:14px;color:#6b7280">'+total+' Aufgaben · '+p.max+' Punkte'+(isTest?' · Test':'')+'</p></div>';
    foot = '<div class="p-fb muted">Lies den Merkkasten in Ruhe durch.</div><button class="btn primary" data-a="pStart" autofocus>Los geht’s '+ic('next')+'</button>';
  } else if(p.phase==='end'){
    const msg = p.stars===3?'Prima!':p.stars===2?'Gut gemacht!':p.stars===1?'Ordentlich!':'Übe weiter!';
    const band = p.pct>=90?0:p.pct>=70?1:2;
    main = '<div class="ws"><div class="p-end"><div class="big-stars">'+[0,1,2].map(i=>star(i<p.stars)).join('')+'</div><h1>'+msg+'</h1><p style="font-size:18px;font-weight:700">'+p.got+' von '+p.max+' Punkten · '+p.pct+'%</p>'+(p.l.noten?'<p style="font-size:22px;font-weight:800;color:#0d5468">Note '+(1+p.l.noten.filter(x=>p.got/p.max*100<x).length)+'</p>':'')+(isTeacher()?'<p class="muted small">Vorschau – wird nicht gespeichert</p>':'<span class="chip acc" style="font-size:14px;padding:5px 12px">'+ic('bolt')+'+'+p.xp+' Punkte</span>')+
      (p.l.noten?'':'<div class="score"><div class="'+(band===0?'on':'')+'">90–100 %<br>Prima</div><div class="'+(band===1?'on':'')+'">70–89 %<br>Gut gemacht</div><div class="'+(band===2?'on':'')+'">unter 70 %<br>Übe weiter</div></div>')+
      (p.wrong.length?'<div class="hint" style="text-align:left;width:100%">Schau dir diese Aufgaben nochmal an:<br>'+p.wrong.map(i=>'• '+(/^Aufgabe /.test(p.qs[i].q||'')?esc(short(p.qs[i].q,80)):'Aufgabe '+(i+1)+': '+esc(short(p.qs[i].q,70)))).join('<br>')+'</div>':'')+'</div></div>';
    foot = '<button class="btn ghost" data-a="pRetry">'+ic('refresh')+'Nochmal</button><span class="sp"></span>'+(p.c.lessons[p.li+1]?'<button class="btn primary" data-a="pNext">Nächstes Blatt '+ic('next')+'</button>':'<button class="btn primary" data-a="pClose">Fertig</button>');
  } else {
    const q = p.qs[p.i], fb = p.phase==='fb';
    main = '<div class="ws">'+head+(p.i===0||fb?'':'')+'<div class="task"><div class="task-n">'+taskHead(q,p.i)+'</div>'+taskBody(q,fb)+'</div>'+(p.l.intro?'<details><summary class="tiny" style="cursor:pointer;color:#3a8aa4;font-weight:700">Merkkasten anzeigen</summary>'+renderMerk(p.l.intro)+'</details>':'')+'</div>';
    if(fb){ const r = p.res; const all = r.got===r.max, none = r.got===0;
      fcls = all?'right':none?'wrong':'part';
      let sol = '';
      if(!all && q.type==='mc') sol = 'Richtig ist: '+esc((q.options||[])[Number(q.answer)]);
      if(!all && q.type==='input') sol = 'Richtig ist: '+esc(String(q.answer).split('|')[0]);
      if(!all && q.type==='order') sol = 'Richtige Reihenfolge: '+(q.items||[]).map((t,i)=>(i+1)+'. '+esc(short(t,30))).join('  ');
      foot = '<div class="p-fb"><b>'+(all?'Richtig! +'+r.got:none?'Nicht ganz':r.got+' von '+r.max+' richtig')+'</b>'+sol+(q.hint&&!all?'<div class="small" style="margin-top:3px">'+esc(q.hint)+'</div>':'')+'</div><button class="btn '+(all?'ok':'primary')+'" data-a="pCont" autofocus>Weiter</button>';
    } else foot = '<div class="p-fb muted">Aufgabe '+(p.i+1)+' von '+total+'</div><button class="btn primary" data-a="pCheck" '+(canCheck()?'':'disabled')+'>Prüfen</button>';
  }
  el.innerHTML = '<div class="play"><div class="p-top"><button class="btn flat icon" data-a="pClose" aria-label="Beenden">'+ic('x')+'</button><div class="bar"><i style="width:'+progress+'%"></i></div><span class="p-pts">'+p.got+' / '+p.max+' P.</span></div><div class="p-main">'+main+'</div><div class="p-foot '+fcls+'"><div class="p-foot-in">'+foot+'</div></div></div>';
  const af = el.querySelector('[autofocus]') || el.querySelector('.ln:not([disabled])'); if(af && p.phase!=='intro') af.focus(); else if(af) af.focus();
}
document.addEventListener('keydown', e => {
  if(e.key==='Escape'){ if(S.m) closeM(); else if(S.ui.q){ S.ui.q=''; render(); } return; }
  if(e.key==='Enter' && e.target.id==='chat-in' && !e.shiftKey && !matchMedia('(pointer:coarse)').matches){ e.preventDefault(); A.chatSend(); return; }
  if(!S.p || e.key!=='Enter') return;
  if(e.target.id==='p-in' || e.target.classList?.contains('ln')){ e.preventDefault(); if(S.p.phase==='q' && canCheck()) checkAnswer(); else if(S.p.phase==='fb') pCont(); else if(e.target.classList.contains('ln')){ const n = e.target.parentElement.querySelector('.ln[data-g="'+(Number(e.target.dataset.g)+1)+'"]'); n?.focus(); } }
});
function pCont(){ const p = S.p; p.i++; p.ans = {}; p.res = null; if(p.i>=p.qs.length) finishLesson(); else { p.phase = 'q'; renderP(); $('.p-main')?.scrollTo(0,0); } }

/* =====================================================================
   AKTIONEN
   ===================================================================== */
const A = {};
A.noop = () => {};
A.pwShow = el => { const i = el.previousElementSibling; i.type = i.type==='password' ? 'text' : 'password'; el.textContent = i.type==='password' ? 'Zeigen' : 'Verbergen'; };
A.logout = () => logout();
A.menu = () => openM('menu');
A.theme = () => { const next = isDark() ? 'light' : 'dark'; document.documentElement.dataset.theme = next; pref('theme', next); render(); };
A.clearQ = () => { S.ui.q = ''; };
A.settings = () => openM('settings', {teacherName:set().teacherName||'', pw:'', pw2:''});
A.saveSettings = async () => { const d = S.m.d;
  if(d.pw){ if(d.pw.length<8) return toast('Das Passwort braucht mindestens 8 Zeichen.'); if(d.pw!==d.pw2) return toast('Die Passwörter stimmen nicht überein.'); try{ await KD.changeOwnPassword(d.pw); }catch(e){ return toast('Passwort konnte nicht geändert werden.'); } }
  if(isTeacher() && !await save('settings','main',{...strip(set()), teacherName:d.teacherName.trim()})) return;
  closeM(); toast(d.pw?'Gespeichert – neues Passwort aktiv':'Gespeichert'); };
A.notifs = async () => { const ra = readAt(); openM('notifs', {readAt:ra}); if(myNotifs().some(n=>n.at>ra)){ try{ await S.db.collection('notifread').doc(myKey()).set({at:Date.now()}); }catch(e){} } };
A.closeM = () => closeM();
A.ovClose = (el, ev) => { if(ev.target===el) closeM(); };
A.startTab = el => { S.ui.startTab = el.dataset.t; render(); };
A.mappe = el => { S.ui.mappe = el.dataset.k; render(); };
A.fach = el => { S.ui.fach = el.dataset.f; if(S.route!=='kurse') location.hash = 'kurse'; else render(); };
A.klasse = el => { S.ui.klasse = el.dataset.k; render(); };
A.hwTab = el => { S.ui.hwTab = el.dataset.t; render(); };
A.ftype = el => { S.ui.ftype = el.dataset.t; render(); };
A.goKurse = () => { location.hash = 'kurse'; };
A.segSet = el => { const k = el.dataset.k; if(k.endsWith('.type') && getPath(S.m.d,k)!==el.dataset.v){ const base = k.replace(/\.type$/,''); setPath(S.m.d, base+'.answer', el.dataset.v==='mc'?0:''); } setPath(S.m.d, k, el.dataset.v); rerenderM(); };
A.multiToggle = el => { const k = el.dataset.k, v = el.dataset.v; const arr = getPath(S.m.d,k) || []; setPath(S.m.d, k, arr.includes(v) ? arr.filter(x=>x!==v) : [...arr, v]); rerenderM(); };
A.multiGroup = el => { const k = el.dataset.k; const ids = el.dataset.ids.split(','); const arr = getPath(S.m.d,k)||[]; const all = ids.every(id=>arr.includes(id)); setPath(S.m.d, k, all ? arr.filter(x=>!ids.includes(x)) : [...new Set([...arr, ...ids])]); rerenderM(); };
A.renameFile = (el, ev) => { ev.stopPropagation(); const doc = byId(el.dataset.c, el.dataset.id); const f = doc?.files?.[Number(el.dataset.i)]; if(f) openM('rename', {c:el.dataset.c, id:el.dataset.id, i:Number(el.dataset.i), name:f.name}); };
A.saveRename = async () => { const d = S.m.d; const name = String(d.name||'').trim(); if(!name) return toast('Bitte einen Namen eingeben.');
  const doc = byId(d.c, d.id); if(!doc) return closeM(); const path = doc.files?.[d.i]?.path;
  if(await syncNames({[path]:name})){ closeM(); toast('Umbenannt – überall aktualisiert'); } };
/* Gleicher Dateiname überall: Kursmappe, Hausaufgaben, Nachrichten */
async function syncNames(map){
  const paths = Object.keys(map).filter(Boolean); if(!paths.length) return true;
  for(const c of ['entries','homework','msgs']){
    for(const doc of (data(c)||[])){
      if(!(doc.files||[]).some(f=>paths.includes(f.path) && f.name!==map[f.path])) continue;
      const files = doc.files.map(f=>paths.includes(f.path) ? {...f, name:map[f.path]} : f);
      if(!await save(c, doc.id, {...strip(doc), files})) return false;
    }
  }
  return true;
}
A.rmFile = el => { S.m.d.files.splice(Number(el.dataset.i),1); rerenderM(); };
A.confirmYes = async () => { const fn = S.m.d.onYes; closeM(); if(fn) await fn(); };
function ask(title, text, onYes, yes){ openM('confirm', {title, text, onYes, yes}); }
A.openFile = async el => { const p = el.dataset.p; if(!p) return; const w = window.open('', '_blank'); try{ const url = await KD.fileUrl(p); if(w) w.location = url; else location.href = url; }catch(e){ if(w) w.close(); toast('Datei konnte nicht geöffnet werden.'); } };
const preIds = el => el?.dataset?.ids ? el.dataset.ids.split(',').filter(Boolean) : (students().length===1?[students()[0].id]:[]);

/* Stunden */
A.newEntry = el => openM('entry', {date:today(), faecher:['Mathe'], studentIds:preIds(el), thema:'', inhalt:'', files:[], attendance:{}, hwOn:false, hwPer:false, hwText:'', hwTexts:{}, hwDue:addDays(today(),7), oldHw:[]});
A.editEntry = el => { const e = byId('entries', el.dataset.id); const hws = hwIdsOf(e).map(id=>byId('homework',id)).filter(Boolean);
  const per = hws.length>1 || (hws.length===1 && hws[0].studentIds.length===1 && (e.studentIds||[]).length>1);
  const texts = {}; if(per) hws.forEach(h=>texts[h.studentIds[0]] = h.text);
  openM('entry', {id:e.id, date:e.date, faecher:[...entryFaecher(e)], studentIds:[...(e.studentIds||[])], thema:e.thema, inhalt:e.inhalt||'', files:[...(e.files||[])], attendance:{...(e.attendance||{})}, hwOn:!!hws.length, hwPer:per, hwText:per?'':(hws[0]?.text||''), hwTexts:texts, hwDue:hws[0]?.due||addDays(e.date,7), oldHw:hws.map(h=>h.id), createdAt:e.createdAt}); };
A.saveEntry = async () => {
  const d = S.m.d;
  if(!d.thema.trim()) return toast('Bitte ein Thema eintragen.');
  if(!d.studentIds.length) return toast('Bitte mindestens einen Schüler auswählen.');
  const per = d.hwOn && d.hwPer && d.studentIds.length>1;
  if(d.hwOn && !per && !String(d.hwText||'').trim()) return toast('Bitte die Hausaufgabe beschreiben.');
  if(per){ const miss = d.studentIds.find(id=>!String((d.hwTexts||{})[id]||'').trim()); if(miss) return toast('Bitte die Aufgabe für '+byId('students',miss)?.name+' eintragen.'); }
  const id = d.id || uid(); const isNew = !d.id; const hwFach = d.faecher[0] || '';
  const old = (d.oldHw||[]).map(h=>byId('homework',h)).filter(Boolean);
  const want = !d.hwOn ? [] : per ? d.studentIds.map(sid=>({ids:[sid], text:d.hwTexts[sid].trim()})) : [{ids:d.studentIds, text:d.hwText.trim()}];
  const used = new Set(), hwIds = [];
  for(const w of want){ const reuse = old.find(h=>!used.has(h.id) && (per ? h.studentIds.length===1 && h.studentIds[0]===w.ids[0] : true)); const hid = reuse?.id || uid(); used.add(hid);
    if(!await save('homework', hid, {fach:hwFach, studentIds:w.ids, text:w.text, due:d.hwDue||addDays(d.date,7), files:reuse?.files||[], entryId:id, createdAt:reuse?.createdAt||Date.now()})) return;
    hwIds.push(hid); await notifyMany(w.ids.filter(x=>!(reuse?.studentIds||[]).includes(x)), 'Neue Hausaufgabe bis '+fmt(d.hwDue), 'aufgaben', 'hw'); }
  for(const h of old) if(!used.has(h.id)) await del('homework', h.id);
  const att = {}; d.studentIds.forEach(sid=>att[sid] = d.attendance?.[sid]||'da');
  if(!await save('entries', id, {date:d.date||today(), fach:d.faecher[0]||'', faecher:d.faecher, studentIds:d.studentIds, thema:d.thema.trim(), inhalt:d.inhalt.trim(), files:(d.files||[]).map(f=>({...f, name:String(f.name||'').trim()||'Datei'})), attendance:att, hwIds, createdAt:d.createdAt||Date.now()})) return;
  await syncNames(Object.fromEntries((d.files||[]).map(f=>[f.path, String(f.name||'').trim()||'Datei'])));
  if(isNew) await notifyMany(d.studentIds, 'Neue Stunde in der Kursmappe: '+d.thema.trim(), 'kursmappe', 'entry');
  closeM(); toast('Stunde gespeichert');
};
A.delEntry = () => { const d = S.m.d; ask('Stunde löschen?', 'Der Eintrag „'+d.thema+'“ wird gelöscht. Hausaufgaben bleiben erhalten.', async()=>{ if(await del('entries', d.id)) toast('Gelöscht'); }); };

/* Hausaufgaben */
A.newHw = el => openM('hw', {fach:'Mathe', studentIds:preIds(el), text:'', texts:{}, per:false, due:addDays(today(),7), files:[]});
A.newHwFor = el => openM('hw', {fach:byId('students',el.dataset.id)?.faecher?.[0]||'Mathe', studentIds:[el.dataset.id], text:'', texts:{}, per:false, due:addDays(today(),7), files:[]});
A.editHw = el => { const h = byId('homework', el.dataset.id); openM('hw', {id:h.id, fach:h.fach, studentIds:[...h.studentIds], text:h.text, due:h.due, files:[...(h.files||[])], entryId:h.entryId||null, createdAt:h.createdAt}); };
A.saveHw = async () => { const d = S.m.d;
  if(!d.studentIds.length) return toast('Bitte mindestens einen Schüler auswählen.');
  if(d.per && !d.id && d.studentIds.length>1){ const miss = d.studentIds.find(id=>!String((d.texts||{})[id]||'').trim()); if(miss) return toast('Bitte die Aufgabe für '+byId('students',miss)?.name+' eintragen.');
    for(const sid of d.studentIds){ if(!await save('homework', uid(), {fach:d.fach, studentIds:[sid], text:d.texts[sid].trim(), due:d.due||addDays(today(),7), files:d.files||[], entryId:null, createdAt:Date.now()})) return; await notify(sid, 'Neue Hausaufgabe bis '+fmt(d.due), 'aufgaben', 'hw'); }
    closeM(); toast(d.studentIds.length+' Hausaufgaben verteilt'); return; }
  if(!String(d.text||'').trim()) return toast('Bitte die Aufgabe beschreiben.');
  const id = d.id || uid(); const prev = d.id ? byId('homework', d.id) : null;
  if(!await save('homework', id, {fach:d.fach, studentIds:d.studentIds, text:d.text.trim(), due:d.due||addDays(today(),7), files:(d.files||[]).map(f=>({...f, name:String(f.name||'').trim()||'Datei'})), entryId:d.entryId||null, createdAt:d.createdAt||Date.now()})) return;
  await syncNames(Object.fromEntries((d.files||[]).map(f=>[f.path, String(f.name||'').trim()||'Datei'])));
  await notifyMany(d.studentIds.filter(x=>!(prev?.studentIds||[]).includes(x)), 'Neue Hausaufgabe bis '+fmt(d.due), 'aufgaben', 'hw');
  closeM(); toast('Hausaufgabe gespeichert'); };
A.delHw = () => { const d = S.m.d; ask('Hausaufgabe löschen?', 'Die Hausaufgabe und alle Häkchen dazu werden gelöscht.', async()=>{ if(await del('homework', d.id)){ for(const sid of d.studentIds) await del('hwstatus', d.id+'__'+sid); const e = data('entries').find(x=>hwIdsOf(x).includes(d.id)); if(e){ const c = strip(e); delete c.hwId; c.hwIds = hwIdsOf(e).filter(x=>x!==d.id); await save('entries', e.id, c); } toast('Gelöscht'); } }); };
A.toggleHw = async el => { const hid = el.dataset.id, sid = S.session.id; const st = stOf(hid,sid)||{}; const done = !st.done;
  if(await save('hwstatus', hid+'__'+sid, {...strip(st), hwId:hid, studentId:sid, done, at:Date.now()}) && done){ toast('Erledigt – super!'); notify('teacher', me().name+' hat eine Hausaufgabe erledigt', 'aufgaben', 'hw'); } };
A.hwNote = el => { const st = stOf(el.dataset.id, S.session.id)||{}; openM('hwNote', {hid:el.dataset.id, note:st.note||''}); };
A.saveNote = async () => { const d = S.m.d, sid = S.session.id; const st = stOf(d.hid,sid)||{};
  if(await save('hwstatus', d.hid+'__'+sid, {...strip(st), hwId:d.hid, studentId:sid, done:!!st.done, at:st.at||Date.now(), note:d.note.trim()})){ if(d.note.trim()) notify('teacher', me().name+' fragt zur Hausaufgabe: „'+short(d.note,80)+'“', 'aufgaben', 'msg', {from:sid}); closeM(); toast('Frage gesendet'); } };
A.hwStudent = el => { const st = stOf(el.dataset.h, el.dataset.s)||{}; openM('hwStudent', {h:el.dataset.h, s:el.dataset.s, feedback:st.feedback||''}); };
A.teacherToggle = async () => { const d = S.m.d; const st = stOf(d.h,d.s)||{}; if(await save('hwstatus', d.h+'__'+d.s, {...strip(st), hwId:d.h, studentId:d.s, done:!st.done, at:Date.now()})) rerenderM(); };
A.saveFeedback = async () => { const d = S.m.d; const st = stOf(d.h,d.s)||{};
  if(await save('hwstatus', d.h+'__'+d.s, {...strip(st), hwId:d.h, studentId:d.s, done:!!st.done, at:st.at||Date.now(), feedback:d.feedback.trim(), fbAt:Date.now()})){ if(d.feedback.trim()) notify(d.s, 'Rückmeldung zu deiner Hausaufgabe: „'+short(d.feedback,80)+'“', 'aufgaben', 'msg'); closeM(); toast('Rückmeldung gesendet'); } };

/* Nachrichten */
A.newMsg = () => { S.ui.chat = isTeacher() ? null : 's:'+S.session.id; location.hash = 'nachrichten'; render(); };
A.newMsgTo = el => { closeM(); S.ui.chat = 's:'+el.dataset.id; if(S.route==='nachrichten') render(); else location.hash = 'nachrichten'; };
A.openChat = el => { S.ui.chat = el.dataset.id; S.chat.stick = true; S.chat.last = null; render(); };
A.closeChat = () => { S.ui.chat = null; render(); };
A.notifsSeen = async () => { try{ const cur = byId('notifread', myKey())||{}; await S.db.collection('notifread').doc(myKey()).set({...strip(cur), at:Date.now()}); }catch(e){} };
A.rmPend = el => { (S.chat.pend[S.ui.chat]||[]).splice(Number(el.dataset.i),1); render(); };
A.chatSend = async () => { const id = S.ui.chat; if(!id || S.chat.sending) return;
  const text = String(S.chat.draft[id]||'').trim(); const files = S.chat.pend[id]||[];
  if(!text && !files.length) return;
  S.chat.sending = true; render();
  const ok = await save('msgs', uid(), {chat:id, from:myId(), text, files, at:Date.now()});
  S.chat.sending = false;
  if(ok){ S.chat.draft[id] = ''; S.chat.pend[id] = []; S.chat.stick = true; S.chat.focus = true; }
  render(); };
A.delMsg = el => { const m = byId('msgs', el.dataset.id); if(!m) return; ask('Nachricht löschen?', 'Die Nachricht wird für alle gelöscht.', async()=>{ if(await del('msgs', m.id)) toast('Gelöscht'); }, 'Löschen'); };
async function chatUpload(files){
  const id = S.ui.chat; if(!id || !files?.length) return; S.chat.sending = true; render();
  for(const f of files){ if(f.size > 20*1024*1024){ toast(f.name+' ist größer als 20 MB.'); continue; } try{ (S.chat.pend[id] ||= []).push(await KD.uploadFile(f)); }catch(e){ toast('Upload fehlgeschlagen: '+f.name); } }
  S.chat.sending = false; render();
}

/* Schüler & Gruppen */
A.newStud = el => openM('stud', {name:'', klasse:'5', schule:'', groupId:el?.dataset?.g || '', faecher:['Mathe','Deutsch'], username:'', pw:genPw(), color:COLORS[students().length % COLORS.length]});
A.editStud = el => { const s = byId('students', el.dataset.id); openM('stud', {id:s.id, name:s.name, klasse:s.klasse, schule:s.schule||'', groupId:s.groupId||'', faecher:[...(s.faecher||[])], username:s.username||'', pw:'', color:s.color, createdAt:s.createdAt}); };
A.genPw = () => { S.m.d.pw = genPw(); rerenderM(); };
A.saveStud = async () => { const d = S.m.d;
  const name = d.name.trim(); if(!name) return toast('Bitte einen Namen eingeben.');
  const u = normUser(d.username || name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ß/g,'ss'));
  if(!/^[a-z0-9._-]{3,40}$/.test(u)) return toast('Benutzername: mind. 3 Zeichen, nur a–z, Zahlen, Punkt, Strich.');
  if(u===set().teacherUser || students().some(s=>s.id!==d.id && s.username===u)) return toast('Dieser Benutzername ist schon vergeben.');
  const old = d.id ? byId('students', d.id) : null;
  if((!d.id || d.pw) && String(d.pw||'').length<6) return toast('Das Passwort braucht mindestens 6 Zeichen.');
  let id = d.id;
  if(!id){ const r = await KD.manageUser({action:'create', username:u, password:d.pw}); if(r.error) return toast(r.error); id = r.uid; }
  else if(d.pw || old?.username!==u){ const r = await KD.manageUser({action:'update', uid:id, username: old?.username!==u ? u : '', password:d.pw||''}); if(r.error) return toast(r.error); }
  if(!await save('students', id, {name, username:u, klasse:d.klasse, schule:d.schule.trim(), groupId:d.groupId||'', faecher:d.faecher, color:d.color, createdAt:d.createdAt||Date.now()})) return;
  await syncGroups();
  if(d.pw) openM('creds', {name, username:u, pw:d.pw}); else { closeM(); toast('Gespeichert'); } };
A.copyCreds = async () => { const d = S.m.d; try{ await navigator.clipboard.writeText('Klecks – Zugang für '+d.name+'\nAdresse: '+location.href.split('#')[0]+'\nBenutzername: '+d.username+'\nPasswort: '+d.pw); toast('Kopiert'); }catch(e){ toast('Kopieren nicht möglich – bitte abschreiben.'); } };
A.delStud = () => { const d = S.m.d; ask(d.name+' löschen?', 'Profil, Zugang, Lernfortschritt und Klausuren werden gelöscht. Einträge in der Kursmappe bleiben.', async()=>{ const r = await KD.manageUser({action:'delete', uid:d.id}); if(r.error) return toast(r.error); await del('students', d.id); await del('progress', d.id); for(const e of examsFor(d.id)) await del('exams', e.id); toast('Gelöscht'); }); };
A.studDetail = el => { S.ui.q=''; openM('studDetail', {id:el.dataset.id}); };
A.newGroup = () => openM('group', {name:'', note:'', color:COLORS[groups().length % COLORS.length], members:[]});
A.editGroup = el => { const g = byId('groups', el.dataset.id); openM('group', {id:g.id, name:g.name, note:g.note||'', color:g.color, members:students().filter(s=>s.groupId===g.id).map(s=>s.id), createdAt:g.createdAt}); };
A.saveGroup = async () => { const d = S.m.d; if(!d.name.trim()) return toast('Bitte einen Namen eingeben.'); const id = d.id || uid();
  if(!await save('groups', id, {name:d.name.trim(), note:(d.note||'').trim(), color:d.color, memberIds:d.members, createdAt:d.createdAt||Date.now()})) return;
  for(const s of students()){ const inG = d.members.includes(s.id); if(inG && s.groupId!==id) await save('students', s.id, {...strip(s), groupId:id}); if(!inG && s.groupId===id) await save('students', s.id, {...strip(s), groupId:''}); }
  closeM(); toast(d.id?'Gespeichert':'Gruppe angelegt'); };
A.delGroup = () => { const d = S.m.d; ask('Gruppe „'+d.name+'“ löschen?', 'Die Schüler bleiben erhalten.', async()=>{ if(await del('groups', d.id)){ for(const s of students().filter(x=>x.groupId===d.id)) await save('students', s.id, {...strip(s), groupId:''}); toast('Gelöscht'); } }); };

/* Klausuren */
A.newExam = el => { const sid = el?.dataset?.sid || (isTeacher() ? (students()[0]?.id||'') : S.session.id); openM('exam', {studentId:sid, date:addDays(today(),14), fach:(byId('students',sid)?.faecher||[])[0]||'Mathe', themen:''}); };
A.examOpen = el => { const e = byId('exams', el.dataset.id); if(e) openM('exam', {...e}); };
A.saveExam = async () => { const d = S.m.d; if(!d.studentId) return toast('Bitte einen Schüler auswählen.'); if(!d.date) return toast('Bitte ein Datum wählen.');
  const id = d.id || uid(); const isNew = !d.id; const prevNote = byId('exams',id)?.note;
  const body = {studentId:d.studentId, date:d.date, fach:d.fach, themen:(d.themen||'').trim(), note:d.note||'', kommentar:(d.kommentar||'').trim(), createdBy:d.createdBy||(isTeacher()?'teacher':'student'), createdAt:d.createdAt||Date.now()};
  if(!await save('exams', id, body)) return; const s = byId('students', d.studentId);
  if(isTeacher()){ if(isNew) await notify(d.studentId, d.fach+'-Klausur am '+fmt(d.date)+' eingetragen', 'klausuren', 'exam'); }
  else if(isNew) await notify('teacher', s.name+' hat eine '+d.fach+'-Klausur am '+fmt(d.date)+' eingetragen'+(body.themen?' – '+short(body.themen,60):''), 'klausuren', 'exam');
  else if(body.note && body.note!==prevNote) await notify('teacher', s.name+' hat die Note '+body.note+' eingetragen', 'klausuren', 'exam');
  closeM(); toast(isNew?'Klausur eingetragen – viel Erfolg beim Üben!':'Gespeichert'); };
A.delExam = () => { const d = S.m.d; ask('Klausur löschen?', 'Die Klausur am '+fmt(d.date)+' wird gelöscht.', async()=>{ if(await del('exams', d.id)) toast('Gelöscht'); }); };

/* Termine */
A.newTermin = el => openM('termin', {date:addDays(today(),1), time:'16:00', studentIds:preIds(el), fach:'Alle', note:'', weekly:false});
A.editTermin = el => { const x = byId('termine', el.dataset.id); openM('termin', {...x, studentIds:[...(x.studentIds||[])]}); };
A.saveTermin = async () => { const d = S.m.d; if(!d.studentIds.length) return toast('Bitte mindestens einen Schüler auswählen.');
  const isNew = !d.id; const n = isNew && d.weekly ? 4 : 1;
  for(let i=0;i<n;i++){ const id = i===0 && d.id ? d.id : uid(); if(!await save('termine', id, {date:addDays(d.date,i*7), time:d.time||'', studentIds:d.studentIds, fach:d.fach||'Alle', note:(d.note||'').trim(), createdAt:d.createdAt||Date.now()})) return; }
  if(isNew) await notifyMany(d.studentIds, 'Nachhilfe am '+fmt(d.date)+(d.time?' um '+d.time+' Uhr':'')+(n>1?' (wöchentlich)':''), 'kalender', 'termin');
  closeM(); toast(n>1?'4 Termine eingetragen':'Termin gespeichert'); };
A.delTermin = () => { const d = S.m.d; ask('Termin löschen?', 'Der Termin am '+fmt(d.date)+' wird gelöscht.', async()=>{ if(await del('termine', d.id)) toast('Gelöscht'); }); };

/* Kalender */
A.calNav = el => { const b = S.ui.calMonth ? parse(S.ui.calMonth) : new Date(new Date().getFullYear(), new Date().getMonth(), 1); b.setMonth(b.getMonth()+Number(el.dataset.n)); S.ui.calMonth = ymd(b); render(); };
A.calDay = el => { S.ui.calDay = el.dataset.d; render(); };
A.calEv = el => { const k = el.dataset.k, l = el.dataset.l; if(k==='exam') return A.examOpen(el); if(k==='termin' && isTeacher()) return A.editTermin(el); if(l && l!=='termin' && l!=='exam') location.hash = l; };

/* Kurse */
A.openCourse = el => { closeM(); S.ui.q = ''; if(S.route!=='kurse'){ S.pendingCourse = el.dataset.id; location.hash = 'kurse'; } else { S.ui.course = el.dataset.id; render(); window.scrollTo(0,0); } };
A.closeCourse = () => { S.ui.course = null; render(); };
A.locked = () => toast('Schaffe zuerst das Blatt davor (mindestens 1 Stern).');
A.play = el => startLesson(S.ui.course, Number(el.dataset.i));
A.pStart = () => { S.p.phase = 'q'; renderP(); };
A.pSel = el => { if(S.p.phase!=='q') return; S.p.ans.sel = Number(el.dataset.i); renderP(); };
A.pTf = el => { if(S.p.phase!=='q') return; (S.p.ans.tf ||= {})[el.dataset.i] = el.dataset.v==='1'; renderP(); };
A.pSort = el => { if(S.p.phase!=='q') return; (S.p.ans.so ||= {})[el.dataset.i] = Number(el.dataset.v); renderP(); };
A.pOrd = el => { if(S.p.phase!=='q') return; const o = (S.p.ans.ord ||= []); const i = Number(el.dataset.i); const pos = o.indexOf(i); if(pos>=0) o.splice(pos,1); else o.push(i); renderP(); };
A.pOrdReset = () => { S.p.ans.ord = []; renderP(); };
A.pCheck = () => { if(canCheck()) checkAnswer(); };
A.pCont = () => pCont();
A.pRetry = () => startLesson(S.p.c.id, S.p.li);
A.pNext = () => startLesson(S.p.c.id, S.p.li+1);
A.pClose = () => { S.p = null; renderP(); render(); };
A.courseProgress = el => openM('courseProgress', {id:el.dataset.id});
const blankQ = () => ({type:'mc', q:'', options:['','','',''], answer:0, hint:''});
A.newCourse = () => openM('course', {title:'', desc:'', fach:'Mathe', klasse:'5', studentIds:[], lessons:[], draft:false, edit:null});
A.editCourse = el => { const c = byId('courses', el.dataset.id); openM('course', {...JSON.parse(JSON.stringify(c)), studentIds:[...(c.studentIds||[])], edit:null}); };
A.addL = () => { S.m.d.lessons.push({id:uid(), title:'', intro:'', questions:[blankQ()]}); S.m.d.edit = S.m.d.lessons.length-1; renderM(); };
A.editL = el => { S.m.d.edit = Number(el.dataset.i); renderM(); };
A.rmL = el => { S.m.d.lessons.splice(Number(el.dataset.i),1); rerenderM(); };
A.mvL = el => { const i = Number(el.dataset.i), j = i+Number(el.dataset.n); const L = S.m.d.lessons; if(j<0||j>=L.length) return; [L[i],L[j]] = [L[j],L[i]]; rerenderM(); };
A.addQ = () => { S.m.d.lessons[S.m.d.edit].questions.push(blankQ()); rerenderM(); const qs = document.querySelectorAll('.qed'); qs[qs.length-1]?.scrollIntoView({behavior:'smooth'}); };
A.rmQ = el => { S.m.d.lessons[S.m.d.edit].questions.splice(Number(el.dataset.i),1); rerenderM(); };
A.lessonDone = () => { S.m.d.edit = null; renderM(); };
A.saveCourse = async () => { const d = S.m.d; if(!d.title.trim()) return toast('Bitte einen Titel eingeben.');
  const lessons = d.lessons.map(l=>({...l, title:(l.title||'').trim()||'Arbeitsblatt', intro:(l.intro||'').trim(), test:!!l.test, questions:l.questions.map(q=>{
    const t = q.type||'mc';
    if(t==='mc') return {type:'mc', q:String(q.q||'').trim(), options:(q.options||[]).map(o=>String(o||'').trim()), answer:Number(q.answer||0), hint:(q.hint||'').trim()};
    if(t==='input') return {type:'input', q:String(q.q||'').trim(), answer:String(q.answer||'').trim(), hint:(q.hint||'').trim(), ...(q.cs?{cs:true}:{})};
    if(t==='gap') return {type:'gap', q:String(q.q||'').trim(), text:String(q.text||''), hint:(q.hint||'').trim(), ...(q.cs===false?{cs:false}:{})};
    if(t==='tf') return {type:'tf', q:String(q.q||'').trim(), items:q.tfText!=null?parseTf(q.tfText):(q.items||[]), hint:(q.hint||'').trim()};
    return q; }).filter(q=>q.q||q.text||q.items)}));
  const bad = lessons.flatMap(l=>l.questions).find(q=>q.type==='mc' ? !(q.options[q.answer]||'').trim() : q.type==='input' ? !q.answer : q.type==='gap' ? !gapParts(q.text).some(x=>x.ans) : q.type==='tf' ? !(q.items||[]).length : false);
  if(bad) return toast('Bei „'+short(bad.q||bad.text,30)+'“ fehlt die Lösung.');
  const id = d.id || uid(); const isNew = !d.id;
  if(!await save('courses', id, {title:d.title.trim(), desc:(d.desc||'').trim(), fach:d.fach, klasse:d.klasse, studentIds:d.studentIds||[], lessons, draft:!!d.draft, order:d.order||null, ver:d.ver||null, builtin:!!d.builtin, edited:!!d.builtin, createdAt:d.createdAt||Date.now()})) return;
  if(isNew && !d.draft){ const targets = students().filter(s=>d.studentIds?.length ? d.studentIds.includes(s.id) : (d.klasse==='alle'||d.klasse===s.klasse)).map(s=>s.id); await notifyMany(targets, 'Neuer Kurs: '+d.title.trim(), 'kurse', 'course'); }
  closeM(); toast('Kurs gespeichert'); };
A.delCourse = () => { const d = S.m.d; ask('Kurs löschen?', '„'+d.title+'“ wird mit allen Arbeitsblättern gelöscht.', async()=>{ if(await del('courses', d.id)){ if(BUILTIN.some(b=>b.id===d.id)) await save('settings','main',{...strip(set()), removedKurse:[...new Set([...(set().removedKurse||[]), d.id])]}); S.ui.course = null; render(); toast('Gelöscht'); } }); };

document.addEventListener('click', ev => {
  const same = ev.target.closest('a[href^="#"]');
  if(same && same.getAttribute('href')===location.hash && !same.dataset.a){ S.ui.course = null; S.ui.q=''; render(); window.scrollTo(0,0); return; }
  if(S.ui.q && !ev.target.closest('.search')){ S.ui.q = ''; if(!ev.target.closest('[data-a]')) { render(); return; } }
  const el = ev.target.closest('[data-a]'); if(!el) return;
  const a = el.dataset.a; if(a==='upload' || a==='studFilter' || a==='chatUpload') return;
  if(!A[a]) return;
  if(el.tagName==='BUTTON' || (el.tagName==='A' && el.getAttribute('href')==='#')) ev.preventDefault();
  if(a==='closeM' && el.tagName==='A'){ closeM(); return; }
  if(a==='clearQ'){ S.ui.q=''; return; }
  A[a](el, ev);
});

boot();
}

/* Klecks – Datenschicht: bildet collection/doc auf die Supabase-Tabelle "docs" ab.
   Wer was lesen darf, regelt die Datenbank (Row Level Security) über "readers"/"public_read". */
(function(){
  const cfg = window.KLECKS_CONFIG;
  const sb = window.supabase.createClient(cfg.url, cfg.key, { auth: { persistSession: true, storageKey: 'klecks-auth', lock: async (name, timeout, fn) => await fn() } });

  // Wer darf ein Dokument lesen? (Lehrkraft darf immer alles)
  function access(col, id, d){
    const arr = v => (Array.isArray(v) ? v : []).filter(x => /^[0-9a-f-]{36}$/i.test(String(x)));
    switch(col){
      case 'students': return { readers: arr([id]), public_read: false };
      case 'homework': case 'entries': case 'termine': return { readers: arr(d.studentIds), public_read: false };
      case 'exams': case 'hwstatus': return { readers: arr([d.studentId]), public_read: false };
      case 'progress': return { readers: arr([id]), public_read: false };
      case 'notifs': return { readers: d.to === 'teacher' ? [] : arr([d.to]), public_read: false };
      case 'notifread': return { readers: id === 'teacher' ? [] : arr([id]), public_read: false };
      case 'courses': return (d.studentIds && d.studentIds.length) ? { readers: arr(d.studentIds), public_read: false } : { readers: [], public_read: true };
      case 'settings': return { readers: [], public_read: true };
      case 'groups': return { readers: arr(d.memberIds), public_read: false };
      case 'msgs': return { readers: [], public_read: false }; // Server setzt die Leser
      default: return { readers: [], public_read: false }; // groups u. a.: nur Lehrkraft
    }
  }
  const err = (e) => { const x = new Error(e?.message || 'Fehler'); x.code = /row-level|permission|policy/i.test(e?.message||'') ? 'invalid_argument' : (e?.code || 'unavailable'); return x; };

  const listeners = {};      // col -> [fn]
  const cache = {};          // col -> rows
  let channel = null, poll = null, timers = {};

  async function fetchCol(col){
    const { data, error } = await sb.from('docs').select('id,data').eq('col', col).limit(5000);
    if(error) throw err(error);
    cache[col] = data || [];
    emit(col);
  }
  function emit(col){
    const docs = (cache[col]||[]).map(r => ({ id:r.id, exists:true, data:()=>r.data, metadata:{fromCache:false, hasPendingWrites:false} }));
    const snap = { docs, size:docs.length, empty:!docs.length, metadata:{fromCache:false, hasPendingWrites:false}, docChanges:()=>[] };
    (listeners[col]||[]).forEach(l => { try{ l.next(snap); }catch(e){ console.error(e); } });
  }
  function refetchSoon(col){ clearTimeout(timers[col]); timers[col] = setTimeout(()=>fetchCol(col).catch(()=>{}), 150); }

  function ensureLive(){
    if(channel) return;
    channel = sb.channel('docs-live').on('postgres_changes', { event:'*', schema:'public', table:'docs' }, p => {
      const col = (p.new && p.new.col) || (p.old && p.old.col); if(col && listeners[col]) refetchSoon(col); else Object.keys(listeners).forEach(refetchSoon);
    }).subscribe();
    poll = setInterval(()=>Object.keys(listeners).forEach(c=>fetchCol(c).catch(()=>{})), 30000);
  }

  const db = {
    collection(col){
      return {
        path: col,
        doc(id){ id = id || (Date.now().toString(36)+Math.random().toString(36).slice(2,7));
          return {
            id, path: col+'/'+id,
            async get(){ const { data, error } = await sb.from('docs').select('data').eq('col',col).eq('id',id).maybeSingle(); if(error) throw err(error); return { id, exists:!!data, data:()=>data?.data }; },
            async set(body){
              const a = access(col, id, body);
              const { error } = await sb.from('docs').upsert({ col, id, data: body, readers: a.readers, public_read: a.public_read }, { onConflict:'col,id' });
              if(error) throw err(error);
              const rows = (cache[col] ||= []); const i = rows.findIndex(r=>r.id===id); if(i>=0) rows[i] = {id, data:body}; else rows.push({id, data:body}); emit(col);
            },
            async delete(){ const { error } = await sb.from('docs').delete().eq('col',col).eq('id',id); if(error) throw err(error); cache[col] = (cache[col]||[]).filter(r=>r.id!==id); emit(col); }
          };
        },
        onSnapshot(next, error){ (listeners[col] ||= []).push({next, error}); ensureLive(); fetchCol(col).catch(e => error && error(e)); return () => { listeners[col] = (listeners[col]||[]).filter(l=>l.next!==next); }; }
      };
    }
  };

  function reset(){ Object.keys(listeners).forEach(k=>delete listeners[k]); Object.keys(cache).forEach(k=>delete cache[k]); if(channel){ sb.removeChannel(channel); channel = null; } clearInterval(poll); }

  async function signIn(username, password){
    const { data, error } = await sb.auth.signInWithPassword({ email: username + cfg.emailDomain, password });
    if(error) return { error: /invalid|credentials/i.test(error.message) ? 'Benutzername oder Passwort ist falsch.' : 'Anmeldung gerade nicht möglich. Bitte später nochmal versuchen.' };
    return { user: data.user };
  }
  const within = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
  async function whoami(){ try{ return await within(whoamiInner(), 8000); }catch(e){ try{ localStorage.removeItem('klecks-auth'); }catch(_){} return null; } }
  async function whoamiInner(){
    const { data } = await sb.auth.getSession(); const u = data?.session?.user; if(!u) return null;
    const { data: r } = await sb.from('roles').select('role').eq('uid', u.id).maybeSingle();
    if(!r) return null;
    return { uid: u.id, role: r.role };
  }
  async function signOut(){ reset(); await sb.auth.signOut(); }
  async function changeOwnPassword(pw){ const { error } = await sb.auth.updateUser({ password: pw }); if(error) throw err(error); }
  async function manageUser(body){
    const { data, error } = await sb.functions.invoke('manage-user', { body });
    if(error){ let msg = 'Aktion fehlgeschlagen.'; try{ const j = await error.context.json(); if(j?.error) msg = j.error; }catch(e){} return { error: msg }; }
    return data || {};
  }
  async function uploadFile(file){
    const safe = file.name.replace(/[^\w.\-]+/g,'_').slice(-80);
    const { data: ses } = await sb.auth.getSession(); const me = ses?.session?.user?.id;
    const { data: rr } = me ? await sb.from('roles').select('role').eq('uid', me).maybeSingle() : { data:null };
    const prefix = rr?.role === 'student' ? 'u-'+me+'/' : '';
    const path = prefix+Date.now().toString(36)+Math.random().toString(36).slice(2,6)+'/'+safe;
    const { error } = await sb.storage.from('files').upload(path, file, { contentType: file.type || undefined });
    if(error) throw err(error);
    return { path, name:file.name, type:file.type };
  }
  async function fileUrl(path){ const { data, error } = await sb.storage.from('files').createSignedUrl(path, 3600); if(error) throw err(error); return data.signedUrl; }

  window.KlecksData = { db, signIn, whoami, signOut, changeOwnPassword, manageUser, uploadFile, fileUrl, reset };
})();

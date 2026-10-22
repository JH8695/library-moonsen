import { useEffect, useState } from 'react';

const KEY = 'libcourse:notes:v1';

const clean = (o) => {
  const out = {};
  if (o && typeof o === 'object' && !Array.isArray(o)) {
    for (const [id, n] of Object.entries(o)) {
      if (typeof id !== 'string' || !n || typeof n !== 'object') continue;
      const text = typeof n.text === 'string' ? n.text.slice(0, 300) : '';
      if (text.trim()) out[id] = { text, ts: Number.isFinite(+n.ts) ? +n.ts : Date.now() };
    }
  }
  return out;
};

// 강좌별 메모 { 강좌id: { text, ts } }. 이 기기에 저장되고, 로그인하면 계정과도 동기화돼요.
export function useNotes() {
  const [notes, setNotesRaw] = useState(() => {
    try { return clean(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { return {}; }
  });
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(notes)); } catch { /* ignore */ }
  }, [notes]);

  const setNotes = (v) => setNotesRaw(clean(v));
  const save = (id, note) =>
    setNotesRaw((n) => {
      const next = { ...n };
      if (note?.text?.trim()) next[id] = { text: note.text.trim().slice(0, 300), ts: Date.now() };
      else delete next[id];
      return next;
    });
  return { notes, setNotes, save };
}

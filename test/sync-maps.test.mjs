// 찜·메모 동기화 규칙 검증: 가짜 클라우드 문서 1개를 두 기기(PC, 폰)가 공유
import { createSyncEngine, same } from '../src/lib/syncEngine.js';

function fakeCloud() {
  let data = null; const subs = new Set();
  const emit = () => { const snap = data ? JSON.parse(JSON.stringify(data)) : null; for (const f of subs) queueMicrotask(() => f(snap)); };
  const json = (v) => JSON.parse(JSON.stringify(v));
  return {
    peek: () => json(data),
    store: {
      async fetchServer() { return data ? json(data) : null; },
      async waitWrites() {},
      subscribe(cb) { subs.add(cb); queueMicrotask(() => cb(data ? json(data) : null)); return () => subs.delete(cb); },
      async hide(id, ts) { data = data || {}; data.hidden = { ...(data.hidden || {}), [id]: ts }; emit(); },
      async unhide(id) { if (!data?.hidden) return; const h = { ...data.hidden }; delete h[id]; data.hidden = h; emit(); },
      async putMap(sec, id, v) { data = data || {}; data[sec] = { ...(data[sec] || {}), [id]: json(v) }; emit(); },
      async removeMap(sec, id) { if (!data?.[sec]) return; const m = { ...data[sec] }; delete m[id]; data[sec] = m; emit(); },
      async putSection(sec, v) { data = data || {}; data[sec] = json(v); emit(); },
    },
  };
}

function device(cloud, init) {
  const state = { hidden: {}, favs: {}, notes: {}, prefs: { days: [] }, libs: {}, ...init };
  const mem = {}; const storage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; } };
  let engine;
  const local = {
    get: (s) => state[s],
    set: (s, v) => { state[s] = JSON.parse(JSON.stringify(v)); queueMicrotask(() => engine.localChanged(s, state[s])); },
  };
  engine = createSyncEngine({ store: cloud.store, local, storage, flagKey: 'k', onStatus: (s, e) => { if (s === 'error') console.log('  !! 오류', e); } });
  return { state, start: () => engine.start(), change: (s, v) => { state[s] = v; engine.localChanged(s, v); } };
}
const tick = () => new Promise((r) => setTimeout(r, 20));
let bad = 0;
const check = (name, ok) => { if (!ok) bad++; console.log(ok ? 'OK ' : 'XX ', name); };

const cloud = fakeCloud();
// 1) PC 가 먼저 로그인: 찜 a, 메모 a
const pc = device(cloud, { favs: { a: 1 }, notes: { a: { text: 'PC 메모', ts: 1 } } });
pc.start(); await tick();
check('PC 첫 로그인: 찜·메모가 클라우드로 올라감', same(cloud.peek().favs, { a: 1 }) && cloud.peek().notes.a.text === 'PC 메모');

// 2) 폰이 로그인: 찜 b, 메모 b → 합집합
const phone = device(cloud, { favs: { b: 2 }, notes: { b: { text: '폰 메모', ts: 2 } } });
phone.start(); await tick();
check('폰 첫 로그인: 찜 합집합 (a,b)', same(phone.state.favs, { a: 1, b: 2 }) && same(cloud.peek().favs, { a: 1, b: 2 }));
check('폰 첫 로그인: 메모 합집합 (a,b)', Object.keys(phone.state.notes).sort().join() === 'a,b' && Object.keys(cloud.peek().notes).sort().join() === 'a,b');
await tick();
check('PC 에도 폰의 찜·메모가 반영됨', same(pc.state.favs, { a: 1, b: 2 }) && Object.keys(pc.state.notes).sort().join() === 'a,b');

// 3) PC 에서 찜 a 해제 → 폰에서도 사라짐 (지운 것이 되살아나지 않음)
const f = { ...pc.state.favs }; delete f.a; pc.change('favs', f); await tick();
check('PC 찜 해제 → 폰 반영', same(phone.state.favs, { b: 2 }) && same(cloud.peek().favs, { b: 2 }));

// 4) 폰에서 메모 b 수정 → PC 반영
phone.change('notes', { ...phone.state.notes, b: { text: '폰 메모(수정)', ts: 3 } }); await tick();
check('폰 메모 수정 → PC 반영', pc.state.notes.b.text === '폰 메모(수정)');

// 5) 메모 삭제 → 양쪽에서 사라짐
const n = { ...pc.state.notes }; delete n.a; pc.change('notes', n); await tick();
check('PC 메모 삭제 → 폰·클라우드 반영', !('a' in phone.state.notes) && !('a' in cloud.peek().notes));

// 6) 두 기기가 동시에 서로 다른 강좌를 찜 → 둘 다 남음
pc.change('favs', { ...pc.state.favs, c: 5 }); phone.change('favs', { ...phone.state.favs, d: 6 }); await tick(); await tick();
check('동시에 서로 다른 강좌 찜 → 둘 다 남음', ['b', 'c', 'd'].every((k) => k in pc.state.favs && k in phone.state.favs && k in cloud.peek().favs));

// 7) 숨김은 이전처럼 동작
pc.change('hidden', { x: 9 }); await tick();
check('숨김도 그대로 동기화됨', same(phone.state.hidden, { x: 9 }));

// 8) 찜·메모를 안 쓰는 예전 앱(항목 없음)과도 충돌하지 않음
const legacy = (() => {
  const c2 = fakeCloud(); const st = { hidden: { z: 1 }, prefs: { days: [] }, libs: {} };
  const mem = {}; const storage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; } };
  let eng; const local = { get: (s) => st[s], set: (s, v) => { st[s] = v; } };
  eng = createSyncEngine({ store: c2.store, local, storage, flagKey: 'k' });
  return { start: () => eng.start(), c2 };
})();
legacy.start(); await tick();
check('찜·메모 항목이 없는 앱도 오류 없이 동기화', same(legacy.c2.peek().hidden, { z: 1 }) && !('favs' in legacy.c2.peek()));

console.log(bad ? `\n실패 ${bad}건` : '\n찜·메모 동기화 규칙 전부 통과');
process.exit(bad ? 1 : 0);

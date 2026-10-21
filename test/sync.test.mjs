// 가짜 클라우드(문서 1개)를 두 기기(PC, 폰)가 공유하는 상황을 흉내 내서 동기화 규칙을 검증
import { createSyncEngine, same } from '../src/lib/syncEngine.js';

function fakeCloud() {
  let data = null; const subs = new Set(); let writes = 0;
  const emit = () => { const snap = data ? JSON.parse(JSON.stringify(data)) : null; for (const f of subs) queueMicrotask(() => f(snap)); };
  return {
    writes: () => writes, peek: () => JSON.parse(JSON.stringify(data)),
    silentSet: (sec, v) => { data = data || {}; data[sec] = JSON.parse(JSON.stringify(v)); }, // 알림 없이 서버 값만 바뀜(알림을 놓친 상황)
    store: {
      async fetchServer() { return data ? JSON.parse(JSON.stringify(data)) : null; },
      async waitWrites() {},
      subscribe(cb) { subs.add(cb); queueMicrotask(() => cb(data ? JSON.parse(JSON.stringify(data)) : null)); return () => subs.delete(cb); },
      async hide(id, ts) { writes++; data = data || {}; data.hidden = { ...(data.hidden || {}), [id]: ts }; emit(); },
      async unhide(id) { writes++; if (!data?.hidden) return; const h = { ...data.hidden }; delete h[id]; data.hidden = h; emit(); },
      async putSection(sec, v) { writes++; data = data || {}; data[sec] = JSON.parse(JSON.stringify(v)); emit(); },
    },
  };
}

function device(name, cloud, init) {
  const state = { hidden: {}, prefs: { birthYear: 2017, gradeOverride: null, days: [] }, libs: {}, ...init };
  const mem = {}; const storage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; } };
  let engine;
  const local = {
    get: (s) => state[s],
    set: (s, v) => { state[s] = JSON.parse(JSON.stringify(v)); queueMicrotask(() => engine.localChanged(s, state[s])); }, // React effect 흉내
  };
  engine = createSyncEngine({ store: cloud.store, local, storage, flagKey: 'k', onStatus: (s, e) => { if (s === 'error') console.log('  !! 오류', name, e); } });
  return {
    state, start: () => engine.start(), refresh: () => engine.refresh(),
    change: (s, v) => { state[s] = v; engine.localChanged(s, v); }, // 사용자가 이 기기에서 값을 바꿈
  };
}
const tick = () => new Promise((r) => setTimeout(r, 20));
let bad = 0;
const check = (name, ok) => { if (!ok) bad++; console.log(ok ? 'OK ' : 'XX ', name); };

const cloud = fakeCloud();
// 1) PC 가 먼저 로그인 (숨김 a, 출생연도 2016 으로 바꿔둠)
const pc = device('PC', cloud, { hidden: { a: 1 }, prefs: { birthYear: 2016, gradeOverride: null, days: [6] } });
pc.start(); await tick();
check('PC 첫 로그인: 숨김·설정이 클라우드로 올라감', same(cloud.peek().hidden, { a: 1 }) && cloud.peek().prefs.birthYear === 2016);

// 2) 폰이 로그인 (숨김 b, 기본 설정) → 숨김은 합치고, 설정은 계정 것을 받음
const phone = device('폰', cloud, { hidden: { b: 2 } });
phone.start(); await tick();
check('폰 첫 로그인: 숨김 합집합 (a,b)', same(phone.state.hidden, { a: 1, b: 2 }) && same(cloud.peek().hidden, { a: 1, b: 2 }));
check('폰 첫 로그인: 출생연도·요일을 계정 것(2016, 토)으로 받음', phone.state.prefs.birthYear === 2016 && same(phone.state.prefs.days, [6]));
await tick();
check('PC 에도 폰이 숨긴 b 가 반영됨', same(pc.state.hidden, { a: 1, b: 2 }));

// 3) PC 에서 a 숨김 해제 → 폰에서도 사라짐
const w0 = cloud.writes();
const h = { ...pc.state.hidden }; delete h.a; pc.change('hidden', h); await tick();
check('PC 숨김 해제 → 폰 반영', same(phone.state.hidden, { b: 2 }) && same(cloud.peek().hidden, { b: 2 }));

// 4) 두 기기가 거의 동시에 서로 다른 강좌를 숨김 → 둘 다 남음
const pc2 = { ...pc.state.hidden, c: 3 }, ph2 = { ...phone.state.hidden, d: 4 };
pc.change('hidden', pc2); phone.change('hidden', ph2); await tick(); await tick();
check('동시에 숨겨도 서로 안 지워짐 (b,c,d)', same(cloud.peek().hidden, { b: 2, c: 3, d: 4 }) && same(pc.state.hidden, phone.state.hidden));

// 5) 폰에서 출생연도 변경 → PC 반영
phone.change('prefs', { ...phone.state.prefs, birthYear: 2015 }); await tick();
check('폰 설정 변경 → PC 반영', pc.state.prefs.birthYear === 2015);

// 6) 도서관 정보 수정(libs) 동기화
pc.change('libs', { jeongdaun: { driveMin: 15, stationName: '학동역', walkMin: 10, dong: '청담동' } }); await tick();
check('PC 도서관 정보 수정 → 폰 반영', phone.state.libs.jeongdaun?.stationName === '학동역');
phone.change('libs', {}); await tick();
check('폰에서 전체 초기화 → PC 도 초기화', same(pc.state.libs, {}));

// 6-2) 알림을 놓쳐도 "지금 동기화"를 누르면 서버의 최신 값을 받아옴
cloud.silentSet('prefs', { kids: [{ id: 'k1', name: '큰아이', birthYear: 2018 }], days: [] });
await tick();
check('알림을 놓친 상태에서는 아직 옛 값', pc.state.prefs.birthYear === 2015);
await pc.refresh(); await tick();
check('"지금 동기화" → 서버 최신 값(2018)을 받아옴', pc.state.prefs.kids?.[0]?.birthYear === 2018);

// 7) 핑퐁(무한 쓰기) 없음: 가만히 둔 동안 쓰기가 늘지 않음
const before = cloud.writes(); await tick(); await tick(); await tick();
check(`가만히 있으면 쓰기 없음 (${cloud.writes() - before}회)`, cloud.writes() === before);
console.log(bad ? `\n${bad}건 실패` : '\n동기화 규칙 전부 통과');

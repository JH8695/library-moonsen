// 이 기기의 상태 ↔ 클라우드 문서 동기화 규칙. UI·Firebase 와 분리되어 있어 단독으로 테스트할 수 있어요.
//
// 동기화하는 것 (섹션):
//   hidden : 숨긴 강좌  { 강좌id: 숨긴시각 }     → 강좌 하나씩 추가/삭제 (두 기기가 동시에 숨겨도 서로 안 지워짐)
//   prefs  : 출생연도·학년·요일 선택             → 통째로 마지막 저장이 이김
//   libs   : 도서관 정보 수정(차 시간·역·동)     → 통째로 마지막 저장이 이김
//
// 규칙
//   · 이 기기에서 계정으로 처음 로그인할 때만 합쳐요: 숨김은 합집합, prefs/libs 는 계정에 있으면 계정 것을 받아요.
//   · 그 뒤로는 계정(클라우드)이 기준이에요. 한쪽에서 바꾸면 다른 쪽이 따라가요.
//   · 로그아웃해도 이 기기의 값은 그대로 남아요.

const sortKeys = (v) => {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') {
    return Object.keys(v).sort().reduce((o, k) => { o[k] = sortKeys(v[k]); return o; }, {});
  }
  return v;
};
export const same = (a, b) => JSON.stringify(sortKeys(a ?? null)) === JSON.stringify(sortKeys(b ?? null));
const isEmpty = (v) => v == null || (typeof v === 'object' && Object.keys(v).length === 0);

export function createSyncEngine({ store, local, storage, flagKey, onStatus }) {
  let lastRemote = { hidden: {}, prefs: undefined, libs: undefined };
  let synced = false;
  let unsub = null;
  const fail = (e) => onStatus?.('error', e);
  const run = (p) => Promise.resolve(p).catch(fail);

  function firstSync(d) {
    const lh = local.get('hidden') || {};
    const rh = d.hidden || {};
    const merged = { ...lh, ...rh };
    if (!same(merged, lh)) local.set('hidden', merged);
    for (const id of Object.keys(lh)) if (!(id in rh)) run(store.hide(id, lh[id]));
    for (const sec of ['prefs', 'libs']) {
      if (d[sec] !== undefined) local.set(sec, d[sec]);
      else if (!isEmpty(local.get(sec))) run(store.putSection(sec, local.get(sec)));
    }
    storage.setItem(flagKey, '1');
  }

  function applyRemote(d) {
    const rh = d.hidden || {};
    if (!same(rh, local.get('hidden') || {})) local.set('hidden', rh);
    for (const sec of ['prefs', 'libs']) {
      if (d[sec] !== undefined && !same(d[sec], local.get(sec))) local.set(sec, d[sec]);
    }
  }

  function onRemote(data) {
    const d = data || {};
    try {
      if (!storage.getItem(flagKey)) firstSync(d);
      else applyRemote(d);
    } catch (e) { fail(e); return; }
    lastRemote = { hidden: { ...(d.hidden || {}) }, prefs: d.prefs, libs: d.libs };
    synced = true;
    onStatus?.('synced');
  }

  function localChanged(sec, value) {
    if (!synced) return;
    if (sec === 'hidden') {
      const cur = value || {};
      const rem = lastRemote.hidden || {};
      for (const id of Object.keys(cur)) if (!(id in rem)) run(store.hide(id, cur[id]));
      for (const id of Object.keys(rem)) if (!(id in cur)) run(store.unhide(id));
    } else if (!same(value, lastRemote[sec])) {
      if (lastRemote[sec] === undefined && isEmpty(value)) return; // 비어 있는 값을 굳이 만들지 않음
      run(store.putSection(sec, value));
    }
  }

  // "지금 동기화": 아직 못 올린 변경을 올리고, 서버에서 최신 값을 직접 받아 다시 맞춤
  async function refresh() {
    if (!synced || !store.fetchServer) return;
    try {
      onStatus?.('connecting');
      for (const sec of ['hidden', 'prefs', 'libs']) localChanged(sec, local.get(sec));
      await store.waitWrites?.(); // 방금 올린 변경이 서버에 반영될 때까지 기다린 뒤 읽기 (옛 값으로 덮어쓰지 않도록)
      onRemote(await store.fetchServer());
    } catch (e) { fail(e); }
  }

  return {
    refresh,
    start() {
      unsub = store.subscribe(onRemote, fail);
      return () => { synced = false; unsub?.(); };
    },
    // 이 기기에서 값이 바뀔 때마다 호출 (React 의 effect 에서)
    localChanged,
  };
}

import { useEffect, useRef, useState } from 'react';
import { cloudConfigured, watchAuth, signInGoogle, signOutUser, createStore, friendlyError } from './cloud';
import { createSyncEngine } from './syncEngine';

/**
 * 로그인 + 동기화 연결.
 * local = { hidden: [값, 설정함수], prefs: [...], libs: [...] }  (각각 이 기기의 상태)
 * 반환: { configured, user, status, error, signIn, signOut }
 *   status: off(설정 없음) | connecting | signedOut | synced | error
 */
export function useCloudSync(local) {
  const configured = cloudConfigured();
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(configured ? 'connecting' : 'off');
  const [error, setError] = useState('');
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const latest = useRef(local);
  latest.current = local;
  const engineRef = useRef(null);

  // 로그인 상태 감시
  useEffect(() => {
    if (!configured) return undefined;
    let dead = false;
    let off = () => {};
    watchAuth(
      (u) => {
        if (dead) return;
        setUser(u);
        setStatus(u ? 'connecting' : 'signedOut');
      },
      (e) => { if (!dead) { setStatus('error'); setError(friendlyError(e)); } },
    )
      .then((f) => { if (dead) f(); else off = f; })
      .catch((e) => { if (!dead) { setStatus('error'); setError(friendlyError(e)); } });
    return () => { dead = true; off(); };
  }, [configured]);

  // 로그인되면 동기화 시작
  useEffect(() => {
    if (!user) return undefined;
    let dead = false;
    let stop = () => {};
    (async () => {
      try {
        const store = await createStore(user.uid);
        if (dead) return;
        const engine = createSyncEngine({
          store,
          storage: window.localStorage,
          flagKey: `libcourse:cloud-synced:${user.uid}`,
          local: {
            get: (sec) => latest.current[sec][0],
            set: (sec, v) => latest.current[sec][1](v),
          },
          onStatus: (s, e) => {
            if (dead) return;
            setStatus(s);
            setError(s === 'error' ? friendlyError(e) : '');
            if (s === 'synced') setLastSyncedAt(new Date());
          },
        });
        engineRef.current = engine;
        stop = engine.start();
      } catch (e) {
        if (!dead) { setStatus('error'); setError(friendlyError(e)); }
      }
    })();
    return () => { dead = true; stop(); engineRef.current = null; };
  }, [user?.uid]);

  // 이 기기에서 값이 바뀌면 엔진에 알림
  const h = local.hidden[0];
  const p = local.prefs[0];
  const l = local.libs[0];
  useEffect(() => { engineRef.current?.localChanged('hidden', h); }, [h]);
  useEffect(() => { engineRef.current?.localChanged('prefs', p); }, [p]);
  useEffect(() => { engineRef.current?.localChanged('libs', l); }, [l]);

  return {
    configured,
    user,
    status,
    error,
    lastSyncedAt,
    syncNow: () => engineRef.current?.refresh(),
    signIn: () => signInGoogle().catch((e) => { setStatus('error'); setError(friendlyError(e)); }),
    signOut: () => signOutUser().catch((e) => setError(friendlyError(e))),
  };
}

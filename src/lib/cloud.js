// Firebase(Auth + Firestore) 연결부. 설정이 없으면 아무것도 불러오지 않아요.
// Firebase 코드는 로그인 기능이 켜져 있을 때만 따로 내려받아서(코드 분할) 앱 첫 화면이 느려지지 않게 해요.
import { firebaseConfig, isFirebaseConfigured } from '../firebaseConfig';

export const cloudConfigured = isFirebaseConfigured;

let modPromise = null;
function load() {
  if (!isFirebaseConfigured()) return Promise.reject(new Error('NOT_CONFIGURED'));
  if (!modPromise) {
    modPromise = (async () => {
      const [appM, authM, fsM] = await Promise.all([
        import('firebase/app'),
        import('firebase/auth'),
        import('firebase/firestore'),
      ]);
      const app = appM.initializeApp(firebaseConfig);
      const auth = authM.getAuth(app);
      let db;
      try {
        // 오프라인에서도 바꾼 내용을 잠시 보관했다가 연결되면 올려줌 (여러 탭 허용)
        db = fsM.initializeFirestore(app, {
          localCache: fsM.persistentLocalCache({ tabManager: fsM.persistentMultipleTabManager() }),
        });
      } catch {
        db = fsM.getFirestore(app);
      }
      return { authM, fsM, auth, db };
    })();
  }
  return modPromise;
}

// 사람이 읽을 수 있는 오류 문구
export function friendlyError(e) {
  const code = e?.code || '';
  if (code.includes('permission-denied'))
    return 'Firestore 보안 규칙에서 이 앱의 저장 경로(users/내uid/apps/library-courses)가 허용되지 않아요. 규칙에 추가해 주세요.';
  if (code.includes('unauthorized-domain'))
    return 'Firebase 콘솔 > Authentication > 설정 > 승인된 도메인에 jh8695.github.io 를 추가해 주세요.';
  if (code.includes('network') || code.includes('unavailable')) return '네트워크 연결을 확인해 주세요. 연결되면 자동으로 이어져요.';
  if (code.includes('operation-not-allowed')) return 'Firebase 콘솔에서 Google 로그인을 켜 주세요.';
  return e?.message || String(e);
}

const plainUser = (u) => (u ? { uid: u.uid, email: u.email, name: u.displayName, photo: u.photoURL } : null);

export async function watchAuth(onUser, onError) {
  const { authM, auth } = await load();
  authM.getRedirectResult(auth).catch((e) => onError?.(e)); // 리다이렉트 로그인에서 돌아온 경우
  return authM.onAuthStateChanged(auth, (u) => onUser(plainUser(u)), onError);
}

export async function signInGoogle() {
  const { authM, auth } = await load();
  const provider = new authM.GoogleAuthProvider();
  try {
    await authM.signInWithPopup(auth, provider);
  } catch (e) {
    const redirectable = ['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment', 'auth/web-storage-unsupported'];
    if (redirectable.includes(e.code)) { await authM.signInWithRedirect(auth, provider); return; }
    if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return;
    throw e;
  }
}

export async function signOutUser() {
  const { authM, auth } = await load();
  await authM.signOut(auth);
}

// 저장 위치: users/{uid}/apps/library-courses  (다른 앱의 데이터와 섞이지 않는 별도 문서)
export async function createStore(uid) {
  const { fsM, db } = await load();
  const ref = fsM.doc(db, 'users', uid, 'apps', 'library-courses');
  return {
    subscribe(onData, onError) {
      return fsM.onSnapshot(
        ref,
        (snap) => {
          if (snap.metadata.fromCache && !snap.exists()) return; // 서버 확인 전의 빈 캐시는 무시 (설정을 덮어쓰지 않도록)
          onData(snap.exists() ? snap.data() : null);
        },
        onError,
      );
    },
    async fetchServer() {
      const snap = await fsM.getDocFromServer(ref);
      return snap.exists() ? snap.data() : null;
    },
    waitWrites: () => fsM.waitForPendingWrites(db),
    async hide(id, ts) {
      try {
        await fsM.updateDoc(ref, new fsM.FieldPath('hidden', id), ts);
      } catch (e) {
        if (e.code === 'not-found') await fsM.setDoc(ref, { hidden: { [id]: ts } }, { merge: true });
        else throw e;
      }
    },
    async unhide(id) {
      try {
        await fsM.updateDoc(ref, new fsM.FieldPath('hidden', id), fsM.deleteField());
      } catch (e) {
        if (e.code !== 'not-found') throw e;
      }
    },
    async putSection(name, value) {
      await fsM.setDoc(ref, { [name]: value, updatedAt: fsM.serverTimestamp() }, { mergeFields: [name, 'updatedAt'] });
    },
  };
}

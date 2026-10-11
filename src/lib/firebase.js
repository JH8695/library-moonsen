// Firebase 와 통신하는 부분만 따로 모아 둔 어댑터. 로그인하기 전에는 아예 불러오지 않아요.
// 체험 앱과 같은 Firebase 프로젝트·같은 문서(users/{uid})를 쓰지만, 이 앱은 문서 안의 "library" 항목만 읽고 써요
// (mergeFields 로 그 항목만 바꿔서 체험 앱 데이터는 건드리지 않음). 아이 정보를 가져올 때만 체험 앱 항목(data.kids)을 읽어요.
import { firebaseConfig } from '../data/firebase';

let cached = null;

export function loadBackend() {
  if (globalThis.__LIBCOURSE_FAKE_BACKEND__) return Promise.resolve(globalThis.__LIBCOURSE_FAKE_BACKEND__);
  if (!cached) {
    cached = Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore')]).then(
      ([appMod, authMod, fsMod]) => {
        const app = appMod.initializeApp(firebaseConfig);
        const auth = authMod.getAuth(app);
        const db = fsMod.getFirestore(app);
        const docRef = (uid) => fsMod.doc(db, 'users', uid);
        const userOf = (u) => (u ? { uid: u.uid, email: u.email, name: u.displayName } : null);
        return {
          onAuth: (cb) => authMod.onAuthStateChanged(auth, (u) => cb(userOf(u))),
          signIn: () => authMod.signInWithPopup(auth, new authMod.GoogleAuthProvider()),
          signOut: () => authMod.signOut(auth),
          watch: (uid, cb, onError) =>
            fsMod.onSnapshot(docRef(uid), (snap) => cb(snap.exists() ? snap.data()?.library ?? null : null, snap.metadata.hasPendingWrites), onError),
          transact: (uid, fn) =>
            fsMod.runTransaction(db, async (tx) => {
              const ref = docRef(uid);
              const snap = await tx.get(ref);
              const res = fn(snap.exists() ? snap.data()?.library ?? null : null);
              if (res.write) {
                tx.set(ref, { library: { data: res.data, stamps: res.stamps }, libUpdatedAt: fsMod.serverTimestamp() }, { mergeFields: ['library', 'libUpdatedAt'] });
              }
              return res;
            }),
          // 체험 앱에 저장된 아이 정보 (읽기만 함)
          readSharedKids: async (uid) => {
            const snap = await fsMod.getDoc(docRef(uid));
            return snap.exists() ? snap.data()?.data?.kids ?? null : null;
          },
        };
      },
    );
  }
  return cached;
}

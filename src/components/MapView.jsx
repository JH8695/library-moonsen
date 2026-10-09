import { useEffect, useRef, useState } from 'react';
import { LIBRARIES, ORIGIN } from '../data/libraries';

const KEY = import.meta.env.VITE_KAKAO_JS_KEY;
const COORD_CACHE = 'libcourse:coords:v1';

let sdkPromise = null;
function loadKakao() {
  if (!KEY) return Promise.reject(new Error('NO_KEY'));
  if (window.kakao?.maps?.services) return Promise.resolve(window.kakao);
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(KEY)}&libraries=services&autoload=false`;
      s.onload = () => window.kakao.maps.load(() => resolve(window.kakao));
      s.onerror = () => { sdkPromise = null; reject(new Error('SDK_LOAD')); };
      document.head.appendChild(s);
    });
  }
  return sdkPromise;
}

const readCache = () => {
  try { return JSON.parse(localStorage.getItem(COORD_CACHE) || '{}'); } catch { return {}; }
};
const writeCache = (c) => {
  try { localStorage.setItem(COORD_CACHE, JSON.stringify(c)); } catch { /* ignore */ }
};

// 주소(또는 키워드) → 좌표. 한 번 찾으면 localStorage 에 저장해 다음부터는 요청하지 않음.
function search(kakao, item) {
  return new Promise((resolve) => {
    const { Status } = kakao.maps.services;
    if (item.address) {
      new kakao.maps.services.Geocoder().addressSearch(item.address, (r, s) =>
        resolve(s === Status.OK ? { lat: +r[0].y, lng: +r[0].x } : null));
    } else {
      new kakao.maps.services.Places().keywordSearch(item.query, (r, s) =>
        resolve(s === Status.OK ? { lat: +r[0].y, lng: +r[0].x } : null));
    }
  });
}

async function resolveAll(kakao) {
  const cache = readCache();
  const out = {};
  const targets = [
    { id: '__origin', address: ORIGIN.address },
    ...LIBRARIES.map((l) => ({ id: l.id, address: l.address, query: l.query, lat: l.lat, lng: l.lng })),
  ];
  let dirty = false;
  for (const t of targets) {
    if (t.lat != null && t.lng != null) { out[t.id] = { lat: t.lat, lng: t.lng }; continue; }
    if (cache[t.id]) { out[t.id] = cache[t.id]; continue; }
    const found = await search(kakao, t);
    if (found) { out[t.id] = found; cache[t.id] = found; dirty = true; }
  }
  if (dirty) writeCache(cache);
  return out;
}

export default function MapView({ counts, selectedId, onSelect }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const overlaysRef = useRef([]);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const fittedRef = useRef(false);
  const [coords, setCoords] = useState(null);
  const [error, setError] = useState(null);

  // 1) SDK 로드 + 지도 생성 + 좌표 확보
  useEffect(() => {
    let alive = true;
    loadKakao()
      .then(async (kakao) => {
        if (!alive) return;
        mapRef.current = new kakao.maps.Map(elRef.current, {
          center: new kakao.maps.LatLng(37.4965, 127.062),
          level: 7,
        });
        const c = await resolveAll(kakao);
        if (alive) setCoords(c);
      })
      .catch((e) => alive && setError(e.message));
    return () => { alive = false; };
  }, []);

  // 2) 마커 그리기 (counts / 선택 변경 때마다 다시 그림)
  useEffect(() => {
    const kakao = window.kakao;
    const map = mapRef.current;
    if (!coords || !map || !kakao) return;

    overlaysRef.current.forEach((o) => o.setMap(null));
    overlaysRef.current = [];
    const bounds = new kakao.maps.LatLngBounds();

    const add = (position, node, yAnchor = 1) => {
      const overlay = new kakao.maps.CustomOverlay({ position, content: node, yAnchor, zIndex: 1 });
      overlay.setMap(map);
      overlaysRef.current.push(overlay);
    };

    // 집(출발지)
    if (coords.__origin) {
      const p = new kakao.maps.LatLng(coords.__origin.lat, coords.__origin.lng);
      const home = document.createElement('div');
      home.className = 'pin pin-home';
      home.textContent = '집';
      home.title = ORIGIN.name;
      add(p, home);
      bounds.extend(p);
    }

    LIBRARIES.forEach((lib) => {
      const c = coords[lib.id];
      if (!c) return;
      const p = new kakao.maps.LatLng(c.lat, c.lng);
      const n = counts[lib.id] ?? 0;

      // 공식 DOM 이벤트 사용: 예전 코드의 overlay.a.onclick 은 SDK 내부(난독화) 속성이라 깨질 수 있음
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `pin ${n > 0 ? 'pin-on' : 'pin-off'}${selectedId === lib.id ? ' pin-sel' : ''}`;
      btn.setAttribute('aria-label', `${lib.name} 강좌 ${n}개`);
      const label = document.createElement('span');
      label.textContent = n > 0 ? String(n) : '·';
      btn.appendChild(label);
      const name = document.createElement('em');
      name.textContent = lib.name.replace('도서관', '');
      btn.appendChild(name);
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelectRef.current(selectedId === lib.id ? null : lib.id);
      });
      add(p, btn);
      bounds.extend(p);
    });

    if (!fittedRef.current) {
      map.setBounds(bounds);
      fittedRef.current = true;
    }
  }, [coords, counts, selectedId]);

  // 지도 영역 크기가 바뀌면(탭 전환 등) 다시 맞춤
  useEffect(() => {
    const kakao = window.kakao;
    if (!mapRef.current || !kakao) return;
    const ro = new ResizeObserver(() => mapRef.current?.relayout());
    ro.observe(elRef.current);
    return () => ro.disconnect();
  }, [coords]);

  if (error) {
    return (
      <div className="map-empty">
        <h3>{error === 'NO_KEY' ? '카카오맵 키가 필요해요' : '지도를 불러오지 못했어요'}</h3>
        {error === 'NO_KEY' ? (
          <p>
            프로젝트 폴더의 <code>.env.example</code> 을 <code>.env.local</code> 로 복사하고
            <code> VITE_KAKAO_JS_KEY</code> 에 JavaScript 키를 넣은 뒤 다시 실행하세요.
          </p>
        ) : (
          <p>카카오 개발자 콘솔의 Web 플랫폼에 현재 주소(도메인)가 등록되어 있는지 확인하세요.</p>
        )}
        <p className="muted">목록 탭은 지도 없이도 그대로 쓸 수 있어요.</p>
      </div>
    );
  }

  return (
    <div className="map-wrap">
      <div ref={elRef} className="map" />
      {!coords && <div className="map-loading">위치를 찾는 중… (처음 한 번만 걸려요)</div>}
    </div>
  );
}

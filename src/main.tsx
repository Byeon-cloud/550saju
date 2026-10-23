import './devQaRaf'; // 개발 서버 전용 점검 보조 (배포 빌드에서는 빠짐)
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { migrateStorageV1 } from '@/lib/storage';
import { isAppintosBuild } from '@/lib/env';
import { initPwa } from '@/lib/pwa';
import './styles/globals.css';
import './styles/motion.css'; // 2026-10-18 움직임 (먹과 종이)

// P0-1 · 민감 필드(이름·생년월일·시간) sessionStorage 이주 — 앱 부팅 1회만 실행.
// 기존 localStorage 잔존 데이터를 sessionStorage로 옮기고 원본 삭제.
migrateStorageV1();

// 친구 초대 (2026-10-18) — 라우터가 주소를 바꾸기 전에 초대 코드(inv)를 적어 둔다. 서버 기록은 App 부팅에서 (services/referral)
try {
  const inv = (new URLSearchParams(window.location.search).get('inv') || '').toUpperCase();
  if (/^[A-Z2-9]{6}$/.test(inv) && !localStorage.getItem('saju500:inv:landing')) {
    localStorage.setItem('saju500:inv:landing', JSON.stringify({ code: inv, ts: Date.now(), path: window.location.pathname }));
  }
} catch { /* 저장소를 못 쓰면 초대 기록 없이 */ }

// 앱인토스 빌드 또는 환경 — 홈 화면 추가 태그 제거 (이미 앱 안 → 설치 prompt 차단).
//   앱 빌드 index.html 에서는 vite.config.ts stripWebOnlyHtml 이 먼저 걷어낸다. 여기는 웹 번들을 토스 안에서 열었을 때의 두 번째 겹.
if (isAppintosBuild) {
  document.querySelectorAll('link[rel="manifest"], link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"], meta[name^="apple-mobile-web-app-"]')
    .forEach((el) => el.parentNode?.removeChild(el));
}

// 2026-10-23 웹 홈 화면 추가(PWA) — 설치 창 잡기, 방문 날짜, 홈 화면 앱 열림 기록. 웹 빌드만 (App.tsx 는 건드리지 않는다)
if (import.meta.env.VITE_BUILD_TARGET !== 'appintos' && !isAppintosBuild) initPwa();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

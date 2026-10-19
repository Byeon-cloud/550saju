import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

/**
 * 웹 로그인 도메인 (2026-10-19)
 *   authDomain 이 사이트 주소(saju500.app)와 다르면, 요즘 브라우저(크롬 115+, 사파리 16.1+)는 리다이렉트 로그인 결과를
 *   돌려주지 못한다(다른 도메인 저장소 차단). 그래서 모바일도 팝업으로 로그인한다(authService).
 *   VITE_AUTH_SELF_HOSTS 에 사이트 주소를 적으면 그 주소를 authDomain 으로 쓴다 — 단 각 로그인(구글, 네이버, 카카오) 콘솔에
 *   https://<주소>/__/auth/handler 를 리다이렉트 주소로 먼저 넣어야 한다(10-19 확인: 카카오만 등록돼 있음).
 *   앱 번들은 토스 로그인(커스텀 토큰)이라 상관없고, 그대로 둔다.
 */
const SELF_AUTH_HOSTS = String(import.meta.env.VITE_AUTH_SELF_HOSTS || '').split(',').map((s) => s.trim()).filter(Boolean);
const selfAuthHost = import.meta.env.VITE_BUILD_TARGET !== 'appintos' && typeof window !== 'undefined'
  && SELF_AUTH_HOSTS.includes(window.location.hostname) ? window.location.hostname : '';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: selfAuthHost || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/** 로그인 도메인이 지금 사이트와 같은가 — 같을 때만 모바일 리다이렉트 로그인이 돌아온다 */
export const authDomainIsSelf = !!selfAuthHost;

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

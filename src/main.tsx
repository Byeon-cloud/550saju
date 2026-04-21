import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { migrateStorageV1 } from '@/lib/storage';
import './styles/globals.css';

// P0-1 · 민감 필드(이름·생년월일·시간) sessionStorage 이주 — 앱 부팅 1회만 실행.
// 기존 localStorage 잔존 데이터를 sessionStorage로 옮기고 원본 삭제.
migrateStorageV1();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

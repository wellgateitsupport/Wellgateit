import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/global.css';
import './styles/theme-modern.css'; // ธีมโมเดิร์น (shadcn-style) — ลบบรรทัดนี้ = กลับหน้าตาเดิม
import { ErrorBoundary } from './shell/ErrorBoundary.jsx';
import { App } from './shell/app.jsx';

// หมายเหตุ: ไม่ใช้ StrictMode โดยตั้งใจ — ไฟล์ต้นฉบับ mount ตรงๆ
// StrictMode จะ double-invoke effects ใน dev ทำให้พฤติกรรมเพี้ยนจากต้นฉบับ
ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

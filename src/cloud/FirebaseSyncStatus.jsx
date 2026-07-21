import React from 'react';
import { getFbStatus, FIREBASE_CONFIG } from './firebase.js';

// แสดงแทน CloudSyncSettings (UI ตั้งค่า bin sync เดิม) เมื่อแอพ build มาพร้อม Firebase
// — การตั้งค่าจริงอยู่ที่ env/GitHub Secrets ผู้ใช้ทั่วไปไม่ต้องทำอะไรเลย
const FirebaseSyncStatus = () => {
  const [status, setStatus] = React.useState(getFbStatus);
  React.useEffect(() => {
    const h = () => setStatus({ ...getFbStatus() });
    window.addEventListener('fd-fbsync-status', h);
    return () => window.removeEventListener('fd-fbsync-status', h);
  }, []);

  const dbHost = (() => {
    try { return new URL(FIREBASE_CONFIG.databaseURL).host; } catch (e) { return FIREBASE_CONFIG.databaseURL || '-'; }
  })();

  const StatusRow = ({ ok, label, detail }) => (
    <div className="row gap-8" style={{ padding: '6px 0' }}>
      <span className={`status ${ok ? 'status-done' : 'status-pending'}`}><span className="dot" /></span>
      <span className="text-sm">{label}</span>
      {detail && <span className="text-xs muted" style={{ marginLeft: 'auto' }}>{detail}</span>}
    </div>
  );

  return (
    <div className="col gap-16">
      <div className="card card-pad">
        <div className="row spread mb-8">
          <div>
            <div className="text-sm medium">Cloud Sync — Firebase Realtime Database</div>
            <div className="text-xs muted mt-2">ข้อมูลซิงค์ทุกเครื่องแบบ realtime อัตโนมัติ — ไม่ต้องตั้งค่าอะไรในหน้านี้</div>
          </div>
          <span className={`badge ${status.connected ? 'badge-green' : 'badge-amber'}`}>
            {status.connected ? 'เชื่อมต่อแล้ว' : 'กำลังเชื่อมต่อ...'}
          </span>
        </div>

        <StatusRow ok={status.authReady} label="ลงชื่อเข้าระบบ Firebase" detail={status.authReady ? 'สำเร็จ' : 'รอ...'} />
        <StatusRow ok={status.hydrated} label="โหลดข้อมูลจาก cloud" detail={status.hydrated ? 'ครบทุกชุด' : 'รอ...'} />
        <StatusRow
          ok={Boolean(status.lastPushAt)}
          label="ส่งข้อมูลขึ้น cloud ล่าสุด"
          detail={status.lastPushAt ? new Date(status.lastPushAt).toLocaleTimeString('th-TH') : 'ยังไม่มีการเปลี่ยนแปลง'}
        />

        {status.error && (
          <div className="alert alert-error mt-8">
            <div className="text-sm">เกิดข้อผิดพลาด: <span className="mono text-xs">{status.error}</span> — ตรวจ Rules ใน Firebase console หรือการเชื่อมต่ออินเทอร์เน็ต</div>
          </div>
        )}

        <div className="text-xs muted mt-12" style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          โปรเจกต์: <span className="mono">{FIREBASE_CONFIG.projectId || '-'}</span> · ฐานข้อมูล: <span className="mono">{dbHost}</span>
        </div>
      </div>

      <div className="alert alert-info">
        <div className="text-sm">
          โหมดนี้เปิดจากการตั้งค่าตอน build (ผู้ดูแลระบบตั้งใน GitHub Secrets) — การซิงค์แบบแชร์ลิงก์/JSONBin
          ของเวอร์ชันก่อนถูกปิดโดยอัตโนมัติเพื่อไม่ให้ข้อมูลชนกัน · ข้อมูลสำรองในเครื่อง (localStorage)
          ยังทำงานตามปกติ ใช้งาน offline ได้และซิงค์กลับเมื่อออนไลน์
        </div>
      </div>
    </div>
  );
};

export { FirebaseSyncStatus };

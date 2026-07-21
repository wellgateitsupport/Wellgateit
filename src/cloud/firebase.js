/**
 * firebase.js — ขอบเขต Firebase SDK ทั้งหมดอยู่ไฟล์นี้ไฟล์เดียว
 *
 * โหมด Firebase เปิดเมื่อ build มี VITE_FIREBASE_DATABASE_URL + VITE_FIREBASE_API_KEY
 * (ค่าคงที่ตลอดอายุ build — ตัดสิน UI/loop ได้แบบ static)
 * ไม่มี env → ทุกฟังก์ชันเป็น no-op และแอพทำงานโหมด localStorage เหมือนไฟล์ต้นฉบับ
 */
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, connectAuthEmulator } from 'firebase/auth';
import { getDatabase, ref, onValue, update, connectDatabaseEmulator } from 'firebase/database';

const ENV = import.meta.env || {};

export const FIREBASE_CONFIG = {
  apiKey: ENV.VITE_FIREBASE_API_KEY,
  authDomain: ENV.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: ENV.VITE_FIREBASE_DATABASE_URL,
  projectId: ENV.VITE_FIREBASE_PROJECT_ID,
  appId: ENV.VITE_FIREBASE_APP_ID,
};

export const isFirebaseMode = () => Boolean(FIREBASE_CONFIG.databaseURL && FIREBASE_CONFIG.apiKey);

// root path ของข้อมูลทีมทั้งหมดใน RTDB
const ROOT_PATH = 'flowdesk';

// ── สถานะ sync สำหรับ UI (FirebaseSyncStatus) — event bus แบบเดียวกับ fd-*-changed เดิม ──
let fbStatus = {
  mode: isFirebaseMode(),
  authReady: false,
  connected: false,
  hydrated: false,
  lastPushAt: 0,
  lastEventAt: 0,
  error: null,
};
export const getFbStatus = () => fbStatus;
export const setFbStatus = (patch) => {
  fbStatus = { ...fbStatus, ...patch };
  try { window.dispatchEvent(new CustomEvent('fd-fbsync-status')); } catch (e) {}
};

let app = null;
let db = null;
let authPromise = null;

const init = () => {
  if (app) return;
  app = initializeApp(FIREBASE_CONFIG);
  db = getDatabase(app);
  const auth = getAuth(app);
  if (ENV.VITE_FIREBASE_EMULATOR === '1') {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectDatabaseEmulator(db, '127.0.0.1', 9000);
  }
};

// sign-in แบบ anonymous พร้อม retry backoff — คืน promise เดียวใช้ซ้ำ
export const ensureAuth = () => {
  if (!isFirebaseMode()) return Promise.resolve(null);
  if (authPromise) return authPromise;
  init();
  const auth = getAuth(app);
  authPromise = new Promise((resolve) => {
    let settled = false;
    onAuthStateChanged(auth, (user) => {
      if (user && !settled) {
        settled = true;
        setFbStatus({ authReady: true, error: null });
        resolve(user);
      }
    });
    const attempt = (n) => {
      signInAnonymously(auth).catch((err) => {
        console.warn(`Firebase sign-in attempt ${n} failed:`, err && err.code);
        setFbStatus({ error: 'auth: ' + (err && err.code || 'unknown') });
        if (n < 5 && !settled) setTimeout(() => attempt(n + 1), Math.min(2000 * 2 ** n, 30000));
      });
    };
    attempt(0);
  });
  return authPromise;
};

// subscribe collection หนึ่ง — cb(rawValue) ทุกครั้งที่ remote เปลี่ยน; คืน unsubscribe
export const subscribeCollection = (name, cb, errCb) => {
  if (!isFirebaseMode()) return () => {};
  init();
  return onValue(
    ref(db, `${ROOT_PATH}/${name}`),
    (snap) => cb(snap.val()),
    (err) => {
      console.warn(`Firebase subscribe ${name} error:`, err && err.code);
      setFbStatus({ error: `subscribe ${name}: ` + (err && err.code || 'unknown') });
      if (errCb) errCb(err);
    }
  );
};

// เขียน multi-path update ครั้งเดียว (atomic) — updates เช่น { 'requests/WR-26-0001': {...} }
export const pushFanout = (updates) => {
  if (!isFirebaseMode()) return Promise.resolve(false);
  init();
  return update(ref(db, ROOT_PATH), updates).then(() => {
    setFbStatus({ lastPushAt: Date.now(), error: null });
    return true;
  });
};

// ติดตามสถานะการเชื่อมต่อ (.info/connected) — สำหรับ badge ใน UI
export const watchConnected = (cb) => {
  if (!isFirebaseMode()) return () => {};
  init();
  return onValue(ref(db, '.info/connected'), (snap) => {
    const c = Boolean(snap.val());
    setFbStatus({ connected: c });
    if (cb) cb(c);
  });
};

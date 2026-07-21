/**
 * useFirebaseSync — realtime sync ทั้งหมดของโหมด Firebase อยู่ใน hook เดียว
 * (app.jsx เรียกบรรทัดเดียว — เมื่อไม่ได้ตั้งค่า env ทุก effect เป็น no-op)
 *
 * สถาปัตยกรรม (กระจกจาก bin-sync เดิม แต่เปลี่ยน 10s poll → onValue realtime):
 *
 *   inbound:  onValue ต่อ collection → อัปเดต baseline จาก snapshot ก่อนเสมอ
 *             → merge เข้า state ด้วย merge fns เดิม (updatedAt wins)
 *             → ถ้า merge แล้วเหมือนเดิม คืน state เดิม (ไม่ re-render, ไม่ trigger push)
 *
 *   outbound: effect เฝ้า 6 collections, gate ด้วย auth+hydrated ครบ (กัน push
 *             state ว่างทับข้อมูลจริง — เทียบ initialPullDone ของเดิม), debounce 2s,
 *             diff กับ baseline → multi-path update() ครั้งเดียว
 *
 *   loop prevention: baseline = "ภาพล่าสุดที่เห็นจาก remote" อัปเดตจาก snapshot
 *             เท่านั้น (รวม echo จาก latency compensation ของ RTDB ที่ fire ทันที
 *             หลัง update()) → record ที่ remote ชนะจะเท่ากับ baseline เสมอ ไม่ถูก
 *             push กลับ; ผลลัพธ์ convergent โดยไม่ต้องมี version number
 *
 *   migration: เครื่องแรกที่เชื่อม — remote ว่าง (null) → hydrate ด้วย baseline ว่าง
 *             → diff แรก push ข้อมูลจาก localStorage ทั้งหมดขึ้น cloud อัตโนมัติ
 */
import React from 'react';
import { isFirebaseMode, ensureAuth, subscribeCollection, pushFanout, watchConnected, setFbStatus } from './firebase.js';
import { COLLECTIONS, normalizeCollection, baselineFromRemote, emptyBaseline, computeFanout } from './diff.js';
import { mergeRequests, mergeActivities, mergeUsersById, mergeArrayByKey } from './binSync.js';
import { mergeOptionLists } from '../lib/core.jsx';

// merge collection เดียวเข้ากับ state — ใช้ merge fns เดิมของระบบทั้งหมด
const mergeIntoState = (name, s, incoming) => {
  switch (name) {
    case 'requests':    return mergeRequests(s.requests, incoming);
    case 'activities':  return mergeActivities(s.activities, incoming);
    case 'users':       return mergeUsersById(s.users, incoming);
    case 'products':    return mergeArrayByKey(s.products, incoming, 'sku');
    case 'customers':   return mergeArrayByKey(s.customers, incoming, 'id');
    case 'optionLists': return mergeOptionLists(s.optionLists, incoming);
    default:            return s[name];
  }
};

const useFirebaseSync = (state, _setState) => {
  const fb = isFirebaseMode(); // ค่าคงที่ตลอดอายุ build

  const baselineRef = React.useRef(emptyBaseline());
  const stateRef = React.useRef(state);
  const hydratedRef = React.useRef(new Set());
  const pushTimerRef = React.useRef(null);
  const lastToastRef = React.useRef(0);
  const [ready, setReady] = React.useState(false); // auth + hydrate ครบ 6 collections

  stateRef.current = state;

  // ── Effect A: auth + subscribe ทุก collection (ครั้งเดียวตอน mount) ──
  React.useEffect(() => {
    if (!fb) return undefined;
    let cancelled = false;
    const unsubs = [];

    // ลิงก์เชิญแบบเก่า (#join=) ไม่ใช้ในโหมด Firebase — ลบ hash + แจ้งผู้ใช้
    try {
      if (/[#&]join=/.test(location.hash)) {
        history.replaceState(null, '', location.pathname + location.search);
        window.toast && window.toast('ระบบใช้ Firebase sync แล้ว — ไม่ต้องใช้ลิงก์เชิญแบบเก่า', { level: 'info', duration: 5000 });
      }
    } catch (e) {}

    const handleRemote = (name, raw) => {
      if (cancelled) return;
      // 1) baseline ก่อนเสมอ — outbound diff จะเทียบกับภาพ remote ล่าสุดนี้
      baselineRef.current = { ...baselineRef.current, [name]: baselineFromRemote(name, raw) };

      const wasFullyHydrated = hydratedRef.current.size === COLLECTIONS.length;
      const incoming = normalizeCollection(name, raw);

      // 2) merge เข้า state (short-circuit ถ้าเนื้อหาเหมือนเดิม — กัน re-render/echo)
      let changed = false;
      _setState((s) => {
        const merged = mergeIntoState(name, s, incoming);
        try {
          if (JSON.stringify(merged) === JSON.stringify(s[name])) return s;
        } catch (e) {}
        changed = true;
        return { ...s, [name]: merged };
      });

      // 3) นับ hydration — ครบ 6 → ปลดล็อค outbound
      if (!hydratedRef.current.has(name)) {
        hydratedRef.current.add(name);
        if (hydratedRef.current.size === COLLECTIONS.length) {
          setFbStatus({ hydrated: true });
          setReady(true);
        }
      }
      setFbStatus({ lastEventAt: Date.now() });

      // 4) toast เมื่อมีข้อมูลใหม่จากเครื่องอื่น (หลัง hydrate แล้วเท่านั้น + throttle)
      if (wasFullyHydrated && changed && Date.now() - lastToastRef.current > 4000) {
        lastToastRef.current = Date.now();
        window.toast && window.toast('ข้อมูลซิงค์จากเครื่องอื่นแล้ว', { level: 'info', duration: 3000 });
      }
    };

    unsubs.push(watchConnected());
    ensureAuth().then(() => {
      if (cancelled) return;
      for (const name of COLLECTIONS) {
        unsubs.push(subscribeCollection(name, (raw) => handleRemote(name, raw)));
      }
    });

    return () => {
      cancelled = true;
      for (const u of unsubs) { try { u(); } catch (e) {} }
    };
  }, [fb]);

  // ── Effect B: outbound — diff กับ baseline แล้ว push (debounce 2s เท่าของเดิม) ──
  React.useEffect(() => {
    if (!fb || !ready) return undefined;
    clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(() => {
      const s = stateRef.current;
      const { updates } = computeFanout(baselineRef.current, {
        requests: s.requests, activities: s.activities, users: s.users,
        products: s.products, customers: s.customers, optionLists: s.optionLists,
      });
      if (Object.keys(updates).length === 0) return;
      // ไม่แตะ baseline ตรงนี้ — echo จาก RTDB (fire ทันทีแม้ offline) จะอัปเดตให้
      pushFanout(updates).catch((err) => {
        console.warn('Firebase push failed:', err && err.code);
        setFbStatus({ error: 'push: ' + ((err && err.code) || 'unknown') });
        if (Date.now() - lastToastRef.current > 8000) {
          lastToastRef.current = Date.now();
          window.toast && window.toast('ซิงค์ขึ้น cloud ไม่สำเร็จ — ตรวจสิทธิ์/การเชื่อมต่อ', { level: 'error', duration: 5000 });
        }
      });
    }, 2000);
    return () => clearTimeout(pushTimerRef.current);
  }, [fb, ready, state.requests, state.activities, state.users, state.products, state.customers, state.optionLists]);
};

export { useFirebaseSync };

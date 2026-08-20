/**
 * remoteProvider.js — เรียก Claude AI ผ่าน Cloudflare Worker (ชั้นที่ 2, เปิดใช้ทีหลังได้)
 * endpoint เก็บ per-device ใน localStorage — ผู้ดูแลแจก URL ให้ทีม (ดู SETUP-AI.md)
 */

const ENDPOINT_KEY = 'fd-ai-endpoint';
const TEAMKEY_KEY = 'fd-ai-teamkey';

export const getAiEndpoint = () => { try { return localStorage.getItem(ENDPOINT_KEY) || ''; } catch (e) { return ''; } };
export const setAiEndpoint = (v) => { try { v ? localStorage.setItem(ENDPOINT_KEY, v.trim()) : localStorage.removeItem(ENDPOINT_KEY); } catch (e) {} };
export const getAiTeamKey = () => { try { return localStorage.getItem(TEAMKEY_KEY) || ''; } catch (e) { return ''; } };
export const setAiTeamKey = (v) => { try { v ? localStorage.setItem(TEAMKEY_KEY, v.trim()) : localStorage.removeItem(TEAMKEY_KEY); } catch (e) {} };

// history: [{ role: 'user'|'assistant', text }] — ส่งย้อนหลังไม่เกิน 6 ข้อความ
export const askRemote = async (question, contextStr, history) => {
  const endpoint = getAiEndpoint();
  if (!endpoint) throw new Error('no-endpoint');
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(getAiTeamKey() ? { 'X-Team-Key': getAiTeamKey() } : {}),
    },
    body: JSON.stringify({
      question,
      context: contextStr,
      history: (history || []).slice(-6).map((m) => ({ role: m.role, content: m.text })),
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`AI HTTP ${res.status}${t ? ': ' + t.slice(0, 120) : ''}`);
  }
  const data = await res.json();
  if (!data || typeof data.answer !== 'string') throw new Error('AI ตอบกลับผิดรูปแบบ');
  return data.answer;
};

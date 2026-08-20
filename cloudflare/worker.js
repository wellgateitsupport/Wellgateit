/**
 * FlowDesk AI Proxy — Cloudflare Worker
 * ตัวกลางเก็บ API key ของ Claude ไว้ฝั่งเซิร์ฟเวอร์ (ห้ามใส่ key ในหน้าเว็บ)
 *
 * วิธี deploy (ฟรี — ดูละเอียดใน SETUP-AI.md):
 *   1. dash.cloudflare.com → Workers & Pages → Create Worker → วางโค้ดไฟล์นี้ทั้งไฟล์ → Deploy
 *   2. Settings → Variables and Secrets:
 *      - ANTHROPIC_API_KEY (Secret)  = key จาก console.anthropic.com
 *      - TEAM_KEY (Secret, ไม่บังคับ) = รหัสทีมกันคนนอกยิง API
 *      - MODEL (Text, ไม่บังคับ)      = default: claude-haiku-4-5 (ถูก+เร็ว)
 *   3. คัดลอก URL ของ Worker ไปใส่ในแอพ: ปุ่มผู้ช่วย → ⚙ ตั้งค่า
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Team-Key',
};

const SYSTEM_PROMPT = `คุณคือ "ผู้ช่วย FlowDesk" ของระบบแจ้งงานและติดตามงานภายในบริษัท
- ตอบภาษาไทย กระชับ ตรงคำถาม อ้างอิงเฉพาะข้อมูลบริบทที่ให้มาเท่านั้น
- ข้อมูลบริบทถูกกรองตามสิทธิ์ของผู้ถามแล้ว — ห้ามเดาข้อมูลที่ไม่มีในบริบท ถ้าไม่มีให้บอกตรงๆ
- อ้างรหัสคำขอ (เช่น WR-26-0341) เมื่อพูดถึงคำขอ เพื่อให้ผู้ใช้ค้นต่อได้
- ตัวเลขเงินใช้รูปแบบ ฿1,234
- ห้ามแต่งข้อมูล ห้ามให้คำมั่นแทนระบบ (เช่น "เดี๋ยวระบบจะอนุมัติให้")`;

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (request.method !== 'POST') {
      return json({ error: 'POST only' }, 405);
    }
    // กันคนนอก: ถ้าตั้ง TEAM_KEY ไว้ ทุก request ต้องแนบ X-Team-Key ให้ตรง
    if (env.TEAM_KEY && request.headers.get('X-Team-Key') !== env.TEAM_KEY) {
      return json({ error: 'invalid team key' }, 401);
    }
    if (!env.ANTHROPIC_API_KEY) {
      return json({ error: 'ANTHROPIC_API_KEY not configured' }, 500);
    }

    let body;
    try { body = await request.json(); } catch (e) { return json({ error: 'invalid JSON' }, 400); }
    const question = String(body.question || '').slice(0, 2000);
    const context = String(body.context || '').slice(0, 20000);
    if (!question) return json({ error: 'question required' }, 400);

    // ประวัติย้อนหลัง (จำกัด 6 ข้อความ กัน token บาน)
    const history = Array.isArray(body.history)
      ? body.history.slice(-6)
          .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
          .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }))
      : [];

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: env.MODEL || 'claude-haiku-4-5',
        max_tokens: 1024,
        system: `${SYSTEM_PROMPT}\n\n===== ข้อมูลในระบบ ณ ตอนนี้ =====\n${context}`,
        messages: [...history, { role: 'user', content: question }],
      }),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => '');
      return json({ error: `anthropic ${res.status}: ${t.slice(0, 200)}` }, 502);
    }
    const data = await res.json();
    const answer = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    return json({ answer: answer || '(ไม่มีคำตอบ)' });
  },
};

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS },
  });

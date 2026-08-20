import React from 'react';
import './assistant.css';
import { canViewRequest, canApproveStep, Icon } from '../lib/core.jsx';
import { answerLocal } from './localEngine.js';
import { buildAIContext } from './context.js';
import { askRemote, getAiEndpoint, setAiEndpoint, getAiTeamKey, setAiTeamKey } from './remoteProvider.js';

// ผู้ช่วย FlowDesk — ปุ่มลอย + แชท ถามข้อมูลในระบบเป็นภาษาไทย
// ชั้น 1 (default): local engine ฟรี · ชั้น 2: Claude AI ผ่าน Cloudflare Worker (ตั้งค่าที่เฟือง ดู SETUP-AI.md)
const AssistantPanel = ({ ctx }) => {
  const { state, setState, currentUser } = ctx;
  const [open, setOpen] = React.useState(false);
  const [configOpen, setConfigOpen] = React.useState(false);
  const [messages, setMessages] = React.useState([]);
  const [input, setInput] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [endpoint, setEndpoint] = React.useState(getAiEndpoint);
  const [teamKey, setTeamKey] = React.useState(getAiTeamKey);
  const msgsRef = React.useRef(null);
  const inputRef = React.useRef(null);

  // ข้อมูลที่ "ผ่านสิทธิ์การมองเห็นของผู้ใช้ปัจจุบันแล้ว" — ทั้ง local และ AI ใช้ชุดเดียวกัน
  const data = React.useMemo(() => {
    const visible = (state.requests || []).filter((r) => canViewRequest(r, currentUser, state.users));
    return {
      requests: visible,
      myRequests: visible.filter((r) => r.requester === currentUser.id),
      pendingForMe: visible.filter((r) => r.status === 'pending' && r.flow?.[r.currentStep] && canApproveStep(r.flow[r.currentStep], currentUser.id)),
      users: state.users, products: state.products, customers: state.customers,
      currentUser, now: new Date(),
    };
  }, [state.requests, state.users, state.products, state.customers, currentUser]);

  React.useEffect(() => {
    if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight;
  }, [messages, busy]);
  React.useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const aiMode = Boolean(endpoint);

  const ask = async (question) => {
    const qText = (question ?? input).trim();
    if (!qText || busy) return;
    setInput('');
    const history = messages;
    setMessages((m) => [...m, { role: 'user', text: qText }]);
    if (aiMode) {
      setBusy(true);
      try {
        const answer = await askRemote(qText, buildAIContext(data), history);
        setMessages((m) => [...m, { role: 'assistant', text: answer }]);
      } catch (e) {
        // AI ล่ม/ตั้งค่าผิด → ตอบด้วย local engine แทน พร้อมบอกตรงๆ
        const fallback = answerLocal(qText, data);
        setMessages((m) => [
          ...m,
          { role: 'assistant', text: fallback.text, items: fallback.items },
          { role: 'note', text: `⚠ Claude AI ใช้ไม่ได้ (${e.message}) — ตอบด้วยโหมดฟรีแทน` },
        ]);
      }
      setBusy(false);
    } else {
      const a = answerLocal(qText, data);
      setMessages((m) => [...m, { role: 'assistant', text: a.text, items: a.items }]);
    }
  };

  const openRequest = (id) => {
    setState({ route: 'detail', selectedId: id });
    setOpen(false);
  };

  const saveConfig = () => {
    setAiEndpoint(endpoint);
    setAiTeamKey(teamKey);
    setConfigOpen(false);
    window.toast && window.toast(endpoint ? 'เปิดโหมด Claude AI แล้ว' : 'ใช้โหมดผู้ช่วยฟรี (local)', { level: 'success' });
  };

  const SUGGESTIONS = ['รอฉันอนุมัติกี่รายการ?', 'คำขอของฉันถึงไหนแล้ว', 'มีอะไรเกินกำหนดบ้าง', 'ยอดเบิกเงินเดือนนี้เท่าไหร่'];

  return (
    <>
      <button className="ai-fab no-print" title="ผู้ช่วย FlowDesk" aria-label="เปิดผู้ช่วย FlowDesk" onClick={() => setOpen((o) => !o)}>
        <Icon name={open ? 'x' : 'zap'} size={22} />
      </button>

      {open && (
        <div className="ai-panel no-print" role="dialog" aria-label="ผู้ช่วย FlowDesk">
          <div className="ai-head">
            <div className="ai-head-mark"><Icon name="zap" size={16} /></div>
            <div>
              <div className="ai-head-title">ผู้ช่วย FlowDesk</div>
              <div className="ai-head-mode">{aiMode ? '✦ Claude AI' : 'โหมดฟรี (ตอบจากข้อมูลในระบบ)'}</div>
            </div>
            <div className="ai-head-actions">
              <button className="btn btn-ghost btn-icon-only btn-sm" title="ตั้งค่า AI" onClick={() => setConfigOpen((c) => !c)}><Icon name="settings" size={14} /></button>
              <button className="btn btn-ghost btn-icon-only btn-sm" title="ปิด" onClick={() => setOpen(false)}><Icon name="x" size={14} /></button>
            </div>
          </div>

          {configOpen && (
            <div className="ai-config">
              <label>Cloudflare Worker URL (เว้นว่าง = โหมดฟรี) — วิธีตั้งค่าดู SETUP-AI.md</label>
              <input value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder="https://flowdesk-ai.xxx.workers.dev" />
              <label>Team key (ถ้าผู้ดูแลตั้งไว้)</label>
              <input value={teamKey} onChange={(e) => setTeamKey(e.target.value)} placeholder="ไม่บังคับ" />
              <button className="btn btn-primary btn-sm" onClick={saveConfig}>บันทึก</button>
            </div>
          )}

          <div className="ai-msgs" ref={msgsRef}>
            {messages.length === 0 && (
              <div className="ai-msg ai-msg-bot">
                สวัสดีครับ คุณ{currentUser.name} 👋{'\n'}ถามข้อมูลในระบบได้เลย — สถานะคำขอ งานที่รออนุมัติ ยอดเงิน สต๊อก หรือพิมพ์รหัสคำขอเพื่อเช็คสถานะ
              </div>
            )}
            {messages.map((m, i) =>
              m.role === 'note' ? (
                <div key={i} className="ai-msg-note">{m.text}</div>
              ) : (
                <div key={i} className={`ai-msg ${m.role === 'user' ? 'ai-msg-user' : 'ai-msg-bot'}`}>
                  {m.text}
                  {m.items && m.items.length > 0 && (
                    <div className="ai-items">
                      {m.items.map((it) => (
                        <button key={it.id} className="ai-item" onClick={() => openRequest(it.id)}>
                          <span className="ai-item-id">{it.id}</span>
                          <span className="ai-item-title">{it.title}</span>
                          <span className="ai-item-sub">{it.sub}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            )}
            {busy && <div className="ai-msg ai-msg-bot"><span className="ai-typing"><span /><span /><span /></span></div>}
          </div>

          {messages.length === 0 && (
            <div className="ai-suggest">
              {SUGGESTIONS.map((s) => <button key={s} onClick={() => ask(s)}>{s}</button>)}
            </div>
          )}

          <div className="ai-inputbar">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') ask(); if (e.key === 'Escape') setOpen(false); }}
              placeholder="พิมพ์คำถาม... เช่น รอฉันอนุมัติกี่รายการ"
            />
            <button className="ai-send" onClick={() => ask()} disabled={busy || !input.trim()} aria-label="ส่งคำถาม">
              <Icon name="send" size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export { AssistantPanel };

import React from 'react';

// Error boundary — ไฟล์ต้นฉบับไม่มี (render throw = จอขาว)
// อันนี้เป็นตาข่ายเดียวที่เพิ่มใหม่: แสดงข้อความไทย + stack + ปุ่ม reload
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('FlowDesk crashed:', error, info);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'IBM Plex Sans Thai Looped', system-ui, sans-serif", padding: 24,
        background: '#FAF7F2', color: '#2b2620'
      }}>
        <div style={{ maxWidth: 560, width: '100%' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>⚠️</div>
          <h1 style={{ fontSize: 20, margin: '0 0 8px' }}>เกิดข้อผิดพลาดในระบบ</h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: '#6b6257', margin: '0 0 16px' }}>
            ข้อมูลของคุณยังปลอดภัยอยู่ในเครื่อง (localStorage) — ลองโหลดหน้าใหม่
            ถ้ายังพบปัญหาซ้ำ ให้แจ้งผู้ดูแลระบบพร้อมรายละเอียดด้านล่าง
          </p>
          <button
            onClick={() => location.reload()}
            style={{
              height: 40, padding: '0 20px', borderRadius: 8, border: 0, cursor: 'pointer',
              background: '#E08A3F', color: '#fff', fontSize: 14, fontWeight: 600,
              fontFamily: 'inherit'
            }}
          >โหลดหน้าใหม่</button>
          <details style={{ marginTop: 20 }}>
            <summary style={{ cursor: 'pointer', fontSize: 13, color: '#6b6257' }}>รายละเอียดทางเทคนิค</summary>
            <pre style={{
              marginTop: 8, padding: 12, background: '#f1ece4', borderRadius: 8,
              fontSize: 11, overflow: 'auto', maxHeight: 260, whiteSpace: 'pre-wrap'
            }}>{String(this.state.error && (this.state.error.stack || this.state.error.message || this.state.error))}</pre>
          </details>
        </div>
      </div>
    );
  }
}

export { ErrorBoundary };

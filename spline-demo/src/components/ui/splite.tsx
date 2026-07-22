'use client'

import { Suspense, lazy, Component, type ReactNode } from 'react'
const Spline = lazy(() => import('@splinetool/react-spline'))

interface SplineSceneProps {
  scene: string
  className?: string
}

// Error boundary — ฉาก 3D โหลดจาก URL ภายนอก ถ้าโหลด/เรนเดอร์ล้มเหลว
// (ออฟไลน์, URL ผิด, WebGL ไม่รองรับ) ต้อง degrade อย่างนุ่มนวล
// ไม่ให้ error หลุดขึ้นไป unmount ทั้งหน้า
class SplineErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children
  }
}

export function SplineScene({ scene, className }: SplineSceneProps) {
  return (
    <SplineErrorBoundary
      fallback={
        <div className="w-full h-full flex items-center justify-center text-neutral-500 text-sm">
          ไม่สามารถโหลดฉาก 3D ได้
        </div>
      }
    >
      <Suspense
        fallback={
          <div className="w-full h-full flex items-center justify-center">
            <span className="loader"></span>
          </div>
        }
      >
        <Spline
          scene={scene}
          className={className}
        />
      </Suspense>
    </SplineErrorBoundary>
  )
}

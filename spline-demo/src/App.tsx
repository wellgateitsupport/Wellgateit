import { SplineSceneBasic } from '@/components/ui/demo'

// หน้า showcase — วางคอมโพเนนต์ 3D hero ไว้กลางจอบนพื้นหลังเข้ม
function App() {
  return (
    <main className="min-h-screen w-full bg-neutral-950 flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-4xl">
        <SplineSceneBasic />
      </div>
    </main>
  )
}

export default App

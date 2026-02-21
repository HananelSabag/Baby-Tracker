import { BottomNav } from './BottomNav'

export function AppLayout({ children }) {
  return (
    <div className="min-h-screen bg-cream-100 flex justify-center">
      <div className="w-full max-w-[480px] min-h-screen flex flex-col">
        <main className="flex-1 overflow-y-auto pb-[72px]">
          {children}
        </main>
        <BottomNav />
      </div>
    </div>
  )
}

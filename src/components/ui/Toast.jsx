export function ToastContainer({ toasts, onDismiss }) {
  if (!toasts.length) return null
  return (
    <div className="fixed top-4 left-0 right-0 z-[100] flex flex-col items-center gap-2 px-4 pointer-events-none">
      {toasts.map(toast => (
        <div
          key={toast.id}
          onClick={() => onDismiss(toast.id)}
          className="pointer-events-auto w-full max-w-[440px] bg-brown-800 text-white rounded-2xl px-4 py-3 shadow-2xl flex items-center gap-3 animate-slide-up cursor-pointer"
        >
          <span className="text-2xl flex-shrink-0">{toast.emoji}</span>
          <p className="font-rubik text-sm font-medium leading-tight flex-1">{toast.message}</p>
          <span className="text-white/50 text-lg">×</span>
        </div>
      ))}
    </div>
  )
}

// Continuation of the inlined boot splash in index.html.
//
// The HTML splash covers "bundle is still parsing". This one covers what comes
// after: resolving the auth session and the family record. Keeping the two
// visually identical means the hand-off is invisible — previously the branded
// splash was replaced by a bare grey spinner, which read as a second load.

export function AppSplash({ label }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-6 bg-cream-100"
      style={{
        backgroundImage:
          'radial-gradient(ellipse 80% 45% at 50% 38%, rgba(232,184,75,0.20) 0%, transparent 70%)',
      }}
      role="status"
    >
      <div className="relative w-24 h-24 flex items-center justify-center">
        {/* Halo rings */}
        <span
          className="absolute rounded-full border animate-app-halo"
          style={{ inset: -10, borderColor: 'rgba(232,184,75,0.30)' }}
        />
        <span
          className="absolute rounded-full border animate-app-halo"
          style={{ inset: -22, borderColor: 'rgba(232,184,75,0.16)', animationDelay: '0.4s' }}
        />
        <div
          className="w-24 h-24 rounded-[28px] overflow-hidden border-4 border-white flex items-center justify-center text-5xl leading-none"
          style={{
            background: 'linear-gradient(135deg, #FFF6E8 0%, #FFDFAC 100%)',
            boxShadow: '0 10px 32px rgba(139,94,60,0.18)',
          }}
        >
          <img
            src="/icons/icon-192.png"
            alt=""
            className="w-full h-full object-cover"
            onError={e => { e.target.style.display = 'none'; e.target.parentNode.textContent = '🍼' }}
          />
        </div>
      </div>

      <p className="font-rubik font-bold text-brown-800 text-2xl tracking-tight">BabyTracker</p>

      <div className="flex gap-1.5">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="w-[7px] h-[7px] rounded-full bg-brown-400 animate-app-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>

      {label && <p className="font-rubik text-brown-400 text-sm -mt-2">{label}</p>}
    </div>
  )
}

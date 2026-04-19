export default function AxesLoading() {
  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)] pb-[env(safe-area-inset-bottom)] animate-pulse">
      {/* Bloc sticky : header navy dégradé + bouton nouvelle action */}
      <div className="shrink-0 space-y-3 pb-3">
        <div
          className="rounded-[28px] p-4 relative overflow-hidden"
          style={{ background: 'linear-gradient(165deg, #1a1a2e 0%, #2a1a3e 100%)' }}
        >
          <div className="absolute -top-8 -right-5 w-28 h-28 rounded-full" style={{ background: 'rgba(251,191,36,0.15)' }} />
          <div className="relative space-y-2">
            <div className="h-5 w-36 rounded" style={{ background: 'rgba(255,255,255,0.2)' }} />
            <div className="h-3 w-56 rounded" style={{ background: 'rgba(255,255,255,0.1)' }} />
          </div>
        </div>

        {/* Chips d'axes (tabs) */}
        <div className="flex gap-2 overflow-hidden">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="shrink-0 h-9 rounded-xl"
              style={{
                width: i === 0 ? 120 : 100,
                background: i === 0 ? '#fbbf24' : 'white',
                border: i === 0 ? 'none' : '1.5px solid #f0ebe0',
              }}
            />
          ))}
        </div>
      </div>

      {/* Zone scrollable : liste d'actions de l'axe sélectionné */}
      <div className="flex-1 overflow-hidden space-y-2">
        <div className="h-4 w-44 bg-stone-200/70 rounded mb-2" />
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex items-start gap-3 p-3.5 bg-white rounded-[18px]"
            style={{ border: '1.5px solid #f0ebe0' }}
          >
            <div className="w-9 h-9 rounded-xl bg-stone-300 shrink-0" />
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="h-2.5 w-24 bg-amber-100 rounded" />
              <div className="h-3 w-full bg-stone-200/50 rounded" />
              <div className="h-3 w-3/4 bg-stone-200/50 rounded" />
              <div className="flex gap-3 pt-1">
                <div className="h-3 w-8 bg-stone-200/40 rounded" />
                <div className="h-3 w-8 bg-stone-200/40 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

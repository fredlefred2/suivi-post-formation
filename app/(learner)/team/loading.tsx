export default function TeamLoading() {
  return (
    <div className="space-y-5 pb-4 animate-pulse">
      {/* Header team (navy dégradé) */}
      <div
        className="rounded-[28px] p-5 relative overflow-hidden"
        style={{ background: 'linear-gradient(165deg, #1a1a2e 0%, #2a1a3e 100%)' }}
      >
        <div className="absolute -top-8 -right-5 w-28 h-28 rounded-full" style={{ background: 'rgba(251,191,36,0.15)' }} />
        <div className="relative flex items-start justify-between mb-4">
          <div className="space-y-2">
            <div className="h-6 w-44 rounded" style={{ background: 'rgba(255,255,255,0.2)' }} />
            <div className="h-3 w-28 rounded" style={{ background: 'rgba(255,255,255,0.1)' }} />
          </div>
          <div className="w-10 h-10 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }} />
        </div>
        <div className="relative grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl py-3 px-2 text-center space-y-1.5" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <div className="h-6 w-12 mx-auto rounded" style={{ background: 'rgba(255,255,255,0.2)' }} />
              <div className="h-2 w-14 mx-auto rounded" style={{ background: 'rgba(255,255,255,0.08)' }} />
            </div>
          ))}
        </div>
      </div>

      {/* Podium top 3 */}
      <div>
        <div className="h-4 w-40 bg-stone-200/70 rounded mb-2" />
        <div className="flex items-end justify-center gap-2 pt-4 pb-0 px-2">
          {[
            { size: 44, h: 56 },
            { size: 56, h: 80 },
            { size: 44, h: 40 },
          ].map((cfg, i) => (
            <div key={i} className="flex flex-col items-center flex-1 space-y-2" style={{ maxWidth: 120 }}>
              <div className="rounded-full bg-stone-300" style={{ width: cfg.size, height: cfg.size }} />
              <div className="h-3 w-16 bg-stone-200/70 rounded" />
              <div className="w-full rounded-t-xl bg-stone-300 mt-1" style={{ height: cfg.h }} />
            </div>
          ))}
        </div>
      </div>

      {/* Feed d'actions */}
      <div className="space-y-2.5">
        <div className="h-4 w-36 bg-stone-200/70 rounded" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-[18px] p-3.5 space-y-2" style={{ border: '1.5px solid #f0ebe0' }}>
            <div className="flex items-start gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-stone-300 shrink-0" />
              <div className="flex-1 min-w-0 space-y-1">
                <div className="h-3 w-32 bg-stone-200/70 rounded" />
                <div className="h-2 w-24 bg-amber-100 rounded" />
              </div>
            </div>
            <div className="h-3 w-full bg-stone-200/50 rounded" />
            <div className="h-3 w-2/3 bg-stone-200/50 rounded" />
            <div className="flex gap-3 pt-1">
              <div className="h-3 w-10 bg-stone-200/40 rounded" />
              <div className="h-3 w-10 bg-stone-200/40 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function CoachingLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* Header navy dégradé */}
      <div
        className="rounded-[28px] p-5 relative overflow-hidden"
        style={{ background: 'linear-gradient(165deg, #1a1a2e 0%, #2a1a3e 100%)' }}
      >
        <div className="absolute -top-8 -right-5 w-28 h-28 rounded-full" style={{ background: 'rgba(251,191,36,0.15)' }} />
        <div className="relative space-y-2">
          <div className="h-6 w-48 rounded" style={{ background: 'rgba(255,255,255,0.2)' }} />
          <div className="h-3 w-60 rounded" style={{ background: 'rgba(255,255,255,0.1)' }} />
        </div>
      </div>

      {/* Liste de cards tips (mantra + action + exemple) */}
      <div className="space-y-2.5">
        <div className="h-3 w-32 bg-stone-200/70 rounded" />
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-2xl p-4 space-y-3"
            style={{ background: 'rgba(255,255,255,0.07)', borderLeft: '3px solid rgba(251,191,36,0.25)' }}
          >
            <div className="flex items-center gap-2">
              <div className="h-5 w-24 bg-amber-100 rounded-md" />
              <div className="h-3 w-16 bg-stone-200/40 rounded" />
            </div>
            <div className="h-3 w-full bg-stone-200/50 rounded" />
            <div className="h-3 w-3/4 bg-stone-200/50 rounded" />
            <div className="pt-2 border-t border-stone-200/30 space-y-2">
              <div className="h-3 w-full bg-stone-200/40 rounded" />
              <div className="h-3 w-2/3 bg-stone-200/40 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

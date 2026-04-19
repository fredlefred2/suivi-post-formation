export default function LearnerDetailLoading() {
  return (
    <div className="space-y-4 pb-4 animate-pulse">
      {/* Header navy dégradé avec avatar + stats (identique learner/[id]/page.tsx) */}
      <div
        className="rounded-2xl p-4 relative overflow-hidden"
        style={{
          background: 'linear-gradient(165deg, #1a1a2e 0%, #2a1a3e 100%)',
          boxShadow: '0 8px 30px rgba(26, 26, 46, 0.3)',
        }}
      >
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10" />
        <div className="absolute -bottom-10 -left-6 w-24 h-24 rounded-full bg-white/5" />

        {/* Ligne 1 : nom + bouton message */}
        <div className="relative flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full" style={{ background: 'rgba(251,191,36,0.2)' }} />
            <div className="space-y-1.5">
              <div className="h-5 w-40 rounded" style={{ background: 'rgba(255,255,255,0.2)' }} />
              <div className="h-3 w-28 rounded" style={{ background: 'rgba(255,255,255,0.1)' }} />
            </div>
          </div>
          <div className="w-9 h-9 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }} />
        </div>

        {/* 3 stat tiles */}
        <div className="relative grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl py-3 px-2 text-center space-y-1.5" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <div className="h-6 w-12 mx-auto rounded" style={{ background: 'rgba(255,255,255,0.2)' }} />
              <div className="h-2 w-14 mx-auto rounded" style={{ background: 'rgba(255,255,255,0.08)' }} />
            </div>
          ))}
        </div>
      </div>

      {/* Historique météo */}
      <div
        className="flex gap-3 p-3 bg-white rounded-xl items-center"
        style={{ border: '1.5px solid #f0ebe0' }}
      >
        <div className="h-2.5 w-28 bg-stone-200/60 rounded" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="w-6 h-6 bg-stone-200/60 rounded-full" />
        ))}
      </div>

      {/* Section "Axes de progrès" */}
      <div className="space-y-2">
        <div className="h-4 w-36 bg-stone-200/70 rounded" />
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 p-3 bg-white rounded-[18px]"
            style={{ border: '2px solid #f0ebe0' }}
          >
            <div className="w-[52px] h-[52px] rounded-full bg-stone-200" />
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="h-3 w-44 bg-stone-200/70 rounded" />
              <div className="h-2.5 w-52 bg-stone-200/50 rounded" />
            </div>
            <div className="h-4 w-4 bg-stone-200/50 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

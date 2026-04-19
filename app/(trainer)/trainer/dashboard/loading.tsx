export default function TrainerDashboardLoading() {
  return (
    <div className="space-y-4 pb-4 animate-pulse">
      {/* Header navy dégradé avec chips groupes + titre + stats */}
      <div
        className="rounded-[28px] relative overflow-hidden"
        style={{ background: 'linear-gradient(165deg, #1a1a2e 0%, #2a1a3e 100%)' }}
      >
        <div className="absolute -top-8 -right-5 w-28 h-28 rounded-full" style={{ background: 'rgba(251,191,36,0.15)' }} />

        {/* Chips groupes */}
        <div className="relative flex gap-1.5 px-4 pt-4 pb-3 overflow-hidden">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="shrink-0 h-7 rounded-full"
              style={{
                width: i === 0 ? 50 : i === 1 ? 120 : 80,
                background: i === 0 ? '#fbbf24' : 'rgba(255,255,255,0.1)',
              }}
            />
          ))}
        </div>

        {/* Titre + météo */}
        <div className="relative px-5 pb-5">
          <div className="flex items-start justify-between mb-4">
            <div className="space-y-2">
              <div className="h-5 w-44 rounded-md" style={{ background: 'rgba(255,255,255,0.18)' }} />
              <div className="h-3 w-28 rounded" style={{ background: 'rgba(255,255,255,0.1)' }} />
            </div>
            <div className="w-10 h-10 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }} />
          </div>

          {/* 3 stat tiles */}
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="rounded-2xl py-3 px-2 text-center space-y-1.5"
                style={{ background: 'rgba(255,255,255,0.1)' }}
              >
                <div className="h-6 w-12 mx-auto rounded" style={{ background: 'rgba(255,255,255,0.2)' }} />
                <div className="h-2 w-14 mx-auto rounded" style={{ background: 'rgba(255,255,255,0.1)' }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Podium top 3 (placeholder) */}
      <div>
        <div className="h-4 w-40 bg-stone-200/70 rounded mb-2" />
        <div className="flex items-end justify-center gap-2 pt-4 pb-0 px-2">
          {[
            { size: 44, h: 56 },
            { size: 56, h: 80 },
            { size: 44, h: 40 },
          ].map((cfg, i) => (
            <div key={i} className="flex flex-col items-center flex-1 space-y-2" style={{ maxWidth: 120 }}>
              <div
                className="rounded-full bg-stone-300"
                style={{ width: cfg.size, height: cfg.size }}
              />
              <div className="h-3 w-16 bg-stone-200/70 rounded" />
              <div className="h-2 w-12 bg-stone-200/50 rounded mb-1.5" />
              <div
                className="w-full rounded-t-xl bg-stone-300"
                style={{ height: cfg.h }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Classement rows */}
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex items-center gap-2.5 bg-white p-3 rounded-[14px]"
            style={{ border: '1.5px solid #f0ebe0' }}
          >
            <div className="w-6 h-6 rounded-full bg-stone-200" />
            <div className="h-3 flex-1 bg-stone-200/70 rounded max-w-[40%]" />
            <div className="h-4 w-4 bg-stone-200/60 rounded" />
            <div className="h-3 w-12 bg-stone-200/50 rounded" />
            <div className="flex gap-1">
              {[0, 1].map((j) => (
                <div key={j} className="w-5 h-5 bg-stone-200/60 rounded" />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Actions récentes */}
      <div className="space-y-2.5 pt-2">
        <div className="h-4 w-32 bg-stone-200/70 rounded" />
        {[0, 1].map((i) => (
          <div
            key={i}
            className="bg-white rounded-[18px] p-3.5 space-y-2"
            style={{ border: '1.5px solid #f0ebe0' }}
          >
            <div className="flex items-start gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-stone-300 shrink-0" />
              <div className="flex-1 min-w-0 space-y-1">
                <div className="h-3 w-32 bg-stone-200/70 rounded" />
                <div className="h-2 w-24 bg-amber-100 rounded" />
              </div>
            </div>
            <div className="h-3 w-full bg-stone-200/50 rounded" />
            <div className="h-3 w-3/4 bg-stone-200/50 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

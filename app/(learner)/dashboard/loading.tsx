export default function DashboardLoading() {
  return (
    <div className="space-y-3 pb-20 sm:pb-4 animate-pulse">
      {/* Header navy dégradé (identique à DashboardClient) */}
      <div
        className="rounded-[22px] px-[18px] py-[14px] relative overflow-hidden"
        style={{ background: 'linear-gradient(165deg, #1a1a2e 0%, #2a1a3e 100%)' }}
      >
        <div className="absolute -top-4 -right-3 w-[70px] h-[70px] rounded-full" style={{ background: 'rgba(251,191,36,0.14)' }} />
        <div className="relative space-y-2">
          {/* Greeting */}
          <div className="h-4 w-40 rounded-md" style={{ background: 'rgba(255,255,255,0.15)' }} />
          {/* Stats line */}
          <div className="h-3 w-56 rounded" style={{ background: 'rgba(255,255,255,0.1)' }} />
        </div>
      </div>

      {/* Carte "À faire aujourd'hui" */}
      <div
        className="rounded-[22px] px-3 py-3.5"
        style={{
          background: 'linear-gradient(180deg, #ffffff 0%, #fffbf0 100%)',
          border: '2px solid #f0ebe0',
          boxShadow: '0 4px 14px rgba(0,0,0,0.04)',
        }}
      >
        <div className="flex items-center justify-between mb-2.5">
          <div className="h-2.5 w-32 bg-stone-200/70 rounded pl-1" />
          <div className="h-2 w-16 bg-stone-200/50 rounded pr-1" />
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1.5 py-1">
              <div className="w-[60px] h-[60px] rounded-[18px] bg-stone-200/70" />
              <div className="h-2 w-12 bg-stone-200/60 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Section "Mes axes" */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="h-3.5 w-20 bg-stone-200/70 rounded" />
          <div className="h-3 w-16 bg-amber-100 rounded" />
        </div>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 p-3 bg-white rounded-[18px]"
            style={{ border: '2px solid #f0ebe0' }}
          >
            {/* Anneau circulaire */}
            <div className="relative shrink-0 w-[52px] h-[52px] rounded-full" style={{ background: '#f1f5f9' }}>
              <div className="absolute inset-[6px] rounded-full bg-white flex items-center justify-center">
                <div className="h-4 w-4 rounded bg-stone-200/70" />
              </div>
            </div>
            {/* Infos */}
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="h-3 w-40 bg-stone-200/70 rounded" />
              <div className="h-2.5 w-56 bg-stone-200/50 rounded" />
            </div>
            <div className="h-4 w-4 bg-stone-200/50 rounded shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}

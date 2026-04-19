export default function CheckinLoading() {
  return (
    <div className="space-y-3 pb-4 animate-pulse">
      {/* Header navy dégradé (identique à checkin/page.tsx) */}
      <div
        className="rounded-[28px] px-5 py-4 relative overflow-hidden"
        style={{ background: 'linear-gradient(165deg, #1a1a2e 0%, #2a1a3e 100%)' }}
      >
        <div className="absolute -top-8 -right-5 w-28 h-28 rounded-full" style={{ background: 'rgba(251,191,36,0.15)' }} />
        <div className="relative space-y-2">
          <div className="h-5 w-52 rounded" style={{ background: 'rgba(255,255,255,0.2)' }} />
          <div className="h-3 w-36 rounded" style={{ background: 'rgba(255,255,255,0.1)' }} />
        </div>
      </div>

      {/* Météo (3 gros boutons) */}
      <div className="bg-white rounded-2xl p-5 space-y-3" style={{ border: '2px solid #f0ebe0' }}>
        <div className="h-4 w-40 bg-stone-200/70 rounded" />
        <div className="flex gap-4 justify-center">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 w-16 bg-stone-200/50 rounded-xl" />
          ))}
        </div>
      </div>

      {/* Sliders axes */}
      <div className="bg-white rounded-2xl p-5 space-y-4" style={{ border: '2px solid #f0ebe0' }}>
        <div className="h-4 w-36 bg-stone-200/70 rounded" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-40 bg-stone-200/60 rounded" />
            <div className="h-2 w-full bg-stone-200/40 rounded-full" />
          </div>
        ))}
      </div>

      {/* Texte libre */}
      <div className="bg-white rounded-2xl p-5 space-y-3" style={{ border: '2px solid #f0ebe0' }}>
        <div className="h-4 w-44 bg-stone-200/70 rounded" />
        <div className="h-20 w-full bg-stone-200/40 rounded-xl" />
      </div>

      {/* Bouton valider */}
      <div className="h-12 w-full rounded-xl bg-amber-100" />
    </div>
  )
}

export default function ApprenantsLoading() {
  return (
    <div className="space-y-4 pb-4 animate-pulse">
      {/* Header navy dégradé (identique ApprenantsClient) */}
      <div
        className="rounded-2xl p-4 relative overflow-hidden"
        style={{
          background: 'linear-gradient(165deg, #1a1a2e 0%, #2a1a3e 100%)',
          boxShadow: '0 8px 30px rgba(26, 26, 46, 0.3)',
        }}
      >
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10" />
        <div className="absolute -bottom-10 -left-6 w-24 h-24 rounded-full bg-white/5" />
        <div className="relative space-y-2">
          <div className="h-6 w-40 rounded" style={{ background: 'rgba(255,255,255,0.2)' }} />
          <div className="h-3 w-28 rounded" style={{ background: 'rgba(255,255,255,0.1)' }} />
        </div>
      </div>

      {/* Liste de cards apprenants (accordéon fermé) */}
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white rounded-2xl p-3 flex items-center gap-3"
            style={{ border: '2px solid #f0ebe0' }}
          >
            <div className="w-11 h-11 rounded-full bg-stone-300 shrink-0" />
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="h-3.5 w-40 bg-stone-200/70 rounded" />
              <div className="h-2.5 w-56 bg-stone-200/50 rounded" />
            </div>
            <div className="w-8 h-8 rounded-full bg-stone-300" />
            <div className="w-8 h-8 rounded-full bg-stone-300" />
            <div className="h-4 w-4 bg-stone-200/50 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

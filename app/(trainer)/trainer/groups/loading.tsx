export default function GroupsLoading() {
  return (
    <div className="space-y-4 pb-4 animate-pulse">
      {/* Titre + bouton créer */}
      <div className="flex items-center justify-between">
        <div className="h-6 w-32 bg-stone-200/70 rounded-lg" />
        <div className="h-9 w-32 rounded-xl bg-amber-100" />
      </div>

      {/* Cards groupes */}
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="bg-white rounded-2xl p-4 space-y-3"
            style={{ border: '2px solid #f0ebe0' }}
          >
            {/* Ligne titre + badge nb membres */}
            <div className="flex items-center justify-between">
              <div className="h-5 w-44 bg-stone-200/70 rounded" />
              <div className="h-6 w-16 bg-amber-100 rounded-full" />
            </div>
            {/* Description / thème */}
            <div className="space-y-1.5">
              <div className="h-3 w-full bg-stone-200/40 rounded" />
              <div className="h-3 w-2/3 bg-stone-200/40 rounded" />
            </div>
            {/* Liste d'avatars */}
            <div className="flex gap-2 pt-2">
              {[0, 1, 2, 3].map((j) => (
                <div key={j} className="w-8 h-8 bg-stone-200/60 rounded-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

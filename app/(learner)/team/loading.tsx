export default function TeamLoading() {
  return (
    <div className="space-y-5 pb-4 animate-pulse">
      {/* Titre */}
      <div className="h-7 w-32 bg-gray-200 rounded-lg" />

      {/* Stats header */}
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-3 text-center space-y-2">
            <div className="h-3 w-16 mx-auto bg-gray-200 rounded" />
            <div className="h-6 w-8 mx-auto bg-gray-200 rounded" />
          </div>
        ))}
      </div>

      {/* Météo */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
        <div className="h-4 w-28 bg-gray-200 rounded" />
        <div className="flex gap-4 justify-center">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 w-16 bg-gray-100 rounded-xl" />
          ))}
        </div>
      </div>

      {/* Classement membres */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
        <div className="h-4 w-36 bg-gray-200 rounded" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 py-2">
            <div className="w-8 h-8 bg-gray-200 rounded-full" />
            <div className="flex-1 space-y-1">
              <div className="h-4 w-28 bg-gray-200 rounded" />
              <div className="h-2 w-full bg-gray-100 rounded-full" />
            </div>
          </div>
        ))}
      </div>

      {/* Actions récentes */}
      <div className="h-4 w-32 bg-gray-200 rounded" />
      <div className="flex gap-3 overflow-hidden">
        {[1, 2].map((i) => (
          <div key={i} className="w-64 shrink-0 bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
            <div className="h-4 w-20 bg-gray-200 rounded" />
            <div className="h-3 w-full bg-gray-100 rounded" />
            <div className="h-3 w-3/4 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

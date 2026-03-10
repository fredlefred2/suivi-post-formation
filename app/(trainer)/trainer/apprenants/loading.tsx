export default function ApprenantsLoading() {
  return (
    <div className="space-y-5 pb-4 animate-pulse">
      {/* Titre + sélecteur groupe */}
      <div className="flex items-center justify-between">
        <div className="h-7 w-36 bg-gray-200 rounded-lg" />
        <div className="h-9 w-32 bg-gray-200 rounded-xl" />
      </div>

      {/* Cards apprenants */}
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-200 rounded-full" />
              <div className="flex-1 space-y-1">
                <div className="h-4 w-32 bg-gray-200 rounded" />
                <div className="h-3 w-20 bg-gray-100 rounded" />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="h-6 w-20 bg-gray-100 rounded-full" />
              <div className="h-6 w-24 bg-gray-100 rounded-full" />
              <div className="h-6 w-16 bg-gray-100 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

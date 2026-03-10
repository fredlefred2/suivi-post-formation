export default function GroupsLoading() {
  return (
    <div className="space-y-5 pb-4 animate-pulse">
      {/* Titre + bouton créer */}
      <div className="flex items-center justify-between">
        <div className="h-7 w-36 bg-gray-200 rounded-lg" />
        <div className="h-9 w-28 bg-indigo-100 rounded-xl" />
      </div>

      {/* Cards groupes */}
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="h-5 w-36 bg-gray-200 rounded" />
              <div className="h-5 w-16 bg-gray-100 rounded-full" />
            </div>
            <div className="h-3 w-24 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

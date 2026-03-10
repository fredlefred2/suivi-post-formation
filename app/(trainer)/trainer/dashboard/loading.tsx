export default function TrainerDashboardLoading() {
  return (
    <div className="space-y-5 pb-4 animate-pulse">
      {/* Titre + sélecteur groupe */}
      <div className="flex items-center justify-between">
        <div className="h-7 w-44 bg-gray-200 rounded-lg" />
        <div className="h-9 w-32 bg-gray-200 rounded-xl" />
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-3 text-center space-y-2">
            <div className="h-3 w-16 mx-auto bg-gray-200 rounded" />
            <div className="h-7 w-10 mx-auto bg-gray-200 rounded" />
          </div>
        ))}
      </div>

      {/* Tableau apprenants */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
        <div className="h-5 w-32 bg-gray-200 rounded" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-50">
            <div className="w-8 h-8 bg-gray-200 rounded-full" />
            <div className="flex-1 space-y-1">
              <div className="h-4 w-28 bg-gray-200 rounded" />
              <div className="h-3 w-40 bg-gray-100 rounded" />
            </div>
            <div className="h-6 w-16 bg-gray-100 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

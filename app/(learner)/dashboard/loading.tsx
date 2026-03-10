export default function DashboardLoading() {
  return (
    <div className="space-y-5 pb-4 animate-pulse">
      {/* Bonjour + banner check-in */}
      <div className="h-7 w-48 bg-gray-200 rounded-lg" />
      <div className="h-16 bg-yellow-100/60 rounded-2xl" />

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
          <div className="h-4 w-12 mx-auto bg-gray-200 rounded" />
          <div className="h-8 w-10 mx-auto bg-gray-200 rounded-lg" />
          <div className="h-3 w-16 mx-auto bg-gray-100 rounded" />
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
          <div className="h-4 w-20 mx-auto bg-gray-200 rounded" />
          <div className="h-8 w-10 mx-auto bg-gray-200 rounded-lg" />
        </div>
      </div>

      {/* Actions + semaine */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
          <div className="h-4 w-8 mx-auto bg-gray-200 rounded" />
          <div className="h-8 w-10 mx-auto bg-gray-200 rounded-lg" />
          <div className="h-3 w-24 mx-auto bg-gray-100 rounded" />
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
          <div className="h-4 w-8 mx-auto bg-gray-200 rounded" />
          <div className="h-8 w-12 mx-auto bg-emerald-100 rounded-lg" />
          <div className="h-3 w-20 mx-auto bg-gray-100 rounded" />
        </div>
      </div>

      {/* Mes actions de progrès */}
      <div className="h-5 w-44 bg-gray-200 rounded" />
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
            <div className="h-4 w-32 bg-gray-200 rounded" />
            <div className="h-2 w-full bg-gray-100 rounded-full" />
            <div className="h-3 w-20 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

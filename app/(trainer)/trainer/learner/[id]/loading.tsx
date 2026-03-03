export default function LearnerDetailLoading() {
  return (
    <div className="space-y-6 pb-4 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-gray-200" />
        <div className="space-y-2">
          <div className="h-6 w-40 bg-gray-200 rounded-lg" />
          <div className="h-3 w-28 bg-gray-100 rounded" />
        </div>
      </div>

      {/* Badges skeleton */}
      <div className="flex gap-2">
        <div className="h-7 w-24 bg-gray-200 rounded-full" />
        <div className="h-7 w-28 bg-gray-200 rounded-full" />
        <div className="h-7 w-24 bg-gray-200 rounded-full" />
      </div>

      {/* Dynamique card skeleton */}
      <div className="card">
        <div className="h-5 w-48 bg-gray-200 rounded mb-4" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-gray-200 p-3 text-center space-y-2">
              <div className="h-4 w-20 mx-auto bg-gray-200 rounded" />
              <div className="h-3 w-16 mx-auto bg-gray-100 rounded" />
              <div className="h-3 w-14 mx-auto bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Axes skeleton */}
      <div className="card">
        <div className="h-5 w-40 bg-gray-200 rounded mb-4" />
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="border border-gray-200 rounded-xl p-4 space-y-2">
              <div className="h-4 w-32 bg-gray-200 rounded" />
              <div className="h-3 w-full bg-gray-100 rounded" />
              <div className="h-3 w-3/4 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

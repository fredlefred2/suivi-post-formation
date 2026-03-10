export default function CheckinLoading() {
  return (
    <div className="space-y-6 pb-4 animate-pulse">
      {/* Titre */}
      <div>
        <div className="h-7 w-52 bg-gray-200 rounded-lg" />
        <div className="h-4 w-36 bg-gray-100 rounded mt-1" />
      </div>

      {/* Météo */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
        <div className="h-4 w-40 bg-gray-200 rounded" />
        <div className="flex gap-4 justify-center">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 w-16 bg-gray-100 rounded-xl" />
          ))}
        </div>
      </div>

      {/* Axes sliders */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <div className="h-4 w-36 bg-gray-200 rounded" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 w-32 bg-gray-200 rounded" />
            <div className="h-2 w-full bg-gray-100 rounded-full" />
          </div>
        ))}
      </div>

      {/* Texte libre */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
        <div className="h-4 w-44 bg-gray-200 rounded" />
        <div className="h-20 w-full bg-gray-100 rounded-xl" />
      </div>

      {/* Bouton */}
      <div className="h-12 w-full bg-indigo-100 rounded-xl" />
    </div>
  )
}

export default function AxesLoading() {
  return (
    <div className="space-y-5 pb-4 animate-pulse">
      {/* Tabs navigation */}
      <div className="flex gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-9 w-24 bg-gray-200 rounded-xl" />
        ))}
      </div>

      {/* Axe bloc */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <div className="h-5 w-48 bg-gray-200 rounded" />
        <div className="h-2 w-full bg-gray-100 rounded-full" />
        <div className="h-3 w-28 bg-gray-100 rounded" />

        {/* Actions */}
        <div className="space-y-2 pt-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 border border-gray-100 rounded-xl p-3">
              <div className="w-5 h-5 bg-gray-200 rounded" />
              <div className="h-4 flex-1 bg-gray-100 rounded" />
            </div>
          ))}
        </div>

        {/* Bouton ajouter */}
        <div className="h-10 w-full rounded-xl" style={{ background: '#fffbeb' }} />
      </div>
    </div>
  )
}

'use client'

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export type PieEntry = {
  name: string
  emoji: string
  value: number
  color: string
  learnerNames: string[]
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: PieEntry }> }) {
  if (!active || !payload || payload.length === 0) return null
  const entry = payload[0].payload
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 max-w-[220px]">
      <p className="font-semibold text-sm mb-1">{entry.emoji} {entry.name}</p>
      <p className="text-xs text-gray-500 mb-1.5">
        {entry.value} apprenant{entry.value > 1 ? 's' : ''}
      </p>
      {entry.learnerNames.length > 0 && (
        <ul className="text-xs text-gray-700 space-y-0.5">
          {entry.learnerNames.map((n, i) => (
            <li key={i} className="flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-gray-400 shrink-0" />
              {n}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function WeatherPieChart({ data }: { data: PieEntry[] }) {
  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <ResponsiveContainer width="100%" height={230}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={88}
          paddingAngle={3}
          dataKey="value"
          label={({ value }) => `${Math.round((value / total) * 100)}%`}
          labelLine={false}
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          formatter={(_, entry) => {
            const e = (entry as { payload: PieEntry }).payload
            return `${e.emoji} ${e.name}`
          }}
          wrapperStyle={{ fontSize: '12px' }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

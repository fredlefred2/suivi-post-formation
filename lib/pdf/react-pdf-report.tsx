import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Svg,
  Circle,
  Path,
  Rect,
  G,
} from '@react-pdf/renderer'
import type { GroupReportData, LearnerReportData } from './group-report'
import type { AIReportAnalysis, LearnerAIAnalysis, LearnerAlert } from './ai-analysis'

// ── Couleurs ──
const C = {
  indigo950: '#1e1b4b',
  indigo800: '#3730a3',
  indigo700: '#4338ca',
  indigo600: '#4f46e5',
  indigo500: '#6366f1',
  indigo400: '#818cf8',
  indigo200: '#c7d2fe',
  indigo100: '#e0e7ff',
  indigo50: '#eef2ff',
  violet600: '#7c3aed',
  violet500: '#8b5cf6',
  violet100: '#ede9fe',
  textDark: '#111827',
  textMedium: '#6b7280',
  textLight: '#9ca3af',
  white: '#ffffff',
  sunny: '#f59e0b',
  sunnyBg: '#fffbeb',
  sunnyText: '#92400e',
  cloudy: '#3b82f6',
  cloudyBg: '#eff6ff',
  cloudyText: '#1e40af',
  stormy: '#ef4444',
  stormyBg: '#fef2f2',
  stormyText: '#991b1b',
  slate: '#64748b',
  sky: '#0ea5e9',
  emerald: '#10b981',
  orange: '#f97316',
  rose: '#e11d48',
  green: '#22c55e',
  greenLight: '#f0fdf4',
  redLight: '#fef2f2',
  bgLight: '#f8fafc',
  bgWarm: '#fafaf9',
  border: '#e2e8f0',
  borderLight: '#f1f5f9',
}

const LEVELS = [
  { label: 'Intention', color: C.slate, bg: '#f1f5f9' },
  { label: 'Essai', color: C.sky, bg: '#f0f9ff' },
  { label: 'Habitude', color: C.emerald, bg: '#ecfdf5' },
  { label: 'Réflexe', color: C.orange, bg: '#fff7ed' },
  { label: 'Maîtrise', color: C.rose, bg: '#fff1f2' },
]

function getLevelForActions(count: number) {
  if (count === 0) return { level: 0, ...LEVELS[0] }
  if (count <= 2) return { level: 1, ...LEVELS[1] }
  if (count <= 4) return { level: 2, ...LEVELS[2] }
  if (count <= 6) return { level: 3, ...LEVELS[3] }
  return { level: 4, ...LEVELS[4] }
}

function getWeatherScore(summary: { sunny: number; cloudy: number; stormy: number }): number {
  const total = summary.sunny + summary.cloudy + summary.stormy
  if (total === 0) return 3
  return (summary.sunny * 1 + summary.cloudy * 3 + summary.stormy * 5) / total
}

// ── SVG : arc pour donut chart ──
function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = {
    x: cx + r * Math.cos((startAngle - 90) * Math.PI / 180),
    y: cy + r * Math.sin((startAngle - 90) * Math.PI / 180),
  }
  const end = {
    x: cx + r * Math.cos((endAngle - 90) * Math.PI / 180),
    y: cy + r * Math.sin((endAngle - 90) * Math.PI / 180),
  }
  const largeArc = endAngle - startAngle > 180 ? 1 : 0
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`
}

// ── SVG : Donut Chart ──
function DonutChart({ data, size = 70, strokeWidth = 10 }: {
  data: Array<{ value: number; color: string; label: string }>
  size?: number
  strokeWidth?: number
}) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return null
  const cx = size / 2
  const cy = size / 2
  const r = (size - strokeWidth) / 2
  let currentAngle = 0

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={cx} cy={cy} r={r} fill="none" stroke={C.borderLight} strokeWidth={strokeWidth} />
      {data.filter(d => d.value > 0).map((d, i) => {
        const angle = (d.value / total) * 360
        // If this is the only segment, draw a full circle
        if (angle >= 359.9) {
          const path = (
            <Circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={d.color} strokeWidth={strokeWidth} />
          )
          return path
        }
        const endAngle = currentAngle + Math.max(angle, 1)
        const path = describeArc(cx, cy, r, currentAngle, endAngle)
        currentAngle = endAngle
        return (
          <Path key={i} d={path} fill="none" stroke={d.color} strokeWidth={strokeWidth} strokeLinecap="round" />
        )
      })}
      {/* Center text */}
      <Circle cx={cx} cy={cy} r={r - strokeWidth + 2} fill={C.white} />
    </Svg>
  )
}

// ── SVG : Progress Ring ──
function ProgressRing({ level, size = 50 }: { level: number; size?: number }) {
  const cx = size / 2
  const cy = size / 2
  const r = (size - 8) / 2
  const circumference = 2 * Math.PI * r
  const progress = ((level + 1) / 5) * circumference
  const levelData = LEVELS[level]

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={cx} cy={cy} r={r} fill="none" stroke={C.border} strokeWidth={4} />
      <Circle
        cx={cx} cy={cy} r={r} fill="none"
        stroke={levelData.color} strokeWidth={4}
        strokeDasharray={`${progress} ${circumference}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
      />
    </Svg>
  )
}

// ── SVG : Horizontal Progress Bar ──
function ProgressBar({ value, max, color, height = 6, width = 100 }: {
  value: number; max: number; color: string; height?: number; width?: number
}) {
  const pct = max > 0 ? Math.min(value / max, 1) : 0
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Rect x={0} y={0} width={width} height={height} rx={height / 2} fill={C.border} />
      <Rect x={0} y={0} width={Math.max(pct * width, height)} height={height} rx={height / 2} fill={color} />
    </Svg>
  )
}

// ══════════════════════════════════════════════════
// PAGE DE COUVERTURE
// ══════════════════════════════════════════════════

function CoverPage({ data, dateStr }: { data: GroupReportData; dateStr: string }) {
  return (
    <Page size="A4" style={{ fontFamily: 'Helvetica', backgroundColor: C.indigo950, position: 'relative' }}>
      {/* Geometric shapes */}
      <View style={{ position: 'absolute', top: 0, right: 0, width: 300, height: 300 }}>
        <Svg width={300} height={300} viewBox="0 0 300 300">
          <Circle cx={250} cy={50} r={180} fill={C.indigo800} opacity={0.4} />
          <Circle cx={280} cy={80} r={120} fill={C.violet600} opacity={0.25} />
          <Circle cx={200} cy={-20} r={80} fill={C.indigo600} opacity={0.3} />
        </Svg>
      </View>
      <View style={{ position: 'absolute', bottom: 0, left: 0, width: 250, height: 250 }}>
        <Svg width={250} height={250} viewBox="0 0 250 250">
          <Circle cx={-20} cy={200} r={150} fill={C.violet600} opacity={0.15} />
          <Circle cx={60} cy={250} r={100} fill={C.indigo600} opacity={0.2} />
        </Svg>
      </View>

      {/* Accent line */}
      <View style={{ position: 'absolute', top: 0, left: 0, width: 6, height: '100%', backgroundColor: C.violet500 }} />

      {/* Content */}
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 60 }}>
        {/* Logo */}
        <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: C.indigo400, letterSpacing: 8, marginBottom: 40 }}>
          YAPLUKA
        </Text>

        {/* Decorative line */}
        <View style={{ width: 60, height: 3, backgroundColor: C.violet500, marginBottom: 30 }} />

        {/* Title */}
        <Text style={{ fontSize: 12, color: C.indigo400, marginBottom: 8 }}>
          RAPPORT DE SUIVI
        </Text>
        <Text style={{ fontSize: 36, fontFamily: 'Helvetica-Bold', color: C.white, marginBottom: 6, lineHeight: 1.1 }}>
          {data.groupName}
        </Text>

        {/* Separator */}
        <View style={{ width: 40, height: 2, backgroundColor: C.indigo400, marginVertical: 24, opacity: 0.5 }} />

        {/* Meta */}
        <View style={{ flexDirection: 'row', gap: 30 }}>
          <View>
            <Text style={{ fontSize: 8, color: C.indigo400, marginBottom: 3, letterSpacing: 2 }}>FORMATEUR</Text>
            <Text style={{ fontSize: 13, color: C.white }}>{data.trainerName}</Text>
          </View>
          <View>
            <Text style={{ fontSize: 8, color: C.indigo400, marginBottom: 3, letterSpacing: 2 }}>DATE</Text>
            <Text style={{ fontSize: 13, color: C.white }}>{dateStr}</Text>
          </View>
          <View>
            <Text style={{ fontSize: 8, color: C.indigo400, marginBottom: 3, letterSpacing: 2 }}>PARTICIPANTS</Text>
            <Text style={{ fontSize: 13, color: C.white }}>{data.participantCount}</Text>
          </View>
        </View>
      </View>

      {/* Bottom bar */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: C.indigo800, paddingVertical: 14, paddingHorizontal: 60,
        flexDirection: 'row', justifyContent: 'space-between',
      }}>
        <Text style={{ fontSize: 8, color: C.indigo400 }}>Plateforme de suivi post-formation</Text>
        <Text style={{ fontSize: 8, color: C.indigo400 }}>Confidentiel</Text>
      </View>
    </Page>
  )
}

// ══════════════════════════════════════════════════
// COMPOSANTS RÉUTILISABLES
// ══════════════════════════════════════════════════

function PageShell({ children, dateStr }: { children: React.ReactNode; dateStr: string }) {
  return (
    <Page size="A4" style={{ fontFamily: 'Helvetica', fontSize: 9, color: C.textDark, paddingBottom: 36 }} wrap>
      {/* Top bar */}
      <View style={{
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 40, paddingVertical: 10,
        borderBottomWidth: 2, borderBottomColor: C.indigo600,
      }} fixed>
        <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.indigo600, letterSpacing: 3 }}>YAPLUKA</Text>
        <Text style={{ fontSize: 7, color: C.textLight }}>{dateStr}</Text>
      </View>
      {children}
      {/* Footer */}
      <View style={{
        position: 'absolute', bottom: 10, left: 40, right: 40,
        flexDirection: 'row', justifyContent: 'space-between',
      }} fixed>
        <Text style={{ fontSize: 6.5, color: C.textLight }}>Rapport de suivi post-formation</Text>
        <Text style={{ fontSize: 6.5, color: C.textLight }}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
        />
      </View>
    </Page>
  )
}

function SectionHeader({ title, accent = C.indigo600 }: { title: string; accent?: string }) {
  return (
    <View style={{ marginHorizontal: 40, marginTop: 20, marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 4, height: 18, backgroundColor: accent, borderRadius: 2 }} />
        <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: C.textDark }}>{title}</Text>
      </View>
    </View>
  )
}

function StatCard({ value, label, accent = C.indigo600, small = false }: {
  value: string; label: string; accent?: string; small?: boolean
}) {
  return (
    <View style={{
      flex: 1,
      backgroundColor: C.white,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: C.border,
      borderTopWidth: 3,
      borderTopColor: accent,
      paddingVertical: small ? 10 : 14,
      paddingHorizontal: 10,
      alignItems: 'center',
    }}>
      <Text style={{
        fontSize: small ? 20 : 28,
        fontFamily: 'Helvetica-Bold',
        color: C.textDark,
        marginBottom: 3,
      }}>{value}</Text>
      <Text style={{ fontSize: 7.5, color: C.textMedium, textAlign: 'center' }}>{label}</Text>
    </View>
  )
}

// ══════════════════════════════════════════════════
// PAGE SYNTHÈSE GROUPE
// ══════════════════════════════════════════════════

function GroupSummaryPage({ data, dateStr, aiAnalysis }: { data: GroupReportData; dateStr: string; aiAnalysis?: AIReportAnalysis | null }) {
  const groupDyn = getLevelForActions(data.avgActionsPerAxe)
  const totalWeathers = data.weatherSummary.sunny + data.weatherSummary.cloudy + data.weatherSummary.stormy

  const sorted = data.learners.map((l) => {
    const dyns = [0, 1, 2].map((i) => getLevelForActions(l.axeActionCounts[i] ?? 0))
    const totalLevel = dyns.reduce((acc, d) => acc + d.level, 0)
    return { ...l, dyns, totalLevel }
  }).sort((a, b) => b.totalLevel - a.totalLevel || b.totalActions - a.totalActions)

  const maxActions = Math.max(...data.learners.map(l => l.totalActions), 1)

  return (
    <PageShell dateStr={dateStr}>
      {/* Page title */}
      <View style={{ marginHorizontal: 40, marginTop: 20, marginBottom: 6 }}>
        <Text style={{ fontSize: 9, color: C.indigo600, fontFamily: 'Helvetica-Bold', letterSpacing: 2, marginBottom: 4 }}>
          VUE D'ENSEMBLE
        </Text>
        <Text style={{ fontSize: 22, fontFamily: 'Helvetica-Bold', color: C.textDark }}>
          {data.groupName}
        </Text>
        <Text style={{ fontSize: 9, color: C.textMedium, marginTop: 2 }}>
          {data.participantCount} participants
        </Text>
      </View>

      {/* KPI Row */}
      {(() => {
        const participationPct = data.participantCount > 0
          ? Math.round((data.activeLearnersCount / data.participantCount) * 100) : 0
        const actionsPerPerson = data.participantCount > 0
          ? (data.totalActions / data.participantCount).toFixed(1) : '0'
        const climatNote = data.groupClimatScore !== undefined && data.groupClimatScore !== null
          ? data.groupClimatScore.toFixed(1) : null
        return (
          <View style={{ flexDirection: 'row', marginHorizontal: 40, marginTop: 16, gap: 10 }}>
            <StatCard
              value={`${participationPct}%`}
              label={`${data.activeLearnersCount}/${data.participantCount} ont ete actifs`}
              accent={C.indigo600}
            />
            <StatCard
              value={actionsPerPerson}
              label="Actions par personne"
              accent={C.violet500}
            />
            <StatCard
              value={`${data.groupRegularityPct}%`}
              label="Regularite"
              accent={C.emerald}
            />
            <StatCard
              value={climatNote !== null ? `${climatNote}/5` : '-'}
              label={climatNote !== null ? 'Climat' : 'Aucun check-in'}
              accent={C.sunny}
            />
          </View>
        )
      })()}

      {/* Two columns: Météo donut + Dynamique */}
      <View style={{ flexDirection: 'row', marginHorizontal: 40, marginTop: 18, gap: 16 }}>
        {/* Météo */}
        <View style={{
          flex: 1, backgroundColor: C.white, borderRadius: 8,
          borderWidth: 1, borderColor: C.border, padding: 14,
        }}>
          <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.textDark, marginBottom: 10 }}>
            Climat du groupe
          </Text>
          {totalWeathers > 0 && data.groupClimatScore !== undefined ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              {/* Note sur 5 */}
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 32, fontFamily: 'Helvetica-Bold', color: data.groupClimatScore >= 4 ? C.sunny : data.groupClimatScore >= 2.5 ? C.cloudy : C.stormy }}>
                  {data.groupClimatScore.toFixed(1)}
                </Text>
                <Text style={{ fontSize: 9, color: C.textLight }}>/5</Text>
              </View>

              {/* Détail par type */}
              <View style={{ flex: 1, gap: 8 }}>
                {[
                  { emoji: 'Ca roule', count: data.weatherSummary.sunny, color: C.sunny, bg: C.sunnyBg },
                  { emoji: 'Mitige', count: data.weatherSummary.cloudy, color: C.cloudy, bg: C.cloudyBg },
                  { emoji: 'Difficile', count: data.weatherSummary.stormy, color: C.stormy, bg: C.stormyBg },
                ].map((w, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{
                      backgroundColor: w.bg, borderRadius: 10,
                      paddingHorizontal: 8, paddingVertical: 3,
                      flexDirection: 'row', alignItems: 'center', gap: 4,
                    }}>
                      <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: w.color }} />
                      <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: w.color }}>{w.count}</Text>
                    </View>
                    <Text style={{ fontSize: 8, color: C.textMedium }}>{w.emoji}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <Text style={{ fontSize: 9, color: C.textLight, fontStyle: 'italic' }}>Aucun check-in</Text>
          )}
        </View>

        {/* Dynamique */}
        <View style={{
          flex: 1, backgroundColor: C.white, borderRadius: 8,
          borderWidth: 1, borderColor: C.border, padding: 14,
        }}>
          <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.textDark, marginBottom: 10 }}>
            Dynamique du groupe
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ alignItems: 'center', position: 'relative' }}>
              <ProgressRing level={groupDyn.level} size={60} />
              <View style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                justifyContent: 'center', alignItems: 'center',
              }}>
                <Text style={{ fontSize: 16, fontFamily: 'Helvetica-Bold', color: groupDyn.color }}>
                  {groupDyn.level + 1}/5
                </Text>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: groupDyn.color, marginBottom: 4 }}>
                {groupDyn.label}
              </Text>
              <View style={{ gap: 3 }}>
                {LEVELS.map((lvl, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{
                      width: 6, height: 6, borderRadius: 3,
                      backgroundColor: i <= groupDyn.level ? lvl.color : C.border,
                    }} />
                    <Text style={{
                      fontSize: 7,
                      color: i <= groupDyn.level ? lvl.color : C.textLight,
                      fontFamily: i === groupDyn.level ? 'Helvetica-Bold' : 'Helvetica',
                    }}>
                      {lvl.label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Classement visuel */}
      <SectionHeader title="Classement des participants" accent={C.rose} />
      <View style={{ marginHorizontal: 40, gap: 6 }}>
        {sorted.map((l, idx) => (
          <View key={l.id} style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: idx === 0 ? C.indigo50 : C.white,
            borderRadius: 6, borderWidth: 1, borderColor: idx === 0 ? C.indigo200 : C.border,
            paddingVertical: 8, paddingHorizontal: 12, gap: 10,
          }}>
            {/* Rank */}
            <View style={{
              width: 22, height: 22, borderRadius: 11,
              backgroundColor: idx === 0 ? C.indigo600 : idx === 1 ? C.indigo400 : idx === 2 ? C.indigo200 : C.border,
              justifyContent: 'center', alignItems: 'center',
            }}>
              <Text style={{
                fontSize: 8, fontFamily: 'Helvetica-Bold',
                color: idx <= 1 ? C.white : C.textMedium,
              }}>{idx + 1}</Text>
            </View>

            {/* Name */}
            <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.textDark, width: 100 }}>
              {l.firstName} {l.lastName}
            </Text>

            {/* Progress bar */}
            <View style={{ flex: 1 }}>
              <ProgressBar value={l.totalActions} max={maxActions} color={C.indigo500} height={6} width={160} />
            </View>

            {/* Actions count */}
            <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.textDark, width: 30, textAlign: 'right' }}>
              {l.totalActions}
            </Text>

            {/* Level badges */}
            <View style={{ flexDirection: 'row', gap: 3 }}>
              {l.dyns.map((d, di) => (
                <View key={di} style={{
                  backgroundColor: d.bg, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4,
                }}>
                  <Text style={{ fontSize: 6, fontFamily: 'Helvetica-Bold', color: d.color }}>
                    {d.label.substring(0, 4).toUpperCase()}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>

      {/* Weather timeline */}
      {data.weatherHistory.length > 0 && (
        <>
          <SectionHeader title="Evolution du climat" accent={C.sunny} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginHorizontal: 40 }}>
            {[...data.weatherHistory].reverse().map((wh, i) => {
              const bgMap: Record<string, string> = { sunny: C.sunnyBg, cloudy: C.cloudyBg, stormy: C.stormyBg }
              const colorMap: Record<string, string> = { sunny: C.sunny, cloudy: C.cloudy, stormy: C.stormy }
              const textMap: Record<string, string> = { sunny: C.sunnyText, cloudy: C.cloudyText, stormy: C.stormyText }
              const iconMap: Record<string, string> = { sunny: '●', cloudy: '◐', stormy: '◉' }
              return (
                <View key={i} style={{
                  backgroundColor: bgMap[wh.weather] || C.border,
                  paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
                  flexDirection: 'row', alignItems: 'center', gap: 4,
                }}>
                  <Text style={{ fontSize: 8, color: colorMap[wh.weather] || C.textLight }}>
                    {iconMap[wh.weather] || '○'}
                  </Text>
                  <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: textMap[wh.weather] || C.textDark }}>
                    S{wh.week}
                  </Text>
                </View>
              )
            })}
          </View>
        </>
      )}

      {/* Narrative Summary */}
      {aiAnalysis?.groupSummary && (
        <>
          <SectionHeader title="En resume" accent={C.violet600} />
          <View style={{
            marginHorizontal: 40,
            backgroundColor: C.violet100,
            borderRadius: 8,
            borderLeftWidth: 4,
            borderLeftColor: C.violet600,
            padding: 16,
          }}>
            <Text style={{ fontSize: 9, color: C.textDark, lineHeight: 1.5 }}>
              {aiAnalysis.groupSummary}
            </Text>
          </View>
        </>
      )}
    </PageShell>
  )
}

// ══════════════════════════════════════════════════
// PAGE POINTS D'ATTENTION & RECOMMANDATIONS
// ══════════════════════════════════════════════════

function AlertsAndRecommendationsPage({ aiAnalysis, dateStr }: { aiAnalysis: AIReportAnalysis; dateStr: string }) {
  const alertColors: Record<string, { bg: string; border: string; text: string; badge: string }> = {
    red: { bg: '#fef2f2', border: C.stormy, text: '#991b1b', badge: '#dc2626' },
    yellow: { bg: '#fffbeb', border: C.sunny, text: '#92400e', badge: '#d97706' },
    green: { bg: '#f0fdf4', border: C.green, text: '#166534', badge: '#16a34a' },
  }
  const alertLabels: Record<string, string> = { red: 'A ACCOMPAGNER', yellow: 'A ENCOURAGER', green: 'BONNE DYNAMIQUE' }

  return (
    <PageShell dateStr={dateStr}>
      {/* Alerts */}
      <View style={{ marginHorizontal: 40, marginTop: 20, marginBottom: 6 }}>
        <Text style={{ fontSize: 9, color: C.violet600, fontFamily: 'Helvetica-Bold', letterSpacing: 2, marginBottom: 4 }}>
          SUIVI
        </Text>
        <Text style={{ fontSize: 22, fontFamily: 'Helvetica-Bold', color: C.textDark }}>
          Suivi individuel & Recommandations
        </Text>
      </View>

      <SectionHeader title="Situation par participant" accent={C.sunny} />
      <View style={{ marginHorizontal: 40, gap: 6 }}>
        {aiAnalysis.alerts.map((alert, i) => {
          const colors = alertColors[alert.level] || alertColors.yellow
          return (
            <View key={i} style={{
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: colors.bg, borderRadius: 8,
              borderWidth: 1, borderColor: colors.border + '40',
              borderLeftWidth: 4, borderLeftColor: colors.border,
              paddingVertical: 10, paddingHorizontal: 14, gap: 10,
            }} wrap={false}>
              {/* Badge */}
              <View style={{
                backgroundColor: colors.badge, borderRadius: 4,
                paddingHorizontal: 6, paddingVertical: 2,
              }}>
                <Text style={{ fontSize: 6, fontFamily: 'Helvetica-Bold', color: C.white, letterSpacing: 1 }}>
                  {alertLabels[alert.level] || 'INFO'}
                </Text>
              </View>
              {/* Name */}
              <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.textDark, width: 90 }}>
                {alert.learnerName}
              </Text>
              {/* Message */}
              <Text style={{ fontSize: 8.5, color: colors.text, flex: 1 }}>
                {alert.message}
              </Text>
            </View>
          )
        })}
      </View>

      {/* Manager Recommendations */}
      <SectionHeader title="Recommandations pour le manager" accent={C.indigo600} />
      <View style={{ marginHorizontal: 40, gap: 8 }}>
        {aiAnalysis.managerRecommendations.map((rec, i) => (
          <View key={i} style={{
            flexDirection: 'row', gap: 12, alignItems: 'flex-start',
            backgroundColor: C.white, borderRadius: 8,
            borderWidth: 1, borderColor: C.border,
            paddingVertical: 12, paddingHorizontal: 16,
          }} wrap={false}>
            <View style={{
              width: 24, height: 24, borderRadius: 12,
              backgroundColor: C.indigo600, justifyContent: 'center', alignItems: 'center',
              flexShrink: 0,
            }}>
              <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.white }}>{i + 1}</Text>
            </View>
            <Text style={{ fontSize: 9, color: C.textDark, flex: 1, lineHeight: 1.5 }}>
              {rec}
            </Text>
          </View>
        ))}
      </View>

    </PageShell>
  )
}

// ══════════════════════════════════════════════════
// PAGE APPRENANT
// ══════════════════════════════════════════════════

function LearnerPage({ learner, dateStr, aiAnalysis }: { learner: LearnerReportData; dateStr: string; aiAnalysis?: LearnerAIAnalysis | null }) {
  const joinDate = new Date(learner.createdAt).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
  const totalWeathers = learner.weatherSummary.sunny + learner.weatherSummary.cloudy + learner.weatherSummary.stormy
  const avgAxeActions = learner.axes.length > 0 ? learner.totalActions / learner.axes.length : 0
  const learnerDyn = getLevelForActions(avgAxeActions)

  return (
    <PageShell dateStr={dateStr}>
      {/* Header with name and level */}
      <View style={{
        marginHorizontal: 40, marginTop: 20,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
      }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 22, fontFamily: 'Helvetica-Bold', color: C.textDark }}>
            {learner.firstName} {learner.lastName}
          </Text>
          <Text style={{ fontSize: 9, color: C.textMedium, marginTop: 2 }}>
            Inscrit(e) le {joinDate}
          </Text>
        </View>
        {/* Level badge */}
        <View style={{
          backgroundColor: learnerDyn.bg,
          borderWidth: 1, borderColor: learnerDyn.color + '40',
          borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8,
          alignItems: 'center',
        }}>
          <Text style={{ fontSize: 18, fontFamily: 'Helvetica-Bold', color: learnerDyn.color }}>
            {learnerDyn.label}
          </Text>
          <Text style={{ fontSize: 7, color: learnerDyn.color, marginTop: 1 }}>
            {learner.totalActions} actions
          </Text>
        </View>
      </View>

      {/* Stats row */}
      {(() => {
        // Note climat individuel : sunny=5, cloudy=3, stormy=1
        const climatScore = totalWeathers > 0
          ? ((learner.weatherSummary.sunny * 5 + learner.weatherSummary.cloudy * 3 + learner.weatherSummary.stormy * 1) / totalWeathers)
          : null
        return (
          <View style={{ flexDirection: 'row', marginHorizontal: 40, marginTop: 14, gap: 10 }}>
            <StatCard value={String(learner.totalActions)} label="Actions" accent={C.indigo600} small />
            <StatCard value={`${learner.regularityPct}%`} label="Regularite" accent={C.emerald} small />
            <StatCard value={`${learner.weeksSinceJoin} sem.`} label="Anciennete" accent={C.violet500} small />
            <StatCard
              value={climatScore !== null ? `${climatScore.toFixed(1)}/5` : '-'}
              label={climatScore !== null ? 'Climat' : 'Aucun check-in'}
              accent={C.sunny}
              small
            />
          </View>
        )
      })()}

      {/* Weather timeline (compact) */}
      {learner.weatherHistory.length > 0 && (
        <View style={{
          marginHorizontal: 40, marginTop: 12, backgroundColor: C.bgLight,
          borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8,
        }}>
          <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.textMedium, marginBottom: 6 }}>
            Evolution du climat
          </Text>
          <View style={{ flexDirection: 'row', gap: 5, flexWrap: 'wrap' }}>
            {[...learner.weatherHistory].reverse().map((wh, i) => {
              const bgMap: Record<string, string> = { sunny: C.sunnyBg, cloudy: C.cloudyBg, stormy: C.stormyBg }
              const colorMap: Record<string, string> = { sunny: C.sunny, cloudy: C.cloudy, stormy: C.stormy }
              const textMap: Record<string, string> = { sunny: C.sunnyText, cloudy: C.cloudyText, stormy: C.stormyText }
              return (
                <View key={i} style={{
                  backgroundColor: bgMap[wh.weather] || C.border, borderRadius: 10,
                  paddingHorizontal: 8, paddingVertical: 3,
                  flexDirection: 'row', alignItems: 'center', gap: 5,
                }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colorMap[wh.weather] || C.textLight }} />
                  <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: textMap[wh.weather] || C.textDark }}>
                    S{wh.week}
                  </Text>
                </View>
              )
            })}
          </View>
        </View>
      )}

      {/* Axes de progrès */}
      {learner.axes.length > 0 && (
        <>
          <SectionHeader title="Axes de progres" accent={C.violet500} />
          <View style={{ marginHorizontal: 40, gap: 10 }}>
            {learner.axes.map((axe, i) => {
              const count = learner.axeActionCounts[i] ?? 0
              const dyn = getLevelForActions(count)
              const actions = learner.axeActions[i] ?? []
              return (
                <View key={i} style={{
                  backgroundColor: C.white, borderRadius: 8,
                  borderWidth: 1, borderColor: C.border,
                  borderLeftWidth: 4, borderLeftColor: dyn.color,
                  padding: 12,
                }} wrap={false}>
                  {/* Axe header */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.textDark, flex: 1 }}>
                      {axe}
                    </Text>
                    <View style={{
                      backgroundColor: dyn.bg, borderRadius: 10,
                      paddingHorizontal: 8, paddingVertical: 3,
                    }}>
                      <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: dyn.color }}>
                        {dyn.label} ({count})
                      </Text>
                    </View>
                  </View>

                  {/* Progress bar */}
                  <View style={{ marginBottom: 6 }}>
                    <ProgressBar value={count} max={9} color={dyn.color} height={4} width={200} />
                  </View>

                  {/* Actions list */}
                  {actions.length > 0 ? (
                    <View style={{ gap: 2 }}>
                      {actions.map((desc, j) => (
                        <View key={j} style={{ flexDirection: 'row', gap: 4 }}>
                          <Text style={{ fontSize: 7, color: dyn.color }}>●</Text>
                          <Text style={{ fontSize: 8, color: C.textMedium, flex: 1 }}>{desc}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={{ fontSize: 8, color: C.textLight, fontStyle: 'italic' }}>
                      Aucune action enregistree
                    </Text>
                  )}
                </View>
              )
            })}
          </View>
        </>
      )}

      {/* Feedback: 2 columns */}
      {(learner.whatWorked.length > 0 || learner.difficulties.length > 0) && (
        <View style={{ flexDirection: 'row', marginHorizontal: 40, marginTop: 16, gap: 12 }}>
          {/* Ce qui a marché */}
          {learner.whatWorked.length > 0 && (
            <View style={{
              flex: 1, backgroundColor: C.greenLight, borderRadius: 8,
              borderWidth: 1, borderColor: C.green + '30', padding: 12,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: C.green, justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ fontSize: 8, color: C.white, fontFamily: 'Helvetica-Bold' }}>+</Text>
                </View>
                <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.green }}>Ce qui a marche</Text>
              </View>
              {learner.whatWorked.map((text, i) => (
                <Text key={i} style={{ fontSize: 8, color: C.textDark, marginBottom: 3 }}>
                  {text}
                </Text>
              ))}
            </View>
          )}

          {/* Difficultés */}
          {learner.difficulties.length > 0 && (
            <View style={{
              flex: 1, backgroundColor: C.redLight, borderRadius: 8,
              borderWidth: 1, borderColor: C.stormy + '30', padding: 12,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: C.stormy, justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ fontSize: 8, color: C.white, fontFamily: 'Helvetica-Bold' }}>!</Text>
                </View>
                <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.stormy }}>Difficultes</Text>
              </View>
              {learner.difficulties.map((text, i) => (
                <Text key={i} style={{ fontSize: 8, color: C.textDark, marginBottom: 3 }}>
                  {text}
                </Text>
              ))}
            </View>
          )}
        </View>
      )}

      {/* AI Analysis encadré */}
      {aiAnalysis && (
        <View style={{
          marginHorizontal: 40, marginTop: 16,
          backgroundColor: C.violet100, borderRadius: 8,
          borderLeftWidth: 4, borderLeftColor: C.violet600,
          padding: 14,
        }} wrap={false}>
          <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.violet600, marginBottom: 10 }}>
            Analyse personnalisee
          </Text>

          {/* Ce qui est mis en pratique */}
          <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.textMedium, marginBottom: 3, letterSpacing: 1 }}>
            MISE EN PRATIQUE
          </Text>
          <Text style={{ fontSize: 8.5, color: C.textDark, lineHeight: 1.5, marginBottom: 10 }}>
            {aiAnalysis.practice}
          </Text>

          {/* Ce qui reste à travailler */}
          <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.textMedium, marginBottom: 3, letterSpacing: 1 }}>
            A TRAVAILLER
          </Text>
          <Text style={{ fontSize: 8.5, color: C.textDark, lineHeight: 1.5, marginBottom: 10 }}>
            {aiAnalysis.toImprove}
          </Text>

          {/* Actions manager */}
          <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.textMedium, marginBottom: 5, letterSpacing: 1 }}>
            COMMENT L'ACCOMPAGNER
          </Text>
          <View style={{ gap: 4 }}>
            {aiAnalysis.managerActions.map((action, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }}>
                <View style={{
                  width: 14, height: 14, borderRadius: 7,
                  backgroundColor: C.violet600 + '20', justifyContent: 'center', alignItems: 'center',
                  flexShrink: 0, marginTop: 1,
                }}>
                  <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.violet600 }}>{i + 1}</Text>
                </View>
                <Text style={{ fontSize: 8.5, color: C.textDark, flex: 1, lineHeight: 1.4 }}>
                  {action}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </PageShell>
  )
}

// ══════════════════════════════════════════════════
// DOCUMENT COMPLET
// ══════════════════════════════════════════════════

export function GroupReportDocument({ data, aiAnalysis }: { data: GroupReportData; aiAnalysis?: AIReportAnalysis | null }) {
  const dateStr = new Date(data.generatedAt).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  // Map des analyses individuelles par learnerId
  const learnerAnalysisMap = new Map<string, LearnerAIAnalysis>()
  if (aiAnalysis?.learnerAnalyses) {
    aiAnalysis.learnerAnalyses.forEach((la) => learnerAnalysisMap.set(la.learnerId, la))
  }

  return (
    <Document
      title={`Rapport ${data.groupName}`}
      author="YAPLUKA"
      subject="Rapport de suivi post-formation"
    >
      <CoverPage data={data} dateStr={dateStr} />
      <GroupSummaryPage data={data} dateStr={dateStr} aiAnalysis={aiAnalysis} />
      {data.learners.map((learner) => (
        <LearnerPage
          key={learner.id}
          learner={learner}
          dateStr={dateStr}
          aiAnalysis={learnerAnalysisMap.get(learner.id) || null}
        />
      ))}
      {aiAnalysis && (
        <AlertsAndRecommendationsPage aiAnalysis={aiAnalysis} dateStr={dateStr} />
      )}
    </Document>
  )
}

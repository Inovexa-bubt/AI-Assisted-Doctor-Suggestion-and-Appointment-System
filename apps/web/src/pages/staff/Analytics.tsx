import { type Lang, SYMPTOM_BY_ID, addDays, dhakaDate } from '@inovexa/shared'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { Table2 } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api } from '../../api/endpoints.ts'
import { Card, ErrorState, PageHeader, Segmented, Spinner } from '../../components/ui.tsx'
import { useI18n } from '../../i18n/index.ts'
import { formatDate, formatNumber, formatPercent, formatTime, pick } from '../../lib/format.ts'

// One series per chart, so one hue: teal-600, checked with the dataviz palette validator
// (lightness band, chroma floor and contrast against the white surface all pass).
const MARK = '#0d9488'
const GRID = '#e2e8f0'
const INK_MUTED = '#64748b'
const AXIS_TICK = { fill: INK_MUTED, fontSize: 12 }

type Range = '7' | '30' | '90'

interface Datum {
  label: string
  value: number
}

const hourLabel = (hour: number, lang: Lang) => {
  const t = formatTime(`${String(hour).padStart(2, '0')}:00`, lang)
  return lang === 'bn' ? t.replace(':০০', 'টা') : t.replace(':00', '')
}

interface TooltipProps {
  active?: boolean
  payload?: ReadonlyArray<{ value?: unknown; payload?: { full?: string; label?: string } }>
}

/** Value first and strong, the category under it. */
function ChartTooltip({ active, payload, lang }: TooltipProps & { lang: Lang }) {
  const item = payload?.[0]
  if (!active || !item) return null
  return (
    <div className="rounded-lg bg-white px-3 py-2 text-sm shadow-lg ring-1 ring-slate-200">
      <p className="font-semibold text-slate-900 tabular-nums">
        {formatNumber(Number(item.value), lang)}
      </p>
      <p className="text-slate-500">{item.payload?.full ?? item.payload?.label}</p>
    </div>
  )
}

/** A chart with a switch to the same numbers as a table. */
function ChartCard({
  title,
  note,
  data,
  children,
  className,
  dimmed,
}: {
  title: string
  note?: string
  data: Datum[]
  children: ReactNode
  className?: string
  dimmed: boolean
}) {
  const { t, lang } = useI18n()
  const [asTable, setAsTable] = useState(false)
  return (
    <Card className={clsx('p-5', className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-900">{title}</h2>
          {note && <p className="text-sm text-slate-500">{note}</p>}
        </div>
        <button
          type="button"
          onClick={() => setAsTable((v) => !v)}
          aria-pressed={asTable}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
        >
          <Table2 className="size-3.5" aria-hidden />
          {t('analytics.table')}
        </button>
      </div>
      <div className={clsx('transition-opacity', dimmed && 'opacity-50')}>
        {asTable ? (
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-1 font-medium">{title}</th>
                  <th className="py-1 text-right font-medium">{t('analytics.count')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((d) => (
                  <tr key={d.label}>
                    <td className="py-1.5 text-slate-800">{d.label}</td>
                    <td className="py-1.5 text-right text-slate-900 tabular-nums">
                      {formatNumber(d.value, lang)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          children
        )}
      </div>
    </Card>
  )
}

/** Horizontal bars, largest first, with the value at each bar's tip. */
function RankedBars({ data }: { data: Array<Datum & { full: string }> }) {
  const { lang } = useI18n()
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 32)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 40, bottom: 0, left: 0 }}
        barCategoryGap={4}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="label"
          width={176}
          tickLine={false}
          axisLine={false}
          tick={AXIS_TICK}
          interval={0}
        />
        <Tooltip
          cursor={{ fill: '#f1f5f9' }}
          content={(p) => <ChartTooltip active={p.active} payload={p.payload} lang={lang} />}
        />
        <Bar
          dataKey="value"
          fill={MARK}
          radius={[0, 4, 4, 0]}
          maxBarSize={24}
          isAnimationActive={false}
        >
          <LabelList
            dataKey="value"
            position="right"
            className="fill-slate-700 text-xs tabular-nums"
            formatter={(v) => formatNumber(Number(v), lang)}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

const shorten = (text: string, max = 26) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text

export default function Analytics() {
  const { t, lang } = useI18n()
  const [range, setRange] = useState<Range>('30')
  const to = dhakaDate()
  const from = addDays(to, -(Number(range) - 1))
  const summary = useQuery({
    queryKey: ['analytics', from, to],
    queryFn: () => api.analytics(from, to),
    placeholderData: keepPreviousData,
  })
  const specialties = useQuery({ queryKey: ['admin-specialties'], queryFn: api.adminSpecialties })

  const header = (
    <>
      <PageHeader
        title={t('analytics.title')}
        subtitle={t('analytics.range', {
          from: formatDate(from, lang, 'short'),
          to: formatDate(to, lang, 'short'),
        })}
      />
      <div className="mb-5">
        <Segmented
          label={t('analytics.title')}
          value={range}
          onChange={setRange}
          options={[
            { value: '7', label: t('analytics.last7') },
            { value: '30', label: t('analytics.last30') },
            { value: '90', label: t('analytics.last90') },
          ]}
        />
      </div>
    </>
  )

  if (summary.isPending)
    return (
      <div>
        {header}
        <Spinner />
      </div>
    )
  if (summary.error)
    return (
      <div>
        {header}
        <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />
      </div>
    )

  const s = summary.data
  const dimmed = summary.isFetching && summary.isPlaceholderData
  const specialtyName = (id: string) => {
    const sp = specialties.data?.find((x) => x.id === id)
    return sp ? pick(sp.name, lang) : id
  }
  const bySpecialty = s.bySpecialty.map((d) => {
    const full = specialtyName(d.specialtyId)
    return { label: shorten(full), full, value: d.count }
  })
  const problems = s.commonProblems.map((p) => {
    const full = SYMPTOM_BY_ID.get(p.tag)?.label[lang] ?? p.tag
    return { label: shorten(full), full, value: p.count }
  })
  // Every hour from the first to the last, so quiet hours show as gaps instead of disappearing.
  const hourCounts = new Map(s.byHour.map((h) => [h.hour, h.count]))
  const firstHour = Math.min(...s.byHour.map((h) => h.hour))
  const lastHour = Math.max(...s.byHour.map((h) => h.hour))
  const hours = s.byHour.length
    ? Array.from({ length: lastHour - firstHour + 1 }, (_, i) => ({
        label: hourLabel(firstHour + i, lang),
        value: hourCounts.get(firstHour + i) ?? 0,
      }))
    : []
  const peak = hours.reduce((max, h) => (h.value > max ? h.value : max), 0)
  const days = s.byDay.map((d) => ({ label: formatDate(d.date, lang, 'short'), value: d.count }))

  const tiles = [
    { label: t('analytics.bookings'), value: formatNumber(s.totalBookings, lang) },
    { label: t('analytics.seen'), value: formatNumber(s.seen, lang) },
    { label: t('analytics.noShowRate'), value: formatPercent(s.noShowRate, lang) },
    { label: t('analytics.cancelled'), value: formatNumber(s.cancelled, lang) },
  ]

  return (
    <div className="max-w-6xl">
      {header}
      <div
        className={clsx(
          'grid grid-cols-2 gap-3 transition-opacity lg:grid-cols-4',
          dimmed && 'opacity-50',
        )}
      >
        {tiles.map((tile) => (
          <Card key={tile.label} className="p-4">
            <p className="text-sm text-slate-500">{tile.label}</p>
            <p className="mt-1 text-3xl font-semibold text-slate-900">{tile.value}</p>
          </Card>
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <ChartCard
          title={t('analytics.perDay')}
          data={days}
          className="lg:col-span-2"
          dimmed={dimmed}
        >
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={days} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={{ stroke: GRID }}
                tick={AXIS_TICK}
                minTickGap={24}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tick={AXIS_TICK}
                tickFormatter={(v) => formatNumber(Number(v), lang)}
              />
              <Tooltip
                cursor={{ stroke: INK_MUTED, strokeWidth: 1 }}
                content={(p) => <ChartTooltip active={p.active} payload={p.payload} lang={lang} />}
              />
              <Area
                type="linear"
                dataKey="value"
                stroke={MARK}
                strokeWidth={2}
                fill={MARK}
                fillOpacity={0.1}
                activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2, fill: MARK }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t('analytics.bySpecialty')} data={bySpecialty} dimmed={dimmed}>
          <RankedBars data={bySpecialty} />
        </ChartCard>

        <ChartCard
          title={t('analytics.commonProblems')}
          note={t('analytics.problemsNote')}
          data={problems}
          dimmed={dimmed}
        >
          <RankedBars data={problems} />
        </ChartCard>

        <ChartCard
          title={t('analytics.peakHours')}
          note={t('analytics.peakHoursNote')}
          data={hours}
          className="lg:col-span-2"
          dimmed={dimmed}
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={hours}
              margin={{ top: 20, right: 8, bottom: 0, left: -16 }}
              barCategoryGap="20%"
            >
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={{ stroke: GRID }}
                tick={AXIS_TICK}
                interval="preserveStartEnd"
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tick={AXIS_TICK}
                tickFormatter={(v) => formatNumber(Number(v), lang)}
              />
              <Tooltip
                cursor={{ fill: '#f1f5f9' }}
                content={(p) => <ChartTooltip active={p.active} payload={p.payload} lang={lang} />}
              />
              <Bar
                dataKey="value"
                fill={MARK}
                radius={[4, 4, 0, 0]}
                maxBarSize={24}
                isAnimationActive={false}
              >
                {/* Label only the busiest hour; the axis and tooltip carry the rest. */}
                <LabelList
                  dataKey="value"
                  position="top"
                  className="fill-slate-700 text-xs"
                  formatter={(v) => (Number(v) === peak ? formatNumber(Number(v), lang) : '')}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}

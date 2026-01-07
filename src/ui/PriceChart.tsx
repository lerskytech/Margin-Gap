import { useState, useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { Timeframe, PriceTimeSeriesPoint } from '@/lib/types'
import { buildChartSeries } from '@/features/charts/buildSeries'
import { formatCurrency } from '@/lib/utils'
import { getLineDescription } from '@/lib/productContext'
import { Button } from './Button'

interface PriceChartProps {
  timeframe: Timeframe
  msrp?: number
  timeSeriesData?: PriceTimeSeriesPoint[]
}

export function PriceChart({ timeframe, msrp, timeSeriesData }: PriceChartProps) {
  const [visibleLines, setVisibleLines] = useState<Set<string>>(
    new Set(['local_used', 'national_used', 'shippable', 'new', 'msrp', 'ebay_active', 'ebay_sold'])
  )

  // Use provided time series data or fallback to empty array
  const timeSeries = useMemo(() => {
    if (!timeSeriesData || !Array.isArray(timeSeriesData)) {
      return []
    }
    return timeSeriesData
  }, [timeSeriesData])

  const series = useMemo(
    () => {
      try {
        const result = buildChartSeries(timeSeries, timeframe, visibleLines, msrp)
        if (!Array.isArray(result)) {
          return []
        }
        return result
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('[PriceChart] Error building series:', error)
        }
        return []
      }
    },
    [timeSeries, timeframe, visibleLines, msrp]
  )

  const toggleLine = (name: string) => {
    const newVisible = new Set(visibleLines)
    if (newVisible.has(name)) {
      newVisible.delete(name)
    } else {
      newVisible.add(name)
    }
    setVisibleLines(newVisible)
  }

  // Transform data for Recharts - use epoch ms for x-axis
  const chartData = useMemo(() => {
    if (!Array.isArray(series) || series.length === 0) {
      return []
    }

    try {
      // Group by timestamp (epoch ms) - this is the x-axis key
      const tsMap = new Map<number, Record<string, number | string>>()

      series.forEach(s => {
        if (!s || !s.visible || !Array.isArray(s.data)) return
        s.data.forEach(point => {
          if (!point || typeof point.ts !== 'number' || !Number.isFinite(point.ts)) return
          const price = typeof point.price === 'number' && Number.isFinite(point.price) 
            ? point.price 
            : null
          if (price === null) return

          if (!tsMap.has(point.ts)) {
            tsMap.set(point.ts, { 
              ts: point.ts,
              date: point.date || new Date(point.ts).toISOString().split('T')[0],
            })
          }
          const entry = tsMap.get(point.ts)!
          entry[s.name] = price
        })
      })

      // Sort by timestamp
      const sorted = Array.from(tsMap.values()).sort((a, b) => {
        const tsA = typeof a.ts === 'number' ? a.ts : 0
        const tsB = typeof b.ts === 'number' ? b.ts : 0
        return tsA - tsB
      })

      return sorted
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[PriceChart] Error transforming data:', error)
      }
      return []
    }
  }, [series])

  // Add reference baseline line if msrp is provided
  const hasBaseline = msrp !== undefined && Number.isFinite(msrp) && msrp > 0
  const baselineData = useMemo(() => {
    if (!Array.isArray(chartData) || chartData.length === 0) {
      return []
    }
    if (hasBaseline && msrp) {
      return chartData.map(d => ({ ...d, MSRP: msrp }))
    }
    return chartData
  }, [chartData, hasBaseline, msrp])

  // Get last point for annotation
  const lastPoint = Array.isArray(chartData) && chartData.length > 0 
    ? chartData[chartData.length - 1] 
    : null
  const lastPointValue = lastPoint && Array.isArray(series) && series.length > 0 && series[0]?.visible
    ? lastPoint[series[0].name]
    : null
  
  const hasLimitedHistory = !Array.isArray(chartData) || chartData.length < 2
  const hasData = Array.isArray(chartData) && chartData.length > 0
  const safeSeries = Array.isArray(series) ? series : []
  
  // Dev indicator: show filtered point count
  const filteredPointCount = useMemo(() => {
    if (!Array.isArray(series) || series.length === 0) return 0
    return series.reduce((sum, s) => sum + (s.data?.length || 0), 0)
  }, [series])

  return (
    <div>
      {import.meta.env.DEV && hasData && (
        <div className="mb-2 text-xs text-muted-foreground/60 font-mono">
          Filtered: {filteredPointCount} points | Chart: {chartData.length} timestamps | Range: {timeframe}
        </div>
      )}
      {/* Legend/Toggles - Scrollable on mobile */}
      <div className="flex gap-2 mb-4 sm:mb-6 overflow-x-auto -mx-2 px-2 pb-2 scrollbar-none">
        {safeSeries.map(s => {
          if (!s || !s.name) return null
          return (
          <div key={s.name} className="relative group flex-shrink-0">
            <Button
              variant={s.visible ? 'primary' : 'outline'}
              size="sm"
              onClick={() => toggleLine(s.name)}
              className="text-xs flex items-center gap-1.5 min-h-[40px] px-3"
              title={getLineDescription(s.name)}
            >
              <div 
                className="w-2 h-2 rounded-full flex-shrink-0" 
                style={{ backgroundColor: s.visible ? s.color : 'currentColor' }}
              />
              <span className="whitespace-nowrap">{s.name}</span>
            </Button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-20 pointer-events-none">
              <div className="bg-popover border border-border rounded-md px-2 py-1.5 text-xs text-popover-foreground shadow-lg whitespace-nowrap max-w-xs">
                {getLineDescription(s.name)}
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
                  <div className="w-2 h-2 bg-popover border-r border-b border-border rotate-45"></div>
                </div>
              </div>
            </div>
          </div>
          )
        })}
      </div>
      <div className="relative">
        {!hasData && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">No data yet</p>
              <p className="text-xs text-muted-foreground/60">Run a scan to see price trends</p>
            </div>
          </div>
        )}
        {hasLimitedHistory && hasData && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <p className="text-xs text-muted-foreground/70 font-mono bg-background/80 px-2 py-1 rounded">
              Limited history — scan again to build timeline
            </p>
          </div>
        )}
        {hasData ? (
          <ResponsiveContainer width="100%" height={320} className="sm:h-[420px] lg:h-[500px]">
        <LineChart data={baselineData}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis 
            dataKey="ts" 
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tick={{ fontSize: 11 }}
            interval="preserveStartEnd"
            tickFormatter={(value) => {
              try {
                return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              } catch {
                return ''
              }
            }}
          />
          <YAxis 
            tick={{ fontSize: 11 }}
            width={60}
            tickFormatter={(value) => formatCurrency(value)}
          />
          <Tooltip
            formatter={(value: number) => formatCurrency(value)}
            labelFormatter={(label) => {
              try {
                return new Date(label).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric',
                  year: 'numeric'
                })
              } catch {
                return String(label)
              }
            }}
            contentStyle={{
              backgroundColor: 'hsl(var(--surface))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '0.5rem',
              padding: '0.5rem',
              maxWidth: 'calc(100vw - 2rem)',
            }}
          />
          <Legend 
            formatter={(value) => value}
          />
          {hasBaseline && (
            <Line
              type="monotone"
              dataKey="MSRP"
              stroke="#6b7280"
              strokeWidth={1.5}
              strokeDasharray="5 5"
              dot={false}
              name="MSRP"
            />
          )}
          {safeSeries.filter(s => s.visible).map(s => (
            <Line
              key={s.name}
              type="monotone"
              dataKey={s.name}
              stroke={s.color}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              name={s.name}
            />
          ))}
        </LineChart>
        </ResponsiveContainer>
        ) : (
          <div className="w-full h-[320px] sm:h-[420px] lg:h-[500px] flex items-center justify-center border border-border rounded">
            <div className="text-center text-muted-foreground px-4">
              <p className="text-sm">No chart data available</p>
            </div>
          </div>
        )}
      </div>
      {lastPointValue && lastPoint && (
        <div className="mt-2 text-xs text-muted-foreground text-center">
          Last point: {formatCurrency(lastPointValue as number)} on {
            typeof lastPoint.ts === 'number' 
              ? new Date(lastPoint.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              : lastPoint.date 
                ? new Date(lastPoint.date as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : 'Unknown'
          }
        </div>
      )}
    </div>
  )
}

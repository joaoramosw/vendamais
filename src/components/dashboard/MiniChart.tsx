"use client"

import type { ChartDataPoint } from "@/actions/dashboard"

interface MiniChartProps {
  data: ChartDataPoint[]
  label?: string
  color?: string
}

export function MiniChart({
  data,
  label = "Últimos 7 dias",
  color = "#6366F1",
}: MiniChartProps) {
  if (!data || data.length === 0) return null

  const maxVal = Math.max(...data.map((d) => d.value), 1)
  const width = 100
  const height = 50
  const padding = { top: 4, right: 2, bottom: 0, left: 2 }
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom

  // Build path points
  const points = data.map((d, i) => ({
    x: padding.left + (i / (data.length - 1)) * chartW,
    y: padding.top + chartH - (d.value / maxVal) * chartH,
  }))

  // Smooth curve using catmull-rom → bezier approximation
  const linePath = points
    .map((p, i) => {
      if (i === 0) return `M ${p.x},${p.y}`
      const prev = points[i - 1]
      const cpX = (prev.x + p.x) / 2
      return `C ${cpX},${prev.y} ${cpX},${p.y} ${p.x},${p.y}`
    })
    .join(" ")

  // Area path (fill under the line)
  const areaPath = `${linePath} L ${points[points.length - 1].x},${padding.top + chartH} L ${points[0].x},${padding.top + chartH} Z`

  const gradientId = `chart-gradient-${color.replace("#", "")}`

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-neutral-300">{label}</h3>
        <span className="text-xs text-neutral-500">
          {data.reduce((sum, d) => sum + d.value, 0)} total
        </span>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto"
          preserveAspectRatio="none"
          style={{ height: "120px" }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0.25, 0.5, 0.75].map((frac) => (
            <line
              key={frac}
              x1={padding.left}
              y1={padding.top + chartH * (1 - frac)}
              x2={width - padding.right}
              y2={padding.top + chartH * (1 - frac)}
              stroke="white"
              strokeOpacity="0.04"
              strokeWidth="0.3"
            />
          ))}

          {/* Area fill */}
          <path d={areaPath} fill={`url(#${gradientId})`} />

          {/* Line */}
          <path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data dots */}
          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r="1.5"
              fill={color}
              stroke="#1F2937"
              strokeWidth="0.8"
              opacity={data[i].value > 0 ? 1 : 0.3}
            />
          ))}
        </svg>

        {/* X-axis labels */}
        <div className="flex justify-between mt-2 px-0.5">
          {data.map((d, i) => (
            <span
              key={i}
              className="text-[10px] text-neutral-600 font-medium"
            >
              {d.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

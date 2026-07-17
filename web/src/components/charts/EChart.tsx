import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'

type EChartsInst = ReturnType<typeof echarts.init>

let themed = false
function ensureTheme() {
  if (themed) return
  themed = true
  echarts.registerTheme('srpm', {
    color: ['#38BDF8', '#34D399', '#FBBF24', '#F87171', '#A78BFA', '#22D3EE', '#94A3B8', '#F472B6'],
    backgroundColor: 'transparent',
    textStyle: { color: '#94A3B8', fontFamily: 'Inter, "Microsoft YaHei UI", "PingFang SC", sans-serif' },
    title: { textStyle: { color: '#E2E8F0', fontSize: 13, fontWeight: 600 } },
    legend: { textStyle: { color: '#94A3B8', fontSize: 11 }, itemWidth: 10, itemHeight: 10, icon: 'roundRect' },
    tooltip: {
      backgroundColor: '#16213A', borderColor: 'rgba(148,163,184,0.25)', borderWidth: 1,
      textStyle: { color: '#E2E8F0', fontSize: 12 },
      extraCssText: 'box-shadow: 0 8px 24px rgba(0,0,0,0.45); border-radius: 8px;',
    },
    categoryAxis: {
      axisLine: { lineStyle: { color: 'rgba(148,163,184,0.25)' } },
      axisTick: { show: false },
      axisLabel: { color: '#94A3B8', fontSize: 11 },
      splitLine: { show: false },
    },
    valueAxis: {
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#5B6B84', fontSize: 11 },
      splitLine: { lineStyle: { color: 'rgba(148,163,184,0.08)' } },
    },
  })
}

export function EChart({ option, height = 260, className = '', onClick }: {
  option: EChartsOption; height?: number | string; className?: string
  onClick?: (params: { name?: string; seriesName?: string; value?: unknown; dataIndex?: number }) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const chart = useRef<EChartsInst | null>(null)

  useEffect(() => {
    ensureTheme()
    if (!ref.current) return
    chart.current = echarts.init(ref.current, 'srpm')
    const ro = new ResizeObserver(() => chart.current?.resize())
    ro.observe(ref.current)
    return () => { ro.disconnect(); chart.current?.dispose(); chart.current = null }
  }, [])

  useEffect(() => {
    chart.current?.setOption(option, true)
  }, [option])

  useEffect(() => {
    if (!chart.current) return
    chart.current.off('click')
    if (onClick) chart.current.on('click', (p) => onClick(p as never))
  }, [onClick])

  return <div ref={ref} className={className} style={{ height, width: '100%' }} />
}

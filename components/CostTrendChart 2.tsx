'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { TrendingUp } from 'lucide-react'

interface MonthlyCost {
  year_month: string
  revenue: number
  material_cost: number
  outsource_cost: number
  labor_cost: number
  freight_cost: number
}

const TARGETS = { material: 18.5, outsource: 43.5, labor: 7.0, freight: 1.0 }
const COLORS = { material: '#3b82f6', outsource: '#f59e0b', labor: '#10b981', freight: '#ef4444', gross: '#8b5cf6' }

export default function CostTrendChart() {
  const supabase = createClient()
  const [data, setData] = useState<Record<string, string | number>[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: rows } = await supabase.from('monthly_costs').select('*').order('year_month')
      if (!rows) return
      const formatted = rows
        .filter((d: MonthlyCost) => d.revenue > 0)
        .map((d: MonthlyCost) => {
          const r = d.revenue
          const total = d.material_cost + d.outsource_cost + d.labor_cost + d.freight_cost
          return {
            month: d.year_month.replace('-', '/'),
            材料費率: Math.round((d.material_cost / r) * 1000) / 10,
            外注加工費率: Math.round((d.outsource_cost / r) * 1000) / 10,
            労務費率: Math.round((d.labor_cost / r) * 1000) / 10,
            荷造運賃率: Math.round((d.freight_cost / r) * 1000) / 10,
            粗利率: Math.round(((r - total) / r) * 1000) / 10,
          }
        })
      setData(formatted)
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }, [supabase])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
  if (data.length === 0) return null

  const latest = data[data.length - 1]

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-5 w-5 text-blue-600" />
        <h3 className="text-sm font-bold text-gray-900">原価率月次推移グラフ</h3>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} unit="%" domain={[0, 60]} />
          <Tooltip formatter={(v, n) => [`${v}%`, String(n)]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          <ReferenceLine y={18.5} stroke="#3b82f6" strokeDasharray="4 4" strokeOpacity={0.4} />
          <ReferenceLine y={43.5} stroke="#f59e0b" strokeDasharray="4 4" strokeOpacity={0.4} />
          <ReferenceLine y={7.0} stroke="#10b981" strokeDasharray="4 4" strokeOpacity={0.4} />
          <Line type="monotone" dataKey="材料費率" stroke={COLORS.material} strokeWidth={2} dot={{ r: 4 }} />
          <Line type="monotone" dataKey="外注加工費率" stroke={COLORS.outsource} strokeWidth={2} dot={{ r: 4 }} />
          <Line type="monotone" dataKey="労務費率" stroke={COLORS.labor} strokeWidth={2} dot={{ r: 4 }} />
          <Line type="monotone" dataKey="粗利率" stroke={COLORS.gross} strokeWidth={2} dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { key: '材料費率', target: TARGETS.material, color: COLORS.material },
          { key: '外注加工費率', target: TARGETS.outsource, color: COLORS.outsource },
          { key: '労務費率', target: TARGETS.labor, color: COLORS.labor },
          { key: '荷造運賃率', target: TARGETS.freight, color: COLORS.freight },
        ].map(({ key, target }) => {
          const val = latest[key] as number
          const isGood = val <= target
          return (
            <div key={key} className={`rounded-xl p-3 border ${isGood ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <p className="text-xs text-gray-500 mb-1">{key}（最新月）</p>
              <p className={`text-lg font-bold ${isGood ? 'text-green-700' : 'text-red-700'}`}>{val}%</p>
              <p className="text-xs text-gray-400">目標 {target}%</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

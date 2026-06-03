'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Target, Plus, Check, X } from 'lucide-react'

interface FiscalTarget {
  id: string
  fiscal_year: number
  start_month: string
  end_month: string
  revenue_target: number
  material_rate_target: number
  outsource_rate_target: number
  labor_rate_target: number
  freight_rate_target: number
  sga_target: number
  memo: string
  updated_at: string
}

export default function FiscalYearTarget() {
  const supabase = createClient()
  const [targets, setTargets] = useState<FiscalTarget[]>([])
  const [loading, setLoading] = useState(true)
  const [myRole, setMyRole] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [form, setForm] = useState({
    fiscal_year: '',
    start_month: '',
    end_month: '',
    revenue_target: '',
    material_rate_target: '18.5',
    outsource_rate_target: '43.5',
    labor_rate_target: '7.0',
    freight_rate_target: '1.0',
    sga_target: '',
    memo: '',
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', user.id).single()
        setMyRole(roleData?.role ?? null)
      }
      const { data } = await supabase.from('fiscal_year_targets').select('*').order('fiscal_year', { ascending: false })
      setTargets(data || [])
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }, [supabase])

  useEffect(() => { fetchData() }, [fetchData])

  function startEdit(target: FiscalTarget) {
    setForm({
      fiscal_year: target.fiscal_year.toString(),
      start_month: target.start_month,
      end_month: target.end_month,
      revenue_target: target.revenue_target.toString(),
      material_rate_target: target.material_rate_target.toString(),
      outsource_rate_target: target.outsource_rate_target.toString(),
      labor_rate_target: target.labor_rate_target.toString(),
      freight_rate_target: target.freight_rate_target.toString(),
      sga_target: target.sga_target.toString(),
      memo: target.memo || '',
    })
    setEditing(target.id)
    setShowAdd(false)
  }

  async function handleSave() {
    setSaving(true)
    setMessage(null)
    try {
      const payload = {
        fiscal_year: Number(form.fiscal_year),
        start_month: form.start_month,
        end_month: form.end_month,
        revenue_target: Number(form.revenue_target),
        material_rate_target: Number(form.material_rate_target),
        outsource_rate_target: Number(form.outsource_rate_target),
        labor_rate_target: Number(form.labor_rate_target),
        freight_rate_target: Number(form.freight_rate_target),
        sga_target: Number(form.sga_target),
        memo: form.memo,
      }
      if (editing) {
        await supabase.from('fiscal_year_targets').update(payload).eq('id', editing)
      } else {
        await supabase.from('fiscal_year_targets').insert(payload)
      }
      setMessage('保存しました')
      setEditing(null)
      setShowAdd(false)
      fetchData()
    } catch { setMessage('保存に失敗しました') } finally { setSaving(false) }
  }

  function resetForm() {
    setForm({ fiscal_year: '', start_month: '', end_month: '', revenue_target: '', material_rate_target: '18.5', outsource_rate_target: '43.5', labor_rate_target: '7.0', freight_rate_target: '1.0', sga_target: '', memo: '' })
    setEditing(null)
    setShowAdd(false)
  }

  async function handleDelete(id: string, fiscalYear: number) {
    if (!confirm(`第${fiscalYear}期の目標を削除しますか？この操作は元に戻せません。`)) return
    try {
      await supabase.from('fiscal_year_targets').delete().eq('id', id)
      setMessage('削除しました')
      fetchData()
    } catch { setMessage('削除に失敗しました') }
  }

  function handleAddClick() {
    setEditing(null)
    resetForm()
    setTimeout(() => setShowAdd(true), 0)
  }

  const isAdmin = myRole === 'admin'

  if (loading) return <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" /></div>

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 mt-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-blue-600" />
          <h3 className="text-sm font-bold text-gray-900">決算期 目標管理</h3>
        </div>
        {!showAdd && !editing && (
          <button onClick={handleAddClick} className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800">
            <Plus className="h-3.5 w-3.5" />新しい期を追加
          </button>
        )}
      </div>

      {message && (
        <div className={`text-sm p-2 rounded-lg mb-3 ${message.includes('失敗') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{message}</div>
      )}

      {(showAdd || editing) && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
          <p className="text-xs font-bold text-blue-900 mb-3">{editing ? '目標を編集' : '新しい期を追加'}</p>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className="text-xs text-gray-600 font-medium mb-1 block">期</label>
              <input type="number" value={form.fiscal_year} onChange={e => setForm(p => ({ ...p, fiscal_year: e.target.value }))} placeholder="63" className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" disabled={!!editing} />
            </div>
            <div>
              <label className="text-xs text-gray-600 font-medium mb-1 block">期首</label>
              <input type="month" value={form.start_month} onChange={e => setForm(p => ({ ...p, start_month: e.target.value }))} className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs text-gray-600 font-medium mb-1 block">期末</label>
              <input type="month" value={form.end_month} onChange={e => setForm(p => ({ ...p, end_month: e.target.value }))} className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-gray-600 font-medium mb-1 block">売上目標（円）</label>
              <input type="number" value={form.revenue_target} onChange={e => setForm(p => ({ ...p, revenue_target: e.target.value }))} placeholder="300000000" className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs text-gray-600 font-medium mb-1 block">販管費目標（円）</label>
              <input type="number" value={form.sga_target} onChange={e => setForm(p => ({ ...p, sga_target: e.target.value }))} placeholder="80000000" className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3 mb-3">
            {[
              { label: '材料費率目標(%)', key: 'material_rate_target' },
              { label: '外注加工費率目標(%)', key: 'outsource_rate_target' },
              { label: '労務費率目標(%)', key: 'labor_rate_target' },
              { label: '荷造運賃率目標(%)', key: 'freight_rate_target' },
            ].map(({ label, key }) => (
              <div key={key}>
                <label className="text-xs text-gray-600 font-medium mb-1 block">{label}</label>
                <input type="number" step="0.1" value={form[key as keyof typeof form]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            ))}
          </div>
          <div className="mb-3">
            <label className="text-xs text-gray-600 font-medium mb-1 block">メモ</label>
            <input type="text" value={form.memo} onChange={e => setForm(p => ({ ...p, memo: e.target.value }))} placeholder="例：第63期目標" className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-1 bg-blue-600 text-white text-xs font-medium px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
              <Check className="h-3.5 w-3.5" />{saving ? '保存中...' : '保存する'}
            </button>
            <button onClick={resetForm} className="flex items-center gap-1 text-xs text-gray-500 px-3 py-2 rounded-lg hover:bg-gray-100">
              <X className="h-3.5 w-3.5" />キャンセル
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {targets.map(target => (
          <div key={target.id} className="border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-lg font-bold text-gray-900">第{target.fiscal_year}期</span>
                <span className="text-sm text-gray-500 ml-2">{target.start_month} 〜 {target.end_month}</span>
                {target.memo && <span className="text-xs text-gray-400 ml-2">（{target.memo}）</span>}
              </div>
              {true && (
                <div className="flex items-center gap-3">
                  <button onClick={() => startEdit(target)} className="text-xs text-blue-600 hover:underline">編集</button>
                  <button onClick={() => handleDelete(target.id, target.fiscal_year)} className="text-xs text-red-500 hover:underline">削除</button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">売上目標</p>
                <p className="text-sm font-bold text-blue-700">{(target.revenue_target / 100000000).toFixed(1)}億円</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">販管費目標</p>
                <p className="text-sm font-bold text-gray-700">{(target.sga_target / 1000000).toFixed(0)}百万円</p>
              </div>
              <div className="bg-green-50 rounded-lg p-3 col-span-2 md:col-span-1">
                <p className="text-xs text-gray-500 mb-1">原価率目標</p>
                <p className="text-xs text-gray-700">
                  材料費 {target.material_rate_target}% / 外注 {target.outsource_rate_target}% / 労務 {target.labor_rate_target}% / 運賃 {target.freight_rate_target}%
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2 text-right">最終更新: {new Date(target.updated_at).toLocaleDateString('ja-JP')}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

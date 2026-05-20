'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Calendar, Truck, Package, AlertCircle, Check, X, ChevronDown, ChevronUp } from 'lucide-react'

type ProcessStatus = 'pending' | 'in_progress' | 'waiting_approval' | 'approved' | 'rejected' | 'completed'

const STATUS_LABELS: Record<ProcessStatus, string> = {
  pending: '待機中', in_progress: '作業中', waiting_approval: '承認待ち',
  approved: '承認済み', rejected: '差し戻し', completed: '完了',
}
const STATUS_COLORS: Record<ProcessStatus, string> = {
  pending: 'bg-gray-100 text-gray-600', in_progress: 'bg-blue-100 text-blue-700',
  waiting_approval: 'bg-yellow-100 text-yellow-700', approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700', completed: 'bg-purple-100 text-purple-700',
}

interface Process {
  id: string
  step_number: number
  step_name: string
  department: string
  status: ProcessStatus
  vendor_id: string | null
  vendor_name: string | null
  order_date: string | null
  scheduled_date: string | null
  actual_return_date: string | null
  handover_date: string | null
  handover_quantity: number | null
  returned_material_quantity: number | null
  returned_material_notes: string | null
  unit_cost: number | null
  total_cost: number | null
  cost_overridden: boolean
  notes: string | null
  assigned_member_id: string | null
  approved_at: string | null
  rejection_reason: string | null
  kpi_members?: { name: string }
}

interface Vendor { id: string; name: string; short_name: string }

interface Props {
  process: Process
  orderId: string
  quantity: number
  canAct: boolean
  canApprove: boolean
  vendors: Vendor[]
  onUpdate: () => void
}

export default function ManufacturingProcessDetail({
  process, orderId, quantity, canAct, canApprove, vendors, onUpdate
}: Props) {
  const supabase = createClient()
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    vendor_name: process.vendor_name || '',
    order_date: process.order_date || '',
    scheduled_date: process.scheduled_date || '',
    actual_return_date: process.actual_return_date || '',
    handover_date: process.handover_date || '',
    handover_quantity: process.handover_quantity?.toString() || quantity.toString(),
    returned_material_quantity: process.returned_material_quantity?.toString() || '',
    returned_material_notes: process.returned_material_notes || '',
    unit_cost: process.unit_cost?.toString() || '',
    notes: process.notes || '',
  })

  const alertLevel = () => {
    if (!process.scheduled_date) return 'normal'
    const scheduled = new Date(process.scheduled_date)
    const today = new Date()
    const diff = (scheduled.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    if (diff < 0 && !['completed', 'approved'].includes(process.status)) return 'overdue'
    if (diff <= 3 && !['completed', 'approved'].includes(process.status)) return 'warning'
    return 'normal'
  }

  const alert = alertLevel()

  const showVendorFields = [3].includes(process.step_number)
  const showReturnFields = [5].includes(process.step_number)
  const showOnlyNotes = [1, 2, 4, 6, 7].includes(process.step_number)

  async function handleSave() {
    setSaving(true)
    try {
      const unitCost = form.unit_cost ? Number(form.unit_cost) : null
      const totalCost = unitCost ? unitCost * quantity : null
      await supabase.from('manufacturing_processes').update({
        vendor_name: form.vendor_name || null,
        order_date: form.order_date || null,
        scheduled_date: form.scheduled_date || null,
        actual_return_date: form.actual_return_date || null,
        handover_date: form.handover_date || null,
        handover_quantity: form.handover_quantity ? Number(form.handover_quantity) : null,
        returned_material_quantity: form.returned_material_quantity ? Number(form.returned_material_quantity) : null,
        returned_material_notes: form.returned_material_notes || null,
        unit_cost: unitCost,
        total_cost: totalCost,
        cost_overridden: !!form.unit_cost,
        notes: form.notes || null,
      }).eq('id', process.id)
      setEditing(false)
      onUpdate()
    } finally { setSaving(false) }
  }

  async function handleStatusChange(newStatus: ProcessStatus, comment?: string) {
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const updates: Record<string, unknown> = { status: newStatus }
      if (newStatus === 'in_progress') updates.started_at = new Date().toISOString()
      if (newStatus === 'waiting_approval') updates.completed_at = new Date().toISOString()
      if (newStatus === 'approved') { updates.approved_at = new Date().toISOString(); updates.approved_by = user?.id }
      if (newStatus === 'rejected') updates.rejection_reason = comment || ''
      await supabase.from('manufacturing_processes').update(updates).eq('id', process.id)
      if (newStatus === 'approved') {
        const { data: allProcesses } = await supabase.from('manufacturing_processes')
          .select('id, step_number, status').eq('manufacturing_order_id', orderId).order('step_number')
        const currentIdx = allProcesses?.findIndex(p => p.id === process.id) ?? -1
        const nextProcess = allProcesses?.[currentIdx + 1]
        if (nextProcess) {
          await supabase.from('manufacturing_processes').update({ status: 'in_progress' }).eq('id', nextProcess.id)
        } else {
          await supabase.from('manufacturing_orders').update({ status: 'completed' }).eq('id', orderId)
        }
      }
      onUpdate()
    } finally { setSaving(false) }
  }

  const isOutsource = ['planning', 'production', 'quality'].includes(process.department)

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${
      alert === 'overdue' ? 'border-red-300 bg-red-50' :
      alert === 'warning' ? 'border-yellow-300 bg-yellow-50' :
      process.status === 'pending' ? 'border-gray-100 bg-gray-50 opacity-60' :
      'border-gray-200 bg-white'
    }`}>
      <div className="flex items-center gap-3 p-4">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
          ['completed', 'approved'].includes(process.status) ? 'bg-green-100 text-green-700' :
          process.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
          process.status === 'waiting_approval' ? 'bg-yellow-100 text-yellow-700' :
          'bg-gray-100 text-gray-400'
        }`}>
          {['completed', 'approved'].includes(process.status) ? <Check className="h-4 w-4" /> : process.step_number}
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-gray-900">{process.step_name}</p>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[process.status]}`}>
              {STATUS_LABELS[process.status]}
            </span>
            {alert === 'overdue' && (
              <span className="flex items-center gap-1 text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                <AlertCircle className="h-3 w-3" />納期超過
              </span>
            )}
            {alert === 'warning' && (
              <span className="flex items-center gap-1 text-xs font-medium text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full">
                <AlertCircle className="h-3 w-3" />納期間近
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {process.vendor_name && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Truck className="h-3 w-3" />{process.vendor_name}
              </span>
            )}
            {process.order_date && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Calendar className="h-3 w-3" />手配: {new Date(process.order_date).toLocaleDateString('ja-JP')}
              </span>
            )}
            {process.scheduled_date && (
              <span className={`flex items-center gap-1 text-xs font-medium ${alert === 'overdue' ? 'text-red-600' : alert === 'warning' ? 'text-yellow-600' : 'text-gray-500'}`}>
                <Calendar className="h-3 w-3" />予定納期: {new Date(process.scheduled_date).toLocaleDateString('ja-JP')}
              </span>
            )}
            {process.actual_return_date && (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <Package className="h-3 w-3" />実際の納日: {new Date(process.actual_return_date).toLocaleDateString('ja-JP')}
              </span>
            )}
            {process.total_cost && (
              <span className="text-xs text-gray-500">工賃: ¥{process.total_cost.toLocaleString()}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {canAct && process.status === 'in_progress' && (
            <button onClick={() => handleStatusChange('waiting_approval')} disabled={saving}
              className="text-xs bg-yellow-500 text-white px-3 py-1.5 rounded-lg hover:bg-yellow-600 disabled:opacity-50">
              承認依頼
            </button>
          )}
          {canApprove && process.status === 'waiting_approval' && (
            <div className="flex gap-1">
              <button onClick={() => handleStatusChange('approved')} disabled={saving}
                className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50">
                承認
              </button>
              <button onClick={() => { const r = prompt('差し戻し理由'); if (r) handleStatusChange('rejected', r) }} disabled={saving}
                className="text-xs bg-red-500 text-white px-3 py-1.5 rounded-lg hover:bg-red-600 disabled:opacity-50">
                差し戻し
              </button>
            </div>
          )}
          <button onClick={() => { setExpanded(!expanded); setEditing(false) }}
            className="text-gray-400 hover:text-gray-600">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 p-4">
          {process.rejection_reason && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3 text-xs text-red-700">
              差し戻し理由: {process.rejection_reason}
            </div>
          )}

          {editing ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {showVendorFields && (
                  <>
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">外注先</label>
                      {vendors.length > 0 ? (
                        <select value={form.vendor_name} onChange={e => setForm(p => ({ ...p, vendor_name: e.target.value }))}
                          className="w-full text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
                          <option value="">選択</option>
                          {vendors.map(v => <option key={v.id} value={v.short_name}>{v.short_name}</option>)}
                        </select>
                      ) : (
                        <input type="text" value={form.vendor_name} onChange={e => setForm(p => ({ ...p, vendor_name: e.target.value }))}
                          className="w-full text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="外注先名" />
                      )}
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">工賃（単価/個）</label>
                      <input type="number" value={form.unit_cost} onChange={e => setForm(p => ({ ...p, unit_cost: e.target.value }))}
                        className="w-full text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="製品マスターから自動取得" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">手配日</label>
                      <input type="date" value={form.order_date} onChange={e => setForm(p => ({ ...p, order_date: e.target.value }))}
                        className="w-full text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">外注予定納期</label>
                      <input type="date" value={form.scheduled_date} onChange={e => setForm(p => ({ ...p, scheduled_date: e.target.value }))}
                        className="w-full text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                  </>
                )}
                {showReturnFields && (
                  <>
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">実際の戻り日</label>
                      <input type="date" value={form.actual_return_date} onChange={e => setForm(p => ({ ...p, actual_return_date: e.target.value }))}
                        className="w-full text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">品質管理部への引渡日</label>
                      <input type="date" value={form.handover_date} onChange={e => setForm(p => ({ ...p, handover_date: e.target.value }))}
                        className="w-full text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">引渡数量</label>
                      <input type="number" value={form.handover_quantity} onChange={e => setForm(p => ({ ...p, handover_quantity: e.target.value }))}
                        className="w-full text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">余り材料戻り数</label>
                      <input type="number" value={form.returned_material_quantity} onChange={e => setForm(p => ({ ...p, returned_material_quantity: e.target.value }))}
                        className="w-full text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="0" />
                    </div>
                  </>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">備考</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2}
                  className="w-full text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none" />
              </div>
              <div className="flex gap-2">
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-1 bg-blue-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  <Check className="h-3.5 w-3.5" />{saving ? '保存中...' : '保存する'}
                </button>
                <button onClick={() => setEditing(false)}
                  className="flex items-center gap-1 text-xs text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-100">
                  <X className="h-3.5 w-3.5" />キャンセル
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                {[
                  { label: '外注先', value: process.vendor_name },
                  { label: '手配日', value: process.order_date ? new Date(process.order_date).toLocaleDateString('ja-JP') : null },
                  { label: '外注予定納期', value: process.scheduled_date ? new Date(process.scheduled_date).toLocaleDateString('ja-JP') : null },
                  { label: '実際の戻り日', value: process.actual_return_date ? new Date(process.actual_return_date).toLocaleDateString('ja-JP') : null },
                  { label: '品質管理部への引渡日', value: process.handover_date ? new Date(process.handover_date).toLocaleDateString('ja-JP') : null },
                  { label: '引渡数量', value: process.handover_quantity ? `${process.handover_quantity}個` : null },
                  { label: '余り材料戻り数', value: process.returned_material_quantity ? `${process.returned_material_quantity}` : null },
                  { label: '工賃合計', value: process.total_cost ? `¥${process.total_cost.toLocaleString()}` : null },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-50 rounded-lg p-2">
                    <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                    <p className="text-xs font-medium text-gray-800">{value || '未入力'}</p>
                  </div>
                ))}
              </div>
              {process.notes && <p className="text-xs text-gray-500 mb-3">備考: {process.notes}</p>}
              <button onClick={() => setEditing(true)}
                className="text-xs text-blue-600 hover:underline">
                手配情報を入力・編集
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

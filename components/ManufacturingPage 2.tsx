'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Factory, Plus, ChevronDown, ChevronUp, AlertCircle, Package, Check, X, Clock, CheckCircle2, Pencil, Trash2 } from 'lucide-react'
import ManufacturingProcessDetail from './ManufacturingProcessDetail'

type ProcessStatus = 'pending' | 'in_progress' | 'waiting_approval' | 'approved' | 'rejected' | 'completed'
type Priority = 1 | 2 | 3 | 4

const STATUS_LABELS: Record<ProcessStatus, string> = {
  pending: '待機中',
  in_progress: '作業中',
  waiting_approval: '承認待ち',
  approved: '承認済み',
  rejected: '差し戻し',
  completed: '完了',
}
const STATUS_COLORS: Record<ProcessStatus, string> = {
  pending: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
  waiting_approval: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  completed: 'bg-purple-100 text-purple-700',
}
const PRIORITY_LABELS: Record<Priority, string> = { 1: '緊急', 2: '高', 3: '通常', 4: '低' }
const PRIORITY_COLORS: Record<Priority, string> = {
  1: 'bg-red-100 text-red-700', 2: 'bg-orange-100 text-orange-700',
  3: 'bg-blue-100 text-blue-700', 4: 'bg-gray-100 text-gray-600',
}

interface KpiMember {
  id: string; name: string; email: string
  department: string; position: string; can_view_all: boolean
}
interface ManufacturingOrder {
  product_id?: string | null;
  id: string; quantity: number; due_date: string
  priority: Priority; status: ProcessStatus; notes: string
  created_at: string
  products?: { name: string; code: string }
  sales_orders?: { order_number: string; customer_name: string }
}
interface ManufacturingProcess {
  vendor_id: string | null;
  vendor_name: string | null;
  order_date: string | null;
  scheduled_date: string | null;
  actual_return_date: string | null;
  handover_date: string | null;
  handover_quantity: number | null;
  returned_material_quantity: number | null;
  returned_material_notes: string | null;
  unit_cost: number | null;
  total_cost: number | null;
  cost_overridden: boolean;
  id: string; manufacturing_order_id: string
  step_number: number; step_name: string
  department: string; required_position: string
  status: ProcessStatus; notes: string
  assigned_member_id: string | null
  approver_member_id: string | null
  started_at: string | null; completed_at: string | null; approved_at: string | null
  rejection_reason: string | null
  kpi_members?: { name: string; department: string }
}
interface ProcessTemplate {
  id: string; step_number: number; step_name: string
  department: string; required_position: string
  approval_department: string; approval_position: string; description: string
}

export default function ManufacturingPage() {
  const supabase = createClient()
  const [myMember, setMyMember] = useState<KpiMember | null>(null)
  const [orders, setOrders] = useState<ManufacturingOrder[]>([])
  const [processes, setProcesses] = useState<Record<string, ManufacturingProcess[]>>({})
  const [templates, setTemplates] = useState<ProcessTemplate[]>([])
  const [approverSettings, setApproverSettings] = useState<Record<number, string>>({}) // step_number -> member_id
  const [members, setMembers] = useState<KpiMember[]>([])
  const [vendors, setVendors] = useState<{ id: string; name: string; short_name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)
  const [showNewOrder, setShowNewOrder] = useState(false)
  const [editingOrder, setEditingOrder] = useState<ManufacturingOrder | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [activeTab, setActiveTab] = useState<'all' | 'mine' | 'approval'>('all')
  const [newOrder, setNewOrder] = useState({
    product_id: '', quantity: '1', due_date: '', priority: '3', notes: '', order_id: ''
  })
  const [products, setProducts] = useState<{ id: string; name: string; product_no: string }[]>([])
  const [salesOrders, setSalesOrders] = useState<{ id: string; order_number: string; customer_name: string }[]>([])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: memberData } = await supabase.from('kpi_members').select('*').eq('email', user.email).single()
      setMyMember(memberData)

      const { data: allMembers } = await supabase.from('kpi_members').select('*').order('department')
      setMembers(allMembers || [])

      const { data: vendorData } = await supabase.from('customers').select('id, name, short_name').eq('type', 'vendor_processing').order('name')
      setVendors(vendorData || [])

      const { data: templateData } = await supabase.from('process_templates').select('*').order('step_number')
      setTemplates(templateData || [])

      const { data: approverData } = await supabase.from('process_approver_settings').select('step_number, approver_member_id').order('step_number')
      const approverMap: Record<number, string> = {}
      approverData?.forEach(a => { if (a.approver_member_id) approverMap[a.step_number] = a.approver_member_id })
      setApproverSettings(approverMap)

      const { data: productData } = await supabase.from('products').select('id, name, product_no').order('name')
      const { data: salesOrderData } = await supabase.from('sales_orders').select('id, order_number, customer_name').eq('status', 'confirmed').order('order_number', { ascending: false })
      setSalesOrders(salesOrderData || [])
      setProducts(productData || [])

      const { data: orderData } = await supabase
        .from('manufacturing_orders')
        .select('*, products(name, product_no)')
        .order('priority')
        .order('due_date')
      setOrders(orderData || [])

      if (orderData) {
        const processMap: Record<string, ManufacturingProcess[]> = {}
        for (const order of orderData) {
          const { data: procData } = await supabase
            .from('manufacturing_processes')
            .select('*')
            .eq('manufacturing_order_id', order.id)
            .order('step_number')
          processMap[order.id] = procData || []
        }
        setProcesses(processMap)
      }
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }, [supabase])

  useEffect(() => { fetchData() }, [fetchData])

  function canActOnProcess(process: ManufacturingProcess): boolean {
    if (!myMember) return false
    const template = templates.find(t => t.step_name === process.step_name)
    if (!template) return false
    return myMember.department === template.department &&
      (myMember.position === template.required_position || myMember.can_view_all)
  }

  function canApproveProcess(process: ManufacturingProcess): boolean {
    if (!myMember) return false
    const template = templates.find(t => t.step_name === process.step_name)
    if (!template) return false
    return myMember.department === template.approval_department &&
      (myMember.position === template.approval_position || myMember.can_view_all)
  }

  async function handleStatusChange(processId: string, orderId: string, newStatus: ProcessStatus, comment?: string) {
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const process = processes[orderId]?.find(p => p.id === processId)
      if (!process) return

      const updates: Record<string, unknown> = { status: newStatus }
      if (newStatus === 'in_progress') updates.started_at = new Date().toISOString()
      if (newStatus === 'completed' || newStatus === 'waiting_approval') updates.completed_at = new Date().toISOString()
      if (newStatus === 'approved') { updates.approved_at = new Date().toISOString(); updates.approved_by = user?.id }
      if (newStatus === 'rejected') updates.rejection_reason = comment || ''

      await supabase.from('manufacturing_processes').update(updates).eq('id', processId)

      await supabase.from('manufacturing_process_logs').insert({
        process_id: processId,
        action: STATUS_LABELS[newStatus],
        from_status: process.status,
        to_status: newStatus,
        performed_by: user?.id,
        performed_by_member: myMember?.id,
        comment,
      })

      if (newStatus === 'approved') {
        const orderProcesses = processes[orderId] || []
        const currentIdx = orderProcesses.findIndex(p => p.id === processId)
        const nextProcess = orderProcesses[currentIdx + 1]
        if (nextProcess) {
          await supabase.from('manufacturing_processes').update({ status: 'in_progress' }).eq('id', nextProcess.id)
        } else {
          await supabase.from('manufacturing_orders').update({ status: 'completed' }).eq('id', orderId)
        }
      }

      setMessage({ type: 'success', text: 'ステータスを更新しました' })
      fetchData()
    } catch (e) {
      console.error(e)
      setMessage({ type: 'error', text: '更新に失敗しました' })
    } finally { setSaving(false) }
  }

  async function handleDeleteOrder(orderId: string) {
    if (!confirm('この製造指示を削除しますか？\n関連する工程データも全て削除されます。')) return
    try {
      await supabase.from('manufacturing_processes').delete().eq('manufacturing_order_id', orderId)
      await supabase.from('manufacturing_orders').delete().eq('id', orderId)
      setMessage({ type: 'success', text: '削除しました' })
      fetchData()
    } catch (e) {
      console.error(e)
      setMessage({ type: 'error', text: '削除に失敗しました' })
    }
  }

  async function handleUpdateOrder() {
    if (!editingOrder) return
    setSaving(true)
    try {
      await supabase.from('manufacturing_orders').update({
        product_id: newOrder.product_id || editingOrder.product_id,
        quantity: Number(newOrder.quantity),
        due_date: newOrder.due_date,
        priority: Number(newOrder.priority),
        notes: newOrder.notes,
      }).eq('id', editingOrder.id)
      setMessage({ type: 'success', text: '更新しました' })
      setEditingOrder(null)
      setShowNewOrder(false)
      setNewOrder({ product_id: '', quantity: '1', due_date: '', priority: '3', notes: '', order_id: '' })
      fetchData()
    } catch (e) {
      console.error(e)
      setMessage({ type: 'error', text: '更新に失敗しました' })
    } finally { setSaving(false) }
  }

  function startEdit(order: ManufacturingOrder) {
    setEditingOrder(order)
    setNewOrder({
      product_id: order.product_id || '',
      quantity: order.quantity.toString(),
      due_date: order.due_date,
      priority: order.priority.toString(),
      notes: order.notes || '',
      order_id: '',
    })
    setShowNewOrder(true)
    setExpandedOrder(null)
  }

  async function handleCreateOrder() {
    if (!newOrder.product_id || !newOrder.due_date) {
      setMessage({ type: 'error', text: '製品と納期は必須です' })
      return
    }
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: order, error } = await supabase.from('manufacturing_orders').insert({
        product_id: newOrder.product_id,
        order_id: newOrder.order_id || null,
        quantity: Number(newOrder.quantity),
        due_date: newOrder.due_date,
        priority: Number(newOrder.priority),
        notes: newOrder.notes,
        status: 'in_progress',
        created_by: user?.id,
      }).select().single()

      if (error) throw error

      const planningMember = members.find(m => m.department === 'planning' && m.position === 'leader')
      const salesManager = members.find(m => m.department === 'sales' && m.position === 'manager')
      const productionLeader = members.find(m => m.department === 'production' && m.position === 'leader')
      const qualityLeader = members.find(m => m.department === 'quality' && m.position === 'leader')

      const assignees: Record<number, string | null> = {
        1: planningMember?.id || null,
        2: salesManager?.id || null,
        3: productionLeader?.id || null,
        4: productionLeader?.id || null,
        5: qualityLeader?.id || null,
        6: qualityLeader?.id || null,
        7: qualityLeader?.id || null,
      }

      for (const template of templates) {
        await supabase.from('manufacturing_processes').insert({
          manufacturing_order_id: order.id,
          step_number: template.step_number,
          step_name: template.step_name,
          department: template.department,
          required_position: template.required_position,
          status: template.step_number === 1 ? 'in_progress' : 'pending',
          assigned_member_id: assignees[template.step_number] || null,
        })
      }

      setMessage({ type: 'success', text: '製造指示を作成しました' })
      setShowNewOrder(false)
      setNewOrder({ product_id: '', quantity: '1', due_date: '', priority: '3', notes: '', order_id: '' })
      fetchData()
    } catch (e) {
      console.error(e)
      setMessage({ type: 'error', text: '作成に失敗しました' })
    } finally { setSaving(false) }
  }

  const approvalPendingOrders = orders.filter(order =>
    (processes[order.id] || []).some(p => p.status === 'waiting_approval' && canApproveProcess(p))
  )

  const filteredOrders = activeTab === 'mine'
    ? orders.filter(order => (processes[order.id] || []).some(p => p.assigned_member_id === myMember?.id && p.status === 'in_progress'))
    : activeTab === 'approval'
    ? approvalPendingOrders
    : orders

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg"><Factory className="h-6 w-6 text-blue-700" /></div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">製造指示・工程管理</h1>
            <p className="text-sm text-gray-500">受注から出荷までの工程を管理します</p>
          </div>
        </div>
        {(myMember?.can_view_all || myMember?.department === 'sales') && (
          <button onClick={() => setShowNewOrder(true)} className="flex items-center gap-2 bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700">
            <Plus className="h-4 w-4" />製造指示を作成
          </button>
        )}
      </div>

      {message && (
        <div className={`flex items-center gap-2 p-3 rounded-lg mb-4 text-sm ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {message.type === 'success' ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      {approvalPendingOrders.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            <p className="text-sm font-bold text-yellow-800">承認待ちの案件が {approvalPendingOrders.length} 件あります</p>
          </div>
          <p className="text-xs text-yellow-700">「承認待ち」タブから確認・承認してください</p>
        </div>
      )}

      {showNewOrder && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 mb-6">
          <h3 className="text-sm font-bold text-blue-900 mb-4">{editingOrder ? '製造指示を編集' : '新しい製造指示を作成'}</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">受注No（任意）</label>
              <select value={newOrder.order_id} onChange={e => setNewOrder(p => ({ ...p, order_id: e.target.value }))} className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">受注Noを選択</option>
                {salesOrders.map(o => <option key={o.id} value={o.id}>{o.order_number}（{o.customer_name}）</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">製品 *</label>
              <select value={newOrder.product_id} onChange={e => setNewOrder(p => ({ ...p, product_id: e.target.value }))} className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">選択してください</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}（{p.product_no}）</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">数量</label>
              <input type="number" value={newOrder.quantity} onChange={e => setNewOrder(p => ({ ...p, quantity: e.target.value }))} className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">納期 *</label>
              <input type="date" value={newOrder.due_date} onChange={e => setNewOrder(p => ({ ...p, due_date: e.target.value }))} className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">優先度</label>
              <select value={newOrder.priority} onChange={e => setNewOrder(p => ({ ...p, priority: e.target.value }))} className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="1">緊急</option>
                <option value="2">高</option>
                <option value="3">通常</option>
                <option value="4">低</option>
              </select>
            </div>
          </div>
          <div className="mb-4">
            <label className="text-xs font-medium text-gray-600 mb-1 block">備考</label>
            <textarea value={newOrder.notes} onChange={e => setNewOrder(p => ({ ...p, notes: e.target.value }))} rows={2} className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex gap-2">
            <button onClick={editingOrder ? handleUpdateOrder : handleCreateOrder} disabled={saving} className="flex items-center gap-1 bg-blue-600 text-white text-xs font-medium px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
              <Check className="h-3.5 w-3.5" />{saving ? '処理中...' : editingOrder ? '更新する' : '作成する'}
            </button>
            <button onClick={() => { setShowNewOrder(false); setEditingOrder(null); setNewOrder({ product_id: '', quantity: '1', due_date: '', priority: '3', notes: '', order_id: '' }) }} className="flex items-center gap-1 text-xs text-gray-500 px-3 py-2 rounded-lg hover:bg-gray-100">
              <X className="h-3.5 w-3.5" />キャンセル
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        {[
          { key: 'all', label: '全ての指示', count: orders.length },
          { key: 'mine', label: '自分の担当', count: orders.filter(o => (processes[o.id] || []).some(p => p.assigned_member_id === myMember?.id && p.status === 'in_progress')).length },
          { key: 'approval', label: '承認待ち', count: approvalPendingOrders.length },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {tab.label}
            {tab.count > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.key ? 'bg-white/20' : 'bg-gray-200'}`}>{tab.count}</span>}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filteredOrders.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-12 text-center">
            <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400">製造指示がありません</p>
          </div>
        ) : (
          filteredOrders.map(order => {
            const orderProcesses = processes[order.id] || []
            const currentStep = orderProcesses.find(p => p.status === 'in_progress' || p.status === 'waiting_approval')
            const completedSteps = orderProcesses.filter(p => p.status === 'completed' || p.status === 'approved').length
            const progress = orderProcesses.length > 0 ? Math.round((completedSteps / orderProcesses.length) * 100) : 0
            const isExpanded = expandedOrder === order.id

            return (
              <div key={order.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                <button onClick={() => setExpandedOrder(isExpanded ? null : order.id)} className="w-full flex items-center gap-4 p-5 hover:bg-gray-50 transition-colors">
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PRIORITY_COLORS[order.priority]}`}>{PRIORITY_LABELS[order.priority]}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status]}`}>{STATUS_LABELS[order.status]}</span>
                      {order.products && <span className="text-sm font-bold text-gray-900">{order.products.name}</span>}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>数量: {order.quantity}</span>
                      <span>納期: {new Date(order.due_date).toLocaleDateString('ja-JP')}</span>
                      {currentStep && <span className="text-blue-600">現在: {currentStep.step_name}</span>}
                    </div>
                    <div className="mt-2">
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>進捗</span>
                        <span>{completedSteps}/{orderProcesses.length} 工程</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(myMember?.can_view_all) && (
                      <>
                        <button onClick={e => { e.stopPropagation(); startEdit(order) }} className="text-blue-500 hover:text-blue-700 p-1 rounded hover:bg-blue-50">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={e => { e.stopPropagation(); handleDeleteOrder(order.id) }} className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    {isExpanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100 p-5">
                    <div className="space-y-3">
                      {orderProcesses.map((process) => (
                        <ManufacturingProcessDetail
                          key={process.id}
                          process={process}
                          orderId={order.id}
                          quantity={order.quantity}
                          canAct={canActOnProcess(process)}
                          canApprove={canApproveProcess(process)}
                          vendors={vendors}
                          onUpdate={fetchData}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

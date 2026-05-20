'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { POStatus, POItemRow } from '@/lib/types/purchase-order'

// ─── 発注番号採番 ─────────────────────────────────────
async function generatePONumber(): Promise<string> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('generate_po_number')
  if (error) throw new Error(`採番失敗: ${error.message}`)
  return data as string
}

// ─── 発注書作成 ───────────────────────────────────────
export async function createPurchaseOrder(payload: {
  order_date: string
  desired_delivery_date: string
  supplier_id: string
  supplier_name: string
  supplier_phone: string
  supplier_fax: string
  supplier_contact: string
  assigned_employee_id: string
  note: string
  items: POItemRow[]
}) {
  const supabase = await createClient()
  const po_number = await generatePONumber()

  const subtotal = payload.items.reduce(
    (s, row) => s + (parseFloat(row.quantity) || 0) * (parseFloat(row.unit_price) || 0),
    0
  )

  const { data: po, error } = await supabase
    .from('purchase_orders')
    .insert({
      po_number,
      status: 'draft',
      order_date: payload.order_date,
      desired_delivery_date: payload.desired_delivery_date || null,
      supplier_id: payload.supplier_id || null,
      supplier_name: payload.supplier_name,
      supplier_phone: payload.supplier_phone || null,
      supplier_fax: payload.supplier_fax || null,
      supplier_contact: payload.supplier_contact || null,
      assigned_employee_id: payload.assigned_employee_id || null,
      subtotal,
      note: payload.note || null,
    })
    .select('id')
    .single()

  if (error || !po) throw new Error(error?.message ?? '発注書の作成に失敗しました')

  const itemRows = payload.items.map((row, i) => ({
    purchase_order_id: po.id,
    sort_order: i,
    material_id: row.material_id || null,
    item_name: row.item_name,
    model_name: row.model_name || null,
    color: row.color || null,
    quantity: parseFloat(row.quantity) || 1,
    unit: row.unit || null,
    unit_price: parseFloat(row.unit_price) || 0,
    amount: (parseFloat(row.quantity) || 0) * (parseFloat(row.unit_price) || 0),
    delivery_date: row.delivery_date || null,
  }))

  if (itemRows.length > 0) {
    const { error: itemErr } = await supabase.from('purchase_order_items').insert(itemRows)
    if (itemErr) throw new Error(itemErr.message)
  }

  revalidatePath('/purchases')
  redirect('/purchases')
}

// ─── 発注書更新 ───────────────────────────────────────
export async function updatePurchaseOrder(
  id: string,
  payload: {
    order_date: string
    desired_delivery_date: string
    supplier_id: string
    supplier_name: string
    supplier_phone: string
    supplier_fax: string
    supplier_contact: string
    assigned_employee_id: string
    note: string
    items: POItemRow[]
  }
) {
  const supabase = await createClient()

  const subtotal = payload.items.reduce(
    (s, row) => s + (parseFloat(row.quantity) || 0) * (parseFloat(row.unit_price) || 0),
    0
  )

  const { error } = await supabase
    .from('purchase_orders')
    .update({
      order_date: payload.order_date,
      desired_delivery_date: payload.desired_delivery_date || null,
      supplier_id: payload.supplier_id || null,
      supplier_name: payload.supplier_name,
      supplier_phone: payload.supplier_phone || null,
      supplier_fax: payload.supplier_fax || null,
      supplier_contact: payload.supplier_contact || null,
      assigned_employee_id: payload.assigned_employee_id || null,
      subtotal,
      note: payload.note || null,
    })
    .eq('id', id)

  if (error) throw new Error(error.message)

  // 明細を全削除 → 再挿入
  await supabase.from('purchase_order_items').delete().eq('purchase_order_id', id)

  const itemRows = payload.items.map((row, i) => ({
    purchase_order_id: id,
    sort_order: i,
    material_id: row.material_id || null,
    item_name: row.item_name,
    model_name: row.model_name || null,
    color: row.color || null,
    quantity: parseFloat(row.quantity) || 1,
    unit: row.unit || null,
    unit_price: parseFloat(row.unit_price) || 0,
    amount: (parseFloat(row.quantity) || 0) * (parseFloat(row.unit_price) || 0),
    delivery_date: row.delivery_date || null,
  }))

  if (itemRows.length > 0) {
    const { error: itemErr } = await supabase.from('purchase_order_items').insert(itemRows)
    if (itemErr) throw new Error(itemErr.message)
  }

  revalidatePath('/purchases')
  redirect('/purchases')
}

// ─── ステータス更新 ───────────────────────────────────
export async function updatePOStatus(id: string, status: POStatus) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('purchase_orders')
    .update({ status })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/purchases')
}

// ─── 削除 ─────────────────────────────────────────────
export async function deletePurchaseOrder(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('purchase_orders').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/purchases')
}

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

// ─── ステータス更新（納品済 以外の単純な遷移） ───────────────────────────
export async function updatePOStatus(id: string, status: POStatus) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('purchase_orders')
    .update({ status })
    .eq('id', id)
  if (error) throw new Error(error.message)

  revalidatePath('/purchases')
}

// ─── 納品済にする（実納品数量を反映して在庫加算） ─────────────────────────
// 革などの実測材料は発注数量と納品数量がぴったり一致しないことが多いため、
// 各明細について実際に届いた数量（received_quantity）を受け取り、それを在庫に加算する。
export async function markPODelivered(
  id: string,
  receivedQuantities: Record<string, number>
) {
  const supabase = await createClient()

  const { data: po } = await supabase
    .from('purchase_orders')
    .select('order_date, purchase_order_items(id, material_id, quantity, unit_price, item_name)')
    .eq('id', id)
    .single()

  if (!po) throw new Error('発注書が見つかりません')

  const today = new Date().toISOString().slice(0, 10)

  for (const item of po.purchase_order_items || []) {
    const actualQty = Number(receivedQuantities[item.id] ?? item.quantity)

    // 実納品数量を明細に記録
    await supabase
      .from('purchase_order_items')
      .update({ received_quantity: actualQty })
      .eq('id', item.id)

    if (!item.material_id) continue

    // 現在庫を取得して、実納品数量ぶんを加算
    const { data: mat } = await supabase
      .from('materials')
      .select('current_stock')
      .eq('id', item.material_id)
      .single()

    if (mat) {
      const newStock = Number(mat.current_stock) + actualQty
      await supabase
        .from('materials')
        .update({
          current_stock: newStock,
          month_end_price: item.unit_price,
          stock_updated_at: new Date().toISOString(),
        })
        .eq('id', item.material_id)

      // トランザクション記録（実納品数量ベース）
      await supabase.from('material_stock_transactions').insert({
        material_id: item.material_id,
        transaction_type: 'purchase_in',
        quantity: actualQty,
        unit_price: item.unit_price,
        amount: actualQty * Number(item.unit_price),
        reference_type: 'purchase_order',
        reference_id: id,
        note: `発注書 納品済（実納品数量）`,
        transaction_date: today,
      })
    }
  }

  const { error } = await supabase
    .from('purchase_orders')
    .update({ status: 'delivered' })
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

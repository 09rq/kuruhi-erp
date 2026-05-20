'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { SOStatus, SOItemRow } from '@/lib/types/sales-order'

// ─── 受注番号採番 ──────────────────────────────────────────────────────────
async function generateOrderNumber(): Promise<string> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('generate_order_number')
  if (error) throw new Error(`採番失敗: ${error.message}`)
  return data as string
}

// ─── ペイロード型 ──────────────────────────────────────────────────────────
interface OrderPayload {
  client_id: string
  order_date: string
  desired_delivery_date: string
  confirmed_delivery_date: string
  status: SOStatus
  assigned_to: string
  notes: string
  items: SOItemRow[]
}

// ─── 受注作成 ─────────────────────────────────────────────────────────────
export async function createSalesOrder(payload: OrderPayload) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const order_number = await generateOrderNumber()

  const { data: order, error } = await supabase
    .from('sales_orders')
    .insert({
      order_number,
      client_id:               payload.client_id               || null,
      order_date:              payload.order_date,
      desired_delivery_date:   payload.desired_delivery_date   || null,
      confirmed_delivery_date: payload.confirmed_delivery_date || null,
      status:                  payload.status,
      assigned_to:             payload.assigned_to             || null,
      notes:                   payload.notes                   || null,
      created_by:              user?.id                        ?? null,
    })
    .select('id')
    .single()

  if (error || !order) throw new Error(error?.message ?? '受注の作成に失敗しました')

  await saveItems(supabase, order.id, payload.items)

  revalidatePath('/sales/orders')
  redirect(`/sales/orders/${order.id}`)
}

// ─── 受注更新 ─────────────────────────────────────────────────────────────
export async function updateSalesOrder(id: string, payload: OrderPayload) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('sales_orders')
    .update({
      client_id:               payload.client_id               || null,
      order_date:              payload.order_date,
      desired_delivery_date:   payload.desired_delivery_date   || null,
      confirmed_delivery_date: payload.confirmed_delivery_date || null,
      status:                  payload.status,
      assigned_to:             payload.assigned_to             || null,
      notes:                   payload.notes                   || null,
    })
    .eq('id', id)

  if (error) throw new Error(error.message)

  await supabase.from('sales_order_items').delete().eq('order_id', id)
  await saveItems(supabase, id, payload.items)

  revalidatePath('/sales/orders')
  revalidatePath(`/sales/orders/${id}`)
  redirect(`/sales/orders/${id}`)
}

// ─── ステータス更新 ────────────────────────────────────────────────────────
export async function updateSOStatus(id: string, status: SOStatus) {
  const supabase = await createClient()
  const { error } = await supabase.from('sales_orders').update({ status }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/sales/orders')
  revalidatePath(`/sales/orders/${id}`)
}

// ─── 削除 ────────────────────────────────────────────────────────────────
export async function deleteSalesOrder(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('sales_orders').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/sales/orders')
}

// ─── 製造ロット一括作成 ───────────────────────────────────────────────────
export async function createLotsFromOrder(orderId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // ロット未作成の明細を取得
  const { data: items, error: itemErr } = await supabase
    .from('sales_order_items')
    .select('id, product_id, product_variant_id, quantity, desired_delivery_date')
    .eq('order_id', orderId)
    .is('production_lot_id', null)
    .not('product_id', 'is', null)
    .order('sort_order')

  if (itemErr) throw new Error(itemErr.message)
  if (!items || items.length === 0) throw new Error('作成対象の明細がありません（既にロット作成済み、または製品未設定）')

  const createdLotIds: string[] = []

  for (const item of items) {
    // ロット番号採番
    const { data: lotNum } = await supabase.rpc('generate_lot_number')
    if (!lotNum) throw new Error('ロット番号の採番に失敗しました')

    // ロット作成
    const { data: lot, error: lotErr } = await supabase
      .from('production_lots')
      .insert({
        lot_number:         lotNum,
        product_id:         item.product_id,
        product_variant_id: item.product_variant_id,
        planned_quantity:   item.quantity,
        status:             'planned',
        order_id:           orderId,
        created_by:         user?.id ?? null,
      })
      .select('id')
      .single()

    if (lotErr || !lot) throw new Error(lotErr?.message ?? 'ロット作成に失敗しました')

    // 明細にロットIDを紐付け
    await supabase
      .from('sales_order_items')
      .update({ production_lot_id: lot.id })
      .eq('id', item.id)

    createdLotIds.push(lot.id)
  }

  revalidatePath(`/sales/orders/${orderId}`)
  revalidatePath('/inventory/lots')

  // 1件なら詳細へ、複数なら一覧へ
  if (createdLotIds.length === 1) {
    redirect(`/inventory/lots/${createdLotIds[0]}`)
  } else {
    redirect(`/inventory/lots`)
  }
}

// ─── 内部ヘルパー ─────────────────────────────────────────────────────────
type SupabaseClient = Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>

async function saveItems(supabase: SupabaseClient, orderId: string, items: SOItemRow[]) {
  const rows = items
    .filter((r) => r.product_id)
    .map((r, i) => ({
      order_id:             orderId,
      product_id:           r.product_id           || null,
      product_variant_id:   r.product_variant_id   || null,
      quantity:             parseInt(String(r.quantity ?? 1))    || 1,
      unit_price:           parseFloat(String(r.unit_price ?? 0)) || 0,
      desired_delivery_date: r.desired_delivery_date || null,
      notes:                r.notes                || null,
      sort_order:           i,
    }))

  if (rows.length === 0) return
  const { error } = await supabase.from('sales_order_items').insert(rows)
  if (error) throw new Error(error.message)
}

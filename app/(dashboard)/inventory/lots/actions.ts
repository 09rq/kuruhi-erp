'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { LotStatus } from '@/lib/types/inventory'

interface ProcessInput {
  sort_order: number
  process_name: string
  vendor_id: string | null
  planned_quantity: number
  unit_price: number
  purchase_status: 'unpaid' | 'paid'
  purchase_date: string | null
  notes: string | null
}

export async function createProductionLot(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // ロット番号を採番
  const { data: lotNumData } = await supabase.rpc('generate_lot_number')
  const lotNumber = lotNumData as string | null

  if (!lotNumber) {
    // フォールバック: クライアント側で生成
    const year = new Date().getFullYear()
    const rand = String(Math.floor(Math.random() * 9999)).padStart(4, '0')
    throw new Error(`ロット番号の採番に失敗しました (fallback: LOT-${year}-${rand})`)
  }

  const { data: lot, error: lotErr } = await supabase
    .from('production_lots')
    .insert({
      lot_number:         lotNumber,
      product_id:         formData.get('product_id') as string,
      product_variant_id: (formData.get('product_variant_id') as string) || null,
      planned_quantity:   Number(formData.get('planned_quantity')) || 0,
      status:             'planned',
      notes:              (formData.get('notes') as string) || null,
      created_by:         user?.id ?? null,
    })
    .select('id')
    .single()

  if (lotErr) throw new Error(lotErr.message)

  await saveProcesses(supabase, lot.id, formData)

  revalidatePath('/inventory/lots')
  redirect(`/inventory/lots/${lot.id}`)
}

export async function updateLotStatus(lotId: string, status: LotStatus) {
  const supabase = await createClient()

  const updates: Record<string, unknown> = { status }
  if (status === 'in_progress') updates.started_at  = new Date().toISOString().slice(0, 10)
  if (status === 'completed')   updates.completed_at = new Date().toISOString().slice(0, 10)

  const { error } = await supabase
    .from('production_lots')
    .update(updates)
    .eq('id', lotId)

  if (error) throw new Error(error.message)

  // 完了時に製品在庫を加算
  if (status === 'completed') {
    const { data: lot } = await supabase
      .from('production_lots')
      .select('product_id, product_variant_id, planned_quantity, products(standard_cost)')
      .eq('id', lotId)
      .single()

    if (lot) {
      const product = lot.products as { standard_cost?: number } | null
      const qty = lot.planned_quantity || 0
      const unitCost = product?.standard_cost || 0

      // current_stock を加算
      const { data: prod } = await supabase
        .from('products')
        .select('current_stock')
        .eq('id', lot.product_id)
        .single()

      if (prod) {
        await supabase.from('products')
          .update({
            current_stock: (prod.current_stock || 0) + qty,
            stock_updated_at: new Date().toISOString()
          })
          .eq('id', lot.product_id)
      }

      // product_stock_transactions に記録
      await supabase.from('product_stock_transactions').insert({
        product_id: lot.product_id,
        product_variant_id: lot.product_variant_id || null,
        transaction_type: 'production_in',
        quantity: qty,
        unit_cost: unitCost,
        amount: qty * unitCost,
        reference_type: 'production_lot',
        reference_id: lotId,
        note: '製造ロット完了',
        transaction_date: new Date().toISOString().slice(0, 10),
      })
    }
  }

  revalidatePath('/inventory/lots')
  revalidatePath(`/inventory/lots/${lotId}`)
}

export async function markProcessAsPaid(processId: string, lotId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('production_lot_processes')
    .update({
      purchase_status: 'paid',
      purchase_date:   new Date().toISOString().slice(0, 10),
    })
    .eq('id', processId)

  if (error) throw new Error(error.message)

  revalidatePath(`/inventory/lots/${lotId}`)
  revalidatePath('/inventory/lots')
}

// ─── 加工工程の一括保存（未仕入のみ削除→再挿入）────────────────────────────
interface SaveProcessInput {
  process_name:     string
  vendor_id:        string | null
  planned_quantity: number
  unit_price:       number
  notes:            string | null
  sort_order:       number
}

export async function saveProcessesForLot(
  lotId: string,
  processes: SaveProcessInput[],
) {
  const supabase = await createClient()

  // 既存の未仕入工程を削除（仕入済は保持）
  const { error: delErr } = await supabase
    .from('production_lot_processes')
    .delete()
    .eq('lot_id', lotId)
    .eq('purchase_status', 'unpaid')

  if (delErr) throw new Error(delErr.message)

  // 新規挿入（すべて unpaid として登録）
  if (processes.length > 0) {
    const rows = processes.map((p) => ({
      lot_id:           lotId,
      process_name:     p.process_name,
      vendor_id:        p.vendor_id || null,
      planned_quantity: p.planned_quantity,
      unit_price:       p.unit_price,
      purchase_status:  'unpaid' as const,
      notes:            p.notes || null,
      sort_order:       p.sort_order,
    }))
    const { error } = await supabase.from('production_lot_processes').insert(rows)
    if (error) throw new Error(error.message)
  }

  revalidatePath(`/inventory/lots/${lotId}`)
  revalidatePath('/inventory/lots')
}

// ─────────────────────────────────────────────────────────────
type SupabaseClient = Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>

async function saveProcesses(supabase: SupabaseClient, lotId: string, formData: FormData) {
  const json = formData.get('processes') as string
  if (!json) return

  const processes: ProcessInput[] = JSON.parse(json)
  if (processes.length === 0) return

  const rows = processes.map((p) => ({
    lot_id:           lotId,
    sort_order:       p.sort_order,
    process_name:     p.process_name,
    vendor_id:        p.vendor_id || null,
    planned_quantity: p.planned_quantity,
    unit_price:       p.unit_price,
    purchase_status:  p.purchase_status,
    purchase_date:    p.purchase_date || null,
    notes:            p.notes || null,
  }))

  const { error } = await supabase.from('production_lot_processes').insert(rows)
  if (error) throw new Error(error.message)
}

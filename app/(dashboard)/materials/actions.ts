'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// 材料コード自動採番（DBシーケンスによるアトミック生成）
async function generateCode(): Promise<string> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('generate_material_code')
  if (error) throw new Error(`コード採番失敗: ${error.message}`)
  return data as string
}

function toNum(v: FormDataEntryValue | null): number | null {
  if (!v || v === '') return null
  const n = Number(v)
  return isNaN(n) ? null : n
}

function toStr(v: FormDataEntryValue | null): string | null {
  return v && v !== '' ? (v as string) : null
}

function buildPayload(formData: FormData) {
  const procurementType = (formData.get('procurement_type') as string) || 'buy'
  const isSupplied = procurementType === 'supplied'

  return {
    name:               formData.get('name') as string,
    category:           formData.get('category') as string,
    spec:               toStr(formData.get('spec')),
    short_name:         toStr(formData.get('short_name')),
    color_cd:           toStr(formData.get('color_cd')),
    jan_cd:             toStr(formData.get('jan_cd')),
    unit:               formData.get('unit') as string,
    // 支給部材は在庫評価単価を0に固定
    standard_price:     isSupplied ? 0 : toNum(formData.get('standard_price')),
    month_start_price:  isSupplied ? 0 : toNum(formData.get('month_start_price')),
    month_end_price:    isSupplied ? 0 : toNum(formData.get('month_end_price')),
    procurement_type:   procurementType,
    supplier_id:        toStr(formData.get('supplier_id')),
    order_method:       toStr(formData.get('order_method')),
    order_lot:          toNum(formData.get('order_lot')),
    tax_type:           toStr(formData.get('tax_type')),
    tax_rate:           toNum(formData.get('tax_rate')),
    sales_end_date:     toStr(formData.get('sales_end_date')),
    stock_managed:      formData.get('stock_managed') === 'true',
    current_stock:      toNum(formData.get('current_stock')) ?? 0,
    safety_stock:       toNum(formData.get('safety_stock')),
    reorder_point:      toNum(formData.get('reorder_point')),
    inventory_category: formData.get('inventory_category') === 'true',
    storage_location:   toStr(formData.get('storage_location')),
    shelf_number:       toStr(formData.get('shelf_number')),
    lot_management:     formData.get('lot_management') === 'true',
    note:               toStr(formData.get('note')),
    is_active:          formData.get('is_active') === 'true',
    group_id:           toStr(formData.get('group_id')),
    price_overridden:   formData.get('price_overridden') === 'true',
  }
}

// グループに所属していて、個別単価にしていない場合は、グループの単価で上書きする
async function applyGroupPrice(supabase: Awaited<ReturnType<typeof createClient>>, payload: Record<string, unknown>) {
  if (payload.group_id && !payload.price_overridden) {
    const { data: group } = await supabase
      .from('material_groups')
      .select('standard_price')
      .eq('id', payload.group_id as string)
      .single()
    if (group) {
      payload.standard_price = group.standard_price
    }
  }
  return payload
}

export async function createMaterial(formData: FormData) {
  const supabase = await createClient()
  const code = await generateCode()
  const payload = await applyGroupPrice(supabase, buildPayload(formData))
  const { error } = await supabase
    .from('materials')
    .insert({ code, ...payload })
  if (error) throw new Error(error.message)
  revalidatePath('/materials')
  redirect('/materials')
}

export async function updateMaterial(id: string, formData: FormData) {
  const supabase = await createClient()
  const payload = await applyGroupPrice(supabase, buildPayload(formData))
  const { error } = await supabase
    .from('materials')
    .update(payload)
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/materials')
  redirect('/materials')
}

export async function deleteMaterial(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('materials').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/materials')
}

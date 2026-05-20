'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

interface BomItemInput {
  material_id: string
  category: string
  quantity: number
  unit: string
  yield_rate: number
  width_cm: number | null
  unit_price: number
  sort_order: number
  notes: string
}

export async function createBom(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: bom, error } = await supabase
    .from('boms')
    .insert({
      product_id:         formData.get('product_id') as string,
      product_variant_id: (formData.get('product_variant_id') as string) || null,
      version:            1,
      is_active:          true,
      notes:              (formData.get('notes') as string) || null,
      created_by:         user?.id ?? null,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)

  await saveBomItems(supabase, bom.id, formData)

  revalidatePath('/bom')
  redirect('/bom')
}

export async function updateBom(id: string, formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('boms')
    .update({
      product_id:         formData.get('product_id') as string,
      product_variant_id: (formData.get('product_variant_id') as string) || null,
      notes:              (formData.get('notes') as string) || null,
    })
    .eq('id', id)

  if (error) throw new Error(error.message)

  await supabase.from('bom_items').delete().eq('bom_id', id)
  await saveBomItems(supabase, id, formData)

  revalidatePath('/bom')
  revalidatePath(`/bom/${id}`)
  redirect(`/bom/${id}`)
}

export async function deleteBom(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('boms').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/bom')
}

export async function applyBomToProduct(bomId: string) {
  const supabase = await createClient()

  const [
    { data: bom,   error: bomError   },
    { data: items, error: itemsError },
  ] = await Promise.all([
    supabase.from('boms').select('product_id').eq('id', bomId).single(),
    supabase.from('bom_items').select('quantity, yield_rate, width_cm, unit_price, category, amount').eq('bom_id', bomId),
  ])

  console.log('[applyBomToProduct] bomId:', bomId)
  console.log('[applyBomToProduct] bom:', bom, '| error:', bomError?.message)
  console.log('[applyBomToProduct] items:', JSON.stringify(items), '| error:', itemsError?.message)

  if (bomError || !bom) throw new Error(`BOM not found: ${bomError?.message}`)
  if (itemsError) throw new Error(`Items fetch failed: ${itemsError.message}`)

  // DB の amount が 0 の場合（024_bom_fix.sql 適用後の古いデータ）は
  // quantity × yield_rate × unit_price でアプリ側再計算する
  const totalAmount = (items ?? []).reduce((sum, i) => {
    const storedAmount = i.amount ?? 0
    if (storedAmount !== 0) return sum + storedAmount

    // フォールバック：アプリ側計算（BomForm の calcAmount と同じロジック）
    const qty   = Number(i.quantity)   || 0
    const rate  = Number(i.yield_rate) || 1
    const width = Number(i.width_cm)   || 0
    const price = Number(i.unit_price) || 0
    const netQty = i.category === '生地' && width > 0
      ? (qty / width) * rate
      : qty * rate
    return sum + Math.ceil(netQty * price)
  }, 0)

  console.log('[applyBomToProduct] totalAmount:', totalAmount)

  const { error: updateError } = await supabase
    .from('products')
    .update({ standard_material_cost: Math.round(totalAmount) })
    .eq('id', bom.product_id)

  console.log('[applyBomToProduct] update error:', updateError?.message ?? 'none')

  if (updateError) throw new Error(updateError.message)

  revalidatePath('/bom')
  revalidatePath(`/bom/${bomId}`)
  revalidatePath('/products')
  revalidatePath(`/products/${bom.product_id}`)
}

// ─────────────────────────────────────────────────────────────
// 内部ヘルパー
// ─────────────────────────────────────────────────────────────
type SupabaseClient = Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>

/** BomFormのcalcNetQtyと同じロジック（サーバー側） */
function calcNetQty(item: BomItemInput): number {
  const qty       = item.quantity
  const yieldRate = item.yield_rate
  const widthCm   = item.width_cm ?? 0
  if (item.category === '生地') {
    return widthCm > 0 ? (qty / widthCm) * yieldRate : 0
  }
  return qty * yieldRate
}

async function saveBomItems(supabase: SupabaseClient, bomId: string, formData: FormData) {
  const json = formData.get('bom_items') as string
  if (!json) return

  const items: BomItemInput[] = JSON.parse(json)
  if (items.length === 0) return

  const rows = items.map((item) => ({
    bom_id:      bomId,
    material_id: item.material_id,
    category:    item.category   || null,
    quantity:    item.quantity,
    unit:        item.unit       || null,
    yield_rate:  item.yield_rate,
    width_cm:    item.width_cm,
    unit_price:  item.unit_price,
    amount:      Math.ceil(calcNetQty(item) * item.unit_price),
    sort_order:  item.sort_order,
    notes:       item.notes      || null,
  }))

  const { error } = await supabase.from('bom_items').insert(rows)
  if (error) throw new Error(error.message)
}

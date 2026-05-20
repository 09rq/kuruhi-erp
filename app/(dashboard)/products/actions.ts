'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function toNum(v: FormDataEntryValue | null): number | null {
  if (!v || v === '') return null
  const n = Number(v)
  return isNaN(n) ? null : n
}

function toStr(v: FormDataEntryValue | null): string | null {
  return v && v !== '' ? (v as string) : null
}

function buildProductPayload(formData: FormData) {
  return {
    product_no:               (formData.get('product_no') as string).toUpperCase(),
    name:                     formData.get('name') as string,
    category_id:              toStr(formData.get('category_id')),
    client_id:                toStr(formData.get('client_id')),
    client_product_no:        toStr(formData.get('client_product_no')),
    width_mm:                 toNum(formData.get('width_mm')),
    height_mm:                toNum(formData.get('height_mm')),
    depth_mm:                 toNum(formData.get('depth_mm')),
    brand_name:               toStr(formData.get('brand_name')),
    series_name:              toStr(formData.get('series_name')),
    standard_material_cost:   toNum(formData.get('standard_material_cost')),
    standard_processing_cost: toNum(formData.get('standard_processing_cost')),
    selling_price:            toNum(formData.get('selling_price')),
    status:                   formData.get('status') as string,
    cost_mode:                formData.get('cost_mode') as string || 'estimate',
    defect_rate:              toNum(formData.get('defect_rate')),
    cost_confirmed:           formData.get('cost_confirmed') === 'true',
    shipping_cost:            toNum(formData.get('shipping_cost')),
    misc_cost:                toNum(formData.get('misc_cost')),
    note:                     toStr(formData.get('note')),
  }
}

interface VariantInput {
  color_name: string; color_hex: string; material: string; size_label: string; status: string
}

interface CostItemInput {
  cost_type: string; cost_mode: string
  category: string; supplier: string | null; name: string; material_id: string | null
  quantity: number; unit_price: number; yield_rate: number | null; width_cm: number | null
  amount: number; notes: string | null; sort_order: number
}

type SupabaseClient = Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>

async function saveCostItems(supabase: SupabaseClient, productId: string, formData: FormData) {
  const costMode = formData.get('cost_mode') as string || 'estimate'
  const json = formData.get('cost_items') as string
  if (!json) return

  const items: CostItemInput[] = JSON.parse(json)

  await supabase
    .from('product_cost_items')
    .delete()
    .eq('product_id', productId)
    .eq('cost_mode', costMode)

  if (items.length > 0) {
    const rows = items.map((item) => ({
      product_id:  productId,
      cost_type:   item.cost_type,
      cost_mode:   item.cost_mode,
      category:    item.category   || null,
      supplier:    item.supplier   || null,
      name:        item.name       || null,
      material_id: item.material_id || null,
      quantity:    item.quantity,
      unit_price:  item.unit_price,
      yield_rate:  item.yield_rate,
      width_cm:    item.width_cm,
      amount:      item.amount,
      notes:       item.notes || null,
      sort_order:  item.sort_order,
    }))
    const { error } = await supabase.from('product_cost_items').insert(rows)
    if (error) throw new Error(error.message)
  }
}

async function saveVariants(supabase: SupabaseClient, productId: string, formData: FormData) {
  await supabase.from('product_variants').delete().eq('product_id', productId)
  const json = formData.get('variants') as string
  if (!json) return
  const variants: VariantInput[] = JSON.parse(json)
  if (variants.length === 0) return
  const rows = variants.map((v, i) => ({
    product_id: productId, sort_order: i,
    color_name: v.color_name || null, color_hex: v.color_hex || null,
    material: v.material || null, size_label: v.size_label || null, status: v.status,
  }))
  const { error } = await supabase.from('product_variants').insert(rows)
  if (error) throw new Error(error.message)
}

async function upsertBrandName(supabase: SupabaseClient, brandName: string | null) {
  if (!brandName) return
  await supabase
    .from('brands')
    .upsert({ name: brandName }, { onConflict: 'name', ignoreDuplicates: true })
}

export async function createProduct(formData: FormData) {
  const supabase = await createClient()
  const payload = buildProductPayload(formData)
  const { data: product, error } = await supabase
    .from('products')
    .insert(payload)
    .select('id')
    .single()
  if (error) throw new Error(error.message)

  await Promise.all([
    saveCostItems(supabase, product.id, formData),
    saveVariants(supabase, product.id, formData),
    upsertBrandName(supabase, payload.brand_name),
  ])

  revalidatePath('/products')
  redirect('/products')
}

export async function updateProduct(id: string, formData: FormData) {
  const supabase = await createClient()
  const payload = buildProductPayload(formData)
  const { error } = await supabase
    .from('products')
    .update(payload)
    .eq('id', id)
  if (error) throw new Error(error.message)

  await Promise.all([
    saveCostItems(supabase, id, formData),
    saveVariants(supabase, id, formData),
    upsertBrandName(supabase, payload.brand_name),
  ])

  // 標準原価昇格フラグ
  if (formData.get('promote') === 'true') {
    const { data: estimateItems } = await supabase
      .from('product_cost_items')
      .select('*')
      .eq('product_id', id)
      .eq('cost_mode', 'estimate')

    await supabase
      .from('product_cost_items')
      .delete()
      .eq('product_id', id)
      .eq('cost_mode', 'standard')

    if (estimateItems && estimateItems.length > 0) {
      const standardRows = estimateItems.map((item) => ({
        product_id: item.product_id, cost_type: item.cost_type, cost_mode: 'standard',
        category: item.category, supplier: item.supplier, name: item.name,
        material_id: null,
        quantity: item.quantity, unit_price: item.unit_price,
        yield_rate: item.yield_rate, width_cm: item.width_cm, amount: item.amount,
        notes: item.notes || null,
        sort_order: item.sort_order,
      }))
      await supabase.from('product_cost_items').insert(standardRows)
    }

    await supabase.from('products').update({ cost_mode: 'standard' }).eq('id', id)
    revalidatePath('/products')
    revalidatePath(`/products/${id}`)
    redirect(`/products/${id}/edit`)
  }

  revalidatePath('/products')
  revalidatePath(`/products/${id}`)
  redirect(`/products/${id}`)
}

export async function generateProductNo(): Promise<string> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('generate_product_no')
  if (error) throw new Error(error.message)
  return data as string
}

export async function deleteProduct(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/products')
}

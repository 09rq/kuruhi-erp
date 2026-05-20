'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { EstimateStatus, EstimateItemRow } from '@/lib/types/estimate'

async function generateEstimateNumber(): Promise<string> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('generate_estimate_number')
  if (error) throw new Error(`採番失敗: ${error.message}`)
  return data as string
}

interface EstimatePayload {
  client_id: string
  client_contact: string
  issue_date: string
  expiry_date: string
  subject: string
  delivery_date: string
  total_amount: number
  tax_amount: number
  grand_total: number
  payment_terms: string
  notes: string
  items: EstimateItemRow[]
}

async function saveItems(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,
  estimateId: string,
  items: EstimateItemRow[]
) {
  await supabase.from('estimate_items').delete().eq('estimate_id', estimateId)
  if (items.length === 0) return
  const rows = items.map((row, i) => ({
    estimate_id: estimateId,
    sort_order:  i,
    product_id:  row.product_id  || null,
    item_name:   row.item_name,
    quantity:    parseFloat(row.quantity)  || null,
    unit:        row.unit        || null,
    unit_price:  parseFloat(row.unit_price) || null,
    notes:       row.notes       || null,
  }))
  const { error } = await supabase.from('estimate_items').insert(rows)
  if (error) throw new Error(error.message)
}

export async function createEstimate(payload: EstimatePayload) {
  const supabase = await createClient()
  const estimate_number = await generateEstimateNumber()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: est, error } = await supabase
    .from('estimates')
    .insert({
      estimate_number,
      client_id:     payload.client_id     || null,
      client_contact: payload.client_contact || null,
      issue_date:    payload.issue_date,
      expiry_date:   payload.expiry_date    || null,
      subject:       payload.subject        || null,
      delivery_date: payload.delivery_date  || null,
      total_amount:  payload.total_amount,
      tax_amount:    payload.tax_amount,
      grand_total:   payload.grand_total,
      payment_terms: payload.payment_terms  || null,
      notes:         payload.notes          || null,
      status:        'draft',
      created_by:    user?.id ?? null,
    })
    .select('id')
    .single()

  if (error || !est) throw new Error(error?.message ?? '見積の作成に失敗しました')

  await saveItems(supabase, est.id, payload.items)

  revalidatePath('/estimates')
  redirect(`/estimates/${est.id}`)
}

export async function updateEstimate(id: string, payload: EstimatePayload) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('estimates')
    .update({
      client_id:     payload.client_id     || null,
      client_contact: payload.client_contact || null,
      issue_date:    payload.issue_date,
      expiry_date:   payload.expiry_date    || null,
      subject:       payload.subject        || null,
      delivery_date: payload.delivery_date  || null,
      total_amount:  payload.total_amount,
      tax_amount:    payload.tax_amount,
      grand_total:   payload.grand_total,
      payment_terms: payload.payment_terms  || null,
      notes:         payload.notes          || null,
    })
    .eq('id', id)

  if (error) throw new Error(error.message)

  await saveItems(supabase, id, payload.items)

  revalidatePath('/estimates')
  revalidatePath(`/estimates/${id}`)
  redirect(`/estimates/${id}`)
}

export async function updateEstimateStatus(id: string, status: EstimateStatus) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('estimates')
    .update({ status })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/estimates')
  revalidatePath(`/estimates/${id}`)
}

export async function deleteEstimate(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('estimates').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/estimates')
}

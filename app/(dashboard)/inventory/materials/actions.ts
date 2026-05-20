'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { MaterialTransactionType } from '@/lib/types/inventory'

export async function createMaterialTransaction(materialId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const transactionType = formData.get('transaction_type') as MaterialTransactionType
  const quantity        = Number(formData.get('quantity'))
  const unitPrice       = formData.get('unit_price') ? Number(formData.get('unit_price')) : null
  const amount          = unitPrice != null ? quantity * unitPrice : null
  const note            = (formData.get('note') as string) || null
  const transactionDate = formData.get('transaction_date') as string

  // 出庫系は負数にして在庫を減算
  const isOut = ['production_out', 'other_out'].includes(transactionType)
  const signedQty = isOut ? -Math.abs(quantity) : quantity

  const { error: txErr } = await supabase
    .from('material_stock_transactions')
    .insert({
      material_id:      materialId,
      transaction_type: transactionType,
      quantity:         transactionType === 'inventory_adjust' ? quantity : Math.abs(quantity),
      unit_price:       unitPrice,
      amount,
      note,
      transaction_date: transactionDate,
      created_by:       user?.id ?? null,
    })

  if (txErr) throw new Error(txErr.message)

  // materials.current_stock を更新（inventory_adjust は quantity をそのまま加算）
  const delta = transactionType === 'inventory_adjust' ? quantity : signedQty

  const { error: stockErr } = await supabase.rpc('increment_material_stock', {
    p_material_id: materialId,
    p_delta:       delta,
  })

  // RPC がなければ直接 UPDATE
  if (stockErr) {
    const { data: mat } = await supabase
      .from('materials')
      .select('current_stock')
      .eq('id', materialId)
      .single()

    if (mat) {
      await supabase
        .from('materials')
        .update({
          current_stock:    (Number(mat.current_stock) || 0) + delta,
          stock_updated_at: new Date().toISOString(),
        })
        .eq('id', materialId)
    }
  }

  revalidatePath(`/inventory/materials`)
  revalidatePath(`/inventory/materials/${materialId}/transactions`)
  redirect(`/inventory/materials/${materialId}/transactions`)
}

export async function adjustMaterialStock(materialId: string, formData: FormData) {
  return createMaterialTransaction(materialId, formData)
}

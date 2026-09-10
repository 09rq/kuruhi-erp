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

function buildGroupPayload(formData: FormData) {
  return {
    name:           formData.get('name') as string,
    category:       toStr(formData.get('category')),
    unit:           toStr(formData.get('unit')),
    standard_price: toNum(formData.get('standard_price')),
    supplier_id:    toStr(formData.get('supplier_id')),
    note:           toStr(formData.get('note')),
    is_active:      formData.get('is_active') === 'true',
  }
}

export async function createMaterialGroup(formData: FormData) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('material_groups')
    .insert(buildGroupPayload(formData))
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/materials/groups')
  redirect(`/materials/groups/${data.id}`)
}

// グループ情報を更新し、単価が変わった場合は「個別単価」にしていない所属材料に自動で連動させる
export async function updateMaterialGroup(id: string, formData: FormData) {
  const supabase = await createClient()
  const payload = buildGroupPayload(formData)

  const { error } = await supabase
    .from('material_groups')
    .update(payload)
    .eq('id', id)
  if (error) throw new Error(error.message)

  if (payload.standard_price !== null) {
    const { error: cascadeError } = await supabase
      .from('materials')
      .update({ standard_price: payload.standard_price })
      .eq('group_id', id)
      .eq('price_overridden', false)
    if (cascadeError) throw new Error(cascadeError.message)
  }

  revalidatePath('/materials/groups')
  revalidatePath(`/materials/groups/${id}`)
  revalidatePath('/materials')
}

export async function deleteMaterialGroup(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('material_groups').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/materials/groups')
  revalidatePath('/materials')
}

// 既存の（未グループ化の）材料をグループに追加し、その場でグループの単価に合わせる
export async function addMaterialToGroup(materialId: string, groupId: string) {
  const supabase = await createClient()
  const { data: group } = await supabase
    .from('material_groups')
    .select('standard_price')
    .eq('id', groupId)
    .single()

  const { error } = await supabase
    .from('materials')
    .update({
      group_id: groupId,
      price_overridden: false,
      standard_price: group?.standard_price ?? null,
    })
    .eq('id', materialId)
  if (error) throw new Error(error.message)
  revalidatePath(`/materials/groups/${groupId}`)
  revalidatePath('/materials')
}

export async function removeMaterialFromGroup(materialId: string, groupId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('materials')
    .update({ group_id: null, price_overridden: false })
    .eq('id', materialId)
  if (error) throw new Error(error.message)
  revalidatePath(`/materials/groups/${groupId}`)
  revalidatePath('/materials')
}

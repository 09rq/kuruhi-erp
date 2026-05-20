'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function upsertCompanyInfo(formData: FormData) {
  const supabase = await createClient()

  // 既存行を取得（シングルトン）
  const { data: existing } = await supabase
    .from('company_info')
    .select('id')
    .limit(1)
    .single()

  const payload = {
    name: (formData.get('name') as string) || '',
    name_kana: (formData.get('name_kana') as string) || null,
    postal_code: (formData.get('postal_code') as string) || null,
    address: (formData.get('address') as string) || null,
    phone: (formData.get('phone') as string) || null,
    fax: (formData.get('fax') as string) || null,
    email: (formData.get('email') as string) || null,
    invoice_number: (formData.get('invoice_number') as string) || null,
    bank_name: (formData.get('bank_name') as string) || null,
    bank_branch: (formData.get('bank_branch') as string) || null,
    bank_account_type: (formData.get('bank_account_type') as string) || null,
    bank_account_no: (formData.get('bank_account_no') as string) || null,
    bank_account_name: (formData.get('bank_account_name') as string) || null,
  }

  let error
  if (existing?.id) {
    ;({ error } = await supabase
      .from('company_info')
      .update(payload)
      .eq('id', existing.id))
  } else {
    ;({ error } = await supabase.from('company_info').insert(payload))
  }

  if (error) throw new Error(error.message)
  revalidatePath('/settings/company')
}

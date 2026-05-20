'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { CustomerFormData, CustomerType } from '@/lib/types/customer'

// 取引先コード自動採番（DBシーケンスによるアトミック生成）
async function generateCode(type: CustomerType): Promise<string> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('generate_customer_code', {
    p_type: type,
  })
  if (error) throw new Error(`コード採番失敗: ${error.message}`)
  return data as string
}

export async function createCustomer(formData: FormData) {
  const supabase = await createClient()
  const type = formData.get('type') as CustomerType

  const data: CustomerFormData = {
    code: await generateCode(type),
    type,
    name: formData.get('name') as string,
    name_kana: (formData.get('name_kana') as string) || null,
    short_name: (formData.get('short_name') as string) || null,
    sub_category: (formData.get('sub_category') as string) || null,
    postal_code: (formData.get('postal_code') as string) || null,
    address: (formData.get('address') as string) || null,
    phone: (formData.get('phone') as string) || null,
    mobile: (formData.get('mobile') as string) || null,
    fax: (formData.get('fax') as string) || null,
    email: (formData.get('email') as string) || null,
    contact_person: (formData.get('contact_person') as string) || null,
    payment_terms: (formData.get('payment_terms') as string) || null,
    bank_name: (formData.get('bank_name') as string) || null,
    bank_branch: (formData.get('bank_branch') as string) || null,
    bank_account_type: (formData.get('bank_account_type') as string) || null,
    bank_account_no: (formData.get('bank_account_no') as string) || null,
    bank_account_name: (formData.get('bank_account_name') as string) || null,
    invoice_number: (formData.get('invoice_number') as string) || null,
    assigned_employee_id: (formData.get('assigned_employee_id') as string) || null,
    note: (formData.get('note') as string) || null,
    is_active: formData.get('is_active') === 'true',
  }

  const { error } = await supabase.from('customers').insert(data)
  if (error) throw new Error(error.message)

  revalidatePath('/customers')
  redirect('/customers')
}

export async function updateCustomer(id: string, formData: FormData) {
  const supabase = await createClient()

  const data = {
    name: formData.get('name') as string,
    name_kana: (formData.get('name_kana') as string) || null,
    short_name: (formData.get('short_name') as string) || null,
    sub_category: (formData.get('sub_category') as string) || null,
    postal_code: (formData.get('postal_code') as string) || null,
    address: (formData.get('address') as string) || null,
    phone: (formData.get('phone') as string) || null,
    mobile: (formData.get('mobile') as string) || null,
    fax: (formData.get('fax') as string) || null,
    email: (formData.get('email') as string) || null,
    contact_person: (formData.get('contact_person') as string) || null,
    payment_terms: (formData.get('payment_terms') as string) || null,
    bank_name: (formData.get('bank_name') as string) || null,
    bank_branch: (formData.get('bank_branch') as string) || null,
    bank_account_type: (formData.get('bank_account_type') as string) || null,
    bank_account_no: (formData.get('bank_account_no') as string) || null,
    bank_account_name: (formData.get('bank_account_name') as string) || null,
    invoice_number: (formData.get('invoice_number') as string) || null,
    assigned_employee_id: (formData.get('assigned_employee_id') as string) || null,
    note: (formData.get('note') as string) || null,
    is_active: formData.get('is_active') === 'true',
  }

  const { error } = await supabase.from('customers').update(data).eq('id', id)
  if (error) throw new Error(error.message)

  revalidatePath('/customers')
  redirect('/customers')
}

export async function deleteCustomer(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('customers').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/customers')
}

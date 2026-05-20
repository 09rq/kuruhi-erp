'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function createEmployee(formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.from('employees').insert({
    employee_no: formData.get('employee_no') as string,
    name: formData.get('name') as string,
    email: (formData.get('email') as string) || null,
    department: (formData.get('department') as string) || null,
    employment_type: (formData.get('employment_type') as string) || null,
    position: (formData.get('position') as string) || null,
    is_active: formData.get('is_active') === 'true',
  })

  if (error) throw new Error(error.message)
  revalidatePath('/settings/employees')
  redirect('/settings/employees')
}

export async function updateEmployee(id: string, formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('employees')
    .update({
      employee_no: formData.get('employee_no') as string,
      name: formData.get('name') as string,
      email: (formData.get('email') as string) || null,
      department: (formData.get('department') as string) || null,
      employment_type: (formData.get('employment_type') as string) || null,
      position: (formData.get('position') as string) || null,
      is_active: formData.get('is_active') === 'true',
    })
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/settings/employees')
  redirect('/settings/employees')
}

export async function deleteEmployee(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('employees').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/settings/employees')
}

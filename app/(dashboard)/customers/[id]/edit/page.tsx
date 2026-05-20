import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import CustomerForm from '../../CustomerForm'

export default async function CustomerEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: customer, error }, { data: employees }] = await Promise.all([
    supabase.from('customers').select('*').eq('id', id).single(),
    supabase
      .from('employees')
      .select('id, employee_no, name, department, position')
      .eq('is_active', true)
      .order('employee_no', { ascending: true }),
  ])

  if (error || !customer) notFound()

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/customers" className="hover:text-gray-700">
            取引先管理
          </Link>
          <span>/</span>
          <span className="text-gray-900">編集</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">
          {customer.name}
          <span className="ml-3 text-base font-mono font-normal text-gray-400">
            {customer.code}
          </span>
        </h1>
      </div>
      <CustomerForm customer={customer} employees={employees ?? []} />
    </div>
  )
}

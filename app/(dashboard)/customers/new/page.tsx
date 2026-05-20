import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import CustomerForm from '../CustomerForm'

export default async function CustomerNewPage() {
  const supabase = await createClient()
  const { data: employees } = await supabase
    .from('employees')
    .select('id, employee_no, name, department, position')
    .eq('is_active', true)
    .order('employee_no', { ascending: true })

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/customers" className="hover:text-gray-700">
            取引先管理
          </Link>
          <span>/</span>
          <span className="text-gray-900">新規登録</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">取引先 新規登録</h1>
      </div>
      <CustomerForm employees={employees ?? []} />
    </div>
  )
}

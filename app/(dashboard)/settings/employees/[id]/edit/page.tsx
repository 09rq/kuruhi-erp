import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EmployeeForm from '../../EmployeeForm'

export default async function EmployeeEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: employee, error } = await supabase
    .from('employees')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !employee) notFound()

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/settings/employees" className="hover:text-gray-700">
            従業員管理
          </Link>
          <span>/</span>
          <span className="text-gray-900">編集</span>
        </div>
        <h2 className="text-lg font-semibold text-gray-900">
          {employee.name}
          <span className="ml-3 text-sm font-mono font-normal text-gray-400">
            {employee.employee_no}
          </span>
        </h2>
      </div>
      <EmployeeForm employee={employee} />
    </div>
  )
}

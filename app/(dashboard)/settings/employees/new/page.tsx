import Link from 'next/link'
import EmployeeForm from '../EmployeeForm'

export default function EmployeeNewPage() {
  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/settings/employees" className="hover:text-gray-700">
            従業員管理
          </Link>
          <span>/</span>
          <span className="text-gray-900">新規追加</span>
        </div>
        <h2 className="text-lg font-semibold text-gray-900">従業員 新規登録</h2>
      </div>
      <EmployeeForm />
    </div>
  )
}

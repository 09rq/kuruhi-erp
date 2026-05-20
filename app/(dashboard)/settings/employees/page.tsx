import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import EmployeeDeleteButton from './EmployeeDeleteButton'

export default async function EmployeesPage() {
  const supabase = await createClient()
  const { data: employees, error } = await supabase
    .from('employees')
    .select('*')
    .order('employee_no', { ascending: true })

  const activeCount = employees?.filter((e) => e.is_active).length ?? 0
  const inactiveCount = (employees?.length ?? 0) - activeCount

  return (
    <div>
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">有効</span>
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
              {activeCount}名
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">無効</span>
            <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs font-medium rounded-full">
              {inactiveCount}名
            </span>
          </div>
        </div>
        <Link
          href="/settings/employees/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
          style={{ backgroundColor: '#1F3864' }}
        >
          <span>＋</span>
          従業員を追加
        </Link>
      </div>

      {/* テーブル */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {error ? (
          <div className="p-8 text-center text-red-600 text-sm">
            データの取得に失敗しました: {error.message}
          </div>
        ) : !employees || employees.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">
            従業員が登録されていません
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-600 w-24">社員番号</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">氏名</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 w-28">部署</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 w-24">役職</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 w-28">区分</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 w-44">メール</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 w-16">状態</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 w-24">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">
                    {emp.employee_no}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {emp.name}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {emp.department ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {emp.position ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {emp.employment_type ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs truncate max-w-0">
                    {emp.email ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        emp.is_active
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {emp.is_active ? '有効' : '無効'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/settings/employees/${emp.id}/edit`}
                        className="px-2.5 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        編集
                      </Link>
                      <EmployeeDeleteButton id={emp.id} name={emp.name} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="mt-3 text-xs text-gray-400 text-right">
        {employees?.length ?? 0} 名登録
      </p>
    </div>
  )
}

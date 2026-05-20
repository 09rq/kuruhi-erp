'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createEmployee, updateEmployee } from './actions'
import type { Employee } from '@/lib/types/employee'

const DEPARTMENTS = ['管理本部', '営業部', '企画開発部', '生産管理部', '品質管理部']
const EMPLOYMENT_TYPES = ['役員', '管理職', '正社員', '限定社員', '時給社員']

const inputCls =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]'

interface Props {
  employee?: Employee
}

export default function EmployeeForm({ employee }: Props) {
  const router = useRouter()
  const isEdit = !!employee
  const [pending, setPending] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setPending(true)
    try {
      const fd = new FormData(e.currentTarget)
      if (isEdit) {
        await updateEmployee(employee.id, fd)
      } else {
        await createEmployee(fd)
      }
    } catch (err) {
      alert('保存に失敗しました: ' + (err instanceof Error ? err.message : '不明なエラー'))
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">基本情報</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              社員番号 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="employee_no"
              required
              defaultValue={employee?.employee_no ?? ''}
              placeholder="EMP001"
              className={`${inputCls} font-mono`}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              氏名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              required
              defaultValue={employee?.name ?? ''}
              placeholder="山田 太郎"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              部署
            </label>
            <div className="relative">
              <select
                name="department"
                defaultValue={employee?.department ?? ''}
                className={`${inputCls} appearance-none pr-8`}
              >
                <option value="">未設定</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                ▼
              </span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              役職
            </label>
            <input
              type="text"
              name="position"
              defaultValue={employee?.position ?? ''}
              placeholder="部長"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              区分
            </label>
            <div className="relative">
              <select
                name="employment_type"
                defaultValue={employee?.employment_type ?? ''}
                className={`${inputCls} appearance-none pr-8`}
              >
                <option value="">未設定</option>
                {EMPLOYMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                ▼
              </span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              ステータス
            </label>
            <div className="relative">
              <select
                name="is_active"
                defaultValue={
                  employee ? (employee.is_active ? 'true' : 'false') : 'true'
                }
                className={`${inputCls} appearance-none pr-8`}
              >
                <option value="true">有効</option>
                <option value="false">無効</option>
              </select>
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                ▼
              </span>
            </div>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              メールアドレス
            </label>
            <input
              type="email"
              name="email"
              defaultValue={employee?.email ?? ''}
              placeholder="yamada@example.com"
              className={inputCls}
            />
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="px-6 py-2.5 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          style={{ backgroundColor: '#1F3864' }}
        >
          {pending ? '保存中...' : isEdit ? '更新する' : '登録する'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
        >
          キャンセル
        </button>
      </div>
    </form>
  )
}

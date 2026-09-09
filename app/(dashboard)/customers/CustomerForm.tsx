'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createCustomer, updateCustomer } from './actions'
import type { Customer, CustomerType } from '@/lib/types/customer'
import { CUSTOMER_TYPE_LABELS } from '@/lib/types/customer'
import type { EmployeeOption } from '@/lib/types/employee'
import PaymentTermsPicker from './PaymentTermsPicker'
import { MATERIAL_CATEGORIES } from '@/lib/types/material'

interface Props {
  customer?: Customer
  copyFrom?: Customer
  employees?: EmployeeOption[]
}


const ACCOUNT_TYPE_OPTIONS = ['普通', '当座']

const INVOICE_NUMBER_PATTERN = /^T[0-9]{13}$/

function validateInvoiceNumber(value: string): string | null {
  if (!value) return null
  if (!INVOICE_NUMBER_PATTERN.test(value)) {
    return '「T」＋13桁の数字で入力してください（例：T1234567890123）'
  }
  return null
}

export default function CustomerForm({ customer, copyFrom, employees = [] }: Props) {
  const router = useRouter()
  const isEdit = !!customer
  const src = customer ?? copyFrom
  const [pending, setPending] = useState(false)
  const [type, setType] = useState<CustomerType>(
    src?.type ?? 'customer'
  )
  const [invoiceError, setInvoiceError] = useState<string | null>(null)
  const [subCategory, setSubCategory] = useState<string>(
    src?.sub_category ?? ''
  )

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const invoiceVal = (formData.get('invoice_number') as string) ?? ''
    const invoiceErr = validateInvoiceNumber(invoiceVal)
    if (invoiceErr) {
      setInvoiceError(invoiceErr)
      return
    }
    setInvoiceError(null)
    setPending(true)
    try {
      if (isEdit) {
        await updateCustomer(customer.id, formData)
      } else {
        await createCustomer(formData)
      }
    } catch (err) {
      alert('保存に失敗しました: ' + (err instanceof Error ? err.message : '不明なエラー'))
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {/* 区分選択 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">区分</h2>
        <div className="flex gap-3 flex-wrap">
          {(
            [
              ['customer', 'bg-blue-500'],
              ['vendor_processing', 'bg-orange-500'],
              ['vendor_material', 'bg-green-600'],
            ] as [CustomerType, string][]
          ).map(([t, color]) => (
            <label key={t} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="type"
                value={t}
                checked={type === t}
                onChange={() => { setType(t); setSubCategory('') }}
                disabled={isEdit}
                className="sr-only"
              />
              <span
                className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                  type === t
                    ? `${color} text-white border-transparent`
                    : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                } ${isEdit ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                {CUSTOMER_TYPE_LABELS[t]}
              </span>
            </label>
          ))}
        </div>
        {isEdit && (
          <p className="mt-2 text-xs text-gray-400">
            ※ 区分は登録後に変更できません
          </p>
        )}
      </div>

      {/* 基本情報 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">基本情報</h2>
        <div className="grid grid-cols-2 gap-4">
          {isEdit && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                取引先コード
              </label>
              <input
                type="text"
                value={customer.code}
                disabled
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-400 font-mono"
              />
            </div>
          )}
          <div className={isEdit ? '' : 'col-span-2'}>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              取引先名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              defaultValue={src?.name}
              required
              placeholder="株式会社〇〇"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              フリガナ
            </label>
            <input
              type="text"
              name="name_kana"
              defaultValue={src?.name_kana ?? ''}
              placeholder="カブシキガイシャ〇〇"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              略称
            </label>
            <input
              type="text"
              name="short_name"
              defaultValue={src?.short_name ?? ''}
              placeholder="〇〇社"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              担当者名
            </label>
            <input
              type="text"
              name="contact_person"
              defaultValue={src?.contact_person ?? ''}
              placeholder="山田 太郎"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              ステータス
            </label>
            <select
              name="is_active"
              defaultValue={customer ? (customer.is_active ? 'true' : 'false') : 'true'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]"
            >
              <option value="true">有効</option>
              <option value="false">無効</option>
            </select>
          </div>

          {/* 加工区分（仕入先：外注加工のみ） */}
          {type === 'vendor_processing' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                加工区分
              </label>
              <div className="relative">
                <select
                  name="sub_category"
                  value={subCategory}
                  onChange={(e) => setSubCategory(e.target.value)}
                  className="appearance-none w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]"
                >
                  <option value="">未設定</option>
                  {['裁断', '判子', '漉き', '縫製', '塗り', 'その他'].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">▼</span>
              </div>
            </div>
          )}

          {/* 材料区分（仕入先：材料仕入のみ） */}
          {type === 'vendor_material' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                材料区分
              </label>
              <div className="relative">
                <select
                  name="sub_category"
                  value={subCategory}
                  onChange={(e) => setSubCategory(e.target.value)}
                  className="appearance-none w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]"
                >
                  <option value="">未設定</option>
                  {MATERIAL_CATEGORIES.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">▼</span>
              </div>
            </div>
          )}

          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              インボイス登録番号
              <span className="ml-2 text-xs font-normal text-gray-400">
                （適格請求書発行事業者登録番号）
              </span>
            </label>
            <div className="relative">
              <input
                type="text"
                name="invoice_number"
                defaultValue={src?.invoice_number ?? ''}
                placeholder="T1234567890123"
                maxLength={14}
                onChange={(e) => {
                  const err = validateInvoiceNumber(e.target.value)
                  setInvoiceError(err)
                }}
                className={`w-full px-3 py-2 border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#1F3864] ${
                  invoiceError ? 'border-red-400 bg-red-50' : 'border-gray-300'
                }`}
              />
            </div>
            {invoiceError ? (
              <p className="mt-1 text-xs text-red-600">{invoiceError}</p>
            ) : (
              <p className="mt-1 text-xs text-gray-400">
                未登録の場合は空欄のままにしてください
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 連絡先 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">連絡先</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              郵便番号
            </label>
            <input
              type="text"
              name="postal_code"
              defaultValue={src?.postal_code ?? ''}
              placeholder="000-0000"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              住所
            </label>
            <input
              type="text"
              name="address"
              defaultValue={src?.address ?? ''}
              placeholder="東京都〇〇区〇〇1-2-3"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              電話番号
            </label>
            <input
              type="tel"
              name="phone"
              defaultValue={src?.phone ?? ''}
              placeholder="03-0000-0000"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              携帯電話番号
            </label>
            <input
              type="tel"
              name="mobile"
              defaultValue={src?.mobile ?? ''}
              placeholder="090-0000-0000"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              FAX番号
            </label>
            <input
              type="tel"
              name="fax"
              defaultValue={src?.fax ?? ''}
              placeholder="03-0000-0001"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              メールアドレス
            </label>
            <input
              type="email"
              name="email"
              defaultValue={src?.email ?? ''}
              placeholder="info@example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]"
            />
          </div>
        </div>
      </div>

      {/* 取引条件 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">取引条件</h2>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">
            支払条件
          </label>
          <PaymentTermsPicker
            name="payment_terms"
            defaultValue={src?.payment_terms}
          />
        </div>
      </div>

      {/* 口座情報 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">
          口座情報
          <span className="ml-2 text-xs font-normal text-gray-400">
            {type !== 'customer' ? '（振込先）' : '（入金口座）'}
          </span>
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              銀行名
            </label>
            <input
              type="text"
              name="bank_name"
              defaultValue={src?.bank_name ?? ''}
              placeholder="〇〇銀行"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              支店名
            </label>
            <input
              type="text"
              name="bank_branch"
              defaultValue={src?.bank_branch ?? ''}
              placeholder="〇〇支店"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              口座種別
            </label>
            <select
              name="bank_account_type"
              defaultValue={src?.bank_account_type ?? ''}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]"
            >
              <option value="">未設定</option>
              {ACCOUNT_TYPE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              口座番号
            </label>
            <input
              type="text"
              name="bank_account_no"
              defaultValue={src?.bank_account_no ?? ''}
              placeholder="0000000"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              口座名義
            </label>
            <input
              type="text"
              name="bank_account_name"
              defaultValue={src?.bank_account_name ?? ''}
              placeholder="カブシキガイシャ〇〇"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]"
            />
          </div>
        </div>
      </div>

      {/* 自社担当者 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">自社担当者</h2>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            担当者
          </label>
          <div className="relative">
            <select
              name="assigned_employee_id"
              defaultValue={src?.assigned_employee_id ?? ''}
              className="appearance-none w-full pl-3 pr-8 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3864]"
            >
              <option value="">未割り当て</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                  {emp.department ? `（${emp.department}）` : ''}
                  {emp.position ? ` ${emp.position}` : ''}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">▼</span>
          </div>
          {employees.length === 0 && (
            <p className="mt-1.5 text-xs text-amber-600">
              従業員が登録されていません。設定 › 自社情報から登録してください。
            </p>
          )}
        </div>
      </div>

      {/* 備考 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">備考</h2>
        <textarea
          name="note"
          defaultValue={src?.note ?? ''}
          rows={4}
          placeholder="特記事項・注意事項など"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864] resize-none"
        />
      </div>

      {/* ボタン */}
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

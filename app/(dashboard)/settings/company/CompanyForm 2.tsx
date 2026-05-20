'use client'

import { useState } from 'react'
import { upsertCompanyInfo } from './actions'
import type { CompanyInfo } from '@/lib/types/company'

const INVOICE_RE = /^T[0-9]{13}$/
const ACCOUNT_TYPES = ['普通', '当座']

interface Props {
  company: CompanyInfo | null
}

function Field({
  label,
  children,
}: {
  label: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}
      </label>
      {children}
    </div>
  )
}

const inputCls =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]'

export default function CompanyForm({ company }: Props) {
  const [pending, setPending] = useState(false)
  const [saved, setSaved] = useState(false)
  const [invoiceError, setInvoiceError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const inv = (fd.get('invoice_number') as string) ?? ''
    if (inv && !INVOICE_RE.test(inv)) {
      setInvoiceError('「T」＋13桁の数字で入力してください（例：T1234567890123）')
      return
    }
    setInvoiceError(null)
    setPending(true)
    try {
      await upsertCompanyInfo(fd)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      alert('保存に失敗しました: ' + (err instanceof Error ? err.message : '不明なエラー'))
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {/* 基本情報 */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">基本情報</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Field label={<>会社名 <span className="text-red-500">*</span></>}>
              <input
                type="text"
                name="name"
                required
                defaultValue={company?.name ?? ''}
                placeholder="株式会社クルヒ"
                className={inputCls}
              />
            </Field>
          </div>
          <div className="col-span-2">
            <Field label="フリガナ">
              <input
                type="text"
                name="name_kana"
                defaultValue={company?.name_kana ?? ''}
                placeholder="カブシキガイシャクルヒ"
                className={inputCls}
              />
            </Field>
          </div>
          <Field label="郵便番号">
            <input
              type="text"
              name="postal_code"
              defaultValue={company?.postal_code ?? ''}
              placeholder="000-0000"
              className={inputCls}
            />
          </Field>
          <div className="col-span-2">
            <Field label="住所">
              <input
                type="text"
                name="address"
                defaultValue={company?.address ?? ''}
                placeholder="東京都〇〇区〇〇1-2-3"
                className={inputCls}
              />
            </Field>
          </div>
          <Field label="電話番号">
            <input
              type="tel"
              name="phone"
              defaultValue={company?.phone ?? ''}
              placeholder="03-0000-0000"
              className={inputCls}
            />
          </Field>
          <Field label="FAX番号">
            <input
              type="tel"
              name="fax"
              defaultValue={company?.fax ?? ''}
              placeholder="03-0000-0001"
              className={inputCls}
            />
          </Field>
          <div className="col-span-2">
            <Field label="メールアドレス">
              <input
                type="email"
                name="email"
                defaultValue={company?.email ?? ''}
                placeholder="info@example.com"
                className={inputCls}
              />
            </Field>
          </div>
          <div className="col-span-2">
            <Field
              label={
                <>
                  インボイス登録番号
                  <span className="ml-2 text-xs font-normal text-gray-400">
                    （適格請求書発行事業者登録番号）
                  </span>
                </>
              }
            >
              <input
                type="text"
                name="invoice_number"
                defaultValue={company?.invoice_number ?? ''}
                placeholder="T1234567890123"
                maxLength={14}
                onChange={(e) => {
                  const v = e.target.value
                  setInvoiceError(
                    v && !INVOICE_RE.test(v)
                      ? '「T」＋13桁の数字で入力してください'
                      : null
                  )
                }}
                className={`${inputCls} font-mono ${invoiceError ? 'border-red-400 bg-red-50' : ''}`}
              />
              {invoiceError ? (
                <p className="mt-1 text-xs text-red-600">{invoiceError}</p>
              ) : (
                <p className="mt-1 text-xs text-gray-400">
                  未登録の場合は空欄のままにしてください
                </p>
              )}
            </Field>
          </div>
        </div>
      </section>

      {/* 取引口座 */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">取引口座</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="銀行名">
            <input
              type="text"
              name="bank_name"
              defaultValue={company?.bank_name ?? ''}
              placeholder="〇〇銀行"
              className={inputCls}
            />
          </Field>
          <Field label="支店名">
            <input
              type="text"
              name="bank_branch"
              defaultValue={company?.bank_branch ?? ''}
              placeholder="〇〇支店"
              className={inputCls}
            />
          </Field>
          <Field label="口座種別">
            <div className="relative">
              <select
                name="bank_account_type"
                defaultValue={company?.bank_account_type ?? ''}
                className={`${inputCls} appearance-none pr-8`}
              >
                <option value="">未設定</option>
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                ▼
              </span>
            </div>
          </Field>
          <Field label="口座番号">
            <input
              type="text"
              name="bank_account_no"
              defaultValue={company?.bank_account_no ?? ''}
              placeholder="0000000"
              className={inputCls}
            />
          </Field>
          <div className="col-span-2">
            <Field label="口座名義">
              <input
                type="text"
                name="bank_account_name"
                defaultValue={company?.bank_account_name ?? ''}
                placeholder="カブシキガイシャクルヒ"
                className={inputCls}
              />
            </Field>
          </div>
        </div>
      </section>

      {/* 保存ボタン */}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="px-6 py-2.5 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          style={{ backgroundColor: '#1F3864' }}
        >
          {pending ? '保存中...' : '保存する'}
        </button>
        {saved && (
          <span className="text-sm text-emerald-600 font-medium">
            ✓ 保存しました
          </span>
        )}
      </div>
    </form>
  )
}

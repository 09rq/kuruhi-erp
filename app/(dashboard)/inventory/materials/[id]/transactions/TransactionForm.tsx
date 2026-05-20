'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { createMaterialTransaction } from '../../actions'
import { MATERIAL_TRANSACTION_LABELS, type MaterialTransactionType } from '@/lib/types/inventory'

const TRANSACTION_TYPES: MaterialTransactionType[] = [
  'purchase_in',
  'production_out',
  'process_return',
  'inventory_adjust',
  'other_in',
  'other_out',
]

const cls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]'

interface Props {
  materialId: string
  materialName: string
  unit: string | null
}

export default function TransactionForm({ materialId, materialName, unit }: Props) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [txType, setTxType] = useState<MaterialTransactionType>('purchase_in')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setPending(true)
    try {
      const fd = new FormData(e.currentTarget)
      await createMaterialTransaction(materialId, fd)
    } catch (err) {
      if (isRedirectError(err)) throw err
      console.error('[TransactionForm]', err)
      alert('保存に失敗しました: ' + (err instanceof Error ? err.message : '不明なエラー'))
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg">
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <p className="text-xs font-semibold text-gray-600 mb-4">
          {materialName} — 入出庫登録
        </p>

        <div className="flex flex-col gap-4">
          {/* 取引区分 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              区分 <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                name="transaction_type"
                value={txType}
                onChange={(e) => setTxType(e.target.value as MaterialTransactionType)}
                className={`${cls} appearance-none`}
                required
              >
                {TRANSACTION_TYPES.map((t) => (
                  <option key={t} value={t}>{MATERIAL_TRANSACTION_LABELS[t]}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">▼</span>
            </div>
          </div>

          {/* 日付 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              取引日 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              name="transaction_date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              className={cls}
              required
            />
          </div>

          {/* 数量 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              数量{unit ? `（${unit}）` : ''}{' '}
              {txType === 'inventory_adjust' && (
                <span className="text-xs text-gray-400 font-normal">減少の場合はマイナス値を入力</span>
              )}
              <span className="text-red-500"> *</span>
            </label>
            <input
              type="number"
              name="quantity"
              step="0.001"
              placeholder={txType === 'inventory_adjust' ? '例: -5 または 10' : '0'}
              className={`${cls} text-right font-mono`}
              required
            />
          </div>

          {/* 単価 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              単価（円）<span className="ml-1 text-xs text-gray-400 font-normal">（任意）</span>
            </label>
            <input
              type="number"
              name="unit_price"
              min={0}
              step="1"
              placeholder="0"
              className={`${cls} text-right font-mono`}
            />
          </div>

          {/* 備考 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">備考</label>
            <input
              type="text"
              name="note"
              placeholder="メモ・備考"
              className={cls}
            />
          </div>
        </div>
      </section>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="px-6 py-2.5 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-opacity"
          style={{ backgroundColor: '#1F3864' }}
        >
          {pending ? '保存中...' : '登録する'}
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

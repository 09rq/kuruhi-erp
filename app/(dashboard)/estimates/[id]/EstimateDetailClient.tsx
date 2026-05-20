'use client'

import { useState } from 'react'
import Link from 'next/link'
import { updateEstimateStatus } from '../actions'
import EstimateStatusBadge from '../EstimateStatusBadge'
import type { EstimateStatus } from '@/lib/types/estimate'
import { ESTIMATE_STATUS_LABELS } from '@/lib/types/estimate'

interface EstimateItem {
  id: string
  sort_order: number
  item_name: string
  quantity: number | null
  unit: string | null
  unit_price: number | null
  amount: number
  notes: string | null
}

interface EstimateData {
  id: string
  estimate_number: string
  status: EstimateStatus
  client_name: string | null
  client_contact: string | null
  issue_date: string
  expiry_date: string | null
  subject: string | null
  delivery_date: string | null
  total_amount: number | null
  tax_amount: number | null
  grand_total: number | null
  payment_terms: string | null
  notes: string | null
  items: EstimateItem[]
}

const STATUS_FLOW: { from: EstimateStatus[]; to: EstimateStatus; label: string; color: string }[] = [
  { from: ['draft'],             to: 'sent',     label: '送付済にする',  color: 'bg-blue-600' },
  { from: ['sent'],              to: 'approved', label: '承認にする',    color: 'bg-emerald-600' },
  { from: ['sent'],              to: 'rejected', label: '失注にする',    color: 'bg-red-500' },
  { from: ['approved','rejected','sent'], to: 'draft', label: '下書きに戻す', color: 'bg-gray-500' },
]

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function fmtMoney(n: number | null | undefined) {
  if (n == null) return '—'
  return `¥${n.toLocaleString('ja-JP')}`
}

export default function EstimateDetailClient({ data }: { data: EstimateData }) {
  const [status, setStatus]   = useState<EstimateStatus>(data.status)
  const [updating, setUpdating] = useState(false)

  const handleStatusChange = async (next: EstimateStatus) => {
    setUpdating(true)
    try {
      await updateEstimateStatus(data.id, next)
      setStatus(next)
    } catch {
      alert('ステータスの更新に失敗しました')
    } finally {
      setUpdating(false)
    }
  }

  const transitions = STATUS_FLOW.filter((t) => t.from.includes(status))

  return (
    <div className="p-8">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href="/estimates" className="hover:text-gray-700">御見積書</Link>
            <span>/</span>
            <span className="text-gray-900">{data.estimate_number}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 font-mono">{data.estimate_number}</h1>
            <EstimateStatusBadge status={status} />
          </div>
          {data.subject && (
            <p className="mt-1 text-sm text-gray-600">{data.subject}</p>
          )}
        </div>

        {/* アクションボタン群 */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {transitions.map((t) => (
            <button
              key={t.to}
              onClick={() => handleStatusChange(t.to)}
              disabled={updating}
              className={`px-3 py-1.5 text-xs font-medium text-white rounded-lg disabled:opacity-50 transition-colors ${t.color}`}
            >
              {t.label}
            </button>
          ))}
          <a
            href={`/api/estimates/${data.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 text-xs font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            PDFダウンロード
          </a>
          <Link
            href={`/estimates/${data.id}/edit`}
            className="px-3 py-1.5 text-xs font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            編集
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* ── 基本情報 ──────────────────────────────────── */}
        <div className="col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">基本情報</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-xs text-gray-500 mb-0.5">クライアント</dt>
                <dd className="font-medium text-gray-900">{data.client_name ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 mb-0.5">担当者</dt>
                <dd className="text-gray-700">{data.client_contact ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 mb-0.5">発行日</dt>
                <dd className="text-gray-700">{fmtDate(data.issue_date)}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 mb-0.5">有効期限</dt>
                <dd className="text-gray-700">{fmtDate(data.expiry_date)}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 mb-0.5">件名</dt>
                <dd className="text-gray-700">{data.subject ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 mb-0.5">納入期日</dt>
                <dd className="text-gray-700">{fmtDate(data.delivery_date)}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500 mb-0.5">支払条件</dt>
                <dd className="text-gray-700">{data.payment_terms ?? '—'}</dd>
              </div>
            </dl>
            {data.notes && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <dt className="text-xs text-gray-500 mb-1">その他特記事項</dt>
                <dd className="text-sm text-gray-700 whitespace-pre-wrap">{data.notes}</dd>
              </div>
            )}
          </div>

          {/* ── 明細 ──────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">明細</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs font-medium text-gray-600">
                    <th className="px-4 py-2.5 text-left">品名</th>
                    <th className="px-4 py-2.5 text-right w-20">数量</th>
                    <th className="px-4 py-2.5 text-center w-16">単位</th>
                    <th className="px-4 py-2.5 text-right w-28">単価</th>
                    <th className="px-4 py-2.5 text-right w-28">金額</th>
                    <th className="px-4 py-2.5 text-left w-36">備考</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.items.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-2.5 text-gray-900">{item.item_name}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs text-gray-700">
                        {item.quantity?.toLocaleString('ja-JP') ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 text-center text-xs text-gray-600">{item.unit ?? '—'}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs text-gray-700">
                        {item.unit_price != null ? fmtMoney(item.unit_price) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs font-medium text-gray-900">
                        {fmtMoney(item.amount)}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">{item.notes ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── 金額サマリー ───────────────────────────────── */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">金額</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-600">小計</span>
                <span className="font-mono">{fmtMoney(data.total_amount)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-600">消費税（10%）</span>
                <span className="font-mono">{fmtMoney(data.tax_amount)}</span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="font-semibold text-gray-900">合計金額（税込）</span>
                <span className="font-mono font-bold text-xl text-[#1F3864]">
                  {fmtMoney(data.grand_total)}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">ステータス履歴</h2>
            <div className="space-y-1 text-xs text-gray-500">
              {(['draft','sent','approved','rejected'] as EstimateStatus[]).map((s) => (
                <div key={s} className={`flex items-center gap-2 py-0.5 ${s === status ? 'font-semibold text-gray-900' : ''}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${s === status ? 'bg-[#1F3864]' : 'bg-gray-200'}`} />
                  {ESTIMATE_STATUS_LABELS[s]}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

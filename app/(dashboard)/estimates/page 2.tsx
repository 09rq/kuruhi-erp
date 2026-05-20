import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  ESTIMATE_STATUS_LABELS,
  ESTIMATE_STATUS_COLORS,
  type EstimateStatus,
} from '@/lib/types/estimate'
import EstimateStatusBadge from './EstimateStatusBadge'
import EstimateDeleteButton from './EstimateDeleteButton'

interface SP { q?: string; status?: string }

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function fmtMoney(n: number | null | undefined) {
  if (n == null) return '—'
  return `¥${n.toLocaleString('ja-JP')}`
}

export default async function EstimatesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const { q, status } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('estimates')
    .select('*, client:customers(name)')
    .order('created_at', { ascending: false })

  if (q) query = query.or(`estimate_number.ilike.%${q}%,subject.ilike.%${q}%`)
  if (status && status !== 'all') query = query.eq('status', status)

  const { data: estimates, error } = await query

  const statusCounts = (['draft', 'sent', 'approved', 'rejected'] as EstimateStatus[])
    .reduce<Record<string, number>>((acc, s) => {
      acc[s] = estimates?.filter((e) => e.status === s).length ?? 0
      return acc
    }, {})

  return (
    <div className="p-8">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">御見積書</h1>
          <p className="mt-1 text-sm text-gray-500">見積書の作成・管理</p>
        </div>
        <Link
          href="/estimates/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ backgroundColor: '#1F3864' }}
        >
          ＋ 新規作成
        </Link>
      </div>

      {/* ステータス集計 */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {(['draft', 'sent', 'approved', 'rejected'] as EstimateStatus[]).map((s) => (
          <Link
            key={s}
            href={`/estimates?status=${s}`}
            className="bg-white rounded-xl border border-gray-200 p-3 hover:border-gray-300 transition-colors"
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-gray-500">{ESTIMATE_STATUS_LABELS[s]}</p>
              <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${ESTIMATE_STATUS_COLORS[s]}`}>
                {ESTIMATE_STATUS_LABELS[s]}
              </span>
            </div>
            <p className="text-xl font-bold text-gray-900">
              {statusCounts[s] ?? 0}
              <span className="text-xs font-normal text-gray-400 ml-1">件</span>
            </p>
          </Link>
        ))}
      </div>

      {/* 検索・フィルタ */}
      <form method="GET" className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-48">
          <label className="block text-xs font-medium text-gray-600 mb-1">キーワード</label>
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="見積番号・件名"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">ステータス</label>
          <select
            name="status"
            defaultValue={status ?? 'all'}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none appearance-none"
          >
            <option value="all">すべて</option>
            {(['draft', 'sent', 'approved', 'rejected'] as EstimateStatus[]).map((s) => (
              <option key={s} value={s}>{ESTIMATE_STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="px-4 py-2 text-white text-sm rounded-lg"
          style={{ backgroundColor: '#1F3864' }}
        >
          検索
        </button>
        <Link href="/estimates" className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">
          クリア
        </Link>
      </form>

      {/* テーブル */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {error ? (
          <div className="p-8 text-center text-red-600 text-sm">データの取得に失敗しました: {error.message}</div>
        ) : !estimates || estimates.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">見積書が登録されていません</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-600 w-40">見積番号</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 w-36">クライアント</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">件名</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 w-28">発行日</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 w-28">有効期限</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600 w-32">合計金額</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 w-20">状態</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600 w-28">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {estimates.map((est) => (
                  <tr key={est.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/estimates/${est.id}`}
                        className="font-mono text-xs text-[#1F3864] hover:underline font-medium"
                      >
                        {est.estimate_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {(est.client as { name?: string } | null)?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-900">
                      {est.subject ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{fmtDate(est.issue_date)}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{fmtDate(est.expiry_date)}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm font-medium text-gray-900">
                      {fmtMoney(est.grand_total)}
                    </td>
                    <td className="px-4 py-3">
                      <EstimateStatusBadge status={est.status as EstimateStatus} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/estimates/${est.id}/edit`}
                          className="px-2.5 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                          編集
                        </Link>
                        <EstimateDeleteButton id={est.id} estimateNumber={est.estimate_number} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="mt-3 text-xs text-gray-400 text-right">{estimates?.length ?? 0} 件表示</p>
    </div>
  )
}

'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { saveProcessesForLot, markProcessAsPaid } from '../actions'

// ─── 定数 ────────────────────────────────────────────────────────────────────
const PROCESS_NAMES = ['革裁断', '判子', '革漉き', '縫製', '内職', '検品', '梱包', 'その他'] as const

// ─── 型 ──────────────────────────────────────────────────────────────────────
export interface InitialProcess {
  id: string
  sort_order: number
  process_name: string
  vendor_id: string
  vendor_name: string | null
  planned_quantity: string
  unit_price: string
  purchase_status: 'unpaid' | 'paid'
  purchase_date: string | null
  notes: string
}

interface ProcessRow extends InitialProcess {
  _key: string
}

interface Vendor { id: string; name: string }

interface Props {
  lotId: string
  initialProcesses: InitialProcess[]
  vendors: Vendor[]
}

// ─── ユーティリティ ────────────────────────────────────────────────────────
function buildRows(processes: InitialProcess[]): ProcessRow[] {
  return processes.map((p) => ({ ...p, _key: p.id }))
}

function stateKey(processes: InitialProcess[]) {
  return processes.map((p) => `${p.id}:${p.purchase_status}`).join('|')
}

function calcAmount(row: ProcessRow) {
  return (parseInt(row.planned_quantity) || 0) * (parseFloat(row.unit_price) || 0)
}

function calcWip(row: ProcessRow) {
  return row.purchase_status === 'paid' ? calcAmount(row) : 0
}

function fmtJPY(n: number) {
  return `¥${Math.round(n).toLocaleString('ja-JP')}`
}

function fmtDate(d: string | null) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

let _seq = 0
function nextKey() { return `new-${++_seq}` }

// ─── スタイル ─────────────────────────────────────────────────────────────
const cellInput = 'w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#1F3864]'
const cellSel   = `${cellInput} appearance-none`
const numInput  = `${cellInput} text-right font-mono`

function SelWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400" style={{ fontSize: 9 }}>▼</span>
    </div>
  )
}

// ─── メインコンポーネント ──────────────────────────────────────────────────
export default function ProcessesEditor({ lotId, initialProcesses, vendors }: Props) {
  const router = useRouter()

  // initialProcesses の変化（router.refresh後）でリセット
  const prevKey = useRef(stateKey(initialProcesses))
  const [rows, setRows] = useState<ProcessRow[]>(() => buildRows(initialProcesses))

  useEffect(() => {
    const k = stateKey(initialProcesses)
    if (k !== prevKey.current) {
      prevKey.current = k
      setRows(buildRows(initialProcesses))
    }
  }, [initialProcesses])

  // pending 系
  const [saving,     setSaving]     = useState(false)
  const [payingIds,  setPayingIds]  = useState<Set<string>>(new Set())
  const [saveError,  setSaveError]  = useState<string | null>(null)

  // ── 集計（リアルタイム） ──────────────────────────────────────────────
  const amountTotal = rows.reduce((s, r) => s + calcAmount(r), 0)
  const wipTotal    = rows.reduce((s, r) => s + calcWip(r), 0)
  const paidCount   = rows.filter((r) => r.purchase_status === 'paid').length

  // ── 行操作 ────────────────────────────────────────────────────────────
  const addRow = () => {
    setRows((prev) => [
      ...prev,
      {
        _key: nextKey(),
        id: undefined as unknown as string,
        sort_order: prev.length,
        process_name: PROCESS_NAMES[0],
        vendor_id: '',
        vendor_name: null,
        planned_quantity: '0',
        unit_price: '0',
        purchase_status: 'unpaid',
        purchase_date: null,
        notes: '',
      },
    ])
    setSaveError(null)
  }

  const removeRow = (key: string) => {
    setRows((prev) => prev.filter((r) => r._key !== key))
    setSaveError(null)
  }

  const updateRow = (key: string, patch: Partial<ProcessRow>) => {
    setRows((prev) => prev.map((r) => r._key === key ? { ...r, ...patch } : r))
    setSaveError(null)
  }

  // ── 工程を保存 ────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      const unpaidRows = rows
        .filter((r) => r.purchase_status === 'unpaid')
        .map((r, i) => ({
          process_name:     r.process_name,
          vendor_id:        r.vendor_id || null,
          planned_quantity: parseInt(r.planned_quantity) || 0,
          unit_price:       parseFloat(r.unit_price) || 0,
          notes:            r.notes || null,
          sort_order:       i,
        }))
      await saveProcessesForLot(lotId, unpaidRows)
      router.refresh()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  // ── 仕入済にする（楽観的更新）──────────────────────────────────────────
  const handleMarkPaid = async (row: ProcessRow) => {
    if (!row.id) return  // 未保存行は先に保存が必要
    const key = row._key

    // 楽観的にローカル state を更新
    const todayStr = today()
    setRows((prev) =>
      prev.map((r) =>
        r._key === key
          ? { ...r, purchase_status: 'paid', purchase_date: todayStr }
          : r
      )
    )
    setPayingIds((s) => new Set([...s, key]))

    try {
      await markProcessAsPaid(row.id, lotId)
      router.refresh()
    } catch (err) {
      // 失敗時は元に戻す
      setRows((prev) =>
        prev.map((r) =>
          r._key === key
            ? { ...r, purchase_status: 'unpaid', purchase_date: null }
            : r
        )
      )
      alert('更新に失敗しました: ' + (err instanceof Error ? err.message : '不明なエラー'))
    } finally {
      setPayingIds((s) => { const n = new Set(s); n.delete(key); return n })
    }
  }

  // ── レンダリング ──────────────────────────────────────────────────────
  return (
    <div>
      {/* ─── サマリーカード ─── */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">加工費合計</p>
          <p className="text-xl font-bold font-mono text-gray-900">{fmtJPY(amountTotal)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">仕入済工程数</p>
          <p className="text-xl font-bold font-mono text-gray-900">
            {paidCount}
            <span className="text-sm font-normal text-gray-400 ml-1">/ {rows.length} 工程</span>
          </p>
        </div>
        <div className="bg-white rounded-xl border border-[#1F3864]/30 p-4">
          <p className="text-xs text-gray-500 mb-1">仕掛品評価額</p>
          <p className="text-xl font-bold font-mono text-[#1F3864]">{fmtJPY(wipTotal)}</p>
          <p className="text-xs text-gray-400 mt-0.5">仕入済工程の金額合計</p>
        </div>
      </div>

      {/* ─── 加工工程テーブル ─── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <p className="text-xs font-semibold text-gray-600">加工工程</p>
          <span className="text-xs text-gray-500">
            仕掛品評価額：
            <span className="font-mono font-semibold text-[#1F3864] ml-1">{fmtJPY(wipTotal)}</span>
          </span>
        </div>

        {rows.length === 0 ? (
          <div className="py-10 text-center text-gray-400 text-sm">
            工程が登録されていません。下の「工程を追加」から登録できます。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-3 py-2.5 text-left font-medium text-gray-500 w-8 text-xs">#</th>
                  <th className="px-3 py-2.5 text-left font-medium text-gray-500 text-xs">工程名</th>
                  <th className="px-3 py-2.5 text-left font-medium text-gray-500 w-36 text-xs">外注先</th>
                  <th className="px-3 py-2.5 text-right font-medium text-gray-500 w-24 text-xs">予定数量</th>
                  <th className="px-3 py-2.5 text-right font-medium text-gray-500 w-28 text-xs">単価（円）</th>
                  <th className="px-3 py-2.5 text-right font-medium text-gray-500 w-28 text-xs">金額</th>
                  <th className="px-3 py-2.5 text-left font-medium text-gray-500 w-28 text-xs">仕入状態</th>
                  <th className="px-3 py-2.5 text-right font-medium text-gray-500 w-28 text-xs">仕掛品評価額</th>
                  <th className="px-3 py-2.5 text-right font-medium text-gray-500 w-36 text-xs">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row, idx) => {
                  const isPaid  = row.purchase_status === 'paid'
                  const amount  = calcAmount(row)
                  const wip     = calcWip(row)
                  const paying  = payingIds.has(row._key)

                  if (isPaid) {
                    // ─── 仕入済行（読み取り専用）───
                    return (
                      <tr key={row._key} className="bg-green-50/40 hover:bg-green-50 transition-colors">
                        <td className="px-3 py-2.5 text-xs text-gray-400">{idx + 1}</td>
                        <td className="px-3 py-2.5 font-medium text-gray-800 text-sm">{row.process_name}</td>
                        <td className="px-3 py-2.5 text-gray-600 text-xs">{row.vendor_name ?? '—'}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-gray-700 text-xs">
                          {(parseInt(row.planned_quantity) || 0).toLocaleString('ja-JP')}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-gray-600 text-xs">
                          {fmtJPY(parseFloat(row.unit_price) || 0)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-gray-700 text-xs">
                          {fmtJPY(amount)}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                            仕入済
                          </span>
                          {row.purchase_date && (
                            <p className="text-xs text-gray-400 mt-0.5">{fmtDate(row.purchase_date)}</p>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-semibold text-[#1F3864] text-sm">
                          {fmtJPY(wip)}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {/* 仕入済行は操作なし */}
                        </td>
                      </tr>
                    )
                  }

                  // ─── 未仕入行（編集可能）───
                  return (
                    <tr key={row._key} className="hover:bg-gray-50/70 transition-colors">
                      <td className="px-3 py-2 text-xs text-gray-400">{idx + 1}</td>

                      {/* 工程名 */}
                      <td className="px-3 py-2">
                        <SelWrap>
                          <select
                            value={row.process_name}
                            onChange={(e) => updateRow(row._key, { process_name: e.target.value })}
                            className={`${cellSel} pr-5`}
                          >
                            {PROCESS_NAMES.map((n) => (
                              <option key={n} value={n}>{n}</option>
                            ))}
                          </select>
                        </SelWrap>
                      </td>

                      {/* 外注先 */}
                      <td className="px-3 py-2">
                        <SelWrap>
                          <select
                            value={row.vendor_id}
                            onChange={(e) => updateRow(row._key, { vendor_id: e.target.value })}
                            className={`${cellSel} pr-5`}
                          >
                            <option value="">選択（任意）</option>
                            {vendors.map((v) => (
                              <option key={v.id} value={v.id}>{v.name}</option>
                            ))}
                          </select>
                        </SelWrap>
                      </td>

                      {/* 予定数量 */}
                      <td className="px-3 py-2 w-24">
                        <input
                          type="number" min={0} step={1}
                          value={row.planned_quantity}
                          onChange={(e) => updateRow(row._key, { planned_quantity: e.target.value })}
                          className={numInput}
                        />
                      </td>

                      {/* 単価 */}
                      <td className="px-3 py-2 w-28">
                        <input
                          type="number" min={0} step={1}
                          value={row.unit_price}
                          onChange={(e) => updateRow(row._key, { unit_price: e.target.value })}
                          className={numInput}
                        />
                      </td>

                      {/* 金額（自動計算） */}
                      <td className="px-3 py-2 text-right font-mono text-gray-700 text-sm whitespace-nowrap">
                        {fmtJPY(amount)}
                      </td>

                      {/* 仕入状態バッジ */}
                      <td className="px-3 py-2">
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700">
                          未仕入
                        </span>
                      </td>

                      {/* 仕掛品評価額（未仕入は 0）*/}
                      <td className="px-3 py-2 text-right font-mono text-gray-400 text-xs">
                        ¥0
                      </td>

                      {/* 操作 */}
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* 仕入済にする（既存行のみ） */}
                          {row.id && (
                            <button
                              type="button"
                              onClick={() => handleMarkPaid(row)}
                              disabled={paying}
                              className="px-2 py-1 text-xs rounded border border-green-600 text-green-700 hover:bg-green-50 disabled:opacity-50 transition-colors whitespace-nowrap"
                            >
                              {paying ? '処理中' : '仕入済にする'}
                            </button>
                          )}
                          {/* 削除 */}
                          <button
                            type="button"
                            onClick={() => removeRow(row._key)}
                            className="px-2 py-1 text-xs rounded border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                            aria-label="削除"
                          >
                            削除
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>

              {/* フッター合計行 */}
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td colSpan={5} className="px-3 py-2.5 text-xs font-semibold text-gray-600 text-right">
                    合計
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold text-gray-900 text-sm">
                    {fmtJPY(amountTotal)}
                  </td>
                  <td />
                  <td className="px-3 py-2.5 text-right font-mono font-semibold text-[#1F3864] text-sm">
                    {fmtJPY(wipTotal)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* ─── テーブル下部ボタンエリア ─── */}
        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-dashed border-gray-400 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            ＋ 工程を追加
          </button>

          <div className="flex items-center gap-3">
            {saveError && (
              <p className="text-xs text-red-600">{saveError}</p>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-opacity"
              style={{ backgroundColor: '#1F3864' }}
            >
              {saving ? '保存中...' : '工程を保存'}
            </button>
          </div>
        </div>
      </div>

      {/* 未保存行の仕入済ボタンに関する注意 */}
      {rows.some((r) => r.purchase_status === 'unpaid' && !r.id) && (
        <p className="mt-2 text-xs text-amber-600">
          ※ 新規追加行は「工程を保存」後に「仕入済にする」ボタンが有効になります
        </p>
      )}
    </div>
  )
}

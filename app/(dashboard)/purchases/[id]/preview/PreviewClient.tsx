'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import Link from 'next/link'
import { updatePOStatus, markPODelivered } from '../../actions'
import StatusBadge from '../../StatusBadge'
import type { PurchaseOrder, PurchaseOrderItem, POStatus } from '@/lib/types/purchase-order'
import { PO_STATUS_LABELS } from '@/lib/types/purchase-order'

// PDFViewer + Document を一体化したラッパー（SSR無効）
const PDFViewerWrapper = dynamic(
  () => import('./PDFViewerWrapper'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        PDF を読み込み中...
      </div>
    ),
  }
)

interface CompanyInfo { name: string; address: string | null; phone: string | null; fax: string | null; invoice_number: string | null }

interface Props {
  order: PurchaseOrder & { items: PurchaseOrderItem[] }
  company: CompanyInfo
  employeeName?: string
}

const STATUS_FLOW: { from: POStatus[]; to: POStatus; label: string; color: string }[] = [
  { from: ['draft'],             to: 'ordered',           label: '発注済にする',   color: 'bg-blue-600' },
  { from: ['ordered'],           to: 'awaiting_delivery', label: '納品待ちにする', color: 'bg-amber-500' },
  { from: ['awaiting_delivery'], to: 'delivered',         label: '納品済にする',   color: 'bg-emerald-600' },
  { from: ['draft','ordered','awaiting_delivery'], to: 'cancelled', label: 'キャンセル', color: 'bg-red-500' },
  { from: ['cancelled'],         to: 'draft',             label: '下書きに戻す',   color: 'bg-gray-500' },
]

export default function PreviewClient({ order, company, employeeName }: Props) {
  const [status, setStatus] = useState<POStatus>(order.status as POStatus)
  const [updating, setUpdating] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [emailSubject, setEmailSubject] = useState(
    `【発注書】${order.po_number}　${company.name}`
  )
  const [emailBody, setEmailBody] = useState(
    `${order.supplier_name} 御中\n\nお世話になっております。\n${company.name}の${employeeName ?? '担当'}です。\n\n下記の通り発注書を送付いたします。\nご確認のほどよろしくお願いいたします。\n\n発注NO: ${order.po_number}\n発注日: ${order.order_date}\n御注文金額: ¥${order.subtotal.toLocaleString('ja-JP')}\n\n以上、よろしくお願いいたします。`
  )
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<string | null>(null)

  const [showReceiveModal, setShowReceiveModal] = useState(false)
  const [receivedQuantities, setReceivedQuantities] = useState<Record<string, string>>({})

  const handleStatusChange = async (next: POStatus) => {
    if (next === 'delivered') {
      // 納品済にする場合は、先に実納品数量を確認するモーダルを開く
      const initial: Record<string, string> = {}
      for (const item of order.items) {
        initial[item.id] = String(item.received_quantity ?? item.quantity)
      }
      setReceivedQuantities(initial)
      setShowReceiveModal(true)
      return
    }
    setUpdating(true)
    try {
      await updatePOStatus(order.id, next)
      setStatus(next)
    } catch (e) {
      alert('ステータスの更新に失敗しました')
    } finally {
      setUpdating(false)
    }
  }

  const handleConfirmDelivery = async () => {
    setUpdating(true)
    try {
      const quantities: Record<string, number> = {}
      for (const item of order.items) {
        quantities[item.id] = parseFloat(receivedQuantities[item.id] ?? '') || 0
      }
      await markPODelivered(order.id, quantities)
      setStatus('delivered')
      setShowReceiveModal(false)
    } catch (e) {
      alert('納品済への更新に失敗しました')
    } finally {
      setUpdating(false)
    }
  }

  const handleSendEmail = async () => {
    setSending(true)
    setSendResult(null)
    try {
      const res = await fetch(`/api/purchases/${order.id}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: emailSubject, body: emailBody }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'メール送信失敗')
      setSendResult('✓ 送信しました')
      setTimeout(() => setShowEmailModal(false), 1500)
    } catch (e) {
      setSendResult('✗ ' + (e instanceof Error ? e.message : '送信失敗'))
    } finally {
      setSending(false)
    }
  }

  const availableTransitions = STATUS_FLOW.filter((t) => t.from.includes(status))

  return (
    <div className="flex flex-col h-full">
      {/* ツールバー */}
      <div className="flex items-center gap-3 px-6 py-3 bg-white border-b border-gray-200 flex-shrink-0">
        <Link href="/purchases" className="text-sm text-gray-500 hover:text-gray-700">← 一覧に戻る</Link>
        <span className="text-gray-300">|</span>
        <span className="font-mono text-sm font-medium text-gray-700">{order.po_number}</span>
        <StatusBadge status={status} />
        <span className="text-gray-500 text-sm">{order.supplier_name}</span>
        <span className="text-sm font-semibold text-gray-900 ml-auto">
          ¥{order.subtotal.toLocaleString('ja-JP')}
        </span>

        {/* ステータス遷移ボタン */}
        <div className="flex gap-2">
          {availableTransitions.map((t) => (
            <button
              key={t.to}
              onClick={() => handleStatusChange(t.to)}
              disabled={updating}
              className={`px-3 py-1.5 text-xs font-medium text-white rounded-lg disabled:opacity-50 ${t.color}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* PDF ダウンロード */}
        <a
          href={`/api/purchases/${order.id}/pdf`}
          target="_blank"
          className="px-3 py-1.5 text-xs font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          PDF DL
        </a>

        {/* メール送信 */}
        <button
          onClick={() => setShowEmailModal(true)}
          className="px-3 py-1.5 text-xs font-medium text-white rounded-lg"
          style={{ backgroundColor: '#1F3864' }}
        >
          メール送信
        </button>

        <Link
          href={`/purchases/${order.id}/edit`}
          className="px-3 py-1.5 text-xs font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
        >
          編集
        </Link>
      </div>

      {/* PDF ビューアー */}
      <div className="flex-1 min-h-0 h-full">
        <PDFViewerWrapper order={order} company={company} employeeName={employeeName} />
      </div>

      {/* メール送信モーダル */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">メール送信</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">宛先</label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
                  {order.supplier_name}（メールアドレスは取引先情報から自動取得）
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">件名</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">本文</label>
                <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  rows={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864] resize-none"
                />
              </div>
              <p className="text-xs text-gray-400">※ PDF が自動添付されます</p>
              {sendResult && (
                <p className={`text-sm font-medium ${sendResult.startsWith('✓') ? 'text-emerald-600' : 'text-red-600'}`}>
                  {sendResult}
                </p>
              )}
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={handleSendEmail}
                disabled={sending}
                className="flex-1 py-2.5 text-white text-sm font-medium rounded-lg disabled:opacity-50"
                style={{ backgroundColor: '#1F3864' }}
              >
                {sending ? '送信中...' : '送信する'}
              </button>
              <button
                onClick={() => { setShowEmailModal(false); setSendResult(null) }}
                className="px-6 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 納品済にする（実納品数量入力）モーダル */}
      {showReceiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-1">実納品数量の入力</h2>
            <p className="text-xs text-gray-500 mb-4">
              実際に届いた数量を入力してください（革などの実測材料は発注数量とズレることがあります）。この数量が在庫に加算されます。
            </p>
            <div className="max-h-80 overflow-y-auto border border-gray-200 rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left p-2.5 font-medium text-gray-600">品目</th>
                    <th className="text-left p-2.5 font-medium text-gray-600">色</th>
                    <th className="text-right p-2.5 font-medium text-gray-600">発注数量</th>
                    <th className="text-right p-2.5 font-medium text-gray-600 w-32">実納品数量</th>
                    <th className="text-left p-2.5 font-medium text-gray-600 w-16">単位</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.id} className="border-b border-gray-100 last:border-0">
                      <td className="p-2.5 text-gray-800">{item.item_name}</td>
                      <td className="p-2.5 text-gray-600">{item.color || '—'}</td>
                      <td className="p-2.5 text-right text-gray-500">{item.quantity}</td>
                      <td className="p-2.5">
                        <input
                          type="number"
                          step="any"
                          value={receivedQuantities[item.id] ?? ''}
                          onChange={(e) => setReceivedQuantities((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          className="w-full text-right px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </td>
                      <td className="p-2.5 text-gray-500">{item.unit || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={handleConfirmDelivery}
                disabled={updating}
                className="flex-1 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                {updating ? '処理中...' : 'この数量で納品済にする'}
              </button>
              <button
                onClick={() => setShowReceiveModal(false)}
                disabled={updating}
                className="px-6 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

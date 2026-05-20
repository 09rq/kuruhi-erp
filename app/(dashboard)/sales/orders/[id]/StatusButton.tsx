'use client'

import { useState } from 'react'
import { updateSOStatus } from '../actions'
import { SO_STATUS_LABELS, SO_NEXT_STATUS, type SOStatus } from '@/lib/types/sales-order'

export default function StatusButton({ orderId, currentStatus }: { orderId: string; currentStatus: SOStatus }) {
  const [pending, setPending] = useState(false)
  const nextStatus = SO_NEXT_STATUS[currentStatus]
  if (!nextStatus) return null

  const handleClick = async () => {
    if (!confirm(`ステータスを「${SO_STATUS_LABELS[nextStatus]}」に変更しますか？`)) return
    setPending(true)
    try {
      await updateSOStatus(orderId, nextStatus)
    } catch (err) {
      alert('更新に失敗しました: ' + (err instanceof Error ? err.message : '不明なエラー'))
      setPending(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="px-4 py-2 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-opacity"
      style={{ backgroundColor: '#1F3864' }}
    >
      {pending ? '処理中...' : `→ ${SO_STATUS_LABELS[nextStatus]}へ`}
    </button>
  )
}

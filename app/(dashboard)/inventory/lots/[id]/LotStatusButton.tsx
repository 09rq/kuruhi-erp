'use client'

import { useState } from 'react'
import { updateLotStatus } from '../actions'
import { LOT_STATUS_LABELS, type LotStatus } from '@/lib/types/inventory'

interface Props {
  lotId: string
  currentStatus: LotStatus
}

const NEXT_STATUS: Partial<Record<LotStatus, LotStatus>> = {
  planned:     'in_progress',
  in_progress: 'completed',
}

export default function LotStatusButton({ lotId, currentStatus }: Props) {
  const [pending, setPending] = useState(false)
  const nextStatus = NEXT_STATUS[currentStatus]

  if (!nextStatus) return null

  const handleClick = async () => {
    if (!confirm(`ステータスを「${LOT_STATUS_LABELS[nextStatus]}」に変更しますか？`)) return
    setPending(true)
    try {
      await updateLotStatus(lotId, nextStatus)
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
      {pending ? '処理中...' : `→ ${LOT_STATUS_LABELS[nextStatus]}へ`}
    </button>
  )
}

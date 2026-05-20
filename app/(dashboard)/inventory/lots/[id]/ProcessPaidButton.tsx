'use client'

import { useState } from 'react'
import { markProcessAsPaid } from '../actions'

interface Props {
  processId: string
  lotId: string
}

export default function ProcessPaidButton({ processId, lotId }: Props) {
  const [pending, setPending] = useState(false)

  const handleClick = async () => {
    if (!confirm('この工程を「仕入済」にしますか？')) return
    setPending(true)
    try {
      await markProcessAsPaid(processId, lotId)
    } catch (err) {
      alert('更新に失敗しました: ' + (err instanceof Error ? err.message : '不明なエラー'))
      setPending(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="px-2.5 py-1 text-xs rounded border border-green-600 text-green-700 hover:bg-green-50 disabled:opacity-50 transition-colors"
    >
      {pending ? '処理中...' : '仕入済にする'}
    </button>
  )
}

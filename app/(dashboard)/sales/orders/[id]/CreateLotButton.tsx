'use client'

import { useState } from 'react'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { createLotsFromOrder } from '../actions'

export default function CreateLotButton({ orderId, hasUnlinkedItems }: { orderId: string; hasUnlinkedItems: boolean }) {
  const [pending, setPending] = useState(false)

  if (!hasUnlinkedItems) {
    return (
      <span className="px-4 py-2 text-sm text-gray-400 border border-gray-200 rounded-lg bg-gray-50 cursor-not-allowed">
        製造ロット作成済
      </span>
    )
  }

  const handleClick = async () => {
    if (!confirm('受注明細から製造ロットを作成しますか？\n（製品が設定されていてロット未作成の明細が対象です）')) return
    setPending(true)
    try {
      await createLotsFromOrder(orderId)
    } catch (err) {
      if (isRedirectError(err)) throw err
      alert('ロット作成に失敗しました: ' + (err instanceof Error ? err.message : '不明なエラー'))
      setPending(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="px-4 py-2 text-sm font-medium rounded-lg border border-[#1F3864] text-[#1F3864] hover:bg-blue-50 disabled:opacity-50 transition-colors"
    >
      {pending ? '作成中...' : '製造ロット作成'}
    </button>
  )
}

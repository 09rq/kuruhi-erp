'use client'

import { useRouter } from 'next/navigation'
import { deletePurchaseOrder } from './actions'

export default function PODeleteButton({ id, poNumber }: { id: string; poNumber: string }) {
  const router = useRouter()
  const handleDelete = async () => {
    if (!confirm(`発注書「${poNumber}」を削除しますか？\nこの操作は取り消せません。`)) return
    await deletePurchaseOrder(id)
    router.refresh()
  }
  return (
    <button
      onClick={handleDelete}
      className="px-2.5 py-1 text-xs rounded border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
    >
      削除
    </button>
  )
}

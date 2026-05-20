'use client'

import { useRouter } from 'next/navigation'
import { deleteEstimate } from './actions'

export default function EstimateDeleteButton({ id, estimateNumber }: { id: string; estimateNumber: string }) {
  const router = useRouter()
  const handleDelete = async () => {
    if (!confirm(`見積書「${estimateNumber}」を削除しますか？\nこの操作は取り消せません。`)) return
    await deleteEstimate(id)
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

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { deleteSalesOrder } from '../actions'

export default function SalesOrderDeleteButton({ orderId }: { orderId: string }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirm('この受注を削除しますか？この操作は元に戻せません。')) return
    setDeleting(true)
    try {
      await deleteSalesOrder(orderId)
      router.push('/sales/orders')
    } catch {
      alert('削除に失敗しました')
      setDeleting(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
    >
      <Trash2 className="h-4 w-4" />
      削除
    </button>
  )
}

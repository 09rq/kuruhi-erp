'use client'

import { useRouter } from 'next/navigation'
import { deleteProduct } from './actions'

export default function ProductDeleteButton({ id, name }: { id: string; name: string }) {
  const router = useRouter()
  const handleDelete = async () => {
    if (!confirm(`「${name}」を削除しますか？\nこの操作は取り消せません。`)) return
    await deleteProduct(id)
    router.push('/products')
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

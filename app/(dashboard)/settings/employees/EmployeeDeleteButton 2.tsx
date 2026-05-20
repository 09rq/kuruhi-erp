'use client'

import { deleteEmployee } from './actions'

export default function EmployeeDeleteButton({
  id,
  name,
}: {
  id: string
  name: string
}) {
  const handleDelete = async () => {
    if (!confirm(`「${name}」を削除しますか？\n取引先の担当者設定も解除されます。`)) return
    await deleteEmployee(id)
    window.location.reload()
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

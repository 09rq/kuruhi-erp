'use client'

import { useRouter } from 'next/navigation'
import { deleteMaterialGroup } from '../actions'

export default function GroupDeleteButton({ id, name }: { id: string; name: string }) {
  const router = useRouter()
  const handleDelete = async () => {
    if (!confirm(`グループ「${name}」を削除しますか？\n所属している材料はグループ解除されますが、材料自体は削除されません。`)) return
    try {
      await deleteMaterialGroup(id)
      router.push('/materials/groups')
    } catch (e) {
      alert('削除に失敗しました: ' + (e instanceof Error ? e.message : '不明なエラー'))
    }
  }
  return (
    <button
      onClick={handleDelete}
      className="px-3 py-1.5 text-xs rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
    >
      グループを削除
    </button>
  )
}

'use client'

import { deleteMaterial } from './actions'

export default function MaterialDeleteButton({ id, name }: { id: string; name: string }) {
  const handleDelete = async () => {
    if (!confirm(`「${name}」を削除しますか？\nこの操作は取り消せません。`)) return
    try {
      await deleteMaterial(id)
      window.location.reload()
    } catch (e) {
      const message = e instanceof Error ? e.message : '不明なエラー'
      alert(
        `「${name}」は削除できませんでした。\n\n` +
        `発注書・製品の原価明細・BOM（部品表）・在庫の入出庫履歴・棚卸のいずれかで、この材料が既に使用されているため削除できません。\n` +
        `削除する代わりに、編集画面から「ステータス」を「無効」にすることをおすすめします。\n\n` +
        `詳細: ${message}`
      )
    }
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

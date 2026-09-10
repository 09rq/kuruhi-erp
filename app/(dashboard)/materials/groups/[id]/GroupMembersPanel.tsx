'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { addMaterialToGroup, removeMaterialFromGroup } from '../actions'
import SearchableSelect from '@/components/SearchableSelect'

interface Member {
  id: string
  code: string
  name: string
  color_cd: string | null
  standard_price: number | null
  price_overridden: boolean
  current_stock: number
  unit: string | null
}

interface Candidate {
  id: string
  code: string
  name: string
  color_cd: string | null
}

interface Props {
  groupId: string
  groupPrice: number | null
  members: Member[]
  candidates: Candidate[]
}

export default function GroupMembersPanel({ groupId, groupPrice, members, candidates }: Props) {
  const router = useRouter()
  const [addId, setAddId] = useState('')
  const [pending, setPending] = useState(false)

  const handleAdd = async () => {
    if (!addId) return
    setPending(true)
    try {
      await addMaterialToGroup(addId, groupId)
      setAddId('')
      router.refresh()
    } catch (e) {
      alert('追加に失敗しました: ' + (e instanceof Error ? e.message : '不明なエラー'))
    } finally {
      setPending(false)
    }
  }

  const handleRemove = async (materialId: string, name: string) => {
    if (!confirm(`「${name}」をこのグループから外しますか？（材料自体は削除されません）`)) return
    setPending(true)
    try {
      await removeMaterialFromGroup(materialId, groupId)
      router.refresh()
    } catch (e) {
      alert('解除に失敗しました: ' + (e instanceof Error ? e.message : '不明なエラー'))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-end gap-2 mb-4 pb-4 border-b border-gray-100">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">既存の材料を追加</label>
          <SearchableSelect
            value={addId}
            onChange={(id) => setAddId(id)}
            options={candidates.map((c) => ({
              id: c.id,
              label: `${c.name}${c.color_cd ? `（${c.color_cd}）` : ''}`,
              sublabel: c.code,
            }))}
            placeholder="材料名で検索（未グループの材料のみ表示）"
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={!addId || pending}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40"
          style={{ backgroundColor: '#1F3864' }}
        >
          追加
        </button>
      </div>

      {members.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">まだ材料が追加されていません</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 border-b border-gray-100">
              <th className="text-left py-2 font-medium">材料</th>
              <th className="text-right py-2 font-medium">単価</th>
              <th className="text-right py-2 font-medium">在庫</th>
              <th className="text-center py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {members.map((m) => (
              <tr key={m.id}>
                <td className="py-2">
                  <Link href={`/materials/${m.id}/edit`} className="text-blue-600 hover:underline">
                    {m.name}{m.color_cd ? `（${m.color_cd}）` : ''}
                  </Link>
                  <div className="text-xs text-gray-400 font-mono">{m.code}</div>
                </td>
                <td className="py-2 text-right">
                  {m.price_overridden ? (
                    <span className="text-orange-600 font-medium" title="個別単価（グループ単価とは連動しません）">
                      {m.standard_price?.toLocaleString() ?? '—'}円 ※個別
                    </span>
                  ) : (
                    <span className="text-gray-700">{m.standard_price?.toLocaleString() ?? '—'}円</span>
                  )}
                </td>
                <td className="py-2 text-right text-gray-600">{m.current_stock}{m.unit ?? ''}</td>
                <td className="py-2 text-center">
                  <button
                    onClick={() => handleRemove(m.id, m.name)}
                    disabled={pending}
                    className="text-xs text-red-500 hover:underline disabled:opacity-40"
                  >
                    外す
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {groupPrice === null && (
        <p className="mt-3 text-xs text-amber-600">
          ※ グループの単価が未設定です。先にグループ情報で単価を設定してください。
        </p>
      )}
    </div>
  )
}

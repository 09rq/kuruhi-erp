'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createMaterialGroup, updateMaterialGroup } from './actions'
import SearchableSelect from '@/components/SearchableSelect'
import { MATERIAL_CATEGORIES, MATERIAL_UNITS } from '@/lib/types/material'
import type { MaterialGroup } from '@/lib/types/material-group'

interface SupplierOption { id: string; name: string }

interface Props {
  group?: MaterialGroup
  suppliers?: SupplierOption[]
}

export default function MaterialGroupForm({ group, suppliers = [] }: Props) {
  const router = useRouter()
  const isEdit = !!group
  const [pending, setPending] = useState(false)
  const [supplierId, setSupplierId] = useState(group?.supplier_id ?? '')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setPending(true)
    const formData = new FormData(e.currentTarget)
    try {
      if (isEdit) {
        await updateMaterialGroup(group.id, formData)
        router.push(`/materials/groups/${group.id}`)
      } else {
        await createMaterialGroup(formData)
      }
    } catch (err) {
      alert('保存に失敗しました: ' + (err instanceof Error ? err.message : '不明なエラー'))
      setPending(false)
    }
  }

  const cls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]'

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            グループ名 <span className="text-red-500">*</span>
          </label>
          <input type="text" name="name" defaultValue={group?.name} required placeholder="例：ボーナ" className={cls} />
          <p className="mt-1 text-xs text-gray-400">色違いの元になる材料の共通名を入れてください</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">区分</label>
            <select name="category" defaultValue={group?.category ?? ''} className={cls}>
              <option value="">未設定</option>
              {MATERIAL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">単位</label>
            <select name="unit" defaultValue={group?.unit ?? ''} className={cls}>
              <option value="">未設定</option>
              {MATERIAL_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            単価（円） <span className="text-red-500">*</span>
          </label>
          <input type="number" step="any" name="standard_price" defaultValue={group?.standard_price ?? ''} required className={cls} />
          <p className="mt-1 text-xs text-gray-400">
            {isEdit ? 'この単価を変更すると、個別単価にしていない所属材料すべてに自動で反映されます' : '所属する材料の基準単価になります'}
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">仕入先</label>
          <SearchableSelect
            name="supplier_id"
            value={supplierId}
            onChange={(id) => setSupplierId(id)}
            options={suppliers.map((s) => ({ id: s.id, label: s.name }))}
            placeholder="仕入先名で検索"
            className={cls}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">備考</label>
          <textarea name="note" defaultValue={group?.note ?? ''} rows={2} className={cls} />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">状態</label>
          <select name="is_active" defaultValue={group ? (group.is_active ? 'true' : 'false') : 'true'} className={cls}>
            <option value="true">有効</option>
            <option value="false">無効</option>
          </select>
        </div>
      </div>

      <div className="flex gap-3">
        <button type="submit" disabled={pending}
          className="px-6 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: '#1F3864' }}>
          {pending ? '保存中...' : isEdit ? '更新する' : '作成する'}
        </button>
        <button type="button" onClick={() => router.back()}
          className="px-6 py-2.5 rounded-lg text-sm font-medium text-gray-600 border border-gray-300 hover:bg-gray-50">
          キャンセル
        </button>
      </div>
    </form>
  )
}

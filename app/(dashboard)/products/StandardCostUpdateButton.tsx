'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'

export default function StandardCostUpdateButton() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function handleUpdate() {
    if (!confirm('全製品の標準原価を材料の月末単価で一括更新します。よろしいですか？')) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/products/update-standard-cost', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setResult(`✅ 材料費${data.updatedItems}件・製品${data.updatedProducts}件を更新しました`)
      } else {
        setResult(`❌ エラー: ${data.error}`)
      }
    } catch {
      setResult('❌ 更新に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      {result && (
        <span className="text-sm text-gray-600">{result}</span>
      )}
      <button
        onClick={handleUpdate}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        標準原価を一括更新
      </button>
    </div>
  )
}

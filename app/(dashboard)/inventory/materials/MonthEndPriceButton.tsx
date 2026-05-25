'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'

export default function MonthEndPriceButton() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function handleUpdate() {
    if (!confirm('全材料の月末単価を直近の仕入単価で一括更新します。よろしいですか？')) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/materials/update-month-end-price', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setResult(`✅ ${data.updatedCount}件の月末単価を更新しました`)
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
        月末単価を一括更新
      </button>
    </div>
  )
}

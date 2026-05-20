'use client'

import { useState } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'

interface Props {
  yearMonth: string
  plData: { account_name: string; balance: number; ratio: number }[]
  mfgData: { account_name: string; balance: number; ratio: number }[]
}

export default function AiSummary({ yearMonth, plData, mfgData }: Props) {
  const [summary, setSummary] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    setSummary(null)
    try {
      const res = await fetch('/api/ai-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yearMonth, plData, mfgData }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSummary(data.summary)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 mt-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-600" />
          <h3 className="text-sm font-bold text-gray-900">AI会計総評</h3>
        </div>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="flex items-center gap-2 bg-purple-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {loading ? '生成中...' : 'AIで総評を生成'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {summary && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
          <p className="text-sm text-gray-800 whitespace-pre-wrap">{summary}</p>
        </div>
      )}

      {!summary && !loading && !error && (
        <p className="text-sm text-gray-400 text-center py-4">
          「AIで総評を生成」ボタンを押すと、財務データを分析した総評が表示されます
        </p>
      )}
    </div>
  )
}

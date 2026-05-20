'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, EyeOff, Eye } from 'lucide-react'

type MemoType = 'self' | 'manager'
type EvalPeriod = 'first_half' | 'second_half' | 'full_year'

interface Memo {
  id: string
  memo_date: string
  content: string
  memo_type: MemoType
}

interface Props {
  memberId: string
  period: EvalPeriod
  canViewAll: boolean
  onMemosChange?: (selfMemos: Memo[], managerMemos: Memo[]) => void
}

export default function EvalMemo({ memberId, period, canViewAll, onMemosChange }: Props) {
  const supabase = createClient()
  const [selfMemos, setSelfMemos] = useState<Memo[]>([])
  const [managerMemos, setManagerMemos] = useState<Memo[]>([])
  const [loading, setLoading] = useState(true)
  const [newContent, setNewContent] = useState('')
  const [newManagerContent, setNewManagerContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'self' | 'manager'>('self')
  const [error, setError] = useState<string | null>(null)

  const fetchMemos = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('eval_memos')
        .select('*')
        .eq('member_id', memberId)
        .eq('fiscal_year', 63)
        .eq('period', period)
        .order('created_at', { ascending: false })

      if (error) throw error
      const self = (data || []).filter(m => m.memo_type === 'self')
      const manager = (data || []).filter(m => m.memo_type === 'manager')
      setSelfMemos(self)
      setManagerMemos(manager)
      if (onMemosChange) onMemosChange(self, manager)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [supabase, memberId, period, onMemosChange])

  useEffect(() => { fetchMemos() }, [fetchMemos])

  async function handleAddMemo(type: MemoType) {
    const content = type === 'self' ? newContent : newManagerContent
    if (!content.trim()) return
    setSaving(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('ログインが必要です')

      const { error } = await supabase.from('eval_memos').insert({
        member_id: memberId,
        fiscal_year: 63,
        period,
        memo_date: new Date().toISOString().split('T')[0],
        content: content.trim(),
        memo_type: type,
        created_by: user.id,
      })

      if (error) throw error

      if (type === 'self') setNewContent('')
      else setNewManagerContent('')
      fetchMemos()
    } catch (e) {
      console.error(e)
      setError('保存に失敗しました: ' + String(e))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      const { error } = await supabase.from('eval_memos').delete().eq('id', id)
      if (error) throw error
      fetchMemos()
    } catch (e) {
      console.error(e)
    }
  }

  if (loading) return <div className="flex items-center justify-center h-16"><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" /></div>

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 mt-4">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-gray-500">🔒</span>
        <h3 className="text-sm font-bold text-gray-900">面談メモ・気づきノート</h3>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3 text-xs text-red-700">{error}</div>
      )}

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('self')}
          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${activeTab === 'self' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          <EyeOff className="h-3 w-3" />
          本人専用メモ（{selfMemos.length}件）
        </button>
        {canViewAll && (
          <button
            onClick={() => setActiveTab('manager')}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${activeTab === 'manager' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            <Eye className="h-3 w-3" />
            評価者専用メモ（{managerMemos.length}件）
          </button>
        )}
      </div>

      {activeTab === 'self' && (
        <div>
          <div className="text-xs mb-3 px-3 py-2 rounded-lg flex items-center gap-1.5 bg-blue-50 text-blue-700">
            <EyeOff className="h-3 w-3 flex-shrink-0" />
            このメモは本人のみ閲覧できます。上司・管理者には見えません。
          </div>
          <div className="flex gap-2 mb-4">
            <textarea
              value={newContent}
              onChange={e => setNewContent(e.target.value)}
              placeholder={`面談メモ・日々の気づきを記録してください\n例：〇〇の件について上司に相談したい、△△の改善ができた など`}
              rows={4}
              className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <button
              onClick={() => handleAddMemo('self')}
              disabled={saving || !newContent.trim()}
              className="flex items-center gap-1 bg-blue-600 text-white text-xs font-medium px-3 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 self-start"
            >
              <Plus className="h-3.5 w-3.5" />追加
            </button>
          </div>
          <div className="space-y-2">
            {selfMemos.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">メモがありません</p>
            ) : (
              selfMemos.map(memo => (
                <div key={memo.id} className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-xs text-blue-500 mb-1">{new Date(memo.memo_date).toLocaleDateString('ja-JP')}</p>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">{memo.content}</p>
                    </div>
                    <button onClick={() => handleDelete(memo.id)} className="text-gray-300 hover:text-red-400 flex-shrink-0">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'manager' && canViewAll && (
        <div>
          <div className="text-xs mb-3 px-3 py-2 rounded-lg flex items-center gap-1.5 bg-purple-50 text-purple-700">
            <Eye className="h-3 w-3 flex-shrink-0" />
            このメモは評価者・管理者のみ閲覧できます。対象者には見えません。
          </div>
          <div className="flex gap-2 mb-4">
            <textarea
              value={newManagerContent}
              onChange={e => setNewManagerContent(e.target.value)}
              placeholder={`対象者への気づき・評価メモを記録してください\n例：〇〇の対応が素晴らしかった、△△の点を面談で伝えたい など`}
              rows={4}
              className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            />
            <button
              onClick={() => handleAddMemo('manager')}
              disabled={saving || !newManagerContent.trim()}
              className="flex items-center gap-1 bg-purple-600 text-white text-xs font-medium px-3 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 self-start"
            >
              <Plus className="h-3.5 w-3.5" />追加
            </button>
          </div>
          <div className="space-y-2">
            {managerMemos.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">メモがありません</p>
            ) : (
              managerMemos.map(memo => (
                <div key={memo.id} className="bg-purple-50 border border-purple-100 rounded-xl p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-xs text-purple-500 mb-1">{new Date(memo.memo_date).toLocaleDateString('ja-JP')}</p>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">{memo.content}</p>
                    </div>
                    <button onClick={() => handleDelete(memo.id)} className="text-gray-300 hover:text-red-400 flex-shrink-0">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

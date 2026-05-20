'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Settings, Check, X } from 'lucide-react'

interface KpiTarget {
  id: string
  account_name: string
  target_rate: number
  description: string
  updated_at: string
}

export default function KpiTargetSettings() {
  const supabase = createClient()
  const [targets, setTargets] = useState<KpiTarget[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [myRole, setMyRole] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', user.id).single()
        setMyRole(roleData?.role ?? null)
      }
      const { data } = await supabase.from('kpi_targets').select('*').order('target_rate', { ascending: false })
      setTargets(data || [])
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }, [supabase])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleSave(id: string) {
    setSaving(true)
    setMessage(null)
    try {
      const { error } = await supabase.from('kpi_targets').update({ target_rate: Number(inputValue) }).eq('id', id)
      if (error) throw error
      setMessage('保存しました')
      setEditing(null)
      fetchData()
    } catch {
      setMessage('保存に失敗しました')
    } finally { setSaving(false) }
  }

  if (loading) return <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" /></div>

  const isAdmin = myRole === 'admin'

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <Settings className="h-5 w-5 text-gray-600" />
        <h3 className="text-sm font-bold text-gray-900">原価率 目標値設定</h3>
        {!isAdmin && <span className="text-xs text-gray-400 ml-2">※変更は管理者のみ</span>}
      </div>

      {message && (
        <div className={`text-sm p-2 rounded-lg mb-3 ${message.includes('失敗') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {message}
        </div>
      )}

      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">項目</th>
            <th className="text-left text-xs font-medium text-gray-500 px-3 py-2">説明</th>
            <th className="text-right text-xs font-medium text-gray-500 px-3 py-2">目標率</th>
            <th className="text-right text-xs font-medium text-gray-500 px-3 py-2">最終更新</th>
            {isAdmin && <th className="text-center text-xs font-medium text-gray-500 px-3 py-2">操作</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {targets.map(target => (
            <tr key={target.id} className="hover:bg-gray-50">
              <td className="text-sm font-medium text-gray-900 px-3 py-3">{target.account_name}</td>
              <td className="text-xs text-gray-500 px-3 py-3">{target.description}</td>
              <td className="text-right px-3 py-3">
                {editing === target.id ? (
                  <input
                    type="number"
                    step="0.1"
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    className="w-20 text-sm text-right border border-blue-300 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    autoFocus
                  />
                ) : (
                  <span className="text-sm font-bold text-blue-700">{target.target_rate}%</span>
                )}
              </td>
              <td className="text-xs text-gray-400 text-right px-3 py-3">
                {new Date(target.updated_at).toLocaleDateString('ja-JP')}
              </td>
              {isAdmin && (
                <td className="text-center px-3 py-3">
                  {editing === target.id ? (
                    <div className="flex gap-1 justify-center">
                      <button onClick={() => handleSave(target.id)} disabled={saving} className="flex items-center gap-0.5 text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 disabled:opacity-50">
                        <Check className="h-3 w-3" />保存
                      </button>
                      <button onClick={() => setEditing(null)} className="flex items-center gap-0.5 text-xs text-gray-400 px-2 py-1 rounded hover:bg-gray-100">
                        <X className="h-3 w-3" />取消
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => { setEditing(target.id); setInputValue(target.target_rate.toString()) }} className="text-xs text-blue-600 hover:underline">
                      変更
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

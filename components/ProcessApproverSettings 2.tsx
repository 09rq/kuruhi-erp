'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Settings, Check, Edit3 } from 'lucide-react'

interface KpiMember {
  id: string
  name: string
  department: string
  position: string
}

interface ApproverSetting {
  id: string
  step_number: number
  step_name: string
  approver_member_id: string | null
  kpi_members?: { name: string; department: string }
}

const DEPT_LABELS: Record<string, string> = {
  sales: '営業部', planning: '企画開発部', production: '生産管理部',
  cutting: '生産管理部／裁断', quality: '品質管理部', management: '管理本部',
}

export default function ProcessApproverSettings() {
  const supabase = createClient()
  const [settings, setSettings] = useState<ApproverSetting[]>([])
  const [members, setMembers] = useState<KpiMember[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<string>('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: settingsData } = await supabase
        .from('process_approver_settings')
        .select('*, kpi_members(name, department)')
        .order('step_number')
      const { data: membersData } = await supabase
        .from('kpi_members')
        .select('*')
        .order('department')
      setSettings(settingsData || [])
      setMembers(membersData || [])
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }, [supabase])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleSave(stepNumber: number) {
    setSaving(true)
    setMessage(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase
        .from('process_approver_settings')
        .update({
          approver_member_id: editValue || null,
          updated_by: user?.id,
        })
        .eq('step_number', stepNumber)
      setMessage('保存しました')
      setEditing(null)
      fetchData()
      setTimeout(() => setMessage(null), 3000)
    } catch (e) {
      console.error(e)
      setMessage('保存に失敗しました')
    } finally { setSaving(false) }
  }

  if (loading) return <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" /></div>

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-6">
        <Settings className="h-5 w-5 text-blue-600" />
        <h3 className="text-sm font-bold text-gray-900">工程別 承認者設定</h3>
      </div>

      {message && (
        <div className={`text-sm p-3 rounded-lg mb-4 ${message.includes('失敗') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {message}
        </div>
      )}

      <div className="space-y-3">
        {settings.map(setting => (
          <div key={setting.id} className="border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {setting.step_number}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{setting.step_name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    承認者：
                    {setting.kpi_members
                      ? `${setting.kpi_members.name}（${DEPT_LABELS[setting.kpi_members.department] || setting.kpi_members.department}）`
                      : '設定なし（承認不要）'}
                  </p>
                </div>
              </div>
              {editing !== setting.step_number ? (
                <button
                  onClick={() => {
                    setEditing(setting.step_number)
                    setEditValue(setting.approver_member_id || '')
                  }}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                >
                  <Edit3 className="h-3 w-3" />変更
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <select
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">なし（承認不要）</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name}（{DEPT_LABELS[m.department] || m.department}）
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleSave(setting.step_number)}
                    disabled={saving}
                    className="flex items-center gap-1 bg-blue-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Check className="h-3 w-3" />{saving ? '保存中...' : '保存'}
                  </button>
                  <button
                    onClick={() => setEditing(null)}
                    className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400 mt-4">
        ※ 承認者を変更すると、以降に作成される製造指示から新しい承認者が適用されます。
      </p>
    </div>
  )
}

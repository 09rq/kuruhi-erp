'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Shield, UserCog, AlertCircle, Check, X, UserPlus } from 'lucide-react'

type UserRole = 'admin' | 'sales' | 'manufacturing' | 'accounting'

const ROLE_LABELS: Record<UserRole, string> = {
  admin: '管理者',
  sales: '営業',
  manufacturing: '製造',
  accounting: '経理',
}

const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'bg-red-100 text-red-800',
  sales: 'bg-blue-100 text-blue-800',
  manufacturing: 'bg-green-100 text-green-800',
  accounting: 'bg-yellow-100 text-yellow-800',
}

interface UserWithRole {
  id: string
  email: string
  role: UserRole | null
  updated_at: string | null
}

export default function UsersPage() {
  const supabase = createClient()
  const [users, setUsers] = useState<UserWithRole[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [myRole, setMyRole] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<UserRole>('sales')
  const [inviting, setInviting] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: myRoleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single()

      setMyRole(myRoleData?.role ?? null)

      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role, updated_at')

      const res = await fetch('/api/admin/users')
      if (!res.ok) throw new Error('取得失敗')
      const { users: authUsers } = await res.json()

      const merged: UserWithRole[] = (authUsers || []).map((u: { id: string; email: string }) => {
        const r = roles?.find(x => x.user_id === u.id)
        return { id: u.id, email: u.email, role: r?.role ?? null, updated_at: r?.updated_at ?? null }
      })

      setUsers(merged)
    } catch {
      setMessage({ type: 'error', text: 'データの取得に失敗しました' })
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleRoleChange(userId: string, newRole: UserRole) {
    setSaving(userId)
    setMessage(null)
    try {
      const { error } = await supabase
        .from('user_roles')
        .upsert({ user_id: userId, role: newRole }, { onConflict: 'user_id' })
      if (error) throw error
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
      setMessage({ type: 'success', text: 'ロールを変更しました' })
    } catch {
      setMessage({ type: 'error', text: 'ロールの変更に失敗しました' })
    } finally {
      setSaving(null)
    }
  }

  async function handleInvite() {
    if (!inviteEmail) return
    setInviting(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMessage({ type: 'success', text: `${inviteEmail} に招待メールを送信しました` })
      setInviteEmail('')
      setShowInvite(false)
      fetchData()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '招待に失敗しました'
      setMessage({ type: 'error', text: message })
    } finally {
      setInviting(false)
    }
  }

  if (myRole !== 'admin' && !loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-gray-500">
        <AlertCircle className="h-12 w-12 text-red-400" />
        <p className="text-lg font-medium">この画面は管理者のみ閲覧できます</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-red-100 rounded-lg">
          <UserCog className="h-6 w-6 text-red-700" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">ユーザー管理</h2>
          <p className="text-sm text-gray-500">従業員のアクセス権限を設定します</p>
        </div>
        <span className="ml-auto flex items-center gap-1 bg-red-100 text-red-800 text-xs font-medium px-2.5 py-1 rounded-full">
          <Shield className="h-3 w-3" />管理者専用
        </span>
        <button
          onClick={() => setShowInvite(!showInvite)}
          className="flex items-center gap-2 bg-[#1F3864] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#2a4a7f] transition-colors"
        >
          <UserPlus className="h-4 w-4" />
          従業員を招待
        </button>
      </div>

      {showInvite && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <h3 className="text-sm font-bold text-blue-900 mb-3">招待メールを送る</h3>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-xs text-blue-700 font-medium mb-1 block">メールアドレス</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="example@curuhi.co.jp"
                className="w-full text-sm border border-blue-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-blue-700 font-medium mb-1 block">役割</label>
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value as UserRole)}
                className="text-sm border border-blue-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {(Object.entries(ROLE_LABELS) as [UserRole, string][]).map(([role, label]) => (
                  <option key={role} value={role}>{label}</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleInvite}
              disabled={inviting || !inviteEmail}
              className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {inviting ? '送信中...' : '招待メールを送る'}
            </button>
            <button
              onClick={() => setShowInvite(false)}
              className="text-sm text-gray-500 px-3 py-2 rounded-lg hover:bg-gray-100"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {message && (
        <div className={`flex items-center gap-2 p-3 rounded-lg mb-4 text-sm ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {message.type === 'success' ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {(Object.entries(ROLE_LABELS) as [UserRole, string][]).map(([role, label]) => (
          <div key={role} className="bg-white border border-gray-200 rounded-lg p-3">
            <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mb-2 ${ROLE_COLORS[role]}`}>{label}</span>
            <p className="text-xs text-gray-500">
              {role === 'admin' && '全機能・削除・価格変更・ユーザー管理'}
              {role === 'sales' && '受注・見積の登録・編集'}
              {role === 'manufacturing' && '製造ロット・在庫操作・発注'}
              {role === 'accounting' && '請求・会計の閲覧・編集'}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">メールアドレス</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">現在のロール</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">ロール変更</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">最終更新</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.length === 0 ? (
                <tr><td colSpan={4} className="text-center text-gray-400 py-8 text-sm">ユーザーが見つかりません</td></tr>
              ) : (
                users.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{user.email}</td>
                    <td className="px-4 py-3">
                      {user.role ? (
                        <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full ${ROLE_COLORS[user.role]}`}>{ROLE_LABELS[user.role]}</span>
                      ) : (
                        <span className="text-xs text-gray-400">未設定</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={user.role ?? ''}
                        onChange={e => handleRoleChange(user.id, e.target.value as UserRole)}
                        disabled={saving === user.id}
                        className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                      >
                        <option value="" disabled>選択してください</option>
                        {(Object.entries(ROLE_LABELS) as [UserRole, string][]).map(([role, label]) => (
                          <option key={role} value={role}>{label}</option>
                        ))}
                      </select>
                      {saving === user.id && <span className="ml-2 text-xs text-gray-400">保存中...</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {user.updated_at ? new Date(user.updated_at).toLocaleDateString('ja-JP') : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

'use client'

// ============================================================
// ユーザー管理画面（管理者専用）
// ~/Desktop/kuruhi-erp/src/app/settings/users/page.tsx
// ============================================================

import { useEffect, useState, useCallback } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRole } from '@/hooks/useRole'
import { ROLE_LABELS, ROLE_COLORS, type UserRole } from '@/lib/roles'
import { Shield, UserCog, AlertCircle, Check, X } from 'lucide-react'

interface UserProfile {
  id: string
  email: string
  registered_at: string
  role: UserRole | null
  role_updated_at: string | null
}

export default function UsersPage() {
  const { isAdmin, loading: roleLoading } = useRole()
  const supabase = createClientComponentClient()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // ユーザー一覧を取得
  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      // auth.users は直接取得できないため、user_roles と合わせてAPIから取得
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id, role, updated_at')

      if (error) throw error

      // Supabase Admin APIからメールアドレスを取得（管理者権限が必要）
      const res = await fetch('/api/admin/users')
      if (!res.ok) throw new Error('ユーザー情報の取得に失敗しました')
      const { users: authUsers } = await res.json()

      // マージ
      const merged: UserProfile[] = (authUsers || []).map((u: { id: string; email: string; created_at: string }) => {
        const roleData = data?.find(r => r.user_id === u.id)
        return {
          id: u.id,
          email: u.email,
          registered_at: u.created_at,
          role: roleData?.role ?? null,
          role_updated_at: roleData?.updated_at ?? null,
        }
      })

      setUsers(merged)
    } catch (err) {
      console.error(err)
      setMessage({ type: 'error', text: 'ユーザー情報の取得に失敗しました' })
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    if (!roleLoading && isAdmin) {
      fetchUsers()
    }
  }, [roleLoading, isAdmin, fetchUsers])

  // ロールを変更する
  async function handleRoleChange(userId: string, newRole: UserRole) {
    setSaving(userId)
    setMessage(null)
    try {
      const { error } = await supabase
        .from('user_roles')
        .upsert({ user_id: userId, role: newRole }, { onConflict: 'user_id' })

      if (error) throw error

      setUsers(prev =>
        prev.map(u => u.id === userId ? { ...u, role: newRole } : u)
      )
      setMessage({ type: 'success', text: 'ロールを変更しました' })
    } catch (err) {
      console.error(err)
      setMessage({ type: 'error', text: 'ロールの変更に失敗しました' })
    } finally {
      setSaving(null)
    }
  }

  // 権限チェック
  if (roleLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-gray-500">
        <AlertCircle className="h-12 w-12 text-red-400" />
        <p className="text-lg font-medium">この画面は管理者のみ閲覧できます</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* ヘッダー */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-red-100 rounded-lg">
          <UserCog className="h-6 w-6 text-red-700" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">ユーザー管理</h1>
          <p className="text-sm text-gray-500">従業員のアクセス権限（ロール）を設定します</p>
        </div>
        <span className="ml-auto flex items-center gap-1 bg-red-100 text-red-800 text-xs font-medium px-2.5 py-1 rounded-full">
          <Shield className="h-3 w-3" />
          管理者専用
        </span>
      </div>

      {/* メッセージ */}
      {message && (
        <div className={`flex items-center gap-2 p-3 rounded-lg mb-4 text-sm
          ${message.type === 'success'
            ? 'bg-green-50 text-green-800 border border-green-200'
            : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
          {message.type === 'success'
            ? <Check className="h-4 w-4 flex-shrink-0" />
            : <X className="h-4 w-4 flex-shrink-0" />
          }
          {message.text}
        </div>
      )}

      {/* ロール説明 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {(Object.entries(ROLE_LABELS) as [UserRole, string][]).map(([role, label]) => (
          <div key={role} className="bg-white border border-gray-200 rounded-lg p-3">
            <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mb-2 ${ROLE_COLORS[role]}`}>
              {label}
            </span>
            <p className="text-xs text-gray-500">
              {role === 'admin' && '全機能・マスタ削除・価格変更・ユーザー管理'}
              {role === 'sales' && '受注・見積の登録・編集'}
              {role === 'manufacturing' && '製造ロット・在庫操作・発注'}
              {role === 'accounting' && '請求・会計の閲覧・編集'}
            </p>
          </div>
        ))}
      </div>

      {/* ユーザーテーブル */}
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
                <tr>
                  <td colSpan={4} className="text-center text-gray-400 py-8 text-sm">
                    ユーザーが見つかりません
                  </td>
                </tr>
              ) : (
                users.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{user.email}</td>
                    <td className="px-4 py-3">
                      {user.role ? (
                        <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full ${ROLE_COLORS[user.role]}`}>
                          {ROLE_LABELS[user.role]}
                        </span>
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
                      {saving === user.id && (
                        <span className="ml-2 text-xs text-gray-400">保存中...</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {user.role_updated_at
                        ? new Date(user.role_updated_at).toLocaleDateString('ja-JP')
                        : '-'
                      }
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

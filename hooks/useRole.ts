// ============================================================
// ログイン中ユーザーのロールを取得するフック
// ~/Desktop/kuruhi-erp/src/hooks/useRole.ts
// ============================================================

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { type UserRole, type Permission, hasPermission, hasAnyPermission } from '@/lib/roles'

interface UseRoleReturn {
  role: UserRole | null       // 現在のロール
  loading: boolean            // 読み込み中かどうか
  isAdmin: boolean            // 管理者かどうか
  can: (permission: Permission) => boolean              // 権限チェック
  canAny: (permissions: Permission[]) => boolean        // いずれかの権限チェック
}

export function useRole(): UseRoleReturn {
  const supabase = createClientComponentClient()
  const [role, setRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchRole() {
      try {
        // ログイン中ユーザーを取得
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setRole(null)
          return
        }

        // user_roles テーブルからロールを取得
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single()

        if (error || !data) {
          // ロールが未設定の場合は営業（最低権限）として扱う
          setRole('sales')
        } else {
          setRole(data.role as UserRole)
        }
      } catch {
        setRole('sales')
      } finally {
        setLoading(false)
      }
    }

    fetchRole()

    // ログイン状態が変わったら再取得
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchRole()
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  return {
    role,
    loading,
    isAdmin: role === 'admin',
    can: (permission: Permission) => hasPermission(role, permission),
    canAny: (permissions: Permission[]) => hasAnyPermission(role, permissions),
  }
}

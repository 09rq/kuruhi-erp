import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { type UserRole, type Permission, hasPermission, hasAnyPermission } from '@/lib/roles'

interface UseRoleReturn {
  role: UserRole | null
  loading: boolean
  isAdmin: boolean
  can: (permission: Permission) => boolean
  canAny: (permissions: Permission[]) => boolean
}

export function useRole(): UseRoleReturn {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const [role, setRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchRole() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setRole(null)
          return
        }
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single()
        if (error || !data) {
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

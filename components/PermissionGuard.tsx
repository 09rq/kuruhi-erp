'use client'

// ============================================================
// 権限ガードコンポーネント
// 「この操作は〇〇権限が必要」という制御を簡単に書けるようにする部品
// ~/Desktop/kuruhi-erp/src/components/PermissionGuard.tsx
// ============================================================

import { type ReactNode } from 'react'
import { useRole } from '@/hooks/useRole'
import { type Permission } from '@/lib/roles'
import { Lock } from 'lucide-react'

interface PermissionGuardProps {
  // 必要な権限
  permission?: Permission
  // 複数権限のうちいずれかがあればOK
  anyOf?: Permission[]
  // 権限がない場合に表示するもの（省略すると何も表示しない）
  fallback?: ReactNode
  // 権限がない場合に「権限がありません」メッセージを表示するか
  showLocked?: boolean
  children: ReactNode
}

export function PermissionGuard({
  permission,
  anyOf,
  fallback,
  showLocked = false,
  children,
}: PermissionGuardProps) {
  const { can, canAny, loading } = useRole()

  // 読み込み中は何も表示しない
  if (loading) return null

  // 権限チェック
  const allowed = permission
    ? can(permission)
    : anyOf
    ? canAny(anyOf)
    : true

  if (allowed) return <>{children}</>

  // 権限がない場合
  if (showLocked) {
    return (
      <div className="flex items-center gap-1.5 text-sm text-gray-400 cursor-not-allowed">
        <Lock className="h-3.5 w-3.5" />
        <span>権限がありません</span>
      </div>
    )
  }

  return fallback ? <>{fallback}</> : null
}

// ============================================================
// 使い方の例（他のファイルで使う際のメモ）
// ============================================================
//
// ① ボタンを管理者のみ表示したい場合：
// <PermissionGuard permission="master.delete">
//   <button onClick={handleDelete}>削除</button>
// </PermissionGuard>
//
// ② 権限がない人には「権限がありません」と表示したい場合：
// <PermissionGuard permission="price.edit" showLocked>
//   <input value={price} onChange={...} />
// </PermissionGuard>
//
// ③ 複数の権限のうちどれかがあればOKの場合：
// <PermissionGuard anyOf={['order.create', 'order.edit']}>
//   <OrderForm />
// </PermissionGuard>
//
// ④ 権限がない場合に別のものを表示したい場合：
// <PermissionGuard
//   permission="accounting.view"
//   fallback={<p>経理担当者のみ閲覧できます</p>}
// >
//   <AccountingData />
// </PermissionGuard>

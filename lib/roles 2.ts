// ============================================================
// ロール（役割）の定義ファイル
// ~/Desktop/kuruhi-erp/src/lib/roles.ts
// ============================================================

// ロールの種類
export type UserRole = 'admin' | 'sales' | 'manufacturing' | 'accounting'

// ロールの日本語表示名
export const ROLE_LABELS: Record<UserRole, string> = {
  admin: '管理者',
  sales: '営業',
  manufacturing: '製造',
  accounting: '経理',
}

// ロールのバッジカラー（Tailwind CSS）
export const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'bg-red-100 text-red-800',
  sales: 'bg-blue-100 text-blue-800',
  manufacturing: 'bg-green-100 text-green-800',
  accounting: 'bg-yellow-100 text-yellow-800',
}

// ============================================================
// 各ロールが持つ権限の定義
// ============================================================
export type Permission =
  | 'master.view'          // マスタ閲覧
  | 'master.create'        // マスタ登録
  | 'master.edit'          // マスタ編集
  | 'master.delete'        // マスタ削除（管理者のみ）
  | 'price.view'           // 価格閲覧
  | 'price.edit'           // 価格変更（管理者のみ）
  | 'order.view'           // 受注閲覧
  | 'order.create'         // 受注登録
  | 'order.edit'           // 受注編集
  | 'order.delete'         // 受注削除
  | 'estimate.view'        // 見積閲覧
  | 'estimate.create'      // 見積作成
  | 'estimate.edit'        // 見積編集
  | 'manufacture.view'     // 製造閲覧
  | 'manufacture.create'   // 製造登録
  | 'manufacture.edit'     // 製造編集
  | 'inventory.view'       // 在庫閲覧
  | 'inventory.edit'       // 在庫操作
  | 'purchase.view'        // 購買閲覧
  | 'purchase.create'      // 発注作成
  | 'purchase.edit'        // 発注編集
  | 'accounting.view'      // 会計閲覧
  | 'accounting.edit'      // 会計編集
  | 'user.manage'          // ユーザー管理（管理者のみ）

// 各ロールが持つ権限リスト
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    // 管理者はすべての権限を持つ
    'master.view', 'master.create', 'master.edit', 'master.delete',
    'price.view', 'price.edit',
    'order.view', 'order.create', 'order.edit', 'order.delete',
    'estimate.view', 'estimate.create', 'estimate.edit',
    'manufacture.view', 'manufacture.create', 'manufacture.edit',
    'inventory.view', 'inventory.edit',
    'purchase.view', 'purchase.create', 'purchase.edit',
    'accounting.view', 'accounting.edit',
    'user.manage',
  ],
  sales: [
    // 営業：受注・見積の登録・編集
    'master.view',
    'price.view',
    'order.view', 'order.create', 'order.edit',
    'estimate.view', 'estimate.create', 'estimate.edit',
    'manufacture.view',
    'inventory.view',
    'purchase.view',
    'accounting.view',
  ],
  manufacturing: [
    // 製造：製造ロット・在庫操作
    'master.view',
    'order.view',
    'manufacture.view', 'manufacture.create', 'manufacture.edit',
    'inventory.view', 'inventory.edit',
    'purchase.view', 'purchase.create', 'purchase.edit',
  ],
  accounting: [
    // 経理：請求・会計閲覧
    'master.view',
    'price.view',
    'order.view',
    'estimate.view',
    'manufacture.view',
    'inventory.view',
    'purchase.view',
    'accounting.view', 'accounting.edit',
  ],
}

// 特定の権限を持っているか確認する関数
export function hasPermission(role: UserRole | null | undefined, permission: Permission): boolean {
  if (!role) return false
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

// 複数の権限のうち一つでも持っているか確認する関数
export function hasAnyPermission(role: UserRole | null | undefined, permissions: Permission[]): boolean {
  if (!role) return false
  return permissions.some(p => hasPermission(role, p))
}

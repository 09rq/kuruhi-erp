// 部署マスタ（設定＞従業員管理と、製品原価の「社内労務」部門選択で共通利用）
// 部署を追加・変更する場合はここを更新すれば両方の画面に反映されます。
export const DEPARTMENTS = ['管理本部', '営業部', '企画開発部', '生産管理部', '品質管理部'] as const

export type Department = typeof DEPARTMENTS[number]

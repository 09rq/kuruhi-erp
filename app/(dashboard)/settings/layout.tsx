import SettingsTabs from './SettingsTabs'

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">設定</h1>
        <p className="mt-1 text-sm text-gray-500">自社情報・従業員の管理</p>
      </div>
      <SettingsTabs />
      {children}
    </div>
  )
}

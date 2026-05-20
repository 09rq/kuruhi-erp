import ProcessApproverSettings from '@/components/ProcessApproverSettings'

export default function ApproversPage() {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">工程承認者設定</h1>
        <p className="text-sm text-gray-500">製造指示の各工程における承認者を設定します</p>
      </div>
      <ProcessApproverSettings />
    </div>
  )
}

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import MaterialForm from '../MaterialForm'

export default async function MaterialNewPage() {
  const supabase = await createClient()
  const { data: suppliers } = await supabase
    .from('customers')
    .select('id, name, type')
    .in('type', ['vendor_material', 'customer'])
    .eq('is_active', true)
    .order('name', { ascending: true })

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/materials" className="hover:text-gray-700">材料登録</Link>
          <span>/</span>
          <span className="text-gray-900">新規登録</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">材料 新規登録</h1>
      </div>
      <MaterialForm suppliers={suppliers ?? []} />
    </div>
  )
}

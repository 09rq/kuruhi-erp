import { createClient } from '@/lib/supabase/server'
import LotForm from '../LotForm'

export default async function NewLotPage() {
  const supabase = await createClient()

  const [
    { data: products },
    { data: variants },
    { data: vendors },
  ] = await Promise.all([
    supabase.from('products').select('id, product_no, name').order('product_no'),
    supabase.from('product_variants').select('id, product_id, color_name, size_label'),
    supabase.from('customers').select('id, name').order('name'),
  ])

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">製造ロット作成</h1>
        <p className="mt-1 text-sm text-gray-500">ロット番号は自動採番されます</p>
      </div>
      <LotForm
        products={products ?? []}
        variants={variants ?? []}
        vendors={vendors ?? []}
      />
    </div>
  )
}

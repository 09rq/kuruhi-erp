import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import BomForm from '../BomForm'

export default async function BomNewPage() {
  const supabase = await createClient()

  const [
    { data: products },
    { data: variants },
    { data: materials },
  ] = await Promise.all([
    supabase
      .from('products')
      .select('id, product_no, name, cost_confirmed')
      .neq('status', 'discontinued')
      .order('product_no'),
    supabase
      .from('product_variants')
      .select('id, product_id, color_name, size_label')
      .eq('status', 'active')
      .order('sort_order'),
    supabase
      .from('materials')
      .select('id, name, code, unit, standard_price, category')
      .eq('is_active', true)
      .order('name'),
  ])

  return (
    <div className="pt-8 px-8 pb-0 flex flex-col flex-1">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/bom" className="hover:text-gray-700">BOM・部品表</Link>
          <span>/</span>
          <span className="text-gray-900">新規作成</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">BOM 新規作成</h1>
      </div>
      <BomForm
        products={products ?? []}
        variants={variants ?? []}
        materials={materials ?? []}
      />
    </div>
  )
}

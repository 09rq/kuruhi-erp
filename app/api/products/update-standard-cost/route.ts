import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()

  // material_idが紐付いている材料費明細を取得
  const { data: costItems, error } = await supabase
    .from('product_cost_items')
    .select('id, product_id, material_id, quantity, cost_mode')
    .eq('cost_type', 'material')
    .not('material_id', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let updatedItems = 0

  // 各明細の単価を材料の月末単価で更新
  for (const item of costItems || []) {
    const { data: material } = await supabase
      .from('materials')
      .select('month_end_price, standard_price')
      .eq('id', item.material_id!)
      .single()

    if (!material) continue

    const newPrice = material.month_end_price || material.standard_price || 0

    await supabase
      .from('product_cost_items')
      .update({ unit_price: newPrice })
      .eq('id', item.id)

    updatedItems++
  }

  // 全製品のstandard_costを再計算
  const { data: products } = await supabase
    .from('products')
    .select('id')

  let updatedProducts = 0

  for (const product of products || []) {
    const { data: items } = await supabase
      .from('product_cost_items')
      .select('amount, cost_mode')
      .eq('product_id', product.id)
      .eq('cost_mode', 'standard')

    if (!items || items.length === 0) continue

    const totalCost = items.reduce((s, i) => s + Number(i.amount), 0)

    await supabase
      .from('products')
      .update({ standard_cost: totalCost })
      .eq('id', product.id)

    updatedProducts++
  }

  return NextResponse.json({ success: true, updatedItems, updatedProducts })
}

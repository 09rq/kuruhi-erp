import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()

  // 全材料を取得
  const { data: materials, error } = await supabase
    .from('materials')
    .select('id, month_end_price')
    .eq('is_active', true)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let updatedCount = 0

  for (const material of materials || []) {
    // 直近の仕入入庫単価を取得
    const { data: lastTx } = await supabase
      .from('material_stock_transactions')
      .select('unit_price')
      .eq('material_id', material.id)
      .eq('transaction_type', 'purchase_in')
      .not('unit_price', 'is', null)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!lastTx?.unit_price) continue

    // month_end_price を更新、現在の month_end_price を month_start_price に
    await supabase
      .from('materials')
      .update({
        month_start_price: material.month_end_price,
        month_end_price: lastTx.unit_price,
        updated_at: new Date().toISOString(),
      })
      .eq('id', material.id)

    updatedCount++
  }

  return NextResponse.json({ success: true, updatedCount })
}

import { createClient } from '@/lib/supabase/server'
import PurchaseSummaryClient from './PurchaseSummaryClient'

export default async function PurchaseSummaryPage() {
  const supabase = await createClient()

  // 材料仕入トランザクション（purchase_in）を取得
  const { data: materialTx } = await supabase
    .from('material_stock_transactions')
    .select('*, materials(name, code, category)')
    .eq('transaction_type', 'purchase_in')
    .order('transaction_date', { ascending: false })

  // 外注加工工程の支払い情報を取得
  const { data: outsourceTx } = await supabase
    .from('production_lot_processes')
    .select(`
      id, process_name, vendor_id, planned_quantity, unit_price, amount,
      purchase_status, purchase_date,
      production_lots(lot_number, product_id, products(name)),
      customers(name)
    `)
    .order('purchase_date', { ascending: false })

  return (
    <PurchaseSummaryClient
      materialTx={materialTx || []}
      outsourceTx={outsourceTx || []}
    />
  )
}

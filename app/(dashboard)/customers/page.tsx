import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { CUSTOMER_TYPE_LABELS, CUSTOMER_TYPE_COLORS, CustomerType } from '@/lib/types/customer'
import CustomerDeleteButton from './CustomerDeleteButton'
import CustomerCSVButton from './CustomerCSVButton'
import CustomerImportWrapper from './CustomerImportWrapper'

interface SearchParams {
  q?: string
  type?: string
  status?: string
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { q, type, status } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('customers')
    .select('*')
    .order('code', { ascending: true })

  if (q) {
    query = query.or(
      `name.ilike.%${q}%,name_kana.ilike.%${q}%,code.ilike.%${q}%,contact_person.ilike.%${q}%`
    )
  }
  if (type && type !== 'all') {
    query = query.eq('type', type)
  }
  if (status === 'active') {
    query = query.eq('is_active', true)
  } else if (status === 'inactive') {
    query = query.eq('is_active', false)
  }

  const { data: customers, error } = await query

  return (
    <div className="p-8">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">取引先管理</h1>
          <p className="mt-1 text-sm text-gray-500">
            販売先・仕入先の登録・管理
          </p>
        </div>
        <div className="flex items-center gap-3">
          <CustomerCSVButton customers={customers ?? []} />
          <CustomerImportWrapper />
          <Link
            href="/customers/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: '#1F3864' }}
          >
            <span>＋</span>
            新規登録
          </Link>
        </div>
      </div>

      {/* 集計バッジ */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {(
          [
            ['customer', '販売先'],
            ['vendor_processing', '仕入先（外注加工）'],
            ['vendor_material', '仕入先（材料仕入）'],
          ] as [CustomerType, string][]
        ).map(([t, label]) => {
          const count = customers?.filter((c) => c.type === t).length ?? 0
          return (
            <div key={t} className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{count}<span className="text-sm font-normal text-gray-500 ml-1">件</span></p>
            </div>
          )
        })}
      </div>

      {/* 検索・フィルタ */}
      <form method="GET" className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-48">
          <label className="block text-xs font-medium text-gray-600 mb-1">キーワード検索</label>
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="取引先名・コード・担当者名"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent"
            style={{ '--tw-ring-color': '#1F3864' } as React.CSSProperties}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">区分</label>
          <select
            name="type"
            defaultValue={type ?? 'all'}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2"
          >
            <option value="all">すべて</option>
            <option value="customer">販売先</option>
            <option value="vendor_processing">仕入先（外注加工）</option>
            <option value="vendor_material">仕入先（材料仕入）</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">ステータス</label>
          <select
            name="status"
            defaultValue={status ?? 'all'}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2"
          >
            <option value="all">すべて</option>
            <option value="active">有効</option>
            <option value="inactive">無効</option>
          </select>
        </div>
        <button
          type="submit"
          className="px-4 py-2 text-white text-sm rounded-lg transition-colors"
          style={{ backgroundColor: '#1F3864' }}
        >
          検索
        </button>
        <Link
          href="/customers"
          className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition-colors"
        >
          クリア
        </Link>
      </form>

      {/* テーブル */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {error ? (
          <div className="p-8 text-center text-red-600 text-sm">
            データの取得に失敗しました: {error.message}
          </div>
        ) : !customers || customers.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">
            取引先が登録されていません
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1000px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-600 w-24">コード</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 w-36">区分</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">取引先名</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 w-28">担当者</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 w-32">電話番号</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 w-32">FAX番号</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 w-52">住所</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600 w-24">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {customers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">
                      {customer.code}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          CUSTOMER_TYPE_COLORS[customer.type as CustomerType]
                        }`}
                      >
                        {CUSTOMER_TYPE_LABELS[customer.type as CustomerType]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{customer.name}</div>
                      {customer.name_kana && (
                        <div className="text-xs text-gray-400">{customer.name_kana}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {customer.contact_person ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {customer.phone ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {customer.fax ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {customer.postal_code || customer.address
                        ? [customer.postal_code ? `〒${customer.postal_code}` : null, customer.address]
                            .filter(Boolean)
                            .join(' ')
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/customers/${customer.id}/edit`}
                          className="px-2.5 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                          編集
                        </Link>
                        <Link
                          href={`/customers/copy/${customer.id}`}
                          className="px-2.5 py-1 text-xs rounded border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          コピー
                        </Link>
                        <CustomerDeleteButton id={customer.id} name={customer.name} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-gray-400 text-right">
        {customers?.length ?? 0} 件表示
      </p>
    </div>
  )
}

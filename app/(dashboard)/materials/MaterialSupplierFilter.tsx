'use client'

import { useState } from 'react'
import SearchableSelect from '@/components/SearchableSelect'

interface SupplierOption {
  id: string
  name: string
  type: string
}

interface Props {
  suppliers: SupplierOption[]
  initialValue: string
}

const cls =
  'w-56 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]'

export default function MaterialSupplierFilter({ suppliers, initialValue }: Props) {
  const [value, setValue] = useState(initialValue)

  return (
    <SearchableSelect
      name="supplier_id"
      value={value}
      onChange={(id) => setValue(id)}
      options={suppliers.map((s) => ({
        id: s.id,
        label:
          s.type === 'customer' ? `【販売先】${s.name}`
          : s.type === 'vendor_processing' ? `【外注先】${s.name}`
          : `【仕入先】${s.name}`,
      }))}
      placeholder="取引先名で検索"
      className={cls}
    />
  )
}

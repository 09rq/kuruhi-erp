'use client'

import { useState } from 'react'

// ---- 型 ----
type PaymentMonth = '当月' | '翌月' | '翌々月'

interface Terms {
  type: 'scheduled' | 'spot'   // 締日払い or 都度払い
  closingDay: number            // 1〜31 (31 = 末日)
  paymentMonth: PaymentMonth
  paymentDay: number            // 1〜31 (31 = 末日)
}

// ---- 日付ラベル ----
function dayLabel(day: number) {
  return day === 31 ? '末日' : `${day}日`
}

// ---- Terms → 保存文字列 ----
function termsToString(t: Terms): string {
  if (t.type === 'spot') return '都度払い'
  return `${dayLabel(t.closingDay)}締め ${t.paymentMonth}${dayLabel(t.paymentDay)}払い`
}

// ---- 保存文字列 → Terms（既存データ復元用） ----
function parseTerms(value: string | null | undefined): Terms {
  const defaults: Terms = {
    type: 'scheduled',
    closingDay: 31,
    paymentMonth: '翌月',
    paymentDay: 31,
  }
  if (!value) return defaults
  if (value === '都度払い') return { ...defaults, type: 'spot' }

  // "20日締め 翌月末日払い" or "末日締め 翌々月25日払い" etc.
  const m = value.match(
    /^(末日|\d+日)締め\s*(当月|翌月|翌々月)(末日|\d+日)払い$/
  )
  if (!m) return defaults

  const closingDay = m[1] === '末日' ? 31 : parseInt(m[1])
  const paymentMonth = m[2] as PaymentMonth
  const paymentDay = m[3] === '末日' ? 31 : parseInt(m[3])
  return { type: 'scheduled', closingDay, paymentMonth, paymentDay }
}

// ---- 日セレクタ ----
function DaySelect({
  value,
  onChange,
  id,
}: {
  value: number
  onChange: (v: number) => void
  id: string
}) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="appearance-none w-full pl-3 pr-8 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3864] cursor-pointer"
      >
        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
          <option key={d} value={d}>
            {dayLabel(d)}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">▼</span>
    </div>
  )
}

// ---- メインコンポーネント ----
export default function PaymentTermsPicker({
  name,
  defaultValue,
}: {
  name: string
  defaultValue?: string | null
}) {
  const [terms, setTerms] = useState<Terms>(() => parseTerms(defaultValue))

  const update = (patch: Partial<Terms>) =>
    setTerms((prev) => ({ ...prev, ...patch }))

  const stored = termsToString(terms)

  return (
    <div className="space-y-4">
      {/* 都度払いトグル */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => update({ type: 'scheduled' })}
          className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
            terms.type === 'scheduled'
              ? 'border-[#1F3864] bg-[#1F3864] text-white'
              : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
          }`}
        >
          締日・支払日を設定
        </button>
        <button
          type="button"
          onClick={() => update({ type: 'spot' })}
          className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
            terms.type === 'spot'
              ? 'border-[#1F3864] bg-[#1F3864] text-white'
              : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
          }`}
        >
          都度払い
        </button>
      </div>

      {/* 締日・支払日ピッカー */}
      {terms.type === 'scheduled' && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-4">
          {/* 締日 */}
          <div className="flex items-center gap-3">
            <span className="w-8 text-xs font-medium text-gray-500 shrink-0">締日</span>
            <div className="w-36">
              <DaySelect
                id="closing-day"
                value={terms.closingDay}
                onChange={(v) => update({ closingDay: v })}
              />
            </div>
            <span className="text-sm text-gray-500">締め</span>
          </div>

          {/* 矢印 */}
          <div className="flex items-center gap-3">
            <span className="w-8" />
            <div className="flex items-center gap-1 text-gray-400 text-xs">
              <span className="w-4 h-px bg-gray-300 inline-block" />
              <span>▼</span>
            </div>
          </div>

          {/* 支払月 */}
          <div className="flex items-center gap-3">
            <span className="w-8 text-xs font-medium text-gray-500 shrink-0">支払</span>
            <div className="relative">
              <select
                value={terms.paymentMonth}
                onChange={(e) => update({ paymentMonth: e.target.value as PaymentMonth })}
                className="appearance-none pl-3 pr-8 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3864] cursor-pointer"
              >
                <option value="当月">当月</option>
                <option value="翌月">翌月</option>
                <option value="翌々月">翌々月</option>
              </select>
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">▼</span>
            </div>
            <div className="w-36">
              <DaySelect
                id="payment-day"
                value={terms.paymentDay}
                onChange={(v) => update({ paymentDay: v })}
              />
            </div>
            <span className="text-sm text-gray-500">払い</span>
          </div>

          {/* プレビュー */}
          <div className="pt-1 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              設定内容：
              <span className="ml-1 font-medium text-gray-800">{stored}</span>
            </p>
          </div>
        </div>
      )}

      {/* 都度払い表示 */}
      {terms.type === 'spot' && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
          <p className="text-sm text-gray-600">
            支払条件：<span className="font-medium text-gray-800">都度払い</span>
          </p>
        </div>
      )}

      {/* hidden input — フォームに値を渡す */}
      <input type="hidden" name={name} value={stored} />
    </div>
  )
}

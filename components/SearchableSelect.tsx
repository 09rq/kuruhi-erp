'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

export interface SearchableOption {
  id: string
  label: string
  sublabel?: string
}

interface Props {
  /** 通常の <select name="..."> の代わりに FormData で送信したい場合に指定する */
  name?: string
  value: string
  onChange: (id: string, option: SearchableOption | null) => void
  options: SearchableOption[]
  placeholder?: string
  emptyText?: string
  required?: boolean
  disabled?: boolean
  className?: string
  maxResults?: number
}

const defaultInputCls =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864] disabled:bg-gray-50 disabled:text-gray-400'

function normalize(s: string) {
  return s.toLowerCase().trim()
}

/**
 * 入力するたびに候補を絞り込める検索付きプルダウン。
 * name を渡すと hidden input を併設し、通常の <select name> と同じように
 * FormData(e.currentTarget) で値を取得できる（既存のuncontrolledフォームとの互換用）。
 */
export default function SearchableSelect({
  name,
  value,
  onChange,
  options,
  placeholder = '入力して検索',
  emptyText = '該当する項目がありません',
  required,
  disabled,
  className,
  maxResults = 50,
}: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const selected = useMemo(() => options.find((o) => o.id === value) ?? null, [options, value])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filtered = useMemo(() => {
    const q = normalize(query)
    const base = !q
      ? options
      : options.filter(
          (o) => normalize(o.label).includes(q) || normalize(o.sublabel ?? '').includes(q)
        )
    return base.slice(0, maxResults)
  }, [options, query, maxResults])

  const handleSelect = (opt: SearchableOption) => {
    onChange(opt.id, opt)
    setQuery('')
    setOpen(false)
  }

  const handleClear = () => {
    onChange('', null)
    setQuery('')
    setOpen(false)
  }

  const displayValue = open ? query : selected?.label ?? ''

  return (
    <div className="relative" ref={wrapRef}>
      {name && <input type="hidden" name={name} value={value} required={required} />}
      <input
        type="text"
        value={displayValue}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => {
          setOpen(true)
          setQuery('')
        }}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        className={className ?? defaultInputCls}
      />
      {open && !disabled && (
        <div className="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
          {value && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleClear}
              className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:bg-gray-50 border-b border-gray-100"
            >
              選択を解除
            </button>
          )}
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-400">{emptyText}</p>
          ) : (
            filtered.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(opt)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b border-gray-100 last:border-0 ${
                  opt.id === value ? 'bg-blue-50 font-medium' : ''
                }`}
              >
                <div className="text-sm text-gray-800">{opt.label}</div>
                {opt.sublabel && <div className="text-xs text-gray-400 mt-0.5">{opt.sublabel}</div>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// 取引先ごとの「締日」に基づいて、ある日付がどの月の売上として集計されるかを判定するユーティリティ。
// 例：締日が15日の取引先の場合、9/16〜10/15の取引はすべて「10月」の売上として扱う。
// （customers.payment_terms は "20日締め 翌月末日払い" のような文字列で保存されている）

/**
 * payment_terms の文字列から締日（1〜31、31=末日）を取り出す。
 * 解析できない場合や未設定の場合は 31（末日締め）として扱う。
 */
export function parseClosingDay(paymentTerms: string | null | undefined): number {
  if (!paymentTerms || paymentTerms === '都度払い') return 31
  const m = paymentTerms.match(/^(末日|\d+日)締め/)
  if (!m) return 31
  return m[1] === '末日' ? 31 : parseInt(m[1], 10)
}

/**
 * 指定した日付（YYYY-MM-DD）が、締日ベースでどの月（YYYY-MM）に属するかを返す。
 */
export function closingPeriodLabel(dateStr: string, closingDay: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  const year = d.getFullYear()
  const month = d.getMonth() // 0-indexed
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate()
  const closingDateDay = closingDay >= 31 ? lastDayOfMonth : Math.min(closingDay, lastDayOfMonth)

  if (d.getDate() <= closingDateDay) {
    return `${year}-${String(month + 1).padStart(2, '0')}`
  }
  const next = new Date(year, month + 1, 1)
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
}

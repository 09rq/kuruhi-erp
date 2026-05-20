import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

    const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', user.id).single()
    if (!roleData || !['admin', 'accounting'].includes(roleData.role)) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    const { yearMonth, plData, mfgData, analysisType } = await request.json()

    const isMfgOnly = analysisType === '製造原価に特化した分析'

    const mfgPrompt = `あなたは製造現場のコストマネジメント専門家です。以下は株式会社クルヒ（革小物・鞄のOEM製造）の${yearMonth}の製造原価データです。現場の製造・生産管理担当者向けに、コスト改善に特化した総評を日本語で作成してください。

【重要】売上高・粗利・営業利益などの経営数値には一切触れないでください。製造原価の改善にのみ焦点を当ててください。

【製造原価 主要項目】
${mfgData.map((d: {account_name: string; balance: number; ratio: number}) => `${d.account_name}: ${Number(d.balance).toLocaleString()}円 (構成比${d.ratio}%)`).join('\n')}

【KPI目標との比較】
- 材料費目標率: 18.5%
- 外注加工費目標率: 43.5%
- 労務費目標率: 7.0%
- 荷造運賃目標率: 1.0%

以下の形式で回答してください：
1. 製造原価総評（3文以内・現場向けの言葉で）
2. 良好な点（箇条書き2点）
3. 改善が必要な点（箇条書き2点・具体的なアクションを含む）
4. 来月の重点取り組み（2文以内）`

    const fullPrompt = `あなたはベテランの公認会計士です。以下は株式会社クルヒ（革小物・鞄のOEM製造）の${yearMonth}の財務データです。経営者・経理担当者向けに全社経営分析の総評を日本語で作成してください。

【損益計算書 主要項目】
${plData.map((d: {account_name: string; balance: number; ratio: number}) => `${d.account_name}: ${Number(d.balance).toLocaleString()}円 (${d.ratio}%)`).join('\n')}

【製造原価 主要項目】
${mfgData.map((d: {account_name: string; balance: number; ratio: number}) => `${d.account_name}: ${Number(d.balance).toLocaleString()}円 (${d.ratio}%)`).join('\n')}

【KPI目標との比較】
- 材料費目標率: 18.5%
- 外注加工費目標率: 43.5%
- 労務費目標率: 7.0%
- 荷造運賃目標率: 1.0%

以下の形式で回答してください：
1. 経営総評（3〜4文）
2. 良好な点（箇条書き2〜3点）
3. 改善が必要な点（箇条書き2〜3点）
4. 来月に向けての経営提言（2〜3文）`

    const prompt = isMfgOnly ? mfgPrompt : fullPrompt

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await response.json()
    const summary = data.content?.[0]?.text || '総評の生成に失敗しました'

    return NextResponse.json({ summary })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}

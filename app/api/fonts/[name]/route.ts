import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params

  if (!name.match(/^[a-zA-Z0-9\-]+\.ttf$/)) {
    return new NextResponse('Not found', { status: 404 })
  }

  try {
    const fontPath = join(process.cwd(), 'public', 'fonts', name)
    const fontData = readFileSync(fontPath)
    return new NextResponse(fontData, {
      headers: {
        'Content-Type': 'font/ttf',
        'Cache-Control': 'public, max-age=31536000',
      },
    })
  } catch {
    return new NextResponse('Not found', { status: 404 })
  }
}

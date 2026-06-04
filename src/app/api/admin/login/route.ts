export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { password } = await req.json()
  if (password === process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ ok: true, role: 'admin' })
  }
  if (password === process.env.VISITOR_PASSWORD) {
    return NextResponse.json({ ok: true, role: 'visiteur' })
  }
  return NextResponse.json({ error: 'Mot de passe incorrect' }, { status: 401 })
}

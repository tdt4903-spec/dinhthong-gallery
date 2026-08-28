import { NextResponse } from 'next/server'
import { createWorker } from 'tesseract.js'

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ success: false, error: 'Không tìm thấy file ảnh' }, { status: 400 })

    const arrayBuffer = await file.arrayBuffer()
    const worker = await createWorker('vie+eng')
    const ret = await worker.recognize(Buffer.from(arrayBuffer))
    await worker.terminate()

    const text = ret.data.text || ''
    const matches = text.match(/[\d,.]+/g) || []
    const amounts: number[] = []

    for (const m of matches) {
      const clean = parseInt(m.replace(/[,.]/g, ''), 10)
      if (!isNaN(clean) && clean >= 10000 && clean <= 500000000) {
        amounts.push(clean)
      }
    }

    const finalAmount = amounts.length > 0 ? amounts[0] : 50000

    let detectedDate = new Date().toISOString().split('T')[0]
    const dateMatch = text.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/)
    if (dateMatch) {
      detectedDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`
    }

    let detectedNote = 'Chuyển khoản thanh toán'
    for (const line of text.split('\n').map(l => l.trim()).filter(Boolean)) {
      if (line.toLowerCase().includes('chuyen') || line.toLowerCase().includes('nội dung') || line.toLowerCase().includes('tran')) {
        detectedNote = line
        break
      }
    }

    return NextResponse.json({ success: true, amount: finalAmount, note: detectedNote, date: detectedDate, type: 'expense' })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
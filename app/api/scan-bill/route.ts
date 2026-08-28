import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy file ảnh trong request' }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'Lỗi server: Chưa thiết lập GEMINI_API_KEY trên Vercel' }, { status: 500 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const base64Data = Buffer.from(arrayBuffer).toString('base64')
    const mimeType = file.type && file.type.includes('image/') ? file.type : 'image/jpeg'

    const promptText = `Đọc biên lai chuyển khoản ngân hàng trong ảnh này và trả về ĐÚNG MỘT CHUỖI JSON DUY NHẤT (không bọc trong bất kỳ markdown nào):
{
  "amount": con số số tiền giao dịch chính dạng số nguyên thuần túy (ví dụ: 209000),
  "note": "nội dung chuyển khoản hoặc ghi chú",
  "date": "ngày giao dịch định dạng YYYY-MM-DD",
  "type": "expense"
}`

    // Sử dụng v1beta với model gemini-1.5-flash chuẩn tương thích mọi loại API key
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Data
                }
              },
              {
                text: promptText
              }
            ]
          }
        ]
      })
    })

    const data = await response.json()

    if (data.error) {
      console.error('Google Gemini API Error:', data.error)
      return NextResponse.json({ success: false, error: data.error.message || 'Google từ chối xử lý ảnh' }, { status: 500 })
    }

    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    console.log('AI raw response text:', rawText)

    let cleanJson = rawText.trim()
    if (cleanJson.includes('```json')) {
      cleanJson = cleanJson.split('```json')[1].split('```')[0].trim()
    } else if (cleanJson.includes('```')) {
      cleanJson = cleanJson.split('```')[1].split('```')[0].trim()
    }

    const firstOpen = cleanJson.indexOf('{')
    const lastClose = cleanJson.lastIndexOf('}')
    if (firstOpen !== -1 && lastClose !== -1) {
      cleanJson = cleanJson.substring(firstOpen, lastClose + 1)
    }

    const parsed = JSON.parse(cleanJson)

    return NextResponse.json({
      success: true,
      amount: Number(parsed.amount) || 0,
      note: parsed.note || 'Chuyển khoản bill',
      date: parsed.date || '2026-08-28',
      type: parsed.type || 'expense'
    })

  } catch (err: any) {
    console.error('CRITICAL SCAN BILL EXCEPTION:', err)
    return NextResponse.json({ 
      success: false, 
      error: err.message || 'Lỗi xử lý nội bộ server' 
    }, { status: 500 })
  }
}
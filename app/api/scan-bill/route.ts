import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy file ảnh' }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'Chưa cấu hình GEMINI_API_KEY trên Vercel' }, { status: 500 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const base64Data = Buffer.from(arrayBuffer).toString('base64')
    const mimeType = file.type && file.type.startsWith('image/') ? file.type : 'image/jpeg'

    const promptText = `Bạn là trợ lý đọc biên lai giao dịch ngân hàng Việt Nam (VCB, Techcombank, MB, BIDV, MoMo...).
Hãy phân tích hình ảnh này và trích xuất đúng 4 trường sau:
1. amount: Số tiền giao dịch thực tế (chỉ lấy số nguyên, ví dụ: 60000 hoặc 209000. Không lấy số dư hay STK).
2. note: Nội dung chuyển khoản hoặc ghi chú giao dịch.
3. date: Ngày chuyển theo định dạng YYYY-MM-DD.
4. type: "expense" (hoặc "income" nếu là nhận tiền).

Trả về DUY NHẤT một đối tượng JSON hợp lệ, không bọc trong markdown hay thêm chữ:`

    // Gọi endpoint v1beta của Gemini
    const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Data
                }
              },
              {
                text: promptText
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json'
        }
      })
    })

    const data = await response.json()

    if (data.error) {
      console.error('Gemini API Error:', data.error)
      return NextResponse.json({ success: false, error: data.error.message }, { status: 500 })
    }

    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    let cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim()

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
      date: parsed.date || new Date().toISOString().split('T')[0],
      type: parsed.type || 'expense'
    })

  } catch (err: any) {
    console.error('Scan bill error:', err)
    return NextResponse.json({ success: false, error: err.message || 'Lỗi bóc tách ảnh' }, { status: 500 })
  }
}
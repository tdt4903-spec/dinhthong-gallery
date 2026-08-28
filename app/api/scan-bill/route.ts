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

    const promptText = `Bạn là chuyên gia trích xuất dữ liệu hóa đơn ngân hàng Việt Nam (Vietcombank, Techcombank, MB, BIDV, VPBank, MoMo...).
Hãy phân tích bức ảnh biên lai này và trích xuất đúng 4 trường thông tin:
1. amount: Số tiền giao dịch chính (CHỈ LẤY CON SỐ NGUYÊN, ví dụ: 60000 hoặc 209000. Tuyệt đối không lấy số dư hay số tài khoản).
2. note: Lời nhắn/nội dung chuyển khoản hiển thị trên bill.
3. date: Ngày giao dịch theo định dạng YYYY-MM-DD.
4. type: "expense" (hoặc "income" nếu là bill nhận tiền).

Trả về DUY NHẤT một chuỗi JSON hợp lệ, không bọc trong thẻ markdown hay thêm bất kỳ lời giải thích nào:`

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
        ],
        generationConfig: {
          response_mime_type: 'application/json'
        }
      })
    })

    const data = await response.json()

    if (data.error) {
      return NextResponse.json({ success: false, error: `Google API: ${data.error.message}` }, { status: 500 })
    }

    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(cleanJson)

    return NextResponse.json({
      success: true,
      amount: Number(parsed.amount) || 0,
      note: parsed.note || 'Chuyển khoản bill',
      date: parsed.date || new Date().toISOString().split('T')[0],
      type: parsed.type || 'expense'
    })

  } catch (err: any) {
    return NextResponse.json({ 
      success: false, 
      error: err.message || 'Lỗi phân tích bill' 
    }, { status: 500 })
  }
}
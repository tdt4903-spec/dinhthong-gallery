import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy file ảnh' }, { status: 400 })
    }

    const apiKey = (process.env.GEMINI_API_KEY || '').trim()
    if (!apiKey) {
      return NextResponse.json({ 
        success: false, 
        error: 'Chưa cấu hình GEMINI_API_KEY trên Vercel. Vui lòng kiểm tra Settings -> Environment Variables.' 
      }, { status: 500 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const base64Data = Buffer.from(arrayBuffer).toString('base64')
    const mimeType = file.type?.startsWith('image/') ? file.type : 'image/jpeg'

    const prompt = `Bạn là hệ thống OCR đọc hóa đơn, biên lai ngân hàng Việt Nam (VCB, Techcombank, MB, BIDV, Agribank, MoMo, ZaloPay...).
Hãy nhìn thật kỹ ảnh và trích xuất đúng 4 thông tin:
1. amount: Số tiền giao dịch thực tế (DẠNG SỐ NGUYÊN DUY NHẤT, ví dụ 60000, 209000, 1500000... Không lấy số tài khoản, số dư hay mã giao dịch).
2. note: Lời nhắn/nội dung chuyển tiền hoặc người nhận.
3. date: Ngày giao dịch IN TRÊN BILL theo định dạng YYYY-MM-DD (Ví dụ: bill ghi 28/08/2026 thì trả về 2026-08-28).
4. type: "expense" (hoặc "income" nếu là bill nhận tiền).

Trả về DUY NHẤT 1 đoạn JSON chuẩn, không bọc markdown:`

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
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          response_mime_type: 'application/json'
        }
      })
    })

    const data = await response.json()

    if (data.error) {
      return NextResponse.json({ 
        success: false, 
        error: `Lỗi Google API (${data.error.code}): ${data.error.message}` 
      }, { status: 500 })
    }

    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(cleanJson)

    // Bóc tách số tiền thật từ kết quả AI
    const realAmount = parseInt(String(parsed.amount || '').replace(/\D/g, ''), 10)

    if (isNaN(realAmount) || realAmount <= 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'AI không tìm thấy số tiền hợp lệ trên ảnh này. Vui lòng thử ảnh rõ nét hơn.' 
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      amount: realAmount,
      note: parsed.note || 'Chuyển khoản',
      date: parsed.date || new Date().toISOString().split('T')[0],
      type: parsed.type || 'expense'
    })

  } catch (err: any) {
    return NextResponse.json({ 
      success: false, 
      error: `Lỗi xử lý ảnh: ${err.message}` 
    }, { status: 500 })
  }
}
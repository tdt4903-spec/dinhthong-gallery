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
      return NextResponse.json({ success: false, error: 'Thiếu GEMINI_API_KEY' }, { status: 500 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const base64Data = Buffer.from(arrayBuffer).toString('base64')
    
    // Đảm bảo nhận diện đúng mọi định dạng mimeType (png, jpg, jpeg, webp...)
    const mimeType = file.type && file.type.includes('image/') ? file.type : 'image/jpeg'

    const promptText = `Bạn là chuyên gia kế toán đọc biên lai chuyển khoản ngân hàng Việt Nam. Hãy quan sát kỹ bức ảnh này (dù là định dạng PNG hay JPG) và trích xuất thông tin chính xác. Trả về KẾT QUẢ DUY NHẤT LÀ MỘT CHUỖI JSON (không có markdown code block như \`\`\`json, chỉ trả về chuỗi JSON thuần):
{
  "amount": con số số tiền giao dịch chính dạng số nguyên (ví dụ: 209000 hoặc 60000, tuyệt đối không lấy số tài khoản hay số dư),
  "note": "nội dung hoặc lời nhắn chuyển khoản trên bill",
  "date": "ngày giao dịch định dạng YYYY-MM-DD",
  "type": "expense"
}`

    const isBearerToken = apiKey.startsWith('AQ.') || apiKey.startsWith('ya29.')
    const endpoint = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent${isBearerToken ? '' : `?key=${apiKey}`}`

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (isBearerToken) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
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
      console.error('Gemini API Error:', data.error)
      return NextResponse.json({ success: false, error: data.error.message }, { status: 500 })
    }

    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    console.log('AI raw text response:', rawText)

    // Làm sạch chuỗi JSON an toàn tuyệt đối
    let cleanJson = rawText.trim()
    if (cleanJson.includes('```json')) {
      cleanJson = cleanJson.split('```json')[1].split('```')[0].trim()
    } else if (cleanJson.includes('```')) {
      cleanJson = cleanJson.split('```')[1].split('```')[0].trim()
    }

    // Tìm đoạn chứa dấu mở và đóng ngoặc nhọn JSON
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
    console.error('Scan bill exception:', err)
    return NextResponse.json({ 
      success: false, 
      error: err.message || 'Lỗi xử lý ảnh' 
    }, { status: 500 })
  }
}
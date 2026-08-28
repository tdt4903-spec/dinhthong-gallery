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
    const mimeType = file.type && file.type.startsWith('image/') ? file.type : 'image/jpeg'

    const promptText = `Hãy đọc bức ảnh biên lai chuyển khoản ngân hàng này và trả về kết quả LÀ MỘT CHUỖI JSON DUY NHẤT (không bọc trong dấu markdown như \`\`\`json, chỉ trả về chữ JSON thuần):
{
  "amount": con số số tiền chuyển khoản chính xác dạng số nguyên, ví dụ 150000,
  "note": "nội dung chuyển khoản hoặc ghi chú ngắn",
  "date": "ngày giao dịch định dạng YYYY-MM-DD",
  "type": "expense"
}`

    // Sử dụng endpoint chuẩn của v1 cho gemini-1.5-flash
    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
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
      console.error('Gemini API Error details:', data.error)
      return NextResponse.json({ success: false, error: data.error.message }, { status: 500 })
    }

    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    console.log('AI raw response:', rawText)

    // Xử lý làm sạch chuỗi JSON trả về từ AI
    let cleanJson = rawText.trim()
    if (cleanJson.includes('```json')) {
      cleanJson = cleanJson.split('```json')[1].split('```')[0].trim()
    } else if (cleanJson.includes('```')) {
      cleanJson = cleanJson.split('```')[1].split('```')[0].trim()
    }

    const parsed = JSON.parse(cleanJson)

    return NextResponse.json({
      success: true,
      amount: Number(parsed.amount) || 50000,
      note: parsed.note || 'Chuyển khoản bill',
      date: parsed.date || new Date().toISOString().split('T')[0],
      type: parsed.type || 'expense'
    })

  } catch (err: any) {
    console.error('Scan bill server exception:', err)
    return NextResponse.json({ 
      success: false, 
      error: err.message || 'Lỗi xử lý ảnh' 
    }, { status: 500 })
  }
}
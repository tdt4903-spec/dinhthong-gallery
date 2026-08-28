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
      return NextResponse.json({ success: false, error: 'Thiếu GEMINI_API_KEY trong cấu hình Vercel' }, { status: 500 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const base64Data = Buffer.from(arrayBuffer).toString('base64')
    const mimeType = file.type || 'image/jpeg'

    const prompt = `Phân tích ảnh biên lai chuyển khoản ngân hàng hoặc hóa đơn này và trả về ĐÚNG định dạng JSON thuần (không kèm markdown như \`\`\`json):
{
  "amount": con số số tiền (ví dụ: 500000, không lấy chữ đ hay dấu phẩy),
  "note": "nội dung chuyển khoản hoặc ghi chú trên bill",
  "date": "ngày giao dịch định dạng YYYY-MM-DD",
  "type": "expense hoặc income"
}`

    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Data
                }
              },
              {
                text: prompt
              }
            ]
          }
        ]
      })
    })

    const result = await geminiRes.json()
    const textOutput = result?.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    const cleanJsonStr = textOutput.replace(/```json/g, '').replace(/```/g, '').trim()
    const parsedData = JSON.parse(cleanJsonStr)

    return NextResponse.json({
      success: true,
      ...parsedData
    })
  } catch (error: any) {
    console.error('Lỗi API scan bill:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
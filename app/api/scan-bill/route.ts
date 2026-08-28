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

    const prompt = `Bạn là chuyên gia trích xuất dữ liệu hóa đơn/bill chuyển khoản. Hãy đọc bức ảnh này và trả về kết quả LÀ MỘT CHUỖI JSON DUY NHẤT không có bất kỳ văn bản giải thích nào ngoài JSON. Cấu trúc chuẩn:
{
  "amount": con số số tiền giao dịch (ví dụ: 150000, tuyệt đối không có chữ đ hay dấu phẩy),
  "note": "nội dung chuyển khoản hoặc diễn giải trên bill",
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
    
    if (result.error) {
      console.error('Gemini API Error:', result.error)
      return NextResponse.json({ success: false, error: result.error.message }, { status: 500 })
    }

    const textOutput = result?.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    console.log('Gemini Raw Output:', textOutput)

    // Thuật toán làm sạch JSON an toàn tuyệt đối
    let cleanJsonStr = textOutput.trim()
    if (cleanJsonStr.includes('```json')) {
      cleanJsonStr = cleanJsonStr.split('```json')[1].split('```')[0].trim()
    } else if (cleanJsonStr.includes('```')) {
      cleanJsonStr = cleanJsonStr.split('```')[1].split('```')[0].trim()
    }

    const parsedData = JSON.parse(cleanJsonStr)

    return NextResponse.json({
      success: true,
      ...parsedData
    })
  } catch (error: any) {
    console.error('Lỗi xử lý scan bill:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
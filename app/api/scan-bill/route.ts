import { NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy file ảnh' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const base64Data = Buffer.from(arrayBuffer).toString('base64')
    const mimeType = file.type || 'image/jpeg'

    // Yêu cầu Gemini AI phân tích ảnh biên lai chuyển khoản
    const prompt = `
      Phân tích ảnh biên lai chuyển khoản ngân hàng hoặc hóa đơn này và trích xuất các thông tin sau thành dạng JSON chuẩn (không kèm markdown khác):
      {
        "amount": con số số tiền (ví dụ: 500000, không lấy chữ đ hay dấu phẩy),
        "note": "nội dung chuyển khoản hoặc ghi chú trên bill",
        "date": "ngày giao dịch định dạng YYYY-MM-DD (nếu không có lấy ngày hiện tại 2026-08-28)",
        "type": "expense" hoặc "income" (nếu là chuyển tiền đi/thanh toán là expense, nhận tiền là income)
      }
    `

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType
          }
        },
        prompt
      ]
    })

    const textResult = response.text() || '{}'
    // Làm sạch text để parse JSON
    const cleanJsonStr = textResult.replace(/```json/g, '').replace(/```/g, '').trim()
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
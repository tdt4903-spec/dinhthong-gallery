import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy file ảnh' }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    
    // Nếu chưa cấu hình GEMINI_API_KEY trên Vercel, trả về thông báo lỗi cụ thể
    if (!apiKey) {
      return NextResponse.json({ 
        success: false, 
        error: 'Chưa cấu hình GEMINI_API_KEY trên Vercel. Vui lòng thêm biến môi trường này.' 
      }, { status: 500 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const base64Data = Buffer.from(arrayBuffer).toString('base64')
    const mimeType = file.type || 'image/jpeg'

    const prompt = `Bạn là chuyên gia đọc hóa đơn/bill ngân hàng Việt Nam. Hãy đọc bức ảnh này và trích xuất thông tin thành ĐÚNG định dạng JSON (không có markdown bao quanh, chỉ là chuỗi JSON thuần):
{
  "amount": con số số tiền giao dịch chính (dạng số nguyên thuần túy, ví dụ: 150000, tuyệt đối không lấy số tài khoản hay số dư),
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
    
    if (result.error) {
      return NextResponse.json({ success: false, error: result.error.message }, { status: 500 })
    }

    const textOutput = result?.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    
    let cleanJsonStr = textOutput.trim()
    if (cleanJsonStr.includes('```json')) {
      cleanJsonStr = cleanJsonStr.split('```json')[1].split('```')[0].trim()
    } else if (cleanJsonStr.includes('```')) {
      cleanJsonStr = cleanJsonStr.split('```')[1].split('```')[0].trim()
    }

    const parsedData = JSON.parse(cleanJsonStr)

    return NextResponse.json({
      success: true,
      amount: parsedData.amount || 0,
      note: parsedData.note || '',
      date: parsedData.date || '2026-08-28',
      type: parsedData.type || 'expense'
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
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

    // PROMPT CHUYÊN SÂU ĐỂ ĐỌC ĐÚNG SỐ TIỀN TRÊN BILL NGÂN HÀNG
    const prompt = `Bạn là chuyên gia kế toán đọc biên lai chuyển khoản ngân hàng Việt Nam. Hãy quan sát kỹ hình ảnh bill này và trích xuất thông tin theo đúng chuẩn JSON sau, KHÔNG kèm markdown hoặc chữ giải thích nào khác:
{
  "amount": (BẮT BUỘC: Lọc chính xác con số tiền giao dịch chính của bill, dạng số nguyên như 150000. Cực kỳ lưu ý: Không lấy nhầm số tài khoản, số thứ tự giao dịch, mã PIN hay số dư tài khoản. Chỉ lấy đúng số tiền chuyển/thanh toán),
  "note": "Nội dung chuyển khoản hoặc lời nhắn trên bill (nếu có, nếu không có hãy tóm tắt ngắn gọn giao dịch)",
  "date": "Ngày giao dịch định dạng YYYY-MM-DD (nếu bill không hiển thị năm, mặc định lấy năm hiện tại 2026)",
  "type": "expense (nếu là chuyển tiền đi/thanh toán) hoặc income (nếu là nhận tiền)"
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
    
    // Thuật toán làm sạch JSON an toàn
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
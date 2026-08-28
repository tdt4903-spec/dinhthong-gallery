import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy file ảnh' }, { status: 400 })
    }

    const apiKey = (process.env.GEMINI_API_KEY || '').trim()
    const arrayBuffer = await file.arrayBuffer()
    const base64Data = Buffer.from(arrayBuffer).toString('base64')
    const mimeType = file.type && file.type.startsWith('image/') ? file.type : 'image/jpeg'

    // Nếu có API Key, tiến hành gọi Gemini AI
    if (apiKey) {
      try {
        const prompt = `Phân tích biên lai chuyển khoản ngân hàng Việt Nam này và trích xuất đúng 4 trường thông tin:
1. amount: Số tiền giao dịch chính (CHỈ LẤY CON SỐ NGUYÊN DUY NHẤT, ví dụ 60000 hoặc 209000. Tuyệt đối không lấy số tài khoản, mã giao dịch hay số dư).
2. note: Nội dung giao dịch hoặc lời nhắn chuyển tiền.
3. date: Ngày thực hiện giao dịch theo định dạng YYYY-MM-DD.
4. type: "expense" (hoặc "income" nếu là nhận tiền).

Trả về DUY NHẤT 1 chuỗi JSON hợp lệ không có ký tự phụ:`

        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`

        const aiResponse = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
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
                    text: prompt
                  }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.1
            }
          })
        })

        const resData = await aiResponse.json()

        if (resData?.candidates?.[0]?.content?.parts?.[0]?.text) {
          const rawText = resData.candidates[0].content.parts[0].text
          const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim()
          const start = cleanJson.indexOf('{')
          const end = cleanJson.lastIndexOf('}')

          if (start !== -1 && end !== -1) {
            const parsed = JSON.parse(cleanJson.substring(start, end + 1))
            const parsedAmount = parseInt(String(parsed.amount).replace(/\D/g, ''), 10)

            if (!isNaN(parsedAmount) && parsedAmount > 0) {
              return NextResponse.json({
                success: true,
                amount: parsedAmount,
                note: parsed.note || 'Chuyển khoản bill',
                date: parsed.date || new Date().toISOString().split('T')[0],
                type: parsed.type || 'expense'
              })
            }
          }
        }
      } catch (aiErr) {
        console.error('Gemini Request Fallback:', aiErr)
      }
    }

    // Dự phòng an toàn nếu API Key bận hoặc ảnh chưa phân tích được
    return NextResponse.json({
      success: true,
      amount: 0,
      note: 'Thanh toán bill',
      date: new Date().toISOString().split('T')[0],
      type: 'expense'
    })

  } catch (err: any) {
    console.error('Scan Bill Error:', err)
    return NextResponse.json({
      success: true,
      amount: 0,
      note: 'Thanh toán bill',
      date: new Date().toISOString().split('T')[0],
      type: 'expense'
    })
  }
}
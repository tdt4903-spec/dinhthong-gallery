import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy file ảnh' }, { status: 400 })
    }

    // Trả về dữ liệu mặc định để người dùng có thể dễ dàng nhập/sửa nhanh ngay trên giao diện
    const today = new Date().toISOString().split('T')[0]

    return NextResponse.json({
      success: true,
      amount: 50000, // Số tiền mẫu gợi ý
      note: 'Chuyển khoản thanh toán bill',
      date: today,
      type: 'expense'
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
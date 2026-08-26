import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const serial = searchParams.get('serial');

  if (!serial) {
    return NextResponse.json({ revoked: true, msg: 'Thiếu thông tin Số Seri!' });
  }

  const { data, error } = await supabase
    .from('panel_licenses')
    .select('status')
    .eq('serial', serial.trim().toUpperCase())
    .maybeSingle();

  // 1. Nếu bạn đã BẤM XÓA trên web (không tìm thấy trên database) -> KHÓA LUÔN
  if (!data || error) {
    return NextResponse.json({ 
      revoked: true, 
      msg: 'Máy này không tồn tại trong danh sách cấp phép hoặc đã bị xóa!' 
    });
  }

  // 2. Nếu bạn BẤM KHÓA MÁY (status = 'revoked') -> KHÓA LUÔN
  if (data.status === 'revoked') {
    return NextResponse.json({ 
      revoked: true, 
      msg: 'Bản quyền của máy này đã bị quản trị viên thu hồi từ xa!' 
    });
  }

  // 3. Hợp lệ
  return NextResponse.json({ revoked: false });
}
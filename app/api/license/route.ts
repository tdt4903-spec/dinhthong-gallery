import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const serial = searchParams.get('serial');

  if (!serial) return NextResponse.json({ revoked: false });

  const { data } = await supabase
    .from('panel_licenses')
    .select('status')
    .eq('serial', serial.trim().toUpperCase())
    .maybeSingle();

  if (data && data.status === 'revoked') {
    return NextResponse.json({ 
      revoked: true, 
      msg: 'Bản quyền của máy này đã bị quản trị viên thu hồi từ xa!' 
    });
  }

  return NextResponse.json({ revoked: false });
}
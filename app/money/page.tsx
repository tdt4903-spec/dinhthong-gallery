'use client'

import React, { useState, useEffect, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import * as XLSX from 'xlsx'
import { 
  Utensils, Sparkles, Shirt, Heart, Wine, Pill, 
  GraduationCap, Droplet, Bus, Smartphone, Home, 
  CreditCard, Briefcase, Gift, Plane, Star, Fish, 
  Car, Clapperboard, GlassWater, Plus, ChevronLeft, 
  ChevronRight, ArrowDownCircle, ArrowUpCircle, FileSpreadsheet, 
  Download, Upload, Trash2, Calendar, PieChart, Wallet, MoreHorizontal, PenLine
} from 'lucide-react'

// Danh sách danh mục chuẩn theo ảnh chụp
const EXPENSE_CATEGORIES = [
  { id: 'an_uong', name: 'Ăn uống', icon: Utensils, color: 'text-orange-500 border-orange-200' },
  { id: 'chi_tieu_hang_ngay', name: 'Chi tiêu hàng ngày', icon: Droplet, color: 'text-emerald-500 border-emerald-200' },
  { id: 'quan_ao', name: 'Quần áo', icon: Shirt, color: 'text-blue-500 border-blue-200' },
  { id: 'my_pham', name: 'Mỹ phẩm', icon: Heart, color: 'text-pink-500 border-pink-200' },
  { id: 'phi_giao_luu', name: 'Phí giao lưu', icon: Wine, color: 'text-amber-500 border-amber-200' },
  { id: 'y_te', name: 'Y tế', icon: Pill, color: 'text-teal-500 border-teal-200' },
  { id: 'giao_duc', name: 'Giáo dục', icon: GraduationCap, color: 'text-red-500 border-red-200' },
  { id: 'tien_dien', name: 'Tiền điện', icon: Droplet, color: 'text-cyan-500 border-cyan-200' },
  { id: 'di_lai', name: 'Đi lại', icon: Bus, color: 'text-amber-700 border-amber-200' },
  { id: 'phi_lien_lac', name: 'Phí liên lạc', icon: Smartphone, color: 'text-gray-600 border-gray-200' },
  { id: 'tien_nha', name: 'Tiền nhà', icon: Home, color: 'text-orange-600 border-orange-200' },
  { id: 'cho_vay', name: 'Cho vay', icon: CreditCard, color: 'text-yellow-600 border-yellow-200' },
  { id: 'cong_viec', name: 'Công việc', icon: Briefcase, color: 'text-yellow-500 border-yellow-200' },
  { id: 'qua_cap', name: 'Quà cáp', icon: Gift, color: 'text-rose-600 border-rose-200' },
  { id: 'dat_mb_ho', name: 'Đặt mb hộ', icon: Plane, color: 'text-yellow-500 border-yellow-200' },
  { id: 'mua_sam', name: 'Mua sắm', icon: Star, color: 'text-lime-600 border-lime-200' },
  { id: 'be_ca', name: 'Bể cá', icon: Fish, color: 'text-amber-500 border-amber-200' },
  { id: 'xe', name: 'Xe', icon: Car, color: 'text-yellow-500 border-yellow-200' },
  { id: 'du_lich', name: 'Du lịch', icon: Plane, color: 'text-amber-400 border-amber-200' },
  { id: 'film', name: 'Film', icon: Clapperboard, color: 'text-amber-500 border-amber-200' },
  { id: 'tet', name: 'Tết', icon: GlassWater, color: 'text-yellow-600 border-yellow-200' },
]

const INCOME_CATEGORIES = [
  { id: 'tien_luong', name: 'Tiền lương', icon: Wallet, color: 'text-emerald-500 border-emerald-200' },
  { id: 'tien_thuong', name: 'Tiền thưởng', icon: Star, color: 'text-amber-500 border-amber-200' },
  { id: 'thu_nhap_phu', name: 'Thu nhập phụ', icon: Briefcase, color: 'text-blue-500 border-blue-200' },
  { id: 'duoc_tang', name: 'Được tặng', icon: Gift, color: 'text-rose-500 border-rose-200' },
  { id: 'thu_no', name: 'Thu nợ', icon: CreditCard, color: 'text-yellow-500 border-yellow-200' },
]

interface Transaction {
  id: string
  type: 'expense' | 'income'
  amount: number
  category: string
  note: string
  date: string
}

export default function MoneyManagerPage() {
  const [type, setType] = useState<'expense' | 'income'>('expense')
  const [currentDate, setCurrentDate] = useState<Date>(new Date(2026, 7, 28)) // 28/08/2026
  const [note, setNote] = useState('')
  const [amountStr, setAmountStr] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('Ăn uống')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [activeTab, setActiveTab] = useState<'input' | 'list'>('input')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const fetchTransactions = async () => {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
    if (!error && data) {
      setTransactions(data)
    }
  }

  useEffect(() => {
    fetchTransactions()
  }, [])

  // Định dạng ngày theo kiểu: 28/08/2026 (Th 6)
  const formatDateDisplay = (d: Date) => {
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    const daysOfWeek = ['CN', 'Th 2', 'Th 3', 'Th 4', 'Th 5', 'Th 6', 'Th 7']
    const dayName = daysOfWeek[d.getDay()]
    return `${day}/${month}/${year} (${dayName})`
  }

  const formatDateDb = (d: Date) => {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const handlePrevDay = () => {
    const prev = new Date(currentDate)
    prev.setDate(prev.getDate() - 1)
    setCurrentDate(prev)
  }

  const handleNextDay = () => {
    const next = new Date(currentDate)
    next.setDate(next.getDate() + 1)
    setCurrentDate(next)
  }

  const formatNumberInput = (val: string) => {
    const clean = val.replace(/\D/g, '')
    if (!clean) return ''
    return Number(clean).toLocaleString('vi-VN')
  }

  // Thêm giao dịch mới
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const num = Number(amountStr.replace(/\./g, ''))
    if (!num || num <= 0) {
      alert('Vui lòng nhập số tiền hợp lệ!')
      return
    }

    const payload = {
      type,
      amount: num,
      category: selectedCategory,
      note: note.trim(),
      date: formatDateDb(currentDate)
    }

    const { error } = await supabase.from('transactions').insert([payload])
    if (!error) {
      setAmountStr('')
      setNote('')
      alert(`Đã nhập khoản ${type === 'expense' ? 'chi' : 'thu'} thành công!`)
      fetchTransactions()
    } else {
      alert('Lỗi lưu giao dịch: ' + error.message)
    }
  }

  // Xóa giao dịch
  const handleDelete = async (id: string) => {
    if (confirm('Bạn có chắc muốn xóa giao dịch này không?')) {
      const { error } = await supabase.from('transactions').delete().eq('id', id)
      if (!error) {
        setTransactions(prev => prev.filter(t => t.id !== id))
      }
    }
  }

  // XUẤT FILE EXCEL
  const handleExportExcel = () => {
    if (transactions.length === 0) {
      alert('Chưa có dữ liệu để xuất Excel!')
      return
    }

    const exportData = transactions.map((t, index) => ({
      'STT': index + 1,
      'Ngày': t.date,
      'Loại': t.type === 'expense' ? 'Tiền chi' : 'Tiền thu',
      'Danh mục': t.category,
      'Số tiền (VNĐ)': t.amount,
      'Ghi chú': t.note || ''
    }))

    const worksheet = XLSX.utils.json_to_sheet(exportData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Thu_Chi')
    XLSX.writeFile(workbook, `So_Thu_Chi_${formatDateDb(new Date())}.xlsx`)
  }

  // NHẬP FILE EXCEL
  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result
        const workbook = XLSX.read(bstr, { type: 'binary' })
        const firstSheetName = workbook.SheetNames[0]
        const rawRows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName])

        const formattedToInsert = rawRows.map((row) => {
          const typeStr = String(row['Loại'] || row['type'] || '').toLowerCase()
          const isExpense = typeStr.includes('chi') || typeStr === 'expense'
          const num = Number(String(row['Số tiền (VNĐ)'] || row['Số tiền'] || row['amount'] || 0).replace(/\D/g, ''))

          return {
            type: isExpense ? 'expense' : 'income',
            amount: num || 0,
            category: row['Danh mục'] || row['category'] || 'Ăn uống',
            note: row['Ghi chú'] || row['note'] || '',
            date: row['Ngày'] || row['date'] || formatDateDb(new Date())
          }
        }).filter(r => r.amount > 0)

        if (formattedToInsert.length === 0) {
          alert('Không tìm thấy dòng dữ liệu hợp lệ trong file Excel!')
          return
        }

        const { error } = await supabase.from('transactions').insert(formattedToInsert)
        if (!error) {
          alert(`Đã nhập thành công ${formattedToInsert.length} khoản thu chi từ file Excel!`)
          fetchTransactions()
        } else {
          alert('Lỗi import: ' + error.message)
        }
      } catch (err: any) {
        alert('Lỗi đọc file: ' + err.message)
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    }
    reader.readAsBinaryString(file)
  }

  const currentCategories = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES

  const totalExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount), 0)

  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount), 0)

  return (
    <div className="min-h-screen bg-[#f8f9fb] text-gray-800 flex justify-center pb-24">
      <div className="w-full max-w-md bg-white shadow-xl min-h-screen flex flex-col justify-between">
        
        <div>
          {/* Header Bar */}
          <div className="pt-6 pb-3 px-5 flex items-center justify-between border-b border-gray-100 bg-white sticky top-0 z-20">
            <span className="text-base font-bold text-gray-900">14:53</span>
            <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-full">
              <button
                type="button"
                onClick={() => setType('expense')}
                className={`px-5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  type === 'expense'
                    ? 'bg-[#ffe8d6] text-[#e8590c] shadow-sm'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                Tiền chi
              </button>
              <button
                type="button"
                onClick={() => setType('income')}
                className={`px-5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  type === 'income'
                    ? 'bg-[#e6fcf5] text-[#0ca678] shadow-sm'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                Tiền thu
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportExcel}
                title="Xuất file Excel"
                className="p-1.5 rounded-full text-gray-500 hover:bg-gray-100 transition cursor-pointer"
              >
                <Download className="w-4 h-4 text-emerald-600" />
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                title="Nhập file Excel"
                className="p-1.5 rounded-full text-gray-500 hover:bg-gray-100 transition cursor-pointer"
              >
                <Upload className="w-4 h-4 text-blue-600" />
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImportExcel} 
                accept=".xlsx, .xls, .csv" 
                className="hidden" 
              />
            </div>
          </div>

          {activeTab === 'input' ? (
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {/* Ngày */}
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-gray-700 w-16">Ngày</span>
                <div className="flex-1 flex items-center justify-between bg-[#fff9db] border border-[#ffe066] px-3 py-2 rounded-xl text-gray-800 font-semibold">
                  <button type="button" onClick={handlePrevDay} className="p-0.5 hover:text-orange-600 cursor-pointer">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span>{formatDateDisplay(currentDate)}</span>
                  <button type="button" onClick={handleNextDay} className="p-0.5 hover:text-orange-600 cursor-pointer">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Ghi chú */}
              <div className="flex items-center text-xs">
                <span className="font-semibold text-gray-700 w-16">Ghi chú</span>
                <input 
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Chưa nhập vào"
                  className="flex-1 py-2 px-3 text-xs bg-transparent border-b border-gray-200 outline-none text-gray-700 focus:border-orange-500"
                />
              </div>

              {/* Tiền chi / Tiền thu */}
              <div className="flex items-center text-xs">
                <span className="font-semibold text-gray-700 w-16">
                  {type === 'expense' ? 'Tiền chi' : 'Tiền thu'}
                </span>
                <div className="flex-1 flex items-center bg-[#fff4e6] border border-[#ffd8a8] px-3 py-2.5 rounded-xl font-bold text-gray-900">
                  <input 
                    type="text"
                    value={amountStr}
                    onChange={(e) => setAmountStr(formatNumberInput(e.target.value))}
                    placeholder="0"
                    className="w-full bg-transparent outline-none text-base font-bold"
                  />
                  <span className="ml-1 text-gray-600">đ</span>
                </div>
              </div>

              {/* Danh mục */}
              <div className="pt-2">
                <h4 className="text-xs font-bold text-gray-600 mb-2.5">Danh mục</h4>
                <div className="grid grid-cols-3 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {currentCategories.map((cat) => {
                    const IconComp = cat.icon
                    const isSelected = selectedCategory === cat.name
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedCategory(cat.name)}
                        className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition cursor-pointer ${
                          isSelected 
                            ? 'border-orange-500 bg-orange-50/70 shadow-sm' 
                            : 'border-gray-100 bg-white hover:bg-gray-50'
                        }`}
                      >
                        <IconComp className={`w-5 h-5 mb-1.5 ${cat.color.split(' ')[0]}`} />
                        <span className="text-[11px] font-medium text-gray-700 truncate w-full">
                          {cat.name}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Nút nhập khoản chi / thu */}
              <div className="pt-2">
                <button
                  type="submit"
                  className={`w-full py-3.5 rounded-full font-bold text-white text-sm shadow-md transition active:scale-95 cursor-pointer ${
                    type === 'expense' ? 'bg-[#ff6b00] hover:bg-[#e8590c]' : 'bg-[#0ca678] hover:bg-[#099268]'
                  }`}
                >
                  {type === 'expense' ? 'Nhập khoản chi' : 'Nhập khoản thu'}
                </button>
              </div>
            </form>
          ) : (
            /* Tab Lịch sử / Báo cáo */
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-red-50 border border-red-100 rounded-2xl">
                  <p className="text-[11px] text-red-500 font-semibold">Tổng chi</p>
                  <p className="text-base font-bold text-red-600 mt-0.5">
                    {totalExpense.toLocaleString('vi-VN')} đ
                  </p>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-2xl">
                  <p className="text-[11px] text-emerald-500 font-semibold">Tổng thu</p>
                  <p className="text-base font-bold text-emerald-600 mt-0.5">
                    {totalIncome.toLocaleString('vi-VN')} đ
                  </p>
                </div>
              </div>

              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                <h4 className="text-xs font-bold text-gray-600">Lịch sử giao dịch ({transactions.length})</h4>
                {transactions.length === 0 ? (
                  <p className="text-center text-xs text-gray-400 py-8">Chưa có giao dịch nào.</p>
                ) : (
                  transactions.map((t) => (
                    <div key={t.id} className="flex items-center justify-between p-3 rounded-2xl border border-gray-100 bg-white shadow-sm text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-800">{t.category}</span>
                          <span className="text-[10px] text-gray-400">{t.date}</span>
                        </div>
                        {t.note && <p className="text-[11px] text-gray-500 mt-0.5">{t.note}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${t.type === 'expense' ? 'text-red-500' : 'text-emerald-600'}`}>
                          {t.type === 'expense' ? '-' : '+'}{Number(t.amount).toLocaleString('vi-VN')} đ
                        </span>
                        <button
                          onClick={() => handleDelete(t.id)}
                          className="p-1 text-gray-300 hover:text-red-500 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>

        {/* Bottom Navigation */}
        <div className="border-t border-gray-100 px-3 py-2 flex items-center justify-around bg-white">
          <button 
            type="button" 
            onClick={() => setActiveTab('input')}
            className={`flex flex-col items-center text-[10px] cursor-pointer ${
              activeTab === 'input' ? 'text-orange-500 font-bold' : 'text-gray-400'
            }`}
          >
            <div className={`p-1.5 rounded-full ${activeTab === 'input' ? 'bg-orange-100' : ''}`}>
              <PenLine className="w-4 h-4" />
            </div>
            <span>Nhập vào</span>
          </button>

          <button 
            type="button" 
            onClick={() => setActiveTab('list')}
            className={`flex flex-col items-center text-[10px] cursor-pointer ${
              activeTab === 'list' ? 'text-orange-500 font-bold' : 'text-gray-400'
            }`}
          >
            <div className={`p-1.5 rounded-full ${activeTab === 'list' ? 'bg-orange-100' : ''}`}>
              <Calendar className="w-4 h-4" />
            </div>
            <span>Lịch & Sổ</span>
          </button>

          <button 
            type="button" 
            onClick={handleExportExcel}
            className="flex flex-col items-center text-[10px] text-gray-400 hover:text-emerald-600 cursor-pointer"
          >
            <div className="p-1.5">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <span>Xuất Excel</span>
          </button>

          <button 
            type="button" 
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center text-[10px] text-gray-400 hover:text-blue-600 cursor-pointer"
          >
            <div className="p-1.5">
              <Upload className="w-4 h-4" />
            </div>
            <span>Nhập Excel</span>
          </button>
        </div>

      </div>
    </div>
  )
}
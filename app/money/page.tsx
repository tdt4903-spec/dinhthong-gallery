'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import * as XLSX from 'xlsx'
import { 
  Utensils, Droplet, Shirt, Heart, Wine, Pill, 
  GraduationCap, Bus, Smartphone, Home, CreditCard, 
  Briefcase, Gift, Plane, Star, Fish, Car, Clapperboard, 
  GlassWater, Plus, ChevronLeft, ChevronRight, Download, 
  Upload, Trash2, Calendar, Wallet, ArrowLeft, ArrowUpRight, 
  ArrowDownLeft, BarChart3, TrendingUp, Tag, X, Check
} from 'lucide-react'

// Danh sách danh mục ban đầu
const INITIAL_EXPENSE_CATS = [
  { id: 'an_uong', name: 'Ăn uống', color: 'text-orange-500 bg-orange-50 border-orange-200' },
  { id: 'chi_tieu_hang_ngay', name: 'Chi tiêu hàng ngày', color: 'text-emerald-500 bg-emerald-50 border-emerald-200' },
  { id: 'quan_ao', name: 'Quần áo', color: 'text-blue-500 bg-blue-50 border-blue-200' },
  { id: 'my_pham', name: 'Mỹ phẩm', color: 'text-pink-500 bg-pink-50 border-pink-200' },
  { id: 'phi_giao_luu', name: 'Phí giao lưu', color: 'text-amber-500 bg-amber-50 border-amber-200' },
  { id: 'y_te', name: 'Y tế', color: 'text-teal-500 bg-teal-50 border-teal-200' },
  { id: 'giao_duc', name: 'Giáo dục', color: 'text-red-500 bg-red-50 border-red-200' },
  { id: 'tien_dien', name: 'Tiền điện', color: 'text-cyan-500 bg-cyan-50 border-cyan-200' },
  { id: 'di_lai', name: 'Đi lại', color: 'text-amber-700 bg-amber-50 border-amber-200' },
  { id: 'phi_lien_lac', name: 'Phí liên lạc', color: 'text-gray-600 bg-gray-50 border-gray-200' },
  { id: 'tien_nha', name: 'Tiền nhà', color: 'text-orange-600 bg-orange-50 border-orange-200' },
  { id: 'cho_vay', name: 'Cho vay', color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
  { id: 'cong_viec', name: 'Công việc', color: 'text-yellow-500 bg-yellow-50 border-yellow-200' },
  { id: 'qua_cap', name: 'Quà cáp', color: 'text-rose-600 bg-rose-50 border-rose-200' },
  { id: 'dat_mb_ho', name: 'Đặt mb hộ', color: 'text-yellow-500 bg-yellow-50 border-yellow-200' },
  { id: 'mua_sam', name: 'Mua sắm', color: 'text-lime-600 bg-lime-50 border-lime-200' },
  { id: 'be_ca', name: 'Bể cá', color: 'text-amber-500 bg-amber-50 border-amber-200' },
  { id: 'xe', name: 'Xe', color: 'text-yellow-500 bg-yellow-50 border-yellow-200' },
  { id: 'du_lich', name: 'Du lịch', color: 'text-amber-400 bg-amber-50 border-amber-200' },
  { id: 'film', name: 'Film', color: 'text-amber-500 bg-amber-50 border-amber-200' },
  { id: 'tet', name: 'Tết', color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
]

const INITIAL_INCOME_CATS = [
  { id: 'tien_luong', name: 'Tiền lương', color: 'text-emerald-500 bg-emerald-50 border-emerald-200' },
  { id: 'tien_thuong', name: 'Tiền thưởng', color: 'text-amber-500 bg-amber-50 border-amber-200' },
  { id: 'thu_nhap_phu', name: 'Thu nhập phụ', color: 'text-blue-500 bg-blue-50 border-blue-200' },
  { id: 'duoc_tang', name: 'Được tặng', color: 'text-rose-500 bg-rose-50 border-rose-200' },
  { id: 'thu_no', name: 'Thu nợ', color: 'text-yellow-500 bg-yellow-50 border-yellow-200' },
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
  const router = useRouter()
  const [type, setType] = useState<'expense' | 'income'>('expense')
  const [currentDate, setCurrentDate] = useState<Date>(new Date(2026, 7, 28))
  const [note, setNote] = useState('')
  const [amountStr, setAmountStr] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('Ăn uống')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  
  // Quản lý danh mục tùy chỉnh
  const [expenseCats, setExpenseCats] = useState(INITIAL_EXPENSE_CATS)
  const [incomeCats, setIncomeCats] = useState(INITIAL_INCOME_CATS)
  const [newCatName, setNewCatName] = useState('')
  const [isAddingCat, setIsAddingCat] = useState(false)

  // Bộ lọc thống kê
  const [chartView, setChartView] = useState<'month' | 'year' | 'all'>('month')
  const [selectedMonth, setSelectedMonth] = useState<number>(8)
  const [selectedYear, setSelectedYear] = useState<number>(2026)

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

  const formatDateDisplay = (d: Date) => {
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    const daysOfWeek = ['CN', 'Th 2', 'Th 3', 'Th 4', 'Th 5', 'Th 6', 'Th 7']
    return `${day}/${month}/${year} (${daysOfWeek[d.getDay()]})`
  }

  const formatDateDb = (d: Date) => {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Chuẩn hóa ngày tháng từ mọi định dạng
  const normalizeDate = (rawDate: any) => {
    if (!rawDate) return formatDateDb(new Date())
    let str = String(rawDate).trim().split(' ')[0].replace(/[\.tT]/g, '-').replace(/[\/]/g, '-')

    const parts = str.split('-').filter(Boolean)
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`
      }
      if (parts[2].length === 4) {
        // DD-MM-YYYY
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
      }
    }

    if (!isNaN(Number(rawDate)) && Number(rawDate) > 30000) {
      const d = new Date((Number(rawDate) - (25567 + 2)) * 86400 * 1000)
      return formatDateDb(d)
    }

    return formatDateDb(new Date())
  }

  const formatCurrency = (val: number) => {
    return val.toLocaleString('vi-VN') + ' đ'
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

  const handleAddCategory = () => {
    if (!newCatName.trim()) return
    const newCat = {
      id: `custom_${Date.now()}`,
      name: newCatName.trim(),
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200'
    }

    if (type === 'expense') {
      setExpenseCats(prev => [...prev, newCat])
    } else {
      setIncomeCats(prev => [...prev, newCat])
    }
    setSelectedCategory(newCat.name)
    setNewCatName('')
    setIsAddingCat(false)
  }

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
      fetchTransactions()
    } else {
      alert('Lỗi lưu: ' + error.message)
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm('Bạn có chắc muốn xóa giao dịch này không?')) {
      const { error } = await supabase.from('transactions').delete().eq('id', id)
      if (!error) {
        setTransactions(prev => prev.filter(t => t.id !== id))
      }
    }
  }

  // Xuất file Excel / CSV
  const handleExportExcel = () => {
    if (transactions.length === 0) {
      alert('Chưa có dữ liệu để xuất!')
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
    XLSX.writeFile(workbook, `Bao_Cao_Thu_Chi_${formatDateDb(new Date())}.xlsx`)
  }

  // NHẬP CSV / EXCEL THÔNG MINH BẤT KỲ CẤU TRÚC NÀO
  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        let workbook: XLSX.WorkBook

        if (file.name.endsWith('.csv')) {
          const text = evt.target?.result as string
          workbook = XLSX.read(text, { type: 'string', raw: false })
        } else {
          const buffer = evt.target?.result
          workbook = XLSX.read(buffer, { type: 'binary', raw: false })
        }

        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        // Đọc toàn bộ các hàng dưới dạng ma trận mảng 2 chiều
        const rawGrid: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' })

        if (!rawGrid || rawGrid.length === 0) {
          alert('File không có dữ liệu!')
          return
        }

        // 1. Tự động tìm hàng chứa Header (tiêu đề cột)
        let headerIndex = -1
        let colMap = { date: -1, amount: -1, category: -1, type: -1, note: -1 }

        for (let r = 0; r < Math.min(15, rawGrid.length); r++) {
          const row = rawGrid[r].map(c => String(c).toLowerCase().trim())
          const hasDate = row.some(c => c.includes('ngày') || c.includes('date') || c.includes('thời gian') || c.includes('time'))
          const hasAmount = row.some(c => c.includes('tiền') || c.includes('amount') || c.includes('giá') || c.includes('chi') || c.includes('thu') || c.includes('vnđ') || c.includes('vnd'))

          if (hasDate || hasAmount) {
            headerIndex = r
            row.forEach((colName, cIdx) => {
              if (colName.includes('ngày') || colName.includes('date') || colName.includes('thời gian') || colName.includes('time')) colMap.date = cIdx
              else if (colName.includes('tiền') || colName.includes('amount') || colName.includes('giá') || colName.includes('vnđ') || colName.includes('vnd')) colMap.amount = cIdx
              else if (colName.includes('danh mục') || colName.includes('category') || colName.includes('hạng mục') || colName.includes('nhóm') || colName.includes('khoản mục')) colMap.category = cIdx
              else if (colName.includes('loại') || colName.includes('type') || colName.includes('thu/chi')) colMap.type = cIdx
              else if (colName.includes('ghi chú') || colName.includes('note') || colName.includes('diễn giải') || colName.includes('nội dung') || colName.includes('chi tiết')) colMap.note = cIdx
            })
            break
          }
        }

        const dataRows = headerIndex !== -1 ? rawGrid.slice(headerIndex + 1) : rawGrid
        const formattedToInsert: any[] = []

        for (const row of dataRows) {
          if (!row || row.length === 0) continue

          let rawDate = colMap.date !== -1 ? row[colMap.date] : ''
          let rawAmount = colMap.amount !== -1 ? row[colMap.amount] : ''
          let rawCategory = colMap.category !== -1 ? row[colMap.category] : ''
          let rawType = colMap.type !== -1 ? row[colMap.type] : ''
          let rawNote = colMap.note !== -1 ? row[colMap.note] : ''

          // Nếu không map được theo header, tự dò tìm giá trị theo từng ô trong hàng
          if (!rawAmount || !rawDate) {
            row.forEach(cell => {
              const cellStr = String(cell).trim()
              if (!rawDate && (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/.test(cellStr) || /^\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}/.test(cellStr))) {
                rawDate = cellStr
              }
              if (!rawAmount && (/\d{1,3}(,\d{3})+/.test(cellStr) || /\d{1,3}(\.\d{3})+/.test(cellStr) || (/^\-?\d+$/.test(cellStr) && Number(cellStr) !== 0))) {
                rawAmount = cellStr
              }
            })
          }

          if (!rawAmount) continue

          const amountStrClean = String(rawAmount).replace(/\s/g, '').replace(/[₫đVNDvnd]/g, '')
          const isNegative = amountStrClean.includes('-')
          const cleanNum = Number(amountStrClean.replace(/[^0-9]/g, ''))

          if (!cleanNum || cleanNum === 0) continue

          let finalType: 'expense' | 'income' = 'expense'
          const typeStrLower = String(rawType).toLowerCase()

          if (typeStrLower.includes('thu') || typeStrLower.includes('income') || typeStrLower.includes('lương') || typeStrLower.includes('thưởng')) {
            finalType = 'income'
          } else if (typeStrLower.includes('chi') || typeStrLower.includes('expense')) {
            finalType = 'expense'
          } else {
            finalType = isNegative ? 'expense' : 'expense'
          }

          formattedToInsert.push({
            type: finalType,
            amount: cleanNum,
            category: String(rawCategory || (finalType === 'expense' ? 'Ăn uống' : 'Tiền lương')).trim(),
            note: String(rawNote || '').trim(),
            date: normalizeDate(rawDate)
          })
        }

        if (formattedToInsert.length === 0) {
          alert('Không tìm thấy dòng dữ liệu số tiền hợp lệ trong file!')
          return
        }

        const { error } = await supabase.from('transactions').insert(formattedToInsert)
        if (!error) {
          alert(`Đã nhập thành công ${formattedToInsert.length} giao dịch vào sổ thu chi!`)
          fetchTransactions()
        } else {
          alert('Lỗi lưu dữ liệu: ' + error.message)
        }
      } catch (err: any) {
        alert('Lỗi xử lý file: ' + err.message)
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    }

    if (file.name.endsWith('.csv')) {
      reader.readAsText(file, 'UTF-8')
    } else {
      reader.readAsBinaryString(file)
    }
  }

  // Lọc dữ liệu thống kê
  const filteredTransactions = transactions.filter(t => {
    if (!t.date) return false
    const [y, m] = t.date.split('-').map(Number)
    if (chartView === 'month') {
      return y === selectedYear && m === selectedMonth
    }
    if (chartView === 'year') {
      return y === selectedYear
    }
    return true
  })

  const totalExpense = filteredTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount), 0)

  const totalIncome = filteredTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount), 0)

  const balance = totalIncome - totalExpense

  const categoryStats = filteredTransactions
    .filter(t => t.type === type)
    .reduce((acc: Record<string, number>, curr) => {
      acc[curr.category] = (acc[curr.category] || 0) + Number(curr.amount)
      return acc
    }, {})

  const categoryEntries = Object.entries(categoryStats).sort((a, b) => b[1] - a[1])
  const currentTotalType = type === 'expense' ? totalExpense : totalIncome
  const currentCategories = type === 'expense' ? expenseCats : incomeCats

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 pb-12">
      
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/')}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition cursor-pointer"
              title="Quay lại Thư viện ảnh"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-bold text-lg text-slate-900 tracking-tight flex items-center gap-2">
                <Wallet className="w-5 h-5 text-orange-500" />
                Sổ Quản Lý Thu Chi Cá Nhân
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Xuất Excel / CSV</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Nhập CSV / Excel</span>
            </button>

            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImportExcel} 
              accept=".csv, .xlsx, .xls" 
              className="hidden" 
            />
          </div>
        </div>
      </header>

      {/* Main Content Dashboard */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tổng Thu Nhập</p>
              <h3 className="text-xl sm:text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(totalIncome)}</h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <ArrowUpRight className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tổng Chi Tiêu</p>
              <h3 className="text-xl sm:text-2xl font-bold text-red-600 mt-1">{formatCurrency(totalExpense)}</h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600">
              <ArrowDownLeft className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Số Dư Tích Lũy</p>
              <h3 className={`text-xl sm:text-2xl font-bold mt-1 ${balance >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
                {formatCurrency(balance)}
              </h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* CỘT TRÁI: FORM NHẬP KHOẢN THU / CHI */}
          <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
                <h2 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-orange-500" />
                  Nhập Khoản Mới
                </h2>

                <div className="flex items-center bg-slate-100 p-1 rounded-full">
                  <button
                    type="button"
                    onClick={() => { setType('expense'); setSelectedCategory('Ăn uống'); }}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                      type === 'expense'
                        ? 'bg-[#ffe8d6] text-[#e8590c] shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Tiền chi
                  </button>
                  <button
                    type="button"
                    onClick={() => { setType('income'); setSelectedCategory('Tiền lương'); }}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                      type === 'income'
                        ? 'bg-[#e6fcf5] text-[#0ca678] shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Tiền thu
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                {/* Ngày */}
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700 w-16">Ngày</span>
                  <div className="flex-1 flex items-center justify-between bg-[#fff9db] border border-[#ffe066] px-3 py-2 rounded-xl font-semibold text-slate-800">
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
                <div className="flex items-center">
                  <span className="font-semibold text-slate-700 w-16">Ghi chú</span>
                  <input 
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Nhập nội dung chi tiết..."
                    className="flex-1 py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-orange-500 text-slate-800"
                  />
                </div>

                {/* Số tiền */}
                <div className="flex items-center">
                  <span className="font-semibold text-slate-700 w-16">
                    {type === 'expense' ? 'Tiền chi' : 'Tiền thu'}
                  </span>
                  <div className="flex-1 flex items-center bg-[#fff4e6] border border-[#ffd8a8] px-3.5 py-2.5 rounded-xl font-bold text-slate-900">
                    <input 
                      type="text"
                      value={amountStr}
                      onChange={(e) => {
                        const clean = e.target.value.replace(/\D/g, '')
                        setAmountStr(clean ? Number(clean).toLocaleString('vi-VN') : '')
                      }}
                      placeholder="0"
                      className="w-full bg-transparent outline-none text-base font-bold text-slate-900"
                    />
                    <span className="ml-1 text-slate-500 text-sm">đ</span>
                  </div>
                </div>

                {/* Danh mục + Nút Thêm danh mục */}
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-700">Chọn Danh Mục:</span>
                    <button
                      type="button"
                      onClick={() => setIsAddingCat(!isAddingCat)}
                      className="text-orange-600 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Thêm danh mục</span>
                    </button>
                  </div>

                  {/* Form thêm danh mục nhanh */}
                  {isAddingCat && (
                    <div className="mb-3 p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-2">
                      <input 
                        type="text" 
                        value={newCatName} 
                        onChange={(e) => setNewCatName(e.target.value)} 
                        placeholder="Tên danh mục mới..."
                        className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none text-xs"
                      />
                      <button 
                        type="button" 
                        onClick={handleAddCategory}
                        className="px-3 py-1.5 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 cursor-pointer flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Thêm</span>
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setIsAddingCat(false)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* Lưới danh mục */}
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-56 overflow-y-auto pr-1">
                    {currentCategories.map((cat) => {
                      const isSelected = selectedCategory === cat.name
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setSelectedCategory(cat.name)}
                          className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border text-center transition cursor-pointer ${
                            isSelected 
                              ? 'border-orange-500 bg-orange-50/80 shadow-sm ring-1 ring-orange-500' 
                              : 'border-slate-100 bg-white hover:bg-slate-50'
                          }`}
                        >
                          <Tag className={`w-4 h-4 mb-1 ${cat.color.split(' ')[0]}`} />
                          <span className="text-[10px] font-medium text-slate-700 truncate w-full">
                            {cat.name}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="pt-3">
                  <button
                    type="submit"
                    className={`w-full py-3.5 rounded-2xl font-bold text-white text-sm shadow-md transition active:scale-95 cursor-pointer ${
                      type === 'expense' ? 'bg-[#ff6b00] hover:bg-[#e8590c]' : 'bg-[#0ca678] hover:bg-[#099268]'
                    }`}
                  >
                    {type === 'expense' ? 'Nhập Khoản Chi' : 'Nhập Khoản Thu'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* CỘT PHẢI: THỐNG KÊ BIỂU ĐỒ & LỊCH SỬ GIAO DỊCH */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Box Biểu đồ & Phân loại tỷ trọng */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 mb-5">
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-500" />
                  Biểu Đồ Thống Kê Phân Loại
                </h3>

                {/* Bộ lọc Tháng / Năm / Toàn bộ */}
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                  <button
                    onClick={() => setChartView('month')}
                    className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                      chartView === 'month' ? 'bg-white shadow-sm text-slate-900 font-bold' : 'text-slate-500'
                    }`}
                  >
                    Tháng
                  </button>
                  <button
                    onClick={() => setChartView('year')}
                    className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                      chartView === 'year' ? 'bg-white shadow-sm text-slate-900 font-bold' : 'text-slate-500'
                    }`}
                  >
                    Năm
                  </button>
                  <button
                    onClick={() => setChartView('all')}
                    className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                      chartView === 'all' ? 'bg-white shadow-sm text-slate-900 font-bold' : 'text-slate-500'
                    }`}
                  >
                    Tất cả
                  </button>
                </div>
              </div>

              {categoryEntries.length === 0 ? (
                <p className="text-center py-10 text-xs text-slate-400">Chưa có dữ liệu thống kê trong khoảng thời gian này.</p>
              ) : (
                <div className="space-y-4">
                  {categoryEntries.map(([catName, amount]) => {
                    const percentage = currentTotalType > 0 ? Math.round((amount / currentTotalType) * 100) : 0
                    return (
                      <div key={catName} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-700">{catName}</span>
                          <span className="font-semibold text-slate-900">
                            {formatCurrency(amount)} ({percentage}%)
                          </span>
                        </div>
                        {/* Thanh progress bar */}
                        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              type === 'expense' ? 'bg-orange-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Box Lịch sử giao dịch */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-emerald-500" />
                  Lịch Sử Giao Dịch ({filteredTransactions.length})
                </h3>
              </div>

              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {filteredTransactions.length === 0 ? (
                  <p className="text-center py-10 text-xs text-slate-400">Chưa có giao dịch nào.</p>
                ) : (
                  filteredTransactions.map((t) => (
                    <div 
                      key={t.id} 
                      className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{t.category}</span>
                          <span className="text-[10px] text-slate-400 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                            {t.date}
                          </span>
                        </div>
                        {t.note && <p className="text-[11px] text-slate-500 mt-1">{t.note}</p>}
                      </div>

                      <div className="flex items-center gap-3">
                        <span className={`font-bold text-sm ${t.type === 'expense' ? 'text-red-500' : 'text-emerald-600'}`}>
                          {t.type === 'expense' ? '-' : '+'}{Number(t.amount).toLocaleString('vi-VN')} đ
                        </span>
                        <button
                          onClick={() => handleDelete(t.id)}
                          className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-white rounded-lg transition cursor-pointer"
                          title="Xóa dòng này"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

        </div>

      </main>

    </div>
  )
}
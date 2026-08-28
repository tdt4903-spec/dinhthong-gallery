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
  ArrowDownLeft, BarChart3, TrendingUp, Tag, X, Check,
  ChevronDown, ChevronUp, PieChart, Layers
} from 'lucide-react'

// Ánh xạ categoryId từ file backup
const CATEGORY_ID_MAP: Record<number, string> = {
  1: 'Ăn uống',
  2: 'Chi tiêu hàng ngày',
  3: 'Quần áo',
  4: 'Mỹ phẩm',
  5: 'Phí giao lưu',
  6: 'Y tế',
  7: 'Giáo dục',
  8: 'Tiền điện',
  9: 'Đi lại',
  10: 'Phí liên lạc',
  11: 'Tiền nhà',
  12: 'Tiền lương',
  13: 'Công việc',
  14: 'Quà cáp',
  15: 'Đặt mb hộ',
  16: 'Mua sắm',
  17: 'Bể cá',
  18: 'Xe',
  19: 'Du lịch',
  20: 'Film',
  21: 'Tết',
}

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
  const [currentDateStr, setCurrentDateStr] = useState<string>('2026-08-28')
  const [note, setNote] = useState('')
  const [amountStr, setAmountStr] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('Ăn uống')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  
  // Quản lý danh mục
  const [expenseCats, setExpenseCats] = useState(INITIAL_EXPENSE_CATS)
  const [incomeCats, setIncomeCats] = useState(INITIAL_INCOME_CATS)
  const [newCatName, setNewCatName] = useState('')
  const [isAddingCat, setIsAddingCat] = useState(false)

  // 1. Nút tổng hợp thu nhập gom lại trong 1 dropdown
  const [showSummaryDropdown, setShowSummaryDropdown] = useState(false)

  // 2. Chỗ biểu đồ có 2 mục: Thống kê & Phân loại
  const [chartSubTab, setChartSubTab] = useState<'stats' | 'category'>('stats')
  const [chartPeriod, setChartPeriod] = useState<'month' | 'year' | 'all'>('month')

  // 3. Phân loại Lịch sử theo Tháng / Năm
  const [historyGroupType, setHistoryGroupType] = useState<'month' | 'year'>('month')

  const [isDeletingAll, setIsDeletingAll] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dateInputRef = useRef<HTMLInputElement>(null)

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

  const formatDateDisplay = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split('-').map(Number)
      const dateObj = new Date(y, m - 1, d)
      const daysOfWeek = ['CN', 'Th 2', 'Th 3', 'Th 4', 'Th 5', 'Th 6', 'Th 7']
      const dayName = daysOfWeek[dateObj.getDay()]
      return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y} (${dayName})`
    } catch {
      return dateStr
    }
  }

  const formatCurrency = (val: number) => {
    return val.toLocaleString('vi-VN') + ' đ'
  }

  const handlePrevDay = () => {
    const [y, m, d] = currentDateStr.split('-').map(Number)
    const dt = new Date(y, m - 1, d)
    dt.setDate(dt.getDate() - 1)
    const yStr = dt.getFullYear()
    const mStr = String(dt.getMonth() + 1).padStart(2, '0')
    const dStr = String(dt.getDate()).padStart(2, '0')
    setCurrentDateStr(`${yStr}-${mStr}-${dStr}`)
  }

  const handleNextDay = () => {
    const [y, m, d] = currentDateStr.split('-').map(Number)
    const dt = new Date(y, m - 1, d)
    dt.setDate(dt.getDate() + 1)
    const yStr = dt.getFullYear()
    const mStr = String(dt.getMonth() + 1).padStart(2, '0')
    const dStr = String(dt.getDate()).padStart(2, '0')
    setCurrentDateStr(`${yStr}-${mStr}-${dStr}`)
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
      date: currentDateStr
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

  const handleDeleteAll = async () => {
    if (transactions.length === 0) {
      alert('Hiện chưa có dữ liệu nào trong sổ để xóa!')
      return
    }

    const confirm1 = confirm(`CẢNH BÁO: Bạn có chắc muốn XÓA TOÀN BỘ ${transactions.length} giao dịch đã nhập?`)
    if (!confirm1) return
    const confirm2 = confirm('Hành động này KHÔNG THỂ HOÀN TÁC. Bạn có thực sự muốn xóa sạch?')
    if (!confirm2) return

    setIsDeletingAll(true)
    try {
      const { error } = await supabase.from('transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      if (!error) {
        setTransactions([])
        alert('Đã xóa toàn bộ dữ liệu thành công!')
      } else {
        alert('Lỗi khi xóa dữ liệu: ' + error.message)
      }
    } catch (e: any) {
      alert('Lỗi: ' + e.message)
    } finally {
      setIsDeletingAll(false)
    }
  }

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string
        if (!text) return

        let cleanCSV = text
        const headerMarker = 'inputDateString,amount,memo'
        const headerIndex = text.indexOf(headerMarker)
        if (headerIndex !== -1) {
          cleanCSV = text.substring(headerIndex)
        }

        const workbook = XLSX.read(cleanCSV, { type: 'string', raw: true })
        const sheetName = workbook.SheetNames[0]
        const dataRows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' })

        const formattedToInsert: any[] = []

        for (const row of dataRows) {
          if (row['inputDateString'] === undefined || row['amount'] === undefined) continue

          const rawDate = String(row['inputDateString']).trim()
          const rawAmount = String(row['amount']).trim()
          const rawMemo = String(row['memo'] || '').replace(/[\n\r]/g, ' ').trim()
          const rawCatId = Number(row['categoryId'] || 1)
          const rawType = String(row['type']).trim()

          const numAmount = Number(rawAmount)
          if (!numAmount || isNaN(numAmount)) continue

          let formattedDate = currentDateStr
          const dParts = rawDate.split('/')
          if (dParts.length === 3) {
            const y = dParts[0]
            const m = dParts[1].padStart(2, '0')
            const d = dParts[2].padStart(2, '0')
            formattedDate = `${y}-${m}-${d}`
          } else if (rawDate.includes('-')) {
            formattedDate = rawDate.split('T')[0]
          }

          const isIncome = rawType === '1'
          const categoryName = CATEGORY_ID_MAP[rawCatId] || (isIncome ? 'Tiền lương' : 'Ăn uống')

          formattedToInsert.push({
            type: isIncome ? 'income' : 'expense',
            amount: numAmount,
            category: categoryName,
            note: rawMemo,
            date: formattedDate
          })
        }

        if (formattedToInsert.length === 0) {
          alert('Không tìm thấy dòng dữ liệu hợp lệ trong file Backup!')
          return
        }

        const CHUNK_SIZE = 200
        for (let i = 0; i < formattedToInsert.length; i += CHUNK_SIZE) {
          const chunk = formattedToInsert.slice(i, i + CHUNK_SIZE)
          await supabase.from('transactions').insert(chunk)
        }

        alert(`Đã nhập thành công ${formattedToInsert.length} giao dịch!`)
        fetchTransactions()
      } catch (err: any) {
        alert('Lỗi xử lý file: ' + err.message)
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    }
    reader.readAsText(file, 'UTF-8')
  }

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
    XLSX.writeFile(workbook, `Bao_Cao_Thu_Chi_${currentDateStr}.xlsx`)
  }

  // Tính tổng
  const totalAllExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0)
  const totalAllIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0)
  const totalBalance = totalAllIncome - totalAllExpense

  // Lọc cho Biểu đồ
  const chartFiltered = transactions.filter(t => {
    if (!t.date) return false
    const [y, m] = t.date.split('-').map(Number)
    const [curY, curM] = currentDateStr.split('-').map(Number)
    if (chartPeriod === 'month') return y === curY && m === curM
    if (chartPeriod === 'year') return y === curY
    return true
  })

  const chartExpense = chartFiltered.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const chartIncome = chartFiltered.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)

  // Gom phân loại danh mục
  const catStats = chartFiltered
    .filter(t => t.type === type)
    .reduce((acc: Record<string, number>, curr) => {
      acc[curr.category] = (acc[curr.category] || 0) + Number(curr.amount)
      return acc
    }, {})
  const catEntries = Object.entries(catStats).sort((a, b) => b[1] - a[1])
  const currentTotalCatType = type === 'expense' ? chartExpense : chartIncome

  // Gom lịch sử theo Tháng hoặc Năm
  const groupedHistory = transactions.reduce((acc: Record<string, Transaction[]>, curr) => {
    const [y, m] = (curr.date || '2026-08-28').split('-')
    const key = historyGroupType === 'month' ? `Tháng ${m}/${y}` : `Năm ${y}`
    if (!acc[key]) acc[key] = []
    acc[key].push(curr)
    return acc
  }, {})

  const currentCategories = type === 'expense' ? expenseCats : incomeCats

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 pb-12">
      
      {/* Navbar Header */}
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
            <h1 className="font-bold text-lg text-slate-900 tracking-tight flex items-center gap-2">
              <Wallet className="w-5 h-5 text-orange-500" />
              Sổ Quản Lý Thu Chi Cá Nhân
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {/* NÚT GOM TỔNG THU NHẬP / CHI TIÊU DROPDOWN */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSummaryDropdown(!showSummaryDropdown)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 transition cursor-pointer border border-slate-200 shadow-sm"
              >
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span>Tổng quan số dư: <strong className="text-emerald-600">{formatCurrency(totalBalance)}</strong></span>
                {showSummaryDropdown ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showSummaryDropdown && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 p-4 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-xs font-bold text-slate-700">Chi tiết tài chính</span>
                    <span className="text-[10px] text-slate-400">Toàn thời gian</span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-emerald-600 font-semibold">
                      <ArrowUpRight className="w-3.5 h-3.5" /> Tổng Thu Nhập:
                    </span>
                    <strong className="text-emerald-600 font-bold">{formatCurrency(totalAllIncome)}</strong>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-red-500 font-semibold">
                      <ArrowDownLeft className="w-3.5 h-3.5" /> Tổng Chi Tiêu:
                    </span>
                    <strong className="text-red-600 font-bold">{formatCurrency(totalAllExpense)}</strong>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-800">Số Dư Tích Lũy:</span>
                    <span className={totalBalance >= 0 ? 'text-slate-900 font-extrabold' : 'text-rose-600'}>
                      {formatCurrency(totalBalance)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Xuất Excel</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Nhập File</span>
            </button>

            <button
              onClick={handleDeleteAll}
              disabled={isDeletingAll || transactions.length === 0}
              className="p-2 rounded-xl text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition cursor-pointer disabled:opacity-50"
              title="Xóa tất cả các khoản đã nhập"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImportCSV} 
              accept=".csv, .txt, .xlsx" 
              className="hidden" 
            />
          </div>
        </div>
      </header>

      {/* Main Content Dashboard */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* CỘT TRÁI: FORM NHẬP KHOẢN MỚI */}
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
                {/* Chọn ngày + Lịch trực tiếp */}
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700 w-16">Ngày</span>
                  <div className="flex-1 flex items-center justify-between bg-[#fff9db] border border-[#ffe066] px-3 py-2 rounded-xl font-semibold text-slate-800 relative">
                    <button type="button" onClick={handlePrevDay} className="p-0.5 hover:text-orange-600 cursor-pointer">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    
                    {/* Bấm vào để mở bộ chọn lịch Native */}
                    <div 
                      onClick={() => dateInputRef.current?.showPicker ? dateInputRef.current.showPicker() : dateInputRef.current?.focus()}
                      className="flex items-center gap-1.5 cursor-pointer hover:text-orange-600 transition"
                      title="Bấm để chọn lịch"
                    >
                      <Calendar className="w-4 h-4 text-orange-500" />
                      <span>{formatDateDisplay(currentDateStr)}</span>
                      <input 
                        type="date" 
                        ref={dateInputRef}
                        value={currentDateStr}
                        onChange={(e) => e.target.value && setCurrentDateStr(e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                    </div>

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

                {/* Danh mục */}
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

          {/* CỘT PHẢI: BIỂU ĐỒ (2 MỤC: THỐNG KÊ & PHÂN LOẠI) + LỊCH SỬ (PHÂN LOẠI THEO THÁNG/NĂM) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* BOX BIỂU ĐỒ: 2 TAB THỐNG KÊ & PHÂN LOẠI */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 mb-5">
                
                {/* 2 Tab: Thống kê / Phân loại */}
                <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                  <button
                    onClick={() => setChartSubTab('stats')}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      chartSubTab === 'stats' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'
                    }`}
                  >
                    <BarChart3 className="w-4 h-4" />
                    <span>Thống kê</span>
                  </button>
                  <button
                    onClick={() => setChartSubTab('category')}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      chartSubTab === 'category' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'
                    }`}
                  >
                    <PieChart className="w-4 h-4" />
                    <span>Phân loại</span>
                  </button>
                </div>

                {/* Bộ lọc Tháng / Năm / Toàn bộ */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                  <button
                    onClick={() => setChartPeriod('month')}
                    className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                      chartPeriod === 'month' ? 'bg-white shadow-sm text-slate-900 font-bold' : 'text-slate-500'
                    }`}
                  >
                    Tháng này
                  </button>
                  <button
                    onClick={() => setChartPeriod('year')}
                    className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                      chartPeriod === 'year' ? 'bg-white shadow-sm text-slate-900 font-bold' : 'text-slate-500'
                    }`}
                  >
                    Năm này
                  </button>
                  <button
                    onClick={() => setChartPeriod('all')}
                    className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                      chartPeriod === 'all' ? 'bg-white shadow-sm text-slate-900 font-bold' : 'text-slate-500'
                    }`}
                  >
                    Tất cả
                  </button>
                </div>
              </div>

              {/* NỘI DUNG 1: THỐNG KÊ THU / CHI TỔNG QUAN */}
              {chartSubTab === 'stats' ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
                      <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-bold mb-1">
                        <ArrowUpRight className="w-4 h-4" />
                        <span>Tổng Thu Kỳ Này</span>
                      </div>
                      <p className="text-lg sm:text-xl font-extrabold text-emerald-700">{formatCurrency(chartIncome)}</p>
                    </div>

                    <div className="p-4 bg-red-50 border border-red-100 rounded-2xl">
                      <div className="flex items-center gap-1.5 text-red-600 text-xs font-bold mb-1">
                        <ArrowDownLeft className="w-4 h-4" />
                        <span>Tổng Chi Kỳ Này</span>
                      </div>
                      <p className="text-lg sm:text-xl font-extrabold text-red-700">{formatCurrency(chartExpense)}</p>
                    </div>
                  </div>

                  <div className="pt-2">
                    <div className="flex items-center justify-between text-xs font-semibold mb-2">
                      <span className="text-slate-600">Tỷ lệ Thu / Chi:</span>
                      <span className="text-slate-800">
                        {chartIncome + chartExpense > 0 
                          ? `${Math.round((chartIncome / (chartIncome + chartExpense)) * 100)}% Thu - ${Math.round((chartExpense / (chartIncome + chartExpense)) * 100)}% Chi` 
                          : '0%'}
                      </span>
                    </div>
                    <div className="w-full h-4 bg-red-400 rounded-full overflow-hidden flex">
                      <div 
                        className="h-full bg-emerald-500 transition-all duration-500" 
                        style={{ width: `${chartIncome + chartExpense > 0 ? (chartIncome / (chartIncome + chartExpense)) * 100 : 50}%` }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                /* NỘI DUNG 2: PHÂN LOẠI TỶ TRỌNG DANH MỤC */
                <div className="space-y-3.5 max-h-72 overflow-y-auto pr-1">
                  {catEntries.length === 0 ? (
                    <p className="text-center py-8 text-xs text-slate-400">Chưa có giao dịch danh mục trong kỳ này.</p>
                  ) : (
                    catEntries.map(([catName, amount]) => {
                      const percentage = currentTotalCatType > 0 ? Math.round((amount / currentTotalCatType) * 100) : 0
                      return (
                        <div key={catName} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-700">{catName}</span>
                            <span className="font-semibold text-slate-900">
                              {formatCurrency(amount)} ({percentage}%)
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${
                                type === 'expense' ? 'bg-orange-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>

            {/* BOX LỊCH SỬ GIAO DỊCH (GOM NHÓM THEO THÁNG / NĂM) */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-emerald-500" />
                  <h3 className="font-bold text-base text-slate-900">
                    Lịch Sử Giao Dịch ({transactions.length})
                  </h3>
                </div>

                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                  <button
                    onClick={() => setHistoryGroupType('month')}
                    className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                      historyGroupType === 'month' ? 'bg-white shadow-sm text-slate-900 font-bold' : 'text-slate-500'
                    }`}
                  >
                    Theo Tháng
                  </button>
                  <button
                    onClick={() => setHistoryGroupType('year')}
                    className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                      historyGroupType === 'year' ? 'bg-white shadow-sm text-slate-900 font-bold' : 'text-slate-500'
                    }`}
                  >
                    Theo Năm
                  </button>
                </div>
              </div>

              <div className="space-y-6 max-h-96 overflow-y-auto pr-1">
                {Object.keys(groupedHistory).length === 0 ? (
                  <p className="text-center py-10 text-xs text-slate-400">Chưa có giao dịch nào.</p>
                ) : (
                  Object.entries(groupedHistory).map(([groupTitle, items]) => {
                    const groupExpense = items.filter(i => i.type === 'expense').reduce((s, i) => s + Number(i.amount), 0)
                    const groupIncome = items.filter(i => i.type === 'income').reduce((s, i) => s + Number(i.amount), 0)

                    return (
                      <div key={groupTitle} className="space-y-2">
                        {/* Tiêu đề nhóm Tháng/Năm */}
                        <div className="flex items-center justify-between bg-slate-100/80 px-3.5 py-2 rounded-xl text-xs">
                          <span className="font-bold text-slate-800 flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-indigo-500" />
                            {groupTitle} ({items.length})
                          </span>
                          <div className="flex items-center gap-3 text-[11px] font-semibold">
                            <span className="text-emerald-600">+{formatCurrency(groupIncome)}</span>
                            <span className="text-red-500">-{formatCurrency(groupExpense)}</span>
                          </div>
                        </div>

                        {/* Danh sách các dòng trong nhóm */}
                        <div className="space-y-1.5 pl-1">
                          {items.map((t) => (
                            <div 
                              key={t.id} 
                              className="flex items-center justify-between p-3 rounded-2xl border border-slate-100 bg-white hover:bg-slate-50/80 transition text-xs shadow-2xs"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-900">{t.category}</span>
                                  <span className="text-[10px] text-slate-400 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md">
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
                                  className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                                  title="Xóa giao dịch này"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

          </div>

        </div>
      </main>

    </div>
  )
}
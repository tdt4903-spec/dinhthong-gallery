'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
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
  ChevronDown, ChevronUp, PieChart, Layers, Filter, Loader2, LogOut, User as UserIcon,
  Sparkles, RotateCcw, PenSquare, History
} from 'lucide-react'

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

const QUICK_AMOUNT_PRESETS = [
  { label: '+10k', val: 10000 },
  { label: '+20k', val: 20000 },
  { label: '+50k', val: 50000 },
  { label: '+100k', val: 100000 },
  { label: '+200k', val: 200000 },
  { label: '+500k', val: 500000 },
  { label: '+1 Tr', val: 1000000 },
  { label: '+2 Tr', val: 2000000 },
  { label: '+5 Tr', val: 5000000 },
  { label: '+10 Tr', val: 10000000 },
]

function readVietnameseNumber(number: number): string {
  if (!number || isNaN(number) || number <= 0) return ''
  const units = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ']
  const digits = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín']

  function readGroup(group: number, full: boolean = false): string {
    const a = Math.floor(group / 100)
    const b = Math.floor((group % 100) / 10)
    const c = group % 10
    let res = ''
    if (a > 0 || full) res += digits[a] + ' trăm '
    if (b > 1) res += digits[b] + ' mươi '
    else if (b === 1) res += 'mười '
    else if (a > 0 && c > 0) res += 'lẻ '
    if (b > 1 && c === 1) res += 'mốt'
    else if (b > 0 && c === 5) res += 'lăm'
    else if (c > 0 || (a === 0 && b === 0 && group === 0)) res += digits[c]
    return res.trim()
  }

  const s = Math.floor(number).toString()
  const groups: number[] = []
  for (let i = s.length; i > 0; i -= 3) {
    groups.push(parseInt(s.substring(Math.max(0, i - 3), i), 10))
  }

  let result = ''
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i] > 0) {
      const gStr = readGroup(groups[i], i < groups.length - 1)
      result += gStr + ' ' + units[i] + ' '
    }
  }

  result = result.trim()
  if (!result) return ''
  return result.charAt(0).toUpperCase() + result.slice(1) + ' đồng'
}

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
  const [user, setUser] = useState<any>(null)
  const [authLoading, setAuthLoading] = useState(true)

  // Mobile active tab: 'input' | 'charts' | 'history'
  const [mobileTab, setMobileTab] = useState<'input' | 'charts' | 'history'>('input')

  const [type, setType] = useState<'expense' | 'income'>('expense')
  const [currentDateStr, setCurrentDateStr] = useState<string>('2026-08-28')
  const [note, setNote] = useState('')
  const [amountStr, setAmountStr] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('Ăn uống')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  
  const [expenseCats, setExpenseCats] = useState(INITIAL_EXPENSE_CATS)
  const [incomeCats, setIncomeCats] = useState(INITIAL_INCOME_CATS)
  const [newCatName, setNewCatName] = useState('')
  const [isAddingCat, setIsAddingCat] = useState(false)

  const [showSummaryDropdown, setShowSummaryDropdown] = useState(false)

  const [chartSubTab, setChartSubTab] = useState<'stats' | 'category'>('stats')
  const [chartPeriodMode, setChartPeriodMode] = useState<'year' | 'month' | 'all'>('year')
  const [chartSelectedYear, setChartSelectedYear] = useState<number>(2026)
  const [chartSelectedMonth, setChartSelectedMonth] = useState<number>(8)

  const [historyFilterYear, setHistoryFilterYear] = useState<string>('all')
  const [historyFilterMonth, setHistoryFilterMonth] = useState<string>('all')
  const [historyGroupType, setHistoryGroupType] = useState<'month' | 'year'>('month')

  const [isDeletingAll, setIsDeletingAll] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dateInputRef = useRef<HTMLInputElement>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (!data.session) {
          router.replace('/')
          return
        }

        const loggedInEmail = data.session.user.email
        const { data: whitelist, error } = await supabase
          .from('allowed_emails')
          .select('email')
          .eq('email', loggedInEmail)
          .single()

        if (error || !whitelist) {
          alert('Tài khoản của bạn không có quyền truy cập vào mục Thu Chi!')
          await supabase.auth.signOut()
          router.replace('/')
          return
        }

        setUser(data.session.user)
        setAuthLoading(false)
        fetchTransactions()
      } catch {
        router.replace('/')
      }
    }

    checkAuth()
  }, [router, supabase])

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

  const noteSuggestions = useMemo(() => {
    const setNotes = new Set<string>()
    transactions
      .filter(t => t.category === selectedCategory && t.note)
      .slice(0, 20)
      .forEach(t => setNotes.add(t.note))
    return Array.from(setNotes).slice(0, 5)
  }, [transactions, selectedCategory])

  const availableYears = useMemo(() => {
    const yearSet = new Set<number>()
    yearSet.add(2026)
    transactions.forEach(t => {
      if (t.date) {
        const y = Number(t.date.split('-')[0])
        if (y) yearSet.add(y)
      }
    })
    return Array.from(yearSet).sort((a, b) => b - a)
  }, [transactions])

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

  const numericAmount = useMemo(() => {
    return Number(amountStr.replace(/\D/g, '')) || 0
  }, [amountStr])

  const amountInWords = useMemo(() => {
    return readVietnameseNumber(numericAmount)
  }, [numericAmount])

  const handleAddQuickAmount = (val: number) => {
    const current = Number(amountStr.replace(/\D/g, '')) || 0
    const nextVal = current + val
    setAmountStr(nextVal.toLocaleString('vi-VN'))
  }

  const handleClearAmount = () => {
    setAmountStr('')
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
      alert('Đã lưu thành công!')
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

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.replace('/')
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0f1115] flex flex-col items-center justify-center text-white">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mb-3" />
        <p className="text-xs font-light text-white/70 tracking-widest uppercase">Đang kiểm tra quyền truy cập</p>
      </div>
    )
  }

  const totalAllExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0)
  const totalAllIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0)
  const totalBalance = totalAllIncome - totalAllExpense

  const chartFiltered = transactions.filter(t => {
    if (!t.date) return false
    const [y, m] = t.date.split('-').map(Number)
    if (chartPeriodMode === 'month') {
      return y === chartSelectedYear && m === chartSelectedMonth
    }
    if (chartPeriodMode === 'year') {
      return y === chartSelectedYear
    }
    return true
  })

  const chartExpense = chartFiltered.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const chartIncome = chartFiltered.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const chartRemaining = chartIncome - chartExpense

  const catStats = chartFiltered
    .filter(t => t.type === type)
    .reduce((acc: Record<string, number>, curr) => {
      acc[curr.category] = (acc[curr.category] || 0) + Number(curr.amount)
      return acc
    }, {})
  const catEntries = Object.entries(catStats).sort((a, b) => b[1] - a[1])
  const currentTotalCatType = type === 'expense' ? chartExpense : chartIncome

  const historyFiltered = transactions.filter(t => {
    if (!t.date) return false
    const [y, m] = t.date.split('-').map(Number)
    if (historyFilterYear !== 'all' && y !== Number(historyFilterYear)) return false
    if (historyFilterMonth !== 'all' && m !== Number(historyFilterMonth)) return false
    return true
  })

  const groupedHistory = historyFiltered.reduce((acc: Record<string, Transaction[]>, curr) => {
    const [y, m] = (curr.date || '2026-08-28').split('-')
    const key = historyGroupType === 'month' ? `Tháng ${m}/${y}` : `Năm ${y}`
    if (!acc[key]) acc[key] = []
    acc[key].push(curr)
    return acc
  }, {})

  const currentCategories = type === 'expense' ? expenseCats : incomeCats

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 pb-28 sm:pb-12">
      
      {/* Header Sticky */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 shadow-2xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
          
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => router.push('/gallery')}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition cursor-pointer"
              title="Quay lại Thư viện ảnh"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <h1 className="font-bold text-sm sm:text-lg text-slate-900 tracking-tight flex items-center gap-1.5 truncate">
              <Wallet className="w-4 h-4 text-orange-500 flex-shrink-0" />
              <span className="truncate">Sổ Thu Chi</span>
            </h1>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Nút tóm tắt số dư */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSummaryDropdown(!showSummaryDropdown)}
                className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 transition cursor-pointer border border-slate-200"
              >
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                <span className="max-w-[100px] sm:max-w-none truncate">{formatCurrency(totalBalance)}</span>
                {showSummaryDropdown ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              {showSummaryDropdown && (
                <div className="absolute right-0 mt-2 w-64 sm:w-72 bg-white rounded-2xl shadow-xl border border-slate-200 p-4 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="font-bold text-slate-700">Chi tiết tài chính</span>
                    <span className="text-[10px] text-slate-400">Lũy kế</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                      <ArrowUpRight className="w-3.5 h-3.5" /> Tổng Thu:
                    </span>
                    <strong className="text-emerald-600 font-bold">{formatCurrency(totalAllIncome)}</strong>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-red-500 font-semibold">
                      <ArrowDownLeft className="w-3.5 h-3.5" /> Tổng Chi:
                    </span>
                    <strong className="text-red-600 font-bold">{formatCurrency(totalAllExpense)}</strong>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between font-bold">
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
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Xuất Excel</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Nhập File</span>
            </button>

            <button
              onClick={handleDeleteAll}
              disabled={isDeletingAll || transactions.length === 0}
              className="p-1.5 sm:p-2 rounded-xl text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition cursor-pointer disabled:opacity-50"
              title="Xóa tất cả các khoản đã nhập"
            >
              <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImportCSV} 
              accept=".csv, .txt, .xlsx" 
              className="hidden" 
            />

            <div className="flex items-center gap-1.5 pl-1.5 border-l border-slate-200">
              {user?.user_metadata?.avatar_url ? (
                <img 
                  src={user.user_metadata.avatar_url} 
                  alt="Avatar" 
                  className="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover border border-emerald-500/50"
                  title={user.email}
                />
              ) : (
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center text-[10px] font-bold">
                  <UserIcon className="w-3 h-3" />
                </div>
              )}
              <button
                onClick={handleSignOut}
                className="p-1 text-slate-400 hover:text-red-500 transition cursor-pointer"
                title="Đăng xuất"
              >
                <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Dashboard */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
          
          {/* CỘT TRÁI: FORM NHẬP KHOẢN MỚI */}
          <div className={`lg:col-span-5 bg-white p-4 sm:p-7 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between ${mobileTab !== 'input' ? 'hidden lg:flex' : 'flex'}`}>
            <div>
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-4 sm:mb-5">
                <h2 className="font-bold text-sm sm:text-base text-slate-900 flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-orange-500" />
                  Nhập Khoản Mới
                </h2>

                <div className="flex items-center bg-slate-100 p-1 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => { setType('expense'); setSelectedCategory('Ăn uống'); }}
                    className={`px-4 sm:px-5 py-1.5 sm:py-2 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                      type === 'expense'
                        ? 'bg-[#ffe8d6] text-[#e8590c] shadow-sm ring-1 ring-[#ffd8a8]'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Tiền chi
                  </button>
                  <button
                    type="button"
                    onClick={() => { setType('income'); setSelectedCategory('Tiền lương'); }}
                    className={`px-4 sm:px-5 py-1.5 sm:py-2 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                      type === 'income'
                        ? 'bg-[#e6fcf5] text-[#0ca678] shadow-sm ring-1 ring-[#b2f2bb]'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Tiền thu
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-4">
                
                {/* 1. Chọn ngày qua lịch */}
                <div>
                  <label className="block text-[11px] sm:text-xs font-bold text-slate-700 mb-1">Ngày thực hiện:</label>
                  <div className="flex items-center justify-between bg-[#fff9db]/90 border border-[#ffe066] px-3.5 py-2.5 sm:py-3 rounded-2xl font-bold text-slate-800 relative shadow-2xs">
                    <button type="button" onClick={handlePrevDay} className="p-1 hover:text-orange-600 cursor-pointer">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    
                    <div 
                      onClick={() => dateInputRef.current?.showPicker ? dateInputRef.current.showPicker() : dateInputRef.current?.focus()}
                      className="flex items-center gap-1.5 cursor-pointer hover:text-orange-600 transition"
                      title="Bấm để chọn lịch"
                    >
                      <Calendar className="w-4 h-4 text-orange-500 flex-shrink-0" />
                      <span className="text-xs sm:text-sm font-bold">{formatDateDisplay(currentDateStr)}</span>
                      <input 
                        type="date" 
                        ref={dateInputRef}
                        value={currentDateStr}
                        onChange={(e) => e.target.value && setCurrentDateStr(e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                    </div>

                    <button type="button" onClick={handleNextDay} className="p-1 hover:text-orange-600 cursor-pointer">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* 2. Ô GHI CHÚ */}
                <div>
                  <label className="block text-[11px] sm:text-xs font-bold text-slate-700 mb-1">Nội dung chi tiết (Ghi chú):</label>
                  <input 
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Ví dụ: Ăn sáng, Mua cafe, Đổ xăng..."
                    className="w-full py-2.5 sm:py-3.5 px-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-orange-500 focus:bg-white text-xs sm:text-sm font-medium text-slate-900 shadow-2xs transition"
                  />

                  {/* Gợi ý các nội dung trước đó */}
                  {noteSuggestions.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap mt-1.5">
                      <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-0.5">
                        <Sparkles className="w-2.5 h-2.5 text-amber-500" /> Gợi ý:
                      </span>
                      {noteSuggestions.map((sug, sIdx) => (
                        <button
                          key={sIdx}
                          type="button"
                          onClick={() => setNote(sug)}
                          className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-orange-50 hover:text-orange-600 text-slate-600 text-[10px] font-medium transition cursor-pointer border border-slate-200"
                        >
                          {sug}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3. Ô NHẬP SỐ TIỀN TO LỚN KÈM BÀN PHÍM SỐ */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] sm:text-xs font-bold text-slate-700">
                      {type === 'expense' ? 'Số tiền chi ra:' : 'Số tiền thu vào:'}
                    </label>
                    {numericAmount > 0 && (
                      <button
                        type="button"
                        onClick={handleClearAmount}
                        className="text-[10px] text-red-500 hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        <RotateCcw className="w-2.5 h-2.5" /> Xóa số tiền
                      </button>
                    )}
                  </div>

                  <div className={`flex items-center px-3.5 py-2.5 sm:py-3.5 rounded-2xl border transition shadow-2xs ${
                    type === 'expense'
                      ? 'bg-[#fff4e6] border-[#ffd8a8] focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-200'
                      : 'bg-[#e6fcf5] border-[#b2f2bb] focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-200'
                  }`}>
                    <input 
                      type="text"
                      inputMode="numeric"
                      value={amountStr}
                      onChange={(e) => {
                        const clean = e.target.value.replace(/\D/g, '')
                        setAmountStr(clean ? Number(clean).toLocaleString('vi-VN') : '')
                      }}
                      placeholder="0"
                      className={`w-full bg-transparent outline-none text-xl sm:text-3xl font-extrabold ${
                        type === 'expense' ? 'text-orange-600 placeholder-orange-300' : 'text-emerald-700 placeholder-emerald-300'
                      }`}
                    />
                    <span className="ml-2 font-bold text-base sm:text-lg text-slate-500">đ</span>
                  </div>

                  {/* Hiển thị dịch số thành chữ tiếng Việt */}
                  {amountInWords ? (
                    <div className="mt-1.5 px-2.5 py-1 bg-slate-100 rounded-xl text-[11px] font-semibold text-slate-700 italic border border-slate-200">
                      Bằng chữ: <span className="text-slate-900 font-bold not-italic">{amountInWords}</span>
                    </div>
                  ) : null}

                  {/* CÁC NÚT BẤM GỢI Ý CỘNG TIỀN NHANH */}
                  <div className="mt-2">
                    <p className="text-[10px] font-bold text-slate-500 mb-1">Gợi ý cộng nhanh:</p>
                    <div className="grid grid-cols-5 gap-1">
                      {QUICK_AMOUNT_PRESETS.map((preset, pIdx) => (
                        <button
                          key={pIdx}
                          type="button"
                          onClick={() => handleAddQuickAmount(preset.val)}
                          className="py-1.5 px-0.5 bg-white hover:bg-orange-500 hover:text-white active:bg-orange-600 active:text-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-700 shadow-2xs transition active:scale-95 cursor-pointer text-center"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 4. Danh mục */}
                <div className="pt-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-[11px] sm:text-xs text-slate-700">Chọn Danh Mục:</span>
                    <button
                      type="button"
                      onClick={() => setIsAddingCat(!isAddingCat)}
                      className="text-orange-600 font-bold text-[11px] sm:text-xs flex items-center gap-0.5 hover:underline cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Thêm</span>
                    </button>
                  </div>

                  {isAddingCat && (
                    <div className="mb-2.5 p-2 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-1.5">
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
                        className="px-3 py-1.5 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 cursor-pointer flex items-center gap-1 text-xs shadow-sm"
                      >
                        <Check className="w-3 h-3" />
                        <span>Lưu</span>
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setIsAddingCat(false)}
                        className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-44 sm:max-h-52 overflow-y-auto pr-0.5">
                    {currentCategories.map((cat) => {
                      const isSelected = selectedCategory === cat.name
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setSelectedCategory(cat.name)}
                          className={`flex flex-col items-center justify-center p-2 rounded-2xl border text-center transition cursor-pointer ${
                            isSelected 
                              ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-500 shadow-2xs' 
                              : 'border-slate-100 bg-white hover:bg-slate-50'
                          }`}
                        >
                          <Tag className={`w-3.5 h-3.5 mb-1 ${cat.color.split(' ')[0]}`} />
                          <span className="text-[10px] sm:text-[11px] font-bold text-slate-700 truncate w-full">
                            {cat.name}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className={`w-full py-3.5 sm:py-4 rounded-2xl font-extrabold text-white text-sm sm:text-base shadow-md transition active:scale-95 cursor-pointer ${
                      type === 'expense' 
                        ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-orange-500/20' 
                        : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-emerald-500/20'
                    }`}
                  >
                    {type === 'expense' ? 'Nhập Khoản Chi' : 'Nhập Khoản Thu'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* CỘT PHẢI: BIỂU ĐỒ & LỊCH SỬ GIAO DỊCH */}
          <div className={`lg:col-span-7 space-y-5 sm:space-y-6 ${mobileTab === 'input' ? 'hidden lg:block' : 'block'}`}>
            
            {/* BOX BIỂU ĐỒ */}
            <div className={`bg-white p-4 sm:p-6 rounded-3xl border border-slate-200/80 shadow-sm ${mobileTab === 'history' ? 'hidden lg:block' : 'block'}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3.5 border-b border-slate-100 mb-3.5">
                
                <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                  <button
                    onClick={() => setChartSubTab('stats')}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      chartSubTab === 'stats' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'
                    }`}
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>Thống kê</span>
                  </button>
                  <button
                    onClick={() => setChartSubTab('category')}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      chartSubTab === 'category' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'
                    }`}
                  >
                    <PieChart className="w-3.5 h-3.5" />
                    <span>Phân loại</span>
                  </button>
                </div>

                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold self-start sm:self-auto">
                  <button
                    onClick={() => setChartPeriodMode('month')}
                    className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                      chartPeriodMode === 'month' ? 'bg-white shadow-sm text-slate-900 font-bold' : 'text-slate-500'
                    }`}
                  >
                    Tháng
                  </button>
                  <button
                    onClick={() => setChartPeriodMode('year')}
                    className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                      chartPeriodMode === 'year' ? 'bg-white shadow-sm text-slate-900 font-bold' : 'text-slate-500'
                    }`}
                  >
                    Năm
                  </button>
                  <button
                    onClick={() => setChartPeriodMode('all')}
                    className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                      chartPeriodMode === 'all' ? 'bg-white shadow-sm text-slate-900 font-bold' : 'text-slate-500'
                    }`}
                  >
                    Tất cả
                  </button>
                </div>
              </div>

              {chartPeriodMode !== 'all' && (
                <div className="flex items-center gap-1.5 mb-3.5 bg-slate-50 p-2 rounded-2xl border border-slate-200/80 text-xs">
                  <span className="font-bold text-slate-600 flex items-center gap-1 text-[11px]">
                    <Filter className="w-3 h-3 text-indigo-500" />
                    Kỳ:
                  </span>

                  {chartPeriodMode === 'month' && (
                    <select
                      value={chartSelectedMonth}
                      onChange={(e) => setChartSelectedMonth(Number(e.target.value))}
                      className="bg-white border border-slate-200 px-2 py-1 rounded-xl font-bold text-slate-800 outline-none cursor-pointer text-xs"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <option key={m} value={m}>Tháng {m}</option>
                      ))}
                    </select>
                  )}

                  <select
                    value={chartSelectedYear}
                    onChange={(e) => setChartSelectedYear(Number(e.target.value))}
                    className="bg-white border border-slate-200 px-2 py-1 rounded-xl font-bold text-slate-800 outline-none cursor-pointer text-xs"
                  >
                    {availableYears.map((y) => (
                      <option key={y} value={y}>Năm {y}</option>
                    ))}
                  </select>
                </div>
              )}

              {chartSubTab === 'stats' ? (
                <div className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="p-3 bg-emerald-50/90 border border-emerald-200/80 rounded-2xl flex flex-col justify-between">
                      <div className="flex items-center gap-1 text-emerald-600 text-[11px] font-bold mb-0.5">
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        <span>Tổng Thu</span>
                      </div>
                      <p className="text-sm sm:text-base font-extrabold text-emerald-700 truncate">{formatCurrency(chartIncome)}</p>
                    </div>

                    <div className="p-3 bg-red-50/90 border border-red-200/80 rounded-2xl flex flex-col justify-between">
                      <div className="flex items-center gap-1 text-red-600 text-[11px] font-bold mb-0.5">
                        <ArrowDownLeft className="w-3.5 h-3.5" />
                        <span>Tổng Chi</span>
                      </div>
                      <p className="text-sm sm:text-base font-extrabold text-red-700 truncate">{formatCurrency(chartExpense)}</p>
                    </div>

                    <div className="p-3 bg-blue-50/90 border border-blue-200/80 rounded-2xl flex flex-col justify-between">
                      <div className="flex items-center gap-1 text-blue-600 text-[11px] font-bold mb-0.5">
                        <Wallet className="w-3.5 h-3.5" />
                        <span>Số Dư Còn</span>
                      </div>
                      <p className={`text-sm sm:text-base font-extrabold truncate ${chartRemaining >= 0 ? 'text-blue-700' : 'text-rose-600'}`}>
                        {formatCurrency(chartRemaining)}
                      </p>
                    </div>
                  </div>

                  <div className="pt-1">
                    <div className="flex items-center justify-between text-[11px] font-semibold mb-1.5">
                      <span className="text-slate-600">Tỷ lệ Thu / Chi:</span>
                      <span className="text-slate-800">
                        {chartIncome + chartExpense > 0 
                          ? `${Math.round((chartIncome / (chartIncome + chartExpense)) * 100)}% Thu - ${Math.round((chartExpense / (chartIncome + chartExpense)) * 100)}% Chi` 
                          : '0%'}
                      </span>
                    </div>
                    <div className="w-full h-3 bg-red-400 rounded-full overflow-hidden flex">
                      <div 
                        className="h-full bg-emerald-500 transition-all duration-500" 
                        style={{ width: `${chartIncome + chartExpense > 0 ? (chartIncome / (chartIncome + chartExpense)) * 100 : 50}%` }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 max-h-64 sm:max-h-72 overflow-y-auto pr-0.5">
                  {catEntries.length === 0 ? (
                    <p className="text-center py-6 text-xs text-slate-400">Chưa có giao dịch danh mục trong khoảng thời gian này.</p>
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

            {/* BOX LỊCH SỬ GIAO DỊCH */}
            <div className={`bg-white p-4 sm:p-6 rounded-3xl border border-slate-200/80 shadow-sm ${mobileTab === 'charts' ? 'hidden lg:block' : 'block'}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3.5 border-b border-slate-100 mb-3.5">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <h3 className="font-bold text-sm sm:text-base text-slate-900">
                    Lịch Sử ({historyFiltered.length})
                  </h3>
                </div>

                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold self-start sm:self-auto">
                  <button
                    onClick={() => setHistoryGroupType('month')}
                    className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                      historyGroupType === 'month' ? 'bg-white shadow-sm text-slate-900 font-bold' : 'text-slate-500'
                    }`}
                  >
                    Tháng
                  </button>
                  <button
                    onClick={() => setHistoryGroupType('year')}
                    className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                      historyGroupType === 'year' ? 'bg-white shadow-sm text-slate-900 font-bold' : 'text-slate-500'
                    }`}
                  >
                    Năm
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 mb-3.5 bg-slate-50 p-2 rounded-2xl border border-slate-200/80 text-xs">
                <span className="font-bold text-slate-600 flex items-center gap-0.5 text-[11px]">
                  <Filter className="w-3 h-3 text-emerald-600" />
                  Lọc:
                </span>

                <select
                  value={historyFilterYear}
                  onChange={(e) => setHistoryFilterYear(e.target.value)}
                  className="bg-white border border-slate-200 px-2 py-1 rounded-xl font-bold text-slate-800 outline-none cursor-pointer text-xs"
                >
                  <option value="all">Tất cả năm</option>
                  {availableYears.map((y) => (
                    <option key={y} value={String(y)}>Năm {y}</option>
                  ))}
                </select>

                <select
                  value={historyFilterMonth}
                  onChange={(e) => setHistoryFilterMonth(e.target.value)}
                  className="bg-white border border-slate-200 px-2 py-1 rounded-xl font-bold text-slate-800 outline-none cursor-pointer text-xs"
                >
                  <option value="all">Tất cả tháng</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={String(m)}>Tháng {m}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-4 max-h-80 sm:max-h-96 overflow-y-auto pr-0.5">
                {Object.keys(groupedHistory).length === 0 ? (
                  <p className="text-center py-8 text-xs text-slate-400">Không tìm thấy giao dịch nào.</p>
                ) : (
                  Object.entries(groupedHistory).map(([groupTitle, items]) => {
                    const groupExpense = items.filter(i => i.type === 'expense').reduce((s, i) => s + Number(i.amount), 0)
                    const groupIncome = items.filter(i => i.type === 'income').reduce((s, i) => s + Number(i.amount), 0)

                    return (
                      <div key={groupTitle} className="space-y-1.5">
                        <div className="flex items-center justify-between bg-slate-100/90 px-3 py-1.5 rounded-xl text-xs">
                          <span className="font-bold text-slate-800 flex items-center gap-1 text-[11px]">
                            <Layers className="w-3 h-3 text-indigo-500" />
                            {groupTitle} ({items.length})
                          </span>
                          <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-semibold">
                            <span className="text-emerald-600">+{formatCurrency(groupIncome)}</span>
                            <span className="text-red-500">-{formatCurrency(groupExpense)}</span>
                          </div>
                        </div>

                        <div className="space-y-1 pl-0.5">
                          {items.map((t) => (
                            <div 
                              key={t.id} 
                              className="flex items-center justify-between p-2.5 rounded-2xl border border-slate-100 bg-white hover:bg-slate-50 transition text-xs shadow-2xs"
                            >
                              <div className="truncate pr-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-slate-900">{t.category}</span>
                                  <span className="text-[10px] text-slate-400 bg-slate-50 border border-slate-200 px-1.5 py-0.2 rounded-md">
                                    {t.date}
                                  </span>
                                </div>
                                {t.note && <p className="text-[11px] text-slate-500 truncate mt-0.5">{t.note}</p>}
                              </div>

                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className={`font-bold text-xs sm:text-sm ${t.type === 'expense' ? 'text-red-500' : 'text-emerald-600'}`}>
                                  {t.type === 'expense' ? '-' : '+'}{Number(t.amount).toLocaleString('vi-VN')} đ
                                </span>
                                <button
                                  onClick={() => handleDelete(t.id)}
                                  className="p-1 text-slate-300 hover:text-red-500 transition cursor-pointer"
                                  title="Xóa giao dịch này"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
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

      {/* THANH ĐIỀU HƯỚNG DƯỚI CÙNG CHO MOBILE (BOTTOM NAV BAR) */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200 px-3 py-2 z-40 flex items-center justify-around shadow-lg">
        <button
          type="button"
          onClick={() => setMobileTab('input')}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-bold cursor-pointer transition ${
            mobileTab === 'input' ? 'text-orange-500' : 'text-slate-400'
          }`}
        >
          <div className={`p-1.5 rounded-xl ${mobileTab === 'input' ? 'bg-orange-50' : ''}`}>
            <PenSquare className="w-4 h-4" />
          </div>
          <span>Nhập mới</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileTab('charts')}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-bold cursor-pointer transition ${
            mobileTab === 'charts' ? 'text-indigo-600' : 'text-slate-400'
          }`}
        >
          <div className={`p-1.5 rounded-xl ${mobileTab === 'charts' ? 'bg-indigo-50' : ''}`}>
            <BarChart3 className="w-4 h-4" />
          </div>
          <span>Biểu đồ</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileTab('history')}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-bold cursor-pointer transition ${
            mobileTab === 'history' ? 'text-emerald-600' : 'text-slate-400'
          }`}
        >
          <div className={`p-1.5 rounded-xl ${mobileTab === 'history' ? 'bg-emerald-50' : ''}`}>
            <History className="w-4 h-4" />
          </div>
          <span>Lịch sử</span>
        </button>

        <button
          type="button"
          onClick={handleExportExcel}
          className="flex flex-col items-center gap-0.5 text-[10px] font-bold text-slate-400 hover:text-emerald-600 cursor-pointer transition"
        >
          <div className="p-1.5 rounded-xl">
            <Download className="w-4 h-4" />
          </div>
          <span>Xuất File</span>
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center gap-0.5 text-[10px] font-bold text-slate-400 hover:text-blue-600 cursor-pointer transition"
        >
          <div className="p-1.5 rounded-xl">
            <Upload className="w-4 h-4" />
          </div>
          <span>Nhập File</span>
        </button>
      </div>

    </div>
  )
}
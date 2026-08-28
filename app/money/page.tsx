'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import * as XLSX from 'xlsx'
import { 
  Plus, ChevronLeft, ChevronRight, Download, 
  Upload, Trash2, Calendar, Wallet, ArrowLeft, ArrowUpRight, 
  ArrowDownLeft, BarChart3, TrendingUp, Tag, X, Check,
  ChevronDown, ChevronUp, PieChart, Filter, Loader2, LogOut, User as UserIcon,
  Sparkles, RotateCcw, PenSquare, History, Eye, EyeOff, Calculator, Equal, Search
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
  { id: 'tien_dien', name: 'Tiền điện', color: 'text-cyan-500 bg-cyan-200' },
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

const QUICK_AMOUNT_SUGGESTIONS = [
  { label: '10k', val: 10000 },
  { label: '20k', val: 20000 },
  { label: '50k', val: 50000 },
  { label: '100k', val: 100000 },
  { label: '200k', val: 200000 },
  { label: '500k', val: 500000 },
  { label: '1 Tr', val: 1000000 },
  { label: '2 Tr', val: 2000000 },
  { label: '5 Tr', val: 5000000 },
  { label: '10 Tr', val: 10000000 },
]

function safeCalculateMath(expr: string | number): number {
  if (!expr) return 0
  try {
    let clean = String(expr)
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/k/g, '000')
      .replace(/tr/g, '000000')
      .replace(/m/g, '000000')
      .replace(/x/g, '*')
      .replace(/÷/g, '/')
      .replace(/,/g, '')
      .replace(/\.(?=\d{3})/g, '')

    const tokens = clean.match(/(\d+(\.\d+)?|[+\-*/])/g)
    if (!tokens || tokens.length === 0) return 0

    const values: (number | string)[] = []
    let i = 0
    while (i < tokens.length) {
      const token = tokens[i]
      if (token === '*' || token === '/') {
        const prev = Number(values.pop())
        const next = Number(tokens[++i])
        if (isNaN(prev) || isNaN(next)) return 0
        values.push(token === '*' ? prev * next : (next !== 0 ? prev / next : 0))
      } else if (!isNaN(Number(token))) {
        values.push(Number(token))
      } else {
        values.push(token)
      }
      i++
    }

    let total = Number(values[0]) || 0
    for (let j = 1; j < values.length; j += 2) {
      const op = values[j]
      const nextVal = Number(values[j + 1]) || 0
      if (op === '+') total += nextVal
      else if (op === '-') total -= nextVal
    }

    return isNaN(total) || !isFinite(total) ? 0 : Math.round(total)
  } catch {
    return 0
  }
}

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
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [authLoading, setAuthLoading] = useState(true)

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
  const [hideBalance, setHideBalance] = useState(false)
  const [showStatsBox, setShowStatsBox] = useState(true)

  const [chartSubTab, setChartSubTab] = useState<'stats' | 'category'>('stats')
  const [chartPeriodMode, setChartPeriodMode] = useState<'year' | 'month' | 'all'>('year')
  const [chartSelectedYear, setChartSelectedYear] = useState<number>(2026)
  const [chartSelectedMonth, setChartSelectedMonth] = useState<number>(8)

  const [historyFilterYear, setHistoryFilterYear] = useState<string>('all')
  const [historyFilterMonth, setHistoryFilterMonth] = useState<string>('all')
  const [historySearchTerm, setHistorySearchTerm] = useState<string>('')

  const [isDeletingAll, setIsDeletingAll] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dateInputRef = useRef<HTMLInputElement>(null)

  const supabaseRef = useRef<any>(null)
  if (!supabaseRef.current) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    if (url && key) {
      supabaseRef.current = createBrowserClient(url, key)
    }
  }
  const supabase = supabaseRef.current

  const fetchTransactions = useCallback(async () => {
    if (!supabase) return
    try {
      let allData: Transaction[] = []
      let page = 0
      const pageSize = 1000

      while (page < 30) {
        const { data, error } = await supabase
          .from('transactions')
          .select('*')
          .order('date', { ascending: false })
          .order('created_at', { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1)

        if (error || !data || data.length === 0) break
        allData = allData.concat(data)
        if (data.length < pageSize) break
        page++
      }

      setTransactions(allData)
    } catch (e) {
      console.error('Lỗi nạp dữ liệu:', e)
    }
  }, [supabase])

  useEffect(() => {
    setMounted(true)
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('dinhthong_hide_balance')
        if (saved === 'true') setHideBalance(true)
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (!mounted || !supabase) return

    let isSubscribed = true
    const checkAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()
        if (error || !data?.session) {
          router.replace('/')
          return
        }

        const loggedInEmail = data.session.user.email
        const { data: whitelist } = await supabase
          .from('allowed_emails')
          .select('email')
          .eq('email', loggedInEmail)
          .single()

        if (!whitelist) {
          alert('Tài khoản của bạn không có quyền truy cập vào mục Thu Chi!')
          await supabase.auth.signOut()
          router.replace('/')
          return
        }

        if (isSubscribed) {
          setUser(data.session.user)
          setAuthLoading(false)
          fetchTransactions()
        }
      } catch {
        router.replace('/')
      }
    }

    checkAuth()
    return () => { isSubscribed = false }
  }, [mounted, supabase, router, fetchTransactions])

  const toggleHideBalance = (e: React.MouseEvent) => {
    e.stopPropagation()
    const nextState = !hideBalance
    setHideBalance(nextState)
    try {
      localStorage.setItem('dinhthong_hide_balance', String(nextState))
    } catch {}
  }

  const noteSuggestions = useMemo(() => {
    const setNotes = new Set<string>()
    transactions
      .filter(t => t && t.category === selectedCategory && t.note)
      .slice(0, 20)
      .forEach(t => setNotes.add(t.note))
    return Array.from(setNotes).slice(0, 5)
  }, [transactions, selectedCategory])

  const availableYears = useMemo(() => {
    const yearSet = new Set<number>()
    yearSet.add(2026)
    yearSet.add(2025)
    yearSet.add(2024)
    yearSet.add(2023)
    transactions.forEach(t => {
      if (t && t.date) {
        const y = Number(String(t.date).split('-')[0])
        if (y && !isNaN(y)) yearSet.add(y)
      }
    })
    return Array.from(yearSet).sort((a, b) => b - a)
  }, [transactions])

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return 'Hôm nay'
    try {
      const clean = String(dateStr).split('T')[0]
      const parts = clean.split('-')
      if (parts.length === 3) {
        const y = Number(parts[0]) || 2026
        const m = Number(parts[1]) || 1
        const d = Number(parts[2]) || 1
        const dateObj = new Date(y, m - 1, d)
        const daysOfWeek = ['CN', 'Th 2', 'Th 3', 'Th 4', 'Th 5', 'Th 6', 'Th 7']
        const dayName = daysOfWeek[dateObj.getDay()] || 'CN'
        return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y} (${dayName})`
      }
      return String(dateStr)
    } catch {
      return String(dateStr)
    }
  }

  const formatCurrency = (val: number) => {
    return Number(val || 0).toLocaleString('vi-VN') + ' đ'
  }

  const formatDisplayCurrencyOrHidden = (val: number) => {
    if (hideBalance) return '****** đ'
    return formatCurrency(val)
  }

  const numericAmount = useMemo(() => {
    return safeCalculateMath(amountStr)
  }, [amountStr])

  const amountInWords = useMemo(() => {
    return readVietnameseNumber(numericAmount)
  }, [numericAmount])

  const handleAppendOperator = (op: string) => {
    if (!amountStr) return
    const lastChar = amountStr.trim().slice(-1)
    if (['+', '-', '*', '/', '×', '÷'].includes(lastChar)) {
      setAmountStr(amountStr.trim().slice(0, -1) + op)
    } else {
      setAmountStr(amountStr + op)
    }
  }

  const handleEvaluateEqual = () => {
    const calculated = safeCalculateMath(amountStr)
    if (calculated > 0) {
      setAmountStr(calculated.toLocaleString('vi-VN'))
    }
  }

  const handleSelectSuggestedAmount = (val: number) => {
    setAmountStr(val.toLocaleString('vi-VN'))
  }

  const handleClearAmount = () => {
    setAmountStr('')
  }

  const handlePrevDay = () => {
    try {
      const parts = currentDateStr.split('-').map(Number)
      const dt = new Date(parts[0], parts[1] - 1, parts[2])
      dt.setDate(dt.getDate() - 1)
      const yStr = dt.getFullYear()
      const mStr = String(dt.getMonth() + 1).padStart(2, '0')
      const dStr = String(dt.getDate()).padStart(2, '0')
      setCurrentDateStr(`${yStr}-${mStr}-${dStr}`)
    } catch {}
  }

  const handleNextDay = () => {
    try {
      const parts = currentDateStr.split('-').map(Number)
      const dt = new Date(parts[0], parts[1] - 1, parts[2])
      dt.setDate(dt.getDate() + 1)
      const yStr = dt.getFullYear()
      const mStr = String(dt.getMonth() + 1).padStart(2, '0')
      const dStr = String(dt.getDate()).padStart(2, '0')
      setCurrentDateStr(`${yStr}-${mStr}-${dStr}`)
    } catch {}
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
    if (!supabase) return
    const finalNum = safeCalculateMath(amountStr)
    if (!finalNum || finalNum <= 0) {
      alert('Vui lòng nhập số tiền hợp lệ!')
      return
    }

    const payload = {
      type,
      amount: finalNum,
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
    if (!supabase) return
    if (confirm('Bạn có chắc muốn xóa giao dịch này không?')) {
      const { error } = await supabase.from('transactions').delete().eq('id', id)
      if (!error) {
        setTransactions(prev => prev.filter(t => t.id !== id))
      }
    }
  }

  const handleDeleteAll = async () => {
    if (!supabase) return
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
    if (!supabase) return
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string
        if (!text) {
          alert('File rỗng!')
          return
        }

        const lines = text.split(/\r?\n/)
        const formattedToInsert: any[] = []

        let inDailyData = false
        let colMap = { date: 0, amount: 1, memo: 2, catId: 3, type: 4 }

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim()
          if (!line) continue

          if (line.includes('#DAILY_DATAS') || line.includes('inputDateString')) {
            inDailyData = true
            if (line.includes('inputDateString')) {
              const headers = line.split(',').map(h => h.trim())
              colMap.date = headers.indexOf('inputDateString')
              colMap.amount = headers.indexOf('amount')
              colMap.memo = headers.indexOf('memo')
              colMap.catId = headers.indexOf('categoryId')
              colMap.type = headers.indexOf('type')
            }
            continue
          }

          if (inDailyData && line.startsWith('#') && !line.includes('#DAILY_DATAS')) {
            break
          }

          if (inDailyData) {
            const parts = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',')
            if (!parts || parts.length < 3) continue

            const rawDate = (parts[colMap.date] || '').replace(/["']/g, '').trim()
            const rawAmount = (parts[colMap.amount] || '').replace(/["']/g, '').trim()
            const rawMemo = (parts[colMap.memo] || '').replace(/["\\n\r]/g, ' ').trim()
            const rawCatId = Number((parts[colMap.catId] || '1').replace(/["']/g, '').trim())
            const rawType = (parts[colMap.type] || '0').replace(/["']/g, '').trim()

            const numAmount = Number(rawAmount)
            if (!numAmount || isNaN(numAmount)) continue

            let formattedDate = currentDateStr
            const cleanDate = rawDate.replace(/\./g, '-').replace(/\//g, '-')
            const dParts = cleanDate.split('-')

            if (dParts.length === 3) {
              if (dParts[0].length === 4) {
                formattedDate = `${dParts[0]}-${dParts[1].padStart(2, '0')}-${dParts[2].padStart(2, '0')}`
              } else if (dParts[2].length === 4) {
                formattedDate = `${dParts[2]}-${dParts[1].padStart(2, '0')}-${dParts[0].padStart(2, '0')}`
              }
            } else if (rawDate.includes('T')) {
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
        }

        if (formattedToInsert.length === 0) {
          alert('Không tìm thấy dữ liệu hợp lệ trong file CSV!')
          return
        }

        const CHUNK_SIZE = 300
        for (let i = 0; i < formattedToInsert.length; i += CHUNK_SIZE) {
          const chunk = formattedToInsert.slice(i, i + CHUNK_SIZE)
          const { error } = await supabase.from('transactions').insert(chunk)
          if (error) throw error
        }

        alert(`Đã nhập thành công ${formattedToInsert.length} giao dịch đầy đủ từ năm 2023 đến nay!`)
        fetchTransactions()
      } catch (err: any) {
        alert('Lỗi nạp file CSV: ' + err.message)
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
    if (supabase) await supabase.auth.signOut()
    router.replace('/')
  }

  const totalAllExpense = useMemo(() => {
    return transactions.filter(t => t && t.type === 'expense').reduce((sum, t) => sum + Number(t.amount || 0), 0)
  }, [transactions])

  const totalAllIncome = useMemo(() => {
    return transactions.filter(t => t && t.type === 'income').reduce((sum, t) => sum + Number(t.amount || 0), 0)
  }, [transactions])

  const totalBalance = totalAllIncome - totalAllExpense

  const chartFiltered = useMemo(() => {
    return transactions.filter(t => {
      if (!t || !t.date) return false
      const parts = String(t.date).split('-').map(Number)
      const y = parts[0]
      const m = parts[1]
      if (chartPeriodMode === 'month') {
        return y === chartSelectedYear && m === chartSelectedMonth
      }
      if (chartPeriodMode === 'year') {
        return y === chartSelectedYear
      }
      return true
    })
  }, [transactions, chartPeriodMode, chartSelectedYear, chartSelectedMonth])

  const chartExpense = useMemo(() => {
    return chartFiltered.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount || 0), 0)
  }, [chartFiltered])

  const chartIncome = useMemo(() => {
    return chartFiltered.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0)
  }, [chartFiltered])

  const chartRemaining = chartIncome - chartExpense

  const catStats = useMemo(() => {
    return chartFiltered
      .filter(t => t.type === type)
      .reduce((acc: Record<string, number>, curr) => {
        acc[curr.category] = (acc[curr.category] || 0) + Number(curr.amount || 0)
        return acc
      }, {})
  }, [chartFiltered, type])

  const catEntries = useMemo(() => {
    return Object.entries(catStats).sort((a, b) => b[1] - a[1])
  }, [catStats])

  const currentTotalCatType = type === 'expense' ? chartExpense : chartIncome

  const historyFiltered = useMemo(() => {
    return transactions.filter(t => {
      if (!t || !t.date) return false
      const parts = String(t.date).split('-').map(Number)
      const y = parts[0]
      const m = parts[1]
      if (historyFilterYear !== 'all' && y !== Number(historyFilterYear)) return false
      if (historyFilterMonth !== 'all' && m !== Number(historyFilterMonth)) return false
      
      if (historySearchTerm.trim()) {
        const term = historySearchTerm.toLowerCase().trim()
        const matchNote = (t.note || '').toLowerCase().includes(term)
        const matchCat = (t.category || '').toLowerCase().includes(term)
        const matchAmount = String(t.amount || '').includes(term)
        if (!matchNote && !matchCat && !matchAmount) return false
      }

      return true
    })
  }, [transactions, historyFilterYear, historyFilterMonth, historySearchTerm])

  const groupedByDayHistory = useMemo(() => {
    const map: Record<string, { date: string; items: Transaction[]; totalExpense: number; totalIncome: number }> = {}
    
    historyFiltered.forEach(t => {
      const d = t.date || '2026-08-28'
      if (!map[d]) {
        map[d] = {
          date: d,
          items: [],
          totalExpense: 0,
          totalIncome: 0
        }
      }
      map[d].items.push(t)
      if (t.type === 'expense') map[d].totalExpense += Number(t.amount || 0)
      else map[d].totalIncome += Number(t.amount || 0)
    })

    return Object.values(map).sort((a, b) => String(b.date).localeCompare(String(a.date)))
  }, [historyFiltered])

  const currentCategories = type === 'expense' ? expenseCats : incomeCats

  if (!mounted || authLoading) {
    return (
      <div className="min-h-screen bg-[#0f1115] flex flex-col items-center justify-center text-white">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mb-3" />
        <p className="text-xs font-light text-white/70 tracking-widest uppercase">Đang tải dữ liệu...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 pb-28 sm:pb-12">
      
      {/* HEADER TỐI ƯU TOÀN DIỆN CHO MOBILE & DESKTOP */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
          
          {/* Cụm Logo & Quay lại */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <button
              onClick={() => router.push('/gallery')}
              className="p-1.5 sm:p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition cursor-pointer"
              title="Quay lại Thư viện ảnh"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <h1 className="font-bold text-xs sm:text-base text-slate-900 tracking-tight flex items-center gap-1.5 truncate">
              <Wallet className="w-4 h-4 text-orange-500 flex-shrink-0" />
              <span className="truncate">Sổ Thu Chi ({transactions.length})</span>
            </h1>
          </div>

          {/* Thanh công cụ tối ưu cuộn ngang trên điện thoại */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none py-1 flex-nowrap max-w-[62vw] sm:max-w-none justify-end">
            
            {/* Box Số Dư & Dropdown Thống Kê */}
            <div className="relative flex-shrink-0">
              <div className="flex items-center bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-200 transition shadow-2xs">
                <button
                  type="button"
                  onClick={() => setShowSummaryDropdown(!showSummaryDropdown)}
                  className="flex items-center gap-1 px-2 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold text-slate-800 cursor-pointer"
                >
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span className="max-w-[70px] xs:max-w-[90px] sm:max-w-none truncate">{formatDisplayCurrencyOrHidden(totalBalance)}</span>
                  {showSummaryDropdown ? <ChevronUp className="w-3 h-3 text-slate-400" /> : <ChevronDown className="w-3 h-3 text-slate-400" />}
                </button>

                <button
                  type="button"
                  onClick={toggleHideBalance}
                  className="pr-1.5 pl-0.5 py-1.5 text-slate-400 hover:text-slate-700 transition cursor-pointer"
                  title={hideBalance ? 'Hiện số tiền' : 'Ẩn số tiền để bảo mật'}
                >
                  {hideBalance ? <EyeOff className="w-3.5 h-3.5 text-slate-500" /> : <Eye className="w-3.5 h-3.5 text-emerald-600" />}
                </button>
              </div>

              {showSummaryDropdown && (
                <div className="absolute right-0 mt-2 w-64 sm:w-72 bg-white rounded-2xl shadow-xl border border-slate-200 p-4 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="font-bold text-slate-700">Tổng quan toàn bộ</span>
                    <span className="text-[10px] text-slate-400">Từ năm 2023 đến nay</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                      <ArrowUpRight className="w-3.5 h-3.5" /> Tổng Thu:
                    </span>
                    <strong className="text-emerald-600 font-bold">{formatDisplayCurrencyOrHidden(totalAllIncome)}</strong>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-red-500 font-semibold">
                      <ArrowDownLeft className="w-3.5 h-3.5" /> Tổng Chi:
                    </span>
                    <strong className="text-red-600 font-bold">{formatDisplayCurrencyOrHidden(totalAllExpense)}</strong>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between font-bold">
                    <span className="text-slate-800">Số Dư Tích Lũy:</span>
                    <span className={totalBalance >= 0 ? 'text-slate-900 font-extrabold' : 'text-rose-600'}>
                      {formatDisplayCurrencyOrHidden(totalBalance)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Các nút trên màn hình Desktop */}
            <button
              onClick={handleExportExcel}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition cursor-pointer flex-shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>Xuất File</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition cursor-pointer flex-shrink-0"
            >
              <Upload className="w-4 h-4" />
              <span>Nhập File</span>
            </button>

            {/* Nút Xóa Dữ Liệu */}
            <button
              onClick={handleDeleteAll}
              disabled={isDeletingAll || transactions.length === 0}
              className="p-1.5 sm:p-2 rounded-xl text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition cursor-pointer disabled:opacity-50 flex-shrink-0"
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

            {/* Tài Khoản & Đăng Xuất */}
            <div className="flex items-center gap-1 pl-1 sm:pl-1.5 border-l border-slate-200 flex-shrink-0">
              {user?.user_metadata?.avatar_url ? (
                <img 
                  src={user.user_metadata.avatar_url} 
                  alt="Avatar" 
                  className="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover border border-emerald-500/50 flex-shrink-0"
                  title={user.email}
                />
              ) : (
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                  <UserIcon className="w-3 h-3" />
                </div>
              )}
              <button
                onClick={handleSignOut}
                className="p-1 text-slate-400 hover:text-red-500 transition cursor-pointer flex-shrink-0"
                title="Đăng xuất"
              >
                <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>

          </div>
        </div>
      </header>

      {/* Main Dashboard */}
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

                {/* 2. Ô Ghi chú */}
                <div>
                  <label className="block text-[11px] sm:text-xs font-bold text-slate-700 mb-1">Nội dung chi tiết (Ghi chú):</label>
                  <input 
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Ví dụ: Ăn sáng, Mua cafe, Tiền điện..."
                    className="w-full py-2.5 sm:py-3.5 px-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-orange-500 focus:bg-white text-xs sm:text-sm font-medium text-slate-900 shadow-2xs transition"
                  />

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

                {/* 3. Ô NHẬP SỐ TIỀN */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] sm:text-xs font-bold text-slate-700 flex items-center gap-1">
                      <Calculator className="w-3.5 h-3.5 text-orange-500" />
                      {type === 'expense' ? 'Số tiền chi ra:' : 'Số tiền thu vào:'}
                    </label>
                    {amountStr && (
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
                      value={amountStr}
                      onChange={(e) => setAmountStr(e.target.value)}
                      placeholder="0 (hoặc gõ 50k+30k, 20*3...)"
                      className={`w-full bg-transparent outline-none text-xl sm:text-3xl font-extrabold ${
                        type === 'expense' ? 'text-orange-600 placeholder-orange-300' : 'text-emerald-700 placeholder-emerald-300'
                      }`}
                    />
                    <span className="ml-2 font-bold text-base sm:text-lg text-slate-500">đ</span>
                  </div>

                  <div className="mt-1.5 flex flex-col gap-1">
                    {numericAmount > 0 && amountInWords && (
                      <div className="px-2.5 py-1 bg-slate-100 rounded-xl text-[11px] font-semibold text-slate-700 italic border border-slate-200">
                        {amountStr.includes('+') || amountStr.includes('-') || amountStr.includes('*') || amountStr.includes('/') ? (
                          <span className="not-italic text-emerald-700 font-bold mr-2">= {formatCurrency(numericAmount)}</span>
                        ) : null}
                        Bằng chữ: <span className="text-slate-900 font-bold not-italic">{amountInWords}</span>
                      </div>
                    )}
                  </div>

                  {/* TOÁN TỬ & GỢI Ý TIỀN */}
                  <div className="mt-2.5 space-y-2">
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 mb-1">Toán tử tính toán:</p>
                      <div className="grid grid-cols-5 gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleAppendOperator('+')}
                          className="py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-extrabold text-sm border border-slate-200 transition cursor-pointer active:scale-95"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAppendOperator('-')}
                          className="py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-extrabold text-sm border border-slate-200 transition cursor-pointer active:scale-95"
                        >
                          -
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAppendOperator('*')}
                          className="py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-extrabold text-sm border border-slate-200 transition cursor-pointer active:scale-95"
                        >
                          ×
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAppendOperator('/')}
                          className="py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-extrabold text-sm border border-slate-200 transition cursor-pointer active:scale-95"
                        >
                          ÷
                        </button>
                        <button
                          type="button"
                          onClick={handleEvaluateEqual}
                          className="py-2 bg-orange-500 text-white rounded-xl font-extrabold text-sm shadow-xs transition hover:bg-orange-600 cursor-pointer flex items-center justify-center active:scale-95"
                        >
                          <Equal className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] font-bold text-slate-500 mb-1">Gợi ý số tiền nhanh:</p>
                      <div className="grid grid-cols-5 gap-1.5">
                        {QUICK_AMOUNT_SUGGESTIONS.map((sug, sIdx) => (
                          <button
                            key={sIdx}
                            type="button"
                            onClick={() => handleSelectSuggestedAmount(sug.val)}
                            className="py-1.5 px-1 bg-white hover:bg-orange-50 hover:text-orange-600 hover:border-orange-300 active:bg-orange-500 active:text-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition active:scale-95 cursor-pointer text-center shadow-2xs"
                          >
                            {sug.label}
                          </button>
                        ))}
                      </div>
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
            
            {/* BOX BIỂU ĐỒ & THỐNG KÊ */}
            <div className={`bg-white p-4 sm:p-6 rounded-3xl border border-slate-200/80 shadow-sm transition-all ${mobileTab === 'history' ? 'hidden lg:block' : 'block'}`}>
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3.5 border-b border-slate-100 mb-3.5">
                
                <div className="flex items-center gap-2">
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

                  <button
                    type="button"
                    onClick={() => setShowStatsBox(!showStatsBox)}
                    className="p-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 transition cursor-pointer flex items-center gap-1 text-[11px] font-semibold"
                    title={showStatsBox ? 'Ẩn bảng thống kê' : 'Hiện bảng thống kê'}
                  >
                    {showStatsBox ? <EyeOff className="w-3.5 h-3.5 text-slate-500" /> : <Eye className="w-3.5 h-3.5 text-emerald-600" />}
                    <span className="hidden xs:inline">{showStatsBox ? 'Ẩn bảng' : 'Hiện bảng'}</span>
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

              {showStatsBox ? (
                <>
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
                          <p className="text-sm sm:text-base font-extrabold text-emerald-700 truncate">{formatDisplayCurrencyOrHidden(chartIncome)}</p>
                        </div>

                        <div className="p-3 bg-red-50/90 border border-red-200/80 rounded-2xl flex flex-col justify-between">
                          <div className="flex items-center gap-1 text-red-600 text-[11px] font-bold mb-0.5">
                            <ArrowDownLeft className="w-3.5 h-3.5" />
                            <span>Tổng Chi</span>
                          </div>
                          <p className="text-sm sm:text-base font-extrabold text-red-700 truncate">{formatDisplayCurrencyOrHidden(chartExpense)}</p>
                        </div>

                        <div className="p-3 bg-blue-50/90 border border-blue-200/80 rounded-2xl flex flex-col justify-between">
                          <div className="flex items-center gap-1 text-blue-600 text-[11px] font-bold mb-0.5">
                            <Wallet className="w-3.5 h-3.5" />
                            <span>Số Dư Còn</span>
                          </div>
                          <p className={`text-sm sm:text-base font-extrabold truncate ${chartRemaining >= 0 ? 'text-blue-700' : 'text-rose-600'}`}>
                            {formatDisplayCurrencyOrHidden(chartRemaining)}
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
                                  {formatDisplayCurrencyOrHidden(amount)} ({percentage}%)
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
                </>
              ) : (
                <div className="py-2 text-center text-xs text-slate-400 italic">
                  (Bảng thống kê đang được thu gọn. Bấm &quot;Hiện bảng&quot; ở trên để xem chi tiết)
                </div>
              )}

            </div>

            {/* BOX LỊCH SỬ GIAO DỊCH */}
            <div className={`bg-white p-4 sm:p-6 rounded-3xl border border-slate-200/80 shadow-sm ${mobileTab === 'charts' ? 'hidden lg:block' : 'block'}`}>
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3.5 border-b border-slate-100 mb-3.5">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <h3 className="font-bold text-sm sm:text-base text-slate-900">
                    Lịch Sử Giao Dịch ({historyFiltered.length})
                  </h3>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap text-xs">
                  <span className="font-bold text-slate-600 flex items-center gap-0.5 text-[11px]">
                    <Filter className="w-3 h-3 text-emerald-600" />
                    Lọc:
                  </span>

                  <select
                    value={historyFilterYear}
                    onChange={(e) => setHistoryFilterYear(e.target.value)}
                    className="bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-xl font-bold text-slate-800 outline-none cursor-pointer text-xs"
                  >
                    <option value="all">Tất cả năm</option>
                    {availableYears.map((y) => (
                      <option key={y} value={String(y)}>Năm {y}</option>
                    ))}
                  </select>

                  <select
                    value={historyFilterMonth}
                    onChange={(e) => setHistoryFilterMonth(e.target.value)}
                    className="bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-xl font-bold text-slate-800 outline-none cursor-pointer text-xs"
                  >
                    <option value="all">Tất cả tháng</option>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={String(m)}>Tháng {m}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Ô TÌM KIẾM TRONG LỊCH SỬ */}
              <div className="relative mb-3.5">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text"
                  value={historySearchTerm}
                  onChange={(e) => setHistorySearchTerm(e.target.value)}
                  placeholder="Tìm theo nội dung ghi chú, danh mục hoặc số tiền..."
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-orange-500 focus:bg-white text-slate-900 transition"
                />
                {historySearchTerm && (
                  <button
                    onClick={() => setHistorySearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* DANH SÁCH LỊCH SỬ */}
              <div className="space-y-4 max-h-[520px] overflow-y-auto pr-0.5">
                {groupedByDayHistory.length === 0 ? (
                  <p className="text-center py-10 text-xs text-slate-400">Không tìm thấy giao dịch nào trong khoảng thời gian đã lọc.</p>
                ) : (
                  groupedByDayHistory.map((dayGroup) => (
                    <div key={dayGroup.date} className="rounded-2xl border border-slate-100 overflow-hidden shadow-2xs bg-white">
                      
                      {/* HEADER NGÀY */}
                      <div className="bg-slate-50/90 border-b border-slate-100 px-3.5 py-2 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 font-bold text-slate-800">
                          <Calendar className="w-3.5 h-3.5 text-orange-500" />
                          <span>{formatDateDisplay(dayGroup.date)}</span>
                          <span className="text-[10px] text-slate-400 font-normal">({dayGroup.items.length} mục)</span>
                        </div>

                        <div className="flex items-center gap-2.5 text-[11px] font-bold">
                          {dayGroup.totalIncome > 0 && (
                            <span className="text-emerald-600">+{formatDisplayCurrencyOrHidden(dayGroup.totalIncome)}</span>
                          )}
                          {dayGroup.totalExpense > 0 && (
                            <span className="text-red-500">-{formatDisplayCurrencyOrHidden(dayGroup.totalExpense)}</span>
                          )}
                        </div>
                      </div>

                      {/* DANH SÁCH THU CHI */}
                      <div className="divide-y divide-slate-100">
                        {dayGroup.items.map((t) => (
                          <div 
                            key={t.id} 
                            className="flex items-center justify-between p-3 hover:bg-slate-50/70 transition text-xs"
                          >
                            <div className="truncate pr-2">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900">{t.category}</span>
                              </div>
                              {t.note ? (
                                <p className="text-[11px] text-slate-500 truncate mt-0.5">{t.note}</p>
                              ) : (
                                <p className="text-[10px] text-slate-300 italic mt-0.5">Không có ghi chú</p>
                              )}
                            </div>

                            <div className="flex items-center gap-2.5 flex-shrink-0">
                              <span className={`font-extrabold text-xs sm:text-sm ${t.type === 'expense' ? 'text-red-500' : 'text-emerald-600'}`}>
                                {t.type === 'expense' ? '-' : '+'}{formatDisplayCurrencyOrHidden(Number(t.amount || 0))}
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
                  ))
                )}
              </div>
            </div>

          </div>

        </div>
      </main>

      {/* THANH ĐIỀU HƯỚNG DƯỚI CÙNG CHO MOBILE */}
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
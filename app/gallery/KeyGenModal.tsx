'use client';

import React, { useState, useEffect } from 'react';

interface KeyGenModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface KeyRecord {
  id: string;
  customerName: string;
  serial: string;
  durationLabel: string;
  key: string;
  createdAt: string;
}

const SECRET_SALT = "DINHTHONG_SECRET_AUTH_2026";

export default function KeyGenModal({ isOpen, onClose }: KeyGenModalProps) {
  const [customerName, setCustomerName] = useState('');
  const [serial, setSerial] = useState('');
  const [duration, setDuration] = useState('LIFE');
  const [generatedKey, setGeneratedKey] = useState('');
  const [records, setRecords] = useState<KeyRecord[]>([]);

  // Tải danh sách khách hàng đã lưu từ LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem('dinhthong_key_history');
    if (saved) {
      try {
        setRecords(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  if (!isOpen) return null;

  const durationOptions = [
    { value: '10m', label: '10 Phút' },
    { value: '7d', label: '7 Ngày' },
    { value: '1M', label: '1 Tháng' },
    { value: '3M', label: '3 Tháng' },
    { value: '6M', label: '6 Tháng' },
    { value: '1Y', label: '1 Năm' },
    { value: 'LIFE', label: 'Vĩnh viễn' },
  ];

  const handleGenerateKey = () => {
    if (!customerName.trim()) {
      alert('Vui lòng nhập Tên khách hàng!');
      return;
    }
    if (!serial.trim()) {
      alert('Vui lòng nhập Số Seri của máy khách!');
      return;
    }

    let expireTimestamp = 0;
    const now = Date.now();

    switch (duration) {
      case '10m': expireTimestamp = now + 10 * 60 * 1000; break;
      case '7d': expireTimestamp = now + 7 * 24 * 60 * 60 * 1000; break;
      case '1M': expireTimestamp = now + 30 * 24 * 60 * 60 * 1000; break;
      case '3M': expireTimestamp = now + 90 * 24 * 60 * 60 * 1000; break;
      case '6M': expireTimestamp = now + 180 * 24 * 60 * 60 * 1000; break;
      case '1Y': expireTimestamp = now + 365 * 24 * 60 * 60 * 1000; break;
      case 'LIFE': expireTimestamp = 9999999999999; break;
    }

    const payload = `${serial.trim().toUpperCase()}|${expireTimestamp}|${SECRET_SALT}`;
    let hash = 0;
    for (let i = 0; i < payload.length; i++) {
      hash = (hash << 5) - hash + payload.charCodeAt(i);
      hash |= 0;
    }
    const signature = Math.abs(hash).toString(36).toUpperCase();
    const finalKey = `DT-${expireTimestamp.toString(36).toUpperCase()}-${signature}`;
    setGeneratedKey(finalKey);

    const durLabel = durationOptions.find((d) => d.value === duration)?.label || duration;
    const newRecord: KeyRecord = {
      id: Date.now().toString(),
      customerName: customerName.trim(),
      serial: serial.trim().toUpperCase(),
      durationLabel: durLabel,
      key: finalKey,
      createdAt: new Date().toLocaleDateString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }),
    };

    const updated = [newRecord, ...records];
    setRecords(updated);
    localStorage.setItem('dinhthong_key_history', JSON.stringify(updated));
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Đã copy mã key: ' + text);
  };

  const handleDeleteRecord = (id: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa bản ghi này khỏi lịch sử?')) {
      const updated = records.filter((r) => r.id !== id);
      setRecords(updated);
      localStorage.setItem('dinhthong_key_history', JSON.stringify(updated));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white text-gray-800 w-full max-w-2xl rounded-2xl shadow-2xl border border-gray-100 flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div>
            <h2 className="text-base font-bold text-gray-900 tracking-tight">DINH THONG RETOUCH</h2>
            <p className="text-xs text-gray-500">Quản lý & Cấp mã kích hoạt bản quyền Panel</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-all"
          >
            ✕
          </button>
        </div>

        {/* Nội dung form */}
        <div className="p-6 overflow-y-auto space-y-4">
          
          {/* Form tạo key */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Tên khách hàng</label>
              <input
                type="text"
                placeholder="Ví dụ: Nguyễn Văn A"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-[#00875a] focus:bg-white transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Số Seri máy khách</label>
              <input
                type="text"
                placeholder="Dán DT-XXXXXX gửi từ máy khách"
                value={serial}
                onChange={(e) => setSerial(e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-[#00875a] focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* Chọn Thời hạn */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">Thời hạn kích hoạt</label>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
              {durationOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDuration(opt.value)}
                  className={`py-1.5 px-2 text-[11px] font-medium rounded-lg border transition-all ${
                    duration === opt.value
                      ? 'bg-[#00875a] text-white border-[#00875a] shadow-sm'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Kết quả Key */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Mã kích hoạt</label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                placeholder="Bấm 'Tạo Key' để sinh mã"
                value={generatedKey}
                className="flex-1 text-xs px-3.5 py-2.5 bg-gray-100 text-gray-900 font-mono font-medium border border-gray-200 rounded-lg outline-none"
              />
              <button
                type="button"
                onClick={handleGenerateKey}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#00875a] hover:bg-[#00744d] rounded-lg shadow-sm transition-all"
              >
                Tạo Key
              </button>
              {generatedKey && (
                <button
                  type="button"
                  onClick={() => handleCopy(generatedKey)}
                  className="px-3.5 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg border border-gray-200 transition-all"
                >
                  Copy
                </button>
              )}
            </div>
          </div>

          {/* Danh sách máy đã cấp key */}
          <div className="pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-xs font-bold text-gray-900">Danh sách máy đang sử dụng ({records.length})</h3>
              {records.length > 0 && (
                <span className="text-[10px] text-gray-400">Lưu tự động vào trình duyệt</span>
              )}
            </div>

            <div className="border border-gray-100 rounded-xl overflow-hidden shadow-sm">
              <div className="max-h-48 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-500 font-semibold sticky top-0 border-b border-gray-100">
                    <tr>
                      <th className="py-2.5 px-3">Khách hàng</th>
                      <th className="py-2.5 px-3">Seri Máy</th>
                      <th className="py-2.5 px-3">Gói</th>
                      <th className="py-2.5 px-3">Mã Key</th>
                      <th className="py-2.5 px-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {records.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-gray-400 text-xs">
                          Chưa có máy nào được tạo key.
                        </td>
                      </tr>
                    ) : (
                      records.map((r) => (
                        <tr key={r.id} className="hover:bg-gray-50/80 transition-colors">
                          <td className="py-2.5 px-3 font-medium text-gray-900">{r.customerName}</td>
                          <td className="py-2.5 px-3 font-mono text-gray-500 text-[11px]">{r.serial}</td>
                          <td className="py-2.5 px-3">
                            <span className="inline-block px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 text-[#00875a] rounded-full border border-emerald-100">
                              {r.durationLabel}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-gray-600 truncate max-w-[130px]" title={r.key}>
                            {r.key}
                          </td>
                          <td className="py-2.5 px-3 text-right space-x-2">
                            <button
                              onClick={() => handleCopy(r.key)}
                              className="text-[11px] text-[#00875a] hover:underline font-medium"
                            >
                              Copy
                            </button>
                            <button
                              onClick={() => handleDeleteRecord(r.id)}
                              className="text-[11px] text-red-500 hover:underline font-medium"
                            >
                              Xóa
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
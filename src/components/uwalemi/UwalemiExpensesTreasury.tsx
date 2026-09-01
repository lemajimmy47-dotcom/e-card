import React, { useState } from 'react';
import { UwalemiState, UwalemiExpense } from '../../types/uwalemi';
import { 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight, 
  Plus, 
  FileSpreadsheet, 
  Printer, 
  Search, 
  Trash2, 
  X,
  PieChart,
  ShieldCheck,
  TrendingUp,
  Receipt
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface Props {
  state: UwalemiState;
  onSaveState: (state: UwalemiState) => Promise<boolean>;
}

export const UwalemiExpensesTreasury: React.FC<Props> = ({ state, onSaveState }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isNewExpenseModalOpen, setIsNewExpenseModalOpen] = useState(false);

  // Custom Confirmation Dialog States
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<{ id: string; title: string } | null>(null);

  const [expenseForm, setExpenseForm] = useState<{
    title: string;
    category: 'msiba' | 'matibabu' | 'uendeshaji' | 'kikao' | 'mkutano_mkuu' | 'huduma' | 'nyingine';
    amount: number;
    date: string;
    paidTo: string;
    approvedBy: string;
    paymentMethod: string;
    description: string;
  }>({
    title: '',
    category: 'kikao',
    amount: 50000,
    date: new Date().toISOString().split('T')[0],
    paidTo: '',
    approvedBy: 'Jimson Lema (Mwenyekiti)',
    paymentMethod: 'M-Pesa (Lipa Namba)',
    description: ''
  });

  const members = state.members || [];
  const monthlyPayments = state.monthlyPayments || [];
  const emergencyFunds = state.emergencyFunds || [];
  const expenses = state.expenses || [];

  // Financial Calculations
  const totalRegistrationFees = members.reduce((sum, m) => {
    if (m.registrationFeePaidAmount !== undefined) return sum + m.registrationFeePaidAmount;
    return sum + (m.registrationFeePaid ? (Number(m.registrationFeeAmount) || 0) : 0);
  }, 0);
  const totalMonthlyFees = monthlyPayments.reduce((sum, p) => sum + (Number(p.paidAmount) || 0), 0);
  const totalEmergencyCollected = emergencyFunds.reduce((sum, emg) => {
    const pSum = (emg.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
    return sum + pSum;
  }, 0);
  const totalMeetingFines = (state.meetings || []).reduce((sum, mtg) => {
    return sum + (mtg.attendees || []).reduce((aSum, att) => aSum + (att.finePaid ? (Number(att.fineAmount) || 0) : 0), 0);
  }, 0);

  const totalInflows = totalRegistrationFees + totalMonthlyFees + totalEmergencyCollected + totalMeetingFines;
  const totalOutflows = expenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
  const netBalance = totalInflows - totalOutflows;

  // Expenses by Category
  const expenseCategories = [
    { key: 'msiba', label: 'Misiba & Rambirambi', color: 'bg-rose-500' },
    { key: 'matibabu', label: 'Matibabu & Kuuguliwa', color: 'bg-amber-500' },
    { key: 'kikao', label: 'Gharama za Vikao', color: 'bg-blue-500' },
    { key: 'mkutano_mkuu', label: 'Gharama za Mkutano Mkuu', color: 'bg-indigo-500' },
    { key: 'uendeshaji', label: 'Uendeshaji & Vifaa', color: 'bg-purple-500' },
    { key: 'huduma', label: 'Huduma za Kijamii', color: 'bg-teal-500' },
    { key: 'nyingine', label: 'Matumizi Mengineyo', color: 'bg-slate-500' }
  ];

  const categoryTotals = expenseCategories.map(cat => {
    const total = expenses.filter(e => e.category === cat.key).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    return { ...cat, total };
  });

  const filteredExpenses = expenses.filter(e => {
    const matchesSearch = 
      e.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.paidTo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.approvedBy.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = categoryFilter === 'all' || e.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.title || !expenseForm.paidTo || !expenseForm.amount) {
      alert('Tafadhali jaza taarifa zote muhimu.');
      return;
    }

    const newExpense: UwalemiExpense = {
      id: `exp-${Date.now()}`,
      title: expenseForm.title,
      category: expenseForm.category,
      amount: Number(expenseForm.amount),
      date: expenseForm.date,
      paidTo: expenseForm.paidTo,
      approvedBy: expenseForm.approvedBy,
      paymentMethod: expenseForm.paymentMethod,
      description: expenseForm.description
    };

    const updatedExpenses = [newExpense, ...expenses];
    await onSaveState({ ...state, expenses: updatedExpenses });
    setIsNewExpenseModalOpen(false);
  };

  const handleDeleteExpense = (id: string, title: string) => {
    setExpenseToDelete({ id, title });
    setDeleteConfirmOpen(true);
  };

  const handleExportExcel = () => {
    const data = expenses.map((e, idx) => ({
      'Na.': idx + 1,
      'Tarehe': e.date,
      'Kichwa cha Matumizi': e.title,
      'Aina': e.category.toUpperCase(),
      'Kiasi (TZS)': e.amount,
      'Mlipwaji (Paid To)': e.paidTo,
      'Iliidhinishwa Na': e.approvedBy,
      'Njia ya Malipo': e.paymentMethod,
      'Maelezo': e.description || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Matumizi ya Hazina');
    XLSX.writeFile(wb, `Ripoti_Matumizi_UWALEMI_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12" id="uwalemi-expenses-treasury">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Wallet className="w-5 h-5 text-emerald-400" />
            Hazina Kuu & Matumizi ya Kikundi (Treasury)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Usimamizi wa mapato, matumizi ya hazina, na uwazi wa fedha za wajumbe 50.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            Pakua Ripoti ya Fedha
          </button>
          <button
            onClick={() => {
              setExpenseForm({
                title: '',
                category: 'kikao',
                amount: 50000,
                date: new Date().toISOString().split('T')[0],
                paidTo: '',
                approvedBy: 'Jimson Lema (Mwenyekiti)',
                paymentMethod: 'M-Pesa (Lipa Namba)',
                description: ''
              });
              setIsNewExpenseModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-900/30 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Rekodi Matumizi ya Hazina
          </button>
        </div>
      </div>

      {/* Financial Health Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Inflows */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 backdrop-blur-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Jumla ya Mapato Yote</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">
            TZS {totalInflows.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-2 space-y-0.5">
            <div>• Ada za Mwezi: TZS {totalMonthlyFees.toLocaleString()}</div>
            <div>• Viingilio: TZS {totalRegistrationFees.toLocaleString()}</div>
            <div>• Faini za Vikao: TZS {totalMeetingFines.toLocaleString()}</div>
            <div>• Michango ya Dharura: TZS {totalEmergencyCollected.toLocaleString()}</div>
          </div>
        </div>

        {/* Total Outflows */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 backdrop-blur-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Jumla ya Matumizi</span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-rose-400 font-mono">
            TZS {totalOutflows.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-2">
            Matumizi {expenses.length} yaliyoidhinishwa na kamati ya uongozi.
          </div>
        </div>

        {/* Net Treasury Balance */}
        <div className="bg-slate-900/70 border border-emerald-500/30 rounded-2xl p-5 backdrop-blur-md bg-gradient-to-br from-emerald-950/20 to-slate-900">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Salio Halisi la Hazina (Net Balance)</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-white font-mono">
            TZS {netBalance.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Pesa iliyopo benki na kwenye mifuko ya simu</span>
          </div>
        </div>
      </div>

      {/* Category Breakdown Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-2.5">
        {categoryTotals.map(cat => (
          <div key={cat.key} className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 truncate">
              <span className={`w-2 h-2 rounded-full ${cat.color}`}></span>
              <span>{cat.label}</span>
            </div>
            <div className="text-sm font-bold text-white mt-1 font-mono">
              TZS {cat.total.toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {/* Expense Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tafuta matumizi kwa jina, mlipwaji, au aliyeidhinisha..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
        >
          <option value="all">Aina Zote za Matumizi</option>
          <option value="msiba">Misiba & Rambirambi</option>
          <option value="matibabu">Matibabu</option>
          <option value="kikao">Gharama za Vikao</option>
          <option value="mkutano_mkuu">Gharama za Mkutano Mkuu</option>
          <option value="uendeshaji">Uendeshaji & Vifaa</option>
          <option value="huduma">Huduma za Kijamii</option>
          <option value="nyingine">Mengineyo</option>
        </select>
      </div>

      {/* Expenses Ledger Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Tarehe</th>
                <th className="py-3 px-4">Matumizi</th>
                <th className="py-3 px-4">Aina</th>
                <th className="py-3 px-4">Kiasi</th>
                <th className="py-3 px-4">Mlipwaji (Paid To)</th>
                <th className="py-3 px-4">Iliidhinishwa Na</th>
                <th className="py-3 px-4 text-right">Vitendo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    Hakuna rekodi za matumizi zilizopatikana.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map(exp => (
                  <tr key={exp.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-slate-400">{exp.date}</td>
                    <td className="py-3.5 px-4 font-semibold text-white">
                      <div>{exp.title}</div>
                      {exp.description && (
                        <div className="text-[10px] text-slate-400 font-normal mt-0.5">{exp.description}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                        {exp.category === 'mkutano_mkuu' ? 'Mkutano Mkuu' : exp.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-rose-400">
                      TZS {exp.amount.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">{exp.paidTo}</td>
                    <td className="py-3.5 px-4 text-slate-400 text-[11px]">{exp.approvedBy}</td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleDeleteExpense(exp.id, exp.title)}
                        title="Futa Rekodi ya Matumizi"
                        className="p-1 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-rose-400 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: RECORD EXPENSE */}
      {isNewExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Receipt className="w-5 h-5 text-rose-400" />
                Rekodi Matumizi ya Hazina
              </h3>
              <button onClick={() => setIsNewExpenseModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Kichwa cha Matumizi *</label>
                <input
                  type="text"
                  required
                  value={expenseForm.title}
                  onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })}
                  placeholder="Mfano: Rambirambi ya Msiba / Vinywaji vya Kikao"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Aina ya Matumizi</label>
                  <select
                    value={expenseForm.category}
                    onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="msiba">Misiba & Rambirambi</option>
                    <option value="matibabu">Matibabu</option>
                    <option value="kikao">Gharama za Vikao</option>
                    <option value="mkutano_mkuu">Gharama za Mkutano Mkuu</option>
                    <option value="uendeshaji">Uendeshaji & Vifaa</option>
                    <option value="huduma">Huduma za Kijamii</option>
                    <option value="nyingine">Mengineyo</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Kiasi (TZS) *</label>
                  <input
                    type="number"
                    required
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono font-bold text-rose-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Mlipwaji (Paid To) *</label>
                  <input
                    type="text"
                    required
                    value={expenseForm.paidTo}
                    onChange={(e) => setExpenseForm({ ...expenseForm, paidTo: e.target.value })}
                    placeholder="Mfaidikaji au Duka"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Tarehe ya Malipo</label>
                  <input
                    type="date"
                    value={expenseForm.date}
                    onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Iliidhinishwa Na</label>
                  <input
                    type="text"
                    value={expenseForm.approvedBy}
                    onChange={(e) => setExpenseForm({ ...expenseForm, approvedBy: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Njia ya Malipo</label>
                  <select
                    value={expenseForm.paymentMethod}
                    onChange={(e) => setExpenseForm({ ...expenseForm, paymentMethod: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="M-Pesa (Lipa Namba)">M-Pesa (Lipa Namba)</option>
                    <option value="Tigo Pesa">Tigo Pesa</option>
                    <option value="Airtel Money">Airtel Money</option>
                    <option value="Benki (CRDB/NMB)">Benki (CRDB/NMB)</option>
                    <option value="Taslimu (Cash)">Taslimu (Cash)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Maelezo ya Ziada</label>
                <textarea
                  rows={2}
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  placeholder="Maelezo ya ziada ya matumizi haya..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewExpenseModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Ghairi
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-900/30 cursor-pointer"
                >
                  Hifadhi Matumizi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOM MODAL: DELETE EXPENSE CONFIRMATION */}
      {deleteConfirmOpen && expenseToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Thibitisha Kufuta</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Je, una uhakika unataka kufuta rekodi hii ya matumizi: <strong className="text-white">"{expenseToDelete.title}"</strong>? Hatua hii haiwezi kurudishwa nyuma.
            </p>
            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setExpenseToDelete(null);
                }}
                className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Ghairi
              </button>
              <button
                onClick={async () => {
                  const updatedExpenses = expenses.filter(e => e.id !== expenseToDelete.id);
                  await onSaveState({ ...state, expenses: updatedExpenses });
                  setDeleteConfirmOpen(false);
                  setExpenseToDelete(null);
                }}
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-900/30 cursor-pointer"
              >
                Futa Rekodi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

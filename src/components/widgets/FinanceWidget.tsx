"use client";

import { motion, AnimatePresence } from "framer-motion";
import { DollarSign, ArrowUpRight } from "lucide-react";
import { useState, useEffect } from "react";
import { WidgetCard, useWidget } from "@/components/ui/widget";

import { getTransactions, addTransaction } from "@/actions/finance";

export default function FinanceWidget({ itemVariants }: any) {
  const [expense, setExpense] = useState("");
  const [balance, setBalance] = useState(4200);
  const [spent, setSpent] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const { activeWidgetId } = useWidget();
  const isExpanded = activeWidgetId === "finance";
  const isShrunk = activeWidgetId !== null && activeWidgetId !== "finance";

  const budget = 5000;
  const progress = (spent / budget) * 100;

  useEffect(() => {
    async function loadData() {
      const data = await getTransactions();
      setTransactions(data.transactions);
      setBalance(data.balance);
      setSpent(data.spentThisWeek);
      setIsLoading(false);
    }
    loadData();
  }, []);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(expense);
    if (isNaN(amount) || amount <= 0) return;
    
    setExpense("");
    // Optimistic UI update
    const optimisticTx = { id: 'temp', amount: -amount, desc: "Quick Expense", time: "Just now" };
    setTransactions(prev => [optimisticTx, ...prev]);
    setBalance(prev => prev - amount);
    setSpent(prev => prev + amount);
    
    await addTransaction(-amount);
    
    // Refresh real data
    const data = await getTransactions();
    setTransactions(data.transactions);
  };

  return (
    <WidgetCard 
      id="finance"
      defaultClassName="col-span-1 flex flex-col justify-between min-h-[200px] h-full"
      expandedClassName="col-span-1 lg:col-span-2 row-span-2 flex flex-col justify-between min-h-[400px] h-full"
      shrunkClassName="col-span-1 flex flex-col justify-between min-h-[200px] h-full"
    >
      <motion.div layout className="z-10 flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
           <DollarSign className="w-3.5 h-3.5 text-[#ededed]" />
           <span className="font-mono text-[10px] uppercase tracking-widest text-[#888]">
             Cash Flow
           </span>
        </div>
      </motion.div>

      <motion.div layout className={`z-10 ${isShrunk ? 'mt-auto mb-auto text-center' : 'mt-auto'}`}>
        <motion.div layout className={`${isShrunk ? 'text-4xl' : 'text-3xl'} font-normal tracking-tight text-[#ededed]`}>
          ${balance.toLocaleString()}
        </motion.div>
        <motion.div layout className="text-[10px] text-[#666] font-mono mt-1 uppercase tracking-widest">
          Available this week
        </motion.div>
      </motion.div>

      {/* Expanded view */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-6 flex flex-col gap-5 overflow-hidden flex-1"
          >
            <div className="w-full h-[1px] bg-white/[0.05]" />
            
            {/* Mini Budget Bar */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-[10px] font-mono uppercase tracking-widest text-[#888]">
                <span>Spent: ${spent}</span>
                <span>Budget: ${budget}</span>
              </div>
              <div className="w-full bg-white/[0.05] h-1.5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-red-400 rounded-full" 
                  style={{ width: `${progress}%` }} 
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 flex-1 overflow-y-auto scrollbar-none pr-2">
              <h4 className="text-[10px] font-mono text-[#888] uppercase tracking-widest mb-1">Recent Transactions</h4>
              {transactions.map((tx, i) => (
                <div key={tx.id || i} className="flex justify-between items-center text-sm p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                  <span className="text-[#ededed]">{tx.desc || tx.category}</span>
                  <div className="flex flex-col items-end">
                    <span className={tx.amount > 0 ? "text-green-400" : "text-[#888]"}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-[#555] font-mono">
                      {tx.time || (tx.date ? new Date(tx.date).toLocaleDateString() : 'Just now')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!isShrunk && (
          <motion.form 
            layout 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            onSubmit={handleAddExpense} 
            className="z-10 mt-6 relative w-full"
          >
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666] text-sm">$</div>
            <input 
              type="number"
              value={expense}
              onChange={(e) => setExpense(e.target.value)}
              placeholder="Quick expense..."
              className="w-full bg-white/[0.02] border border-white/[0.08] rounded-xl pl-7 pr-10 py-2.5 text-[13px] text-[#ededed] placeholder-[#666] focus:outline-none focus:border-white/[0.2] focus:bg-white/[0.04] transition-all"
            />
            <button type="submit" className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center bg-transparent hover:bg-white/[0.1] text-[#888] hover:text-[#ededed] rounded-lg transition-colors">
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </motion.form>
        )}
      </AnimatePresence>
    </WidgetCard>
  );
}

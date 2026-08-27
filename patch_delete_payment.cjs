const fs = require('fs');
let code = fs.readFileSync('src/components/ContributionManager.tsx', 'utf-8');

const targetStr = '<span className="text-[10.5px] text-emerald-450">{p.date}</span>';
if (code.includes(targetStr) && !code.includes('handleDeletePayment')) {
  // First, add the handleDeletePayment function
  const deleteFunc = `
  const handleDeletePayment = (guestId: string, paymentId: string, amount: number) => {
    if (!confirm(isEn ? "Are you sure you want to delete this payment record?" : "Je, una uhakika unataka kufuta rekodi hii ya malipo?")) return;
    const targetGuest = guests.find(g => g.id === guestId);
    if (!targetGuest) return;
    
    const updatedPayments = (targetGuest.payments || []).filter(p => p.id !== paymentId);
    const newTotalPaid = updatedPayments.reduce((sum, p) => sum + p.amount, 0);
    const currentPledge = typeof targetGuest.pledgeAmount === 'number' ? targetGuest.pledgeAmount : 0;
    
    let status = String(targetGuest.pledgeStatus || "No Pledge");
    if (newTotalPaid >= currentPledge && currentPledge > 0) {
      status = 'Fully Paid';
    } else if (newTotalPaid > 0) {
      status = 'Partially Paid';
    } else if (currentPledge > 0) {
      status = 'Pledged';
    } else {
      status = 'No Pledge';
    }
    
    const updatedGuests = guests.map(g => {
      if (g.id === guestId) {
        return {
          ...g,
          pledgeStatus: status,
          paidAmount: newTotalPaid,
          payments: updatedPayments
        };
      }
      return g;
    });
    
    onUpdateGuests(updatedGuests, \`Amefuta rekodi ya malipo (TZS \${amount}) ya mgeni: \${targetGuest.name}\`);
    if (isHistoryModalOpen) {
       // Also update target guest view locally to reflect changes
       setTargetGuest({
          ...targetGuest,
          pledgeStatus: status,
          paidAmount: newTotalPaid,
          payments: updatedPayments
       });
    }
  };
`;
  
  code = code.replace('const openHistoryModal =', deleteFunc + '\n  const openHistoryModal =');
  
  // Now add the trash icon
  code = code.replace(targetStr, targetStr + `
                          <button
                            onClick={() => handleDeletePayment(targetGuest.id, p.id, p.amount)}
                            className="ml-3 text-rose-500/50 hover:text-rose-500 transition-colors"
                            title={isEn ? "Delete Payment" : "Futa Malipo"}
                          >
                            <Trash2 className="w-3.5 h-3.5 inline" />
                          </button>`);
  
  fs.writeFileSync('src/components/ContributionManager.tsx', code);
  console.log("Delete payment logic added.");
} else {
  console.log("Delete payment already exists or string not found.");
}

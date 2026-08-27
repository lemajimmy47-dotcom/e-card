const fs = require('fs');
let code = fs.readFileSync('src/components/ContributionManager.tsx', 'utf-8');

// Patch handleSavePledge
code = code.replace(
  'onUpdateGuests(updatedGuests);\n    setIsPledgeModalOpen(false);',
  'onUpdateGuests(updatedGuests, `Ameweka/Amerekebisha ahadi ya mgeni: ${targetGuest.name} (Ahadi mpya: TZS ${pledgeNum})`);\n    setIsPledgeModalOpen(false);'
);

// Patch handleSavePayment
code = code.replace(
  'onUpdateGuests(updatedGuests);\n    setIsPaymentModalOpen(false);',
  'onUpdateGuests(updatedGuests, `Ameingiza malipo ya mgeni: ${targetGuest.name} (Kiasi: TZS ${paymentAmount}, Njia: ${paymentMethod})`);\n    setIsPaymentModalOpen(false);'
);

// Patch handleResetGuest
code = code.replace(
  "onUpdateGuests(updated);\n    const msg = isEn ",
  "onUpdateGuests(updated, `Amefuta na kurudisha kwenye hali ya awali (Reset) taarifa za ${guests.find(x => x.id === guestId)?.name}`);\n    const msg = isEn "
);

// Patch handleResetAllGuests
code = code.replace(
  "onUpdateGuests(updated);\n    setSendLogs([]);",
  "onUpdateGuests(updated, `Amefuta na kurudisha kwenye hali ya awali (Reset) taarifa za wageni WOTE kwenye hili tukio`);\n    setSendLogs([]);"
);

fs.writeFileSync('src/components/ContributionManager.tsx', code);
console.log("Action descriptions added to ContributionManager.");

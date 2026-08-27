const fs = require('fs');
let code = fs.readFileSync('src/components/ContributionManager.tsx', 'utf-8');

code = code.replace(
  'onUpdateGuests(updatedGuests, \`Ameingiza malipo ya mgeni: ${targetGuest.name} (Kiasi: TZS ${paymentAmount}, Njia: ${paymentMethod})\`);',
  'onUpdateGuests(updatedGuests, \`Ameingiza malipo ya mgeni: ${targetGuest.name} (Kiasi: TZS ${amtPaidNew}, Njia: ${modalPaymentRef})\`);'
);

code = code.replace(
  'let status = String(targetGuest.pledgeStatus || "No Pledge");',
  'let status: "No Pledge" | "Pledged" | "Fully Paid" | "Partially Paid" = (targetGuest.pledgeStatus as any) || "No Pledge";'
);

fs.writeFileSync('src/components/ContributionManager.tsx', code);

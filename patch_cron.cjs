const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const cronCode = `
// ==========================================
// CRON: AUTOMATED PAYMENT REMINDERS
// ==========================================
function startPaymentRemindersCron() {
  console.log("[Cron] Automated Payment Reminders service initialized.");
  
  // Run every 24 hours to check for pledges that need reminding
  // For demo/testing, running it every 12 hours
  setInterval(async () => {
    try {
      console.log("[Cron] Running payment reminders check...");
      const db = await readDBLatest();
      
      const today = new Date();
      const settings = db.smsGatewaySettings || { provider: "simulation" };

      // We need to look through events
      const events = db.events || [];
      const guests = db.guests || [];

      for (const event of events) {
        if (!event.date) continue;
        
        // Parse event date (assumes DD/MM/YYYY or YYYY-MM-DD)
        let eventDate;
        if (event.date.includes('/')) {
          const parts = event.date.split('/');
          if (parts.length === 3) {
             eventDate = new Date(\`\${parts[2]}-\${parts[1]}-\${parts[0]}\`);
          }
        } else {
          eventDate = new Date(event.date);
        }

        if (isNaN(eventDate.getTime())) continue;

        // Calculate days left
        const diffTime = eventDate.getTime() - today.getTime();
        const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Remind at exactly 30, 14, or 7 days before event
        if (daysLeft === 30 || daysLeft === 14 || daysLeft === 7) {
          console.log(\`[Cron] Event \${event.name} is \${daysLeft} days away. Dispatching reminders...\`);
          
          const eventGuests = guests.filter((g) => g.eventId === event.id);
          for (const guest of eventGuests) {
            const currentPledge = typeof guest.pledgeAmount === 'number' ? guest.pledgeAmount : 0;
            const currentPaid = typeof guest.paidAmount === 'number' ? guest.paidAmount : 0;
            const balance = currentPledge - currentPaid;

            // Only remind if they pledged and have a balance
            if (currentPledge > 0 && balance > 0) {
              const reminderMsg = \`Salaam \${guest.name}, tunakukumbusha kuhusu ahadi yako ya TZS \${currentPledge.toLocaleString()} kwa ajili ya \${event.name || 'sherehe'}. Bado kiasi cha TZS \${balance.toLocaleString()}. Tafadhali kamilisha malipo yako kabla ya tarehe \${event.date}. Asante!\`;
              
              // Dispatch SMS quietly
              console.log(\`[Cron] Sending reminder to \${guest.phone}\`);
              await dispatchSMS(guest.phone, reminderMsg, 'sms', settings).catch(e => {
                console.error("[Cron] Failed to send reminder SMS:", e.message);
              });
            }
          }
        }
      }
    } catch (e: any) {
      console.error("[Cron] Error in payment reminders check:", e.message);
    }
  }, 12 * 60 * 60 * 1000); // 12 hours
}

// Start the cron service
startPaymentRemindersCron();
`;

if (!code.includes("startPaymentRemindersCron();")) {
  code = code.replace('async function startServer() {', cronCode + '\nasync function startServer() {');
  fs.writeFileSync('server.ts', code);
  console.log("Cron patched successfully.");
} else {
  console.log("Cron already exists.");
}

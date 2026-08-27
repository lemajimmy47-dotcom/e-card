const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const webhookCode = `
  // Mobile Money API Webhook (Lipa Namba/Paybill Integration)
  app.post("/api/webhooks/mobile-money", async (req, res) => {
    try {
      const { transactionId, amount, phone, accountReference } = req.body;
      if (!amount || !phone || !accountReference) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const db = await readDBLatest();
      let paymentRecorded = false;
      let matchedGuest = null;

      // Find the guest by accountReference (which could be the card code or ID) or phone number
      db.guests = (db.guests || []).map((g) => {
        if (!paymentRecorded && (g.code === accountReference || g.id === accountReference || g.phone.includes(phone))) {
          matchedGuest = g;
          const currentPaid = typeof g.paidAmount === 'number' ? g.paidAmount : 0;
          const currentPledge = typeof g.pledgeAmount === 'number' ? g.pledgeAmount : 0;
          const newTotalPaid = currentPaid + Number(amount);
          
          let status = String(g.pledgeStatus || "No Pledge");
          if (newTotalPaid >= currentPledge && currentPledge > 0) {
            status = 'Fully Paid';
          } else if (newTotalPaid > 0) {
            status = 'Partially Paid';
          }

          const updatedPayments = [...(g.payments || []), {
            id: 'pay-' + Date.now(),
            amount: Number(amount),
            date: new Date().toLocaleDateString('sw-TZ'),
            reference: transactionId || 'M-PESA/TIGO-PESA',
            notes: 'Malipo ya Mtandao (Mobile Money)'
          }];

          paymentRecorded = true;
          return {
            ...g,
            pledgeStatus: status,
            paidAmount: newTotalPaid,
            payments: updatedPayments
          };
        }
        return g;
      });

      if (paymentRecorded && matchedGuest) {
        // Record in Audit Logs
        let currentLogs = db.auditLogs || [];
        currentLogs = [{
          id: 'log-' + Date.now() + Math.random().toString(36).substr(2, 5),
          timestamp: new Date().toISOString(),
          user: 'System API (Mobile Money)',
          action: \`Amepokea malipo (Mobile Money) kiasi cha TZS \${amount} kutoka kwa mgeni: \${matchedGuest.name}\`,
          details: \`Transaction ID: \${transactionId || 'N/A'}\`,
          ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown IP'
        }, ...currentLogs].slice(0, 500);
        db.auditLogs = currentLogs;

        await writeDB(db);
        return res.json({ success: true, message: "Malipo yamepokelewa na kurekodiwa kikamilifu." });
      } else {
        return res.status(404).json({ error: "Guest not found matching the account reference or phone." });
      }
    } catch (e) {
      console.error("Mobile Money Webhook error:", e.message);
      res.status(500).json({ error: e.message });
    }
  });
`;

if (!code.includes("/api/webhooks/mobile-money")) {
  code = code.replace('app.get("/api/diagnostics/connectivity",', webhookCode + '\n  app.get("/api/diagnostics/connectivity",');
  fs.writeFileSync('server.ts', code);
  console.log("Webhook patched successfully.");
} else {
  console.log("Webhook already exists.");
}

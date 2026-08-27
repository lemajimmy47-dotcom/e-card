const fs = require('fs');
try {
  const backup = JSON.parse(fs.readFileSync('user-backup.json', 'utf8'));
  
  if (!backup.smsGatewaySettings) {
    backup.smsGatewaySettings = {};
  }
  
  const wUrl = JSON.stringify({
    provider: 'meta',
    meta_token: 'EAAWMfed0rywBR2DFR7dvGKUp42oAUxUWysAObNEtFuj0BZAw07zGUFQOi2CkiRnIFDZBXDlUpX57TsYRKzn5u3DyCyHqkCAbTxb17CrbYpw4LHAXfdIdGF3yJmKyWi545p6zApVPi0hPCjBCFnFW1l1JHBLOZBjFQ5JkZAsXAfoVCXiGBOpvC4nWq6isFrw1rc9xhuYPJzRJgVJ8EeVhD0beRFfiqzWaZBBsoIkNibXLnBTbQ4L1Ke6W2xnFP9MKyArKlDmZBFjB5UhTh9DEIXlJWK5uIWW1AtMd4XOEgZD',
    phone_number_id: '1063442033529020',
    template_name: 'kadi_mwaliko',
    template_lang: 'sw'
  });

  backup.smsGatewaySettings.whatsappUrl = wUrl;
  
  fs.writeFileSync('database.json', JSON.stringify(backup, null, 2), 'utf8');
  console.log("Success! Restored from user-backup.json and updated database.json");
} catch(e) {
  console.error("Error:", e);
}

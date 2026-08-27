fetch('http://localhost:3000/api/sms-settings')
  .then(r => r.json())
  .then(settings => {
    settings.whatsappUrl = JSON.stringify({
      provider: 'meta',
      meta_token: 'EAAWMfed0rywBR2DFR7dvGKUp42oAUxUWysAObNEtFuj0BZAw07zGUFQOi2CkiRnIFDZBXDlUpX57TsYRKzn5u3DyCyHqkCAbTxb17CrbYpw4LHAXfdIdGF3yJmKyWi545p6zApVPi0hPCjBCFnFW1l1JHBLOZBjFQ5JkZAsXAfoVCXiGBOpvC4nWq6isFrw1rc9xhuYPJzRJgVJ8EeVhD0beRFfiqzWaZBBsoIkNibXLnBTbQ4L1Ke6W2xnFP9MKyArKlDmZBFjB5UhTh9DEIXlJWK5uIWW1AtMd4XOEgZD',
      phone_number_id: '1063442033529020',
      template_name: 'kadi_mwaliko',
      template_lang: 'sw'
    });
    return fetch('http://localhost:3000/api/sms-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
  })
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);

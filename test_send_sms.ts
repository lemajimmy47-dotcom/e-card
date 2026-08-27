import { fetchFullStateFromDB } from './src/db/cloudsql-core.ts';

async function run() {
  const state = await fetchFullStateFromDB();
  const guest = state.guests.find((g: any) => g.eventId === '346913' && g.name === 'Jimson Lema');
  if (!guest) {
     console.log("Guest not found"); return;
  }
  
  console.log("Before: whatsappStatus=", guest.whatsappStatus);
  
  const res = await fetch('http://localhost:3000/api/send-sms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      guestId: guest.id,
      eventId: guest.eventId,
      phone: guest.phone,
      text: "Test msg",
      channel: 'sms'
    })
  });
  
  const data = await res.json();
  console.log("Response:", data);
  
  const state2 = await fetchFullStateFromDB();
  const guest2 = state2.guests.find((g: any) => g.id === guest.id);
  console.log("After: whatsappStatus=", guest2.whatsappStatus);
}
run().then(() => process.exit(0)).catch(console.error);

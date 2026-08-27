const fs = require('fs');
let code = fs.readFileSync('src/components/LandingPage.tsx', 'utf-8');

code = code.replace(/import React, \{ useState \} from 'react';/, "import React, { useState, useEffect } from 'react';");
code = code.replace(
  /const \[activePolicyTab, setActivePolicyTab\] = useState<'privacy' \| 'terms' \| null>\(null\);/,
  `const [activePolicyTab, setActivePolicyTab] = useState<'privacy' | 'terms' | 'delete' | null>(null);

  useEffect(() => {
    const path = window.location.pathname;
    if (path === '/privacy-policy') setActivePolicyTab('privacy');
    else if (path === '/terms') setActivePolicyTab('terms');
    else if (path === '/delete-data') setActivePolicyTab('delete');
  }, []);`
);

const footerButtons = `<button 
            onClick={() => setActivePolicyTab('privacy')}
            className="hover:text-white transition duration-150 cursor-pointer flex items-center gap-1.5"
          >
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>{language === 'sw' ? 'Sera ya Faragha (Privacy)' : 'Privacy Policy'}</span>
          </button>
          <span className="text-white/10">|</span>
          <button 
            onClick={() => setActivePolicyTab('terms')}
            className="hover:text-white transition duration-150 cursor-pointer flex items-center gap-1.5"
          >
            <FileText className="w-4 h-4 text-blue-400" />
            <span>{language === 'sw' ? 'Mkataba wa Huduma (Terms)' : 'Terms of Service'}</span>
          </button>
          <span className="text-white/10">|</span>
          <button 
            onClick={() => setActivePolicyTab('delete')}
            className="hover:text-white transition duration-150 cursor-pointer flex items-center gap-1.5"
          >
            <Shield className="w-4 h-4 text-rose-400" />
            <span>{language === 'sw' ? 'Ufutaji wa Data (Data Deletion)' : 'Data Deletion'}</span>
          </button>`;

code = code.replace(/<button \n            onClick=\{\(\) => setActivePolicyTab\('privacy'\)\}[\s\S]*?<span>\{language === 'sw' \? 'Mkataba wa Huduma \(Terms\)' : 'Terms of Service'\}<\/span>\n          <\/button>/, footerButtons);

const modalHeader = `{activePolicyTab === 'privacy' ? <Shield className="w-5 h-5 text-emerald-400" /> : activePolicyTab === 'delete' ? <Shield className="w-5 h-5 text-rose-400" /> : <FileText className="w-5 h-5 text-blue-400" />}
                <h3 className="text-lg font-bold font-sans">
                  {activePolicyTab === 'privacy' 
                    ? (language === 'sw' ? 'Sera ya Faragha - EVENT CARD' : 'Privacy & Data Protection Policy') 
                    : activePolicyTab === 'delete'
                    ? (language === 'sw' ? 'Maelekezo ya Kufuta Data' : 'Data Deletion Instructions')
                    : (language === 'sw' ? 'Masharti na Mkataba wa Huduma' : 'Terms of Service & API Agreement')}
                </h3>`;

code = code.replace(/\{activePolicyTab === 'privacy' \? <Shield className="w-5 h-5 text-emerald-400" \/> : <FileText className="w-5 h-5 text-blue-400" \/>\}[\s\S]*?<\/h3>/, modalHeader);

const deleteContent = `
              ) : activePolicyTab === 'delete' ? (
                <>
                  <div>
                    <h4 className="font-bold text-white text-base mb-2">1. Jinsi ya Kufuta Data Zako / How to Delete Your Data</h4>
                    <p className="mb-2">
                      <strong>Swahili:</strong> Ikiwa unataka kufuta taarifa zako (kama vile namba yako ya simu au jina lako kwenye orodha ya wageni), unaweza kuwasiliana na mratibu wako wa tukio ambaye atakuondoa kwenye orodha kupitia Mfumo wa EVENTCARD. Pia unaweza kututumia barua pepe moja kwa moja kupitia <strong>info@eventcard.co.tz</strong> au kutumia WhatsApp kwa kutuma neno "FUTA" na tutaziondoa data zako mara moja.
                    </p>
                    <p>
                      <strong>English:</strong> If you wish to delete your data (such as your phone number or name on a guest list), you can contact your event host who can remove you from their directory via the EVENTCARD platform. Alternatively, you can email us directly at <strong>info@eventcard.co.tz</strong> or reply to our WhatsApp messages with the word "REMOVE" and we will permanently delete your data.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-base mb-2">2. Akaunti za Kamati au Waandaaji / Hosts & Committee Accounts</h4>
                    <p className="mb-2">
                      <strong>Swahili:</strong> Ikiwa wewe ni mwandaaji (host) na unataka kufuta akaunti yako na data zote zinazohusiana na matukio yako, tafadhali wasiliana na info@eventcard.co.tz ukitaja namba ya tukio lako na tutakufutia data zako zote kwenye seva zetu ndani ya saa 24.
                    </p>
                    <p>
                      <strong>English:</strong> If you are an event host and wish to delete your account along with all associated event and guest data, please email info@eventcard.co.tz specifying your Event ID. We will purge all related data from our servers within 24 hours.
                    </p>
                  </div>
                </>
              ) : (`;

code = code.replace(/\) : \(/, deleteContent);

fs.writeFileSync('src/components/LandingPage.tsx', code);

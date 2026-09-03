import React, { useState, useMemo, useEffect } from 'react';
import { 
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts';
import { 
  FileText, Clipboard, CheckCircle, TrendingUp, 
  Download, Printer, Activity, Search,
  Users, Check, Smartphone, BarChart3,
  XCircle, HelpCircle, Clock
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { EventDetails, Guest, ContributionPayment } from '../types';
import { isStatusSent } from '../utils/statusHelper';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addPdfWatermarks } from '../utils/pdfWatermark';
import { ReportWatermark } from './ReportWatermark';

interface EventReportsProps {
  event: EventDetails;
  guests: Guest[];
  onUpdateEvent?: (updated: EventDetails) => void;
  onUpdateGuests?: (updated: Guest[]) => void;
}

export default function EventReports({
  event,
  guests,
  onUpdateEvent,
  onUpdateGuests
}: EventReportsProps) {
  const { language } = useLanguage();
  const isEn = language === 'en';

  const [selectedReport, setSelectedReport] = useState<string>('Overall');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [reportCategory, setReportCategory] = useState<'attendance' | 'finance'>('attendance');
  const [chartMetric, setChartMetric] = useState<'count' | 'value'>('count');

  const [systemLogoBase64, setSystemLogoBase64] = useState<string>('');
  const [systemLogoDims, setSystemLogoDims] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [eventLogoBase64, setEventLogoBase64] = useState<string>('');
  const [eventLogoDims, setEventLogoDims] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  useEffect(() => {
    // Utility to load image to base64
    const loadImgToBase64 = (url: string, callback: (b64: string, dims: { w: number; h: number }) => void) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const dataURL = canvas.toDataURL('image/png');
            callback(dataURL, { w: img.width, h: img.height });
          }
        } catch (e) {
          console.error("Failed to convert image to base64:", e);
        }
      };
      img.onerror = () => {
        // Fallback or retry
      };
      img.src = url;
    };

    // Load standard system logo
    loadImgToBase64('/logo.png', (b64, dims) => {
      setSystemLogoBase64(b64);
      setSystemLogoDims(dims);
    });

    // Load custom event cover/logo if it exists
    if (event.eventImgUrl) {
      loadImgToBase64(event.eventImgUrl, (b64, dims) => {
        setEventLogoBase64(b64);
        setEventLogoDims(dims);
      });
    }
  }, [event.eventImgUrl]);

  // Total Metrics Calc
  const totalGuestsCount = guests.length;
  const singleCardsCount = guests.filter(g => !g.cardType || g.cardType === 'SINGLE').length;
  const doubleCardsCount = guests.filter(g => g.cardType === 'DOUBLE' || g.cardType === 'COUPLE').length;
  const vipCardsCount = guests.filter(g => g.cardType?.toUpperCase() === 'VIP').length;

  const attendingGuests = useMemo(() => guests.filter(g => g.rsvpStatus === 'Atahudhuria'), [guests]);
  const attendingCount = attendingGuests.length;
  const attendingSingle = useMemo(() => attendingGuests.filter(g => !g.cardType || g.cardType === 'SINGLE').length, [attendingGuests]);
  const attendingDouble = useMemo(() => attendingGuests.filter(g => g.cardType === 'DOUBLE' || g.cardType === 'COUPLE').length, [attendingGuests]);
  const attendingVip = useMemo(() => attendingGuests.filter(g => g.cardType?.toUpperCase() === 'VIP').length, [attendingGuests]);
  const totalRsvpPax = useMemo(() => attendingGuests.reduce((acc, current) => acc + (current.rsvpGuestsCount || (current.cardType === 'DOUBLE' ? 2 : 1)), 0), [attendingGuests]);

  const declinedGuests = useMemo(() => guests.filter(g => g.rsvpStatus === 'Hatahudhuria'), [guests]);
  const declinedCount = declinedGuests.length;
  const declinedSingle = useMemo(() => declinedGuests.filter(g => !g.cardType || g.cardType === 'SINGLE').length, [declinedGuests]);
  const declinedDouble = useMemo(() => declinedGuests.filter(g => g.cardType === 'DOUBLE' || g.cardType === 'COUPLE').length, [declinedGuests]);
  const declinedVip = useMemo(() => declinedGuests.filter(g => g.cardType?.toUpperCase() === 'VIP').length, [declinedGuests]);

  const maybeGuests = useMemo(() => guests.filter(g => g.rsvpStatus === 'Labda'), [guests]);
  const maybeCount = maybeGuests.length;
  const maybeSingle = useMemo(() => maybeGuests.filter(g => !g.cardType || g.cardType === 'SINGLE').length, [maybeGuests]);
  const maybeDouble = useMemo(() => maybeGuests.filter(g => g.cardType === 'DOUBLE' || g.cardType === 'COUPLE').length, [maybeGuests]);
  const maybeVip = useMemo(() => maybeGuests.filter(g => g.cardType?.toUpperCase() === 'VIP').length, [maybeGuests]);

  const pendingGuests = useMemo(() => guests.filter(g => !g.rsvpStatus || g.rsvpStatus === 'Bado'), [guests]);
  const pendingCount = pendingGuests.length;
  const pendingSingle = useMemo(() => pendingGuests.filter(g => !g.cardType || g.cardType === 'SINGLE').length, [pendingGuests]);
  const pendingDouble = useMemo(() => pendingGuests.filter(g => g.cardType === 'DOUBLE' || g.cardType === 'COUPLE').length, [pendingGuests]);
  const pendingVip = useMemo(() => pendingGuests.filter(g => g.cardType?.toUpperCase() === 'VIP').length, [pendingGuests]);

  const checkedInGuests = useMemo(() => guests.filter(g => g.checkedIn), [guests]);
  const checkedInCount = checkedInGuests.length;
  const checkedInSingle = useMemo(() => checkedInGuests.filter(g => !g.cardType || g.cardType === 'SINGLE').length, [checkedInGuests]);
  const checkedInDouble = useMemo(() => checkedInGuests.filter(g => g.cardType === 'DOUBLE' || g.cardType === 'COUPLE').length, [checkedInGuests]);
  const expectedButNotArrived = Math.max(0, attendingCount - checkedInCount);
  const arrivedPax = checkedInGuests.reduce((acc, curr) => {
    const count = curr.rsvpStatus === 'Atahudhuria' ? (curr.rsvpGuestsCount || (curr.cardType === 'DOUBLE' ? 2 : 1)) : (curr.cardType === 'DOUBLE' ? 2 : 1);
    return acc + count;
  }, 0);

  const totalSmsSent = guests.reduce((sum, g) => sum + (g.smsCount || (isStatusSent(g.smsStatus) ? 1 : 0)), 0);
  const totalWhatsappSent = guests.reduce((sum, g) => sum + (g.whatsappCount || (isStatusSent(g.whatsappStatus) ? 1 : 0)), 0);

  // Financial Metrics
  const fundraisingTarget = event.fundraisingGoal || 0;
  const metrics = useMemo(() => {
    let pledgedSum = 0;
    let paidSum = 0;
    guests.forEach(g => {
      pledgedSum += g.pledgeAmount || 0;
      paidSum += g.paidAmount || 0;
    });
    return {
      totalPledgedAmount: pledgedSum,
      totalPaidAmount: paidSum,
      outstandingBalance: Math.max(0, pledgedSum - paidSum)
    };
  }, [guests]);

  // Filters categories for listing, sorted alphabetically by default
  const filteredGuests = useMemo(() => {
    return guests
      .filter(g => {
        const matchesSearch = g.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              (g.phone && g.phone.includes(searchQuery)) ||
                              (g.category && g.category.toLowerCase().includes(searchQuery.toLowerCase()));
        
        if (!matchesSearch) return false;

        if (selectedReport === 'Overall') {
          return true;
        } else if (selectedReport === 'Attendance_Only') {
          return g.checkedIn;
        } else if (selectedReport === 'RSVP_Only') {
          return g.rsvpStatus && g.rsvpStatus !== 'Bado';
        } else if (selectedReport === 'RSVP_Pending') {
          return !g.rsvpStatus || g.rsvpStatus === 'Bado';
        } else if (selectedReport === 'Outstanding') {
          return (g.pledgeAmount || 0) > (g.paidAmount || 0);
        } else if (selectedReport === 'FullyPaid') {
          return (g.pledgeAmount || 0) > 0 && (g.paidAmount || 0) >= (g.pledgeAmount || 0);
        } else if (selectedReport === 'Pledges') {
          return (g.pledgeAmount || 0) > 0;
        } else if (selectedReport === 'NoPledge') {
          return (g.pledgeAmount || 0) === 0;
        }
        return true;
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'sw'));
  }, [guests, selectedReport, searchQuery]);

  // Group level summaries matching standard template
  const groupSummaries = useMemo(() => {
    const list: { name: string; count: number; pledged: number; collected: number; balances: number }[] = [];
    const categories = Array.from(new Set(guests.map(g => g.category || 'WENGINE')));
    
    let totals = { count: 0, pledged: 0, collected: 0, balances: 0 };

    categories.forEach(cat => {
      const sub = guests.filter(g => (g.category || 'WENGINE') === cat);
      let p = 0, c = 0;
      sub.forEach(g => { p += (g.pledgeAmount || 0); c += (g.paidAmount || 0); });
      const bal = Math.max(0, p - c);

      list.push({
        name: cat.toUpperCase(),
        count: sub.length,
        pledged: p,
        collected: c,
        balances: bal
      });

      totals.count += sub.length;
      totals.pledged += p;
      totals.collected += c;
      totals.balances += bal;
    });

    return { list, totals };
  }, [guests]);

  // Pledge status distribution calculations for visualizer chart
  const pledgeStatusData = useMemo(() => {
    let fullyPaidCount = 0;
    let partiallyPaidCount = 0;
    let unpaidPledgeCount = 0;
    let noPledgeCount = 0;

    let fullyPaidValue = 0;
    let partiallyPaidValue = 0;
    let unpaidPledgeValue = 0;

    guests.forEach(g => {
      const pledge = Number(g.pledgeAmount) || 0;
      const paid = Number(g.paidAmount) || 0;
      const rawStatus = g.pledgeStatus;
      const hasPledged = pledge > 0 || paid > 0 || (rawStatus && rawStatus !== 'No Pledge');

      if (hasPledged) {
        if (rawStatus === 'Fully Paid' || (pledge > 0 && paid >= pledge) || (pledge === 0 && paid > 0)) {
          fullyPaidCount++;
          fullyPaidValue += paid;
        } else if (rawStatus === 'Partially Paid' || (paid > 0 && paid < pledge)) {
          partiallyPaidCount++;
          partiallyPaidValue += paid;
        } else {
          unpaidPledgeCount++;
          unpaidPledgeValue += pledge;
        }
      } else {
        noPledgeCount++;
      }
    });

    const totalWithPledges = fullyPaidCount + partiallyPaidCount + unpaidPledgeCount;

    return {
      distribution: [
        { 
          id: 'fully_paid',
          name: isEn ? 'Fully Paid' : 'Waliolipa Yote', 
          count: fullyPaidCount, 
          value: fullyPaidValue,
          color: '#10B981', // Emerald-500
          desc: isEn ? 'Pledges completed in full' : 'Wamefanikiwa kulipa ahadi zote'
        },
        { 
          id: 'partially_paid',
          name: isEn ? 'Partially Paid' : 'Wamelipa Kiasi', 
          count: partiallyPaidCount, 
          value: partiallyPaidValue,
          color: '#3B82F6', // Blue-500
          desc: isEn ? 'Pledge paid with remaining balance' : 'Wamelipa mchango lakini wana salio'
        },
        { 
          id: 'unpaid_pledge',
          name: isEn ? 'Unpaid Pledge' : 'Ahadi Isiyolipwa', 
          count: unpaidPledgeCount, 
          value: unpaidPledgeValue,
          color: '#F59E0B', // Amber-500
          desc: isEn ? 'Registered pledge but zero cash received' : 'Walioweka ahadi lakini bado hawajalipa'
        },
        { 
          id: 'no_pledge',
          name: isEn ? 'No Pledge' : 'Hawajachangia Bado', 
          count: noPledgeCount, 
          value: 0,
          color: '#64748B', // Slate-500
          desc: isEn ? 'No pledge recorded in system' : 'Bado hawajasajili ahadi kwenye mfumo'
        }
      ],
      totals: {
        totalWithPledges,
        fullyPaidCount,
        partiallyPaidCount,
        unpaidPledgeCount,
        noPledgeCount,
        fullyPaidValue,
        partiallyPaidValue,
        unpaidPledgeValue,
        totalPledgedAmount: metrics.totalPledgedAmount,
        totalPaidAmount: metrics.totalPaidAmount
      }
    };
  }, [guests, isEn, metrics]);

  // Compute category attendance expected vs arrived
  const categoryAttendanceData = useMemo(() => {
    const catsMap = new Map<string, { expected: number; arrived: number }>();
    guests.forEach(g => {
      const rawCat = g.cardType || 'SINGLE';
      const cat = rawCat.toUpperCase().trim();
      if (!catsMap.has(cat)) {
        catsMap.set(cat, { expected: 0, arrived: 0 });
      }
      const data = catsMap.get(cat)!;
      if (g.rsvpStatus === 'Atahudhuria') {
        data.expected += (g.rsvpGuestsCount || 1);
      }
      if (g.checkedIn) {
        data.arrived += 1;
      }
    });
    
    const result = Array.from(catsMap.entries()).map(([name, data]) => ({
      name,
      Expected: data.expected,
      Arrived: data.arrived
    }));

    if (result.length === 0) {
      return [
        { name: 'SINGLE', Expected: 12, Arrived: 8 },
        { name: 'DOUBLE', Expected: 8, Arrived: 5 },
        { name: 'VIP', Expected: 5, Arrived: 4 }
      ];
    }
    return result;
  }, [guests]);

  // PDF Report Engine
  const downloadReportPDF = async () => {
    const doc = new jsPDF('p', 'mm', 'a4', false);
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header block Slate Navy
    doc.setFillColor(15, 23, 42);
    doc.rect(10, 10, pageWidth - 20, 20, 'F');
    
    let leftOffset = 15;
    if (systemLogoBase64) {
      try {
        let logoWidth = 24;
        let logoHeight = 10;
        if (systemLogoDims.w && systemLogoDims.h) {
          logoHeight = 10;
          logoWidth = logoHeight * (systemLogoDims.w / systemLogoDims.h);
        }
        doc.addImage(systemLogoBase64, 'PNG', 14, 15, logoWidth, logoHeight);
        leftOffset = 14 + logoWidth + 4;
      } catch (e) {
        console.error("Error adding system logo to PDF report:", e);
      }
    }

    let rightOffset = pageWidth - 15;
    if (eventLogoBase64) {
      try {
        let logoWidth = 15;
        let logoHeight = 15;
        if (eventLogoDims.w && eventLogoDims.h) {
          const ratio = eventLogoDims.w / eventLogoDims.h;
          if (ratio > 1) {
            logoWidth = 15 * ratio;
            logoHeight = 15;
          } else {
            logoWidth = 15;
            logoHeight = 15 / ratio;
          }
        }
        doc.addImage(eventLogoBase64, 'JPEG', pageWidth - 14 - logoWidth, 12.5, logoWidth, logoHeight);
        rightOffset = pageWidth - 14 - logoWidth - 4;
      } catch (e) {
        console.error("Error adding event logo to PDF report:", e);
      }
    }

    doc.setFontSize(7.5);
    doc.setTextColor(243, 244, 246);
    doc.setFont("helvetica", "bold");
    doc.text(`EVENTCARD REPORT ENGINE`, leftOffset, 17);

    const now = new Date();
    const dateFormatted = now.toLocaleDateString('sw-TZ', { year: 'numeric', month: 'long', day: 'numeric' });
    const timeFormatted = now.toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit', hour12: false });
    const printedDateTime = `${dateFormatted} saa ${timeFormatted}`;
    
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.setFont("helvetica", "normal");
    doc.text(`Imetolewa: ${printedDateTime}`, rightOffset, 17, { align: 'right' });

    let titleText = "";
    let subTitleText = "";

    switch (selectedReport) {
      case 'Overall':
        titleText = "OVERALL EVENT REGISTER & ATTENDANCE SUMMARY";
        subTitleText = isEn ? "General Report and Card Attendance Summary" : "Ripoti ya Jumla na Muhtasari wa Mahudhurio ya Kadi";
        break;
      case 'Attendance_Only':
        titleText = "GUESTS CHECK-IN & ARRIVAL REGISTER";
        subTitleText = "Daftari la Mahudhurio ya Kadi Zilizoskaniwa";
        break;
      case 'RSVP_Only':
        titleText = "CONFIRMED RSVP RESPONSES LOG";
        subTitleText = isEn ? "Complete List of Guests with Confirmed RSVP" : "Orodha Kamili ya Wageni Waliothibitisha Majibu";
        break;
      case 'RSVP_Pending':
        titleText = "PENDING RSVP - UNRESPONDED CAMPAIGN";
        subTitleText = isEn ? "Guests with Pending RSVP Responses" : "Wageni Ambapo RSVP Bado haijajibiwa";
        break;
      case 'Outstanding':
        titleText = "DUE BALANCES & OUTSTANDING REGISTER";
        subTitleText = "Wenye Salio la Deni Inayodaiwa";
        break;
      case 'FullyPaid':
        titleText = "FULLY PAID CONTRIBUTIONS LEDGER";
        subTitleText = isEn ? "Fully Paid Members" : "Waliolipa Ahadi Kikamilifu";
        break;
      case 'Pledges':
        titleText = "ACTIVE COMMITMENTS & PLEDGES REGISTER";
        subTitleText = isEn ? "List of Guests with Registered Contribution Pledges" : "Orodha ya Wageni Waliosajili Ahadi za Michango";
        break;
      case 'NoPledge':
        titleText = "GUESTS WITH NO RECORDED PLEDGES";
        subTitleText = isEn ? "Guests Without Pledges or Received Contributions" : "Wasioonyesha Ahadi au Mapokezi ya Mchango";
        break;
      default:
        titleText = "EVENT DETAIL REPORT";
        subTitleText = "Maelezo ya Kina ya Ripoti";
    }

    doc.setFontSize(10.5);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text(titleText.toUpperCase(), leftOffset, 25);
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(251, 191, 36); // Amber
    doc.text(subTitleText, rightOffset, 25, { align: 'right' });

    // Subheader Event details
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "normal");
    doc.text("Sherehe / Event: ", 10, 36);
    const wEventLabel = doc.getTextWidth("Sherehe / Event: "); 

    doc.setFont("helvetica", "bold");
    const eventNameUpper = `${event.name.toUpperCase()}`;
    doc.text(eventNameUpper, 10 + wEventLabel, 36);
    const wEventName = doc.getTextWidth(eventNameUpper);

    doc.setFont("helvetica", "normal");
    const dateLabel = isEn ? " • Date: " : " • Tarehe: ";
    doc.text(dateLabel, 10 + wEventLabel + wEventName, 36);
    const wDateLabel = doc.getTextWidth(dateLabel);

    doc.setFont("helvetica", "bold");
    const eventDateVal = `${event.date || '-'}`;
    doc.text(eventDateVal, 10 + wEventLabel + wEventName + wDateLabel, 36);

    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.5);
    doc.line(10, 39, pageWidth - 10, 39);

    // DYNAMIC METRIC SUMMARY CARDS FOR ALL REPORT TYPES
    const cardY = 44;
    const cardHeight = 16;
    let tableStartY = 64;

    let cardsData: { label: string; value: string; color: number[] }[] = [];

    if (selectedReport === 'Overall') {
      cardsData = [
        { label: isEn ? "CONFIRMED (YES)" : "WATAHUDHURIA (YES)", value: `${attendingCount} (S:${attendingSingle} D:${attendingDouble})`, color: [22, 163, 74] },
        { label: isEn ? "DECLINED (NO)" : "HAWATAKUJA (NO)", value: `${declinedCount} (S:${declinedSingle} D:${declinedDouble})`, color: [225, 29, 72] },
        { label: isEn ? "MAYBE / UNDECIDED" : "HAWANA UHAKIKA", value: `${maybeCount} (S:${maybeSingle} D:${maybeDouble})`, color: [217, 119, 6] },
        { label: isEn ? "PENDING RESPONSE" : "BADO HAWAJACONFIRM", value: `${pendingCount} (S:${pendingSingle} D:${pendingDouble})`, color: [100, 116, 139] },
        { label: isEn ? "TOTAL CARDS" : "JUMLA YA KADI", value: `${totalGuestsCount} (S:${singleCardsCount} D:${doubleCardsCount})`, color: [15, 23, 42] }
      ];
    } else if (selectedReport === 'Attendance_Only') {
      cardsData = [
        { label: isEn ? "RSVP ATTENDING" : "WALIOTHIBITISHA", value: `${attendingCount} Kadi`, color: [15, 23, 42] },
        { label: isEn ? "ARRIVED GUESTS" : "WALIOFIKA (ARRIVED)", value: `${checkedInCount} Kadi scans`, color: [22, 163, 74] },
        { label: isEn ? "ADMISSION RATIO" : "ASILIMIA YA MAHUDHURIO", value: `${arivedPercent()}% Imeskaniwa`, color: [59, 130, 246] }
      ];
    } else if (selectedReport === 'RSVP_Only') {
      cardsData = [
        { label: isEn ? "ATTENDING (YES)" : "WANAOKUJA (YES)", value: `${attendingCount} Kadi`, color: [22, 163, 74] },
        { label: isEn ? "DECLINED (NO)" : "WASIOKUJA (NO)", value: `${declinedCount} Kadi`, color: [225, 29, 72] },
        { label: isEn ? "UNDECIDED (MAYBE)" : "WASIOUHASIKA (MAYBE)", value: `${maybeCount} Kadi`, color: [245, 158, 11] }
      ];
    } else if (selectedReport === 'RSVP_Pending') {
      const pendingRatio = totalGuestsCount > 0 ? Math.round((pendingCount / totalGuestsCount) * 100) : 0;
      cardsData = [
        { label: isEn ? "TOTAL CARDS" : "JUMLA KADI", value: `${totalGuestsCount} Kadi`, color: [15, 23, 42] },
        { label: isEn ? "PENDING RSVP REPLIES" : "BADO HAWAJAJIBU", value: `${pendingCount} Wageni`, color: [245, 158, 11] },
        { label: isEn ? "UNRESPONDED RATIO" : "UWIANO WA WASIOJIBU", value: `${pendingRatio}% ya wageni`, color: [225, 29, 72] }
      ];
    } else if (selectedReport === 'Outstanding') {
      const pctPaidVsPledged = metrics.totalPledgedAmount > 0 ? ((metrics.totalPaidAmount / metrics.totalPledgedAmount) * 100).toFixed(1) : '0';
      cardsData = [
        { label: isEn ? "TOTAL PLEDGED" : "JUMLA YA AHADI", value: `${metrics.totalPledgedAmount.toLocaleString()} TZS`, color: [245, 158, 11] },
        { label: isEn ? "CASH COLLECTED" : "FEDHA TASLIMU", value: `${metrics.totalPaidAmount.toLocaleString()} TZS (${pctPaidVsPledged}%)`, color: [22, 163, 74] },
        { label: isEn ? "OUTSTANDING DUE" : "SALIO LINOLODAIWA", value: `${metrics.outstandingBalance.toLocaleString()} TZS`, color: [225, 29, 72] }
      ];
    } else if (selectedReport === 'FullyPaid') {
      const fullyPaidRatio = pledgeStatusData.totals.totalWithPledges > 0 ? Math.round((pledgeStatusData.totals.fullyPaidCount / pledgeStatusData.totals.totalWithPledges) * 100) : 0;
      cardsData = [
        { label: isEn ? "TOTAL COLLECTED" : "FEDHA TASLIMU", value: `${metrics.totalPaidAmount.toLocaleString()} TZS`, color: [22, 163, 74] },
        { label: isEn ? "FULLY PAID GUESTS" : "WALIOLIPA YOTE", value: `${pledgeStatusData.totals.fullyPaidCount} Kadi`, color: [59, 130, 246] },
        { label: isEn ? "CLEARANCE RATIO" : "ASILIMIA YA ULIPAJI KAMILI", value: `${fullyPaidRatio}% ya wachangiaji`, color: [15, 23, 42] }
      ];
    } else if (selectedReport === 'Pledges') {
      const pctPaidVsTarget = fundraisingTarget > 0 ? ((metrics.totalPaidAmount / fundraisingTarget) * 100).toFixed(1) : '0';
      const pctPaidVsPledged = metrics.totalPledgedAmount > 0 ? ((metrics.totalPaidAmount / metrics.totalPledgedAmount) * 100).toFixed(1) : '0';
      cardsData = [
        { label: isEn ? "BUDGET TARGET" : "MALENGO YA BAJETI", value: `${fundraisingTarget.toLocaleString()} TZS`, color: [59, 130, 246] },
        { label: isEn ? "TOTAL PLEDGES" : "JUMLA AHADI", value: `${metrics.totalPledgedAmount.toLocaleString()} TZS`, color: [245, 158, 11] },
        { label: isEn ? "COLLECTED VIA TARGET" : "MAKUSANYO (VIA TARGET)", value: `${pctPaidVsTarget}% ya Bajeti`, color: [16, 185, 129] },
        { label: isEn ? "COLLECTED VIA PLEDGE" : "MAKUSANYO (VIA AHADI)", value: `${pctPaidVsPledged}% ya Ahadi`, color: [14, 116, 144] }
      ];
    } else if (selectedReport === 'NoPledge') {
      const noPledgeRatio = totalGuestsCount > 0 ? Math.round((pledgeStatusData.totals.noPledgeCount / totalGuestsCount) * 100) : 0;
      cardsData = [
        { label: isEn ? "TOTAL CARDS" : "JUMLA KADI ALIKWA", value: `${totalGuestsCount} Kadi`, color: [15, 23, 42] },
        { label: isEn ? "NO RECORDED PLEDGE" : "WASIOAHIDI BADO", value: `${pledgeStatusData.totals.noPledgeCount} Wageni`, color: [225, 29, 72] },
        { label: isEn ? "UNCOMMITTED RATIO" : "UWIANO WA WASIOAHIDI", value: `${noPledgeRatio}% ya Kadi`, color: [245, 158, 11] }
      ];
    }

    if (cardsData.length > 0) {
      const cardWidth = (pageWidth - 20 - (cardsData.length - 1) * 3) / cardsData.length;
      cardsData.forEach((card, i) => {
        const x = 10 + i * (cardWidth + 3);
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(218, 223, 230);
        doc.rect(x, cardY, cardWidth, cardHeight, 'FD');
        doc.setFontSize(6);
        doc.setTextColor(100, 116, 139);
        doc.setFont("helvetica", "bold");
        doc.text(card.label, x + cardWidth / 2, cardY + 5, { align: 'center' });
        doc.setFontSize(8);
        doc.setTextColor(card.color[0], card.color[1], card.color[2]);
        doc.text(card.value, x + cardWidth / 2, cardY + 11, { align: 'center' });
      });
      tableStartY = 66;
    }

    if (selectedReport === 'Overall') {
      // RSVP category breakdown + message stats bar
      doc.setFillColor(241, 245, 249);
      doc.rect(10, tableStartY, pageWidth - 20, 12, 'F');
      doc.setFontSize(6.8);
      doc.setTextColor(30, 41, 59);
      doc.setFont("helvetica", "bold");
      const rsvpBreakdownStr = isEn
        ? `RSVP BREAKDOWN: Attending: ${attendingCount} (Single: ${attendingSingle}, Double: ${attendingDouble} - ${totalRsvpPax} Pax) | Declined: ${declinedCount} (S: ${declinedSingle}, D: ${declinedDouble}) | Maybe: ${maybeCount} (S: ${maybeSingle}, D: ${maybeDouble}) | Pending: ${pendingCount} (S: ${pendingSingle}, D: ${pendingDouble})`
        : `AINA ZA KADI: Watahudhuria: ${attendingCount} Kadi (Single: ${attendingSingle}, Double: ${attendingDouble} - Watu: ${totalRsvpPax}) | Hawatakuja: ${declinedCount} (Single: ${declinedSingle}, Double: ${declinedDouble}) | Hawana Uhakika: ${maybeCount} (Single: ${maybeSingle}, Double: ${maybeDouble}) | Bado Jibu: ${pendingCount} (Single: ${pendingSingle}, Double: ${pendingDouble})`;
      doc.text(rsvpBreakdownStr, 12, tableStartY + 4.5);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(71, 85, 105);
      const dispatchSummaryStr = `Jumla ya Kadi: ${totalGuestsCount} (Single: ${singleCardsCount}, Double: ${doubleCardsCount}${vipCardsCount > 0 ? `, VIP: ${vipCardsCount}` : ''})  •  Waliofika: ${checkedInCount} (Single: ${checkedInSingle}, Double: ${checkedInDouble})  •  Uwiano: ${arivedPercent()}%  •  SMS Sent: ${totalSmsSent}  •  WA Sent: ${totalWhatsappSent}`;
      doc.text(dispatchSummaryStr, 12, tableStartY + 9.5);
      tableStartY += 16;

      const tableData = filteredGuests.map((g, idx) => [
        idx + 1,
        g.name.toUpperCase(),
        g.phone || '-',
        g.cardType || 'SINGLE',
        g.rsvpStatus || 'BADO JIBU',
        g.rsvpStatus === 'Atahudhuria' ? (g.rsvpGuestsCount || (g.cardType === 'DOUBLE' ? 2 : 1)) : 0,
        g.checkedIn ? 'NDIO (ARRIVED)' : 'BADO (ABSENT)',
        g.checkedInTime ? g.checkedInTime : '-',
        g.smsCount || (isStatusSent(g.smsStatus) ? 1 : 0),
        g.whatsappCount || (isStatusSent(g.whatsappStatus) ? 1 : 0)
      ]);

      autoTable(doc, {
        startY: tableStartY,
        head: [['S/N', 'Full Name', 'Mobile No.', 'Card Type', 'RSVP Answer', 'Pax', 'Check-In', 'Time Arrived', 'SMS', 'WA']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontSize: 8, fontStyle: 'bold', lineColor: [0, 0, 0], lineWidth: 0.5 },
        bodyStyles: { textColor: [0, 0, 0], fontSize: 8, lineColor: [0, 0, 0] },
        styles: { cellPadding: { top: 1.5, bottom: 1.5, left: 3, right: 3 }, fontSize: 8, lineColor: [0, 0, 0], lineWidth: 0.5, textColor: [0, 0, 0] },
        columnStyles: {
          0: { halign: 'center' },
          3: { halign: 'center' },
          4: { halign: 'center' },
          5: { halign: 'center' },
          6: { halign: 'center' },
          7: { halign: 'center' },
          8: { halign: 'center' },
          9: { halign: 'center' }
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 6) {
            const val = data.cell.text[0];
            if (val && val.includes('ARRIVED')) {
              data.cell.styles.textColor = [22, 163, 74];
              data.cell.styles.fontStyle = 'bold';
            }
          }
          if (data.section === 'body' && data.column.index === 4) {
            const val = data.cell.text[0];
            if (val === 'Atahudhuria') {
              data.cell.styles.textColor = [22, 163, 74];
            } else if (val === 'Hatahudhuria') {
              data.cell.styles.textColor = [185, 28, 28];
            }
          }
        }
      });
    } else if (selectedReport === 'Attendance_Only') {
      const sortedCheckedIn = [...filteredGuests].sort((a,b) => (b.checkedInTime || '').localeCompare(a.checkedInTime || ''));
      const tableData = sortedCheckedIn.map((g, idx) => [
        idx + 1,
        g.checkedInTime || '-',
        g.name.toUpperCase(),
        g.phone || '-',
        g.cardType || 'SINGLE',
        'SUCCESS SCAN',
        g.smsCount || (isStatusSent(g.smsStatus) ? 1 : 0),
        g.whatsappCount || (isStatusSent(g.whatsappStatus) ? 1 : 0)
      ]);

      tableData.push([
        'T',
        'TOTALS',
        `${sortedCheckedIn.length} Kadi Zilizothibitishwa`,
        '-',
        '-',
        '-',
        totalSmsSent,
        totalWhatsappSent
      ]);

      autoTable(doc, {
        startY: tableStartY,
        head: [['S/N', isEn ? 'Time Arrived' : 'Muda (Time Arrived)', isEn ? 'Guest Full Name' : 'Mgeni (Guest Full Name)', isEn ? 'Mobile' : 'Simu / Mobile', isEn ? 'Card Type' : 'Aina ya Kadi', 'Scan Status', 'SMS', 'WA']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontSize: 8, fontStyle: 'bold', lineColor: [0, 0, 0], lineWidth: 0.5 },
        bodyStyles: { textColor: [0, 0, 0], fontSize: 8, lineColor: [0, 0, 0] },
        styles: { cellPadding: { top: 1.5, bottom: 1.5, left: 3, right: 3 }, fontSize: 8, lineColor: [0, 0, 0], lineWidth: 0.5, textColor: [0, 0, 0] },
        columnStyles: {
          0: { halign: 'center' },
          1: { fontStyle: 'bold' },
          4: { halign: 'center' },
          5: { halign: 'center', textColor: [22, 163, 74], fontStyle: 'bold' },
          6: { halign: 'center' },
          7: { halign: 'center' }
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.row.index === tableData.length - 1) {
            data.cell.styles.fillColor = [241, 245, 249];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      });
    } else if (selectedReport === 'RSVP_Only') {
      const tableData = filteredGuests.map((g, idx) => [
        idx + 1,
        g.name.toUpperCase(),
        g.phone || '-',
        g.rsvpStatus || 'Bado',
        g.cardType || 'SINGLE',
        g.checkedIn ? 'ARRIVED' : 'BADO',
        g.smsCount || (isStatusSent(g.smsStatus) ? 1 : 0)
      ]);

      autoTable(doc, {
        startY: tableStartY,
        head: [['S/N', 'Guest Name', 'Mobile No', 'RSVP Status', 'Double/Single', 'Check-In Status', 'SMS Sent']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontSize: 8, fontStyle: 'bold', lineColor: [0, 0, 0], lineWidth: 0.5 },
        bodyStyles: { textColor: [0, 0, 0], fontSize: 8, lineColor: [0, 0, 0] },
        styles: { cellPadding: { top: 1.5, bottom: 1.5, left: 3, right: 3 }, fontSize: 8, lineColor: [0, 0, 0], lineWidth: 0.5, textColor: [0, 0, 0] },
        columnStyles: {
          0: { halign: 'center' },
          3: { halign: 'center' },
          4: { halign: 'center' },
          5: { halign: 'center' },
          6: { halign: 'center' }
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 3) {
            const val = data.cell.text[0];
            if (val === 'Atahudhuria') {
              data.cell.styles.textColor = [22, 163, 74];
              data.cell.styles.fontStyle = 'bold';
            } else if (val === 'Hatahudhuria') {
              data.cell.styles.textColor = [225, 29, 72];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        }
      });
    } else if (selectedReport === 'RSVP_Pending') {
      const tableData = filteredGuests.map((g, idx) => [
        idx + 1,
        g.name.toUpperCase(),
        g.phone || '-',
        g.cardType || 'SINGLE',
        `https://eventcard.co.tz/pledge/${g.code}`,
        g.smsCount || 0,
        g.whatsappCount || 0
      ]);

      autoTable(doc, {
        startY: tableStartY,
        head: [['S/N', 'Guest Name', 'Mobile No', 'Card Type', 'RSVP Link', 'SMS Dispatches', 'WA Dispatches']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontSize: 8, fontStyle: 'bold', lineColor: [0, 0, 0], lineWidth: 0.5 },
        bodyStyles: { textColor: [0, 0, 0], fontSize: 8, lineColor: [0, 0, 0] },
        styles: { cellPadding: { top: 1.5, bottom: 1.5, left: 3, right: 3 }, fontSize: 8, lineColor: [0, 0, 0], lineWidth: 0.5, textColor: [0, 0, 0] },
        columnStyles: {
          0: { halign: 'center' },
          3: { halign: 'center' },
          4: { textColor: [37, 99, 235], fontStyle: 'italic' },
          5: { halign: 'center' },
          6: { halign: 'center' }
        }
      });
    } else if (selectedReport === 'Outstanding') {
      const tableData = filteredGuests.map((g, idx) => {
        const b = (g.pledgeAmount || 0) - (g.paidAmount || 0);
        return [
          idx + 1,
          g.name.toUpperCase(),
          g.phone || '-',
          (g.pledgeAmount || 0).toLocaleString(),
          (g.paidAmount || 0).toLocaleString(),
          b.toLocaleString(),
          g.smsCount || (isStatusSent(g.smsStatus) ? 1 : 0),
          g.whatsappCount || (isStatusSent(g.whatsappStatus) ? 1 : 0)
        ];
      });

      const totalPledged = filteredGuests.reduce((sum, g) => sum + (g.pledgeAmount || 0), 0);
      const totalPaid = filteredGuests.reduce((sum, g) => sum + (g.paidAmount || 0), 0);
      const totalBal = totalPledged - totalPaid;

      tableData.push([
        'T',
        'JUMLA YA MADENI',
        '-',
        totalPledged.toLocaleString(),
        totalPaid.toLocaleString(),
        totalBal.toLocaleString(),
        '-',
        '-'
      ]);

      autoTable(doc, {
        startY: tableStartY,
        head: [['S/N', 'Guest Name', 'Mobile Phone', 'Pledge (TZS)', 'Paid (TZS)', 'Balance Due (TZS)', 'SMS', 'WA']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontSize: 8, fontStyle: 'bold', lineColor: [0, 0, 0], lineWidth: 0.5 },
        bodyStyles: { textColor: [0, 0, 0], fontSize: 8, lineColor: [0, 0, 0] },
        styles: { cellPadding: { top: 1.5, bottom: 1.5, left: 3, right: 3 }, fontSize: 8, lineColor: [0, 0, 0], lineWidth: 0.5, textColor: [0, 0, 0] },
        columnStyles: {
          0: { halign: 'center' },
          3: { halign: 'right' },
          4: { halign: 'right' },
          5: { halign: 'right', fontStyle: 'bold', textColor: [185, 28, 28] }
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.row.index === tableData.length - 1) {
            data.cell.styles.fillColor = [241, 245, 249];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      });
    } else {
      // General handler for fallback listing (Pledges, NoPledge, FullyPaid, etc.)
      const tableData = filteredGuests.map((g, idx) => [
        idx + 1,
        g.name.toUpperCase(),
        g.phone || '-',
        g.cardType || 'SINGLE',
        (g.pledgeAmount || 0).toLocaleString(),
        (g.paidAmount || 0).toLocaleString(),
        ((g.pledgeAmount || 0) - (g.paidAmount || 0)).toLocaleString(),
        g.rsvpStatus || 'Bado',
        g.checkedIn ? 'ARRIVED' : 'BADO'
      ]);

      autoTable(doc, {
        startY: tableStartY,
        head: [['S/N', 'Full Name', 'Mobile Phone', 'Ticket Type', 'Pledge Amt', 'Paid Amt', 'Balance Due', 'RSVP Answer', 'Admission']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontSize: 8, fontStyle: 'bold', lineColor: [0, 0, 0], lineWidth: 0.5 },
        bodyStyles: { textColor: [0, 0, 0], fontSize: 8, lineColor: [0, 0, 0] },
        styles: { cellPadding: { top: 1.5, bottom: 1.5, left: 3, right: 3 }, fontSize: 8, lineColor: [0, 0, 0], lineWidth: 0.5, textColor: [0, 0, 0] },
        columnStyles: {
          0: { halign: 'center' },
          4: { halign: 'right' },
          5: { halign: 'right' },
          6: { halign: 'right', fontStyle: 'bold' },
          7: { halign: 'center' },
          8: { halign: 'center' }
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 6) {
            const val = parseFloat(data.cell.text[0].replace(/,/g, ''));
            if (val > 0) {
              data.cell.styles.textColor = [225, 29, 72];
            } else if (val === 0) {
              data.cell.styles.textColor = [22, 163, 74];
            }
          }
        }
      });
    }

    // SIGNATURE SIGN-OFF AND APPROVAL SECTION
    let finalY = (doc as any).lastAutoTable.finalY + 15;
    if (finalY > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage();
      finalY = 20;
    }

    // Signatures Header
    doc.setDrawColor(226, 232, 240); // Slate 200
    doc.line(10, finalY, pageWidth - 10, finalY);
    finalY += 6;

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59); // Slate 800
    doc.text(isEn ? "OFFICIAL COMMITTEE SIGN-OFF & APPROVAL" : "IDHINI NA SAHIHI ZA VIONGOZI WA KAMATI", 10, finalY);
    
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100, 116, 139); // Slate 500
    doc.text(isEn ? "This document is verified and officially approved by the event executive committee." : "Hati hii imethibitishwa na kupitishwa rasmi na viongozi wakuu wa kamati ya maandalizi.", 10, finalY + 4);
    
    finalY += 16;

    // Side-by-side signature lines
    const colWidth = (pageWidth - 30) / 3;
    
    // 1. Chairman
    doc.setFont("helvetica", "bold");
    doc.setTextColor(51, 65, 85);
    doc.line(10, finalY, 10 + colWidth, finalY);
    doc.text(isEn ? "Chairperson / Mwenyekiti" : "Mwenyekiti / Chairperson", 10, finalY + 4);
    doc.setFont("helvetica", "normal");
    doc.text("Date: ____ / ____ / ________", 10, finalY + 8);

    // 2. Treasurer
    doc.setFont("helvetica", "bold");
    doc.line(15 + colWidth, finalY, 15 + colWidth * 2, finalY);
    doc.text(isEn ? "Treasurer / Mweka Hazina" : "Mweka Hazina / Treasurer", 15 + colWidth, finalY + 4);
    doc.setFont("helvetica", "normal");
    doc.text("Date: ____ / ____ / ________", 15 + colWidth, finalY + 8);

    // 3. Secretary
    doc.setFont("helvetica", "bold");
    doc.line(20 + colWidth * 2, finalY, pageWidth - 10, finalY);
    doc.text(isEn ? "Secretary / Katibu" : "Katibu / Secretary", 20 + colWidth * 2, finalY + 4);
    doc.setFont("helvetica", "normal");
    doc.text("Date: ____ / ____ / ________", 20 + colWidth * 2, finalY + 8);

    await addPdfWatermarks(doc);
    doc.save(`EventReport_${selectedReport}_${event.name.replace(/\s+/g, '_')}.pdf`);
  };

  function arivedPercent() {
    if (attendingCount === 0) {
      return totalGuestsCount > 0 ? Math.round((checkedInCount / totalGuestsCount) * 100) : 0;
    }
    return Math.round((checkedInCount / attendingCount) * 100);
  }

  // Executive summary states and functions
  const [copySuccess, setCopySuccess] = useState(false);

  const generateTextSummary = () => {
    const collectedRatio = metrics.totalPledgedAmount > 0 ? Math.round((metrics.totalPaidAmount / metrics.totalPledgedAmount) * 100) : 0;
    const goalCoverageRatio = fundraisingTarget > 0 ? Math.round((metrics.totalPaidAmount / fundraisingTarget) * 100) : 0;
    
    let text = `========================================\n`;
    text += `📝 MUHTASARI KIUTENDAJI / EXECUTIVE SUMMARY\n`;
    text += `========================================\n\n`;
    text += `🎈 SHEREHE: ${event.name.toUpperCase()}\n`;
    text += `🆔 ID YA TUKIO: ${event.id}\n`;
    text += `📅 TAREHE YAKE: ${event.date || '-'}\n`;
    text += `🎯 MALENGO (GOAL): TZS ${fundraisingTarget ? fundraisingTarget.toLocaleString() : 'Kiutendaji'}\n\n`;
    
    text += `📋 1. RIPOTI YA MAHUDHURIO NA RSVP:\n`;
    text += `----------------------------------------\n`;
    text += `• Kadi Zote Zilizopo (Total Cards): ${totalGuestsCount} (Single: ${singleCardsCount}, Double: ${doubleCardsCount}${vipCardsCount > 0 ? `, VIP: ${vipCardsCount}` : ''})\n`;
    text += `• Watakaohudhuria (RSVP Yes): ${attendingCount} Kadi (Single: ${attendingSingle}, Double: ${attendingDouble}${attendingVip > 0 ? `, VIP: ${attendingVip}` : ''} — Watu: ${totalRsvpPax})\n`;
    text += `• Hawatakuja (RSVP No / Declined): ${declinedCount} Kadi (Single: ${declinedSingle}, Double: ${declinedDouble}${declinedVip > 0 ? `, VIP: ${declinedVip}` : ''})\n`;
    text += `• Hawana Uhakika (RSVP Maybe): ${maybeCount} Kadi (Single: ${maybeSingle}, Double: ${maybeDouble}${maybeVip > 0 ? `, VIP: ${maybeVip}` : ''})\n`;
    text += `• Bado Hawajaconfirm (Pending): ${pendingCount} Kadi (Single: ${pendingSingle}, Double: ${pendingDouble}${pendingVip > 0 ? `, VIP: ${pendingVip}` : ''})\n`;
    text += `• Kadi Zilizofika na Kuskaniwa: ${checkedInCount} Kadi (Single: ${checkedInSingle}, Double: ${checkedInDouble} — ${arivedPercent()}% uwiano)\n`;
    text += `• Ujumbe wa Kikampeni (SMS Sent): ${totalSmsSent}\n`;
    text += `• Ujumbe wa WA (WA Sent): ${totalWhatsappSent}\n\n`;
    
    text += `💰 2. MUHTASARI WA CHANGO NA FEDHA:\n`;
    text += `----------------------------------------\n`;
    text += `• Jumla ya Ahadi (Pledged): TZS ${metrics.totalPledgedAmount.toLocaleString()}\n`;
    text += `• Jumla Zilizokusanywa (Paid): TZS ${metrics.totalPaidAmount.toLocaleString()} (${collectedRatio}% ya ahadi)\n`;
    text += `• Ahadi Zisizolipwa (Unpaid Balances): TZS ${metrics.outstandingBalance.toLocaleString()}\n`;
    if (fundraisingTarget > 0) {
      text += `• Ukuaji wa Malengo ya Bajeti: ${goalCoverageRatio}% imefikiwa\n`;
    }
    text += `\n`;
    
    text += `👥 3. JEDWALI LA MAKUNDI / VIKAO:\n`;
    text += `----------------------------------------\n`;
    groupSummaries.list.forEach(grp => {
      text += `👉 ${grp.name}:\n`;
      text += `   - Kadi: ${grp.count}\n`;
      text += `   - Ahadi: TZS ${grp.pledged.toLocaleString()}\n`;
      text += `   - Kulipwa: TZS ${grp.collected.toLocaleString()}\n`;
      text += `   - Salio: TZS ${grp.balances.toLocaleString()}\n`;
    });
    
    text += `\n----------------------------------------\n`;
    text += `JUMLA KUU MAPATO:\n`;
    text += `• Jumla Kadi: ${groupSummaries.totals.count}\n`;
    text += `• Jumla Ahadi: TZS ${groupSummaries.totals.pledged.toLocaleString()}\n`;
    text += `• Jumla Iliyolipwa: TZS ${groupSummaries.totals.collected.toLocaleString()}\n`;
    text += `• Jumla Salio linalodaiwa: TZS ${groupSummaries.totals.balances.toLocaleString()}\n`;
    text += `\n========================================\n`;
    text += `Imetengenezwa kiotomatiki na EventCard System Mnamo: ${new Date().toLocaleString()}\n`;
    text += `========================================`;
    
    return text;
  };

  const copyTextSummary = () => {
    const textSummary = generateTextSummary();
    navigator.clipboard.writeText(textSummary).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }).catch(err => {
      console.error("Kushindwa kunakili:", err);
    });
  };

  const downloadTextSummaryFile = () => {
    const textSummary = generateTextSummary();
    const blob = new Blob([textSummary], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Executive_Summary_${event.name.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadComprehensiveExecutiveSummaryPDF = async () => {
    const doc = new jsPDF('p', 'mm', 'a4', false);
    const pageWidth = doc.internal.pageSize.getWidth();
    let currentY = 15;

    // Header Panel
    doc.setFillColor(15, 23, 42); 
    doc.rect(10, currentY, pageWidth - 20, 24, 'F');
    
    let startTextX = 15;
    if (systemLogoBase64) {
      try {
        let logoWidth = 28;
        let logoHeight = 12;
        if (systemLogoDims.w && systemLogoDims.h) {
          logoHeight = 12;
          logoWidth = logoHeight * (systemLogoDims.w / systemLogoDims.h);
        }
        doc.addImage(systemLogoBase64, 'PNG', 14, currentY + 6, logoWidth, logoHeight);
        startTextX = 14 + logoWidth + 4;
      } catch (e) {
        console.error("Error adding system logo to executive summary:", e);
      }
    }

    let rightAlignX = pageWidth - 15;
    if (eventLogoBase64) {
      try {
        let logoWidth = 15;
        let logoHeight = 15;
        if (eventLogoDims.w && eventLogoDims.h) {
          const ratio = eventLogoDims.w / eventLogoDims.h;
          if (ratio > 1) {
            logoWidth = 15 * ratio;
            logoHeight = 15;
          } else {
            logoWidth = 15;
            logoHeight = 15 / ratio;
          }
        }
        doc.addImage(eventLogoBase64, 'JPEG', pageWidth - 14 - logoWidth, currentY + 4.5, logoWidth, logoHeight);
        rightAlignX = pageWidth - 14 - logoWidth - 4;
      } catch (e) {
        console.error("Error adding event logo to executive summary:", e);
      }
    }

    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text(event.name.toUpperCase(), startTextX, currentY + 10);
    
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(156, 163, 175);
    doc.text(`ID: ${event.id}  |  Tarehe ya Tukio: ${event.date || '-'}  |  Mchapishaji: EventCard Reports`, startTextX, currentY + 18);
    
    doc.setTextColor(251, 191, 36); 
    doc.setFont("helvetica", "italic");
    doc.text(isEn ? "EXECUTIVE REPORT" : "MUHTASARI WA UTENDAJI", rightAlignX, currentY + 10, { align: 'right' });
    
    currentY += 32;

    // SECTION 1: ATTENDANCE & RSVP METRICS
    doc.setFillColor(30, 41, 59); 
    doc.rect(10, currentY, pageWidth - 20, 7, 'F');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text(isEn ? "1. RSVP STATUS & ATTENDANCE SUMMARY" : "1. MUHTASARI WA RSVP NA MAHUDHURIO", 13, currentY + 5);
    
    currentY += 12;

    const rsvpTableData = [
      [isEn ? "Total Guests Listed" : "Jumla ya Wageni Walioorodheshwa", `${totalGuestsCount} ${isEn ? 'Cards' : 'Kadi'} (Single: ${singleCardsCount}, Double: ${doubleCardsCount}${vipCardsCount > 0 ? `, VIP: ${vipCardsCount}` : ''})`],
      [isEn ? "Confirmed RSVP Yes (Attending)" : "Watakaohudhuria (RSVP Yes)", `${attendingCount} ${isEn ? 'Cards' : 'Kadi'} (Single: ${attendingSingle}, Double: ${attendingDouble}${attendingVip > 0 ? `, VIP: ${attendingVip}` : ''} — ${totalRsvpPax} ${isEn ? 'Pax' : 'Watu'})`],
      [isEn ? "Confirmed RSVP No (Declined)" : "Hawatakuja (RSVP Declined)", `${declinedCount} ${isEn ? 'Cards' : 'Kadi'} (Single: ${declinedSingle}, Double: ${declinedDouble}${declinedVip > 0 ? `, VIP: ${declinedVip}` : ''})`],
      [isEn ? "Maybe / Undecided Answer" : "Hawana Uhakika (RSVP Maybe)", `${maybeCount} ${isEn ? 'Cards' : 'Kadi'} (Single: ${maybeSingle}, Double: ${maybeDouble}${maybeVip > 0 ? `, VIP: ${maybeVip}` : ''})`],
      [isEn ? "Pending / Unconfirmed" : "Bado Hawajaconfirm (Pending)", `${pendingCount} ${isEn ? 'Cards' : 'Kadi'} (Single: ${pendingSingle}, Double: ${pendingDouble}${pendingVip > 0 ? `, VIP: ${pendingVip}` : ''})`],
      [isEn ? "Actual Checked-In Scan Arrivals" : "Mahudhurio Halisi (Arrived Scans)", `${checkedInCount} ${isEn ? 'Cards' : 'Kadi'} (Single: ${checkedInSingle}, Double: ${checkedInDouble} — ${arivedPercent()}% ${isEn ? 'Admission Ratio' : 'uwiano'})`],
    ];

    autoTable(doc, {
      startY: currentY,
      head: [[isEn ? "RSVP Metric / Attribute" : "Kipengele cha RSVP & Mahudhurio", isEn ? "Status Summary / Value" : "Idadi / Thamani"]],
      body: rsvpTableData,
      theme: 'grid',
      headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255], fontSize: 8.5 },
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: {
        1: { halign: 'right', fontStyle: 'bold' }
      }
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;

    // SECTION 2: FINANCIAL PERFORMANCE & CONTRIBUTIONS
    doc.setFillColor(30, 41, 59); 
    doc.rect(10, currentY, pageWidth - 20, 7, 'F');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text(isEn ? "2. FINANCIAL PERFORMANCE & CONTRIBUTIONS" : "2. UTENDAJI WA MICHANGO NA FEDHA", 13, currentY + 5);
    
    currentY += 12;

    const collectedRatio = metrics.totalPledgedAmount > 0 ? Math.round((metrics.totalPaidAmount / metrics.totalPledgedAmount) * 100) : 0;
    const goalCoverageRatio = fundraisingTarget > 0 ? Math.round((metrics.totalPaidAmount / fundraisingTarget) * 100) : 0;

    const financeTableData = [
      [isEn ? "Event Budget Goal" : "Malengo ya Sherehe (Goal)", `TZS ${fundraisingTarget.toLocaleString()}`],
      [isEn ? "Total Amount Pledged" : "Jumla ya Ahadi Kusajiliwa (Pledged)", `TZS ${metrics.totalPledgedAmount.toLocaleString()}`],
      [isEn ? "Total Amount Paid / Received" : "Kiasi Kilicholipwa / Kupokelewa (Collected)", `TZS ${metrics.totalPaidAmount.toLocaleString()} (${collectedRatio}% of Pledges)`],
      [isEn ? "Outstanding Balance Unpaid" : "Ahadi Ambao Haijalipwa (Unpaid Balances)", `TZS ${metrics.outstandingBalance.toLocaleString()}`],
      [isEn ? "Target Budget Coverage Ratio" : "Asilimia ya Kufikia Malengo ya Sherehe", `${goalCoverageRatio}% ${isEn ? 'complete' : 'imekamilika'}`],
    ];

    autoTable(doc, {
      startY: currentY,
      head: [[isEn ? "Financial Performance Indicator" : "Kipengele cha Mchango & Fedha", isEn ? "Value (TZS / Coverage)" : "Kiasi / Thamani"]],
      body: financeTableData,
      theme: 'grid',
      headStyles: { fillColor: [180, 83, 9], textColor: [255, 255, 255], fontSize: 8.5 }, 
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: {
        1: { halign: 'right', fontStyle: 'bold', textColor: [180, 83, 9] }
      }
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;

    if (currentY > 210) {
      doc.addPage();
      currentY = 15;
    }

    // SECTION 3: GROUP BREAKDOWNS & CATEGORIES
    doc.setFillColor(30, 41, 59); 
    doc.rect(10, currentY, pageWidth - 20, 7, 'F');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text(isEn ? "3. CONTRIBUTIONS SUMMARY BY GUEST CATEGORIES" : "3. MICHANGO KULINGANA NA MAKUNDI / VIKAO", 13, currentY + 5);
    
    currentY += 12;

    const groupTableHeaders = [
      isEn ? "Category Name" : "Jina la Kundi",
      isEn ? "Count" : "Kadi",
      isEn ? "Pledged (TZS)" : "Ahadi (TZS)",
      isEn ? "Collected (TZS)" : "Kilicholipwa (TZS)",
      isEn ? "Balance Due" : "Salio (TZS)"
    ];

    const groupTableData = groupSummaries.list.map(grp => [
      grp.name,
      grp.count,
      grp.pledged.toLocaleString(),
      grp.collected.toLocaleString(),
      grp.balances.toLocaleString()
    ]);

    // Push total row
    groupTableData.push([
      isEn ? "TOTAL SUM" : "JUMLA KUU",
      groupSummaries.totals.count,
      groupSummaries.totals.pledged.toLocaleString(),
      groupSummaries.totals.collected.toLocaleString(),
      groupSummaries.totals.balances.toLocaleString()
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [groupTableHeaders],
      body: groupTableData,
      theme: 'striped',
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 8 },
      styles: { fontSize: 7.5, cellPadding: 2.5 },
      columnStyles: {
        1: { halign: 'center' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right', fontStyle: 'bold' }
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.row.index === groupTableData.length - 1) {
          data.cell.styles.fillColor = [241, 245, 249];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    });

    currentY = (doc as any).lastAutoTable.finalY + 12;

    if (currentY > 250) {
      doc.addPage();
      currentY = 15;
    }

    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    doc.text(isEn ? "Report Verified and Signed by Committee Operations" : "Ripoti hii imethibitishwa na kuidhinishwa na Uongozi wa Kamati", 10, currentY);
    doc.text(`Printed: ${new Date().toLocaleString()}`, pageWidth - 10, currentY, { align: 'right' });

    await addPdfWatermarks(doc);
    doc.save(`Executive_Summary_${event.name.replace(/\s+/g, '_')}.pdf`);
  };

  // Custom tool tip for the pledge status donut chart
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-950 border border-white/10 p-3 rounded-xl shadow-2xl space-y-1 text-[11px] font-mono z-[9999]">
          <p className="font-bold text-white uppercase">{data.name}</p>
          <p className="text-slate-400 text-[10px] leading-tight">{data.desc}</p>
          <div className="h-[1px] bg-white/10 my-1"></div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-450">{isEn ? 'Guest Cards:' : 'Kadi za Wageni:'}</span>
            <span className="font-bold text-white">{data.count} ({totalGuestsCount > 0 ? Math.round((data.count / totalGuestsCount) * 100) : 0}%)</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-450">{isEn ? 'Funds Collected:' : 'Fedha zilizoripotiwa:'}</span>
            <span className="font-bold text-emerald-400">TZS {data.value.toLocaleString()}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  // Handle active subtab lists toggle
  const isFinanceAvailable = (metrics.totalPledgedAmount > 0 || metrics.totalPaidAmount > 0);

  return (
    <div className="space-y-6" id="event-reports-root">
      
      {/* Upper header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/40 p-6 rounded-3xl border border-white/5 shadow-2xl relative overflow-hidden">
        
        {/* Glow effect background */}
        <div className="absolute top-0 right-0 w-[15%] h-[100%] bg-blue-600/10 rounded-full blur-[60px] pointer-events-none"></div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {/* Dual Brand Logo / Event Illustration Badge */}
          <div className="flex -space-x-3.5 shrink-0 bg-slate-950/40 p-2.5 rounded-2xl border border-white/10 shadow-inner">
            <img src="/logo.png" alt="System Brand" className="w-10 h-10 object-contain rounded-xl" referrerPolicy="no-referrer" />
            {event.eventImgUrl && (
              <img src={event.eventImgUrl} alt="Event Banner Logo" className="w-10 h-10 object-cover rounded-xl border-2 border-slate-900" referrerPolicy="no-referrer" />
            )}
          </div>

          <div>
            <div className="flex items-center space-x-2 text-slate-400 text-xs font-mono tracking-widest uppercase">
              <span className="bg-slate-800 text-slate-300 px-2.5 py-0.5 rounded-full text-[9px] font-bold border border-white/10 uppercase">
                {language === 'sw' ? 'MODULI RASMI' : 'OFFICIAL MODULE'}
              </span>
              <span>•</span>
              <span>{event.id}</span>
            </div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight text-white mt-1 uppercase font-mono flex items-center gap-2">
              {language === 'sw' ? 'Ripoti za Tukio' : 'Event Reports Manager'}
            </h2>
            <p className="text-slate-400 text-xs mt-1">
              {language === 'sw' 
                ? 'Tazama na pakua ripoti zote za mahudhurio ya kadi, RSVP, pamoja na michango ya sherehe yako.' 
                : 'Analyze expected vs arrived guests, RSVP rates, delivered messages, and financial summaries.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={downloadReportPDF}
            className="bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl transition duration-150 flex items-center space-x-2 cursor-pointer shadow-lg shadow-sky-950/40"
            id="print-pdf-top"
          >
            <Download className="w-4 h-4" />
            <span>{language === 'sw' ? 'Pakua PDF Ripoti' : 'Download PDF Report'}</span>
          </button>
        </div>
      </div>

      {/* EXECUTIVE COMPREHENSIVE SUMMARY HUB (New Requested Feature) */}
      <div className="bg-gradient-to-br from-[#0c1328] to-[#121c38] border border-blue-500/20 p-6 rounded-3xl shadow-xl space-y-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[20%] h-[120%] bg-blue-500/5 blur-[50px] pointer-events-none"></div>
        <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.8 rounded-full bg-blue-500/10 border border-blue-500/30 text-[10px] font-black uppercase text-blue-300 tracking-wider">
              <Clipboard className="w-3 h-3 text-blue-400" />
              {language === 'sw' ? 'Muhtasari wa Kamati' : 'Executive Dashboard Hub'}
            </span>
            <h3 className="text-lg font-black text-white uppercase font-mono tracking-tight">
              {language === 'sw' ? 'Uzazi wa Muhtasari wa Haraka' : 'Comprehensive Executive Summary'}
            </h3>
            <p className="text-xs text-slate-350 leading-relaxed max-w-2xl">
              {language === 'sw'
                ? 'Pakua kadi kamili na muhtasari wa ripoti ya hali ya RSVP, mahudhurio ya sasa, na michango ya vikao vyote vya kifedha mfululizo kwa muundo wa PDF au faili ya maandishi (TXT) ya kushiriki WhatsApp.'
                : 'Generate a downloadable combined PDF or pure text dashboard summary showing comprehensive RSVP counts, contribution metrics, coverage ratios, and group breakdowns.'}
            </p>
          </div>
          <div className="flex flex-wrap lg:flex-nowrap gap-2 shrink-0">
            <button
              onClick={downloadComprehensiveExecutiveSummaryPDF}
              className="bg-sky-600 hover:bg-sky-500 active:scale-95 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition duration-150 flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              <span>{language === 'sw' ? 'Muhtasari (PDF)' : 'Executive PDF'}</span>
            </button>
            <button
              onClick={downloadTextSummaryFile}
              className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition duration-150 flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{language === 'sw' ? 'Muhtasari (TXT)' : 'Download TXT'}</span>
            </button>
            <button
              onClick={copyTextSummary}
              className={`text-xs px-4 py-2.5 rounded-xl transition-all duration-150 font-extrabold flex items-center gap-1.5 cursor-pointer shadow-md ${
                copySuccess 
                  ? 'bg-emerald-500 text-white scale-98' 
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10'
              }`}
            >
              {copySuccess ? <Check className="w-4 h-4" /> : <Printer className="w-4 h-4" />}
              <span>{copySuccess ? (language === 'sw' ? 'Imenakiliwa!' : 'Copied!') : (language === 'sw' ? 'Nakili (Copy)' : 'Copy to Clipboard')}</span>
            </button>
          </div>
        </div>

        {/* Quick horizontal stat glance inside the hub */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="bg-slate-950/45 p-3 rounded-xl border border-white/5 space-y-1">
            <span className="text-[10px] text-slate-450 uppercase font-mono">{language === 'sw' ? ' RSVP (Yes)' : 'RSVP Yes'}</span>
            <div className="text-sm font-black text-emerald-400 font-mono">{attendingCount} / {totalGuestsCount}</div>
          </div>
          <div className="bg-slate-950/45 p-3 rounded-xl border border-white/5 space-y-1">
            <span className="text-[10px] text-slate-450 uppercase font-mono">{language === 'sw' ? 'Checked-In Scans' : 'Arrived Scans'}</span>
            <div className="text-sm font-black text-blue-400 font-mono">{checkedInCount} ({arivedPercent()}%)</div>
          </div>
          <div className="bg-slate-950/45 p-3 rounded-xl border border-white/5 space-y-1">
            <span className="text-[10px] text-slate-450 uppercase font-mono">{language === 'sw' ? 'Pledged' : 'Pledged Amount'}</span>
            <div className="text-sm font-black text-amber-500 font-mono">TZS {metrics.totalPledgedAmount.toLocaleString()}</div>
          </div>
          <div className="bg-slate-950/45 p-3 rounded-xl border border-white/5 space-y-1">
            <span className="text-[10px] text-slate-450 uppercase font-mono">{language === 'sw' ? 'Collected' : 'Collected Amount'}</span>
            <div className="text-sm font-black text-sky-400 font-mono">TZS {metrics.totalPaidAmount.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* PLEDGE STATUS INTEGRATION VISUALIZER */}
      <div className="bg-slate-900/40 border border-white/5 rounded-3xl p-6 shadow-xl space-y-6" id="pledge-status-visualizer-section">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-white/5 pb-4">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-[9px] font-black uppercase text-amber-300 tracking-wider">
              <TrendingUp className="w-3 h-3 text-amber-400" />
              {language === 'sw' ? 'Uchambuzi wa Michango' : 'Fundraising Insights'}
            </span>
            <h3 className="text-base font-black text-white uppercase font-mono tracking-tight flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-amber-400" />
              {language === 'sw' ? 'Mchanganuo wa Ahadi & Hali ya Malipo' : 'Pledge Status Distribution'}
            </h3>
            <p className="text-xs text-slate-400">
              {language === 'sw'
                ? 'Tathmini uwiano wa wageni waliokamilisha michango yao dhidi ya wale wanaodaiwa salio au ambao hawajaweka ahadi.'
                : 'Evaluate guest card breakdowns based on financial payments, active arrears, and unpledged volume.'}
            </p>
          </div>

          {/* Metric conversion toggles */}
          <div className="flex p-0.5 bg-slate-950/60 rounded-xl border border-white/5 max-w-xs self-start sm:self-center shrink-0">
            <button
              onClick={() => setChartMetric('count')}
              className={`py-1.5 px-3 rounded-lg text-[10px] font-mono uppercase tracking-wider font-extrabold transition-all duration-150 cursor-pointer ${
                chartMetric === 'count'
                  ? 'bg-amber-600/90 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {language === 'sw' ? 'Wageni (Kadi)' : 'Guests Count'}
            </button>
            <button
              onClick={() => setChartMetric('value')}
              className={`py-1.5 px-3 rounded-lg text-[10px] font-mono uppercase tracking-wider font-extrabold transition-all duration-150 cursor-pointer ${
                chartMetric === 'value'
                  ? 'bg-amber-600/90 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {language === 'sw' ? 'Fedha (TZS)' : 'Value (TZS)'}
            </button>
          </div>
        </div>

        {/* Display visual charts of pledge distributions */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          
          {/* Pie Chart display */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center relative bg-slate-950/20 rounded-2xl p-4 border border-white/5 h-[260px]">
            {/* Inner text inside the pie donut hole */}
            <div className="absolute text-center pointer-events-none space-y-0.5">
              <span className="text-[10px] text-slate-400 tracking-widest uppercase font-mono">
                {chartMetric === 'count' 
                  ? (language === 'sw' ? 'JUMLA KADI' : 'TOTAL CARDS') 
                  : (language === 'sw' ? 'MICHANGO (TZS)' : 'TOTAL PLEDGED')}
              </span>
              <div className="text-base sm:text-lg font-black font-mono text-white">
                {chartMetric === 'count'
                  ? `${totalGuestsCount}`
                  : `TZS ${metrics.totalPledgedAmount.toLocaleString()}`}
              </div>
              <span className="text-[9px] text-emerald-400 font-bold font-mono">
                {chartMetric === 'count'
                  ? `${pledgeStatusData.totals.totalWithPledges} ${language === 'sw' ? 'wenye ahadi' : 'with pledges'}`
                  : `${language === 'sw' ? 'Iliyolipwa:' : 'Recv:'} ${metrics.totalPledgedAmount > 0 ? Math.round((metrics.totalPaidAmount / metrics.totalPledgedAmount) * 100) : 0}%`}
              </span>
            </div>

            <ResponsiveContainer width="100%" height={230}>
              <PieChart>
                <Pie
                  data={pledgeStatusData.distribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey={chartMetric === 'count' ? 'count' : 'value'}
                >
                  {pledgeStatusData.distribution.map((entry, index) => {
                    // Avoid displaying segments with 0 value or count to prevent visual overlaps
                    const val = chartMetric === 'count' ? entry.count : entry.value;
                    const fillVal = val > 0 ? entry.color : 'transparent';
                    return <Cell key={`cell-${index}`} fill={fillVal} stroke="rgba(15, 23, 42, 0.4)" strokeWidth={2} />;
                  })}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Details breakdown Legend */}
          <div className="lg:col-span-7 space-y-4">
            <h4 className="text-xs uppercase font-bold text-slate-400 font-mono tracking-wider mb-2">
              {language === 'sw' ? 'TAKWSIMU KWA KILA FUNGU' : 'DETAILED STATUS SEGMENTS'}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {pledgeStatusData.distribution.map((item) => {
                const isSelectedMetricValue = chartMetric === 'value';
                const percentage = isSelectedMetricValue
                  ? (metrics.totalPledgedAmount > 0 ? Math.round((item.value / metrics.totalPledgedAmount) * 100) : 0)
                  : (totalGuestsCount > 0 ? Math.round((item.count / totalGuestsCount) * 100) : 0);
                  
                return (
                  <div 
                    key={item.id} 
                    className="bg-slate-950/40 border border-white/5 rounded-2xl p-4 flex flex-col justify-between space-y-3 hover:border-white/10 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span 
                            className="w-2.5 h-2.5 rounded-full shrink-0" 
                            style={{ backgroundColor: item.color }}
                          ></span>
                          <span className="text-[11px] font-black text-white uppercase font-mono tracking-tight">{item.name}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 min-h-[14px] leading-tight font-sans">{item.desc}</p>
                      </div>
                      <span className="text-xs font-black font-mono" style={{ color: item.color }}>
                        {percentage}%
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {/* Sub-Progress Bar indicator */}
                      <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-300" 
                          style={{ width: `${percentage}%`, backgroundColor: item.color }}
                        ></div>
                      </div>

                      {/* Explicit stats labels */}
                      <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono pt-0.5">
                        <span className="flex items-center gap-1">
                          <span className="font-bold text-slate-350">{item.count}</span> {language === 'sw' ? 'Kadi' : 'Cards'}
                        </span>
                        <span>
                          {item.id === 'no_pledge' ? '-' : `TZS ${item.value.toLocaleString()}`}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Micro fundraising summary tips */}
            <div className="bg-amber-500/5 border border-amber-500/10 p-3.5 rounded-xl flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
                <TrendingUp className="w-4 h-4" />
              </div>
              <p className="text-[10.5px] leading-relaxed text-slate-300">
                {language === 'sw'
                  ? `Kati ya wageni wote walioaahidi mchango, waliokamilisha mchango thabiti ni ${Math.round((pledgeStatusData.totals.fullyPaidCount / (pledgeStatusData.totals.totalWithPledges || 1)) * 100)}% huku wenye salio (deni) wakiwa ${Math.round(((pledgeStatusData.totals.unpaidPledgeCount + pledgeStatusData.totals.partiallyPaidCount) / (pledgeStatusData.totals.totalWithPledges || 1)) * 100)}%. Fikiria kuwatumia kumbusho la WhatsApp kwa urahisi.`
                  : `Out of all pledge commitments, ${Math.round((pledgeStatusData.totals.fullyPaidCount / (pledgeStatusData.totals.totalWithPledges || 1)) * 100)}% have completed fully and ${Math.round(((pledgeStatusData.totals.unpaidPledgeCount + pledgeStatusData.totals.partiallyPaidCount) / (pledgeStatusData.totals.totalWithPledges || 1)) * 100)}% still hold active arrears. Consider dispatching friendly reminders.`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* NEW COMPREHENSIVE VISUAL CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6" id="attendance-rsvp-comms-visualizers-section">
        {/* Card 1: Expected RSVP vs Real Checked-In per Ticket Type */}
        <div className="bg-slate-900/40 border border-white/5 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="border-b border-white/5 pb-3">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-[9px] font-black uppercase text-blue-300 tracking-wider">
              <Activity className="w-3 h-3 text-blue-400" />
              {language === 'sw' ? 'Uchambuzi wa Tiketi' : 'Ticket Admission Analytics'}
            </span>
            <h3 className="text-sm font-black text-white uppercase font-mono tracking-tight mt-1.5">
              {language === 'sw' ? 'Kuhudhuria (RSVP) vs Kuingia (Check-In)' : 'Expected RSVP vs Checked-In per Type'}
            </h3>
            <p className="text-[10px] text-slate-400 mt-1">
              {language === 'sw' 
                ? 'Ulinganifu wa idadi ya wageni waliothibitisha kuja dhidi ya wale walioskaniwa mlangoni kulingana na aina ya kadi yao.'
                : 'Compare confirmation responses against real physical check-in arrivals at the venue.'}
            </p>
          </div>
          <div className="h-[210px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryAttendanceData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={9} fontStyle="bold" />
                <YAxis stroke="#64748b" fontSize={9} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '11px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                <Bar 
                  dataKey="Expected" 
                  fill="#3b82f6" 
                  name={language === 'sw' ? 'Waliothibitisha kuja' : 'Expected RSVP Yes'} 
                  radius={[4, 4, 0, 0]} 
                />
                <Bar 
                  dataKey="Arrived" 
                  fill="#10b981" 
                  name={language === 'sw' ? 'Waliofika mlangoni' : 'Scanned Arrivals'} 
                  radius={[4, 4, 0, 0]} 
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Card 2: Outreach Campaign Progress & Messaging Metrics */}
        <div className="bg-slate-900/40 border border-white/5 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="border-b border-white/5 pb-3">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-[9px] font-black uppercase text-purple-300 tracking-wider">
              <Smartphone className="w-3 h-3 text-purple-400" />
              {language === 'sw' ? 'Mwasiliano ya Kampeni' : 'Communication Outreach'}
            </span>
            <h3 className="text-sm font-black text-white uppercase font-mono tracking-tight mt-1.5">
              {language === 'sw' ? 'Hali ya Kampeni ya Ujumbe (SMS & WhatsApp)' : 'Delivered Notification Progress'}
            </h3>
            <p className="text-[10px] text-slate-400 mt-1">
              {language === 'sw' 
                ? 'Muhtasari wa kadi za mialiko zilizopelekwa kwa wageni kwa njia ya SMS na WhatsApp rasmi.'
                : 'Summary of digital invitations dispatched with system reference metrics.'}
            </p>
          </div>
          
          <div className="space-y-4 pt-1">
            {/* SMS Progress */}
            <div className="bg-slate-950/45 p-4 rounded-2xl space-y-2.5 border border-white/5">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse"></div>
                  <span className="text-[11px] font-black text-white uppercase font-mono tracking-tight">SMS CAMPAIGN COVERS</span>
                </div>
                <span className="text-xs font-black text-sky-400 font-mono">{totalSmsSent} zilizotumwa</span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-sky-600 to-blue-500 transition-all duration-500"
                  style={{ width: `${totalGuestsCount > 0 ? Math.min(100, Math.round((totalSmsSent / totalGuestsCount) * 100)) : 0}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                <span>{language === 'sw' ? 'Ujumbe wa Kawaida wa SMS' : 'Standard SMS dispatches'}</span>
                <span>{totalGuestsCount > 0 ? Math.round((totalSmsSent / totalGuestsCount) * 100) : 0}% {language === 'sw' ? 'ya wageni wote' : 'coverage ratio'}</span>
              </div>
            </div>

            {/* WhatsApp Progress */}
            <div className="bg-slate-950/45 p-4 rounded-2xl space-y-2.5 border border-white/5">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="text-[11px] font-black text-white uppercase font-mono tracking-tight">WHATSAPP DIGITAL INVITES</span>
                </div>
                <span className="text-xs font-black text-emerald-400 font-mono">{totalWhatsappSent} zilizotumwa</span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-teal-500 transition-all duration-500"
                  style={{ width: `${totalGuestsCount > 0 ? Math.min(100, Math.round((totalWhatsappSent / totalGuestsCount) * 100)) : 0}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                <span>{language === 'sw' ? 'Ujumbe wa Kadi za WhatsApp' : 'WhatsApp card dispatches'}</span>
                <span>{totalGuestsCount > 0 ? Math.round((totalWhatsappSent / totalGuestsCount) * 100) : 0}% {language === 'sw' ? 'ya wageni wote' : 'coverage ratio'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Switcher Categories (Attendance Reports vs Financial Reports) */}
      <div className="flex space-x-1 p-1 bg-slate-950/60 rounded-xl border border-white/5 max-w-md">
        <button
          onClick={() => {
            setReportCategory('attendance');
            setSelectedReport('Overall');
          }}
          className={`flex-1 py-2 px-3 text-xs font-black uppercase rounded-lg transition-all duration-250 cursor-pointer ${
            reportCategory === 'attendance'
              ? 'bg-blue-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          id="tab-btn-cat-attendance"
        >
          {language === 'sw' ? 'Mahudhurio na Mawasiliano' : 'Attendance & Comms'}
        </button>
        <button
          onClick={() => {
            setReportCategory('finance');
            setSelectedReport('Outstanding');
          }}
          className={`flex-1 py-2 px-3 text-xs font-black uppercase rounded-lg transition-all duration-250 cursor-pointer ${
            reportCategory === 'finance'
              ? 'bg-amber-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          id="tab-btn-cat-finance"
        >
          {language === 'sw' ? 'Michango na Fedha' : 'Contributions & Finance'}
        </button>
      </div>

      {/* Report selector tabs switcher */}
      <div className="overflow-x-auto pb-1">
        <div className="flex space-x-2 min-w-max">
          {reportCategory === 'attendance' ? (
            [
              { id: 'Overall', name: isEn ? '1. Overall Event Report' : '1. Ripoti Kuu ya Jumla' },
              { id: 'Attendance_Only', name: isEn ? '2. Check-In & Arrivals' : '2. Wageni Waliofika' },
              { id: 'RSVP_Only', name: isEn ? '3. Confirmed RSVPs' : '3. Waliothibitisha (RSVP)' },
              { id: 'RSVP_Pending', name: isEn ? '4. Unresponded RSVP' : '4. Bado Hawajajibu' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSelectedReport(tab.id)}
                className={`py-2 px-4 rounded-xl text-xs font-bold font-mono transition-colors border cursor-pointer ${
                  selectedReport === tab.id
                    ? 'bg-blue-500/10 text-blue-300 border-blue-500/30 font-black'
                    : 'bg-slate-900/30 text-slate-400 border-white/5 hover:text-white'
                }`}
              >
                {tab.name}
              </button>
            ))
          ) : (
            [
              { id: 'Outstanding', name: isEn ? '1. Outstanding Balances' : '1. Wenye Salio la Deni' },
              { id: 'FullyPaid', name: isEn ? '2. Fully Paid Members' : '2. Waliolipa Yote' },
              { id: 'Pledges', name: isEn ? '3. All Active Pledges' : '3. Orodha ya Ahadi' },
              { id: 'NoPledge', name: isEn ? '4. No recorded Pledge' : '4. Wasioahidi Bado' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSelectedReport(tab.id)}
                className={`py-2 px-4 rounded-xl text-xs font-bold font-mono transition-colors border cursor-pointer ${
                  selectedReport === tab.id
                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 font-black'
                    : 'bg-slate-900/30 text-slate-400 border-white/5 hover:text-white'
                }`}
              >
                {tab.name}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Visual content area */}
      <div className="bg-slate-900/20 border border-white/5 rounded-3xl p-6 shadow-2xl space-y-6 relative" id="printable-event-report-container">
        <ReportWatermark />
        
        {/* Unified Premium Report Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-6 border-b border-white/5 gap-4">
          <div className="flex items-center gap-4">
            <div className="flex -space-x-3 bg-slate-950/60 p-2.5 rounded-2xl border border-white/10 shadow-inner shrink-0">
              <img src="/logo.png" alt="EventCard Logo" className="h-8 md:h-10 object-contain rounded-lg" referrerPolicy="no-referrer" />
              {event.eventImgUrl && (
                <img src={event.eventImgUrl} alt="Event Cover" className="h-8 w-8 md:h-10 md:w-10 rounded-lg object-cover border-2 border-slate-900" referrerPolicy="no-referrer" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-blue-500/10 text-blue-400 text-[9px] font-mono font-bold px-2 py-0.5 rounded-md border border-blue-500/20 uppercase tracking-wider">
                  {selectedReport === 'Overall' ? (isEn ? "Overall Performance" : "Ripoti ya Jumla") :
                   selectedReport === 'Attendance_Only' ? (isEn ? "Check-In" : "Waliosema Ndio") :
                   selectedReport === 'RSVP_Only' ? (isEn ? "RSVP Attendance" : "Kuhudhuria") :
                   selectedReport === 'RSVP_Pending' ? (isEn ? "RSVP Unresponsive" : "Bado Kujibu") :
                   selectedReport === 'Outstanding' ? (isEn ? "Outstanding Balances" : "Mwenendo wa Madeni") :
                   selectedReport === 'FullyPaid' ? (isEn ? "Fully Paid Members" : "Waliolipa Yote") :
                   selectedReport === 'Pledges' ? (isEn ? "All Active Pledges" : "Ahadi Zote") :
                   (isEn ? "No Pledge" : "Wasioahidi Bado")}
                </span>
                <span className="text-[10px] text-slate-500 font-mono font-black">•</span>
                <span className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-widest">{isEn ? "Official Event Ledger" : "Hati Kuu ya Tukio"}</span>
              </div>
              <h3 className="text-base md:text-lg font-black tracking-tight text-white uppercase font-mono mt-1">
                {event.name}
              </h3>
            </div>
          </div>
          <div className="text-left md:text-right font-mono text-[10px] text-slate-400 space-y-0.5 shrink-0">
            <p className="font-bold text-slate-300 flex items-center md:justify-end gap-1.5">
              <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
              {isEn ? "VERIFIED REPORT" : "RIPOTI ILIYOTHIBITISHWA"}
            </p>
            <p>{isEn ? "Printed on:" : "Tarehe:"} {new Date().toLocaleDateString('sw-TZ', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
        </div>
        
        {/* Render 1: Overall Event Report view (requested) */}
        {selectedReport === 'Overall' && (
          <div className="space-y-6" id="view-overall-report">
            
            {/* 4 RSVP Status Categories with explicit Single & Double breakdown */}
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Clipboard className="w-4 h-4 text-sky-400" />
                  {language === 'sw' ? 'Muhtasari wa RSVP & Aina za Kadi (Single & Double)' : 'RSVP Status Breakdown by Card Type (Single & Double)'}
                </span>
                <span className="text-[11px] font-mono text-slate-400 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg">
                  {language === 'sw' ? 'Jumla ya Kadi:' : 'Total Cards:'} <strong className="text-white font-bold">{totalGuestsCount}</strong> (Single: <strong className="text-sky-300 font-bold">{singleCardsCount}</strong>, Double: <strong className="text-purple-300 font-bold">{doubleCardsCount}</strong>{vipCardsCount > 0 ? `, VIP: ${vipCardsCount}` : ''})
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* 1. Watakaohudhuria (Attending / Yes) */}
                <div className="bg-emerald-950/30 border border-emerald-500/30 p-4 rounded-2xl relative overflow-hidden flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black tracking-widest text-emerald-400 uppercase font-mono flex items-center gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                        {isEn ? "1. Attending (Yes)" : "1. Watakaohudhuria"}
                      </span>
                      <span className="text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                        {totalGuestsCount > 0 ? Math.round((attendingCount / totalGuestsCount) * 100) : 0}%
                      </span>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <p className="text-3xl font-mono font-black text-emerald-300">{attendingCount}</p>
                      <span className="text-xs font-mono text-emerald-400/80 font-bold">{language === 'sw' ? 'Kadi' : 'Cards'}</span>
                      <span className="text-[10px] font-mono text-slate-400 ml-auto">({totalRsvpPax} {language === 'sw' ? 'Watu/Pax' : 'Pax'})</span>
                    </div>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-emerald-500/20 flex items-center justify-between text-[11px] font-mono">
                    <span className="text-slate-300">
                      Single: <strong className="text-emerald-400 font-bold text-sm">{attendingSingle}</strong>
                    </span>
                    <span className="text-slate-300">
                      Double: <strong className="text-purple-300 font-bold text-sm">{attendingDouble}</strong>
                    </span>
                    {attendingVip > 0 && (
                      <span className="text-amber-400">
                        VIP: <strong className="font-bold">{attendingVip}</strong>
                      </span>
                    )}
                  </div>
                </div>

                {/* 2. Hawatakuja (Declined / No) */}
                <div className="bg-rose-950/30 border border-rose-500/30 p-4 rounded-2xl relative overflow-hidden flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black tracking-widest text-rose-400 uppercase font-mono flex items-center gap-1.5">
                        <XCircle className="w-3.5 h-3.5 text-rose-400" />
                        {isEn ? "2. Declined (No)" : "2. Hawatakuja"}
                      </span>
                      <span className="text-[9px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 px-1.5 py-0.5 rounded">
                        {totalGuestsCount > 0 ? Math.round((declinedCount / totalGuestsCount) * 100) : 0}%
                      </span>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <p className="text-3xl font-mono font-black text-rose-300">{declinedCount}</p>
                      <span className="text-xs font-mono text-rose-400/80 font-bold">{language === 'sw' ? 'Kadi' : 'Cards'}</span>
                    </div>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-rose-500/20 flex items-center justify-between text-[11px] font-mono">
                    <span className="text-slate-300">
                      Single: <strong className="text-rose-400 font-bold text-sm">{declinedSingle}</strong>
                    </span>
                    <span className="text-slate-300">
                      Double: <strong className="text-purple-300 font-bold text-sm">{declinedDouble}</strong>
                    </span>
                    {declinedVip > 0 && (
                      <span className="text-amber-400">
                        VIP: <strong className="font-bold">{declinedVip}</strong>
                      </span>
                    )}
                  </div>
                </div>

                {/* 3. Hawana Uhakika (Maybe / Undecided) */}
                <div className="bg-amber-950/30 border border-amber-500/30 p-4 rounded-2xl relative overflow-hidden flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black tracking-widest text-amber-400 uppercase font-mono flex items-center gap-1.5">
                        <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                        {isEn ? "3. Maybe (Undecided)" : "3. Hawana Uhakika"}
                      </span>
                      <span className="text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded">
                        {totalGuestsCount > 0 ? Math.round((maybeCount / totalGuestsCount) * 100) : 0}%
                      </span>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <p className="text-3xl font-mono font-black text-amber-300">{maybeCount}</p>
                      <span className="text-xs font-mono text-amber-400/80 font-bold">{language === 'sw' ? 'Kadi' : 'Cards'}</span>
                    </div>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-amber-500/20 flex items-center justify-between text-[11px] font-mono">
                    <span className="text-slate-300">
                      Single: <strong className="text-amber-400 font-bold text-sm">{maybeSingle}</strong>
                    </span>
                    <span className="text-slate-300">
                      Double: <strong className="text-purple-300 font-bold text-sm">{maybeDouble}</strong>
                    </span>
                    {maybeVip > 0 && (
                      <span className="text-amber-400">
                        VIP: <strong className="font-bold">{maybeVip}</strong>
                      </span>
                    )}
                  </div>
                </div>

                {/* 4. Bado Hawajaconfirm (Pending Response) */}
                <div className="bg-slate-900/80 border border-slate-700/60 p-4 rounded-2xl relative overflow-hidden flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase font-mono flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {isEn ? "4. Unconfirmed (Pending)" : "4. Bado Hawajajibu"}
                      </span>
                      <span className="text-[9px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700 px-1.5 py-0.5 rounded">
                        {totalGuestsCount > 0 ? Math.round((pendingCount / totalGuestsCount) * 100) : 0}%
                      </span>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <p className="text-3xl font-mono font-black text-slate-200">{pendingCount}</p>
                      <span className="text-xs font-mono text-slate-400 font-bold">{language === 'sw' ? 'Kadi' : 'Cards'}</span>
                    </div>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono">
                    <span className="text-slate-300">
                      Single: <strong className="text-slate-300 font-bold text-sm">{pendingSingle}</strong>
                    </span>
                    <span className="text-slate-300">
                      Double: <strong className="text-purple-300 font-bold text-sm">{pendingDouble}</strong>
                    </span>
                    {pendingVip > 0 && (
                      <span className="text-amber-400">
                        VIP: <strong className="font-bold">{pendingVip}</strong>
                      </span>
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* Quick Operational Summary Bar (Arrivals & Messages) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="bg-blue-950/20 border border-blue-500/20 p-3.5 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono font-bold text-blue-300 uppercase tracking-wider block">
                      {isEn ? 'Arrived / Checked In' : 'Waliofika (Checked In)'}
                    </span>
                    <p className="text-lg font-black font-mono text-white mt-0.5">
                      {checkedInCount} <span className="text-xs font-normal text-slate-400">Kadi ({arivedPercent()}% Ratio)</span>
                    </p>
                  </div>
                </div>
                <div className="text-right text-[10px] font-mono text-slate-400">
                  <div>Single: <strong className="text-blue-300">{checkedInSingle}</strong></div>
                  <div>Double: <strong className="text-purple-300">{checkedInDouble}</strong></div>
                </div>
              </div>

              <div className="bg-purple-950/20 border border-purple-500/20 p-3.5 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono font-bold text-purple-300 uppercase tracking-wider block">
                      {isEn ? 'SMS & WA Sent' : 'Ujumbe Uliotumwa'}
                    </span>
                    <p className="text-lg font-black font-mono text-white mt-0.5">
                      {totalSmsSent + totalWhatsappSent} <span className="text-xs font-normal text-slate-400">Jumla</span>
                    </p>
                  </div>
                </div>
                <div className="text-right text-[10px] font-mono">
                  <div className="text-sky-400">SMS: <strong>{totalSmsSent}</strong></div>
                  <div className="text-emerald-400">WA: <strong>{totalWhatsappSent}</strong></div>
                </div>
              </div>

              <div className="bg-slate-900/60 border border-white/5 p-3.5 rounded-2xl flex items-center justify-between sm:col-span-2 lg:col-span-1">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
                      {isEn ? 'Expected Attendees' : 'Wanaotegemewa Ukumbini'}
                    </span>
                    <p className="text-lg font-black font-mono text-emerald-400 mt-0.5">
                      {totalRsvpPax} <span className="text-xs font-normal text-slate-400">Watu (Pax)</span>
                    </p>
                  </div>
                </div>
                <div className="text-right text-[10px] font-mono text-slate-400">
                  <div>Bado Kufika: <strong className="text-amber-400">{expectedButNotArrived}</strong></div>
                </div>
              </div>
            </div>

            {/* 5 Pledge & Contribution Status Summary Cards requested by user */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-2xl text-center flex flex-col justify-between">
                <span className="text-[9.5px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                  {isEn ? 'HAWAJAAHIDI (NO PLEDGE)' : 'HAWAJAAHIDI (NO PLEDGE)'}
                </span>
                <p className="text-2xl font-black font-mono text-white mt-1">
                  {pledgeStatusData.totals.noPledgeCount}
                </p>
              </div>

              <div className="bg-slate-950/80 border border-amber-500/30 p-3.5 rounded-2xl text-center flex flex-col justify-between">
                <span className="text-[9.5px] font-mono font-bold text-amber-400 uppercase tracking-wider">
                  {isEn ? 'WALIOAHIDI TU (PLEDGED)' : 'WALIOAHIDI TU (PLEDGED)'}
                </span>
                <p className="text-2xl font-black font-mono text-amber-400 mt-1">
                  {pledgeStatusData.totals.unpaidPledgeCount}
                </p>
              </div>

              <div className="bg-slate-950/80 border border-cyan-500/30 p-3.5 rounded-2xl text-center flex flex-col justify-between">
                <span className="text-[9.5px] font-mono font-bold text-cyan-400 uppercase tracking-wider">
                  {isEn ? 'LIPA NUSU (PARTIALLY)' : 'LIPA NUSU (PARTIALLY)'}
                </span>
                <p className="text-2xl font-black font-mono text-cyan-400 mt-1">
                  {pledgeStatusData.totals.partiallyPaidCount}
                </p>
              </div>

              <div className="bg-slate-950/80 border border-emerald-500/30 p-3.5 rounded-2xl text-center flex flex-col justify-between">
                <span className="text-[9.5px] font-mono font-bold text-emerald-400 uppercase tracking-wider">
                  {isEn ? 'LIPA YOTE (FULLY PAID)' : 'LIPA YOTE (FULLY PAID)'}
                </span>
                <p className="text-2xl font-black font-mono text-emerald-400 mt-1">
                  {pledgeStatusData.totals.fullyPaidCount}
                </p>
              </div>

              <div className="bg-slate-950/80 border border-purple-500/30 p-3.5 rounded-2xl text-center flex flex-col justify-between col-span-2 sm:col-span-1">
                <span className="text-[9.5px] font-mono font-bold text-purple-400 uppercase tracking-wider">
                  {isEn ? 'WENYE MADENI ACTIVE' : 'WENYE MADENI ACTIVE'}
                </span>
                <p className="text-2xl font-black font-mono text-purple-300 mt-1">
                  {pledgeStatusData.totals.unpaidPledgeCount + pledgeStatusData.totals.partiallyPaidCount}
                </p>
              </div>
            </div>

            {/* Check-In Progress Gauge Section (Aggregating checkin and RSVP) */}
            <div className="bg-slate-950/65 border border-white/5 rounded-2xl p-5 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-350">{language === 'sw' ? 'Mwenendo wa Kuwasili (Check-In / RSVP Attending Ratio)' : 'Admission Rate progress'}</span>
                <span className="font-mono font-black text-blue-400">{arivedPercent()}% Ratio</span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-3.5 overflow-hidden border border-white/5">
                <div 
                  className="bg-gradient-to-r from-blue-500 via-sky-400 to-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${arivedPercent()}%` }}
                ></div>
              </div>
              <div className="flex flex-wrap justify-between items-center text-[10px] text-slate-500 font-mono pt-1">
                <span>{isEn ? "Arrived:" : "Waliofika / Arrived:"} <strong className="text-slate-300 font-bold">{checkedInCount}</strong></span>
                <span>Thibitisha Kufika: <strong className="text-slate-300 font-bold">{attendingCount} kadi</strong> ({totalRsvpPax} watu)</span>
                <span>Bado Kufika (Expected but Absent): <strong className="text-amber-500 font-bold">{expectedButNotArrived}</strong></span>
              </div>
            </div>

            {/* General Filter table query search */}
            <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center pt-2">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder={language === 'sw' ? 'Tafuta mgeni kwa jina au namba ya simu...' : 'Search guest...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950/80 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <span className="text-[10px] font-mono text-slate-400 text-right self-center uppercase font-bold">
                {language === 'sw' ? `Mwonekano: Wageni ${filteredGuests.length} kati ya ${totalGuestsCount}` : `Showing ${filteredGuests.length} of ${totalGuestsCount}`}
              </span>
            </div>

            {/* Master registration card database table */}
            <div className="overflow-x-auto rounded-2xl border border-white/5 bg-slate-950/40">
              <table className="w-full text-left border-collapse font-sans text-xs">
                <thead>
                  <tr className="bg-white/5 border-b border-white/10 text-slate-400 font-mono text-[9px] uppercase tracking-wider">
                    <th className="py-3 px-3 font-black text-center">S/N</th>
                    <th className="py-3 px-3 font-black">{isEn ? "Guest Full Name" : "Mgeni (Guest Full Name)"}</th>
                    <th className="py-3 px-3 font-black">Simu</th>
                    <th className="py-3 px-3 font-black text-center">Aina ya Kadi</th>
                    <th className="py-3 px-3 font-black text-center">RSVP Jibu</th>
                    <th className="py-3 px-3 font-black text-center">Pax RSVP</th>
                    <th className="py-3 px-3 font-black text-center">Skani / Check-In</th>
                    <th className="py-3 px-3 font-black text-center">{isEn ? "Arrival Time" : "Muda wa Kufika"}</th>
                    <th className="py-3 px-3 font-black text-center">SMS</th>
                    <th className="py-3 px-3 font-black text-center">WA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono text-slate-200 text-[11px]">
                  {filteredGuests.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-10 text-center text-slate-500 uppercase tracking-widest text-[9.5px]">
                        Hakuna kadi ya mgeni inayolingana na utafutaji wako.
                      </td>
                    </tr>
                  ) : (
                    filteredGuests.map((g, idx) => (
                      <tr key={g.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-2.5 px-3 text-center text-slate-500 font-semibold">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-bold uppercase text-slate-100">{g.name}</td>
                        <td className="py-2.5 px-3 text-slate-400 text-[10px]">{g.phone || '-'}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                            g.cardType === 'DOUBLE' || g.cardType === 'COUPLE'
                              ? 'bg-purple-500/10 text-purple-400 border-purple-400/20' 
                              : g.cardType?.toUpperCase() === 'VIP'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-400/20'
                              : 'bg-blue-500/10 text-blue-300 border-blue-400/20'
                          }`}>
                            {g.cardType || 'SINGLE'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                            g.rsvpStatus === 'Atahudhuria' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                            g.rsvpStatus === 'Hatahudhuria' ? 'bg-red-500/10 text-rose-450 border-red-500/20' :
                            g.rsvpStatus === 'Labda' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                            'bg-white/5 text-slate-500 border-white/10'
                          }`}>
                            {g.rsvpStatus || 'Bado Jibu'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-300">
                          {g.rsvpStatus === 'Atahudhuria' ? (g.rsvpGuestsCount || 1) : 0}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {g.checkedIn ? (
                            <span className="inline-flex items-center text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-lg">
                              <Check className="w-3 h-3 mr-1" /> Arrived
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-[10px] font-bold text-slate-500 bg-slate-900 border border-white/5 px-2.5 py-0.5 rounded-lg">
                              Absent
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-400 text-[10px]">
                          {g.checkedInTime ? g.checkedInTime : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center text-blue-400 font-bold">{g.smsCount || (isStatusSent(g.smsStatus) ? 1 : 0)}</td>
                        <td className="py-2.5 px-3 text-center text-emerald-400 font-bold">{g.whatsappCount || (isStatusSent(g.whatsappStatus) ? 1 : 0)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Render 2: Checked In Logs only */}
        {selectedReport === 'Attendance_Only' && (
          <div className="space-y-4" id="view-attendance-only">
            <div className="flex justify-between items-center">
              <h4 className="font-extrabold text-xs uppercase text-slate-300 font-mono tracking-wider">
                2. Wageni Waliofika (Check-In Register Tracker)
              </h4>
              <span className="text-[10px] font-bold font-mono text-emerald-400 uppercase bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                Waliofika: {checkedInCount} Kadi
              </span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-white/5 bg-slate-950/40">
              <table className="w-full text-left border-collapse font-sans text-xs">
                <thead>
                  <tr className="bg-white/5 border-b border-white/10 text-slate-400 font-mono text-[9px] uppercase tracking-wider">
                    <th className="py-3 px-3 font-black text-center">S/N</th>
                    <th className="py-3 px-3 font-black">{isEn ? 'Arrival Time' : 'Muda wa Kufika'}</th>
                    <th className="py-3 px-3 font-black">{isEn ? 'Guest Name' : 'Jina la Mgeni'}</th>
                    <th className="py-3 px-3 font-black">{isEn ? 'Phone Number' : 'Namba ya Simu'}</th>
                    <th className="py-3 px-3 font-black text-center">{isEn ? 'Card Type' : 'Aina ya Kadi'}</th>
                    <th className="py-3 px-3 font-black text-center">{isEn ? 'Admission Status' : 'Admission Hali'}</th>
                    <th className="py-3 px-3 font-black text-center">{isEn ? 'Reg Link / Code' : 'Reg Link / Code'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono text-slate-200 text-[11px]">
                  {filteredGuests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-500">
                        {language === 'sw' ? 'Hakuna kumbukumbu za kuonyesha. Scan bado hazijaanza.' : 'No arrivals registered yet.'}
                      </td>
                    </tr>
                  ) : (
                    [...filteredGuests]
                      .sort((a,b) => (b.checkedInTime || '').localeCompare(a.checkedInTime || ''))
                      .map((g, idx) => (
                        <tr key={g.id} className="hover:bg-white/5 transition-colors">
                          <td className="py-2.5 px-3 text-center text-slate-500">{idx + 1}</td>
                          <td className="py-2.5 px-3 text-emerald-400 font-bold">{g.checkedInTime || '-'}</td>
                          <td className="py-2.5 px-3 font-bold uppercase">{g.name}</td>
                          <td className="py-2.5 px-3 text-slate-400">{g.phone || '-'}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="px-2 py-0.5 rounded text-[9px] font-black bg-blue-500/10 text-blue-300 border border-blue-500/10">
                              {g.cardType || 'SINGLE'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="bg-emerald-500/15 text-emerald-400 text-[9.5px] px-2.5 py-0.5 rounded border border-emerald-500/30 font-bold uppercase">
                              SUCCESS SCAN
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-500 text-[10px]">{g.code}</td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Render 3: Confirmed RSVPs only */}
        {selectedReport === 'RSVP_Only' && (
          <div className="space-y-4" id="view-rsvp-only">
            <div className="flex justify-between items-center">
              <h4 className="font-extrabold text-xs uppercase text-slate-300 font-mono tracking-wider">
                3. Waliothibitisha Hali ya RSVP (Atahudhuria au Hatahudhuria)
              </h4>
              <span className="text-[10px] font-bold font-mono text-blue-400 uppercase bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
                Waliojibu: {attendingCount + declinedCount + maybeCount} Wageni
              </span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-white/5 bg-slate-950/40">
              <table className="w-full text-left border-collapse font-sans text-xs">
                <thead>
                  <tr className="bg-white/5 border-b border-white/10 text-slate-400 font-mono text-[9px] uppercase tracking-wider">
                    <th className="py-3 px-3 font-black text-center">S/N</th>
                    <th className="py-3 px-3 font-black">{isEn ? 'Guest Name' : 'Jina la Mgeni'}</th>
                    <th className="py-3 px-3 font-black">{isEn ? 'Phone Number' : 'Namba ya Simu'}</th>
                    <th className="py-3 px-3 font-black text-center">{isEn ? 'RSVP Status' : 'RSVP Jibu'}</th>
                    <th className="py-3 px-3 font-black text-center">Double/Single</th>
                    <th className="py-3 px-3 font-black text-center">{isEn ? 'SMS Count' : 'SMS counts'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono text-slate-200 text-[11px]">
                  {filteredGuests.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-500">
                        {isEn ? 'No guests have confirmed RSVP yet.' : 'Hakuna wageni waliothibitisha RSVP bado.'}
                      </td>
                    </tr>
                  ) : (
                    filteredGuests.map((g, idx) => (
                      <tr key={g.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-2.5 px-3 text-center text-slate-500">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-bold uppercase">{g.name}</td>
                        <td className="py-2.5 px-3 text-slate-400">{g.phone || '-'}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                            g.rsvpStatus === 'Atahudhuria' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                            g.rsvpStatus === 'Hatahudhuria' ? 'bg-red-500/10 text-rose-450 border-red-500/20' :
                            'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}>
                            {g.rsvpStatus}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                            g.cardType === 'DOUBLE' || g.cardType === 'COUPLE'
                              ? 'bg-purple-500/10 text-purple-400 border-purple-400/20' 
                              : g.cardType?.toUpperCase() === 'VIP'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-400/20'
                              : 'bg-blue-500/10 text-blue-300 border-blue-400/20'
                          }`}>
                            {g.cardType || 'SINGLE'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-400">{g.smsCount || (isStatusSent(g.smsStatus) ? 1 : 0)} zilizotumwa</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Render 4: Unresponded RSVPs only */}
        {selectedReport === 'RSVP_Pending' && (
          <div className="space-y-4" id="view-rsvp-pending">
            <div className="flex justify-between items-center">
              <h4 className="font-extrabold text-xs uppercase text-slate-300 font-mono tracking-wider">
                4. Wageni ambao Bado Hawajajibu Kampeni ya RSVP
              </h4>
              <span className="text-[10px] font-bold font-mono text-amber-500 uppercase bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                {isEn ? `No response: ${pendingCount} Guests` : `Hawajajibu: ${pendingCount} Wageni`}
              </span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-white/5 bg-slate-950/40">
              <table className="w-full text-left border-collapse font-sans text-xs">
                <thead>
                  <tr className="bg-white/5 border-b border-white/10 text-slate-400 font-mono text-[9px] uppercase tracking-wider">
                    <th className="py-3 px-3 font-black text-center">S/N</th>
                    <th className="py-3 px-3 font-black">{isEn ? 'Guest Name' : 'Jina la Mgeni'}</th>
                    <th className="py-3 px-3 font-black">{isEn ? 'Phone Number' : 'Namba ya Simu'}</th>
                    <th className="py-3 px-3 font-black text-center">{isEn ? 'Card Type' : 'Aina ya Kadi'}</th>
                    <th className="py-3 px-3 text-center font-black">{isEn ? 'Registration RSVP Link' : 'Registration RSVP Link (Viungo)'}</th>
                    <th className="py-3 px-3 font-black text-center">{isEn ? 'Message Dispatches' : 'Ujumbe Dispatches'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono text-slate-200 text-[11px]">
                  {filteredGuests.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-500">
                        {isEn ? 'Awesome! All guests have submitted their RSVPs!' : 'Safi sana! Wageni wote wametimiza kujibu RSVP zao!'}
                      </td>
                    </tr>
                  ) : (
                    filteredGuests.map((g, idx) => (
                      <tr key={g.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-2.5 px-3 text-center text-slate-500">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-bold uppercase text-slate-300">{g.name}</td>
                        <td className="py-2.5 px-3 text-slate-400">{g.phone || 'Hakuna Namba'}</td>
                        <td className="py-2.5 px-3 text-center">{g.cardType || 'SINGLE'}</td>
                        <td className="py-2.5 px-3 text-center text-[10px] text-slate-500">
                          https://eventcard.co.tz/pledge/{g.code}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="text-slate-400 text-[10.5px]">SMS: {g.smsCount || 0}   •   WA: {g.whatsappCount || 0}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Render 5: Financial: Outstanding balances */}
        {selectedReport === 'Outstanding' && (
          <div className="space-y-4 font-mono text-xs" id="view-finance-outstanding">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <h4 className="font-extrabold text-xs uppercase text-slate-300 font-mono tracking-wider">
                1. Orodha ya Wageni Wenye Salio la Deni/Ahadi bado
              </h4>
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 font-mono font-bold text-[10.5px] px-3.5 py-1 rounded-full uppercase">
                Jumla Inayodaiwa: TZS {metrics.outstandingBalance.toLocaleString()}
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-white/5 bg-slate-950/40">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/5 border-b border-white/10 text-slate-400 text-[9.5px] uppercase">
                    <th className="py-3 px-3 font-black text-center">S/N</th>
                    <th className="py-3 px-3 font-black">Jina la Mchangiaji</th>
                    <th className="py-3 px-3 font-black text-right">Commitment / Ahadi</th>
                    <th className="py-3 px-3 font-black text-right">Paid / Kiasi Kilicholipwa</th>
                    <th className="py-3 px-3 font-black text-right text-rose-400">Balance Due / Deni</th>
                    <th className="py-3 px-3 font-black text-center">Ujumbe Counts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-200 text-[11px]">
                  {filteredGuests.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        {language === 'sw' ? 'Mungu ni Mwema! Hakuna mtu anayedaiwa sasa hivi.' : 'Awesome! Outstanding balance is entirely clear.'}
                      </td>
                    </tr>
                  ) : (
                    filteredGuests.map((g, idx) => {
                      const bal = (g.pledgeAmount || 0) - (g.paidAmount || 0);
                      return (
                        <tr key={g.id} className="hover:bg-white/5 transition-colors">
                          <td className="py-2.5 px-3 text-center text-slate-500">{idx + 1}</td>
                          <td className="py-2.5 px-3 font-bold uppercase text-slate-100">{g.name}</td>
                          <td className="py-2.5 px-3 text-right">TZS {(g.pledgeAmount || 0).toLocaleString()}</td>
                          <td className="py-2.5 px-3 text-right text-emerald-400">TZS {(g.paidAmount || 0).toLocaleString()}</td>
                          <td className="py-2.5 px-3 text-right text-rose-400 font-extrabold">TZS {bal.toLocaleString()}</td>
                          <td className="py-2.5 px-3 text-center text-[10.5px] text-slate-400">SMS: {g.smsCount || (isStatusSent(g.smsStatus) ? 1 : 0)}  •  WA: {g.whatsappCount || (isStatusSent(g.whatsappStatus) ? 1 : 0)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Render 6: Financial: Fully Paid Members */}
        {selectedReport === 'FullyPaid' && (
          <div className="space-y-4 font-mono text-xs" id="view-finance-fullypaid">
            <div className="flex justify-between items-center">
              <h4 className="font-extrabold text-xs uppercase text-slate-300 tracking-wider">
                2. Waliolipa na Kutimiza Ahadi Zao Kikamilifu (Completed)
              </h4>
              <span className="text-[10px] font-bold text-emerald-450 bg-emerald-500/10 px-3.5 py-1 rounded-full border border-emerald-500/20">
                Waliomaliza: {filteredGuests.length} Wageni
              </span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-white/5 bg-slate-950/40">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/5 border-b border-white/10 text-slate-400 text-[9.5px] uppercase">
                    <th className="py-3 px-3 font-black text-center">S/N</th>
                    <th className="py-3 px-3 font-black">Mchangiaji Name</th>
                    <th className="py-3 px-3 font-black">Namba ya Simu</th>
                    <th className="py-3 px-3 text-right font-black">Kiasi Kilicholipwa Kikamilifu</th>
                    <th className="py-3 px-3 font-black text-center">Hali ya Kadi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-200 text-[11px]">
                  {filteredGuests.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        Haipo kumbukumbu yoyote ya mchangiaji aliyelipa yote bado.
                      </td>
                    </tr>
                  ) : (
                    filteredGuests.map((g, idx) => (
                      <tr key={g.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-2.5 px-3 text-center text-slate-500">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-bold uppercase">{g.name}</td>
                        <td className="py-2.5 px-3 text-slate-400 text-[10px]">{g.phone || '-'}</td>
                        <td className="py-2.5 px-3 text-right text-emerald-400 font-extrabold">TZS {(g.pledgeAmount || 0).toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/35 px-2 py-0.5 rounded text-[9px] uppercase">
                            COMPLETED
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Render 7: Financial: All Active Pledges */}
        {selectedReport === 'Pledges' && (
          <div className="space-y-4 font-mono text-xs" id="view-finance-pledges">
            <div className="flex justify-between items-center">
              <h4 className="font-extrabold text-xs uppercase text-slate-300 tracking-wider">
                3. Kumbukumbu Zote za Wageni Walioaahidi Mchango kuisaidia Sherehe
              </h4>
              <span className="text-[10px] text-amber-300 font-bold bg-amber-500/10 px-3.5 py-1 rounded-full border border-amber-500/20">
                {isEn ? 'Total Pledges:' : 'Jumla ya Ahadi:'} TZS {metrics.totalPledgedAmount.toLocaleString()}
              </span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-white/5 bg-slate-950/40">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/5 border-b border-white/10 text-slate-400 text-[9.5px] uppercase">
                    <th className="py-3 px-3 font-black text-center">S/N</th>
                    <th className="py-3 px-3 font-black">{isEn ? 'Guest Name' : 'Jina la Mgeni'}</th>
                    <th className="py-3 px-3 font-black">{isEn ? 'Phone Number' : 'Namba ya Simu'}</th>
                    <th className="py-3 px-3 text-right font-black">{isEn ? 'Pledge Amount (TZS)' : 'Ahadi ya Kielektroniki (Pledge TZS)'}</th>
                    <th className="py-3 px-3 text-right font-black">{isEn ? 'Cash Paid (TZS)' : 'Kiasi cha Cash kilichopo'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-200 text-[11px]">
                  {filteredGuests.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        {isEn ? 'No contribution pledges registered yet on the system.' : 'Hakuna ahadi ya mchango iliyoandikishwa bado kwenye mfumo.'}
                      </td>
                    </tr>
                  ) : (
                    filteredGuests.map((g, idx) => (
                      <tr key={g.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-2.5 px-3 text-center text-slate-500">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-bold uppercase">{g.name}</td>
                        <td className="py-2.5 px-3 text-slate-400 text-[10px]">{g.phone || '-'}</td>
                        <td className="py-2.5 px-3 text-right text-slate-200 font-extrabold">TZS {(g.pledgeAmount || 0).toLocaleString()}</td>
                        <td className="py-2.5 px-3 text-right text-emerald-400 font-bold">TZS {(g.paidAmount || 0).toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Render 8: Financial: Unpledged members */}
        {selectedReport === 'NoPledge' && (
          <div className="space-y-4 font-mono text-xs" id="view-finance-unpledged">
            <div className="flex justify-between items-center">
              <h4 className="font-extrabold text-xs uppercase text-slate-300 tracking-wider">
                4. Wageni ambao Bado Hawajaweka Ahadi yoyote ya Kichango
              </h4>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-900 border border-white/5 px-3.5 py-1 rounded-full">
                Bado Kuchangia: {filteredGuests.length} Wageni
              </span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-white/5 bg-slate-950/40">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/5 border-b border-white/10 text-slate-400 text-[9.5px] uppercase">
                    <th className="py-3 px-3 font-black text-center">S/N</th>
                    <th className="py-3 px-3 font-black">Mgeni / Guest Name</th>
                    <th className="py-3 px-3 font-black">Namba ya Simu</th>
                    <th className="py-3 px-3 text-center font-black">Registration RSVP Pledge Link</th>
                    <th className="py-3 px-3 text-center font-black">Mrejesho Kampeni (SMS Log)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-200 text-[11px]">
                  {filteredGuests.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        Safi sana! Wageni wote wameishaandikisha michango yao kikamilifu.
                      </td>
                    </tr>
                  ) : (
                    filteredGuests.map((g, idx) => (
                      <tr key={g.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-2.5 px-3 text-center text-slate-500">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-bold uppercase">{g.name}</td>
                        <td className="py-2.5 px-3 text-slate-400 text-[10px]">{g.phone || 'Hakuna Namba'}</td>
                        <td className="py-2.5 px-3 text-center text-slate-500 text-[10px]">
                          https://eventcard.co.tz/pledge/{g.code}
                        </td>
                        <td className="py-2.5 px-3 text-center text-[10.5px]">
                          SMS Zilizotumwa: <strong className="text-blue-400 font-bold">{g.smsCount || 0}</strong>  •  WA: <strong className="text-emerald-400 font-bold">{g.whatsappCount || 0}</strong>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

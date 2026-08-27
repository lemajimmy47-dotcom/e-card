import * as XLSX from 'xlsx';

export interface ParsedGuestItem {
  name: string;
  phone: string;
  cardType: string;
  category?: string;
  tags?: string[];
  customFields?: Record<string, string>;
  pledgeAmount?: number;
  paidAmount?: number;
  pledgeStatus?: 'No Pledge' | 'Pledged' | 'Partially Paid' | 'Fully Paid';
}

export const parseTextToMatrix = (text: string): string[][] => {
  if (!text) return [];
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
  return lines.map(line => {
    // 1. Tab separated (from Excel/Google Sheets copy paste)
    if (line.includes('\t')) {
      return line.split('\t').map(c => c.trim().replace(/^"|"$/g, ''));
    }

    // 2. CSV / Delimited parsing with smart handling of quotes AND numbers with thousands separators (e.g., 5,000,000.00)
    const cells: string[] = [];
    let currentCell = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        // Check if this comma is inside a formatted number like "5,000,000.00" or "250,000"
        const prevChar = line[i - 1] || '';
        const nextChars = line.slice(i + 1, i + 4);
        const charAfter3 = line[i + 4] || '';

        const isDigitBefore = /\d/.test(prevChar);
        const isThreeDigitsAfter = /^\d{3}$/.test(nextChars);
        const isFollowedByNumberSymbolOrEnd = /^[\d.,\s"$]/.test(charAfter3) || i + 4 >= line.length;

        if (isDigitBefore && isThreeDigitsAfter && isFollowedByNumberSymbolOrEnd) {
          // Thousands separator comma - keep it inside cell
          currentCell += char;
        } else {
          cells.push(currentCell.trim().replace(/^"|"$/g, ''));
          currentCell = '';
        }
      } else if ((char === ';' || char === '|') && !inQuotes) {
        cells.push(currentCell.trim().replace(/^"|"$/g, ''));
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
    cells.push(currentCell.trim().replace(/^"|"$/g, ''));
    return cells;
  });
};

export const parseAmountValue = (val: any): number => {
  if (val == null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = String(val).replace(/,/g, '').replace(/[^0-9.]/g, '');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

export const parseUniversalGuestTable = (rawMatrix: (string | number)[][]): ParsedGuestItem[] => {
  if (!rawMatrix || rawMatrix.length === 0) return [];

  const validRows = rawMatrix.filter(row => row && row.some(cell => String(cell ?? '').trim() !== ''));
  if (validRows.length === 0) return [];

  let headerRowIndex = -1;
  let nameCol = -1;
  let phoneCol = -1;
  let categoryCol = -1;
  let cardTypeCol = -1;
  let pledgeCol = -1;
  let paidCol = -1;
  let tableCol = -1;
  let foodCol = -1;

  const normHeader = (val: any): string => {
    return String(val ?? '')
      .toLowerCase()
      .replace(/[*()]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Inspect first 8 rows to find header row
  for (let r = 0; r < Math.min(validRows.length, 8); r++) {
    const row = validRows[r];
    let foundName = -1;
    let foundPhone = -1;
    let foundCat = -1;
    let foundCard = -1;
    let foundPledge = -1;
    let foundPaid = -1;
    let foundTable = -1;
    let foundFood = -1;

    row.forEach((cell, cIdx) => {
      const norm = normHeader(cell);
      if (!norm) return;

      if (foundName === -1 && (
        norm.includes('guest name') || norm.includes('full name') || norm.includes('jina la mgeni') || 
        norm.includes('jina') || norm.includes('mgeni') || norm.includes('name') || 
        norm.includes('mchangiaji') || norm.includes('mlipaji') || norm.includes('member') || norm.includes('majina')
      )) {
        foundName = cIdx;
      }
      else if (foundPhone === -1 && (
        norm.includes('phone') || norm.includes('simu') || norm.includes('namba') || 
        norm.includes('mobile') || norm.includes('contact') || norm.includes('tel') || 
        norm.includes('nu') || norm.includes('no')
      )) {
        foundPhone = cIdx;
      }
      else if (foundCat === -1 && (
        norm.includes('category') || norm.includes('kategoria') || norm.includes('kikundi') || 
        norm.includes('group') || norm.includes('kundi') || norm.includes('tag') || norm.includes('lebo')
      )) {
        foundCat = cIdx;
      }
      else if (foundCard === -1 && (
        norm.includes('card type') || norm.includes('aina ya kadi') || norm.includes('card') || 
        norm.includes('kadi') || norm.includes('single/double')
      )) {
        foundCard = cIdx;
      }
      else if (foundPledge === -1 && (
        norm.includes('pledge') || norm.includes('ahadi') || norm.includes('pledged') || 
        norm.includes('kiasi cha ahadi') || norm.includes('mchango wa ahadi')
      )) {
        foundPledge = cIdx;
      }
      else if (foundPaid === -1 && (
        norm.includes('paid') || norm.includes('iliyolipwa') || norm.includes('cash') || 
        norm.includes('michango') || norm.includes('kilicholipwa') || norm.includes('ilipwa') || 
        norm.includes('lipwa') || norm.includes('kiasi kilicholipwa') || norm.includes('mchango')
      )) {
        foundPaid = cIdx;
      }
      else if (foundTable === -1 && (
        norm.includes('table') || norm.includes('meza')
      )) {
        foundTable = cIdx;
      }
      else if (foundFood === -1 && (
        norm.includes('food') || norm.includes('chakula')
      )) {
        foundFood = cIdx;
      }
    });

    if (foundName !== -1) {
      headerRowIndex = r;
      nameCol = foundName;
      phoneCol = foundPhone;
      categoryCol = foundCat;
      cardTypeCol = foundCard;
      pledgeCol = foundPledge;
      paidCol = foundPaid;
      tableCol = foundTable;
      foodCol = foundFood;
      break;
    }
  }

  let dataStartRow = 0;
  if (headerRowIndex !== -1) {
    dataStartRow = headerRowIndex + 1;
  } else {
    // Intelligent Column Scoring if header row wasn't explicitly matched
    const row0 = validRows[0];
    const isRow0Header = row0.some(cell => {
      const s = String(cell ?? '').toLowerCase();
      return s.includes('name') || s.includes('jina') || s.includes('pledge') || s.includes('paid') || s.includes('ahadi') || s.includes('phone');
    });
    if (isRow0Header) {
      dataStartRow = 1;
    }

    // Auto detect columns by analyzing data rows
    const colScores: Record<number, { textCount: number; phoneCount: number; numericAmounts: number[] }> = {};
    const sampleRows = validRows.slice(dataStartRow, Math.min(validRows.length, dataStartRow + 20));

    sampleRows.forEach(row => {
      row.forEach((cell, cIdx) => {
        if (!colScores[cIdx]) colScores[cIdx] = { textCount: 0, phoneCount: 0, numericAmounts: [] };
        const val = String(cell ?? '').trim();
        if (!val) return;

        const num = parseAmountValue(val);
        const digitsOnly = val.replace(/\D/g, '');

        if (num > 1000) {
          colScores[cIdx].numericAmounts.push(num);
        } else if (digitsOnly.length >= 7 && digitsOnly.length <= 15 && (digitsOnly.startsWith('0') || digitsOnly.startsWith('255') || digitsOnly.startsWith('7') || digitsOnly.startsWith('6'))) {
          colScores[cIdx].phoneCount++;
        } else if (val.length >= 2 && isNaN(Number(val))) {
          colScores[cIdx].textCount++;
        }
      });
    });

    let bestTextCol = -1;
    let maxText = -1;
    const amountCols: { colIndex: number; avgAmount: number }[] = [];

    Object.entries(colScores).forEach(([colStr, score]) => {
      const cIdx = parseInt(colStr, 10);
      if (score.textCount > maxText) {
        maxText = score.textCount;
        bestTextCol = cIdx;
      }
      if (score.numericAmounts.length > 0) {
        const sum = score.numericAmounts.reduce((a, b) => a + b, 0);
        amountCols.push({ colIndex: cIdx, avgAmount: sum / score.numericAmounts.length });
      }
    });

    nameCol = bestTextCol !== -1 ? bestTextCol : 0;
    
    amountCols.sort((a, b) => a.colIndex - b.colIndex);
    if (amountCols.length >= 1) pledgeCol = amountCols[0].colIndex;
    if (amountCols.length >= 2) paidCol = amountCols[1].colIndex;

    if (phoneCol === -1) {
      Object.entries(colScores).forEach(([colStr, score]) => {
        const cIdx = parseInt(colStr, 10);
        if (score.phoneCount > 0 && cIdx !== nameCol && cIdx !== pledgeCol && cIdx !== paidCol) {
          phoneCol = cIdx;
        }
      });
    }
  }

  const results: ParsedGuestItem[] = [];

  for (let r = dataStartRow; r < validRows.length; r++) {
    const row = validRows[r];
    const nameVal = nameCol !== -1 && row[nameCol] != null ? String(row[nameCol]).trim() : '';
    
    if (!nameVal) continue;
    const normNameCheck = nameVal.toLowerCase();
    if (normNameCheck === 'guest full name' || normNameCheck === 'jina la mgeni' || normNameCheck === 'jina' || normNameCheck === 'name') continue;

    const phoneVal = phoneCol !== -1 && row[phoneCol] != null ? String(row[phoneCol]).trim() : '';
    const categoryVal = categoryCol !== -1 && row[categoryCol] != null ? String(row[categoryCol]).trim() : '';
    const cardTypeRaw = cardTypeCol !== -1 && row[cardTypeCol] != null ? String(row[cardTypeCol]).trim().toUpperCase() : '';

    let cardType = 'DOUBLE';
    if (cardTypeRaw.includes('SINGLE')) cardType = 'SINGLE';
    else if (cardTypeRaw.includes('DOUBLE')) cardType = 'DOUBLE';
    else if (['SINGLE', 'DOUBLE', 'FAMILY', 'VIP'].includes(cardTypeRaw)) cardType = cardTypeRaw;
    else if (categoryVal.toUpperCase().includes('SINGLE')) cardType = 'SINGLE';
    else if (categoryVal.toUpperCase().includes('DOUBLE')) cardType = 'DOUBLE';

    const pledgeAmount = pledgeCol !== -1 ? parseAmountValue(row[pledgeCol]) : 0;
    const paidAmount = paidCol !== -1 ? parseAmountValue(row[paidCol]) : 0;

    let pledgeStatus: 'No Pledge' | 'Pledged' | 'Partially Paid' | 'Fully Paid' = 'No Pledge';
    if (pledgeAmount > 0 || paidAmount > 0) {
      if (paidAmount >= pledgeAmount && pledgeAmount > 0) {
        pledgeStatus = 'Fully Paid';
      } else if (paidAmount > 0) {
        pledgeStatus = 'Partially Paid';
      } else if (pledgeAmount > 0) {
        pledgeStatus = 'Pledged';
      }
    }

    const tableVal = tableCol !== -1 && row[tableCol] != null ? String(row[tableCol]).trim() : '';
    const foodVal = foodCol !== -1 && row[foodCol] != null ? String(row[foodCol]).trim() : '';

    const customFieldsObj: Record<string, string> = {};
    if (tableVal) customFieldsObj.tableNumber = tableVal;
    if (foodVal) customFieldsObj.foodPreference = foodVal;

    const tags: string[] = [];
    if (categoryVal) tags.push(categoryVal);

    results.push({
      name: nameVal,
      phone: phoneVal,
      cardType,
      category: categoryVal || undefined,
      tags,
      customFields: Object.keys(customFieldsObj).length > 0 ? customFieldsObj : undefined,
      pledgeAmount: pledgeAmount > 0 ? pledgeAmount : undefined,
      paidAmount: paidAmount > 0 ? paidAmount : undefined,
      pledgeStatus
    });
  }

  return results;
};

export const parseFileToGuestMatrix = async (file: File): Promise<(string | number)[][]> => {
  const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

  if (isExcel) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const buffer = e.target?.result as ArrayBuffer;
          const workbook = XLSX.read(buffer, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rawMatrix: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' });
          resolve(rawMatrix);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  } else {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (!text) {
          resolve([]);
          return;
        }
        const matrix = parseTextToMatrix(text);
        resolve(matrix);
      };
      reader.onerror = (err) => reject(err);
      reader.readAsText(file);
    });
  }
};

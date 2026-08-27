export interface CardPreset {
  id: string;
  name: string;
  category: string;
  bgColor: string;
  accentColor: string;
  borderColor: string;
  pattern: 'floral' | 'modern' | 'minimalist' | 'gradient';
  svgPath?: string;
}

export const CARD_PRESETS: CardPreset[] = [
  {
    id: 'send-off',
    name: 'Kadi ya Send Off (Chapa ya Maua)',
    category: 'Send-Off',
    bgColor: '#FAF7F2',
    accentColor: '#1E3A8A', // Deep Blue
    borderColor: '#D97706', // Gold-ish Amber
    pattern: 'floral'
  },
  {
    id: 'harusi-royal',
    name: 'Kadi ya Harusi (Royal Gold)',
    category: 'Harusi',
    bgColor: '#FDFBF7',
    accentColor: '#881337', // Deep Bordeaux Burgundy
    borderColor: '#CA8A04', // Rich Gold
    pattern: 'gradient'
  },
  {
    id: 'kuzaliwa-sherehe',
    name: 'Kadi ya Sherehe ya Kuzaliwa',
    category: 'Birthday',
    bgColor: '#0F172A', // Dark Slate
    accentColor: '#10B981', // Emerald
    borderColor: '#3B82F6', // Blue Light
    pattern: 'modern'
  },
  {
    id: 'kipaimara-simple',
    name: 'Kadi ya Mualiko Kipaimara/Kipaimara',
    category: 'Celebration',
    bgColor: '#F1F5F9',
    accentColor: '#4F46E5', // Indigo
    borderColor: '#10B981', // Green
    pattern: 'minimalist'
  }
];

export const SWAHILI_QUOTES = [
  "Upendo na mshikamano ni ngao inayounganisha furaha ya maisha yetu.",
  "Tunakukaribisha kushuhudia na kufurahia pamoja nasi katika siku hii ya kipekee.",
  "Uwepo wako utaleta nakshi, baraka, na tabasamu njema katika sherehe zetu.",
  "Katika mwanzo mpya na furaha isiyo na kikomo, karibu sana tufurahi pamoja."
];

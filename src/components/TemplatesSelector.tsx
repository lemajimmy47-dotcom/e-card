import React, { useState, useEffect, useRef } from 'react';
import { Layout, Sliders, Type, CheckCircle, Upload, Check, ArrowRight, QrCode, Sparkles, Feather } from 'lucide-react';
import { EventDetails, TemplateSettings } from '../types';
import { CARD_PRESETS, CardPreset } from '../data/presets';
import { drawCardToCanvas } from '../utils/canvasHelper';
import { useLanguage } from '../context/LanguageContext';
import AICardCopywriter from './AICardCopywriter';

interface TemplatesSelectorProps {
  event: EventDetails;
  settings: TemplateSettings;
  onSave: (settings: TemplateSettings) => void;
  onNext: () => void;
}

export default function TemplatesSelector({ event, settings, onSave, onNext }: TemplatesSelectorProps) {
  const { language, t } = useLanguage();
  const [localSettings, setLocalSettings] = useState<TemplateSettings>({ ...settings });
  const [selectedPresetId, setSelectedPresetId] = useState(settings.imageUrl?.startsWith('data:') ? 'custom-uploaded' : 'send-off');
  const [activeTab, setActiveTab] = useState<'name' | 'qr' | 'type'>('name');
  const [isSaved, setIsSaved] = useState(false);
  const [previewCardType, setPreviewCardType] = useState<string>('DOUBLE');
  const [showCopywriter, setShowCopywriter] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (dataUrl) {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxW = 2048; // Imeongezwa kuruhusu ubora wa hali ya juu (high-res)
          if (width > maxW) {
            height = (maxW / width) * height;
            width = maxW;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.95);

          setLocalSettings(prev => ({
            ...prev,
            imageUrl: compressedDataUrl
          }));
          setSelectedPresetId('custom-uploaded');
        };
        img.src = dataUrl;
      }
    };
    reader.readAsDataURL(file);
  };

  // Sync state when parent settings or event changes
  // Stringify settings to prevent reference-equality checks from resetting unsaved local adjustments on parent re-renders
  const settingsStr = JSON.stringify(settings);
  useEffect(() => {
    const parsed = JSON.parse(settingsStr);
    setLocalSettings(parsed);
    setSelectedPresetId(parsed.imageUrl?.startsWith('data:') ? 'custom-uploaded' : 'send-off');
  }, [settingsStr, event.id]);

  // Re-draw canvas on localSettings change or event change
  useEffect(() => {
    if (canvasRef.current) {
      drawCardToCanvas(
        canvasRef.current,
        event,
        localSettings,
        'Jimson Lema', // sample name requested by user
        previewCardType, // preview dynamically chosen card type ('DOUBLE', 'SINGLE', 'UNCLASSIFIED')
        'EVENTCARD-SAMPLE-QR'
      );
    }
  }, [localSettings, event, language, previewCardType]);

  const handleSelectPreset = (preset: CardPreset) => {
    setSelectedPresetId(preset.id);
    setLocalSettings(prev => ({
      ...prev,
      imageUrl: preset.bgColor, // Using color representation as template img
      textColor: preset.accentColor
    }));
  };

  const handleSave = () => {
    onSave(localSettings);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const fonts = [
    { id: 'Inter', name: language === 'sw' ? 'Inter (Safi / Modern)' : 'Inter (Clean / Modern)' },
    { id: 'Playfair Display', name: language === 'sw' ? 'Playfair (Ya Kawaida / Serif)' : 'Playfair Display (Elegant Serif)' },
    { id: 'JetBrains Mono', name: language === 'sw' ? 'Mono (Simu / Tek)' : 'JetBrains Mono (Technical / Code)' },
    { id: 'Space Grotesk', name: language === 'sw' ? 'Space Grotesk (Ki-goti / Sharp)' : 'Space Grotesk (Tech Geometric)' },
    { id: 'Cinzel', name: language === 'sw' ? 'Cinzel (Mvuto wa Kirumi)' : 'Cinzel (Roman Aesthetic)' },
    { id: 'Dancing Script', name: language === 'sw' ? 'Dancing Script (Mwandiko wa Mkono)' : 'Dancing Script (Playful Script)' },
    { id: 'Great Vibes', name: language === 'sw' ? 'Great Vibes (Kifahari / Cursive)' : 'Great Vibes (Luxury Calligraphy)' },
    { id: 'Montserrat', name: language === 'sw' ? 'Montserrat (Mduara / Safi)' : 'Montserrat (Symmetrical Sans)' },
    { id: 'Cormorant Garamond', name: language === 'sw' ? 'Cormorant Garamond (Ya Kimapenzi)' : 'Cormorant Garamond (Romantic Literary)' }
  ];

  return (
    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-[1.75rem] p-6 sm:p-8 space-y-6 font-sans text-xs text-white" id="templates-selector-container">
      
      {/* Header Panel */}
      <div className="border-b border-white/10 pb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Layout className="w-5 h-5 text-blue-400" />
            <span>{language === 'sw' ? 'Mpangilio wa Kadi (Layout Settings)' : 'Card Template & Layout Settings'}</span>
          </h2>
          <p className="text-slate-350 mt-0.5">
            {language === 'sw' 
              ? 'Sanifu mwonekano wa mwaliko kwa kuchagua presets, kubadilisha fonti na kurekebisha nafasi za majina na QR code.'
              : 'Design the invitation template by selecting preset cards, swapping fonts, and positioning guest names and QR codes.'}
          </p>
        </div>

        <button
          onClick={() => setShowCopywriter(!showCopywriter)}
          className="px-4 py-2.5 bg-gradient-to-r from-amber-500 via-amber-600 to-indigo-600 text-slate-950 font-black text-xs rounded-xl shadow-lg hover:scale-105 transition flex items-center gap-2 shrink-0 cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-slate-950" />
          <span>{language === 'sw' ? 'Andika Mashairi kwa AI' : 'AI Copywriting & Poems'}</span>
        </button>
      </div>

      {/* AI Copywriter Modal / Panel */}
      {showCopywriter && (
        <div className="animate-fade-in mb-6">
          <AICardCopywriter
            event={event}
            onClose={() => setShowCopywriter(false)}
            onApplyCopy={(invText, smsText) => {
              setShowCopywriter(false);
              alert(language === 'sw' ? "Mashairi na maneno ya mwaliko yamehifadhiwa!" : "Invitation copy applied!");
            }}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: Controls (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Preset templates selector & Custom Image Uploader */}
          <div className="space-y-3">
            <h3 className="font-bold text-slate-300 text-[11px] uppercase tracking-wider font-mono">
              {language === 'sw' ? '1. Chagua Rangi ya Preset au Kupakia Background Picha Yako' : '1. Choose Standard Presets or Upload Your Card Design'}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Presets Grid */}
              <div className="space-y-2">
                <p className="text-[10px] text-slate-400 font-semibold font-sans">
                  {language === 'sw' ? 'Mifumo ya Rangi (Standard Presets):' : 'Pre-built Ambient Presets:'}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {CARD_PRESETS.map((preset) => {
                    const isSelected = selectedPresetId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        id={`preset-btn-${preset.id}`}
                        onClick={() => handleSelectPreset(preset)}
                        className={`p-2.5 rounded-xl border text-left transition relative flex flex-col justify-between aspect-[1.4] cursor-pointer ${
                          isSelected 
                            ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-500/10' 
                            : 'border-white/10 bg-[#050b18]/40 hover:border-white/20'
                        }`}
                      >
                        <div className="w-4 h-4 rounded-full border border-white/20" style={{ backgroundColor: preset.accentColor }} />
                        <div className="mt-1 text-left">
                          <p className="font-bold text-white leading-tight block text-[9px]">{preset.category}</p>
                          <p className="text-[8px] text-slate-400 truncate">{preset.name}</p>
                        </div>
                        {isSelected && (
                          <span className="absolute top-1.5 right-1.5 bg-gradient-to-tr from-blue-500 to-purple-500 text-white p-0.5 rounded-full">
                            <Check className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Drag and drop zone */}
              <div className="space-y-2">
                <p className="text-[10px] text-slate-400 font-semibold font-sans">
                  {language === 'sw' ? 'Pakia Picha yako ya Kadi (Upload Custom Card Style):' : 'Upload custom design layout:'}
                </p>
                
                <div 
                  className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center text-center transition cursor-pointer aspect-[1.6] ${
                    selectedPresetId === 'custom-uploaded' 
                      ? 'border-blue-500 bg-blue-500/5' 
                      : 'border-white/20 hover:border-white/40 bg-white/5'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleUploadFile(file);
                  }}
                >
                  <input 
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadFile(file);
                    }}
                    className="hidden"
                  />
                  <Upload className={`w-6 h-6 mb-1.5 ${selectedPresetId === 'custom-uploaded' ? 'text-blue-400' : 'text-slate-400'}`} />
                  <p className="font-bold text-white text-[10px]">
                    {language === 'sw' ? 'BURUTA AU BOFYA HAPA' : 'DRAG OR TAP TO INDEX'}
                  </p>
                  <p className="text-[8px] text-slate-400 mt-0.5 max-w-[150px] leading-normal">
                    {selectedPresetId === 'custom-uploaded' 
                      ? (language === 'sw' ? '✓ Picha ya Kadi Imepakiwa' : '✓ Custom card loaded successfully') 
                      : (language === 'sw' ? '.PNG au .JPG (Mapendekezo ya 3:4)' : '.PNG or .JPG (Preferred 3:4 ratio)')
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Core position tab controllers */}
          <div className="space-y-4 border-t border-white/10 pt-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="font-bold text-slate-350 text-[11px] uppercase tracking-wider font-mono">
                {language === 'sw' ? '2. Badilisha Nafasi za Vipengele' : '2. Element Positions & Alignment'}
              </h3>
              
              {/* Navigation tabs for position editors */}
              <div className="flex flex-wrap items-center gap-1 bg-slate-900 p-1 rounded-xl border border-white/5">
                <button
                  type="button"
                  id="tab-btn-name"
                  onClick={() => setActiveTab('name')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
                    activeTab === 'name' 
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {language === 'sw' ? 'Jina la Mgeni' : 'Guest Name'}
                </button>
                <button
                  type="button"
                  id="tab-btn-qr"
                  onClick={() => setActiveTab('qr')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
                    activeTab === 'qr' 
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {language === 'sw' ? 'QR Code' : 'QR Code'}
                </button>
                <button
                  type="button"
                  id="tab-btn-type"
                  onClick={() => setActiveTab('type')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
                    activeTab === 'type' 
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {language === 'sw' ? 'Aina ya Kadi' : 'Card Badge'}
                </button>
              </div>
            </div>

            {/* Position Controls Details container */}
            <div className="bg-[#0b1324]/50 border border-white/10 rounded-2xl p-4 space-y-4">
              
              {activeTab === 'name' && (
                <div className="space-y-4">
                  <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                    <span>{language === 'sw' ? 'Uhariri wa eneo la Jina la Mgeni' : 'Adjust Guest Name Layout'}</span>
                  </h4>
                  
                  {/* Slider X */}
                  <div className="space-y-1 font-sans">
                    <div className="flex justify-between font-mono text-[9.5px] text-slate-400">
                      <span>{language === 'sw' ? 'Kushoto / Kulia (X Axis)' : 'Horizontal Align (Name X)'}</span>
                      <span className="text-amber-400 font-bold">{localSettings.guestNameX}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={localSettings.guestNameX}
                      onChange={(e) => setLocalSettings({ ...localSettings, guestNameX: parseInt(e.target.value) })}
                      className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>

                  {/* Slider Y */}
                  <div className="space-y-1">
                    <div className="flex justify-between font-mono text-[9.5px] text-slate-400">
                      <span>{language === 'sw' ? 'Juu / Chini (Y Axis)' : 'Vertical Align (Name Y)'}</span>
                      <span className="text-amber-400 font-bold">{localSettings.guestNameY}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={localSettings.guestNameY}
                      onChange={(e) => setLocalSettings({ ...localSettings, guestNameY: parseInt(e.target.value) })}
                      className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>

                  {/* Slider Size */}
                  <div className="space-y-1 font-sans">
                    <div className="flex justify-between font-mono text-[9.5px] text-slate-400">
                      <span>{language === 'sw' ? 'Ukubwa wa Jina (Font Size)' : 'Typography Font Size'}</span>
                      <span className="text-amber-400 font-bold">{localSettings.guestNameSize}px</span>
                    </div>
                    <input 
                      type="range" 
                      min="12" 
                      max="40" 
                      value={localSettings.guestNameSize}
                      onChange={(e) => setLocalSettings({ ...localSettings, guestNameSize: parseInt(e.target.value) })}
                      className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>

                  {/* Independent Guest Name Color Picker */}
                  <div className="space-y-2 border-t border-white/10 pt-3">
                    <label className="font-bold text-slate-350 block text-[11px]" htmlFor="color-name-picker">
                      {language === 'sw' ? 'Rangi ya Jina la Mgeni' : 'Guest Name Highlight Color'}
                    </label>
                    <div className="flex items-center space-x-2">
                      <input 
                        id="color-name-picker"
                        type="color" 
                        value={localSettings.guestNameColor || localSettings.textColor} 
                        onChange={(e) => setLocalSettings({ ...localSettings, guestNameColor: e.target.value })}
                        className="w-8 h-8 rounded-lg border border-white/20 cursor-pointer p-0 bg-transparent transition-transform hover:scale-105"
                      />
                      <span className="font-mono text-[10px] text-white bg-white/10 px-2 py-1 rounded border border-white/10 uppercase">
                        {localSettings.guestNameColor || localSettings.textColor}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'qr' && (
                <div className="space-y-4">
                  <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse shrink-0" />
                    <span>{language === 'sw' ? 'Uhariri wa eneo la Kisimbuzi cha QR (QR Code)' : 'Adjust QR Code Placement Coordinates'}</span>
                  </h4>
                  
                  {/* Slider X */}
                  <div className="space-y-1 font-sans">
                    <div className="flex justify-between font-mono text-[10px] text-slate-355">
                      <span>{language === 'sw' ? 'Msimamo wa Kushoto/Kulia (X Axis)' : 'Horizontal Alignment (X position)'}</span>
                      <span className="text-blue-400 font-bold">{localSettings.qrCodeX}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={localSettings.qrCodeX}
                      onChange={(e) => setLocalSettings({ ...localSettings, qrCodeX: parseInt(e.target.value) })}
                      className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>

                  {/* Slider Y */}
                  <div className="space-y-1">
                    <div className="flex justify-between font-mono text-[10px] text-slate-355">
                      <span>{language === 'sw' ? 'Msimamo wa Juu/Chini (Y Axis)' : 'Vertical Alignment (Y position)'}</span>
                      <span className="text-blue-400 font-bold">{localSettings.qrCodeY}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={localSettings.qrCodeY}
                      onChange={(e) => setLocalSettings({ ...localSettings, qrCodeY: parseInt(e.target.value) })}
                      className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>

                  {/* Slider Size */}
                  <div className="space-y-1 font-sans">
                    <div className="flex justify-between font-mono text-[10px] text-slate-355">
                      <span>{language === 'sw' ? 'Ukubwa wa QR Code Square (Size)' : 'Square Perimeter Size'}</span>
                      <span className="text-blue-400 font-bold">{localSettings.qrCodeSize}px</span>
                    </div>
                    <input 
                      type="range" 
                      min="30" 
                      max="150" 
                      value={localSettings.qrCodeSize}
                      onChange={(e) => setLocalSettings({ ...localSettings, qrCodeSize: parseInt(e.target.value) })}
                      className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>

                  {/* Specific user requested notice about high-contrast solid black QR Code */}
                  <div className="font-mono text-[9px] bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-blue-300 leading-normal">
                    {language === 'sw' 
                      ? '✓ Kisimbuzi cha QR kimewekewa rangi NYEUSI dhabiti juu ya mandhari nyeupe ili kuhakikisha usomaji wa papo hapo na usio na makosa kabisa mlangoni.'
                      : '✓ The QR Code is locked in solid high-performance BLACK with a clean white baseline board to ensure error-free venue scanning.'}
                  </div>
                </div>
              )}

              {activeTab === 'type' && (
                <div className="space-y-4">
                  <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse shrink-0" />
                    <span>{language === 'sw' ? 'Uhariri wa eneo la Aina ya Kadi (Card Type Badge)' : 'Adjust Card Type Label Coordinates'}</span>
                  </h4>
                  
                  {/* Slider X */}
                  <div className="space-y-1 font-sans">
                    <div className="flex justify-between font-mono text-[10px] text-slate-355">
                      <span>{language === 'sw' ? 'Msimamo wa Kushoto/Kulia (X Axis)' : 'Horizontal Alignment (X position)'}</span>
                      <span className="text-purple-400 font-bold">{localSettings.cardTypeX}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={localSettings.cardTypeX}
                      onChange={(e) => setLocalSettings({ ...localSettings, cardTypeX: parseInt(e.target.value) })}
                      className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>

                  {/* Slider Y */}
                  <div className="space-y-1">
                    <div className="flex justify-between font-mono text-[10px] text-slate-355">
                      <span>{language === 'sw' ? 'Msimamo wa Juu/Chini (Y Axis)' : 'Vertical Alignment (Y position)'}</span>
                      <span className="text-purple-400 font-bold">{localSettings.cardTypeY}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={localSettings.cardTypeY}
                      onChange={(e) => setLocalSettings({ ...localSettings, cardTypeY: parseInt(e.target.value) })}
                      className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>

                  {/* Slider Size */}
                  <div className="space-y-1 font-sans">
                    <div className="flex justify-between font-mono text-[10px] text-slate-355">
                      <span>{language === 'sw' ? 'Ukubwa wa Font ya Aina ya Kadi (Font Size)' : 'Badge Font Size'}</span>
                      <span className="text-purple-400 font-bold">{localSettings.cardTypeSize}px</span>
                    </div>
                    <input 
                      type="range" 
                      min="10" 
                      max="35" 
                      value={localSettings.cardTypeSize}
                      onChange={(e) => setLocalSettings({ ...localSettings, cardTypeSize: parseInt(e.target.value) })}
                      className="w-full h-1 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>

                  {/* Independent Card Type Badge Color Picker */}
                  <div className="space-y-2 border-t border-white/10 pt-3">
                    <label className="font-bold text-slate-300 block text-[11px]" htmlFor="color-type-picker">
                      {language === 'sw' ? 'Rangi ya Aina ya Kadi' : 'Badge Highlight Color'}
                    </label>
                    <div className="flex items-center space-x-2">
                      <input 
                        id="color-type-picker"
                        type="color" 
                        value={localSettings.cardTypeColor || '#fbbf24'} 
                        onChange={(e) => setLocalSettings({ ...localSettings, cardTypeColor: e.target.value })}
                        className="w-8 h-8 rounded-lg border border-white/20 cursor-pointer p-0 bg-transparent transition-transform hover:scale-105"
                      />
                      <span className="font-mono text-[10px] text-white bg-white/10 px-2 py-1 rounded border border-white/10 uppercase">
                        {localSettings.cardTypeColor || '#fbbf24'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Typography Color and Font Style settings with custom requested Font features */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-white/10 pt-5 pr-1">
            <div className="space-y-2">
              <label className="font-bold text-slate-300 block" htmlFor="color-picker-input">
                {language === 'sw' ? 'Rangi ya Maandishi (Text Tone)' : 'Typography Text Color'}
              </label>
              <div className="flex items-center space-x-2">
                <input 
                  id="color-picker-input"
                  type="color" 
                  value={localSettings.textColor} 
                  onChange={(e) => setLocalSettings({ ...localSettings, textColor: e.target.value })}
                  className="w-10 h-10 rounded-xl border border-white/20 cursor-pointer p-0 bg-transparent transition-transform hover:scale-105"
                />
                <span className="font-mono text-xs text-white bg-white/10 px-3 py-1.5 rounded-lg border border-white/10 uppercase">
                  {localSettings.textColor}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="font-bold text-slate-300 block" htmlFor="font-family-select">
                {language === 'sw' ? 'Fonti Tofauti za Kadi (Premium Fonts)' : 'Premium Typography font'}
              </label>
              <select
                id="font-family-select"
                value={localSettings.fontFamily}
                onChange={(e) => setLocalSettings({ ...localSettings, fontFamily: e.target.value })}
                className="w-full border border-white/10 bg-[#050b18] rounded-xl px-3 py-2 text-white focus:outline-none cursor-pointer text-xs font-semibold mb-3"
              >
                {fonts.map(font => (
                  <option key={font.id} value={font.id} className="bg-[#050b18] text-white">
                    {font.name}
                  </option>
                ))}
              </select>
              
              <label className="font-bold text-slate-300 block mt-3" htmlFor="orientation-select">
                {language === 'sw' ? 'Muundo wa Kadi' : 'Card Orientation'}
              </label>
              <select
                id="orientation-select"
                value={localSettings.orientation || 'portrait'}
                onChange={(e) => setLocalSettings({ ...localSettings, orientation: e.target.value as 'portrait' | 'landscape' })}
                className="w-full border border-white/10 bg-[#050b18] rounded-xl px-3 py-2 text-white focus:outline-none cursor-pointer text-xs font-semibold"
              >
                <option value="portrait" className="bg-[#050b18] text-white">{language === 'sw' ? 'Wima (Portrait)' : 'Portrait'}</option>
                <option value="landscape" className="bg-[#050b18] text-white">{language === 'sw' ? 'Ulalo (Landscape)' : 'Landscape'}</option>
              </select>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex justify-between border-t border-white/10 pt-5 text-xs">
            <button
              id="template-save-btn"
              onClick={handleSave}
              className={`px-5 py-3 rounded-xl font-bold transition flex items-center gap-1.5 shadow-sm min-w-[150px] cursor-pointer ${
                isSaved 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-[#050b18] text-white border border-white/15 hover:bg-white/5'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>{isSaved ? (language === 'sw' ? 'Imehifadhiwa!' : 'Saved Successfully!') : (language === 'sw' ? 'Hifadhi Kadi ✓' : 'Save Layout Settings ✓')}</span>
            </button>
            
            <button
              id="template-next-btn"
              onClick={onNext}
              className="px-5 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:shadow-[0_0_15px_rgba(59,130,246,0.3)] text-white font-bold rounded-xl transition flex items-center gap-1.5 shadow-md text-xs cursor-pointer"
            >
              <span>{language === 'sw' ? 'Weka Orodha ya Wageni' : 'Upload Guest List'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </div>

        {/* RIGHT COLUMN: Canvas Workspace Live Preview (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col items-center space-y-3">
          <h3 className="font-bold text-slate-350 text-[11px] uppercase tracking-wider font-mono self-start text-center w-full">
            {language === 'sw' 
              ? (localSettings.orientation === 'landscape' ? '3. Mwonekano wa Kadi (600 x 450 px)' : '3. Mwonekano wa Kadi (450 x 600 px)') 
              : (localSettings.orientation === 'landscape' ? '3. Live Canva Preview (600 x 450 px)' : '3. Live Canva Preview (450 x 600 px)')}
          </h3>
          
          <div id="preview" className={`relative border-4 border-white/10 rounded-3xl shadow-2xl overflow-hidden bg-white w-full ${localSettings.orientation === 'landscape' ? 'aspect-[4/3] max-w-[450px]' : 'aspect-[3/4] max-w-[340px]'}`}>
            <canvas 
              ref={canvasRef} 
              width={(localSettings.orientation === 'landscape' ? 600 : 450) * 3} 
              height={(localSettings.orientation === 'landscape' ? 450 : 600) * 3} 
              className="w-full h-auto block bg-white"
            />
            {/* Transparent 'PREVIEW MODE' watermark overlay */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center select-none z-30 overflow-hidden">
              <div className="transform -rotate-45 border-4 border-slate-900/15 rounded-2xl px-6 py-2 sm:px-8 sm:py-3 bg-white/10 shadow-inner backdrop-blur-[1px]">
                <span className="text-slate-900/25 font-black text-xl sm:text-3xl tracking-[0.25em] uppercase whitespace-nowrap select-none">
                  PREVIEW MODE
                </span>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 italic text-center leading-relaxed">
            {language === 'sw' 
              ? 'Huu ndio mwonekano halisi wa kadi kila mgeni atakayoipakua kipekee ikiwa na jina lake, aina yake, na nambari yake ya kipekee ya QR Code.'
              : 'This represents the genuine high-fidelity invitation layout that guests will retrieve with their assigned name and QR scanning pass.'}
          </p>
        </div>

      </div>

    </div>
  );
}

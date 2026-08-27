import React from 'react';

export const ReportWatermark: React.FC = () => {
  return (
    <div className="pointer-events-none absolute inset-0 select-none z-[50] overflow-hidden print:fixed print:inset-0 print:z-[9999]">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .watermark-grid {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            padding: 2rem !important;
            pointer-events: none !important;
            z-index: 9999 !important;
            opacity: 0.18 !important;
          }
        }
      `}} />
      <div className="watermark-grid absolute inset-0 flex flex-col justify-between p-6 opacity-[0.18]">
        {/* Top Corners */}
        <div className="flex justify-between items-start w-full">
          <img src="/logo.png" alt="" className="w-16 sm:w-24 h-auto object-contain" />
          <img src="/logo.png" alt="" className="w-16 sm:w-24 h-auto object-contain" />
        </div>
        
        {/* Center */}
        <div className="flex justify-center items-center my-auto w-full">
          <img src="/logo.png" alt="" className="w-36 sm:w-56 h-auto object-contain" />
        </div>
        
        {/* Bottom Corners */}
        <div className="flex justify-between items-end w-full">
          <img src="/logo.png" alt="" className="w-16 sm:w-24 h-auto object-contain" />
          <img src="/logo.png" alt="" className="w-16 sm:w-24 h-auto object-contain" />
        </div>
      </div>
    </div>
  );
};

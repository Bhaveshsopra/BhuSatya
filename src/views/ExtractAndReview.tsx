import React, { useState } from 'react';
import { ExtractionData, ActiveTab } from '../types';

interface ExtractAndReviewProps {
  initialExtraction: ExtractionData;
  onNavigateTab: (tab: ActiveTab, parcelId?: string) => void;
}

export const ExtractAndReview: React.FC<ExtractAndReviewProps> = ({
  initialExtraction,
  onNavigateTab,
}) => {
  const [extraction, setExtraction] = useState<ExtractionData>(initialExtraction);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [rotation, setRotation] = useState(0);
  const [boxesVisible, setBoxesVisible] = useState(true);
  const [showMarathiOwner, setShowMarathiOwner] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [rejectionNotice, setRejectionNotice] = useState(false);

  // Editable form fields state
  const [ownerName, setOwnerName] = useState(extraction.fields?.primaryOwner?.value || 'Suresh Vithalrao Deshmukh');
  const [surveyNum, setSurveyNum] = useState(extraction.fields?.surveyNumber?.value || '142/3A');
  const [hissa, setHissa] = useState(extraction.fields?.subDivision?.value || 'Sub-division 3A (Hissa No. 1)');
  const [landArea, setLandArea] = useState(extraction.fields?.totalArea?.value || '1.45 Ha (01H 45R Pot Kharaba: 0.05R)');
  const [shareFraction, setShareFraction] = useState(extraction.fields?.shareFraction?.value || '1/2 Share (Joint Co-parcener with Ramesh V. Deshmukh)');
  const [encumbrances, setEncumbrances] = useState(extraction.fields?.encumbrances?.value || 'Bank of Maharashtra, Branch Hinjawadi - Charge Rs 15,00,000 (Agri Loan dated 12/03/2019)');

  const handleZoomIn = () => {
    if (zoomLevel < 1.6) setZoomLevel((z) => Number((z + 0.15).toFixed(2)));
  };

  const handleZoomOut = () => {
    if (zoomLevel > 0.6) setZoomLevel((z) => Number((z - 0.15).toFixed(2)));
  };

  const handleRotate = () => {
    setRotation((r) => (r + 90) % 360);
  };

  const handleFit = () => {
    setZoomLevel(1.0);
    setRotation(0);
  };

  const handleRescan = async () => {
    setIsScanning(true);
    try {
      const res = await fetch('/api/extraction/rescan', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.data) {
        setExtraction(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(() => setIsScanning(false), 600);
    }
  };

  const handleConfirmAndRun = async () => {
    setIsVerifying(true);
    try {
      // Save changes to backend
      await fetch('/api/extraction', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            ...extraction.fields,
            primaryOwner: { ...extraction.fields.primaryOwner, value: ownerName },
            surveyNumber: { ...extraction.fields.surveyNumber, value: surveyNum },
            subDivision: { ...extraction.fields.subDivision, value: hissa },
            totalArea: { ...extraction.fields.totalArea, value: landArea },
            shareFraction: { ...extraction.fields.shareFraction, value: shareFraction },
            encumbrances: { ...extraction.fields.encumbrances, value: encumbrances },
          },
        }),
      });

      await fetch('/api/extraction/confirm', { method: 'POST' });

      setTimeout(() => {
        setIsVerifying(false);
        onNavigateTab('parcel-check-and-red-flag-gate', 'p-142-3a');
      }, 1000);
    } catch (err) {
      console.error(err);
      setIsVerifying(false);
    }
  };

  const handleReject = () => {
    if (window.confirm('Reject extract scan and request fresh mutation ledger copy from Pune Tahsildar?')) {
      setRejectionNotice(true);
      setTimeout(() => setRejectionNotice(false), 3500);
    }
  };

  return (
    <div className="flex flex-col w-full space-y-6">
      {/* Page Header Sub-bar */}
      <div className="w-full bg-[#f2f3ff] py-4 px-4 sm:px-6 lg:px-8 rounded-xl shadow-xs border border-[#c0c9be]/50">
        <div className="max-w-[1280px] mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xl text-[#003b1b] font-bold tracking-tight">
                Document AI Extraction & Field Verification
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[#92f5a4] text-[#007233] text-xs uppercase font-semibold">
                Live Pipeline v4.2
              </span>
            </div>
            <p className="text-xs text-[#404941] flex items-center gap-2 flex-wrap">
              <span className="font-mono font-semibold text-[#131b2e]">Doc Ref: {extraction.docRef}</span>
              <span>•</span>
              <span>Source: {extraction.source}</span>
              <span>•</span>
              <span className="inline-flex items-center gap-1 text-[#003b1b] font-medium">
                <span className="material-symbols-outlined text-[14px]">psychology</span>
                {extraction.engine}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-center">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#92f5a4]/60 shadow-xs border border-[#006d30]/20">
              <span
                className="material-symbols-outlined text-[#006d30] text-[20px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                verified
              </span>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-[#007233]">Extraction Quality</span>
                <span className="text-xs text-[#003b1b] font-bold">{extraction.quality}</span>
              </div>
            </div>

            <button
              onClick={handleRescan}
              disabled={isScanning}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white text-[#131b2e] hover:bg-[#eaedff] transition-all shadow-xs border border-[#c0c9be]/60 text-xs font-semibold"
            >
              <span
                className={`material-symbols-outlined text-base ${isScanning ? 'animate-spin text-[#003b1b]' : ''}`}
              >
                refresh
              </span>
              <span>{isScanning ? 'Scanning OCR...' : 'Re-scan OCR'}</span>
            </button>
          </div>
        </div>
      </div>

      {rejectionNotice && (
        <div className="p-3 bg-[#ffdad6] text-[#ba1a1a] rounded-xl border border-[#ba1a1a]/30 text-xs font-semibold animate-in fade-in flex items-center justify-between">
          <span>✓ Rejection dispatched to Talathi Mulshi. Fresh certified copy requested on portal.</span>
          <button onClick={() => setRejectionNotice(false)} className="text-xs underline">Dismiss</button>
        </div>
      )}

      {/* Main Split-Screen Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT SIDE: Document Viewer (50% desktop split) */}
        <section className="lg:col-span-6 flex flex-col bg-white rounded-xl shadow-xs border border-[#c0c9be]/60 overflow-hidden">
          {/* Document Toolbar Header */}
          <div className="bg-[#eaedff] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-[#c0c9be]/40">
            <div className="flex items-center gap-2 min-w-0">
              <span className="material-symbols-outlined text-[#003b1b] text-[20px]">description</span>
              <div className="flex flex-col min-w-0">
                <h2 className="text-xs font-bold text-[#131b2e] truncate">Original Scanned 7/12 Extract</h2>
                <span className="text-[10px] text-[#404941] truncate">गाव नमुना सात / बारा (अधिकार अभिलेख पत्रक)</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Document Controls */}
              <div className="flex items-center bg-white rounded-lg p-0.5 shadow-2xs border border-[#c0c9be]/50">
                <button
                  onClick={handleZoomIn}
                  className="w-7 h-7 flex items-center justify-center rounded text-[#131b2e] hover:bg-[#eaedff]"
                  title="Zoom In"
                >
                  <span className="material-symbols-outlined text-[18px]">zoom_in</span>
                </button>
                <button
                  onClick={handleZoomOut}
                  className="w-7 h-7 flex items-center justify-center rounded text-[#131b2e] hover:bg-[#eaedff]"
                  title="Zoom Out"
                >
                  <span className="material-symbols-outlined text-[18px]">zoom_out</span>
                </button>
                <button
                  onClick={handleRotate}
                  className="w-7 h-7 flex items-center justify-center rounded text-[#131b2e] hover:bg-[#eaedff]"
                  title="Rotate 90deg"
                >
                  <span className="material-symbols-outlined text-[18px]">rotate_right</span>
                </button>
                <button
                  onClick={handleFit}
                  className="w-7 h-7 flex items-center justify-center rounded text-[#131b2e] hover:bg-[#eaedff]"
                  title="Fit to Width"
                >
                  <span className="material-symbols-outlined text-[18px]">fit_screen</span>
                </button>
              </div>

              {/* Bounding Box Toggle */}
              <button
                onClick={() => setBoxesVisible(!boxesVisible)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold shadow-2xs transition-colors ${
                  boxesVisible ? 'bg-[#14532d] text-[#87c695]' : 'bg-[#f2f3ff] text-[#717970]'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${boxesVisible ? 'bg-[#95f8a7]' : 'bg-[#717970]'}`} />
                <span>Boxes: {boxesVisible ? 'ON' : 'OFF'}</span>
              </button>
            </div>
          </div>

          {/* Facsimile Canvas / Viewport */}
          <div className="relative w-full h-[740px] bg-[#d2d9f4]/30 overflow-auto p-4 flex justify-center items-start select-none">
            {/* Scaled Document Page (A4 Aspect Ratio Facsimile) */}
            <div
              style={{
                transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                transformOrigin: 'top center',
                transition: 'transform 0.2s ease-out',
              }}
              className="relative w-full max-w-[560px] min-h-[820px] bg-white shadow-lg p-6 flex flex-col justify-between border border-[#c0c9be]/60 rounded-md"
            >
              {/* Government Watermark Overlay */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-5">
                <span className="material-symbols-outlined text-[340px] text-[#003b1b]">policy</span>
              </div>

              {/* Authentic Official Document Header */}
              <div className="relative z-10 flex flex-col items-center pb-4 text-center border-b border-[#c0c9be]/30">
                <div className="flex items-center gap-3 mb-1">
                  <img
                    className="w-10 h-10 object-contain"
                    alt="Official State Revenue emblem of Maharashtra"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuDPX4tbh19N5twLk8yHK9SuIIGyg9yYDhAImBNyYOusWlwWSwOxVTgsTdkAHRdDSjfmh6HwSe1HcbUUQz90o57TOFme_wbrtsOA9-XKi1NpKcQSVidVozSENcn1-pq5Q3PL-KScqYDxCCB9b0XiYTAd43AolpEaPGgxHRzozI7pRu7ytalwVplAK7grP7C2f58T2Qn__MvK3wP1fobZJ2WYF6Qyou2onTRwY-Bm1oGFXVdteKzFMjpJ0g"
                  />
                  <div className="text-left">
                    <span className="text-xs font-bold text-[#131b2e] uppercase block tracking-wider">
                      महाराष्ट्र शासन • महसूल व वन विभाग
                    </span>
                    <span className="font-mono text-[#717970] text-[10px] block">
                      e-Mahabhulekh Land Records System • DILRMP Pune
                    </span>
                  </div>
                </div>

                <div className="mt-1 px-4 py-1 bg-[#eaedff] rounded-full border border-[#c0c9be]/40">
                  <span className="text-xs font-bold text-[#003b1b]">
                    गाव नमुना ७ / १२ ( अधिकार अभिलेख व पिकांची नोंदवही )
                  </span>
                </div>

                <div className="grid grid-cols-3 w-full mt-3 text-left text-[11px] text-[#404941] bg-[#f2f3ff] p-2 rounded-lg border border-[#c0c9be]/30">
                  <div>
                    <span className="font-bold text-[#131b2e]">गाव:</span> हिंजवडी (Hinjawadi)
                  </div>
                  <div>
                    <span className="font-bold text-[#131b2e]">तालुका:</span> मुळशी (Mulshi)
                  </div>
                  <div>
                    <span className="font-bold text-[#131b2e]">जिल्हा:</span> पुणे (Pune)
                  </div>
                </div>
              </div>

              {/* Document Facsimile Content & Annotated Bounding Boxes */}
              <div className="relative z-10 flex-1 flex flex-col gap-3 py-3 text-[#131b2e]">
                {/* Segment 1: Survey & Area */}
                <div className="grid grid-cols-2 gap-3 bg-white p-2.5 rounded-lg border border-[#c0c9be]/30 shadow-2xs">
                  {/* BBox: Survey Number */}
                  <div
                    className={`relative p-2 rounded border transition-all ${
                      boxesVisible ? 'bg-[#006d30]/5 border-[#006d30]/40' : 'border-transparent'
                    }`}
                  >
                    {boxesVisible && (
                      <div className="absolute -top-3 left-1 bg-[#006d30] text-white px-1.5 py-0.2 rounded text-[9px] font-mono shadow-xs flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[10px]">check_circle</span>
                        [Survey No: 99%]
                      </div>
                    )}
                    <div className="text-[10px] text-[#404941] font-semibold">भूमापन क्रमांक / उपविभाग</div>
                    <div className="text-sm font-bold text-[#131b2e] mt-0.5">सर्व्हे क्र. / गट क्र.: {surveyNum}</div>
                    <div className="font-mono text-[#717970] text-[10px]">{hissa}</div>
                  </div>

                  {/* BBox: Area */}
                  <div
                    className={`relative p-2 rounded border transition-all ${
                      boxesVisible ? 'bg-[#006d30]/5 border-[#006d30]/40' : 'border-transparent'
                    }`}
                  >
                    {boxesVisible && (
                      <div className="absolute -top-3 left-1 bg-[#006d30] text-white px-1.5 py-0.2 rounded text-[9px] font-mono shadow-xs flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[10px]">check_circle</span>
                        [Area: 95%]
                      </div>
                    )}
                    <div className="text-[10px] text-[#404941] font-semibold">एकूण क्षेत्र (हेक्टर / आर)</div>
                    <div className="text-sm font-bold text-[#131b2e] mt-0.5">{landArea}</div>
                    <div className="font-mono text-[#717970] text-[10px]">पोटखराबा आकार: ०.०५ आर</div>
                  </div>
                </div>

                {/* Segment 2: Occupant / Owner Info */}
                <div className="bg-white p-2.5 rounded-lg border border-[#c0c9be]/30 shadow-2xs space-y-2">
                  {/* BBox: Owner Name */}
                  <div
                    className={`relative p-2 rounded border transition-all ${
                      boxesVisible ? 'bg-[#006d30]/5 border-[#006d30]/40' : 'border-transparent'
                    }`}
                  >
                    {boxesVisible && (
                      <div className="absolute -top-3 left-1 bg-[#006d30] text-white px-1.5 py-0.2 rounded text-[9px] font-mono shadow-xs flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[10px]">check_circle</span>
                        [Owner Name: 98%]
                      </div>
                    )}
                    <div className="text-[10px] text-[#404941] font-semibold">भोगवटादाराचे नाव (खातेदार)</div>
                    <div className="text-xs font-bold text-[#003b1b] mt-0.5">
                      सुरेश विठ्ठलराव देशमुख <span className="font-normal text-[#131b2e]">({ownerName})</span>
                    </div>
                    <div className="font-mono text-[#717970] text-[10px]">
                      खाते क्रमांक: KH-881902 • फेरफार क्र.: 3912, 4412
                    </div>
                  </div>

                  {/* BBox: Joint Share (Amber) */}
                  <div
                    className={`relative p-2 rounded border transition-all ${
                      boxesVisible ? 'bg-amber-500/10 border-amber-500/60' : 'border-transparent'
                    }`}
                  >
                    {boxesVisible && (
                      <div className="absolute -top-3 left-1 bg-[#703a00] text-white px-1.5 py-0.2 rounded text-[9px] font-mono shadow-xs flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[10px]">warning</span>
                        [Share: 78%]
                      </div>
                    )}
                    <div className="text-[10px] text-[#703a00] font-bold">हिस्सा / अधिकार स्वरूप (Occupancy Right)</div>
                    <div className="text-xs font-bold text-[#131b2e] mt-0.5">{shareFraction}</div>
                    <div className="font-mono text-[#703a00] text-[10px]">
                      सह-हिस्सेदार: रमेश विठ्ठलराव देशमुख (Mutual Heir via Mutation 4412)
                    </div>
                  </div>
                </div>

                {/* Segment 3: Encumbrance / Charges (Amber with Pulsing Glow) */}
                <div className="bg-white p-2.5 rounded-lg border border-[#c0c9be]/30 shadow-2xs">
                  <div
                    className={`relative p-2 rounded border transition-all ${
                      boxesVisible ? 'bg-amber-500/15 border-amber-500 animate-pulse' : 'border-transparent'
                    }`}
                  >
                    {boxesVisible && (
                      <div className="absolute -top-3 left-1 bg-[#703a00] text-white px-1.5 py-0.2 rounded text-[9px] font-mono shadow-xs flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[10px]">shield_with_heart</span>
                        [Encumbrance: 74%]
                      </div>
                    )}
                    <div className="text-[10px] text-[#703a00] font-bold">इतर हक्क व बोजा (Liabilities & Other Rights)</div>
                    <div className="text-xs font-bold text-[#131b2e] mt-0.5">{encumbrances}</div>
                    <div className="font-mono text-[#703a00] text-[10px] leading-relaxed">
                      नोंद क्र. ४१२०/२०१९ • शाखा हिंजवडी • पीक कर्ज योजना • दि. १२/०३/२०१९ • तारण पत्र चालू
                    </div>
                  </div>
                </div>

                {/* Segment 4: Cultivation / Crops Footer note */}
                <div className="bg-[#f2f3ff] p-2 rounded-lg text-[10px] text-[#404941] flex items-center justify-between border border-[#c0c9be]/30">
                  <span>पिकाखालील क्षेत्र: खरीप हंगाम (सोयाबीन व भुईमूग)</span>
                  <span className="font-mono text-[#006d30] font-medium">Digitally Signed by Talathi Office</span>
                </div>
              </div>

              {/* Official Seal & Timestamp Footer */}
              <div className="relative z-10 pt-3 flex items-center justify-between text-[10px] text-[#717970] border-t border-[#c0c9be]/30">
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-[#92f5a4] flex items-center justify-center text-[#007233]">
                    <span className="material-symbols-outlined text-[12px]">lock</span>
                  </span>
                  <span className="font-mono">MD5: e7f8b91a0c4...9921</span>
                </div>
                <div className="font-mono">24-OCT-2024 11:28 IST</div>
              </div>
            </div>
          </div>
        </section>

        {/* RIGHT SIDE: Structured Field Verification & Manual Audit (50% desktop split) */}
        <section className="lg:col-span-6 flex flex-col bg-white rounded-xl shadow-xs border border-[#c0c9be]/60 overflow-hidden">
          {/* Audit Header */}
          <div className="bg-[#eaedff] px-4 py-2.5 flex items-center justify-between border-b border-[#c0c9be]/40">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#003b1b] text-[20px]">fact_check</span>
              <div className="flex flex-col">
                <h2 className="text-xs font-bold text-[#131b2e]">Structured Field Verification & Manual Audit</h2>
                <span className="text-[10px] text-[#404941]">
                  Review flagged fields before generating verifiable cryptographic hash
                </span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-[#dae2fd] text-[#131b2e] text-[10px] font-mono font-bold">
              6 Fields Extracted
            </span>
          </div>

          {/* Form Container */}
          <div className="p-5 flex flex-col gap-4 max-h-[740px] overflow-y-auto">
            {/* FIELD 1: Primary Owner Name */}
            <div className="flex flex-col gap-1 p-3 rounded-xl bg-white hover:bg-[#f2f3ff] transition-colors border border-[#c0c9be]/50 shadow-2xs">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-bold text-[#131b2e]" htmlFor="field-owner">
                  Primary Owner Name (खातेदाराचे नाव)
                </label>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#92f5a4] text-[#007233] text-[10px] font-bold">
                  <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    check_circle
                  </span>
                  98% High Confidence
                </span>
              </div>
              <div className="relative">
                <input
                  id="field-owner"
                  type="text"
                  value={showMarathiOwner ? 'सुरेश विठ्ठलराव देशमुख' : ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full h-10 px-3 pr-16 rounded-lg bg-[#faf8ff] text-xs font-medium text-[#131b2e] border border-[#c0c9be] focus:outline-none focus:ring-2 focus:ring-[#006d30]"
                />
                <button
                  type="button"
                  onClick={() => setShowMarathiOwner(!showMarathiOwner)}
                  className="absolute right-2 top-2 text-[#404941] hover:text-[#131b2e] px-1.5 py-0.5 rounded bg-[#eaedff] text-[10px] font-bold border border-[#c0c9be]/40"
                  title="Toggle Marathi / English"
                >
                  {showMarathiOwner ? 'English' : 'मराठी'}
                </button>
              </div>
              <span className="text-[10px] text-[#717970]">
                Transliterated from Devanagari "सुरेश विठ्ठलराव देशमुख" with matching Aadhaar roster.
              </span>
            </div>

            {/* FIELD 2: Survey / Gat Number */}
            <div className="flex flex-col gap-1 p-3 rounded-xl bg-white hover:bg-[#f2f3ff] transition-colors border border-[#c0c9be]/50 shadow-2xs">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-bold text-[#131b2e]" htmlFor="field-survey">
                  Survey / Gat Number (सर्व्हे / गट क्रमांक)
                </label>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#92f5a4] text-[#007233] text-[10px] font-bold">
                  <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    verified
                  </span>
                  99% Exact Match
                </span>
              </div>
              <div className="relative">
                <input
                  id="field-survey"
                  type="text"
                  value={surveyNum}
                  onChange={(e) => setSurveyNum(e.target.value)}
                  className="w-full h-10 px-3 pr-9 rounded-lg bg-[#faf8ff] text-xs font-bold text-[#131b2e] border border-[#c0c9be] focus:outline-none focus:ring-2 focus:ring-[#006d30]"
                />
                <span className="absolute right-2.5 top-2.5 material-symbols-outlined text-[#006d30] text-[18px]">
                  layers
                </span>
              </div>
              <span className="text-[10px] text-[#717970]">
                Cross-referenced against Mulshi Taluk Cadastral GIS Polygon #PUN-142-3A.
              </span>
            </div>

            {/* FIELD 3: Gat Sub-division / Hissa */}
            <div className="flex flex-col gap-1 p-3 rounded-xl bg-white hover:bg-[#f2f3ff] transition-colors border border-[#c0c9be]/50 shadow-2xs">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-bold text-[#131b2e]" htmlFor="field-hissa">
                  Gat Sub-division / Hissa (पोट हिस्सा)
                </label>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#92f5a4] text-[#007233] text-[10px] font-bold">
                  <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    check_circle
                  </span>
                  91% Verified
                </span>
              </div>
              <input
                id="field-hissa"
                type="text"
                value={hissa}
                onChange={(e) => setHissa(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-[#faf8ff] text-xs font-medium text-[#131b2e] border border-[#c0c9be] focus:outline-none focus:ring-2 focus:ring-[#006d30]"
              />
              <span className="text-[10px] text-[#717970]">
                Valid sub-division demarcation confirmed via e-Mojani record.
              </span>
            </div>

            {/* FIELD 4: Total Land Area */}
            <div className="flex flex-col gap-1 p-3 rounded-xl bg-white hover:bg-[#f2f3ff] transition-colors border border-[#c0c9be]/50 shadow-2xs">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-bold text-[#131b2e]" htmlFor="field-area">
                  Total Land Area (एकूण क्षेत्र - Hectare / Are)
                </label>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#92f5a4] text-[#007233] text-[10px] font-bold">
                  <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    check_circle
                  </span>
                  95% High Confidence
                </span>
              </div>
              <input
                id="field-area"
                type="text"
                value={landArea}
                onChange={(e) => setLandArea(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-[#faf8ff] text-xs font-medium text-[#131b2e] border border-[#c0c9be] focus:outline-none focus:ring-2 focus:ring-[#006d30]"
              />
              <span className="text-[10px] text-[#717970]">
                14,500 sq. metres total mapped footprint (Excluding 500 sq.m Pot Kharaba).
              </span>
            </div>

            {/* FIELD 5: Ownership Share Fractions (REVIEW FLAGGED) */}
            <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-[#ffdcc3]/35 border border-[#ffdcc3] shadow-xs">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-bold text-[#703a00] flex items-center gap-1" htmlFor="field-share">
                  <span className="material-symbols-outlined text-base text-[#703a00]">warning</span>
                  Ownership Share Fractions (धारण प्रकार व हिस्सा)
                </label>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#703a00] text-[#ffa14e] text-[10px] font-bold">
                  <span className="material-symbols-outlined text-[12px]">priority_high</span>
                  78% Review Required
                </span>
              </div>
              <input
                id="field-share"
                type="text"
                value={shareFraction}
                onChange={(e) => setShareFraction(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-white text-xs font-medium text-[#131b2e] border border-[#703a00]/40 focus:outline-none focus:ring-2 focus:ring-[#703a00]"
              />
              <div className="flex items-start gap-1.5 p-2 bg-white/80 rounded-lg border border-[#ffdcc3]">
                <span className="material-symbols-outlined text-sm text-[#703a00] shrink-0 mt-0.5">notification_important</span>
                <p className="text-[11px] text-[#131b2e] leading-snug">
                  ⚠️ <strong className="text-[#703a00]">Please confirm:</strong> Detected 2 joint heirs in mutation entry No. 4412. Verify co-parcener share before approving undivided parcel transfer.
                </p>
              </div>
            </div>

            {/* FIELD 6: Encumbrances / Bank Charges (REVIEW FLAGGED) */}
            <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-[#ffdcc3]/35 border border-[#ffdcc3] shadow-xs">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-bold text-[#703a00] flex items-center gap-1" htmlFor="field-encumbrance">
                  <span className="material-symbols-outlined text-base text-[#703a00]">lock_clock</span>
                  Encumbrances / Bank Charges (इतर हक्क व बोजा)
                </label>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#703a00] text-[#ffa14e] text-[10px] font-bold">
                  <span className="material-symbols-outlined text-[12px]">error</span>
                  74% Moderate Confidence
                </span>
              </div>
              <input
                id="field-encumbrance"
                type="text"
                value={encumbrances}
                onChange={(e) => setEncumbrances(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-white text-xs font-medium text-[#131b2e] border border-[#703a00]/40 focus:outline-none focus:ring-2 focus:ring-[#703a00]"
              />
              <div className="flex items-start gap-1.5 p-2 bg-white/80 rounded-lg border border-[#ffdcc3]">
                <span className="material-symbols-outlined text-sm text-[#703a00] shrink-0 mt-0.5">help</span>
                <p className="text-[11px] text-[#131b2e] leading-snug">
                  ⚠️ <strong className="text-[#703a00]">Please confirm:</strong> Bank NOC status not found on CERSAI portal. Please confirm if loan is active or obtain No-Dues Certificate.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Bottom Action Dock */}
      <footer className="w-full bg-white shadow-[0_-4px_12px_rgba(0,0,0,0.06)] py-3.5 px-4 sm:px-6 lg:px-8 rounded-xl border border-[#c0c9be]/50">
        <div className="max-w-[1280px] mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Left Audit Status Tag */}
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-[#006d30] animate-pulse" />
            <div className="flex flex-col">
              <span className="text-xs font-bold text-[#131b2e]">
                Audit Trail: Auto-logged to Pune District Revenue Node
              </span>
              <span className="font-mono text-[10px] text-[#717970]">
                Timestamped Block #882914-MH • SHA-256 Validated
              </span>
            </div>
          </div>

          {/* Right Action CTA Group */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <button
              type="button"
              onClick={handleReject}
              className="px-3.5 py-2 rounded-lg bg-[#f2f3ff] text-[#131b2e] hover:bg-[#eaedff] transition-colors text-xs font-semibold shadow-2xs border border-[#c0c9be]/60"
            >
              Reject & Request Re-upload
            </button>
            <button
              type="button"
              onClick={handleConfirmAndRun}
              disabled={isVerifying}
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[#14532d] text-[#87c695] hover:bg-[#003b1b] hover:text-white transition-all text-xs font-bold shadow-sm"
            >
              {isVerifying ? (
                <>
                  <span className="material-symbols-outlined text-base animate-spin">sync</span>
                  <span>Verifying Cadastral Coordinates...</span>
                </>
              ) : (
                <>
                  <span>Confirm and Run Verification Checks (तपासणी सुरू करा)</span>
                  <span className="material-symbols-outlined text-base">arrow_forward</span>
                </>
              )}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

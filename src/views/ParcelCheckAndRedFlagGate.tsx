import React, { useState } from 'react';
import { Parcel, ActiveTab } from '../types';

interface ParcelCheckAndRedFlagGateProps {
  parcel: Parcel;
  onNavigateTab: (tab: ActiveTab, parcelId?: string) => void;
  onUpdateParcel: (updated: Parcel) => void;
}

export const ParcelCheckAndRedFlagGate: React.FC<ParcelCheckAndRedFlagGateProps> = ({
  parcel,
  onNavigateTab,
  onUpdateParcel,
}) => {
  const [mapMode, setMapMode] = useState<'vector' | 'satellite' | 'hybrid'>('vector');
  const [overlay1965, setOverlay1965] = useState(false);
  const [inspectOverlap, setInspectOverlap] = useState(false);
  const [justification, setJustification] = useState(
    parcel.override?.justification || ''
  );
  const [isAttachingDSC, setIsAttachingDSC] = useState(false);
  const [dscToken, setDscToken] = useState<string | null>(
    parcel.override?.dscSignature || null
  );
  const [isEscalating, setIsEscalating] = useState(false);
  const [isSubmittingOverride, setIsSubmittingOverride] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const isBlocked = parcel.registrationStatus.includes('FROZEN') || parcel.status.includes('BLOCK');

  const handleAttachDSC = () => {
    setIsAttachingDSC(true);
    setTimeout(() => {
      setDscToken('SHA256: 9b2d4102c98a3e (C-DAC Class-3 eSign / USB Token Active)');
      setIsAttachingDSC(false);
      setActionMessage('✓ Class-3 DSC Token Cryptographically Paired!');
      setTimeout(() => setActionMessage(null), 3000);
    }, 800);
  };

  const handleEscalate = async () => {
    setIsEscalating(true);
    try {
      const res = await fetch(`/api/parcels/${parcel.id}/escalate`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setActionMessage(`✓ Case escalated to Tehsildar & District Registrar (Docket: ${data.caseNo})`);
        setTimeout(() => {
          onNavigateTab('revenue-officer-queue');
        }, 1500);
      }
    } catch (err) {
      console.error(err);
      setActionMessage('Escalation failed, please retry.');
    } finally {
      setIsEscalating(false);
    }
  };

  const handleSaveOverride = async () => {
    if (!justification.trim()) {
      alert('Please enter Court Order Case Number or District Collectorate Special Sanction Reference.');
      return;
    }

    setIsSubmittingOverride(true);
    try {
      const res = await fetch(`/api/parcels/${parcel.id}/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          justification,
          dscToken: dscToken || 'SHA256: 9b2d4102c98a3e (C-DAC Class-3 eSign)',
          officerName: 'Shri Rajeshwar Rao, IAS',
        }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        onUpdateParcel(data.data);
        setActionMessage('✓ Officer Override Sanctioned and Registered under Sec. 34 MLRC!');
        setTimeout(() => setActionMessage(null), 3500);
      }
    } catch (err) {
      console.error(err);
      setActionMessage('Override submission failed.');
    } finally {
      setIsSubmittingOverride(false);
    }
  };

  const handleDownloadNotice = () => {
    const noticeContent = `
GOVERNMENT OF MAHARASHTRA
REVENUE & FOREST DEPARTMENT / DEPARTMENT OF REGISTRATIONS
DISTRICT COLLECTORATE PUNE - TALUKA MULSHI
------------------------------------------------------------
NOTICE OF REGISTRATION FREEZE / DISPUTE CAVEAT
Transaction Session: #MH-2025-0982-REG
Date: 24 Oct 2024

PARCEL DETAILS:
Survey Number: ${parcel.surveyNo} / ${parcel.gatNo}
ULPIN (Bhudhar ID): ${parcel.ulpin}
Village: ${parcel.village}, Taluka: ${parcel.taluka}, Pune
Certified Extent: ${parcel.areaHa} Ha (${parcel.areaAcres} Acres)
Recorded Khatedar: ${parcel.primaryOwner}

TRIGGER REASONS FOR REGISTRY LOCK (Section 22A Registration Act, 1908):
1. [BLOCK] Court Injunction: Civil Court Senior Division Pune - Special Suit 842/2021.
2. [BLOCK] Irrigation Canal Buffer Strip: 30m Khadakwasla Canal eco-reservation.
3. [WARN] Unreleased Mortgage: Rs 15,00,000 Bank of Maharashtra.
4. [WARN] Cadastral Boundary Overlap: 0.02 Ha overlap with Survey 142/2.

STATUS: ${parcel.registrationStatus}
Digital Integrity Hash: SHA-256: 9b2df4e1a098c47b1982736128471
Signatory: Shri Rajeshwar Rao, IAS - Divisional Commissioner
------------------------------------------------------------
    `.trim();

    const blob = new Blob([noticeContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Rejection_Notice_${parcel.surveyNo.replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col w-full space-y-6">
      {/* Top Sovereign Inspection Header / Operational Status Bar */}
      <div className="w-full bg-[#f2f3ff] px-4 sm:px-6 py-3 rounded-xl shadow-xs border border-[#c0c9be]/50">
        <div className="max-w-[1280px] mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-[#131b2e] text-xs">
            <span className="px-2 py-0.5 rounded bg-[#dae2fd] text-[#003b1b] font-mono font-bold tracking-tight">
              CADASTRAL VERIFICATION PORTAL
            </span>
            <span className="text-[#717970]">|</span>
            <span className="text-[#404941] uppercase font-semibold">NIC-DILRMP Engine v4.2.8</span>
            <span className="text-[#717970]">|</span>
            <div className="flex items-center gap-1.5 text-[#006d30] font-semibold">
              <span className="w-2 h-2 rounded-full bg-[#006d30] animate-ping" />
              <span>Cadastral Ledger Synchronized (MH-REV-PUNE)</span>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start lg:self-auto text-xs">
            <span className="text-[#717970]">Transaction Session:</span>
            <span className="font-mono font-bold px-2 py-0.5 rounded bg-white text-[#003b1b] border border-[#c0c9be]/50">
              #MH-2025-0982-REG
            </span>
          </div>
        </div>
      </div>

      {actionMessage && (
        <div className="p-3 bg-[#92f5a4]/30 text-[#007233] rounded-xl border border-[#006d30]/30 text-xs font-semibold animate-in fade-in flex items-center justify-between">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="text-xs underline">Dismiss</button>
        </div>
      )}

      {/* Top Summary Bar: Parcel Identity & Legal Metadata */}
      <section className="w-full bg-white rounded-xl shadow-xs border border-[#c0c9be]/60 p-5">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl text-[#003b1b] font-bold tracking-tight">{parcel.surveyNo}</h1>
              <span className="text-lg text-[#404941] font-semibold">/ {parcel.gatNo}</span>
              <span
                className={`px-3 py-0.5 rounded-full text-xs uppercase font-bold tracking-wide ${
                  isBlocked ? 'bg-[#ffdad6] text-[#ba1a1a]' : 'bg-[#92f5a4] text-[#007233]'
                }`}
              >
                {parcel.registrationStatus}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[#717970] text-xs flex-wrap">
              <span className="font-semibold text-[#131b2e]">Village:</span> {parcel.village}
              <span>•</span>
              <span className="font-semibold text-[#131b2e]">Taluka:</span> {parcel.taluka}
              <span>•</span>
              <span className="font-semibold text-[#131b2e]">District:</span> {parcel.district}, {parcel.state}
            </div>
          </div>

          {/* ULPIN / Bhudhar Identification Badge */}
          <div className="bg-[#f2f3ff] px-4 py-2.5 rounded-lg border border-[#c0c9be]/50 flex flex-col items-start lg:items-end">
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px] text-[#003b1b]">tag</span>
              <span className="text-[10px] uppercase text-[#717970] font-semibold">ULPIN (Bhudhar ID)</span>
            </div>
            <span className="font-mono text-base text-[#003b1b] font-bold tracking-wider">{parcel.ulpin}</span>
          </div>
        </div>

        {/* Quick Metrics Ribbon */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 bg-[#f2f3ff]/50 p-4 rounded-lg border border-[#c0c9be]/30">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-[#717970] uppercase font-semibold">Certified Extent</span>
            <span className="text-sm text-[#131b2e] font-bold">
              {parcel.areaHa} Ha <span className="text-xs text-[#717970] font-normal">({parcel.areaAcres} Acres)</span>
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-[#717970] uppercase font-semibold">Cadastral Classification</span>
            <span className="text-sm text-[#131b2e] font-bold">{parcel.classification}</span>
          </div>
          <div className="flex flex-col gap-0.5 md:col-span-2">
            <span className="text-[10px] text-[#717970] uppercase font-semibold">
              Recorded Primary Khatedar / Titleholder
            </span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-[#131b2e] font-bold truncate">{parcel.primaryOwner}</span>
              <span className="px-2 py-0.5 rounded bg-[#ffdcc3] text-[#2f1500] text-[10px] font-semibold whitespace-nowrap">
                {parcel.jointShareInfo}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Middle Grid (GIS Map Viewer & 8-Gate AI Checklist) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (GIS Map & Boundary Inspection Viewer - 6 cols) */}
        <section className="lg:col-span-6 flex flex-col gap-4">
          <div className="bg-white rounded-xl shadow-xs border border-[#c0c9be]/60 p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#003b1b] text-[22px]">map</span>
                <h2 className="text-sm font-bold text-[#131b2e]">Cadastral GIS Boundary Inspector</h2>
              </div>
              <span className="px-2 py-0.5 rounded bg-[#eaedff] text-[#131b2e] font-mono text-[11px] font-medium">
                EPSG:32643 (UTM 43N)
              </span>
            </div>

            {/* Interactive Geospatial Canvas Area */}
            <div className="relative w-full h-[480px] rounded-lg overflow-hidden bg-[#eaedff] shadow-inner flex flex-col justify-between p-4 border border-[#c0c9be]/40">
              {/* Satellite Backdrop */}
              {(mapMode === 'satellite' || mapMode === 'hybrid') && (
                <div
                  className="absolute inset-0 w-full h-full bg-cover bg-center"
                  style={{
                    backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuCJRtWNQhjHmRiAd-FWQ9zF8jB6SJmpSJ4W7JeJEbE_RLt4ZFthaSvmmhAzkIb9kNgqMqXqv2rCvxGJuxYyMfTbK54PTE8UDI7FMs6hpUfJZU6C11oF1DfDyNBs2sbKUwwOpa3GPKdPRPVI0SKX67gFYHMZDkBCangky8fnJXYmrjvmgMjip3wNx-QFS5JgCH-aS3akRKe5mLr4PWaVnVdZrlWsyc_KILSVUlj0dby4VqMopjGAP9ZeLA')`,
                  }}
                />
              )}

              {/* Tint for contrast */}
              <div
                className={`absolute inset-0 transition-opacity ${
                  mapMode === 'vector'
                    ? 'bg-[#131b2e]/85'
                    : 'bg-[#131b2e]/55 backdrop-blur-[0.5px]'
                }`}
              />

              {/* Vector Geometry Overlay SVG */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none" viewBox="0 0 540 440">
                <defs>
                  {/* Striped Hazard Fill for Canal Buffer */}
                  <pattern id="canalHazardPattern" patternUnits="userSpaceOnUse" width="12" height="12" patternTransform="rotate(45 0 0)">
                    <line x1="0" y1="0" x2="0" y2="12" stroke="#BA1A1A" strokeWidth="4" strokeOpacity="0.8" />
                    <line x1="0" y1="0" x2="0" y2="12" stroke="#FFA14E" strokeWidth="2" strokeOpacity="0.4" />
                  </pattern>

                  {/* Striped DGPS Overlap marker */}
                  <pattern id="dgpsOverlapPattern" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(135 0 0)">
                    <line x1="0" y1="0" x2="0" y2="8" stroke="#FFA14E" strokeWidth="3" strokeOpacity="0.9" />
                  </pattern>

                  {/* 1965 Cadastral Grid Pattern */}
                  <pattern id="grid1965Pattern" patternUnits="userSpaceOnUse" width="20" height="20">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#60A5FA" strokeWidth="0.8" strokeOpacity="0.5" />
                  </pattern>
                </defs>

                {overlay1965 && (
                  <rect width="540" height="440" fill="url(#grid1965Pattern)" />
                )}

                {/* Adjacent Parcel 142/1 (North) */}
                <polygon points="40,20 280,25 250,110 50,100" fill="#EAEDFF" fillOpacity="0.15" stroke="#FFFFFF" strokeWidth="1.5" strokeDasharray="3,3" />
                <text x="130" y="65" fill="#FFFFFF" fontSize="12" fontWeight="600" opacity="0.85">Survey 142/1 (0.90 Ha)</text>

                {/* Adjacent Parcel 141 (West) */}
                <polygon points="20,115 150,125 130,340 10,320" fill="#EAEDFF" fillOpacity="0.15" stroke="#FFFFFF" strokeWidth="1.5" strokeDasharray="3,3" />
                <text x="50" y="225" fill="#FFFFFF" fontSize="12" fontWeight="600" opacity="0.85">Survey 141</text>

                {/* Adjacent Parcel 143 (South) */}
                <polygon points="125,355 410,345 390,425 105,420" fill="#EAEDFF" fillOpacity="0.15" stroke="#FFFFFF" strokeWidth="1.5" strokeDasharray="3,3" />
                <text x="240" y="390" fill="#FFFFFF" fontSize="12" fontWeight="600" opacity="0.85">Survey 143</text>

                {/* Adjacent Parcel 142/2 (East) */}
                <polygon points="395,115 520,110 500,335 385,340" fill="#EAEDFF" fillOpacity="0.15" stroke="#FFFFFF" strokeWidth="1.5" strokeDasharray="3,3" />
                <text x="430" y="220" fill="#FFFFFF" fontSize="12" fontWeight="600" opacity="0.85">Survey 142/2</text>

                {/* Target Parcel Boundary: Survey 142/3A */}
                <polygon points="160,118 395,115 385,340 135,345" fill="#006D30" fillOpacity="0.28" stroke="#92F5A4" strokeWidth="3" />

                {/* Restriction Layer: Canal Buffer Strip */}
                <polygon points="335,116 395,115 385,340 325,341" fill="url(#canalHazardPattern)" stroke="#BA1A1A" strokeWidth="2" />

                {/* 0.02 Ha Overlap Zone with 142/2 */}
                <polygon
                  points="380,200 405,200 400,280 375,280"
                  fill="url(#dgpsOverlapPattern)"
                  stroke="#FFA14E"
                  strokeWidth={inspectOverlap ? "3" : "1.5"}
                />

                {/* Cart Track / Right of Way */}
                <path d="M 110,300 C 135,320 160,335 190,360" fill="none" stroke="#60A5FA" strokeWidth="2.5" strokeDasharray="5,4" />

                {/* Area Vertex Pins */}
                <circle cx="160" cy="118" r="4.5" fill="#FFFFFF" stroke="#003B1B" strokeWidth="2" />
                <circle cx="395" cy="115" r="4.5" fill="#BA1A1A" stroke="#FFFFFF" strokeWidth="2" />
                <circle cx="385" cy="340" r="4.5" fill="#FFA14E" stroke="#FFFFFF" strokeWidth="2" />
                <circle cx="135" cy="345" r="4.5" fill="#FFFFFF" stroke="#003B1B" strokeWidth="2" />
                <circle cx="335" cy="116" r="3.5" fill="#BA1A1A" />
                <circle cx="325" cy="341" r="3.5" fill="#BA1A1A" />

                {/* Parcel Label Pill */}
                <rect x="180" y="195" width="130" height="42" rx="6" fill="#003B1B" fillOpacity="0.9" />
                <text x="245" y="213" fill="#B1F2BE" fontSize="12" fontWeight="700" textAnchor="middle">
                  SURVEY 142/3A
                </text>
                <text x="245" y="228" fill="#FFFFFF" fontSize="10" fontWeight="500" textAnchor="middle">
                  Net: {parcel.areaHa} Hectares
                </text>

                {/* Warning Callout: Canal Buffer 30m */}
                <rect x="330" y="145" width="105" height="34" rx="4" fill="#BA1A1A" fillOpacity="0.95" />
                <text x="382" y="159" fill="#FFFFFF" fontSize="9" fontWeight="700" textAnchor="middle">
                  CANAL BUFFER
                </text>
                <text x="382" y="171" fill="#FFDAD6" fontSize="8" textAnchor="middle">
                  30m Reservation
                </text>
              </svg>

              {/* Top Layer: Map Control Strip */}
              <div className="relative z-10 flex items-center justify-between gap-2">
                <div className="flex items-center bg-white/90 backdrop-blur rounded-lg p-0.5 shadow-xs border border-[#c0c9be]/50">
                  <button
                    type="button"
                    onClick={() => setMapMode('vector')}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                      mapMode === 'vector' ? 'bg-[#003b1b] text-white shadow-xs' : 'text-[#404941] hover:text-[#131b2e]'
                    }`}
                  >
                    Cadastral Vector
                  </button>
                  <button
                    type="button"
                    onClick={() => setMapMode('satellite')}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                      mapMode === 'satellite' ? 'bg-[#003b1b] text-white shadow-xs' : 'text-[#404941] hover:text-[#131b2e]'
                    }`}
                  >
                    Satellite Aerial
                  </button>
                  <button
                    type="button"
                    onClick={() => setMapMode('hybrid')}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                      mapMode === 'hybrid' ? 'bg-[#003b1b] text-white shadow-xs' : 'text-[#404941] hover:text-[#131b2e]'
                    }`}
                  >
                    Hybrid
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => alert('Measurement Tool: Direct distance along North-East boundary is 214.2 meters.')}
                    className="w-8 h-8 rounded-lg bg-white/90 backdrop-blur text-[#131b2e] flex items-center justify-center hover:bg-white shadow-xs border border-[#c0c9be]/40"
                    title="Measurement Tool"
                  >
                    <span className="material-symbols-outlined text-[18px]">straighten</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOverlay1965(!overlay1965)}
                    className="w-8 h-8 rounded-lg bg-white/90 backdrop-blur text-[#131b2e] flex items-center justify-center hover:bg-white shadow-xs border border-[#c0c9be]/40"
                    title="Toggle Cadastral Layer Shift"
                  >
                    <span className="material-symbols-outlined text-[18px]">layers</span>
                  </button>
                </div>
              </div>

              {/* Bottom Layer: Tool Chips */}
              <div className="relative z-10 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOverlay1965(!overlay1965)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold shadow-xs flex items-center gap-1 transition-all ${
                    overlay1965
                      ? 'bg-[#14532d] text-[#87c695] border border-[#006d30]'
                      : 'bg-white/95 text-[#131b2e] hover:bg-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px] text-[#003b1b]">history_edu</span>
                  Overlay 1965 Cadastral Map
                </button>
                <button
                  type="button"
                  onClick={() => setInspectOverlap(!inspectOverlap)}
                  className="px-2.5 py-1 rounded-md bg-[#ba1a1a] text-white text-xs font-semibold shadow-xs flex items-center gap-1 hover:bg-[#ba1a1a]/90 transition-all"
                >
                  <span className="material-symbols-outlined text-[14px]">crisis_alert</span>
                  Disputed Overlap Inspector (0.02 Ha)
                </button>
              </div>
            </div>

            {/* Cadastral Map Legend */}
            <div className="bg-[#f2f3ff] rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 border border-[#c0c9be]/40 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-[#92f5a4]" />
                <span className="font-medium text-[#131b2e]">Cadastral Boundary (Claim)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-[#ba1a1a]" />
                <span className="font-medium text-[#131b2e]">30m Canal/Eco Buffer</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-[#ffb77d]" />
                <span className="font-medium text-[#131b2e]">DGPS Overlap (Warning)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-0.5 border-b-2 border-dashed border-sky-400 inline-block" />
                <span className="font-medium text-[#131b2e]">Right of Way (Cart Track)</span>
              </div>
            </div>
          </div>

          {/* Field Surveyor & Geo-Coord Audit Card */}
          <div className="bg-white rounded-xl shadow-xs border border-[#c0c9be]/60 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#14532d] text-[#87c695] flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-[20px]">verified</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-[#131b2e]">DGPS Survey Drone Dataset</span>
                <span className="text-[11px] text-[#717970]">{parcel.tilrAuthority}</span>
              </div>
            </div>
            <span className="font-mono text-xs text-[#003b1b] font-bold">{parcel.dgpsSurveyDate}</span>
          </div>
        </section>

        {/* Right Column (8-Gate AI Registry Verification Checklist - 6 cols) */}
        <section className="lg:col-span-6 flex flex-col gap-4">
          <div className="bg-white rounded-xl shadow-xs border border-[#c0c9be]/60 p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#c0c9be]/30">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#003b1b] text-[22px]">policy</span>
                <h2 className="text-sm font-bold text-[#131b2e]">8-Gate AI Registry Verification</h2>
              </div>
              <span className="px-2 py-0.5 rounded bg-[#eaedff] text-[#404941] text-[11px] font-semibold">
                Tri-State Evaluator
              </span>
            </div>

            {/* Structured Checklist Items */}
            <div className="flex flex-col gap-2.5">
              {parcel.gates.map((gate) => {
                const isPass = gate.status === 'PASS';
                const isWarn = gate.status === 'WARN';
                const isBlock = gate.status === 'BLOCK';

                const bgClass = isPass
                  ? 'bg-[#f2f3ff]'
                  : isWarn
                  ? 'bg-[#ffdcc3]/30 border border-amber-300'
                  : 'bg-[#ffdad6]/40 border border-[#ba1a1a]/30';

                const badgeBg = isPass
                  ? 'bg-[#92f5a4] text-[#007233]'
                  : isWarn
                  ? 'bg-[#ffdcc3] text-[#2f1500]'
                  : 'bg-[#ba1a1a] text-white';

                const icon = isPass ? 'verified_user' : isWarn ? 'warning' : 'gavel';
                const iconColor = isPass ? 'text-[#006d30]' : isWarn ? 'text-[#703a00]' : 'text-[#ba1a1a]';

                return (
                  <div
                    key={gate.id}
                    className={`p-3.5 rounded-lg ${bgClass} flex items-start justify-between gap-3 transition-all`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className={`material-symbols-outlined ${iconColor} text-[20px] mt-0.5 shrink-0`}>
                        {icon}
                      </span>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-bold text-[#131b2e]">{gate.name}</span>
                        <p className="text-[11px] text-[#404941] leading-relaxed">{gate.desc}</p>
                      </div>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 ${badgeBg}`}>
                      {gate.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      {/* Bottom Section: Prominent Red-Flag Status Banner & Officer Override Gate */}
      <section className="w-full rounded-xl bg-[#ffdad6] p-5 shadow-xs border border-[#ba1a1a]/30 flex flex-col gap-5">
        {/* Critical Lock Banner Header */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#ba1a1a] text-white flex items-center justify-center shrink-0 shadow-sm">
              <span className="material-symbols-outlined text-[30px]">shield_lock</span>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base text-[#93000a] font-bold tracking-tight">
                  REGISTRATION BLOCKED: Officer Override Required
                </h3>
                <span className="text-xs text-[#ba1a1a] font-semibold">(नोंदणी अवरोधित)</span>
              </div>
              <p className="text-xs text-[#93000a] font-medium max-w-3xl leading-relaxed">
                Automated verification detected <strong>2 BLOCK triggers</strong> (Active Court Injunction and Irrigation Canal Buffer overlap) and <strong>2 WARN triggers</strong>. Automated registry lock applied under Sec. 22A Registration Act, 1908.
              </p>
            </div>
          </div>

          <div className="flex flex-col items-start lg:items-end gap-1 bg-white/80 px-3 py-1.5 rounded-lg shrink-0 border border-[#ba1a1a]/20">
            <span className="text-[10px] text-[#717970] uppercase font-semibold">Lock Integrity Hash</span>
            <span className="font-mono text-xs font-bold text-[#131b2e]">SHA256: 9b2d...f4e1</span>
          </div>
        </div>

        {/* Officer Override Authorization Panel */}
        <div className="bg-white rounded-xl p-5 flex flex-col gap-4 shadow-2xs border border-[#c0c9be]/50">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-[#131b2e] flex items-center gap-1.5" htmlFor="override-justification">
              <span className="material-symbols-outlined text-[#003b1b] text-[18px]">verified</span>
              Officer Override Justification & Legal Order Reference Number (if proceeding)
            </label>
            <span className="text-[11px] text-[#717970]">
              Under Section 34 of Maharashtra Land Revenue Code, an override requires explicit reference to court vacation order, gazette de-notification, or administrative discharge certificate.
            </span>
          </div>

          <div className="flex flex-col gap-3">
            <textarea
              id="override-justification"
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Enter Court Order Case Number, Date of Injunction Vacation, or District Collectorate Special Sanction Reference (e.g., CC/PUN/2024/DISCHARGE/4102)..."
              rows={3}
              className="w-full p-3 rounded-lg bg-[#f2f3ff] text-[#131b2e] placeholder:text-[#717970] text-xs focus:bg-white border border-[#c0c9be] transition-colors resize-none focus:outline-none focus:ring-2 focus:ring-[#003b1b]"
            />

            {dscToken && (
              <div className="p-2.5 bg-[#92f5a4]/30 rounded-lg border border-[#006d30]/30 flex items-center gap-2 text-xs font-semibold text-[#007233]">
                <span className="material-symbols-outlined text-sm">verified</span>
                <span>Cryptographic Token Attached: {dscToken}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
              {/* Digital DSC Signature Key Button */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAttachDSC}
                  disabled={isAttachingDSC}
                  className="px-3.5 py-2 rounded-lg bg-[#eaedff] text-[#131b2e] hover:bg-[#d2d9f4] text-xs font-semibold flex items-center gap-1.5 transition-colors border border-[#c0c9be]/40"
                >
                  <span className="material-symbols-outlined text-[#003b1b] text-[18px]">usb</span>
                  <span>{isAttachingDSC ? 'Reading Token...' : 'Attach e-Sign / USB DSC Token'}</span>
                </button>
                <span className="text-[11px] text-[#717970] hidden sm:inline">
                  IAS / Sub-Registrar Class-3 Certificate
                </span>
              </div>

              {/* Action Command Buttons */}
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleDownloadNotice}
                  className="px-3.5 py-2 rounded-lg bg-white text-[#131b2e] hover:bg-[#f2f3ff] text-xs font-bold flex items-center gap-1.5 shadow-2xs border border-[#c0c9be]/60 transition-colors"
                >
                  <span className="material-symbols-outlined text-[#ba1a1a] text-[18px]">picture_as_pdf</span>
                  <span>Download Complete Rejection Notice (PDF)</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveOverride}
                  disabled={isSubmittingOverride}
                  className="px-3.5 py-2 rounded-lg bg-[#003b1b] text-white hover:bg-[#14532d] text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                  <span>{isSubmittingOverride ? 'Saving...' : 'Authorize Override'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleEscalate}
                  disabled={isEscalating}
                  className="px-3.5 py-2 rounded-lg bg-[#ba1a1a] text-white hover:opacity-95 text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all"
                >
                  <span className="material-symbols-outlined text-[18px]">send</span>
                  <span>{isEscalating ? 'Escalating...' : 'Escalate to Tehsildar & District Registrar'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

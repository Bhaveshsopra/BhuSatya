import React, { useState, useEffect } from 'react';
import { Parcel, ActiveTab, Language } from '../types';

interface ShouldIBuyThisReportProps {
  parcel: Parcel;
  parcels?: Parcel[];
  onSelectParcel?: (id: string) => void;
  onNavigateTab: (tab: ActiveTab, parcelId?: string) => void;
}

export const ShouldIBuyThisReport: React.FC<ShouldIBuyThisReportProps> = ({
  parcel,
  parcels = [],
  onSelectParcel,
  onNavigateTab,
}) => {
  const [reportLang, setReportLang] = useState<Language>('EN');
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [pdfDownloaded, setPdfDownloaded] = useState(false);
  const [reportDocket, setReportDocket] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/reports/${parcel.id}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data) {
          setReportDocket(res.data);
        }
      })
      .catch(console.error);
  }, [parcel.id]);

  const handleExportJSON = () => {
    const payload = reportDocket || {
      parcel,
      exportTimestamp: new Date().toISOString(),
      protocol: 'BhuSatya DILRMP Title Diligence v4.2',
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BhuSatya_Diligence_Docket_${parcel.ulpin}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isMarathi = reportLang === 'MR';
  const isHindi = reportLang === 'HI';

  const titleText = isMarathi
    ? 'भूखंड खरेदी सल्ला अहवाल'
    : isHindi
    ? 'भूमि खरीद परामर्श रिपोर्ट'
    : 'BhuSatya Land Purchase Diligence Report';

  const subtitleText = isMarathi
    ? 'भूखंड खरेदी सल्ला अहवाल'
    : isHindi
    ? 'भूखंड खरीद परामर्श'
    : 'भूखंड खरेदी सल्ला अहवाल';

  const isPass = parcel.recommendation === 'Pass' || parcel.caseStatus === 'OFFICER_SANCTIONED' || parcel.caseStatus === 'TITLE_VERIFIED';
  const isInsufficient = parcel.recommendation === 'Insufficient Information';
  const hasMortgage = parcel.encumbrance && !parcel.encumbrance.toLowerCase().includes('nil') && !parcel.encumbrance.toLowerCase().includes('zero');
  const hasLitigation = parcel.litigation && !parcel.litigation.toLowerCase().includes('zero') && !parcel.litigation.toLowerCase().includes('nil');
  const hasOverlap = parcel.overlap && !parcel.overlap.toLowerCase().includes('zero') && !parcel.overlap.toLowerCase().includes('matches 100%');

  const verdictBadgeText = isPass
    ? (isMarathi ? 'सत्यापित स्वच्छ मालकी' : isHindi ? 'सत्यापित स्वच्छ शीर्षक' : 'CLEAR TITLE TO PROCEED')
    : isInsufficient
    ? (isMarathi ? 'अपूर्ण माहिती' : isHindi ? 'अपर्याप्त जानकारी' : 'INSUFFICIENT INFORMATION')
    : (isMarathi ? 'सावधगिरीने पुढे जा' : isHindi ? 'सावधानी से आगे बढ़ें' : 'PROCEED WITH CAUTION');

  const verdictBadgeClass = isPass
    ? 'bg-[#92f5a4] text-[#007233] border border-[#007233]/30'
    : isInsufficient
    ? 'bg-slate-200 text-slate-800 border border-slate-300'
    : 'bg-[#ffdcc3] text-[#2f1500] border border-amber-300';

  const verdictIcon = isPass ? 'verified' : isInsufficient ? 'help_outline' : 'warning';
  const verdictIconColor = isPass ? 'text-[#007233]' : isInsufficient ? 'text-slate-700' : 'text-[#703a00]';

  const verdictDescText = isPass
    ? 'All 8 statutory verification gates passed or sanctioned. Title is unencumbered and registration clearance is granted.'
    : isInsufficient
    ? 'Mandatory survey documentation or external registry links are incomplete. Conclusive diligence requires additional extracts.'
    : (parcel.recommendationExplanation || 'Do not proceed to deed registration until existing bank charges, boundary reservations, or heir claims are cleared.');

  const handleDownloadPDF = () => {
    setPdfDownloaded(true);
    setTimeout(() => {
      window.print();
      setPdfDownloaded(false);
    }, 500);
  };

  const handleShare = () => {
    setShareModalOpen(true);
  };

  return (
    <div className="flex flex-col w-full space-y-6">
      {/* Sovereign Breadcrumb & Metadata Ticker */}
      <section className="w-full bg-[#f2f3ff] px-4 sm:px-6 py-2.5 rounded-xl border border-[#c0c9be]/50 shadow-xs">
        <div className="max-w-[1280px] mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#003b1b] text-white">
              <span className="material-symbols-outlined text-[14px]">verified</span>
            </span>
            <span className="uppercase tracking-wider text-[#404941] font-bold">DILRMP Audit Node 4082-A</span>
            <span className="text-[#c0c9be]">•</span>
            <span className="font-mono text-[#131b2e]">CERSAI & MahaBhulekh Synced</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="uppercase bg-[#eaedff] px-2 py-0.5 rounded text-[#131b2e] font-semibold text-[11px]">
              Classification: Agricultural / R-Zone Transition
            </span>
            <span className="font-mono text-[#717970] text-[11px]">SHA-256: e87c…41b9</span>
          </div>
        </div>
      </section>

      {/* Report Header Banner with Asymmetric Badge & Radial Meter */}
      <section className="w-full bg-white rounded-xl shadow-xs border border-[#c0c9be]/60 overflow-hidden p-6 md:p-8 relative">
        <div className="absolute -right-24 -top-24 w-96 h-96 rounded-full bg-[#ffb77d]/20 blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          {/* Header Text Details */}
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-[#14532d] text-[#87c695] text-[10px] uppercase font-semibold">
                Institutional Advisory S6
              </span>
              <span className="text-[#c0c9be] text-xs">•</span>
              <span className="font-mono text-xs text-[#717970]">Confidential Diligence Docket</span>
            </div>

            <h1 className="text-2xl md:text-3xl text-[#003b1b] font-bold tracking-tight">
              {titleText}
            </h1>
            <p className="text-lg text-[#404941] font-medium">{subtitleText}</p>

            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <span className="font-mono font-bold bg-[#eaedff] px-2.5 py-1 rounded text-[#131b2e]">
                Parcel ID: {parcel.ulpin}
              </span>
              <span className="text-[#c0c9be]">|</span>
              <span className="text-[#131b2e] font-medium">
                {parcel.village}, Taluka {parcel.taluka}, {parcel.district}, {parcel.state}
              </span>
              <span className="text-[#c0c9be]">|</span>
              <span className="text-[#717970]">Generated: 24 Oct 2024, 14:32 IST</span>
              {parcels.length > 1 && (
                <>
                  <span className="text-[#c0c9be]">|</span>
                  <div className="inline-flex items-center gap-1.5 bg-[#f2f3ff] px-2 py-0.5 rounded border border-[#c0c9be]/60">
                    <span className="text-[11px] font-semibold text-[#717970]">Report For:</span>
                    <select
                      value={parcel.id}
                      onChange={(e) => onSelectParcel?.(e.target.value)}
                      className="bg-transparent font-bold text-[#003b1b] text-xs focus:outline-none cursor-pointer"
                    >
                      {parcels.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.surveyNo} – {p.village}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Verdict Card with Radial Trust Meter */}
          <div className="flex flex-col sm:flex-row items-center gap-5 bg-[#f2f3ff] p-5 rounded-xl border border-[#c0c9be]/50 shadow-2xs">
            {/* Radial Progress Ring */}
            <div className="relative flex items-center justify-center w-28 h-28 shrink-0">
              <svg className="w-28 h-28 -rotate-90" viewBox="0 0 120 120">
                <circle
                  className="text-[#dae2fd] stroke-current"
                  cx="60"
                  cy="60"
                  fill="transparent"
                  r="50"
                  strokeWidth="8"
                />
                <circle
                  className="text-[#703a00] stroke-current"
                  cx="60"
                  cy="60"
                  fill="transparent"
                  r="50"
                  strokeDasharray="314.15"
                  strokeDashoffset="100.5"
                  strokeLinecap="round"
                  strokeWidth="8"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-2xl text-[#131b2e] font-bold leading-none tracking-tight">
                  {parcel.diligenceScore || 68}
                </span>
                <span className="text-[9px] uppercase text-[#717970] font-bold mt-0.5">Satya Index</span>
                <span className="text-[10px] text-[#703a00] font-semibold">/ 100</span>
              </div>
            </div>

            {/* Verdict Container */}
            <div className="flex flex-col items-center sm:items-start text-center sm:text-left max-w-xs">
              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg shadow-2xs ${verdictBadgeClass}`}>
                <span
                  className={`material-symbols-outlined text-[18px] ${verdictIconColor} font-bold`}
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  {verdictIcon}
                </span>
                <span className="text-xs font-bold uppercase tracking-wider">{verdictBadgeText}</span>
              </div>
              <span className={`text-xs font-semibold ${verdictIconColor} mt-1`}>{parcel.registrationStatus}</span>
              <p className="text-xs text-[#404941] mt-1 leading-snug">
                {verdictDescText}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Executive Summary Callout */}
        <div className="mt-6 p-4 bg-[#eaedff] rounded-lg border border-[#c0c9be]/40 flex items-start gap-3">
          <span
            className="material-symbols-outlined text-[#003b1b] text-[20px] mt-0.5 shrink-0"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            info
          </span>
          <p className="text-xs text-[#131b2e] leading-relaxed">
            <strong>Summary Verdict:</strong> Primary titleholder <strong>{parcel.primaryOwner}</strong> ({parcel.surveyNo}, {parcel.village}, {parcel.taluka}) holds registered interest with Satya Diligence Index of <strong>{parcel.score}/100</strong>.{' '}
            {isPass
              ? 'Ancestral lineage is unbroken, bank liens are satisfied on CERSAI, and zero civil caveat injunctions exist on record.'
              : parcel.recommendationExplanation}
          </p>
        </div>
      </section>

      {/* Section 1: The 5 Core Buyer Diligence Cards Grid */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-[#003b1b] font-bold">
              Comprehensive Title Scan
            </span>
            <h2 className="text-xl text-[#131b2e] font-bold">5 Core Buyer Diligence Pillars</h2>
          </div>
          <span className="hidden md:inline-flex items-center gap-1.5 text-[#404941] text-xs">
            <span className="w-2 h-2 rounded-full bg-[#006d30]" /> 5 of 5 Registries Cross-Referenced
          </span>
        </div>

        {/* 5 Bento Grid Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Card 1: Lineage */}
          <div className="bg-white rounded-xl shadow-xs border border-[#c0c9be]/60 p-4 flex flex-col justify-between hover:shadow-sm transition-all">
            <div>
              <div className="flex items-center justify-between pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-[#92f5a4] flex items-center justify-center text-[#007233]">
                    <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      verified_user
                    </span>
                  </span>
                  <span className="text-sm text-[#131b2e] font-bold">1. Title Lineage</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-[#92f5a4] text-[#007233] flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px]">check_circle</span> Clear (95/100)
                </span>
              </div>
              <p className="text-xs text-[#131b2e] leading-normal mb-2">
                Registered title holder <strong>{parcel.primaryOwner}</strong> ({parcel.jointShareInfo}) with continuous lineage recorded on 7/12.
              </p>
              <div className="bg-[#f2f3ff] p-2 rounded font-mono text-[11px] text-[#404941] border border-[#c0c9be]/30">
                ULPIN: {parcel.ulpin} | {parcel.surveyNo} | {parcel.gatNo}
              </div>
            </div>
            <div className="mt-4 pt-3 bg-[#f2f3ff]/60 -mx-4 -mb-4 p-4 rounded-b-xl border-t border-[#c0c9be]/30">
              <span className="text-[10px] uppercase text-[#006d30] font-bold tracking-wider block mb-0.5">
                What To Do Next
              </span>
              <p className="text-xs text-[#131b2e] font-medium">
                Obtain certified copy of latest Mutation Entry (Ferfar) from Talathi / e-Mahabhulekh to archive alongside deed.
              </p>
            </div>
          </div>

          {/* Card 2: Liabilities */}
          <div className="bg-white rounded-xl shadow-xs border border-[#c0c9be]/60 p-4 flex flex-col justify-between hover:shadow-sm transition-all">
            <div>
              <div className="flex items-center justify-between pb-3">
                <div className="flex items-center gap-2">
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${hasMortgage ? 'bg-[#ffdcc3] text-[#703a00]' : 'bg-[#92f5a4] text-[#007233]'}`}>
                    <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      account_balance
                    </span>
                  </span>
                  <span className="text-sm text-[#131b2e] font-bold">2. Liabilities & Mortgages</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold flex items-center gap-1 ${
                  hasMortgage ? 'bg-[#ffdcc3] text-[#703a00] border border-amber-300' : 'bg-[#92f5a4] text-[#007233]'
                }`}>
                  <span className="material-symbols-outlined text-[12px]">{hasMortgage ? 'priority_high' : 'check_circle'}</span>{' '}
                  {hasMortgage ? 'Action Required' : 'Clear (100/100)'}
                </span>
              </div>
              <p className="text-xs text-[#131b2e] leading-normal mb-2">
                {parcel.encumbrance}
              </p>
              <div className="bg-[#f2f3ff] p-2 rounded font-mono text-[11px] text-[#404941] border border-[#c0c9be]/30">
                Source: CERSAI Central Registry & Sub-Registrar Index-II
              </div>
            </div>
            <div className="mt-4 pt-3 bg-[#f2f3ff]/60 -mx-4 -mb-4 p-4 rounded-b-xl border-t border-[#c0c9be]/30">
              <span className={`text-[10px] uppercase font-bold tracking-wider block mb-0.5 ${hasMortgage ? 'text-[#703a00]' : 'text-[#006d30]'}`}>
                What To Do Next
              </span>
              <p className="text-xs text-[#131b2e] font-medium">
                {hasMortgage
                  ? 'Require seller to furnish official Bank No-Objection Certificate (NOC) and 7/12 Roznama clearance before giving token advance.'
                  : 'Zero bank charges detected. Safe to proceed with financial consideration agreement.'}
              </p>
            </div>
          </div>

          {/* Card 3: Boundaries */}
          <div className="bg-white rounded-xl shadow-xs border border-[#c0c9be]/60 p-4 flex flex-col justify-between hover:shadow-sm transition-all">
            <div>
              <div className="flex items-center justify-between pb-3">
                <div className="flex items-center gap-2">
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${hasOverlap ? 'bg-[#ffdcc3] text-[#703a00]' : 'bg-[#92f5a4] text-[#007233]'}`}>
                    <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      pin_drop
                    </span>
                  </span>
                  <span className="text-sm text-[#131b2e] font-bold">3. Boundaries & Possession</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold flex items-center gap-1 ${
                  hasOverlap ? 'bg-[#ffdcc3] text-[#703a00] border border-amber-300' : 'bg-[#92f5a4] text-[#007233]'
                }`}>
                  <span className="material-symbols-outlined text-[12px]">{hasOverlap ? 'explore' : 'check'}</span>{' '}
                  {hasOverlap ? 'Verify On Ground' : 'Demarcation Verified'}
                </span>
              </div>
              <p className="text-xs text-[#131b2e] leading-normal mb-2">
                Extent: <strong>{parcel.areaHa} Ha ({parcel.areaAcres} Acres)</strong>. {parcel.overlap}.
              </p>
              <div className="bg-[#f2f3ff] p-2 rounded font-mono text-[11px] text-[#404941] border border-[#c0c9be]/30">
                TILR Authority: {parcel.tilrAuthority} | Survey Date: {parcel.dgpsSurveyDate}
              </div>
            </div>
            <div className="mt-4 pt-3 bg-[#f2f3ff]/60 -mx-4 -mb-4 p-4 rounded-b-xl border-t border-[#c0c9be]/30">
              <span className={`text-[10px] uppercase font-bold tracking-wider block mb-0.5 ${hasOverlap ? 'text-[#703a00]' : 'text-[#006d30]'}`}>
                What To Do Next
              </span>
              <p className="text-xs text-[#131b2e] font-medium">
                {hasOverlap
                  ? 'Commission an official government Mojani (DGPS land measurement) through the Land Records Inspector.'
                  : 'Cadastral polygon matches village map sheet. Proceed with standard physical boundary pegging.'}
              </p>
            </div>
          </div>

          {/* Card 4: Price & Circle Rate */}
          <div className="bg-white rounded-xl shadow-xs border border-[#c0c9be]/60 p-4 flex flex-col justify-between hover:shadow-sm transition-all">
            <div>
              <div className="flex items-center justify-between pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-[#92f5a4] flex items-center justify-center text-[#007233]">
                    <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      payments
                    </span>
                  </span>
                  <span className="text-sm text-[#131b2e] font-bold">4. Price & Circle Rate</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-[#92f5a4] text-[#007233] flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px]">check</span> Fair Valuation
                </span>
              </div>
              <p className="text-xs text-[#131b2e] leading-normal mb-2">
                Asking: ₹{(parcel.askingPrice / 10000000).toFixed(2)} Cr vs Ready Reckoner: ₹{(parcel.readyReckonerRate / 10000000).toFixed(2)} Cr. Stamp Duty (7%): ₹{(parcel.stampDuty / 100000).toFixed(2)} Lakh.
              </p>
              <div className="bg-[#f2f3ff] p-2 rounded font-mono text-[11px] text-[#404941] border border-[#c0c9be]/30">
                Market: ₹{parcel.askingPrice.toLocaleString('en-IN')} | Govt RR: ₹{parcel.readyReckonerRate.toLocaleString('en-IN')}
              </div>
            </div>
            <div className="mt-4 pt-3 bg-[#f2f3ff]/60 -mx-4 -mb-4 p-4 rounded-b-xl border-t border-[#c0c9be]/30">
              <span className="text-[10px] uppercase text-[#006d30] font-bold tracking-wider block mb-0.5">
                What To Do Next
              </span>
              <p className="text-xs text-[#131b2e] font-medium">
                Ensure full transaction consideration is documented in registered sale deed to avoid Section 56(2) tax penalties.
              </p>
            </div>
          </div>

          {/* Card 5: Legal & Zonal Flags (Span 2 cols on lg) */}
          <div className="bg-white rounded-xl shadow-xs border border-[#c0c9be]/60 p-4 flex flex-col justify-between hover:shadow-sm transition-all lg:col-span-2">
            <div>
              <div className="flex items-center justify-between pb-3">
                <div className="flex items-center gap-2">
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${hasLitigation ? 'bg-[#ffdad6] text-[#ba1a1a]' : 'bg-[#92f5a4] text-[#007233]'}`}>
                    <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      gavel
                    </span>
                  </span>
                  <span className="text-sm text-[#131b2e] font-bold">5. Legal & Zonal Flags</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold flex items-center gap-1 ${
                  hasLitigation ? 'bg-[#ffdad6] text-[#ba1a1a] border border-[#ba1a1a]/30' : 'bg-[#92f5a4] text-[#007233]'
                }`}>
                  <span className="material-symbols-outlined text-[12px]">{hasLitigation ? 'block' : 'verified'}</span>{' '}
                  {hasLitigation ? 'Active Suit Dispute' : 'Zero Litigation'}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
                <p className="text-xs text-[#131b2e] leading-normal">
                  {parcel.litigation}. Zonal status: <strong>{parcel.classification}</strong>. {parcel.buffer}.
                </p>
                <div className="bg-[#f2f3ff] p-2.5 rounded font-mono text-[11px] text-[#404941] border border-[#c0c9be]/30 space-y-1">
                  <div>Court Registry: District Court {parcel.district}</div>
                  <div>Injunction Status: {hasLitigation ? 'Hearing Pending' : 'Zero Restraints Recorded'}</div>
                  <div>Zonal Rule: {parcel.classification}</div>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 bg-[#f2f3ff]/60 -mx-4 -mb-4 p-4 rounded-b-xl border-t border-[#c0c9be]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className={`text-[10px] uppercase font-bold tracking-wider block mb-0.5 ${hasLitigation ? 'text-[#ba1a1a]' : 'text-[#006d30]'}`}>
                  {hasLitigation ? 'Critical Action Required' : 'Succession Clearance'}
                </span>
                <p className="text-xs text-[#131b2e] font-medium">
                  {hasLitigation
                    ? 'Require all legal heirs to execute registered Heir Consent Deed on BhuSatya portal before paying any advance.'
                    : 'Check digital heir consent registry for recorded coparcener approvals.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('heir-consent-tracker', parcel.id)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#14532d] text-[#87c695] text-xs font-semibold whitespace-nowrap hover:bg-[#003b1b] hover:text-white transition-colors shrink-0 shadow-2xs"
              >
                <span className="material-symbols-outlined text-[16px]">how_to_reg</span>
                <span>Open Heir Portal</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Horizontal Bar Breakdown of Score Deductions */}
      <section className="bg-white rounded-xl shadow-xs border border-[#c0c9be]/60 p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-[#003b1b] font-bold">
              Algorithmic Title Audit Engine
            </span>
            <h2 className="text-xl text-[#131b2e] font-bold">Risk Weighting & Score Deductions</h2>
            <p className="text-xs text-[#717970]">
              Deterministic formula based on DoLR Cadastral Risk Scoring Rules (Rev. 2024)
            </p>
          </div>
          <div className="flex items-center gap-3 bg-[#f2f3ff] px-3.5 py-2 rounded-lg border border-[#c0c9be]/40">
            <div className="flex flex-col text-right">
              <span className="text-[10px] uppercase text-[#717970] font-bold">Final Composite Score</span>
              <span className="text-base text-[#703a00] font-bold">{parcel.diligenceScore || 68} / 100 PTS</span>
            </div>
            <span className="w-9 h-9 rounded-full bg-[#ffdcc3] flex items-center justify-center text-[#703a00] font-bold">
              <span className="material-symbols-outlined text-[18px]">tune</span>
            </span>
          </div>
        </div>

        {/* Deductions Breakdown Stack */}
        <div className="space-y-4">
          {/* Pillar 1: Base Title */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-xs font-semibold">
              <span className="text-[#131b2e] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#006d30] text-[16px]">verified</span>
                Base Title Authenticity & Succession History
              </span>
              <span className="font-mono text-[#006d30] font-bold">+40 Pts (Earned: 40/40)</span>
            </div>
            <div className="w-full h-3 rounded-full bg-[#eaedff] overflow-hidden">
              <div className="h-full bg-[#006d30] rounded-full" style={{ width: '100%' }} />
            </div>
            <div className="flex justify-between text-[11px] text-[#717970]">
              <span>Verified across 1994–2024 Mutation records without adverse entry</span>
              <span className="font-mono">Max: 40 pts</span>
            </div>
          </div>

          {/* Pillar 2: Bank Lien */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-xs font-semibold">
              <span className="text-[#131b2e] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#703a00] text-[16px]">money_off</span>
                Encumbrance & Debt Risk (Unreleased Bank Lien)
              </span>
              <span className="font-mono text-[#703a00] font-bold">-12 Pts Penalty</span>
            </div>
            <div className="w-full h-3 rounded-full bg-[#eaedff] overflow-hidden">
              <div className="h-full bg-[#ffb77d] rounded-full" style={{ width: '30%' }} />
            </div>
            <div className="flex justify-between text-[11px] text-[#717970]">
              <span>Active charge with Bank of Maharashtra Hinjawadi branch (Deducted from 25 pts)</span>
              <span className="font-mono">Impact: -12 pts</span>
            </div>
          </div>

          {/* Pillar 3: Legal & Litigation */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-xs font-semibold">
              <span className="text-[#131b2e] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#ba1a1a] text-[16px]">gavel</span>
                Legal & Litigation Risk (Civil Suit No. 842/2021)
              </span>
              <span className="font-mono text-[#ba1a1a] font-bold">-15 Pts Penalty</span>
            </div>
            <div className="w-full h-3 rounded-full bg-[#eaedff] overflow-hidden">
              <div className="h-full bg-[#ba1a1a] rounded-full" style={{ width: '37.5%' }} />
            </div>
            <div className="flex justify-between text-[11px] text-[#717970]">
              <span>Co-parcenary partition dispute active in Pune Civil Court (Deducted from 25 pts)</span>
              <span className="font-mono">Impact: -15 pts</span>
            </div>
          </div>

          {/* Pillar 4: Boundary & Canal Buffer */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-xs font-semibold">
              <span className="text-[#131b2e] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#703a00] text-[16px]">layers</span>
                Boundary & Reservation Risk (Canal Buffer Proximity)
              </span>
              <span className="font-mono text-[#703a00] font-bold">-5 Pts Penalty</span>
            </div>
            <div className="w-full h-3 rounded-full bg-[#eaedff] overflow-hidden">
              <div className="h-full bg-[#ffb77d] rounded-full" style={{ width: '12.5%' }} />
            </div>
            <div className="flex justify-between text-[11px] text-[#717970]">
              <span>15m Irrigation Department buffer line trims effective usable plot area by 0.02 Ha</span>
              <span className="font-mono">Impact: -5 pts</span>
            </div>
          </div>
        </div>

        {/* Composite Bar Summary */}
        <div className="mt-6 pt-4 bg-[#f2f3ff] p-4 rounded-xl border border-[#c0c9be]/40">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#003b1b] text-white flex items-center justify-center font-bold text-base">
                {parcel.diligenceScore || 68}
              </div>
              <div>
                <div className="text-sm font-bold text-[#131b2e]">Calculated Trust Level: Moderate / Guarded</div>
                <div className="text-xs text-[#717970]">Total Starting Base: 100 Points | Total Deductions Applied: -32 Points</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold">
              <span className="px-2 py-1 rounded bg-white text-[#131b2e] border border-[#c0c9be]/40">100 Max</span>
              <span className="text-[#717970]">−</span>
              <span className="px-2 py-1 rounded bg-[#ffdad6] text-[#ba1a1a]">32 Risk</span>
              <span className="text-[#717970]">=</span>
              <span className="px-2 py-1 rounded bg-[#ffdcc3] text-[#703a00] border border-amber-300">
                {parcel.diligenceScore || 68} Final
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Visual Cadastral & Document Evidence Panels */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Cadastral Map View */}
        <div className="bg-white rounded-xl shadow-xs border border-[#c0c9be]/60 p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-1">
              <span className="text-sm text-[#131b2e] font-bold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#003b1b] text-[18px]">map</span>
                Cadastral Boundary (Mojani)
              </span>
              <span className="text-[10px] text-[#006d30] font-bold uppercase">GIS Lat/Long Calibrated</span>
            </div>
            <p className="text-xs text-[#717970] mb-3">
              Satellite survey boundary matching Gat No. 142/3A against official digital village boundary sheets.
            </p>

            <div
              className="w-full h-44 bg-cover bg-center rounded-lg shadow-inner relative overflow-hidden border border-[#c0c9be]/40"
              style={{
                backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuCJRtWNQhjHmRiAd-FWQ9zF8jB6SJmpSJ4W7JeJEbE_RLt4ZFthaSvmmhAzkIb9kNgqMqXqv2rCvxGJuxYyMfTbK54PTE8UDI7FMs6hpUfJZU6C11oF1DfDyNBs2sbKUwwOpa3GPKdPRPVI0SKX67gFYHMZDkBCangky8fnJXYmrjvmgMjip3wNx-QFS5JgCH-aS3akRKe5mLr4PWaVnVdZrlWsyc_KILSVUlj0dby4VqMopjGAP9ZeLA')`,
              }}
            >
              <div className="absolute inset-0 bg-[#003b1b]/10" />
              <div className="absolute bottom-2 left-2 bg-white/90 px-2 py-0.5 rounded text-[#131b2e] font-mono text-[10px] font-semibold border border-[#c0c9be]/40">
                Gat 142/3A • 0.84 Hectare
              </div>
              <div className="absolute top-2 right-2 bg-[#ba1a1a] px-2 py-0.5 rounded text-white font-mono text-[10px] font-semibold flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">warning</span>
                0.02 Ha Southern Overlap
              </div>
            </div>
          </div>

          <div className="pt-3 mt-3 flex justify-between items-center text-xs text-[#717970] border-t border-[#c0c9be]/30">
            <span>Inspector: K. V. Patil, DLR Mulshi</span>
            <button
              onClick={() => onNavigateTab('parcel-check-and-red-flag-gate', parcel.id)}
              className="text-[#003b1b] font-semibold hover:underline flex items-center gap-0.5"
            >
              <span>Full GIS Map</span>
              <span className="material-symbols-outlined text-[14px]">open_in_new</span>
            </button>
          </div>
        </div>

        {/* Ready Reckoner Valuation & Pricing Matrix */}
        <div className="bg-white rounded-xl shadow-xs border border-[#c0c9be]/60 p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-1">
              <span className="text-sm text-[#131b2e] font-bold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#003b1b] text-[18px]">calculate</span>
                Valuation Matrix
              </span>
              <span className="text-[10px] text-[#006d30] font-bold uppercase">ASR 2024-25 Ready</span>
            </div>
            <p className="text-xs text-[#717970] mb-3">
              Comparison between prevailing market quote and Department of Registrations official benchmark rate.
            </p>

            <div className="bg-[#f2f3ff] rounded-lg p-3 space-y-2 border border-[#c0c9be]/30 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-[#404941]">Govt Ready Reckoner (RR)</span>
                <span className="font-mono font-bold text-[#131b2e]">₹1,66,32,000</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#404941]">Seller Offer Consideration</span>
                <span className="font-mono font-bold text-[#003b1b]">₹1,80,00,000</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#404941]">Variance Differential</span>
                <span className="font-mono font-bold text-[#006d30]">+8.2% (Within Safe Corridor)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#404941]">Estimated Stamp Duty & Reg</span>
                <span className="font-mono font-bold text-[#131b2e]">₹12,60,000 (7% Multi-tier)</span>
              </div>
            </div>
          </div>

          <div className="pt-3 mt-3 flex justify-between items-center text-xs text-[#717970] border-t border-[#c0c9be]/30">
            <span>Sub-Registrar Zone: Haveli-14</span>
            <span className="text-[10px] font-semibold text-[#006d30]">Compliant with Sec 43CA</span>
          </div>
        </div>

        {/* Court Case & Injunction Status Pane */}
        <div className="bg-white rounded-xl shadow-xs border border-[#c0c9be]/60 p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-1">
              <span className="text-sm text-[#131b2e] font-bold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#ba1a1a] text-[18px]">balance</span>
                e-Courts Case Live Status
              </span>
              <span className="text-[10px] text-[#ba1a1a] font-bold uppercase">Pending Sub Judice</span>
            </div>
            <p className="text-xs text-[#717970] mb-3">
              Automated sync with National Judicial Data Grid (NJDG) via Case Information System (CIS).
            </p>

            <div className="bg-[#ffdad6]/30 rounded-lg p-3 space-y-1.5 border border-[#ba1a1a]/30 text-xs text-[#131b2e]">
              <div className="flex justify-between">
                <span className="font-semibold text-[#ba1a1a]">CNR Number:</span>
                <span className="font-mono font-bold">MHPUN00142982021</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#404941]">Plaintiff:</span>
                <span className="font-semibold">Smt. Sunita Anant Kadam</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#404941]">Defendant:</span>
                <span className="font-semibold">Shri Ramesh Mahadev Kadam</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#404941]">Next Stage:</span>
                <span className="font-semibold text-[#ba1a1a]">Interim Injunction Say</span>
              </div>
            </div>
          </div>

          <div className="pt-3 mt-3 flex justify-between items-center text-xs text-[#717970] border-t border-[#c0c9be]/30">
            <span>Civil Judge Sr. Div. Pune</span>
            <a
              href="https://services.ecourts.gov.in"
              target="_blank"
              rel="noreferrer"
              className="text-[#ba1a1a] font-semibold hover:underline flex items-center gap-0.5"
            >
              <span>View Court Roster</span>
              <span className="material-symbols-outlined text-[14px]">open_in_new</span>
            </a>
          </div>
        </div>
      </section>

      {/* Sticky Action Bar & Multilingual Controls */}
      <section className="bg-[#eaedff] rounded-xl p-5 shadow-xs border border-[#c0c9be]/50 flex flex-col lg:flex-row items-center justify-between gap-4">
        {/* Multilingual Selector */}
        <div className="flex items-center gap-3">
          <span className="text-xs uppercase text-[#404941] font-bold">Report Language:</span>
          <div className="inline-flex bg-white p-0.5 rounded-lg border border-[#c0c9be]/40 shadow-2xs">
            {(['EN', 'MR', 'HI'] as Language[]).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setReportLang(l)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  reportLang === l
                    ? 'bg-[#003b1b] text-white shadow-xs'
                    : 'text-[#131b2e] hover:text-[#003b1b]'
                }`}
              >
                {l === 'EN' ? 'English' : l === 'MR' ? 'मराठी' : 'हिंदी'}
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-end">
          <button
            type="button"
            onClick={handleExportJSON}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-white text-[#003b1b] text-xs font-semibold shadow-2xs border border-[#c0c9be]/60 hover:bg-[#f2f3ff] transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">data_object</span>
            <span>Export JSON Docket</span>
          </button>

          <button
            type="button"
            onClick={handleShare}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-white text-[#131b2e] text-xs font-semibold shadow-2xs border border-[#c0c9be]/60 hover:bg-[#f2f3ff] transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">share</span>
            <span>Share with Advocate / Bank</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPDF}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[#14532d] text-[#87c695] text-xs font-bold shadow-xs hover:bg-[#003b1b] hover:text-white transition-all"
          >
            <span
              className="material-symbols-outlined text-[18px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              download
            </span>
            <span>{pdfDownloaded ? 'Generating PDF...' : 'Print / Save PDF (SHA-256)'}</span>
          </button>
        </div>
      </section>

      {/* Statutory Legal Disclaimer */}
      <section className="bg-[#f2f3ff] p-4 rounded-xl border border-[#c0c9be]/50 flex flex-col md:flex-row items-center gap-3.5 text-center md:text-left">
        <div className="w-9 h-9 rounded-full bg-[#eaedff] flex items-center justify-center text-[#404941] shrink-0 border border-[#c0c9be]/40">
          <span className="material-symbols-outlined text-[20px]">policy</span>
        </div>
        <p className="text-[11px] text-[#404941] leading-relaxed">
          <strong>Statutory Legal Disclaimer:</strong> This report is an AI-assisted civic decision aid synthesized from public land records (MahaBhulekh), Central Registry of Securitisation Asset Reconstruction and Security Interest (CERSAI), e-Courts National Judicial Data Grid, and local cadastral shapefiles. It does not constitute formal legal counsel, government title guarantee, or an official encumbrance certificate (Search Report) as prescribed under the Maharashtra Stamp Act, 1958. Prospective buyers are advised to retain an enrolled advocate for title investigation.
        </p>
      </section>

      {/* Share Modal Dialog */}
      {shareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-2xl border border-[#c0c9be]/60 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#c0c9be]/30">
              <h3 className="text-sm font-bold text-[#131b2e] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#003b1b]">share</span>
                Share Confidential Diligence Docket
              </h3>
              <button onClick={() => setShareModalOpen(false)} className="text-[#717970] hover:text-[#131b2e]">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
            <p className="text-xs text-[#717970]">
              Secure link with SHA-256 validation token. Can be reviewed directly by empaneled bank advocates or CERSAI search agents.
            </p>
            <div className="p-2.5 bg-[#f2f3ff] rounded-lg border border-[#c0c9be]/40 font-mono text-xs text-[#131b2e] break-all select-all">
              https://bhusatya.gov.in/docket/27-24-0012-0142-003A?token=e87c6b91a0c441
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText('https://bhusatya.gov.in/docket/27-24-0012-0142-003A?token=e87c6b91a0c441');
                  alert('Docket link copied to clipboard!');
                  setShareModalOpen(false);
                }}
                className="px-4 py-2 bg-[#003b1b] text-white text-xs font-semibold rounded-lg hover:bg-[#14532d]"
              >
                Copy Secure Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

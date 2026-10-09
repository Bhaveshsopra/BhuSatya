import React, { useState, useRef } from 'react';
import { Parcel, AlertItem, ActiveTab } from '../types';

interface CitizenDashboardProps {
  parcels: Parcel[];
  alerts: AlertItem[];
  onNavigateTab: (tab: ActiveTab, parcelId?: string) => void;
  onOpenCheckModal: () => void;
  onUploadSuccess: (newParcel: Parcel) => void;
}

export const CitizenDashboard: React.FC<CitizenDashboardProps> = ({
  parcels,
  alerts,
  onNavigateTab,
  onOpenCheckModal,
  onUploadSuccess,
}) => {
  const [filter, setFilter] = useState<'all' | 'verified' | 'pending' | 'attention'>('all');
  const [selectedState, setSelectedState] = useState('mh');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter parcels
  const filteredParcels = parcels.filter((parcel) => {
    if (filter === 'all') return true;
    if (filter === 'verified') return parcel.status.includes('PASS') || parcel.score >= 85;
    if (filter === 'pending') return parcel.status.includes('WARN') || (parcel.score >= 50 && parcel.score < 85);
    if (filter === 'attention') return parcel.status.includes('BLOCK') || parcel.score < 50;
    return true;
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadMessage('Scanning document via OCR-VGG & Indic-BERT v4...');

    try {
      const response = await fetch('/api/parcels/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stateAuthority: selectedState,
          fileName: file.name,
          source: 'Uploaded Scanned 7/12',
          surveyNo: `Survey No. ${Math.floor(Math.random() * 150 + 50)}/${Math.floor(Math.random() * 4 + 1)}`,
          village: 'Mouje Hinjawadi',
          taluka: 'Mulshi',
          ownerName: 'Ananya Sharma',
          areaHa: 1.15,
        }),
      });

      const res = await response.json();
      if (res.success) {
        setUploadMessage('✓ Title parameters verified! Added to registered portfolio.');
        onUploadSuccess(res.data);
        setTimeout(() => {
          setUploadMessage(null);
          onNavigateTab('extract-and-review');
        }, 1200);
      }
    } catch (err) {
      console.error(err);
      setUploadMessage('Upload failed, please retry.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDigiLockerFetch = async () => {
    setIsUploading(true);
    setUploadMessage('Connecting to DigiLocker Aadhaar e-Vault (28 States)...');

    try {
      const response = await fetch('/api/parcels/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stateAuthority: selectedState,
          fileName: 'DigiLocker_Direct_Sync_712.pdf',
          source: 'DigiLocker Direct Verified Pull',
          surveyNo: 'Survey No. 204/1',
          village: 'Baner',
          taluka: 'Haveli',
          ownerName: 'Ananya Sharma',
          areaHa: 1.62,
        }),
      });

      const res = await response.json();
      if (res.success) {
        setUploadMessage('✓ Successfully pulled from DigiLocker! Title verified.');
        onUploadSuccess(res.data);
        setTimeout(() => {
          setUploadMessage(null);
          onNavigateTab('extract-and-review');
        }, 1200);
      }
    } catch (err) {
      console.error(err);
      setUploadMessage('DigiLocker pull failed.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".pdf,.png,.jpg,.jpeg,.tiff"
        className="hidden"
      />

      {/* Hero Welcome Banner */}
      <section className="bg-white border border-[#c0c9be]/50 rounded-xl p-5 shadow-xs transition-shadow hover:shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl text-[#131b2e] font-bold tracking-tight">
                Welcome back, Ananya Sharma
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#92f5a4] text-[#007233] border border-[#006d30]/20">
                <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>
                  fingerprint
                </span>
                Aadhaar Verified (•••• 8821)
              </span>
            </div>
            <p className="text-sm text-[#717970]">
              Real-time land title diligence, automated mutation tracking, and e-Court registry synchronization.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={onOpenCheckModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#003b1b] text-white rounded-lg text-sm font-semibold hover:bg-[#14532d] shadow-xs hover:shadow transition-all group"
            >
              <span className="material-symbols-outlined text-base group-hover:rotate-12 transition-transform">
                search
              </span>
              <span>Check a Parcel (नया भूखंड जांचें)</span>
            </button>
          </div>
        </div>
      </section>

      {/* Two-Column Primary Layout (40% Upload & Guidance / 60% Registered Parcels) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: 40% (lg:col-span-5) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Upload 7/12 or RoR Record Card */}
          <div className="bg-white rounded-xl border border-[#c0c9be]/60 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#eaedff] flex items-center justify-center text-[#003b1b]">
                  <span className="material-symbols-outlined text-xl">upload_file</span>
                </div>
                <h2 className="text-base font-bold text-[#131b2e]">Upload 7/12 or RoR Record</h2>
              </div>
              <span className="text-[11px] text-[#717970] uppercase font-semibold">Step 1 of 2</span>
            </div>

            {/* State Authority Selector Dropdown */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#404941] uppercase tracking-wider" htmlFor="state-authority">
                Select State Land Authority / Record System
              </label>
              <div className="relative">
                <select
                  id="state-authority"
                  value={selectedState}
                  onChange={(e) => setSelectedState(e.target.value)}
                  className="w-full bg-[#f2f3ff] text-[#131b2e] border border-[#c0c9be] rounded-lg py-2.5 px-3.5 pr-9 text-sm font-medium appearance-none focus:outline-none focus:ring-2 focus:ring-[#003b1b]/20 focus:border-[#003b1b] cursor-pointer"
                >
                  <option value="mh">Maharashtra – Mahabhulekh (7/12 Satbara & 8A)</option>
                  <option value="ka">Karnataka – Bhoomi RTC Engine (RTC / Pahani)</option>
                  <option value="up">Uttar Pradesh – Bhulekh Khatauni (UP RoR)</option>
                  <option value="ts">Telangana – Dharani Integrated Portal</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[#717970]">
                  <span className="material-symbols-outlined text-base">expand_more</span>
                </div>
              </div>
            </div>

            {/* Drag and Drop Dropzone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[#c0c9be] hover:border-[#003b1b]/60 transition-colors rounded-xl p-6 bg-[#f2f3ff]/40 flex flex-col items-center justify-center text-center group cursor-pointer"
            >
              <div className="w-12 h-12 rounded-full bg-white shadow-xs flex items-center justify-center text-[#006d30] group-hover:scale-105 transition-transform mb-3">
                <span className="material-symbols-outlined text-2xl">cloud_upload</span>
              </div>
              <p className="text-sm font-bold text-[#131b2e] mb-1">
                Drop PDF, Scanned TIFF, or JPG here
              </p>
              <p className="text-xs text-[#717970] mb-4">
                Maximum file size 25MB • OCR & Watermark detection enabled
              </p>

              {uploadMessage ? (
                <div className="text-xs font-bold text-[#006d30] bg-[#92f5a4]/30 px-3 py-1.5 rounded-lg border border-[#006d30]/20 animate-pulse">
                  {uploadMessage}
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full justify-center">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    disabled={isUploading}
                    className="w-full sm:w-auto px-4 py-2 bg-[#003b1b] text-white rounded-lg text-xs font-semibold hover:bg-[#14532d] shadow-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm">folder_open</span>
                    {isUploading ? 'Scanning...' : 'Choose File from Device'}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDigiLockerFetch();
                    }}
                    disabled={isUploading}
                    className="w-full sm:w-auto px-3.5 py-2 bg-white border border-[#c0c9be]/80 text-[#131b2e] hover:bg-[#eaedff] rounded-lg text-xs font-semibold shadow-2xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm text-[#006d30]">cloud_download</span>
                    Fetch from DigiLocker
                  </button>
                </div>
              )}
            </div>

            {/* Supported Document Pills */}
            <div className="space-y-2 pt-1">
              <span className="text-xs font-medium text-[#717970] block">Directly supported standard schemas:</span>
              <div className="flex flex-wrap gap-1.5">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-[#f2f3ff] border border-[#c0c9be]/60 text-[#404941]">
                  <span className="material-symbols-outlined text-xs text-[#006d30]">check_circle</span>
                  7/12 Satbara
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-[#f2f3ff] border border-[#c0c9be]/60 text-[#404941]">
                  <span className="material-symbols-outlined text-xs text-[#006d30]">check_circle</span>
                  UP Khatauni
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-[#f2f3ff] border border-[#c0c9be]/60 text-[#404941]">
                  <span className="material-symbols-outlined text-xs text-[#006d30]">check_circle</span>
                  Patta Passbook
                </span>
                <button
                  onClick={handleDigiLockerFetch}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-[#eaedff]/60 border border-[#c0c9be]/60 text-[#003b1b] font-semibold hover:bg-[#eaedff] transition-colors"
                >
                  <span className="material-symbols-outlined text-xs">sync</span>
                  DigiLocker Direct Pull
                </button>
              </div>
            </div>
          </div>

          {/* AI Guidance Box */}
          <div className="bg-[#f2f3ff] border border-[#c0c9be]/60 rounded-xl p-4 flex items-start gap-3.5 shadow-2xs">
            <div className="w-9 h-9 rounded-lg bg-[#b1f2be] text-[#00210d] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-xl">auto_awesome</span>
            </div>
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-[#131b2e] uppercase tracking-wider">Cognitive Diligence Engine</h3>
              <p className="text-xs text-[#404941] leading-relaxed">
                AI checks extract <strong className="text-[#131b2e] font-semibold">42 legal parameters</strong> including mutation entries (<span className="font-medium text-[#003b1b]">फेरफार</span>), court stays, and encumbrances within <strong>12 seconds</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: 60% (lg:col-span-7) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Section Header & Filter Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-[#c0c9be]/40">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-[#131b2e]">My Registered Parcels</h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#eaedff] text-[#131b2e]">
                  {filteredParcels.length} Active
                </span>
              </div>
              <p className="text-xs text-[#717970]">Real-time synchronized land ownership portfolios</p>
            </div>

            {/* Filter Pills */}
            <div className="inline-flex p-1 rounded-lg bg-[#f2f3ff] border border-[#c0c9be]/40 self-start sm:self-auto text-xs">
              <button
                onClick={() => setFilter('all')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  filter === 'all'
                    ? 'font-semibold bg-white text-[#003b1b] shadow-2xs'
                    : 'font-medium text-[#717970] hover:text-[#131b2e]'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('verified')}
                className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 ${
                  filter === 'verified'
                    ? 'font-semibold bg-white text-[#003b1b] shadow-2xs'
                    : 'font-medium text-[#717970] hover:text-[#131b2e]'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-[#006d30]" />
                Verified
              </button>
              <button
                onClick={() => setFilter('pending')}
                className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 ${
                  filter === 'pending'
                    ? 'font-semibold bg-white text-[#003b1b] shadow-2xs'
                    : 'font-medium text-[#717970] hover:text-[#131b2e]'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Pending
              </button>
              <button
                onClick={() => setFilter('attention')}
                className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 ${
                  filter === 'attention'
                    ? 'font-semibold bg-white text-[#003b1b] shadow-2xs'
                    : 'font-medium text-[#717970] hover:text-[#131b2e]'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-[#ba1a1a]" />
                Attention
              </button>
            </div>
          </div>

          {/* Parcel Cards Container */}
          <div className="space-y-3.5">
            {filteredParcels.map((parcel) => {
              const isPass = parcel.status.includes('PASS');
              const isWarn = parcel.status.includes('WARN');
              const isBlock = parcel.status.includes('BLOCK');

              const strokeColor = isPass ? '#006d30' : isWarn ? '#f59e0b' : '#ba1a1a';
              const cardBorderHover = isPass ? 'hover:border-[#006d30]/50' : isWarn ? 'hover:border-amber-400' : 'hover:border-[#ba1a1a]/40';

              return (
                <div
                  key={parcel.id}
                  className={`bg-white border border-[#c0c9be]/60 rounded-xl p-4.5 shadow-xs ${cardBorderHover} transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4`}
                >
                  <div className="flex items-start gap-4 flex-1">
                    {/* Score Ring Widget */}
                    <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
                      <svg className="w-14 h-14 score-circle" viewBox="0 0 36 36">
                        <path
                          className="text-[#eaedff] stroke-current"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          strokeWidth="3.5"
                        />
                        <path
                          stroke={strokeColor}
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          strokeDasharray={`${parcel.score}, 100`}
                          strokeLinecap="round"
                          strokeWidth="3.5"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-xs font-bold text-[#131b2e] leading-none">{parcel.score}</span>
                        <span className="text-[9px] text-[#717970] font-medium">/100</span>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-[#131b2e] truncate">{parcel.surveyNo}</h3>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            isPass
                              ? 'bg-[#92f5a4] text-[#007233]'
                              : isWarn
                              ? 'bg-amber-50 text-amber-800 border border-amber-300'
                              : 'bg-[#ffdad6] text-[#ba1a1a]'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[12px]">
                            {isPass ? 'check_circle' : isWarn ? 'warning' : 'block'}
                          </span>
                          {parcel.status}
                        </span>
                      </div>
                      <p className="text-xs text-[#717970] truncate">
                        {parcel.village}, Taluka {parcel.taluka}, {parcel.district}, {parcel.state}
                      </p>
                      <div className="text-xs text-[#404941] font-medium">
                        Area: <span className="font-semibold text-[#131b2e]">{parcel.areaHa} Hectares</span> ({parcel.areaAcres} Acres)
                      </div>

                      {/* Tags */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {parcel.tags.map((tag, idx) => (
                          <span
                            key={idx}
                            className={`text-[11px] px-2 py-0.5 rounded border ${
                              isBlock && idx === 0
                                ? 'bg-[#ffdad6]/60 text-[#ba1a1a] border-[#ba1a1a]/20 font-medium'
                                : isWarn && idx === 0
                                ? 'bg-amber-50 text-amber-900 border-amber-200'
                                : 'bg-[#f2f3ff] text-[#404941] border-[#c0c9be]/40'
                            }`}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="w-full sm:w-auto shrink-0 pt-2 sm:pt-0">
                    {isPass ? (
                      <button
                        onClick={() => onNavigateTab('parcel-check-and-red-flag-gate', parcel.id)}
                        className="w-full sm:w-auto px-3.5 py-2 bg-[#f2f3ff] hover:bg-[#eaedff] border border-[#c0c9be]/80 text-[#003b1b] text-xs font-semibold rounded-lg shadow-2xs transition-colors flex items-center justify-center gap-1"
                      >
                        <span>View Full Dossier</span>
                        <span className="material-symbols-outlined text-xs">arrow_forward</span>
                      </button>
                    ) : isWarn ? (
                      <button
                        onClick={() => onNavigateTab('heir-consent-tracker', parcel.id)}
                        className="w-full sm:w-auto px-3.5 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-semibold rounded-lg shadow-2xs transition-colors flex items-center justify-center gap-1"
                      >
                        <span>Track Consent</span>
                        <span className="material-symbols-outlined text-xs">how_to_reg</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => onNavigateTab('parcel-check-and-red-flag-gate', parcel.id)}
                        className="w-full sm:w-auto px-3.5 py-2 bg-[#ba1a1a] text-white hover:bg-[#ba1a1a]/90 text-xs font-semibold rounded-lg shadow-2xs transition-colors flex items-center justify-center gap-1"
                      >
                        <span>Resolve Dispute</span>
                        <span className="material-symbols-outlined text-xs">gavel</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* BOTTOM FULL-WIDTH SECTION: Recent Real-time Alerts & Consent Activity */}
      <section className="bg-white border border-[#c0c9be]/60 rounded-xl p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between pb-2 border-b border-[#c0c9be]/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#eaedff] flex items-center justify-center text-[#003b1b]">
              <span className="material-symbols-outlined text-xl">history</span>
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#131b2e]">Recent Real-time Alerts & Consent Activity</h2>
              <p className="text-xs text-[#717970]">
                Synchronized directly with District Land Registrar and High Court e-Filing nodes
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-xs text-[#006d30] font-medium">
            <span className="w-2 h-2 rounded-full bg-[#006d30] animate-pulse" />
            Live Stream Active
          </span>
        </div>

        {/* Timeline List */}
        <div className="space-y-3 pt-1">
          {alerts.map((alt) => (
            <div
              key={alt.id}
              className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                alt.type === 'error'
                  ? 'bg-[#ffdad6]/20 border-[#ba1a1a]/20 hover:bg-[#ffdad6]/30'
                  : 'bg-[#f2f3ff]/50 border-[#c0c9be]/30 hover:bg-[#f2f3ff]'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                  alt.type === 'error'
                    ? 'bg-[#ffdad6] text-[#ba1a1a]'
                    : alt.type === 'success'
                    ? 'bg-[#92f5a4] text-[#007233]'
                    : 'bg-[#eaedff] text-[#003b1b]'
                }`}
              >
                <span className="material-symbols-outlined text-sm font-bold">
                  {alt.type === 'error' ? 'priority_high' : alt.type === 'success' ? 'check_circle' : 'task_alt'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <p
                    className={`text-xs font-semibold ${
                      alt.type === 'error' ? 'text-[#ba1a1a]' : 'text-[#131b2e]'
                    }`}
                  >
                    {alt.title}
                  </p>
                  <span className="text-[11px] text-[#717970] shrink-0">{alt.time}</span>
                </div>
                <p className="text-[11px] text-[#717970] mt-0.5">{alt.meta}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Sticky Bottom Verification Toast Notification */}
      {showToast && (
        <aside className="fixed bottom-5 right-5 z-50 max-w-sm w-full transition-all animate-bounce-subtle pointer-events-auto">
          <div className="bg-[#283044] text-[#eef0ff] rounded-xl p-3.5 shadow-xl border border-[#c0c9be]/20 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#006d30] text-white flex items-center justify-center shrink-0">
                <span
                  className="material-symbols-outlined text-lg"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  verified
                </span>
              </div>
              <div>
                <p className="text-xs font-bold tracking-tight">Digital Signature Verified</p>
                <p className="text-[11px] text-[#dae2fd]/80">Secured with C-DAC eSign 2.1 PKI</p>
              </div>
            </div>
            <button
              onClick={() => setShowToast(false)}
              className="text-[#dae2fd]/70 hover:text-white p-1 rounded transition-colors"
              title="Dismiss"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
        </aside>
      )}
    </div>
  );
};

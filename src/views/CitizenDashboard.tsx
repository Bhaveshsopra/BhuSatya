import React, { useState, useRef } from 'react';
import { Parcel, AlertItem, ActiveTab, AuditLogEntry } from '../types';

interface CitizenDashboardProps {
  parcels: Parcel[];
  alerts: AlertItem[];
  selectedParcelId: string;
  onSelectParcel: (id: string) => void;
  onNavigateTab: (tab: ActiveTab, parcelId?: string) => void;
  onOpenCheckModal: () => void;
  onUploadSuccess: (newParcel: Parcel) => void;
}

export const CitizenDashboard: React.FC<CitizenDashboardProps> = ({
  parcels,
  alerts,
  selectedParcelId,
  onSelectParcel,
  onNavigateTab,
  onOpenCheckModal,
  onUploadSuccess,
}) => {
  const [filter, setFilter] = useState<'all' | 'verified' | 'pending' | 'attention'>('all');
  const [selectedState, setSelectedState] = useState('mh');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(true);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  // Verification request form state
  const [reqSurveyNo, setReqSurveyNo] = useState('');
  const [reqVillage, setReqVillage] = useState('Mouje Hinjawadi');
  const [reqTaluka, setReqTaluka] = useState('Mulshi');
  const [reqAreaHa, setReqAreaHa] = useState('1.35');
  const [reqOwnerName, setReqOwnerName] = useState('Ananya Sharma');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [selectedFileSize, setSelectedFileSize] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter parcels
  const filteredParcels = parcels.filter((parcel) => {
    if (filter === 'all') return true;
    if (filter === 'verified') {
      return parcel.recommendation === 'Pass' || parcel.caseStatus === 'OFFICER_SANCTIONED' || parcel.caseStatus === 'TITLE_VERIFIED';
    }
    if (filter === 'pending') {
      return parcel.recommendation === 'Needs Review' && parcel.caseStatus !== 'REGISTRATION_FROZEN';
    }
    if (filter === 'attention') {
      return parcel.caseStatus === 'REGISTRATION_FROZEN' || parcel.status.includes('BLOCK') || parcel.score < 50;
    }
    return true;
  });

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 25MB)
    const MAX_SIZE = 25 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setErrorMessage(`File "${file.name}" is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum allowed is 25MB.`);
      return;
    }

    // Validate format
    const validExts = ['.pdf', '.png', '.jpg', '.jpeg', '.tiff'];
    const fileNameLower = file.name.toLowerCase();
    const hasValidExt = validExts.some((ext) => fileNameLower.endsWith(ext));
    if (!hasValidExt) {
      setErrorMessage(`Unsupported format for "${file.name}". Please upload PDF, PNG, JPG, or TIFF.`);
      return;
    }

    setErrorMessage(null);
    setSelectedFile(file);
    setSelectedFileName(file.name);
    setSelectedFileSize(file.size);
    if (!reqSurveyNo) {
      setReqSurveyNo(`Survey No. ${Math.floor(Math.random() * 150 + 50)}/${Math.floor(Math.random() * 4 + 1)}`);
    }
    setShowRequestModal(true);
  };

  const submitVerificationRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);
    setUploadMessage('Transferring and safely storing document on server & evaluating 8 gates...');

    try {
      let response: Response;

      if (selectedFile) {
        // Real multipart file upload transfer
        const formData = new FormData();
        formData.append('document', selectedFile);
        formData.append('stateAuthority', selectedState);
        formData.append('surveyNo', reqSurveyNo || `Survey No. ${Math.floor(Math.random() * 150 + 50)}/1A`);
        formData.append('village', reqVillage);
        formData.append('taluka', reqTaluka);
        formData.append('ownerName', reqOwnerName);
        formData.append('areaHa', reqAreaHa || '1.35');

        response = await fetch('/api/parcels/upload', {
          method: 'POST',
          body: formData,
        });
      } else {
        // Digital metadata / DigiLocker fallback
        response = await fetch('/api/parcels/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stateAuthority: selectedState,
            fileName: selectedFileName || 'Scanned_712_RoR.pdf',
            fileSize: selectedFileSize || 2100000,
            fileType: selectedFileName?.endsWith('.png') ? 'image/png' : 'application/pdf',
            source: 'Citizen Upload & OCR',
            surveyNo: reqSurveyNo || `Survey No. ${Math.floor(Math.random() * 150 + 50)}/1A`,
            village: reqVillage,
            taluka: reqTaluka,
            ownerName: reqOwnerName,
            areaHa: parseFloat(reqAreaHa) || 1.35,
          }),
        });
      }

      const res = await response.json();
      if (res.success) {
        setUploadMessage('✓ Verification case created & queued for officer adjudication!');
        onUploadSuccess(res.data);
        setShowRequestModal(false);
        setSelectedFile(null);
        setTimeout(() => {
          setUploadMessage(null);
          onNavigateTab('extract-and-review', res.data.id);
        }, 1200);
      } else {
        const reasonText = res.reasons && res.reasons.length > 0 ? ` Reason: ${res.reasons.join('; ')}` : '';
        setErrorMessage(`${res.error || 'Upload failed.'}${reasonText}`);
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Server error while submitting request.');
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
          fileSize: 1800000,
          fileType: 'application/pdf',
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
          onNavigateTab('extract-and-review', res.data.id);
        }, 1200);
      }
    } catch (err) {
      console.error(err);
      setUploadMessage('DigiLocker pull failed.');
    } finally {
      setIsUploading(false);
    }
  };

  const loadAuditHistory = async () => {
    try {
      const res = await fetch('/api/audit-logs');
      const data = await res.json();
      if (data.success) {
        setAuditLogs(data.data);
        setShowAuditModal(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelected}
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
              onClick={loadAuditHistory}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#f2f3ff] text-[#003b1b] border border-[#c0c9be]/60 hover:bg-[#eaedff] rounded-lg text-xs font-semibold shadow-2xs transition-colors"
            >
              <span className="material-symbols-outlined text-base">history</span>
              <span>Audit Trail</span>
            </button>
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

      {errorMessage && (
        <div className="p-3 bg-[#ffdad6] text-[#ba1a1a] rounded-xl border border-[#ba1a1a]/30 text-xs font-semibold flex items-center justify-between">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-xs underline">Dismiss</button>
        </div>
      )}

      {/* Two-Column Primary Layout */}
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
                Maximum file size 25MB • Demonstration OCR & Watermark Pipeline
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
                Demonstration rules engine extracts <strong className="text-[#131b2e] font-semibold">42 legal parameters</strong> including mutation entries (<span className="font-medium text-[#003b1b]">फेरफार</span>), court stays, and encumbrances.
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
                <h2 className="text-lg font-bold text-[#131b2e]">My Registered Parcels & Cases</h2>
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
              const isSelected = parcel.id === selectedParcelId;
              const isPass = parcel.recommendation === 'Pass' || parcel.caseStatus === 'OFFICER_SANCTIONED' || parcel.caseStatus === 'TITLE_VERIFIED';
              const isFrozen = parcel.caseStatus === 'REGISTRATION_FROZEN';
              const isWarn = !isPass && !isFrozen;

              const strokeColor = isPass ? '#006d30' : isWarn ? '#f59e0b' : '#ba1a1a';
              const cardBorder = isSelected
                ? 'ring-2 ring-[#003b1b] border-[#003b1b]'
                : isPass
                ? 'hover:border-[#006d30]/50'
                : isWarn
                ? 'hover:border-amber-400'
                : 'hover:border-[#ba1a1a]/40';

              return (
                <div
                  key={parcel.id}
                  onClick={() => onSelectParcel(parcel.id)}
                  className={`bg-white border border-[#c0c9be]/60 rounded-xl p-4.5 shadow-xs ${cardBorder} transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer`}
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
                        {parcel.caseNo && (
                          <span className="font-mono text-[10px] bg-[#eaedff] text-[#003b1b] px-1.5 py-0.5 rounded">
                            {parcel.caseNo}
                          </span>
                        )}
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
                          {parcel.recommendation} • {parcel.registrationStatus}
                        </span>
                      </div>
                      <p className="text-xs text-[#717970] truncate">
                        {parcel.village}, Taluka {parcel.taluka}, {parcel.district}, {parcel.state}
                      </p>
                      <div className="text-xs text-[#404941] font-medium">
                        Area: <span className="font-semibold text-[#131b2e]">{parcel.areaHa} Hectares</span> ({parcel.areaAcres} Acres) • Owner: {parcel.primaryOwner}
                      </div>

                      {/* Tags */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {parcel.tags.map((tag, idx) => (
                          <span
                            key={idx}
                            className={`text-[11px] px-2 py-0.5 rounded border ${
                              isFrozen && idx === 0
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
                  <div className="w-full sm:w-auto shrink-0 pt-2 sm:pt-0 flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectParcel(parcel.id);
                        onNavigateTab('parcel-check-and-red-flag-gate', parcel.id);
                      }}
                      className="px-3 py-1.5 bg-[#f2f3ff] hover:bg-[#eaedff] border border-[#c0c9be]/80 text-[#003b1b] text-xs font-semibold rounded-lg shadow-2xs transition-colors flex items-center gap-1"
                    >
                      <span>Inspect</span>
                      <span className="material-symbols-outlined text-xs">arrow_forward</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectParcel(parcel.id);
                        onNavigateTab('should-i-buy-this-report', parcel.id);
                      }}
                      className="px-3 py-1.5 bg-[#003b1b] hover:bg-[#14532d] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1"
                    >
                      <span>Report</span>
                      <span className="material-symbols-outlined text-xs">description</span>
                    </button>
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
              <h2 className="text-sm font-bold text-[#131b2e]">Recent Real-time Alerts & Activity</h2>
              <p className="text-xs text-[#717970]">
                Connected to District Land Registrar and High Court e-Filing nodes
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

      {/* Verification Request Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#c0c9be]/60 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#c0c9be]/30">
              <h3 className="text-sm font-bold text-[#131b2e] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#003b1b]">add_task</span>
                Create Verification Case Request
              </h3>
              <button onClick={() => setShowRequestModal(false)} className="text-[#717970] hover:text-[#131b2e]">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <div className="p-3 bg-[#f2f3ff] rounded-lg text-xs text-[#404941]">
              Attached File: <strong className="text-[#131b2e]">{selectedFileName}</strong>{' '}
              {selectedFileSize && `(${(selectedFileSize / (1024 * 1024)).toFixed(1)} MB)`}
            </div>

            <form onSubmit={submitVerificationRequest} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#717970] mb-1">Survey / Gat No.</label>
                  <input
                    type="text"
                    required
                    value={reqSurveyNo}
                    onChange={(e) => setReqSurveyNo(e.target.value)}
                    className="w-full px-3 py-2 bg-[#faf8ff] rounded-lg border border-[#c0c9be] text-[#131b2e]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#717970] mb-1">Land Extent (Ha)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={reqAreaHa}
                    onChange={(e) => setReqAreaHa(e.target.value)}
                    className="w-full px-3 py-2 bg-[#faf8ff] rounded-lg border border-[#c0c9be] text-[#131b2e]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#717970] mb-1">Village</label>
                  <input
                    type="text"
                    required
                    value={reqVillage}
                    onChange={(e) => setReqVillage(e.target.value)}
                    className="w-full px-3 py-2 bg-[#faf8ff] rounded-lg border border-[#c0c9be] text-[#131b2e]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#717970] mb-1">Taluka</label>
                  <input
                    type="text"
                    required
                    value={reqTaluka}
                    onChange={(e) => setReqTaluka(e.target.value)}
                    className="w-full px-3 py-2 bg-[#faf8ff] rounded-lg border border-[#c0c9be] text-[#131b2e]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-[#717970] mb-1">Primary Titleholder / Khatedar</label>
                <input
                  type="text"
                  required
                  value={reqOwnerName}
                  onChange={(e) => setReqOwnerName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#faf8ff] rounded-lg border border-[#c0c9be] text-[#131b2e]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#c0c9be]/30">
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  className="px-3 py-1.5 bg-[#f2f3ff] rounded-lg text-xs font-semibold text-[#404941]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-4 py-1.5 bg-[#003b1b] text-white rounded-lg text-xs font-bold hover:bg-[#14532d]"
                >
                  {isUploading ? 'Registering...' : 'Submit Verification Case'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Audit Trail Modal */}
      {showAuditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-[#c0c9be]/60 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-[#c0c9be]/30">
              <h3 className="text-sm font-bold text-[#131b2e] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#003b1b]">history</span>
                BhuSatya Sovereign Case Audit Trail
              </h3>
              <button onClick={() => setShowAuditModal(false)} className="text-[#717970] hover:text-[#131b2e]">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
            <p className="text-xs text-[#717970]">
              Chronological log of case creation, verification checks, heir consent deeds, and officer decisions.
            </p>
            <div className="overflow-y-auto space-y-2.5 flex-1 pr-1 text-xs">
              {auditLogs.length === 0 ? (
                <p className="text-[#717970] text-center py-4">No audit events logged yet.</p>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="p-3 bg-[#f2f3ff] rounded-xl border border-[#c0c9be]/40 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-mono font-bold text-[11px] text-[#003b1b] bg-white px-2 py-0.5 rounded border border-[#c0c9be]/40">
                        {log.action}
                      </span>
                      <span className="text-[10px] text-[#717970]">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-[#131b2e] font-medium">{log.notes}</p>
                    <p className="text-[10px] text-[#717970]">Actor: {log.actor}</p>
                  </div>
                ))
              )}
            </div>
            <div className="flex justify-end pt-2 border-t border-[#c0c9be]/30">
              <button
                onClick={() => setShowAuditModal(false)}
                className="px-4 py-1.5 bg-[#003b1b] text-white text-xs font-bold rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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
                <p className="text-xs font-bold tracking-tight">Active Case Synchronized</p>
                <p className="text-[11px] text-[#dae2fd]/80">Secured with NIC DILRMP Verification Engine</p>
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

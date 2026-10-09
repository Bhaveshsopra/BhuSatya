import React, { useState, useEffect } from 'react';
import { Parcel, ActiveTab } from '../types';

interface StoredCertificate {
  certId: string;
  parcelId: string;
  ulpin: string;
  surveyNo: string;
  issuedTo: string;
  village: string;
  taluka: string;
  district: string;
  areaHa: number;
  issueDate: string;
  validUntil: string;
  issuerName: string;
  issuerRole: string;
  certHash: string;
  status: 'ISSUED' | 'REVOKED';
  eligibilityNotes: string;
}

interface CertificateAndVerifierProps {
  parcel: Parcel;
  parcels?: Parcel[];
  onSelectParcel?: (id: string) => void;
  onNavigateTab?: (tab: ActiveTab, parcelId?: string) => void;
  onRefreshParcel?: () => void;
}

export const CertificateAndVerifier: React.FC<CertificateAndVerifierProps> = ({
  parcel,
  parcels = [],
  onSelectParcel,
  onNavigateTab,
  onRefreshParcel,
}) => {
  const [activeTab, setActiveTab] = useState<'certificate' | 'verify'>('certificate');
  const [existingCert, setExistingCert] = useState<StoredCertificate | null>(null);
  const [isIssuing, setIsIssuing] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [issueSuccess, setIssueSuccess] = useState<string | null>(null);

  // Verifier State
  const [verifyInput, setVerifyInput] = useState(parcel.ulpin);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<StoredCertificate | null>(null);
  const [verifySearched, setVerifySearched] = useState(false);

  // Check eligibility: Pass or Officer Sanctioned
  const isEligible =
    parcel.recommendation === 'Pass' ||
    parcel.caseStatus === 'OFFICER_SANCTIONED' ||
    parcel.caseStatus === 'TITLE_VERIFIED';

  const blockGates = parcel.gates ? parcel.gates.filter((g) => g.status === 'BLOCK') : [];
  const warnGates = parcel.gates ? parcel.gates.filter((g) => g.status === 'WARN') : [];

  // Fetch certificate for current parcel on load and parcel change
  useEffect(() => {
    fetch(`/api/certificates?parcelId=${parcel.id}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data) {
          setExistingCert(res.data);
        } else {
          setExistingCert(null);
        }
      })
      .catch(console.error);
    setVerifyInput(parcel.ulpin);
    setVerifyResult(null);
    setVerifySearched(false);
    setIssueError(null);
    setIssueSuccess(null);
  }, [parcel.id]);

  const handleIssueCertificate = async () => {
    setIsIssuing(true);
    setIssueError(null);
    setIssueSuccess(null);
    try {
      const res = await fetch('/api/certificates/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parcelId: parcel.id,
          issuerName: 'Shri Rajeshwar Rao, IAS',
        }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setExistingCert(data.data);
        setIssueSuccess('✓ Digital Title Certificate (e-Pramaan Patra) officially generated and sealed!');
        onRefreshParcel?.();
        setTimeout(() => setIssueSuccess(null), 4000);
      } else {
        setIssueError(data.error || 'Failed to issue certificate due to unresolved gate criteria.');
      }
    } catch (err) {
      console.error(err);
      setIssueError('Network or server error while issuing certificate.');
    } finally {
      setIsIssuing(false);
    }
  };

  const handleVerify = async () => {
    if (!verifyInput.trim()) return;
    setIsVerifying(true);
    setVerifySearched(true);
    try {
      const res = await fetch(`/api/certificates/verify?q=${encodeURIComponent(verifyInput.trim())}`);
      const data = await res.json();
      if (data.success && data.found && data.data) {
        setVerifyResult(data.data);
      } else {
        setVerifyResult(null);
      }
    } catch (err) {
      console.error(err);
      setVerifyResult(null);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="flex flex-col w-full space-y-6">
      {/* Top Toggle Tabs and Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#c0c9be]/40 gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold text-[#003b1b]">Title Certificate & Public Verifier</h2>
            {parcels.length > 1 && (
              <div className="inline-flex items-center gap-1.5 bg-[#f2f3ff] px-2.5 py-1 rounded-md border border-[#c0c9be]/60 ml-2">
                <span className="text-[11px] font-semibold text-[#717970]">Target Parcel:</span>
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
            )}
          </div>
          <p className="text-xs text-[#717970] mt-0.5">
            Cryptographically sealed Sovereign Land Title Certificate under Digital India Land Records Protocol
          </p>
        </div>

        <div className="inline-flex p-1 rounded-lg bg-[#f2f3ff] border border-[#c0c9be]/50 text-xs self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('certificate')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
              activeTab === 'certificate' ? 'bg-white text-[#003b1b] shadow-2xs' : 'text-[#717970]'
            }`}
          >
            Digital Certificate (e-Pramaan)
          </button>
          <button
            onClick={() => setActiveTab('verify')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
              activeTab === 'verify' ? 'bg-white text-[#003b1b] shadow-2xs' : 'text-[#717970]'
            }`}
          >
            Public Ledger Verifier
          </button>
        </div>
      </div>

      {issueSuccess && (
        <div className="p-3 bg-[#92f5a4]/30 text-[#007233] rounded-xl border border-[#006d30]/30 text-xs font-semibold animate-in fade-in flex items-center justify-between">
          <span>{issueSuccess}</span>
          <button onClick={() => setIssueSuccess(null)} className="text-xs underline">Dismiss</button>
        </div>
      )}

      {issueError && (
        <div className="p-3 bg-[#ffdad6] text-[#ba1a1a] rounded-xl border border-[#ba1a1a]/30 text-xs font-semibold animate-in fade-in flex items-center justify-between">
          <span>{issueError}</span>
          <button onClick={() => setIssueError(null)} className="text-xs underline">Dismiss</button>
        </div>
      )}

      {activeTab === 'certificate' ? (
        <div className="space-y-6">
          {!isEligible ? (
            /* WITHHELD NOTICE: Parcel is not eligible */
            <div className="bg-white rounded-2xl p-6 md:p-8 border-2 border-[#ba1a1a]/50 shadow-sm space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#ffdad6] text-[#ba1a1a] flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-2xl">lock</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#ba1a1a]">
                    Title Certificate Issuance Withheld (प्रमाणपत्र रोखले)
                  </h3>
                  <p className="text-xs text-[#717970] mt-0.5">
                    This parcel cannot be issued a clean Title Verification Certificate until statutory registry red-flags are cleared or sanctioned by the Divisional Commissioner.
                  </p>
                </div>
              </div>

              {/* Block Reasons List */}
              <div className="bg-[#fff8f6] rounded-xl p-4 border border-[#ba1a1a]/20 space-y-2 text-xs">
                <span className="text-[11px] font-bold text-[#ba1a1a] uppercase tracking-wider block">
                  Identified Red-Flag Blocking Gates ({blockGates.length} Blocks, {warnGates.length} Warnings)
                </span>
                <ul className="space-y-1.5">
                  {blockGates.map((gate) => (
                    <li key={gate.id} className="flex items-start gap-2 text-[#ba1a1a]">
                      <span className="material-symbols-outlined text-sm mt-0.5 shrink-0">cancel</span>
                      <div>
                        <strong>{gate.name}:</strong> {gate.desc}
                      </div>
                    </li>
                  ))}
                  {warnGates.map((gate) => (
                    <li key={gate.id} className="flex items-start gap-2 text-amber-800">
                      <span className="material-symbols-outlined text-sm mt-0.5 shrink-0">warning</span>
                      <div>
                        <strong>{gate.name}:</strong> {gate.desc}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={() => onNavigateTab?.('parcel-check-and-red-flag-gate', parcel.id)}
                  className="px-4 py-2 bg-[#003b1b] text-white hover:bg-[#14532d] text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">fact_check</span>
                  <span>Inspect Red-Flag Gate & Escalate</span>
                </button>
                <button
                  onClick={() => onNavigateTab?.('should-i-buy-this-report', parcel.id)}
                  className="px-4 py-2 bg-white text-[#131b2e] hover:bg-[#f2f3ff] text-xs font-semibold rounded-lg border border-[#c0c9be]/60 shadow-2xs transition-colors flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">summarize</span>
                  <span>View Diligence Report</span>
                </button>
              </div>
            </div>
          ) : (
            /* ELIGIBLE: Either show certificate or allow issuance */
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[#f2f3ff] p-3 rounded-xl border border-[#c0c9be]/40 text-xs">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#006d30] text-lg">check_circle</span>
                  <span className="font-semibold text-[#131b2e]">
                    {existingCert
                      ? `Active Title Certificate Ref #${existingCert.certId} is valid until ${existingCert.validUntil}.`
                      : 'Parcel has passed title validation. Ready for official digital certificate sealing.'}
                  </span>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  {!existingCert ? (
                    <button
                      onClick={handleIssueCertificate}
                      disabled={isIssuing}
                      className="px-4 py-2 bg-[#003b1b] text-white hover:bg-[#14532d] text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
                    >
                      <span className="material-symbols-outlined text-base">verified</span>
                      <span>{isIssuing ? 'Sealing Certificate...' : 'Issue Official Digital Certificate'}</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => window.print()}
                      className="px-4 py-2 bg-[#003b1b] text-white hover:bg-[#14532d] text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
                    >
                      <span className="material-symbols-outlined text-base">print</span>
                      <span>Print Official Certificate</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Sovereign Certificate Facsimile */}
              <div className="bg-white rounded-2xl p-8 md:p-12 border-4 border-[#003b1b] shadow-xl relative overflow-hidden max-w-4xl mx-auto print:border-2 print:shadow-none print:m-0">
                {/* Watermark */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-5">
                  <span className="material-symbols-outlined text-[420px] text-[#003b1b]">policy</span>
                </div>

                {/* Certificate Header */}
                <div className="text-center relative z-10 border-b-2 border-[#003b1b] pb-6 space-y-2">
                  <div className="flex justify-center mb-2">
                    <img
                      className="w-14 h-14 object-contain"
                      alt="Sovereign Emblem"
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuDPX4tbh19N5twLk8yHK9SuIIGyg9yYDhAImBNyYOusWlwWSwOxVTgsTdkAHRdDSjfmh6HwSe1HcbUUQz90o57TOFme_wbrtsOA9-XKi1NpKcQSVidVozSENcn1-pq5Q3PL-KScqYDxCCB9b0XiYTAd43AolpEaPGgxHRzozI7pRu7ytalwVplAK7grP7C2f58T2Qn__MvK3wP1fobZJ2WYF6Qyou2onTRwY-Bm1oGFXVdteKzFMjpJ0g"
                    />
                  </div>
                  <h3 className="text-base font-bold text-[#131b2e] tracking-wide uppercase">
                    GOVERNMENT OF INDIA • DEPARTMENT OF LAND RESOURCES
                  </h3>
                  <p className="text-xs text-[#717970] uppercase tracking-wider font-semibold">
                    BHUSATYA NATIONAL CADASTRAL REPOSITORY & REGISTRY INTEGRITY STACK
                  </p>
                  <div className="inline-block px-4 py-1 bg-[#eaedff] rounded-full border border-[#c0c9be]/40 text-xs font-bold text-[#003b1b]">
                    AUTHENTICATED LAND TITLE AUDIT CERTIFICATE (भू-प्रमाण पत्र)
                  </div>
                </div>

                {/* Certificate Body */}
                <div className="relative z-10 py-6 space-y-6 text-xs text-[#131b2e]">
                  <p className="text-sm leading-relaxed">
                    This is to certify that cadastral parcel bearing{' '}
                    <strong className="text-[#003b1b]">{parcel.surveyNo}</strong> (Gat No. {parcel.gatNo}) situated in{' '}
                    <strong>{parcel.village}</strong>, Taluka <strong>{parcel.taluka}</strong>, District{' '}
                    <strong>{parcel.district}</strong>, has been cross-referenced through the 8-Gate AI Verification Protocol against MahaBhulekh, CERSAI, and e-Courts NJDG databases.
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-[#f2f3ff] p-4 rounded-xl border border-[#c0c9be]/50">
                    <div>
                      <span className="text-[10px] text-[#717970] uppercase font-bold block">Certificate Number</span>
                      <span className="font-mono font-bold text-xs text-[#003b1b]">
                        {existingCert?.certId || `CERT-BHU-${parcel.id.toUpperCase()}-2024`}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#717970] uppercase font-bold block">ULPIN Identifier</span>
                      <span className="font-mono font-bold text-xs text-[#003b1b]">{parcel.ulpin}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#717970] uppercase font-bold block">Certified Extent</span>
                      <span className="font-bold text-xs">{parcel.areaHa} Hectares ({parcel.areaAcres} Acres)</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#717970] uppercase font-bold block">Titleholder Khatedar</span>
                      <span className="font-bold text-xs">{parcel.primaryOwner}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#717970] uppercase font-bold block">Issue Date</span>
                      <span className="font-semibold text-xs">
                        {existingCert?.issueDate || new Date().toLocaleDateString('en-GB')}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#717970] uppercase font-bold block">Validity State</span>
                      <span className="font-bold text-xs text-[#006d30]">
                        VALID UNTIL {existingCert?.validUntil || new Date(Date.now() + 365 * 86400000).toLocaleDateString('en-GB')}
                      </span>
                    </div>
                  </div>

                  {/* QR and Seals */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-4 border-t border-[#c0c9be]/30">
                    <div className="flex items-center gap-3">
                      <div className="w-20 h-20 bg-white border-2 border-[#131b2e] p-1.5 flex items-center justify-center">
                        <svg className="w-full h-full text-[#131b2e]" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M2 2h8v8H2V2zm2 2v4h4V4H4zm10-2h8v8h-8V2zm2 2v4h4V4h-4zM2 14h8v8H2v-8zm2 2v4h4v-4H4zm14 0h4v2h-4v-2zm-4 0h2v2h-2v-2zm0 4h2v2h-2v-2zm4 0h4v2h-4v-2zm-2-2h2v2h-2v-2z" />
                        </svg>
                      </div>
                      <div className="space-y-0.5">
                        <span className="font-mono text-[10px] text-[#717970] block">Scan for Public Verification</span>
                        <span className="font-mono font-bold text-[11px] text-[#131b2e]">
                          {existingCert?.certId || `CERT-BHU-${parcel.id.toUpperCase()}-2024`}
                        </span>
                        <span className="text-[10px] text-[#006d30] flex items-center gap-1 font-semibold">
                          <span className="material-symbols-outlined text-xs">verified</span>
                          {existingCert?.certHash.slice(0, 20) || 'SHA-256 Validated'}...
                        </span>
                      </div>
                    </div>

                    <div className="text-right space-y-1">
                      <span className="font-mono text-[11px] font-bold text-[#131b2e] block">
                        {existingCert?.issuerName || 'Shri Rajeshwar Rao, IAS'}
                      </span>
                      <span className="text-[10px] text-[#717970] block">
                        Divisional Commissioner & Inspector General of Registration
                      </span>
                      <span className="font-mono text-[10px] text-[#003b1b] font-semibold block">
                        e-Signed via C-DAC 2.1 PKI Token
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* PUBLIC VERIFIER TAB */
        <div className="bg-white rounded-xl p-6 border border-[#c0c9be]/60 shadow-xs max-w-2xl mx-auto space-y-5">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-[#131b2e]">Public Blockchain & Registry Verifier</h3>
            <p className="text-xs text-[#717970]">
              Verify any Certificate ID, ULPIN, or Survey ID directly against sovereign ledger database records.
            </p>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={verifyInput}
              onChange={(e) => setVerifyInput(e.target.value)}
              placeholder="Enter Certificate ID (e.g. CERT-BHU-P-89-1B-2024) or ULPIN..."
              className="flex-1 px-3 py-2 text-xs bg-[#f2f3ff] rounded-lg border border-[#c0c9be] text-[#131b2e] focus:outline-none focus:ring-2 focus:ring-[#003b1b]"
            />
            <button
              onClick={handleVerify}
              disabled={isVerifying}
              className="px-4 py-2 bg-[#003b1b] text-white text-xs font-bold rounded-lg hover:bg-[#14532d]"
            >
              {isVerifying ? 'Searching...' : 'Verify Ledger'}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#717970]">
            <span>Try sample queries:</span>
            <button
              onClick={() => { setVerifyInput('27-24-0014-0089-001B'); }}
              className="px-2 py-0.5 bg-[#f2f3ff] hover:bg-[#eaedff] rounded text-[#003b1b] font-mono underline"
            >
              27-24-0014-0089-001B
            </button>
            <button
              onClick={() => { setVerifyInput('CERT-BHU-P-89-1B-2024'); }}
              className="px-2 py-0.5 bg-[#f2f3ff] hover:bg-[#eaedff] rounded text-[#003b1b] font-mono underline"
            >
              CERT-BHU-P-89-1B-2024
            </button>
            <button
              onClick={() => { setVerifyInput('27-24-0012-0142-003A'); }}
              className="px-2 py-0.5 bg-[#f2f3ff] hover:bg-[#eaedff] rounded text-[#003b1b] font-mono underline"
            >
              27-24-0012-0142-003A
            </button>
          </div>

          {verifySearched && verifyResult ? (
            <div className="p-4 bg-[#92f5a4]/20 rounded-xl border border-[#006d30]/30 space-y-2 text-xs animate-in fade-in">
              <div className="flex items-center gap-1.5 text-[#007233] font-bold text-sm">
                <span className="material-symbols-outlined text-lg">verified</span>
                <span>AUTHENTIC RECORD CONFIRMED ON SOVEREIGN REPOSITORY</span>
              </div>
              <div className="space-y-1.5 pt-1 text-[#131b2e]">
                <div><span className="text-[#717970]">Certificate Reference:</span> <strong className="font-mono text-[#003b1b]">{verifyResult.certId}</strong></div>
                <div><span className="text-[#717970]">Survey & Extent:</span> <strong>{verifyResult.surveyNo}</strong> ({verifyResult.areaHa} Ha in {verifyResult.village}, {verifyResult.taluka})</div>
                <div><span className="text-[#717970]">Registered Khatedar:</span> <strong>{verifyResult.issuedTo}</strong></div>
                <div><span className="text-[#717970]">Status & Validity:</span> <strong className="text-[#007233]">{verifyResult.status} (Valid until {verifyResult.validUntil})</strong></div>
                <div><span className="text-[#717970]">Ledger Hash:</span> <code className="font-mono text-[11px] bg-white px-1 py-0.5 rounded border border-[#c0c9be]/40">{verifyResult.certHash}</code></div>
                <div><span className="text-[#717970]">Issuing Officer:</span> {verifyResult.issuerName} ({verifyResult.issuerRole})</div>
              </div>
            </div>
          ) : verifySearched && !verifyResult ? (
            <div className="p-4 bg-[#ffdad6]/40 rounded-xl border border-[#ba1a1a]/30 space-y-1 text-xs animate-in fade-in text-[#ba1a1a]">
              <div className="flex items-center gap-1.5 font-bold text-sm">
                <span className="material-symbols-outlined text-lg">cancel</span>
                <span>NO ACTIVE CERTIFICATE RECORD FOUND</span>
              </div>
              <p className="text-xs text-[#404941]">
                No issued Title Certificate matching query &quot;<strong>{verifyInput}</strong>&quot; was found in the BhuSatya repository. If this parcel is pending officer sanction or has active litigation, a certificate has not yet been minted.
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

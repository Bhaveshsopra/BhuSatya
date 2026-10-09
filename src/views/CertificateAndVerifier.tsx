import React, { useState } from 'react';
import { Parcel } from '../types';

interface CertificateAndVerifierProps {
  parcel: Parcel;
}

export const CertificateAndVerifier: React.FC<CertificateAndVerifierProps> = ({ parcel }) => {
  const [activeTab, setActiveTab] = useState<'certificate' | 'verify'>('certificate');
  const [verifyInput, setVerifyInput] = useState(parcel.ulpin);
  const [verifyResult, setVerifyResult] = useState<{
    valid: boolean;
    hash: string;
    node: string;
    issuedTo: string;
    timestamp: string;
  } | null>({
    valid: true,
    hash: 'SHA256: e87c6b91a0c4412f8d32b55104a91924874b9921',
    node: 'DILRMP-MH-PUN-0982 (National Informatics Centre Node)',
    issuedTo: parcel.primaryOwner,
    timestamp: '24-OCT-2024 14:32:00 IST',
  });

  const handleVerify = () => {
    if (verifyInput.trim().length > 3) {
      setVerifyResult({
        valid: true,
        hash: `SHA256: ${Math.random().toString(16).slice(2, 10)}...${Math.random().toString(16).slice(2, 10)}`,
        node: 'DILRMP Cadastral Interoperability Cluster (NIC Node)',
        issuedTo: parcel.primaryOwner,
        timestamp: new Date().toLocaleString(),
      });
    } else {
      setVerifyResult(null);
    }
  };

  return (
    <div className="flex flex-col w-full space-y-6">
      {/* Top Toggle Tabs */}
      <div className="flex items-center justify-between pb-2 border-b border-[#c0c9be]/40">
        <div>
          <h2 className="text-xl font-bold text-[#003b1b]">Title Certificate & Public Verifier</h2>
          <p className="text-xs text-[#717970]">
            Cryptographically sealed Land Title Certificate under Digital India Land Records Protocol
          </p>
        </div>
        <div className="inline-flex p-1 rounded-lg bg-[#f2f3ff] border border-[#c0c9be]/50 text-xs">
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

      {activeTab === 'certificate' ? (
        <div className="space-y-4">
          <div className="flex justify-end gap-3">
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-[#003b1b] text-white hover:bg-[#14532d] text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <span className="material-symbols-outlined text-base">print</span>
              <span>Print Official Certificate</span>
            </button>
          </div>

          {/* Sovereign Certificate Facsimile */}
          <div className="bg-white rounded-2xl p-8 md:p-12 border-4 border-[#003b1b] shadow-xl relative overflow-hidden max-w-4xl mx-auto">
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
                  <span className="text-[10px] text-[#717970] uppercase font-bold block">Classification</span>
                  <span className="font-semibold text-xs">{parcel.classification}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#717970] uppercase font-bold block">Audit Trust Index</span>
                  <span className="font-bold text-xs text-[#006d30]">{parcel.score} / 100 PTS</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#717970] uppercase font-bold block">Transaction Status</span>
                  <span className="font-bold text-xs text-[#ba1a1a]">{parcel.registrationStatus}</span>
                </div>
              </div>

              {/* QR and Seals */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-4 border-t border-[#c0c9be]/30">
                {/* QR Code Simulation */}
                <div className="flex items-center gap-3">
                  <div className="w-20 h-20 bg-white border-2 border-[#131b2e] p-1.5 flex items-center justify-center">
                    <svg className="w-full h-full text-[#131b2e]" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M2 2h8v8H2V2zm2 2v4h4V4H4zm10-2h8v8h-8V2zm2 2v4h4V4h-4zM2 14h8v8H2v-8zm2 2v4h4v-4H4zm14 0h4v2h-4v-2zm-4 0h2v2h-2v-2zm0 4h2v2h-2v-2zm4 0h4v2h-4v-2zm-2-2h2v2h-2v-2z" />
                    </svg>
                  </div>
                  <div className="space-y-0.5">
                    <span className="font-mono text-[10px] text-[#717970] block">Scan for Public Verification</span>
                    <span className="font-mono font-bold text-[11px] text-[#131b2e]">
                      CERT#BHU-{parcel.id.toUpperCase()}-2024
                    </span>
                    <span className="text-[10px] text-[#006d30] flex items-center gap-1 font-semibold">
                      <span className="material-symbols-outlined text-xs">verified</span>
                      SHA-256 Validated
                    </span>
                  </div>
                </div>

                {/* Signatures */}
                <div className="text-right space-y-1">
                  <span className="font-mono text-[11px] font-bold text-[#131b2e] block">
                    Shri Rajeshwar Rao, IAS
                  </span>
                  <span className="text-[10px] text-[#717970] block">Divisional Commissioner & Inspector General of Registration</span>
                  <span className="font-mono text-[10px] text-[#003b1b] font-semibold block">
                    e-Signed via C-DAC 2.1 PKI Token
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl p-6 border border-[#c0c9be]/60 shadow-xs max-w-2xl mx-auto space-y-5">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-[#131b2e]">Public Blockchain & Registry Verifier</h3>
            <p className="text-xs text-[#717970]">
              Verify any certificate hash, ULPIN, or Survey ID directly against sovereign ledger nodes.
            </p>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={verifyInput}
              onChange={(e) => setVerifyInput(e.target.value)}
              placeholder="Enter ULPIN or Certificate Hash..."
              className="flex-1 px-3 py-2 text-xs bg-[#f2f3ff] rounded-lg border border-[#c0c9be] text-[#131b2e] focus:outline-none focus:ring-2 focus:ring-[#003b1b]"
            />
            <button
              onClick={handleVerify}
              className="px-4 py-2 bg-[#003b1b] text-white text-xs font-bold rounded-lg hover:bg-[#14532d]"
            >
              Verify Ledger
            </button>
          </div>

          {verifyResult && (
            <div className="p-4 bg-[#92f5a4]/20 rounded-xl border border-[#006d30]/30 space-y-2 text-xs">
              <div className="flex items-center gap-1.5 text-[#007233] font-bold text-sm">
                <span className="material-symbols-outlined text-lg">verified</span>
                <span>AUTHENTIC RECORD CONFIRMED ON SOVEREIGN REPOSITORY</span>
              </div>
              <div className="space-y-1 pt-1 text-[#131b2e]">
                <div><span className="text-[#717970]">Registered Khatedar:</span> <strong>{verifyResult.issuedTo}</strong></div>
                <div><span className="text-[#717970]">Ledger Hash:</span> <code className="font-mono text-[11px] bg-white px-1 py-0.5 rounded">{verifyResult.hash}</code></div>
                <div><span className="text-[#717970]">Node Signature:</span> {verifyResult.node}</div>
                <div><span className="text-[#717970]">Verification Timestamp:</span> {verifyResult.timestamp}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

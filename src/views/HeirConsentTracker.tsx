import React, { useState } from 'react';
import { HeirConsent, ActiveTab, Parcel } from '../types';

interface HeirConsentTrackerProps {
  consents: HeirConsent[];
  parcels: Parcel[];
  selectedParcelId: string;
  onSelectParcel: (id: string) => void;
  onNavigateTab: (tab: ActiveTab, parcelId?: string) => void;
  onRefreshConsents: () => void;
  onRefreshParcels?: () => void;
}

export const HeirConsentTracker: React.FC<HeirConsentTrackerProps> = ({
  consents,
  parcels,
  selectedParcelId,
  onSelectParcel,
  onNavigateTab,
  onRefreshConsents,
  onRefreshParcels,
}) => {
  const [signingHeirId, setSigningHeirId] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [objectionModalHeir, setObjectionModalHeir] = useState<HeirConsent | null>(null);
  const [objectionReason, setObjectionReason] = useState('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newHeirName, setNewHeirName] = useState('');
  const [newHeirRelation, setNewHeirRelation] = useState('Daughter (Co-heir)');
  const [newHeirAadhaar, setNewHeirAadhaar] = useState('');
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);

  const currentParcel = parcels.find((p) => p.id === selectedParcelId) || parcels[0] || ({} as Parcel);

  // Filter consents for current parcel if available, else show all
  const parcelConsents = consents.filter((c) => c.parcelId === currentParcel.id);
  const displayedConsents = parcelConsents.length > 0 ? parcelConsents : consents;

  const pendingCount = displayedConsents.filter((c) => c.status === 'Pending').length;
  const approvedCount = displayedConsents.filter((c) => c.status === 'Approved').length;

  const handleStartSign = (heirId: string) => {
    setSigningHeirId(heirId);
    setOtp('882914'); // pre-fill demo OTP
  };

  const handleConfirmOtp = async () => {
    if (!signingHeirId) return;
    setIsVerifyingOtp(true);

    try {
      const res = await fetch(`/api/heir-consents/${signingHeirId}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg('✓ Simulated Aadhaar OTP Authenticated! Heir Consent eSigned (Demonstration Sandbox).');
        setSigningHeirId(null);
        onRefreshConsents();
        onRefreshParcels?.();
        setTimeout(() => setStatusMsg(null), 3500);
      } else {
        setStatusMsg(`OTP Error: ${data.error || 'Authentication failed. Please use demo OTP 882914.'}`);
      }
    } catch (err) {
      console.error(err);
      setStatusMsg('Signing failed, please try again.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleFileObjection = async () => {
    if (!objectionModalHeir) return;
    try {
      const res = await fetch(`/api/heir-consents/${objectionModalHeir.id}/objection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: objectionReason }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg('✓ Formal Objection registered. Caveat notice logged on BhuSatya registry.');
        setObjectionModalHeir(null);
        setObjectionReason('');
        onRefreshConsents();
        onRefreshParcels?.();
        setTimeout(() => setStatusMsg(null), 3500);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddHeir = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHeirName.trim()) return;
    setIsSubmittingNew(true);
    try {
      const res = await fetch('/api/heir-consents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parcelId: currentParcel.id,
          name: newHeirName.trim(),
          relation: newHeirRelation,
          aadhaarMasked: newHeirAadhaar.trim() || `•••• •••• ${Math.floor(Math.random() * 8999 + 1000)}`,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg(`✓ Consent request notice dispatched to ${newHeirName}!`);
        setShowAddModal(false);
        setNewHeirName('');
        setNewHeirAadhaar('');
        onRefreshConsents();
        onRefreshParcels?.();
        setTimeout(() => setStatusMsg(null), 3500);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingNew(false);
    }
  };

  return (
    <div className="flex flex-col w-full space-y-6">
      {/* Header Bar */}
      <div className="w-full bg-[#f2f3ff] p-5 rounded-xl border border-[#c0c9be]/50 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xl font-bold text-[#003b1b]">Heir Consent & Lineage Tracker</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#ffdcc3] text-[#703a00] border border-amber-300">
              {pendingCount > 0 ? `${pendingCount} Signatory Pending` : 'All Consents Complete'}
            </span>
            {parcels.length > 1 && (
              <div className="inline-flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-md border border-[#c0c9be]/60 ml-2">
                <span className="text-[11px] font-semibold text-[#717970]">Parcel:</span>
                <select
                  value={currentParcel.id}
                  onChange={(e) => onSelectParcel(e.target.value)}
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
          <p className="text-xs text-[#717970] mt-1">
            Statutory coparcenary validation under Section 6 of Hindu Succession (Amendment) Act, 2005.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-2 bg-[#003b1b] text-white hover:bg-[#14532d] text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">person_add</span>
            <span>Add Coparcener Request</span>
          </button>
          <button
            onClick={() => onNavigateTab('citizen-dashboard')}
            className="px-3.5 py-2 bg-white text-[#131b2e] hover:bg-[#eaedff] text-xs font-semibold rounded-lg border border-[#c0c9be]/60 shadow-2xs transition-colors"
          >
            ← Back to Dashboard
          </button>
          <button
            onClick={() => onNavigateTab('should-i-buy-this-report', currentParcel.id)}
            className="px-3.5 py-2 bg-white text-[#003b1b] hover:bg-[#eaedff] text-xs font-semibold rounded-lg border border-[#c0c9be]/60 shadow-2xs transition-colors flex items-center gap-1.5"
          >
            <span>Diligence Report</span>
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className="p-3 bg-[#92f5a4]/30 text-[#007233] rounded-xl border border-[#006d30]/30 text-xs font-semibold animate-in fade-in flex items-center justify-between">
          <span>{statusMsg}</span>
          <button onClick={() => setStatusMsg(null)} className="text-xs underline">Dismiss</button>
        </div>
      )}

      {/* Target Parcel Summary Box */}
      <div className="bg-white rounded-xl p-5 border border-[#c0c9be]/60 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-[#717970] uppercase text-[10px] font-bold block">Target Parcel</span>
            <span className="text-sm font-bold text-[#131b2e]">{currentParcel.surveyNo}</span>
            <span className="text-[11px] text-[#717970] block">Gat No. {currentParcel.gatNo} • {currentParcel.village}, {currentParcel.taluka}</span>
          </div>
          <div>
            <span className="text-[#717970] uppercase text-[10px] font-bold block">Registered Khatedar / Title</span>
            <span className="text-sm font-bold text-[#131b2e]">{currentParcel.primaryOwner}</span>
            <span className="text-[11px] text-[#717970] block">{currentParcel.jointShareInfo}</span>
          </div>
          <div>
            <span className="text-[#717970] uppercase text-[10px] font-bold block">Consent Clearance</span>
            <span className="text-sm font-bold text-[#006d30]">
              {approvedCount} of {displayedConsents.length} Coparceners Authenticated
            </span>
            <span className="text-[11px] text-[#717970] block">UIDAI Biometric OTP Verified</span>
          </div>
          <div>
            <span className="text-[#717970] uppercase text-[10px] font-bold block">Registry Lock Status</span>
            <span
              className={`inline-block mt-0.5 px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                pendingCount === 0
                  ? 'bg-[#92f5a4] text-[#007233]'
                  : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}
            >
              {pendingCount === 0 ? '✓ All Consents Complete' : `${pendingCount} Signatory Pending`}
            </span>
          </div>
        </div>
      </div>

      {/* Coparceners Table / Card Stack */}
      <div className="bg-white rounded-xl p-5 border border-[#c0c9be]/60 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#c0c9be]/30">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#003b1b] text-xl">family_restroom</span>
            <h3 className="text-sm font-bold text-[#131b2e]">
              Registered Coparcenary Legal Heirs ({displayedConsents.length})
            </h3>
          </div>
          <span className="text-xs text-[#717970]">Cross-referenced with Civil Succession Register</span>
        </div>

        <div className="space-y-3">
          {displayedConsents.map((heir) => {
            const isApproved = heir.status === 'Approved';
            const isRejected = heir.status === 'Rejected';

            return (
              <div
                key={heir.id}
                className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all ${
                  isApproved
                    ? 'bg-[#92f5a4]/15 border-[#006d30]/30'
                    : isRejected
                    ? 'bg-[#ffdad6]/30 border-[#ba1a1a]/30'
                    : 'bg-[#ffdcc3]/20 border-amber-300'
                }`}
              >
                <div className="flex items-start gap-3 flex-1">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-bold ${
                      isApproved
                        ? 'bg-[#92f5a4] text-[#007233]'
                        : isRejected
                        ? 'bg-[#ffdad6] text-[#ba1a1a]'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">
                      {isApproved ? 'check_circle' : isRejected ? 'block' : 'pending'}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-[#131b2e]">{heir.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-white border border-[#c0c9be]/40 text-[#404941]">
                        {heir.relation}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                          isApproved
                            ? 'bg-[#92f5a4] text-[#007233]'
                            : isRejected
                            ? 'bg-[#ffdad6] text-[#ba1a1a]'
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}
                      >
                        {heir.status}
                      </span>
                    </div>

                    <p className="text-xs text-[#717970]">
                      Aadhaar: <span className="font-mono font-medium">{heir.aadhaarMasked}</span> • {heir.authMethod}
                    </p>

                    {isApproved && (
                      <p className="text-[11px] font-mono text-[#006d30]">
                        ✓ Token: {heir.tokenId} • Timestamp: {heir.timestamp}
                      </p>
                    )}

                    {isRejected && heir.objectionReason && (
                      <p className="text-[11px] text-[#ba1a1a] font-semibold">
                        Objection Reason: {heir.objectionReason}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  {!isApproved && (
                    <>
                      <button
                        onClick={() => handleStartSign(heir.id)}
                        className="px-3 py-1.5 bg-[#003b1b] text-white hover:bg-[#14532d] text-xs font-semibold rounded-lg shadow-2xs transition-colors flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-xs">fingerprint</span>
                        <span>Sign via OTP</span>
                      </button>
                      <button
                        onClick={() => setObjectionModalHeir(heir)}
                        className="px-3 py-1.5 bg-white text-[#ba1a1a] border border-[#ba1a1a]/40 hover:bg-[#ffdad6]/20 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-xs">gavel</span>
                        <span>File Objection</span>
                      </button>
                    </>
                  )}
                  {isApproved && (
                    <span className="text-xs text-[#006d30] font-semibold flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-[#006d30]/30">
                      <span className="material-symbols-outlined text-sm">verified</span>
                      Digitally Sealed
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* OTP Signing Modal */}
      {signingHeirId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-2xl border border-[#c0c9be]/60 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#c0c9be]/30">
              <h4 className="text-sm font-bold text-[#131b2e] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#003b1b]">fingerprint</span>
                Simulated Aadhaar OTP eSign
              </h4>
              <button onClick={() => setSigningHeirId(null)} className="text-[#717970] hover:text-[#131b2e]">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 space-y-1">
              <span className="font-bold flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">info</span>
                Simulation Sandbox Mode
              </span>
              <p>
                Live UIDAI / C-DAC gateway is simulated for this demonstration. Use fixed demo OTP: <strong className="font-mono bg-white px-1.5 py-0.5 rounded border border-amber-300 text-[#003b1b]">882914</strong>.
              </p>
            </div>
            <p className="text-xs text-[#717970]">
              Simulated verification dispatched to registered mobile (•••• •••• 7105).
            </p>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#404941] uppercase">Enter OTP</label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                maxLength={6}
                className="w-full text-center tracking-widest text-lg font-mono font-bold py-2 bg-[#f2f3ff] rounded-lg border border-[#c0c9be] focus:ring-2 focus:ring-[#003b1b]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSigningHeirId(null)}
                className="px-3 py-1.5 bg-[#f2f3ff] text-xs font-semibold rounded-lg text-[#404941]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmOtp}
                disabled={isVerifyingOtp}
                className="px-4 py-1.5 bg-[#003b1b] text-white text-xs font-bold rounded-lg hover:bg-[#14532d]"
              >
                {isVerifyingOtp ? 'Verifying with UIDAI...' : 'Authorize eSign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Objection Modal */}
      {objectionModalHeir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-2xl border border-[#ba1a1a]/40 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#c0c9be]/30">
              <h4 className="text-sm font-bold text-[#ba1a1a] flex items-center gap-2">
                <span className="material-symbols-outlined">gavel</span>
                Lodge Formal Heir Objection & Caveat
              </h4>
              <button onClick={() => setObjectionModalHeir(null)} className="text-[#717970] hover:text-[#131b2e]">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
            <p className="text-xs text-[#717970]">
              Lodge caveat notice under Section 148A CPC / Sec 84 Maharashtra Land Revenue Code for{' '}
              <strong>{objectionModalHeir.name}</strong>.
            </p>
            <textarea
              value={objectionReason}
              onChange={(e) => setObjectionReason(e.target.value)}
              placeholder="State grounds of objection (e.g., pending ancestral partition, unpaid coparcenary share, undisclosed agreement)..."
              rows={3}
              className="w-full p-3 bg-[#f2f3ff] text-xs rounded-lg border border-[#c0c9be] focus:outline-none focus:ring-2 focus:ring-[#ba1a1a]"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setObjectionModalHeir(null)}
                className="px-3 py-1.5 bg-[#f2f3ff] text-xs font-semibold rounded-lg text-[#404941]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleFileObjection}
                className="px-4 py-1.5 bg-[#ba1a1a] text-white text-xs font-bold rounded-lg hover:opacity-95"
              >
                Register Caveat
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Add Coparcener / Request Consent Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-2xl border border-[#003b1b]/30 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#c0c9be]/30">
              <h4 className="text-sm font-bold text-[#003b1b] flex items-center gap-2">
                <span className="material-symbols-outlined">person_add</span>
                Initiate Statutory Heir Consent Request
              </h4>
              <button onClick={() => setShowAddModal(false)} className="text-[#717970] hover:text-[#131b2e]">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
            <p className="text-xs text-[#717970]">
              Register coparcener legal heir for parcel <strong>{currentParcel.surveyNo}</strong> ({currentParcel.village}). Dispatches UIDAI biometric authentication notice.
            </p>
            <form onSubmit={handleAddHeir} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-[#404941] uppercase mb-1">
                  Legal Heir Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={newHeirName}
                  onChange={(e) => setNewHeirName(e.target.value)}
                  placeholder="e.g. Radhika Anant Sharma"
                  className="w-full p-2.5 bg-[#f2f3ff] rounded-lg border border-[#c0c9be] text-[#131b2e] focus:outline-none focus:ring-2 focus:ring-[#003b1b]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#404941] uppercase mb-1">
                  Coparcenary Relationship *
                </label>
                <select
                  value={newHeirRelation}
                  onChange={(e) => setNewHeirRelation(e.target.value)}
                  className="w-full p-2.5 bg-[#f2f3ff] rounded-lg border border-[#c0c9be] text-[#131b2e] focus:outline-none focus:ring-2 focus:ring-[#003b1b]"
                >
                  <option value="Daughter (Co-heir)">Daughter (Coparcener under Sec 6 HSA)</option>
                  <option value="Son (Co-heir)">Son (Coparcener)</option>
                  <option value="Widow / Spouse">Widow / Surviving Spouse</option>
                  <option value="Sister (Class-1 Heir)">Sister (Class-1 Statutory Heir)</option>
                  <option value="Brother (Class-2 Heir)">Brother (Class-2 Heir)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#404941] uppercase mb-1">
                  Aadhaar Reference (Masked)
                </label>
                <input
                  type="text"
                  value={newHeirAadhaar}
                  onChange={(e) => setNewHeirAadhaar(e.target.value)}
                  placeholder="e.g. •••• •••• 9921"
                  className="w-full p-2.5 bg-[#f2f3ff] rounded-lg border border-[#c0c9be] text-[#131b2e] focus:outline-none focus:ring-2 focus:ring-[#003b1b]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#c0c9be]/30">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 bg-[#f2f3ff] text-xs font-semibold rounded-lg text-[#404941]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingNew}
                  className="px-4 py-1.5 bg-[#003b1b] text-white text-xs font-bold rounded-lg hover:bg-[#14532d]"
                >
                  {isSubmittingNew ? 'Dispatching...' : 'Dispatch Consent Notice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

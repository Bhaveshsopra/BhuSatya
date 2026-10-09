import React, { useState } from 'react';
import { OfficerQueueItem, ActiveTab } from '../types';

interface RevenueOfficerQueueProps {
  queueItems: OfficerQueueItem[];
  onNavigateTab: (tab: ActiveTab, parcelId?: string) => void;
  onRefreshQueue: () => void;
}

export const RevenueOfficerQueue: React.FC<RevenueOfficerQueueProps> = ({
  queueItems,
  onNavigateTab,
  onRefreshQueue,
}) => {
  const [filterUrgency, setFilterUrgency] = useState<string>('all');
  const [selectedCase, setSelectedCase] = useState<OfficerQueueItem | null>(null);
  const [actionNotes, setActionNotes] = useState('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const filtered = queueItems.filter((item) => {
    if (filterUrgency === 'all') return true;
    return item.urgency.toLowerCase() === filterUrgency.toLowerCase();
  });

  const handleCaseAction = async (caseId: string, action: 'approve' | 'reject' | 'hearing') => {
    try {
      const res = await fetch(`/api/officer-queue/${caseId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, notes: actionNotes }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg(`✓ Case ${caseId} action recorded on Revenue Ledger!`);
        setSelectedCase(null);
        setActionNotes('');
        onRefreshQueue();
        setTimeout(() => setStatusMsg(null), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col w-full space-y-6">
      {/* Officer Header */}
      <div className="w-full bg-[#f2f3ff] p-5 rounded-xl border border-[#c0c9be]/50 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-[#003b1b]">Revenue Officer Statutory Queue</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#14532d] text-[#87c695]">
              Officer Portal: Shri Rajeshwar Rao, IAS
            </span>
          </div>
          <p className="text-xs text-[#717970]">
            Adjudication docket under Maharashtra Land Revenue Code (MLRC) 1966 & Registration Act 1908.
          </p>
        </div>

        {/* Urgency Filter */}
        <div className="inline-flex p-1 rounded-lg bg-white border border-[#c0c9be]/40 text-xs self-start md:self-auto">
          {['all', 'critical', 'high', 'medium'].map((u) => (
            <button
              key={u}
              onClick={() => setFilterUrgency(u)}
              className={`px-3 py-1 rounded-md uppercase font-semibold transition-all ${
                filterUrgency === u ? 'bg-[#003b1b] text-white shadow-2xs' : 'text-[#717970]'
              }`}
            >
              {u}
            </button>
          ))}
        </div>
      </div>

      {statusMsg && (
        <div className="p-3 bg-[#92f5a4]/30 text-[#007233] rounded-xl border border-[#006d30]/30 text-xs font-semibold animate-in fade-in flex items-center justify-between">
          <span>{statusMsg}</span>
          <button onClick={() => setStatusMsg(null)} className="text-xs underline">Dismiss</button>
        </div>
      )}

      {/* Queue Items Table */}
      <div className="bg-white rounded-xl border border-[#c0c9be]/60 shadow-xs overflow-hidden">
        <div className="p-4 bg-[#eaedff] border-b border-[#c0c9be]/40 flex items-center justify-between">
          <span className="text-xs font-bold text-[#131b2e]">
            Pending Escalations & Inquiries ({filtered.length})
          </span>
          <span className="text-[11px] text-[#717970]">Synchronized with Taluka Tahsildar Court</span>
        </div>

        <div className="divide-y divide-[#c0c9be]/30">
          {filtered.map((item) => {
            const isCritical = item.urgency === 'Critical';
            const isHigh = item.urgency === 'High';

            return (
              <div
                key={item.id}
                className="p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 hover:bg-[#f2f3ff]/50 transition-colors"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-xs text-[#003b1b] bg-[#eaedff] px-2 py-0.5 rounded">
                      {item.caseNo}
                    </span>
                    <span className="text-sm font-bold text-[#131b2e]">{item.surveyNo}</span>
                    <span className="text-xs text-[#717970]">Taluka: {item.taluka}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        isCritical
                          ? 'bg-[#ffdad6] text-[#ba1a1a]'
                          : isHigh
                          ? 'bg-[#ffdcc3] text-[#703a00]'
                          : 'bg-[#eaedff] text-[#003b1b]'
                      }`}
                    >
                      {item.urgency} Urgency
                    </span>
                  </div>

                  <p className="text-xs text-[#404941]">
                    Applicant / Titleholder: <strong className="text-[#131b2e]">{item.applicant}</strong> • Stage:{' '}
                    <span className="font-semibold text-[#003b1b]">{item.stage}</span>
                  </p>

                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-[#717970] font-semibold">Triggers:</span>
                    {item.blockTriggers.map((trig, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-2 py-0.5 rounded bg-[#ffdad6]/50 text-[#ba1a1a] border border-[#ba1a1a]/20 font-medium"
                      >
                        {trig}
                      </span>
                    ))}
                    <span className="text-[10px] text-[#717970] ml-2">Status: {item.status}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
                  <button
                    onClick={() => onNavigateTab('parcel-check-and-red-flag-gate', item.parcelId)}
                    className="px-3 py-1.5 bg-[#f2f3ff] hover:bg-[#eaedff] text-[#003b1b] border border-[#c0c9be]/60 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1"
                  >
                    <span>Inspect Parcel</span>
                    <span className="material-symbols-outlined text-xs">open_in_new</span>
                  </button>

                  <button
                    onClick={() => setSelectedCase(item)}
                    className="px-3.5 py-1.5 bg-[#003b1b] hover:bg-[#14532d] text-white text-xs font-bold rounded-lg shadow-2xs transition-colors"
                  >
                    Take Adjudication Action
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Adjudication Modal */}
      {selectedCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl border border-[#c0c9be]/60 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#c0c9be]/30">
              <h4 className="text-sm font-bold text-[#131b2e] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#003b1b]">gavel</span>
                Adjudicate Case: {selectedCase.caseNo}
              </h4>
              <button onClick={() => setSelectedCase(null)} className="text-[#717970] hover:text-[#131b2e]">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <p className="text-xs text-[#404941]">
              Reviewing parcel <strong>{selectedCase.surveyNo}</strong> ({selectedCase.taluka}) for applicant{' '}
              <strong>{selectedCase.applicant}</strong>.
            </p>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-[#404941] uppercase">Official Minute / Order Say</label>
              <textarea
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder="Enter revenue proceeding remarks or notice reference number..."
                rows={3}
                className="w-full p-2.5 bg-[#f2f3ff] text-xs rounded-lg border border-[#c0c9be] focus:ring-2 focus:ring-[#003b1b]"
              />
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedCase(null)}
                className="px-3 py-1.5 bg-[#f2f3ff] text-xs font-semibold rounded-lg text-[#404941]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleCaseAction(selectedCase.id, 'hearing')}
                className="px-3 py-1.5 bg-amber-600 text-white text-xs font-bold rounded-lg hover:bg-amber-700"
              >
                Schedule Hearing Notice
              </button>
              <button
                type="button"
                onClick={() => handleCaseAction(selectedCase.id, 'reject')}
                className="px-3 py-1.5 bg-[#ba1a1a] text-white text-xs font-bold rounded-lg hover:opacity-95"
              >
                Freeze & Prohibit
              </button>
              <button
                type="button"
                onClick={() => handleCaseAction(selectedCase.id, 'approve')}
                className="px-4 py-1.5 bg-[#003b1b] text-white text-xs font-bold rounded-lg hover:bg-[#14532d]"
              >
                Sanction Special Override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

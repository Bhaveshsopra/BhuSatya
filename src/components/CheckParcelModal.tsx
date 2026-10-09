import React, { useState } from 'react';
import { Parcel } from '../types';

interface CheckParcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  parcels: Parcel[];
  onSelectParcel: (parcelId: string, view: 'parcel-check' | 'report' | 'extract') => void;
}

export const CheckParcelModal: React.FC<CheckParcelModalProps> = ({
  isOpen,
  onClose,
  parcels,
  onSelectParcel,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedState, setSelectedState] = useState('mh');

  if (!isOpen) return null;

  const filtered = parcels.filter(
    (p) =>
      p.surveyNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.gatNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.ulpin.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.village.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.primaryOwner.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-[#c0c9be]/50 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-[#f2f3ff] p-5 border-b border-[#c0c9be]/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#003b1b] flex items-center justify-center text-white shadow-sm">
              <span className="material-symbols-outlined text-2xl">search_check</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-[#131b2e]">Check a Parcel (नया भूखंड जांचें)</h3>
              <p className="text-xs text-[#717970]">Instant title check across DILRMP 28-State National Cadastral Grid</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white border border-[#c0c9be]/50 text-[#717970] hover:text-[#131b2e] flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Search Inputs */}
        <div className="p-5 space-y-4 border-b border-[#c0c9be]/30 bg-white">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <label className="block text-[11px] font-semibold text-[#404941] uppercase tracking-wider mb-1">
                State Portal
              </label>
              <select
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                className="w-full bg-[#f2f3ff] text-xs font-semibold rounded-lg border border-[#c0c9be] p-2 focus:ring-2 focus:ring-[#003b1b]/20"
              >
                <option value="mh">Maharashtra (MahaBhulekh)</option>
                <option value="ka">Karnataka (Bhoomi RTC)</option>
                <option value="up">Uttar Pradesh (Bhulekh)</option>
                <option value="ts">Telangana (Dharani)</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-[#404941] uppercase tracking-wider mb-1">
                Survey No / ULPIN / Gat No / Village
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#717970]">
                  <span className="material-symbols-outlined text-lg">search</span>
                </span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="e.g. 142/3A, Gat 408, 27-24-0012, Hinjawadi..."
                  className="w-full pl-9 pr-3 py-2 bg-[#f2f3ff] text-xs font-medium rounded-lg border border-[#c0c9be] focus:ring-2 focus:ring-[#003b1b]/20 text-[#131b2e]"
                  autoFocus
                />
              </div>
            </div>
          </div>
        </div>

        {/* Results List */}
        <div className="p-5 flex-1 overflow-y-auto space-y-3 bg-[#faf8ff]">
          <div className="flex items-center justify-between text-xs text-[#717970] pb-1">
            <span>Discovered Cadastral Records ({filtered.length})</span>
            <span>NIC Direct Node Sync</span>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-8 bg-white rounded-xl border border-dashed border-[#c0c9be] p-6">
              <span className="material-symbols-outlined text-4xl text-[#717970]">sentiment_dissatisfied</span>
              <p className="text-sm font-semibold text-[#131b2e] mt-2">No matching parcel found in quick index</p>
              <p className="text-xs text-[#717970] mt-1">Try searching by Survey 142/3A, Gat 312, or Wagholi.</p>
            </div>
          ) : (
            filtered.map((parcel) => (
              <div
                key={parcel.id}
                className="bg-white p-4 rounded-xl border border-[#c0c9be]/60 shadow-xs hover:border-[#003b1b]/60 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#131b2e]">{parcel.surveyNo}</span>
                    <span className="text-xs font-mono text-[#717970]">{parcel.gatNo}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        parcel.status.includes('PASS')
                          ? 'bg-[#92f5a4] text-[#007233]'
                          : parcel.status.includes('WARN')
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-[#ffdad6] text-[#ba1a1a]'
                      }`}
                    >
                      Score: {parcel.score}/100
                    </span>
                  </div>
                  <p className="text-xs text-[#717970]">
                    {parcel.village}, Taluka {parcel.taluka}, {parcel.district} • {parcel.areaHa} Ha
                  </p>
                  <p className="text-xs text-[#404941] font-medium">Owner: {parcel.primaryOwner}</p>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-2 sm:pt-0">
                  <button
                    onClick={() => {
                      onSelectParcel(parcel.id, 'parcel-check');
                      onClose();
                    }}
                    className="px-3 py-1.5 bg-[#f2f3ff] hover:bg-[#eaedff] text-[#003b1b] border border-[#c0c9be]/80 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1"
                  >
                    <span>Inspect</span>
                    <span className="material-symbols-outlined text-xs">map</span>
                  </button>
                  <button
                    onClick={() => {
                      onSelectParcel(parcel.id, 'report');
                      onClose();
                    }}
                    className="px-3 py-1.5 bg-[#003b1b] hover:bg-[#14532d] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1"
                  >
                    <span>Diligence Report</span>
                    <span className="material-symbols-outlined text-xs">arrow_forward</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

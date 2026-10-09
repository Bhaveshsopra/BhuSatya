import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-[#f2f3ff] mt-12 py-10 shadow-[0_-1px_6px_rgba(0,0,0,0.03)] border-t border-[#c0c9be]/40">
      <div className="w-full max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {/* Col 1 */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-[#003b1b] flex items-center justify-center text-white">
                <span className="material-symbols-outlined text-[16px]">verified</span>
              </div>
              <span className="text-base text-[#003b1b] font-bold">भू-सत्य BhuSatya</span>
            </div>
            <p className="text-xs text-[#404941] leading-relaxed">
              Unified Cadastral Title Verification & Registry Intelligence Infrastructure. Integrated under Department of Land Resources (DoLR), Ministry of Rural Development, Govt. of India.
            </p>
          </div>

          {/* Col 2 */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-[#131b2e] uppercase tracking-wider">
              Institutional Seals
            </span>
            <div className="flex flex-col gap-1 text-xs text-[#404941]">
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-xs text-[#006d30]">check_circle</span>
                Digital India Land Records Modernization
              </span>
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-xs text-[#006d30]">check_circle</span>
                MeitY Open Standard Interoperability
              </span>
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-xs text-[#006d30]">check_circle</span>
                National Informatics Centre (NIC) Node
              </span>
            </div>
          </div>

          {/* Col 3 */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-[#131b2e] uppercase tracking-wider">
              Integrity & Auditing
            </span>
            <div className="flex flex-col gap-1 text-xs text-[#404941]">
              <span className="font-mono text-[11px] bg-white px-1.5 py-0.5 rounded border border-[#c0c9be]/40 w-fit">
                SHA-256 Cadastral Ledger Active
              </span>
              <span>Immutable Title Audit Trail (#IN-REV-2025)</span>
              <span>Data Protection (DPDP Act, 2023 Compliant)</span>
            </div>
          </div>

          {/* Col 4 */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-[#ba1a1a] uppercase tracking-wider flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">lock_reset</span>
              Emergency Freeze Hotline
            </span>
            <p className="text-xs text-[#404941]">
              Immediate caveat registration & fraud alert freezing line:
            </p>
            <span className="font-mono text-sm font-bold text-[#ba1a1a] bg-[#ffdad6]/50 px-2 py-1 rounded w-fit">
              1800-REV-FREEZE (24x7)
            </span>
            <span className="text-xs text-[#717970]">support@bhusatya.gov.in</span>
          </div>
        </div>

        {/* Bottom copyright line */}
        <div className="pt-4 bg-[#eaedff] flex flex-col md:flex-row items-center justify-between gap-3 px-4 py-3 rounded-xl border border-[#c0c9be]/30">
          <div className="text-xs text-[#404941] text-center md:text-left">
            © 2025 National Informatics Centre, Department of Land Resources, Government of India. All rights reserved.
          </div>
          <div className="flex items-center gap-4 text-xs text-[#404941]">
            <a className="hover:text-[#131b2e] transition-colors" href="#hyperlink-policy">Hyperlink Policy</a>
            <a className="hover:text-[#131b2e] transition-colors" href="#privacy-policy">Privacy Policy</a>
            <a className="hover:text-[#131b2e] transition-colors" href="#terms">Terms of Service</a>
            <a className="hover:text-[#131b2e] transition-colors" href="#dispute-protocol">Dispute Protocol</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

import React, { useState } from 'react';
import { ActiveTab, Language } from '../types';

interface HeaderProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  onOpenCheckModal: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  language,
  onLanguageChange,
  onOpenCheckModal,
  searchQuery,
  onSearchChange,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const navItems: Array<{ id: ActiveTab; labelEn: string; labelHi: string; labelMr: string }> = [
    { id: 'citizen-dashboard', labelEn: 'Citizen Dashboard', labelHi: 'नागरिक डैशबोर्ड', labelMr: 'नागरिक डॅशबोर्ड' },
    { id: 'extract-and-review', labelEn: 'Extract & Review', labelHi: 'दस्तावेज़ निष्कर्षण', labelMr: 'उतारा व तपासणी' },
    { id: 'parcel-check-and-red-flag-gate', labelEn: 'Parcel Check & Red-Flag Gate', labelHi: 'भूखंड जांच एवं अवरोध द्वार', labelMr: 'भूखंड तपासणी व रेड-फ्लॅग' },
    { id: 'heir-consent-tracker', labelEn: 'Heir Consent Tracker', labelHi: 'वारिस सहमति ट्रैकर', labelMr: 'वारसदार संमती ट्रॅकर' },
    { id: 'should-i-buy-this-report', labelEn: '“Should I Buy This?” Report', labelHi: '“क्या मैं यह खरीदूं?” रिपोर्ट', labelMr: '“मी ही जमीन खरेदी करावी का?” अहवाल' },
    { id: 'certificate-and-verifier', labelEn: 'Certificate & Verifier', labelHi: 'प्रमाणपत्र एवं सत्यापन', labelMr: 'प्रमाणपत्र व पडताळणी' },
    { id: 'revenue-officer-queue', labelEn: 'Revenue Officer Queue', labelHi: 'राजस्व अधिकारी कतार', labelMr: 'महसूल अधिकारी कक्ष' },
  ];

  const getLabel = (item: (typeof navItems)[0]) => {
    if (language === 'HI') return item.labelHi;
    if (language === 'MR') return item.labelMr;
    return item.labelEn;
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#ffffff]/95 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] border-b border-[#c0c9be]/40">
      {/* Sovereign Tricolor Ribbon */}
      <div className="w-full h-1 bg-gradient-to-r from-[#FF9933] via-[#FFFFFF] to-[#138808]" />

      <div className="w-full max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-2">
        {/* Top Tier: Brand, Helpline, Lang & Officer Profile */}
        <div className="flex items-center justify-between gap-4 py-1">
          {/* Logo Brand */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => onTabChange('citizen-dashboard')}
              className="flex items-center gap-2.5 text-left focus:outline-none"
            >
              <div className="w-9 h-9 rounded-lg bg-[#003b1b] flex items-center justify-center text-white shadow-sm shrink-0">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 48 48">
                  <path d="M44 11.2727C44 14.0109 39.8386 16.3957 33.69 17.6364C39.8386 18.877 44 21.2618 44 24C44 26.7382 39.8386 29.123 33.69 30.3636C39.8386 31.6043 44 33.9891 44 36.7273C44 40.7439 35.0457 44 24 44C12.9543 44 4 40.7439 4 36.7273C4 33.9891 8.16144 31.6043 14.31 30.3636C8.16144 29.123 4 26.7382 4 24C4 21.2618 8.16144 18.877 14.31 17.6364C8.16144 16.3957 4 14.0109 4 11.2727C4 7.25611 12.9543 4 24 4C35.0457 4 44 7.25611 44 11.2727Z" />
                </svg>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-[#003b1b] font-bold text-lg tracking-tight">BhuSatya | भू-सत्य</span>
                  <span className="px-2 py-0.5 rounded-full bg-[#92f5a4] text-[#007233] text-[10px] font-bold uppercase tracking-wider">
                    DILRMP Verified
                  </span>
                </div>
                <span className="text-xs text-[#717970] hidden sm:inline -mt-0.5">
                  AI Land Title Verification & Registry Integrity • Govt. of India
                </span>
              </div>
            </button>
          </div>

          {/* Right Meta Bar */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Live Stack Indicator */}
            <div className="hidden xl:flex items-center gap-1.5 bg-[#f2f3ff] px-3 py-1 rounded-full border border-[#c0c9be]/30">
              <span className="w-2 h-2 rounded-full bg-[#006d30] animate-pulse" />
              <span className="text-[11px] text-[#404941] font-medium">
                DigiLocker & State Land Stack Connected - 28 States
              </span>
            </div>

            {/* Toll-Free Helpline */}
            <div className="hidden lg:flex items-center gap-2 text-[#404941] pl-2 border-l border-[#c0c9be]/40">
              <span className="material-symbols-outlined text-[#003b1b] text-[18px]">call</span>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-semibold text-[#717970] leading-none">Toll-Free Helpdesk</span>
                <span className="font-mono text-xs font-bold text-[#131b2e]">1800-BHUSATYA</span>
              </div>
            </div>

            {/* Language Switcher */}
            <div className="flex items-center bg-[#f2f3ff] p-0.5 rounded-lg border border-[#c0c9be]/40">
              {(['EN', 'HI', 'MR'] as Language[]).map((lang) => (
                <button
                  key={lang}
                  onClick={() => onLanguageChange(lang)}
                  className={`px-2.5 py-0.5 rounded-md text-xs font-semibold transition-all ${
                    language === lang
                      ? 'bg-white text-[#131b2e] shadow-xs'
                      : 'text-[#717970] hover:text-[#131b2e]'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>

            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="p-1.5 text-[#404941] hover:text-[#131b2e] hover:bg-[#eaedff] rounded-lg transition-colors relative"
                title="Notifications & Alerts"
              >
                <span className="material-symbols-outlined text-xl">notifications</span>
                <span className="absolute top-1 right-1 w-2 h-2 bg-[#ba1a1a] rounded-full ring-2 ring-white" />
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-[#c0c9be]/50 rounded-xl shadow-xl p-3 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center justify-between pb-2 border-b border-[#c0c9be]/30">
                    <span className="text-xs font-bold text-[#131b2e]">Active Alerts (3)</span>
                    <button
                      onClick={() => setNotificationsOpen(false)}
                      className="text-xs text-[#717970] hover:text-[#131b2e]"
                    >
                      Close
                    </button>
                  </div>
                  <div className="space-y-2 mt-2 text-xs">
                    <div className="p-2 bg-[#92f5a4]/20 border border-[#92f5a4]/40 rounded-lg">
                      <p className="font-semibold text-[#007233]">Heir Consent Approved</p>
                      <p className="text-[11px] text-[#404941]">Smt. Sunita Sharma signed for Survey 89/1B via Aadhaar OTP.</p>
                    </div>
                    <div className="p-2 bg-[#ffdad6]/40 border border-[#ba1a1a]/20 rounded-lg">
                      <p className="font-semibold text-[#ba1a1a]">Section 84 Notice (Gat 312)</p>
                      <p className="text-[11px] text-[#404941]">Objection window expires in 14 days.</p>
                    </div>
                    <div className="p-2 bg-[#f2f3ff] rounded-lg">
                      <p className="font-semibold text-[#131b2e]">Bank NOC Synced</p>
                      <p className="text-[11px] text-[#717970]">SBI Home Finance zero charge verified on CERSAI.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Officer Profile Badge */}
            <div className="flex items-center gap-2 pl-2 border-l border-[#c0c9be]/40">
              <div className="flex flex-col items-end text-right hidden sm:flex">
                <span className="text-xs font-bold text-[#131b2e] truncate max-w-[170px]">
                  Shri Rajeshwar Rao, IAS
                </span>
                <span className="text-[10px] text-[#717970] truncate max-w-[170px]">
                  Divisional Commissioner / Revenue
                </span>
              </div>
              <img
                alt="Profile"
                className="w-8 h-8 rounded-full object-cover ring-2 ring-[#b1f2be]"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBqns_K8awSz6EFRZ6wGByQijnAKZwacYK2Q-nQNccVY-VFEm8TZbydrqGQsswPcC3jB3OYT1gyBbofPdZPuhdYTWm2D0Gvs2-KYyeTrmYAJ-WUkBw4upqsELw2_dHYeVHl8LVMg2RyVtwHMuYtsXAAzgl5QpuWpql5-in7q-F07XTQLNneP6y_ubOPVJb3-nsiOiWE-h6gP6oGtqiBsWRUdmVmqK5h7D43eiJTBA44Nvisvdlnl8UeKQ"
              />
            </div>

            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-1.5 text-[#404941] hover:text-[#131b2e]"
            >
              <span className="material-symbols-outlined text-2xl">
                {mobileMenuOpen ? 'close' : 'menu'}
              </span>
            </button>
          </div>
        </div>

        {/* Bottom Tier: Main Navigation Bar + Quick Parcel Check Action */}
        <div className="flex items-center justify-between gap-4 pt-1 border-t border-[#c0c9be]/30">
          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 overflow-x-auto py-1">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-[#14532d] text-[#87c695] shadow-xs'
                      : 'text-[#404941] hover:bg-[#eaedff] hover:text-[#131b2e]'
                  }`}
                >
                  {getLabel(item)}
                </button>
              );
            })}
          </nav>

          {/* Quick Search & Parcel Check Button */}
          <div className="flex items-center gap-2 flex-1 lg:flex-initial justify-end">
            <div className="relative w-full max-w-xs">
              <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-[#717970]">
                <span className="material-symbols-outlined text-base">search</span>
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Survey No, ULPIN, or Village..."
                className="w-full pl-8 pr-3 py-1 bg-[#f2f3ff] border border-[#c0c9be]/60 rounded-lg text-xs text-[#131b2e] placeholder:text-[#717970] focus:outline-none focus:ring-2 focus:ring-[#003b1b]/20 focus:border-[#003b1b] transition-all"
              />
            </div>

            <button
              onClick={onOpenCheckModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#003b1b] text-white rounded-lg text-xs font-semibold hover:bg-[#14532d] shadow-sm transition-all whitespace-nowrap shrink-0 group"
            >
              <span className="material-symbols-outlined text-sm group-hover:rotate-12 transition-transform">search</span>
              <span>Check a Parcel (नया भूखंड जांचें)</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden pt-3 pb-2 border-t border-[#c0c9be]/30 flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onTabChange(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`text-left px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                    isActive
                      ? 'bg-[#14532d] text-[#87c695]'
                      : 'text-[#404941] hover:bg-[#eaedff]'
                  }`}
                >
                  {getLabel(item)}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </header>
  );
};

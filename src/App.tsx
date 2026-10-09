import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { CheckParcelModal } from './components/CheckParcelModal';
import { CitizenDashboard } from './views/CitizenDashboard';
import { ExtractAndReview } from './views/ExtractAndReview';
import { ParcelCheckAndRedFlagGate } from './views/ParcelCheckAndRedFlagGate';
import { HeirConsentTracker } from './views/HeirConsentTracker';
import { ShouldIBuyThisReport } from './views/ShouldIBuyThisReport';
import { CertificateAndVerifier } from './views/CertificateAndVerifier';
import { RevenueOfficerQueue } from './views/RevenueOfficerQueue';
import { Parcel, ExtractionData, HeirConsent, AlertItem, OfficerQueueItem, ActiveTab, Language } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('citizen-dashboard');
  const [language, setLanguage] = useState<Language>('EN');
  const [searchQuery, setSearchQuery] = useState('');
  const [checkModalOpen, setCheckModalOpen] = useState(false);

  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [selectedParcelId, setSelectedParcelId] = useState<string>('p-142-3a');
  const [extraction, setExtraction] = useState<ExtractionData | null>(null);
  const [consents, setConsents] = useState<HeirConsent[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [queueItems, setQueueItems] = useState<OfficerQueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Initial load
  const loadInitialData = async () => {
    try {
      const [parcelsRes, extRes, consentsRes, alertsRes, queueRes] = await Promise.all([
        fetch('/api/parcels').then((r) => r.json()),
        fetch('/api/extraction').then((r) => r.json()),
        fetch('/api/heir-consents').then((r) => r.json()),
        fetch('/api/alerts').then((r) => r.json()),
        fetch('/api/officer-queue').then((r) => r.json()),
      ]);

      if (parcelsRes.success) setParcels(parcelsRes.data);
      if (extRes.success) setExtraction(extRes.data);
      if (consentsRes.success) setConsents(consentsRes.data);
      if (alertsRes.success) setAlerts(alertsRes.data);
      if (queueRes.success) setQueueItems(queueRes.data);
    } catch (err) {
      console.error('Error fetching initial data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const refreshConsents = async () => {
    try {
      const res = await fetch('/api/heir-consents');
      const data = await res.json();
      if (data.success) setConsents(data.data);
      // Also refresh parcels
      const pRes = await fetch('/api/parcels');
      const pData = await pRes.json();
      if (pData.success) setParcels(pData.data);
    } catch (e) {
      console.error(e);
    }
  };

  const refreshQueue = async () => {
    try {
      const res = await fetch('/api/officer-queue');
      const data = await res.json();
      if (data.success) setQueueItems(data.data);
    } catch (e) {
      console.error(e);
    }
  };

  const refreshParcels = async () => {
    try {
      const pRes = await fetch('/api/parcels');
      const pData = await pRes.json();
      if (pData.success) setParcels(pData.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleNavigate = (tab: ActiveTab, parcelId?: string) => {
    if (parcelId) setSelectedParcelId(parcelId);
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpdateParcel = (updated: Parcel) => {
    setParcels((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  const handleNewParcelUploaded = (newParcel: Parcel) => {
    setParcels((prev) => [newParcel, ...prev]);
    setSelectedParcelId(newParcel.id);
  };

  const currentParcel = parcels.find((p) => p.id === selectedParcelId) || parcels[0] || ({} as Parcel);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#faf8ff] text-[#131b2e]">
        <div className="w-12 h-12 rounded-xl bg-[#003b1b] flex items-center justify-center text-white mb-4 shadow-md animate-pulse">
          <span className="material-symbols-outlined text-3xl">verified</span>
        </div>
        <h2 className="text-base font-bold tracking-tight">BhuSatya Land Governance Protocol</h2>
        <p className="text-xs text-[#717970] mt-1">Synchronizing National Land Records & CERSAI Node...</p>
      </div>
    );
  }

  return (
    <div className="bg-[#faf8ff] text-[#131b2e] font-sans antialiased min-h-screen flex flex-col">
      {/* Top Fixed Header */}
      <Header
        activeTab={activeTab}
        onTabChange={(t) => handleNavigate(t)}
        language={language}
        onLanguageChange={setLanguage}
        onOpenCheckModal={() => setCheckModalOpen(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Main Content View Container with top padding for fixed header */}
      <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-8">
        {activeTab === 'citizen-dashboard' && (
          <CitizenDashboard
            parcels={parcels}
            alerts={alerts}
            selectedParcelId={selectedParcelId}
            onSelectParcel={setSelectedParcelId}
            onNavigateTab={handleNavigate}
            onOpenCheckModal={() => setCheckModalOpen(true)}
            onUploadSuccess={handleNewParcelUploaded}
          />
        )}

        {activeTab === 'extract-and-review' && extraction && (
          <ExtractAndReview
            initialExtraction={extraction}
            selectedParcel={currentParcel}
            parcels={parcels}
            onSelectParcel={setSelectedParcelId}
            onNavigateTab={handleNavigate}
            onUpdateParcel={handleUpdateParcel}
            onRefreshParcels={refreshParcels}
          />
        )}

        {activeTab === 'parcel-check-and-red-flag-gate' && currentParcel.id && (
          <ParcelCheckAndRedFlagGate
            parcel={currentParcel}
            parcels={parcels}
            onSelectParcel={setSelectedParcelId}
            onNavigateTab={handleNavigate}
            onUpdateParcel={handleUpdateParcel}
            onRefreshParcels={refreshParcels}
          />
        )}

        {activeTab === 'heir-consent-tracker' && (
          <HeirConsentTracker
            consents={consents}
            parcels={parcels}
            selectedParcelId={selectedParcelId}
            onSelectParcel={setSelectedParcelId}
            onNavigateTab={handleNavigate}
            onRefreshConsents={refreshConsents}
            onRefreshParcels={refreshParcels}
          />
        )}

        {activeTab === 'should-i-buy-this-report' && currentParcel.id && (
          <ShouldIBuyThisReport
            parcel={currentParcel}
            parcels={parcels}
            onSelectParcel={setSelectedParcelId}
            onNavigateTab={handleNavigate}
          />
        )}

        {activeTab === 'certificate-and-verifier' && currentParcel.id && (
          <CertificateAndVerifier
            parcel={currentParcel}
            parcels={parcels}
            onSelectParcel={setSelectedParcelId}
            onNavigateTab={handleNavigate}
            onRefreshParcel={refreshParcels}
          />
        )}

        {activeTab === 'revenue-officer-queue' && (
          <RevenueOfficerQueue
            queueItems={queueItems}
            parcels={parcels}
            onNavigateTab={handleNavigate}
            onRefreshQueue={refreshQueue}
            onRefreshParcels={refreshParcels}
          />
        )}
      </main>

      {/* Global Quick Check Modal */}
      <CheckParcelModal
        isOpen={checkModalOpen}
        onClose={() => setCheckModalOpen(false)}
        parcels={parcels}
        onSelectParcel={(pId, view) => {
          if (view === 'parcel-check') handleNavigate('parcel-check-and-red-flag-gate', pId);
          else if (view === 'report') handleNavigate('should-i-buy-this-report', pId);
          else handleNavigate('extract-and-review', pId);
        }}
      />

      {/* Institutional GovTech Footer */}
      <Footer />
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { ExtractionData, ActiveTab, Parcel } from '../types';

interface ExtractAndReviewProps {
  initialExtraction: ExtractionData;
  selectedParcel: Parcel;
  parcels?: Parcel[];
  onSelectParcel?: (parcelId: string) => void;
  onNavigateTab: (tab: ActiveTab, parcelId?: string) => void;
  onUpdateParcel: (updated: Parcel) => void;
  onRefreshParcels?: () => void;
}

export const ExtractAndReview: React.FC<ExtractAndReviewProps> = ({
  initialExtraction,
  selectedParcel,
  parcels = [],
  onSelectParcel,
  onNavigateTab,
  onUpdateParcel,
  onRefreshParcels,
}) => {
  const [extraction, setExtraction] = useState<ExtractionData>(initialExtraction);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [rotation, setRotation] = useState(0);
  const [boxesVisible, setBoxesVisible] = useState(true);
  const [showMarathiOwner, setShowMarathiOwner] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rejectionNotice, setRejectionNotice] = useState(false);

  // Editable form fields state (synchronized with selected parcel)
  const [ownerName, setOwnerName] = useState(
    extraction.fields?.primaryOwner?.value || selectedParcel.primaryOwner || 'Suresh Vithalrao Deshmukh'
  );
  const [surveyNum, setSurveyNum] = useState(
    extraction.fields?.surveyNumber?.value || selectedParcel.surveyNo.replace('Survey No. ', '') || '142/3A'
  );
  const [hissa, setHissa] = useState(
    extraction.fields?.subDivision?.value || 'Sub-division 3A (Hissa No. 1)'
  );
  const [landArea, setLandArea] = useState(
    extraction.fields?.totalArea?.value || `${selectedParcel.areaHa} Ha (${selectedParcel.areaAcres} Acres)`
  );
  const [shareFraction, setShareFraction] = useState(
    extraction.fields?.shareFraction?.value || selectedParcel.jointShareInfo || '1/2 Share (Joint Co-parcener)'
  );
  const [encumbrances, setEncumbrances] = useState(
    extraction.fields?.encumbrances?.value || selectedParcel.encumbrance || 'Bank of Maharashtra, Branch Hinjawadi - Charge Rs 15,00,000'
  );

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    // When selected parcel changes, fetch extraction for that parcel
    fetch(`/api/extraction?parcelId=${selectedParcel.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.data) {
          setExtraction(data.data);
          if (data.data.fields?.primaryOwner?.value) setOwnerName(data.data.fields.primaryOwner.value);
          if (data.data.fields?.surveyNumber?.value) setSurveyNum(data.data.fields.surveyNumber.value);
          if (data.data.fields?.totalArea?.value) setLandArea(data.data.fields.totalArea.value);
          if (data.data.fields?.encumbrances?.value) setEncumbrances(data.data.fields.encumbrances.value);
        }
      })
      .catch(console.error);
  }, [selectedParcel.id]);

  const handleZoomIn = () => {
    if (zoomLevel < 1.6) setZoomLevel((z) => Number((z + 0.15).toFixed(2)));
  };

  const handleZoomOut = () => {
    if (zoomLevel > 0.6) setZoomLevel((z) => Number((z - 0.15).toFixed(2)));
  };

  const handleRotate = () => {
    setRotation((r) => (r + 90) % 360);
  };

  const handleFit = () => {
    setZoomLevel(1.0);
    setRotation(0);
  };

  const handleRescan = async () => {
    setIsScanning(true);
    try {
      const res = await fetch('/api/extraction/rescan', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.data) {
        setExtraction(data.data);
        setSaveMessage('✓ Demonstration OCR pass re-evaluated.');
        setTimeout(() => setSaveMessage(null), 2500);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(() => setIsScanning(false), 500);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      setErrorMessage(`File exceeds 25MB limit (${(file.size / (1024 * 1024)).toFixed(1)}MB).`);
      return;
    }
    const validExts = ['.pdf', '.png', '.jpg', '.jpeg', '.tiff'];
    if (!validExts.some((ext) => file.name.toLowerCase().endsWith(ext))) {
      setErrorMessage('Unsupported format. Please upload PDF, PNG, JPG, or TIFF.');
      return;
    }

    setErrorMessage(null);
    setIsScanning(true);
    setSaveMessage('Uploading document and initiating demonstration extraction...');

    try {
      const formData = new FormData();
      formData.append('document', file);
      formData.append('surveyNo', `Survey No. ${Math.floor(Math.random() * 120 + 40)}/${String.fromCharCode(65 + Math.floor(Math.random() * 3))}`);
      formData.append('village', selectedParcel.village);
      formData.append('taluka', selectedParcel.taluka);
      formData.append('ownerName', 'Ananya Sharma');
      formData.append('areaHa', '1.45');
      formData.append('source', 'Extract & Review Upload');

      const res = await fetch('/api/parcels/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success && data.data) {
        onUpdateParcel(data.data);
        onSelectParcel?.(data.data.id);
        onRefreshParcels?.();
        setSaveMessage('✓ Document uploaded and processed into demonstration pipeline!');
        setTimeout(() => setSaveMessage(null), 3000);
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Failed to upload document.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleSaveFields = async () => {
    try {
      const res = await fetch('/api/extraction', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parcelId: selectedParcel.id,
          fields: {
            ...extraction.fields,
            primaryOwner: { ...extraction.fields.primaryOwner, value: ownerName },
            surveyNumber: { ...extraction.fields.surveyNumber, value: surveyNum },
            subDivision: { ...extraction.fields.subDivision, value: hissa },
            totalArea: { ...extraction.fields.totalArea, value: landArea },
            shareFraction: { ...extraction.fields.shareFraction, value: shareFraction },
            encumbrances: { ...extraction.fields.encumbrances, value: encumbrances },
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveMessage('✓ Corrected fields synchronized to case record and parcel database!');
        onRefreshParcels?.();
        setTimeout(() => setSaveMessage(null), 3000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleConfirmAndRun = async () => {
    setIsVerifying(true);
    try {
      // 1. Save extraction
      await fetch('/api/extraction', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parcelId: selectedParcel.id,
          fields: {
            ...extraction.fields,
            primaryOwner: { ...extraction.fields.primaryOwner, value: ownerName },
            surveyNumber: { ...extraction.fields.surveyNumber, value: surveyNum },
            subDivision: { ...extraction.fields.subDivision, value: hissa },
            totalArea: { ...extraction.fields.totalArea, value: landArea },
            shareFraction: { ...extraction.fields.shareFraction, value: shareFraction },
            encumbrances: { ...extraction.fields.encumbrances, value: encumbrances },
          },
        }),
      });

      // 2. Confirm extraction
      await fetch('/api/extraction/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parcelId: selectedParcel.id }),
      });

      // 3. Re-evaluate 8 gates
      const evalRes = await fetch(`/api/parcels/${selectedParcel.id}/evaluate`, { method: 'POST' });
      const evalData = await evalRes.json();
      if (evalData.success && evalData.data) {
        onUpdateParcel(evalData.data);
      }
      onRefreshParcels?.();

      setTimeout(() => {
        setIsVerifying(false);
        onNavigateTab('parcel-check-and-red-flag-gate', selectedParcel.id);
      }, 900);
    } catch (err) {
      console.error(err);
      setIsVerifying(false);
    }
  };

  const handleReject = () => {
    if (window.confirm('Reject extract scan and request fresh mutation ledger copy from Pune Tahsildar?')) {
      setRejectionNotice(true);
      setTimeout(() => setRejectionNotice(false), 3500);
    }
  };

  return (
    <div className="flex flex-col w-full space-y-6">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".pdf,.png,.jpg,.jpeg,.tiff"
        className="hidden"
      />

      {/* Notice Banner */}
      <div className="bg-[#eaedff] border border-[#003b1b]/20 px-4 py-2.5 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-[#003b1b]">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-base shrink-0">info</span>
          <span>
            <strong>Demonstration Document Extraction Pipeline:</strong> OCR & entity recognition simulated via Indic-BERT. Please review and correct any extracted fields below before committing verification.
          </span>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <span className="font-mono text-[11px] font-bold bg-white/80 px-2 py-0.5 rounded border border-[#c0c9be]/50">
            Case: {selectedParcel.caseNo || selectedParcel.id}
          </span>
        </div>
      </div>

      {/* Page Header Sub-bar */}
      <div className="w-full bg-[#f2f3ff] py-4 px-4 sm:px-6 lg:px-8 rounded-xl shadow-xs border border-[#c0c9be]/50">
        <div className="max-w-[1280px] mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xl text-[#003b1b] font-bold tracking-tight">
                Document AI Extraction & Field Verification
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[#92f5a4] text-[#007233] text-xs uppercase font-semibold">
                Live Pipeline v4.2
              </span>
            </div>
            <div className="text-xs text-[#404941] flex items-center gap-2 flex-wrap pt-0.5">
              <span className="font-mono font-semibold text-[#131b2e]">Doc Ref: {extraction.docRef}</span>
              <span>•</span>
              {parcels.length > 1 ? (
                <div className="inline-flex items-center gap-1.5 bg-white px-2 py-0.5 rounded border border-[#c0c9be]/60">
                  <span className="text-[11px] font-semibold text-[#717970]">Reviewing Parcel:</span>
                  <select
                    value={selectedParcel.id}
                    onChange={(e) => onSelectParcel?.(e.target.value)}
                    className="bg-transparent font-bold text-[#003b1b] text-xs focus:outline-none cursor-pointer"
                  >
                    {parcels.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.surveyNo} – {p.village} ({p.primaryOwner})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <span>Target: {selectedParcel.surveyNo} ({selectedParcel.village})</span>
              )}
              <span>•</span>
              <span className="inline-flex items-center gap-1 text-[#003b1b] font-medium">
                <span className="material-symbols-outlined text-[14px]">psychology</span>
                {extraction.engine}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap self-start lg:self-center">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#92f5a4]/60 shadow-xs border border-[#006d30]/20">
              <span
                className="material-symbols-outlined text-[#006d30] text-[20px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                verified
              </span>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-[#007233]">Extraction Quality</span>
                <span className="text-xs text-[#003b1b] font-bold">{extraction.quality}</span>
              </div>
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isScanning}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#003b1b] text-white hover:bg-[#14532d] transition-all shadow-xs text-xs font-semibold"
            >
              <span className="material-symbols-outlined text-base">upload_file</span>
              <span>Upload Document</span>
            </button>

            <button
              onClick={handleRescan}
              disabled={isScanning}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white text-[#131b2e] hover:bg-[#eaedff] transition-all shadow-xs border border-[#c0c9be]/60 text-xs font-semibold"
            >
              <span
                className={`material-symbols-outlined text-base ${isScanning ? 'animate-spin text-[#003b1b]' : ''}`}
              >
                refresh
              </span>
              <span>{isScanning ? 'Scanning...' : 'Re-scan OCR'}</span>
            </button>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3 bg-[#ffdad6] text-[#ba1a1a] rounded-xl border border-[#ba1a1a]/30 text-xs font-semibold animate-in fade-in flex items-center justify-between">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-xs underline">Dismiss</button>
        </div>
      )}

      {saveMessage && (
        <div className="p-3 bg-[#92f5a4]/30 text-[#007233] rounded-xl border border-[#006d30]/30 text-xs font-semibold animate-in fade-in flex items-center justify-between">
          <span>{saveMessage}</span>
          <button onClick={() => setSaveMessage(null)} className="text-xs underline">Dismiss</button>
        </div>
      )}

      {rejectionNotice && (
        <div className="p-3 bg-[#ffdad6] text-[#ba1a1a] rounded-xl border border-[#ba1a1a]/30 text-xs font-semibold animate-in fade-in flex items-center justify-between">
          <span>✓ Rejection dispatched to Talathi Mulshi. Fresh certified copy requested on portal.</span>
          <button onClick={() => setRejectionNotice(false)} className="text-xs underline">Dismiss</button>
        </div>
      )}

      {/* Main Split-Screen Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT SIDE: Document Viewer */}
        <section className="lg:col-span-6 flex flex-col bg-white rounded-xl shadow-xs border border-[#c0c9be]/60 overflow-hidden">
          {/* Document Toolbar Header */}
          <div className="bg-[#eaedff] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-[#c0c9be]/40">
            <div className="flex items-center gap-2 min-w-0">
              <span className="material-symbols-outlined text-[#003b1b] text-[20px]">description</span>
              <div className="flex flex-col min-w-0">
                <h2 className="text-xs font-bold text-[#131b2e] truncate">
                  Original Scanned Document: {selectedParcel.documentMeta?.fileName || '7/12 Extract'}
                </h2>
                <span className="text-[10px] text-[#404941] truncate">गाव नमुना सात / बारा (अधिकार अभिलेख पत्रक)</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center bg-white rounded-lg p-0.5 shadow-2xs border border-[#c0c9be]/50">
                <button
                  onClick={handleZoomIn}
                  className="w-7 h-7 flex items-center justify-center rounded text-[#131b2e] hover:bg-[#eaedff]"
                  title="Zoom In"
                >
                  <span className="material-symbols-outlined text-[18px]">zoom_in</span>
                </button>
                <button
                  onClick={handleZoomOut}
                  className="w-7 h-7 flex items-center justify-center rounded text-[#131b2e] hover:bg-[#eaedff]"
                  title="Zoom Out"
                >
                  <span className="material-symbols-outlined text-[18px]">zoom_out</span>
                </button>
                <button
                  onClick={handleRotate}
                  className="w-7 h-7 flex items-center justify-center rounded text-[#131b2e] hover:bg-[#eaedff]"
                  title="Rotate 90deg"
                >
                  <span className="material-symbols-outlined text-[18px]">rotate_right</span>
                </button>
                <button
                  onClick={handleFit}
                  className="w-7 h-7 flex items-center justify-center rounded text-[#131b2e] hover:bg-[#eaedff]"
                  title="Fit to Width"
                >
                  <span className="material-symbols-outlined text-[18px]">fit_screen</span>
                </button>
              </div>

              <button
                onClick={() => setBoxesVisible(!boxesVisible)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold shadow-2xs transition-colors ${
                  boxesVisible ? 'bg-[#14532d] text-[#87c695]' : 'bg-[#f2f3ff] text-[#717970]'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${boxesVisible ? 'bg-[#95f8a7]' : 'bg-[#717970]'}`} />
                <span>Boxes: {boxesVisible ? 'ON' : 'OFF'}</span>
              </button>
            </div>
          </div>

          {/* Facsimile Canvas / Viewport */}
          <div className="relative w-full h-[740px] bg-[#d2d9f4]/30 overflow-auto p-4 flex justify-center items-start select-none">
            <div
              style={{
                transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                transformOrigin: 'top center',
                transition: 'transform 0.2s ease-out',
              }}
              className="relative w-full max-w-[560px] min-h-[820px] bg-white shadow-lg p-6 flex flex-col justify-between border border-[#c0c9be]/60 rounded-md"
            >
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-5">
                <span className="material-symbols-outlined text-[340px] text-[#003b1b]">policy</span>
              </div>

              {/* Document Header */}
              <div className="relative z-10 flex flex-col items-center pb-4 text-center border-b border-[#c0c9be]/30">
                <div className="flex items-center gap-3 mb-1">
                  <img
                    className="w-10 h-10 object-contain"
                    alt="Official State Revenue emblem of Maharashtra"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuDPX4tbh19N5twLk8yHK9SuIIGyg9yYDhAImBNyYOusWlwWSwOxVTgsTdkAHRdDSjfmh6HwSe1HcbUUQz90o57TOFme_wbrtsOA9-XKi1NpKcQSVidVozSENcn1-pq5Q3PL-KScqYDxCCB9b0XiYTAd43AolpEaPGgxHRzozI7pRu7ytalwVplAK7grP7C2f58T2Qn__MvK3wP1fobZJ2WYF6Qyou2onTRwY-Bm1oGFXVdteKzFMjpJ0g"
                  />
                  <div className="text-left">
                    <span className="text-xs font-bold text-[#131b2e] uppercase block tracking-wider">
                      महाराष्ट्र शासन • महसूल व वन विभाग
                    </span>
                    <span className="font-mono text-[#717970] text-[10px] block">
                      e-Mahabhulekh Land Records System • DILRMP {selectedParcel.taluka}
                    </span>
                  </div>
                </div>

                <div className="mt-1 px-4 py-1 bg-[#eaedff] rounded-full border border-[#c0c9be]/40">
                  <span className="text-xs font-bold text-[#003b1b]">
                    गाव नमुना ७ / १२ ( अधिकार अभिलेख व पिकांची नोंदवही )
                  </span>
                </div>

                <div className="grid grid-cols-3 w-full mt-3 text-left text-[11px] text-[#404941] bg-[#f2f3ff] p-2 rounded-lg border border-[#c0c9be]/30">
                  <div><span className="font-bold text-[#131b2e]">गाव:</span> {selectedParcel.village}</div>
                  <div><span className="font-bold text-[#131b2e]">तालुका:</span> {selectedParcel.taluka}</div>
                  <div><span className="font-bold text-[#131b2e]">जिल्हा:</span> {selectedParcel.district}</div>
                </div>
              </div>

              {/* Document Facsimile Content & Annotated Bounding Boxes */}
              <div className="relative z-10 flex-1 flex flex-col gap-3 py-3 text-[#131b2e]">
                {/* Segment 1 */}
                <div className="grid grid-cols-2 gap-3 bg-white p-2.5 rounded-lg border border-[#c0c9be]/30 shadow-2xs">
                  <div className={`relative p-2 rounded border transition-all ${boxesVisible ? 'bg-[#006d30]/5 border-[#006d30]/40' : 'border-transparent'}`}>
                    {boxesVisible && (
                      <div className="absolute -top-3 left-1 bg-[#006d30] text-white px-1.5 py-0.2 rounded text-[9px] font-mono shadow-xs flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[10px]">check_circle</span>
                        [Survey No: 99%]
                      </div>
                    )}
                    <div className="text-[10px] text-[#404941] font-semibold">भूमापन क्रमांक / उपविभाग</div>
                    <div className="text-sm font-bold text-[#131b2e] mt-0.5">सर्व्हे क्र. / गट क्र.: {surveyNum}</div>
                    <div className="font-mono text-[#717970] text-[10px]">{hissa}</div>
                  </div>

                  <div className={`relative p-2 rounded border transition-all ${boxesVisible ? 'bg-[#006d30]/5 border-[#006d30]/40' : 'border-transparent'}`}>
                    {boxesVisible && (
                      <div className="absolute -top-3 left-1 bg-[#006d30] text-white px-1.5 py-0.2 rounded text-[9px] font-mono shadow-xs flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[10px]">check_circle</span>
                        [Area: 95%]
                      </div>
                    )}
                    <div className="text-[10px] text-[#404941] font-semibold">एकूण क्षेत्र (हेक्टर / आर)</div>
                    <div className="text-sm font-bold text-[#131b2e] mt-0.5">{landArea}</div>
                    <div className="font-mono text-[#717970] text-[10px]">पोटखराबा आकार: ०.०५ आर</div>
                  </div>
                </div>

                {/* Segment 2 */}
                <div className="bg-white p-2.5 rounded-lg border border-[#c0c9be]/30 shadow-2xs space-y-2">
                  <div className={`relative p-2 rounded border transition-all ${boxesVisible ? 'bg-[#006d30]/5 border-[#006d30]/40' : 'border-transparent'}`}>
                    {boxesVisible && (
                      <div className="absolute -top-3 left-1 bg-[#006d30] text-white px-1.5 py-0.2 rounded text-[9px] font-mono shadow-xs flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[10px]">check_circle</span>
                        [Owner Name: 98%]
                      </div>
                    )}
                    <div className="text-[10px] text-[#404941] font-semibold">भोगवटादाराचे नाव (खातेदार)</div>
                    <div className="text-xs font-bold text-[#003b1b] mt-0.5">
                      {ownerName}
                    </div>
                    <div className="font-mono text-[#717970] text-[10px]">
                      खाते क्रमांक: KH-881902 • फेरफार क्र.: 3912
                    </div>
                  </div>

                  <div className={`relative p-2 rounded border transition-all ${boxesVisible ? 'bg-amber-500/10 border-amber-500/60' : 'border-transparent'}`}>
                    {boxesVisible && (
                      <div className="absolute -top-3 left-1 bg-[#703a00] text-white px-1.5 py-0.2 rounded text-[9px] font-mono shadow-xs flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[10px]">warning</span>
                        [Share: 78%]
                      </div>
                    )}
                    <div className="text-[10px] text-[#703a00] font-bold">हिस्सा / अधिकार स्वरूप (Occupancy Right)</div>
                    <div className="text-xs font-bold text-[#131b2e] mt-0.5">{shareFraction}</div>
                  </div>
                </div>

                {/* Segment 3 */}
                <div className="bg-white p-2.5 rounded-lg border border-[#c0c9be]/30 shadow-2xs">
                  <div className={`relative p-2 rounded border transition-all ${boxesVisible ? 'bg-amber-500/15 border-amber-500 animate-pulse' : 'border-transparent'}`}>
                    {boxesVisible && (
                      <div className="absolute -top-3 left-1 bg-[#703a00] text-white px-1.5 py-0.2 rounded text-[9px] font-mono shadow-xs flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[10px]">shield_with_heart</span>
                        [Encumbrance: 74%]
                      </div>
                    )}
                    <div className="text-[10px] text-[#703a00] font-bold">इतर हक्क व बोजा (Liabilities & Other Rights)</div>
                    <div className="text-xs font-bold text-[#131b2e] mt-0.5">{encumbrances}</div>
                  </div>
                </div>

                <div className="bg-[#f2f3ff] p-2 rounded-lg text-[10px] text-[#404941] flex items-center justify-between border border-[#c0c9be]/30">
                  <span>पिकाखालील क्षेत्र: खरीप हंगाम</span>
                  <span className="font-mono text-[#006d30] font-medium">Digitally Signed by Talathi Office</span>
                </div>
              </div>

              <div className="relative z-10 pt-3 flex items-center justify-between text-[10px] text-[#717970] border-t border-[#c0c9be]/30">
                <span className="font-mono">MD5: e7f8b91a0c4...9921</span>
                <span className="font-mono">24-OCT-2024 11:28 IST</span>
              </div>
            </div>
          </div>
        </section>

        {/* RIGHT SIDE: Structured Field Verification Form */}
        <section className="lg:col-span-6 flex flex-col bg-white rounded-xl shadow-xs border border-[#c0c9be]/60 overflow-hidden">
          <div className="bg-[#eaedff] px-4 py-2.5 flex items-center justify-between border-b border-[#c0c9be]/40">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#003b1b] text-[20px]">fact_check</span>
              <div className="flex flex-col">
                <h2 className="text-xs font-bold text-[#131b2e]">Structured Field Verification & Manual Audit</h2>
                <span className="text-[10px] text-[#404941]">
                  Review and correct extracted values to synchronize to case record
                </span>
              </div>
            </div>
            <button
              onClick={handleSaveFields}
              className="px-2.5 py-1 bg-white border border-[#c0c9be] text-[#003b1b] hover:bg-[#f2f3ff] text-[11px] font-bold rounded-lg shadow-2xs"
            >
              Save Edits
            </button>
          </div>

          <div className="p-5 flex flex-col gap-4 max-h-[740px] overflow-y-auto">
            {/* FIELD 1: Primary Owner Name */}
            <div className="flex flex-col gap-1 p-3 rounded-xl bg-white hover:bg-[#f2f3ff] transition-colors border border-[#c0c9be]/50 shadow-2xs">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-bold text-[#131b2e]" htmlFor="field-owner">
                  Primary Owner Name (खातेदाराचे नाव)
                </label>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#92f5a4] text-[#007233] text-[10px] font-bold">
                  <span className="material-symbols-outlined text-[12px]">check_circle</span>
                  98% High Confidence
                </span>
              </div>
              <div className="relative">
                <input
                  id="field-owner"
                  type="text"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full h-10 px-3 pr-16 rounded-lg bg-[#faf8ff] text-xs font-medium text-[#131b2e] border border-[#c0c9be] focus:outline-none focus:ring-2 focus:ring-[#006d30]"
                />
              </div>
            </div>

            {/* FIELD 2: Survey / Gat Number */}
            <div className="flex flex-col gap-1 p-3 rounded-xl bg-white hover:bg-[#f2f3ff] transition-colors border border-[#c0c9be]/50 shadow-2xs">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-bold text-[#131b2e]" htmlFor="field-survey">
                  Survey / Gat Number (सर्व्हे / गट क्रमांक)
                </label>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#92f5a4] text-[#007233] text-[10px] font-bold">
                  <span className="material-symbols-outlined text-[12px]">verified</span>
                  99% Exact Match
                </span>
              </div>
              <input
                id="field-survey"
                type="text"
                value={surveyNum}
                onChange={(e) => setSurveyNum(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-[#faf8ff] text-xs font-bold text-[#131b2e] border border-[#c0c9be] focus:outline-none focus:ring-2 focus:ring-[#006d30]"
              />
            </div>

            {/* FIELD 3: Gat Sub-division / Hissa */}
            <div className="flex flex-col gap-1 p-3 rounded-xl bg-white hover:bg-[#f2f3ff] transition-colors border border-[#c0c9be]/50 shadow-2xs">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-bold text-[#131b2e]" htmlFor="field-hissa">
                  Gat Sub-division / Hissa (पोट हिस्सा)
                </label>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#92f5a4] text-[#007233] text-[10px] font-bold">
                  <span className="material-symbols-outlined text-[12px]">check_circle</span>
                  91% Verified
                </span>
              </div>
              <input
                id="field-hissa"
                type="text"
                value={hissa}
                onChange={(e) => setHissa(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-[#faf8ff] text-xs font-medium text-[#131b2e] border border-[#c0c9be] focus:outline-none focus:ring-2 focus:ring-[#006d30]"
              />
            </div>

            {/* FIELD 4: Total Land Area */}
            <div className="flex flex-col gap-1 p-3 rounded-xl bg-white hover:bg-[#f2f3ff] transition-colors border border-[#c0c9be]/50 shadow-2xs">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-bold text-[#131b2e]" htmlFor="field-area">
                  Total Land Area (एकूण क्षेत्र - Hectare / Are)
                </label>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#92f5a4] text-[#007233] text-[10px] font-bold">
                  <span className="material-symbols-outlined text-[12px]">check_circle</span>
                  95% High Confidence
                </span>
              </div>
              <input
                id="field-area"
                type="text"
                value={landArea}
                onChange={(e) => setLandArea(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-[#faf8ff] text-xs font-medium text-[#131b2e] border border-[#c0c9be] focus:outline-none focus:ring-2 focus:ring-[#006d30]"
              />
            </div>

            {/* FIELD 5: Ownership Share Fractions */}
            <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-[#ffdcc3]/35 border border-[#ffdcc3] shadow-xs">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-bold text-[#703a00] flex items-center gap-1" htmlFor="field-share">
                  <span className="material-symbols-outlined text-base text-[#703a00]">warning</span>
                  Ownership Share Fractions (धारण प्रकार व हिस्सा)
                </label>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#703a00] text-[#ffa14e] text-[10px] font-bold">
                  <span className="material-symbols-outlined text-[12px]">priority_high</span>
                  78% Review Required
                </span>
              </div>
              <input
                id="field-share"
                type="text"
                value={shareFraction}
                onChange={(e) => setShareFraction(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-white text-xs font-medium text-[#131b2e] border border-[#703a00]/40 focus:outline-none focus:ring-2 focus:ring-[#703a00]"
              />
            </div>

            {/* FIELD 6: Encumbrances / Bank Charges */}
            <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-[#ffdcc3]/35 border border-[#ffdcc3] shadow-xs">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-bold text-[#703a00] flex items-center gap-1" htmlFor="field-encumbrance">
                  <span className="material-symbols-outlined text-base text-[#703a00]">lock_clock</span>
                  Encumbrances / Bank Charges (इतर हक्क व बोजा)
                </label>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#703a00] text-[#ffa14e] text-[10px] font-bold">
                  <span className="material-symbols-outlined text-[12px]">error</span>
                  74% Moderate Confidence
                </span>
              </div>
              <input
                id="field-encumbrance"
                type="text"
                value={encumbrances}
                onChange={(e) => setEncumbrances(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-white text-xs font-medium text-[#131b2e] border border-[#703a00]/40 focus:outline-none focus:ring-2 focus:ring-[#703a00]"
              />
            </div>
          </div>
        </section>
      </div>

      {/* Bottom Action Dock */}
      <footer className="w-full bg-white shadow-[0_-4px_12px_rgba(0,0,0,0.06)] py-3.5 px-4 sm:px-6 lg:px-8 rounded-xl border border-[#c0c9be]/50">
        <div className="max-w-[1280px] mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-[#006d30] animate-pulse" />
            <div className="flex flex-col">
              <span className="text-xs font-bold text-[#131b2e]">
                Connected to Active Case: {selectedParcel.surveyNo} ({selectedParcel.caseNo || selectedParcel.id})
              </span>
              <span className="font-mono text-[10px] text-[#717970]">
                Logged to DILRMP Pune Revenue Node • Status: {selectedParcel.caseStatus}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <button
              type="button"
              onClick={handleReject}
              className="px-3.5 py-2 rounded-lg bg-[#f2f3ff] text-[#131b2e] hover:bg-[#eaedff] transition-colors text-xs font-semibold shadow-2xs border border-[#c0c9be]/60"
            >
              Reject & Request Re-upload
            </button>
            <button
              type="button"
              onClick={handleConfirmAndRun}
              disabled={isVerifying}
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[#14532d] text-[#87c695] hover:bg-[#003b1b] hover:text-white transition-all text-xs font-bold shadow-sm"
            >
              {isVerifying ? (
                <>
                  <span className="material-symbols-outlined text-base animate-spin">sync</span>
                  <span>Verifying Cadastral Coordinates...</span>
                </>
              ) : (
                <>
                  <span>Confirm and Run Verification Checks (तपासणी सुरू करा)</span>
                  <span className="material-symbols-outlined text-base">arrow_forward</span>
                </>
              )}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

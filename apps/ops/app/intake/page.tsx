"use client";

/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, react-hooks/exhaustive-deps, react/no-unescaped-entities */

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useWarehouse } from "../context/WarehouseContext";
import { 
  ArrowLeft, 
  ArrowRight, 
  User, 
  AlertTriangle,
  Info,
  Camera,
  ImagePlus,
  X
} from "lucide-react";
import type { ProduceGrade } from "@kuapa-dwaso/types";
import { useOpsAuth } from "../auth/OpsAuthProvider";
import { uploadEvidenceFile } from "../evidenceUpload";

export default function IntakePage() {
  const router = useRouter();
  const { firebaseUser } = useOpsAuth();
  const { 
    farmers, 
    addIntake, 
    draftIntake, 
    setDraftIntake,
    isOffline,
    activeWarehouse,
    assignedWarehouses,
    storageRateRules,
    errorMessage
  } = useWarehouse();

  // Stepper state
  const [step, setStep] = useState(1);

  // Form Fields
  const [selectedFarmerId, setSelectedFarmerId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  
  const [cropType, setCropType] = useState("");
  const [variety, setVariety] = useState("");
  const [grade, setGrade] = useState<ProduceGrade>("A");
  const [conditionNotes, setConditionNotes] = useState("");

  const [quantity, setQuantity] = useState(50);
  const [unit, setUnit] = useState("bag");
  const [receivedDate, setReceivedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  
  // Shelf life selection
  const [shelfLifeDays, setShelfLifeDays] = useState<number>(14);
  const [customShelfLife, setCustomShelfLife] = useState(false);

  // Storage Rate
  const [storageRate, setStorageRate] = useState(0.15);
  const [storageRateRuleId, setStorageRateRuleId] = useState("");

  // Money
  const [askingPrice, setAskingPrice] = useState("");
  const [minimumPrice, setMinimumPrice] = useState("");

  // Search Farmers inline (for Step 1 if not arrived via lookup)
  const [searchQuery, setSearchQuery] = useState("");

  // Submit states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoAssetId, setPhotoAssetId] = useState<string>();
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoUploadError, setPhotoUploadError] = useState("");
  const photoPreviewUrl = useMemo(() => photoFile === null ? undefined : URL.createObjectURL(photoFile), [photoFile]);

  useEffect(() => () => {
    if (photoPreviewUrl !== undefined) URL.revokeObjectURL(photoPreviewUrl);
  }, [photoPreviewUrl]);

  const handlePhotoSelection = async (file: File | null) => {
    setPhotoFile(file);
    setPhotoAssetId(undefined);
    setPhotoUploadError("");
    if (file === null) return;
    setIsUploadingPhoto(true);
    try {
      const assetId = await uploadEvidenceFile({
        firebaseUser,
        file,
        purpose: "produce_intake_photo",
        accessLevel: "public_read",
      });
      setPhotoAssetId(assetId);
    } catch (error) {
      setPhotoUploadError(error instanceof Error ? error.message : "Could not upload the produce photo.");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // Crop-to-variety lists
  const varietiesByCrop: Record<string, string[]> = {
    Maize: ["Obatanpa Quality Protein Maize", "Standard Yellow Maize", "Mamaba", "Golden Jubilee"],
    Cocoa: ["West African Amelonado", "Hybrid Cocoa Tetteh Quarshie", "Amazonian Cocoa"],
    Cassava: ["Bankye Hemaa", "Ampong", "Sika Bankye"],
    Yam: ["Pona", "Laribako", "Dente", "Water Yam"],
    Tomato: ["Power Rasta", "Pectomech", "Roma"]
  };

  // Preset condition tag chips
  const conditionChips = [
    "Slightly bruised", 
    "Wet / high moisture", 
    "Mixed sizes", 
    "Well dried", 
    "Insect damage free"
  ];

  // 1. Hydrate from draft if available
  useEffect(() => {
    if (draftIntake) {
      if (draftIntake.farmerId) setSelectedFarmerId(draftIntake.farmerId);
      if (draftIntake.warehouseId) setWarehouseId(draftIntake.warehouseId);
      if (draftIntake.cropType) setCropType(draftIntake.cropType);
      if (draftIntake.variety) setVariety(draftIntake.variety);
      if (draftIntake.grade) setGrade(draftIntake.grade);
      if (draftIntake.conditionNotes) setConditionNotes(draftIntake.conditionNotes);
      if (draftIntake.quantity) setQuantity(draftIntake.quantity);
      if (draftIntake.unit) setUnit(draftIntake.unit);
      if (draftIntake.receivedDate) setReceivedDate(draftIntake.receivedDate);
      if (draftIntake.shelfLifeDays) setShelfLifeDays(draftIntake.shelfLifeDays);
      if (draftIntake.storageRate) setStorageRate(draftIntake.storageRate);
      if (draftIntake.storageRateRuleId) setStorageRateRuleId(draftIntake.storageRateRuleId);
      if (draftIntake.askingPrice) setAskingPrice(draftIntake.askingPrice);
      if (draftIntake.minimumPrice) setMinimumPrice(draftIntake.minimumPrice);
      
      // Allow route prefill to drive active step
      if (draftIntake.step) setStep(draftIntake.step);
    }
  }, [draftIntake]);

  useEffect(() => {
    if (!warehouseId && activeWarehouse.id !== "unassigned") {
      setWarehouseId(activeWarehouse.id);
    }
  }, [activeWarehouse.id, warehouseId]);

  // 2. Auto-set default storage rate and variety when crop type changes
  useEffect(() => {
    if (cropType) {
      // Default varieties
      const varieties = varietiesByCrop[cropType] || [];
      if (varieties.length > 0 && !variety) {
        setVariety(varieties[0] || "");
      }

      // Default rates
      let rate = 0.05; // Standard default rate for tubers/cassava
      if (cropType.toLowerCase() === "cocoa") {
        rate = 0.50;
      } else if (cropType.toLowerCase() === "maize") {
        rate = 0.15;
      }
      setStorageRate(rate);
    }
  }, [cropType]);

  // 3. Cache drafts on page updates
  const saveDraft = (nextStep: number) => {
    setDraftIntake({
      farmerId: selectedFarmerId,
      warehouseId,
      cropType,
      variety,
      grade,
      conditionNotes,
      quantity,
      unit,
      receivedDate,
      shelfLifeDays,
      storageRate,
      storageRateRuleId,
      askingPrice,
      minimumPrice,
      step: nextStep
    });
    setStep(nextStep);
  };

  const selectedFarmer = farmers.find(f => f.id === selectedFarmerId);
  const selectedStorageRateRule = storageRateRules.find(rule => rule.id === storageRateRuleId);

  // Dynamic filter for inline farmer search
  const filteredFarmers = searchQuery
    ? farmers.filter(f => 
        f.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
        f.phoneNumber.includes(searchQuery) ||
        f.farmerCode.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : farmers.slice(0, 3);

  // Increment/Decrement Stepper Handlers
  const handleQuantityIncrement = () => {
    setQuantity(q => q + (unit === "bag" ? 5 : 1));
  };

  const handleQuantityDecrement = () => {
    setQuantity(q => Math.max(1, q - (unit === "bag" ? 5 : 1)));
  };

  const handleChipClick = (chip: string) => {
    setConditionNotes(prev => {
      const trimmed = prev.trim();
      if (!trimmed) return chip;
      if (trimmed.includes(chip)) return prev;
      return `${trimmed}, ${chip}`;
    });
  };

  // Compute sell-by date dynamically based on shelf life selection
  const computedSellByDate = () => {
    const baseDate = new Date(receivedDate || "");
    baseDate.setDate(baseDate.getDate() + shelfLifeDays);
    return baseDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  };

  const handleSubmit = () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError("");

    // Calculate dates
    const receivedTime = new Date(receivedDate || "").getTime();
    const sellByTime = receivedTime + shelfLifeDays * 24 * 60 * 60 * 1000;

    const intakePayload: any = {
      farmerId: selectedFarmerId,
      warehouseId,
      cropType,
      variety,
      grade,
      quantityReceived: quantity,
      quantityAvailable: quantity,
      unit,
      receivedAt: receivedTime,
      expectedShelfLifeDays: shelfLifeDays,
      sellByDate: sellByTime,
      manualStorageRatePerUnitPerDay: storageRate,
      storageRateCurrency: "GHS",
    };
    if (storageRateRuleId) {
      intakePayload.storageRateRuleId = storageRateRuleId;
      delete intakePayload.manualStorageRatePerUnitPerDay;
    }
    if (conditionNotes && conditionNotes.trim()) {
      intakePayload.conditionNotes = conditionNotes.trim();
    }
    if (askingPrice) {
      intakePayload.askingPricePerUnit = parseFloat(askingPrice);
    }
    if (minimumPrice) {
      intakePayload.minimumPricePerUnit = parseFloat(minimumPrice);
    }
    if (photoAssetId !== undefined) intakePayload.photos = [photoAssetId];
    void addIntake(intakePayload)
      .then((batch) => {
        router.push(`/receipts/${batch.id}`);
      })
      .catch((error: unknown) => {
        setSubmitError(error instanceof Error ? error.message : "Could not create intake receipt.");
      })
      .finally(() => setIsSubmitting(false));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      
      {/* Stepper Header Progress */}
      <div className="stepper-header">
        <button 
          type="button" 
          className="modal-close"
          style={{ width: "40px", height: "40px", backgroundColor: "var(--color-surface-raised)" }}
          onClick={() => {
            if (step > 1) {
              saveDraft(step - 1);
            } else {
              router.push("/");
            }
          }}
        >
          <ArrowLeft size={20} />
        </button>
        
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div className="step-title">Produce Intake</div>
          <div style={{ fontSize: "12px", color: "var(--gray-500)", fontWeight: "600", marginTop: "2px" }}>
            Step {step} of 4
          </div>
        </div>

        <div className="step-indicator">
          {[1, 2, 3, 4].map(idx => (
            <div 
              key={idx} 
              className={`step-dot ${idx === step ? "active" : idx < step ? "completed" : ""}`} 
            />
          ))}
        </div>
      </div>

      {/* STEP 1: Farmer & Location */}
      {step === 1 && (
        <div className="step-container">
          <div className="section-card" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h2 className="detail-section-title">1. Identify Producer</h2>

            {selectedFarmer ? (
              /* Preselected Farmer Card */
              <div style={{ 
                border: "2px solid var(--color-field)", 
                backgroundColor: "var(--color-success-bg)", 
                borderRadius: "10px", 
                padding: "16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "50%", backgroundColor: "var(--color-surface-raised)", color: "var(--color-field)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>
                    <User size={20} />
                  </div>
                  <div>
                    <div style={{ fontWeight: "700", color: "var(--color-field-dark)" }}>{selectedFarmer.fullName}</div>
                    <div style={{ fontSize: "13px", color: "var(--gray-600)" }}>{selectedFarmer.phoneNumber} · {selectedFarmer.community}</div>
                  </div>
                </div>
                <button 
                  type="button" 
                  className="btn btn-outline" 
                  style={{ width: "auto", height: "36px", padding: "0 12px", fontSize: "13px" }}
                  onClick={() => setSelectedFarmerId("")}
                >
                  Change
                </button>
              </div>
            ) : (
              /* Inline Search Picker */
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Search farmer name, phone, or code..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {filteredFarmers.map(farmer => (
                    <div 
                      key={farmer.id}
                      style={{ 
                        border: "1px solid var(--color-line)", 
                        padding: "12px", 
                        borderRadius: "8px", 
                        cursor: "pointer", 
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        backgroundColor: "var(--color-surface-raised)"
                      }}
                      onClick={() => setSelectedFarmerId(farmer.id)}
                    >
                      <div>
                        <div style={{ fontWeight: "700" }}>{farmer.fullName}</div>
                        <div style={{ fontSize: "12px", color: "var(--gray-500)" }}>{farmer.phoneNumber} · {farmer.community}</div>
                      </div>
                      <div className="code-chip" style={{ fontSize: "11px" }}>{farmer.farmerCode}</div>
                    </div>
                  ))}
                </div>

                <div style={{ borderTop: "1px solid var(--color-line)", paddingTop: "12px", textAlign: "center" }}>
                  <Link href="/farmers">
                    <span style={{ fontSize: "14px", fontWeight: "700", color: "var(--color-field)", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                      Register New Farmer if not found
                      <ArrowRight size={16} />
                    </span>
                  </Link>
                </div>
              </div>
            )}
          </div>

          <div className="section-card" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <h2 className="detail-section-title">2. Receiving Warehouse</h2>
            <div className="form-group">
              <label className="form-label" htmlFor="warehouseSelect">Select Facility</label>
              <select 
                id="warehouseSelect"
                className="form-select"
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
              >
                {assignedWarehouses.map(warehouse => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}{warehouse.id === activeWarehouse.id ? " (current)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: "12px" }}
            disabled={!selectedFarmerId}
            onClick={() => saveDraft(2)}
          >
            <span>Continue to Crop Details</span>
            <ArrowRight size={18} />
          </button>
        </div>
      )}

      {/* STEP 2: Produce Info */}
      {step === 2 && (
        <div className="step-container">
          <div className="section-card" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h2 className="detail-section-title">1. Select Crop Type</h2>
            
            {/* Visual Grid Selector */}
            <div className="tile-grid">
              {[
                { name: "Maize", emoji: "🌽" },
                { name: "Cocoa", emoji: "🍫" },
                { name: "Cassava", emoji: "🍠" },
                { name: "Yam", emoji: "🥔" },
                { name: "Tomato", emoji: "🍅" }
              ].map(crop => (
                <div 
                  key={crop.name}
                  className={`tile ${cropType === crop.name ? "active" : ""}`}
                  onClick={() => {
                    setCropType(crop.name);
                    setVariety("");
                  }}
                >
                  <span className="tile-icon">{crop.emoji}</span>
                  <span className="tile-label">{crop.name}</span>
                </div>
              ))}
            </div>
          </div>

          {cropType && (
            <div className="section-card" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <h2 className="detail-section-title">2. Variety & Quality Grade</h2>
              
              <div className="form-group">
                <label className="form-label" htmlFor="varietySelect">Crop Variety</label>
                <select 
                  id="varietySelect"
                  className="form-select"
                  value={variety}
                  onChange={(e) => setVariety(e.target.value)}
                >
                  {varietiesByCrop[cropType]?.map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                  <option value="Other / Mixed">Other / Mixed</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Produce Grade</label>
                <div className="segmented-control">
                  {(["A", "B", "C"] as ProduceGrade[]).map(g => (
                    <button 
                      key={g} 
                      type="button" 
                      className={`segment-btn ${grade === g ? "active" : ""}`}
                      onClick={() => setGrade(g)}
                    >
                      Grade {g}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="conditionText">Quality / Condition Notes</label>
                <textarea 
                  id="conditionText"
                  className="form-textarea" 
                  placeholder="Describe quality issues, moisture levels, etc..."
                  value={conditionNotes}
                  onChange={(e) => setConditionNotes(e.target.value)}
                />
                
                {/* Condition tags */}
                <div className="chips-row" style={{ marginTop: "4px" }}>
                  {conditionChips.map(chip => (
                    <button 
                      key={chip} 
                      type="button" 
                      className="chip-btn" 
                      onClick={() => handleChipClick(chip)}
                    >
                      + {chip}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <button 
            type="button" 
            className="btn btn-primary" 
            style={{ marginTop: "12px" }}
            disabled={!cropType}
            onClick={() => saveDraft(3)}
          >
            <span>Continue to Quantity</span>
            <ArrowRight size={18} />
          </button>
        </div>
      )}

      {/* STEP 3: Quantity & Rate Calculation */}
      {step === 3 && (
        <div className="step-container">
          <div className="section-card" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h2 className="detail-section-title">1. Intake Quantity</h2>
            
            <div className="form-group">
              <label className="form-label">Quantity received</label>
              <div className="counter-widget">
                <button type="button" className="counter-btn" onClick={handleQuantityDecrement}>−</button>
                <input 
                  type="number" 
                  className="counter-value" 
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 0))}
                  aria-label="Produce Quantity"
                />
                <button type="button" className="counter-btn" onClick={handleQuantityIncrement}>+</button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Measurement Unit</label>
              <div className="segmented-control">
                {["bag", "kg", "crate", "tubers"].map(u => (
                  <button 
                    key={u} 
                    type="button" 
                    className={`segment-btn ${unit === u ? "active" : ""}`}
                    onClick={() => setUnit(u)}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="section-card" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h2 className="detail-section-title">2. Storage Accruals</h2>

            <div className="form-group">
              <label className="form-label" htmlFor="receivedDate">Date Received</label>
              <div style={{ position: "relative" }}>
                <input 
                  id="receivedDate"
                  type="date" 
                  className="form-input" 
                  value={receivedDate}
                  onChange={(e) => setReceivedDate(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Estimated Shelf Life</label>
              <div className="chips-row">
                {[3, 7, 14, 30].map(days => (
                  <button 
                    key={days} 
                    type="button" 
                    className={`chip-btn ${shelfLifeDays === days && !customShelfLife ? "active" : ""}`}
                    onClick={() => {
                      setShelfLifeDays(days);
                      setCustomShelfLife(false);
                    }}
                  >
                    {days} Days
                  </button>
                ))}
                <button 
                  type="button" 
                  className={`chip-btn ${customShelfLife ? "active" : ""}`}
                  onClick={() => setCustomShelfLife(true)}
                >
                  Custom
                </button>
              </div>
              
              {customShelfLife && (
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "8px" }}>
                  <input 
                    type="number" 
                    className="form-input" 
                    style={{ width: "100px" }}
                    value={shelfLifeDays}
                    onChange={(e) => setShelfLifeDays(Math.max(1, parseInt(e.target.value) || 0))}
                  />
                  <span>days</span>
                </div>
              )}
              
              <div style={{ fontSize: "14px", color: "var(--gray-600)", fontWeight: "600", marginTop: "4px" }}>
                Sell-by date computed: <strong style={{ color: "var(--color-ink)" }}>{computedSellByDate()}</strong>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="storageRate">Storage Fee Rate (GHS)</label>
              {storageRateRules.length > 0 && (
                <select
                  className="form-select"
                  value={storageRateRuleId}
                  onChange={(e) => {
                    const nextRuleId = e.target.value;
                    setStorageRateRuleId(nextRuleId);
                    const rule = storageRateRules.find(item => item.id === nextRuleId);
                    if (rule) {
                      setStorageRate(rule.ratePerUnitPerDay);
                    }
                  }}
                  style={{ marginBottom: "8px" }}
                  aria-label="Storage rate rule"
                >
                  <option value="">Manual rate</option>
                  {storageRateRules
                    .filter(rule => (!rule.cropType || rule.cropType === cropType) && rule.unit === unit && (!rule.grade || rule.grade === grade))
                    .map(rule => (
                      <option key={rule.id} value={rule.id}>
                        {rule.cropType || "Any crop"} / {rule.unit} / {rule.grade || "any grade"} - GHS {rule.ratePerUnitPerDay.toFixed(2)}
                      </option>
                    ))}
                </select>
              )}
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", fontWeight: "700" }}>GHS</span>
                <input 
                  id="storageRate"
                  type="number" 
                  step="0.01"
                  className="form-input" 
                  style={{ paddingLeft: "54px" }}
                  value={storageRate}
                  onChange={(e) => setStorageRate(Math.max(0, parseFloat(e.target.value) || 0))}
                />
              </div>
              <div style={{ fontSize: "13px", color: "var(--gray-500)", marginTop: "4px" }}>
                Applied: GHS {storageRate.toFixed(2)} per {unit} per day{selectedStorageRateRule ? " from active storage rule." : "."}
              </div>
            </div>
          </div>

          <div className="section-card" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h2 className="detail-section-title">3. Pricing Terms</h2>
            
            <div className="form-group">
              <label className="form-label" htmlFor="askingPrice">Asking Price per unit (Optional)</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", fontWeight: "700" }}>GHS</span>
                <input 
                  id="askingPrice"
                  type="number" 
                  className="form-input" 
                  style={{ paddingLeft: "54px" }}
                  placeholder="e.g. 250"
                  value={askingPrice}
                  onChange={(e) => setAskingPrice(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="minimumPrice">Minimum Price per unit (Optional)</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", fontWeight: "700" }}>GHS</span>
                <input 
                  id="minimumPrice"
                  type="number" 
                  className="form-input" 
                  style={{ paddingLeft: "54px" }}
                  placeholder="e.g. 220"
                  value={minimumPrice}
                  onChange={(e) => setMinimumPrice(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="section-card" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start" }}>
              <div>
                <h2 className="detail-section-title"><Camera size={18} /> 4. Produce photo</h2>
                <p style={{ margin: "6px 0 0", color: "var(--gray-600)", fontSize: "14px" }}>Optional. Upload it now so it is ready before you review and confirm the intake.</p>
              </div>
              <span className="badge">Optional</span>
            </div>
            {photoPreviewUrl === undefined ? (
              <label className="btn btn-outline" style={{ cursor: "pointer", minHeight: "52px" }}>
                <ImagePlus size={19} /> Take or choose photo
                <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden onChange={(event) => void handlePhotoSelection(event.target.files?.[0] ?? null)} />
              </label>
            ) : (
              <div style={{ position: "relative", overflow: "hidden", borderRadius: "14px", border: "1px solid var(--color-line)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoPreviewUrl} alt="Produce preview" style={{ width: "100%", maxHeight: "260px", objectFit: "cover", display: "block" }} />
                <button type="button" className="modal-close" aria-label="Remove photo" disabled={isUploadingPhoto} onClick={() => void handlePhotoSelection(null)} style={{ position: "absolute", right: "10px", top: "10px", background: "white" }}><X size={18} /></button>
              </div>
            )}
            {isUploadingPhoto ? <div className="offline-banner" style={{ margin: 0 }}><Info size={16} /><span>Uploading photo before review…</span></div> : null}
            {photoAssetId !== undefined ? <div style={{ color: "var(--color-success)", fontWeight: 700, fontSize: "14px" }}>Photo uploaded and ready for this intake.</div> : null}
            {photoUploadError ? <div className="offline-banner" style={{ margin: 0, backgroundColor: "var(--color-danger-bg)", color: "var(--color-danger)", borderColor: "var(--color-danger-border)" }}><AlertTriangle size={16} /><span>{photoUploadError} Choose the photo again to retry, or remove it to continue without one.</span></div> : null}
          </div>

          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: "12px" }}
            disabled={isUploadingPhoto || (photoFile !== null && photoAssetId === undefined)}
            onClick={() => saveDraft(4)}
          >
            <span>Review Receipt Preview</span>
            <ArrowRight size={18} />
          </button>
        </div>
      )}

      {/* STEP 4: Confirm with Farmer */}
      {step === 4 && (
        <div className="step-container">
          <div className="receipt-ticket">
            <div className="receipt-ticket-dashed" />
            <div className="receipt-header">
              <div style={{ fontSize: "14px", fontWeight: "700", textTransform: "uppercase", color: "var(--gray-400)", letterSpacing: "0.05em" }}>
                Intake Verification
              </div>
              <div style={{ fontSize: "32px", fontWeight: "800", color: "var(--color-field-dark)" }}>
                {cropType}
              </div>
              <span className="badge badge-success">
                Grade {grade}
              </span>
            </div>

            <div className="receipt-body">
              <div className="receipt-fact-grid">
                <div className="fact-item">
                  <span className="fact-label">Farmer Name</span>
                  <span className="fact-value">{selectedFarmer?.fullName}</span>
                </div>
                <div className="fact-item">
                  <span className="fact-label">Phone Number</span>
                  <span className="fact-value">{selectedFarmer?.phoneNumber}</span>
                </div>
                <div className="fact-item" style={{ gridColumn: "span 2" }}>
                  <span className="fact-label">Variety Details</span>
                  <span className="fact-value">{variety}</span>
                </div>
                <div className="fact-item">
                  <span className="fact-label">Total Quantity</span>
                  <span className="fact-value-large">{quantity} <span style={{ fontSize: "16px", fontWeight: "600" }}>{unit}s</span></span>
                </div>
                <div className="fact-item">
                  <span className="fact-label">Storage Rate</span>
                  <span className="fact-value">GHS {storageRate.toFixed(2)}/day</span>
                </div>
                <div className="fact-item">
                  <span className="fact-label">Received Date</span>
                  <span className="fact-value">{new Date(receivedDate || "").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                </div>
                <div className="fact-item">
                  <span className="fact-label">Sell-By Date</span>
                  <span className="fact-value">{computedSellByDate()}</span>
                </div>
                <div className="fact-item">
                  <span className="fact-label">Asking Price</span>
                  <span className="fact-value">{askingPrice ? `GHS ${parseFloat(askingPrice).toFixed(2)}` : "Not specified"}</span>
                </div>
                <div className="fact-item">
                  <span className="fact-label">Minimum Price</span>
                  <span className="fact-value">{minimumPrice ? `GHS ${parseFloat(minimumPrice).toFixed(2)}` : "Not specified"}</span>
                </div>
              </div>

              {conditionNotes && (
                <div style={{ marginTop: "16px", borderTop: "1px solid var(--color-line)", paddingTop: "12px" }}>
                  <div className="fact-label" style={{ marginBottom: "4px" }}>Condition Notes</div>
                  <div style={{ fontSize: "14px", color: "var(--gray-700)", fontStyle: "italic" }}>
                    "{conditionNotes}"
                  </div>
                </div>
              )}

              <div className="receipt-callout">
                <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                  <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
                  <span>Confirm these collection details with the farmer. Physical copy or SMS notification will be generated upon commitment.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Offline alert context */}
          {isOffline && (
            <div className="offline-banner" style={{ margin: "0" }}>
              <Info size={16} />
              <span>Offline Mode active: This receipt will be cached locally and synced automatically when back online.</span>
            </div>
          )}

          {(submitError || errorMessage) && (
            <div className="offline-banner" style={{ margin: "0", backgroundColor: "var(--color-danger-bg)", color: "var(--color-danger)", borderColor: "var(--color-danger-border)" }}>
              <AlertTriangle size={16} />
              <span>{submitError || errorMessage}</span>
            </div>
          )}

          <button 
            type="button" 
            className="btn btn-primary" 
            style={{ height: "56px", fontSize: "18px" }}
            disabled={isSubmitting || activeWarehouse.id === "unassigned"}
            onClick={handleSubmit}
          >
            {isSubmitting ? (
              <span>Creating Receipt...</span>
            ) : (
              <span>Confirm & Create Receipt</span>
            )}
          </button>
        </div>
      )}

    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useWarehouse } from "../context/WarehouseContext";
import { 
  ArrowLeft, 
  ArrowRight, 
  User, 
  AlertTriangle,
  Info
} from "lucide-react";
import type { ProduceGrade } from "@kuapa-dwaso/types";

export default function IntakePage() {
  const router = useRouter();
  const { 
    farmers, 
    addIntake, 
    draftIntake, 
    setDraftIntake,
    isOffline
  } = useWarehouse();

  // Stepper state
  const [step, setStep] = useState(1);

  // Form Fields
  const [selectedFarmerId, setSelectedFarmerId] = useState("");
  const [warehouseId, setWarehouseId] = useState("wh-1");
  
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

  // Money
  const [askingPrice, setAskingPrice] = useState("");
  const [minimumPrice, setMinimumPrice] = useState("");

  // Search Farmers inline (for Step 1 if not arrived via lookup)
  const [searchQuery, setSearchQuery] = useState("");

  // Submit states
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      if (draftIntake.askingPrice) setAskingPrice(draftIntake.askingPrice);
      if (draftIntake.minimumPrice) setMinimumPrice(draftIntake.minimumPrice);
      
      // Allow route prefill to drive active step
      if (draftIntake.step) setStep(draftIntake.step);
    }
  }, [draftIntake]);

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
      askingPrice,
      minimumPrice,
      step: nextStep
    });
    setStep(nextStep);
  };

  const selectedFarmer = farmers.find(f => f.id === selectedFarmerId);

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

    // Calculate dates
    const receivedTime = new Date(receivedDate || "").getTime();
    const sellByTime = receivedTime + shelfLifeDays * 24 * 60 * 60 * 1000;

    // Simulate 1.5s pressed/loading state
    setTimeout(() => {
      const intakePayload: any = {
        farmerId: selectedFarmerId,
        cropType,
        variety,
        grade,
        quantityReceived: quantity,
        quantityAvailable: quantity,
        unit,
        receivedAt: receivedTime,
        expectedShelfLifeDays: shelfLifeDays,
        sellByDate: sellByTime,
      };
      if (conditionNotes && conditionNotes.trim()) {
        intakePayload.conditionNotes = conditionNotes.trim();
      }
      if (askingPrice) {
        intakePayload.askingPricePerUnit = parseFloat(askingPrice);
      }
      if (minimumPrice) {
        intakePayload.minimumPricePerUnit = parseFloat(minimumPrice);
      }
      const batch = addIntake(intakePayload);

      setIsSubmitting(false);
      // Navigate directly to the receipt layout
      router.push(`/receipts/${batch.id}`);
    }, 1500);
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
                <option value="wh-1">Kumasi Central Warehouse (current)</option>
                <option value="wh-2">Sunyani Transit Depot</option>
                <option value="wh-3">Tamale Silo Terminal</option>
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
                Applied: GHS {storageRate.toFixed(2)} per {unit} per day.
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

          <button 
            type="button" 
            className="btn btn-primary" 
            style={{ marginTop: "12px" }}
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

          <button 
            type="button" 
            className="btn btn-primary" 
            style={{ height: "56px", fontSize: "18px" }}
            disabled={isSubmitting}
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

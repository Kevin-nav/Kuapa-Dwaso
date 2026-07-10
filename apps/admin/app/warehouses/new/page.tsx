// apps/admin/app/warehouses/new/page.tsx
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, X, Loader2 } from "lucide-react";
import { gray, palette, status } from "@kuapa-dwaso/dashboard-ui";
import {
  GHANA_REGIONS,
  COMMUNITIES_BY_REGION,
  DISTRICTS_BY_REGION,
  SUPPORTED_CROPS,
  CAPACITY_UNITS,
  type GhanaRegion,
  type SupportedCrop,
} from "@kuapa-dwaso/types";
import { OperationalAccessGate } from "../../operational/OperationalAccessGate";
import { useOperationalAdminData } from "../../operational/useOperationalAdminData";

const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday"
];

export default function NewWarehousePage() {
  const router = useRouter();
  const { access, actions } = useOperationalAdminData();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Form states
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [region, setRegion] = useState<GhanaRegion>("Western");
  const [district, setDistrict] = useState("");
  const [community, setCommunity] = useState("");
  const [servedCommunities, setServedCommunities] = useState<string[]>([]);
  const [supportedCrops, setSupportedCrops] = useState<SupportedCrop[]>([]);
  const [storageCapacity, setStorageCapacity] = useState("");
  const [capacityUnit, setCapacityUnit] = useState<string>("tonnes");
  const [operatingDays, setOperatingDays] = useState<string[]>(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);
  const [dispatchDays, setDispatchDays] = useState<string[]>([]);
  const [destinationMarkets, setDestinationMarkets] = useState<string[]>([]);
  const [whStatus, setWhStatus] = useState<"active" | "inactive" | "maintenance" | "closed">("inactive");

  // Temporary input states for tags
  const [marketInput, setMarketInput] = useState("");

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset district, community, and served communities when region changes
  const handleRegionChange = (newRegion: GhanaRegion) => {
    setRegion(newRegion);
    const districts = DISTRICTS_BY_REGION[newRegion] || [];
    const communities = COMMUNITIES_BY_REGION[newRegion] || [];
    setDistrict(districts[0] || "");
    setCommunity(communities[0] || "");
    setServedCommunities([]);
  };

  const handleAddServedCommunity = (comm: string) => {
    if (comm && !servedCommunities.includes(comm)) {
      setServedCommunities([...servedCommunities, comm]);
    }
  };

  const handleRemoveServedCommunity = (comm: string) => {
    setServedCommunities(servedCommunities.filter(c => c !== comm));
  };

  const handleToggleCrop = (crop: SupportedCrop) => {
    if (supportedCrops.includes(crop)) {
      setSupportedCrops(supportedCrops.filter(c => c !== crop));
    } else {
      setSupportedCrops([...supportedCrops, crop]);
    }
  };

  const handleToggleOperatingDay = (day: string) => {
    if (operatingDays.includes(day)) {
      setOperatingDays(operatingDays.filter(d => d !== day));
    } else {
      setOperatingDays([...operatingDays, day]);
    }
  };

  const handleToggleDispatchDay = (day: string) => {
    if (dispatchDays.includes(day)) {
      setDispatchDays(dispatchDays.filter(d => d !== day));
    } else {
      setDispatchDays([...dispatchDays, day]);
    }
  };

  const handleAddMarket = (e: FormEvent) => {
    e.preventDefault();
    const clean = marketInput.trim();
    if (clean && !destinationMarkets.includes(clean)) {
      setDestinationMarkets([...destinationMarkets, clean]);
      setMarketInput("");
    }
  };

  const handleRemoveMarket = (mkt: string) => {
    setDestinationMarkets(destinationMarkets.filter(m => m !== mkt));
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};

    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      nextErrors.code = "Warehouse code is required";
    } else if (cleanCode.length < 3) {
      nextErrors.code = "Code must be at least 3 characters";
    } else if (!/^WH-[A-Z0-9]+-[A-Z0-9]+$/i.test(cleanCode) && !/^WH-[A-Z0-9]+$/i.test(cleanCode)) {
      nextErrors.code = "Suggest format: WH-[REGION]-[NAME] (e.g. WH-TKW-001)";
    }

    if (!name.trim()) {
      nextErrors.name = "Warehouse name is required";
    } else if (name.trim().length < 3) {
      nextErrors.name = "Name must be at least 3 characters";
    }

    if (!region) {
      nextErrors.region = "Region is required";
    }
    if (!community) {
      nextErrors.community = "Primary community is required";
    }
    if (servedCommunities.length === 0) {
      nextErrors.servedCommunities = "At least one served community is required";
    }
    if (supportedCrops.length === 0) {
      nextErrors.supportedCrops = "Select at least one supported crop";
    }
    if (operatingDays.length === 0) {
      nextErrors.operatingDays = "Select at least one operating day";
    }
    if (destinationMarkets.length === 0) {
      nextErrors.destinationMarkets = "Add at least one destination market served";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setSubmitError("");

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: any = {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        region,
        community,
        servedCommunities,
        supportedCrops,
        operatingDays,
        destinationMarketsServed: destinationMarkets,
        status: whStatus
      };

      if (district) {
        payload.district = district;
      }
      if (storageCapacity) {
        payload.storageCapacity = parseFloat(storageCapacity);
        payload.capacityUnit = capacityUnit;
      }
      if (dispatchDays.length > 0) {
        payload.dispatchDays = dispatchDays;
      }

      await actions.createWarehouse(payload);
      router.push("/warehouses");
    } catch (err: any) {
      setSubmitError(err instanceof Error ? err.message : "Could not create warehouse.");
      setIsSubmitting(false);
    }
  };

  // Pre-seed district/community when region is set
  const currentDistricts = DISTRICTS_BY_REGION[region] || [];
  const currentCommunities = COMMUNITIES_BY_REGION[region] || [];

  // Style objects (using inline style convention)
  const containerStyle = {
    display: "flex",
    flexDirection: "column" as const,
    gap: "28px",
    paddingBottom: "80px"
  };

  const headerStyle = {
    display: "flex",
    flexDirection: "column" as const,
    gap: "8px"
  };

  const backLinkStyle = {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "0.875rem",
    color: gray[500],
    cursor: "pointer",
    background: "transparent",
    border: 0,
    padding: 0,
    fontWeight: 600
  };

  const formLayoutGrid = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: "24px"
  };

  const cardStyle = {
    backgroundColor: "white",
    border: `1px solid ${gray[100]}`,
    borderRadius: "12px",
    padding: "24px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "20px"
  };

  const cardTitleStyle = {
    margin: 0,
    fontSize: "1rem",
    fontWeight: 700,
    color: gray[900],
    borderBottom: `1px solid ${gray[50]}`,
    paddingBottom: "12px"
  };

  const formGroupStyle = {
    display: "flex",
    flexDirection: "column" as const,
    gap: "6px"
  };

  const labelStyle = {
    fontSize: "0.75rem",
    fontWeight: 700,
    color: gray[600],
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em"
  };

  const inputStyle = (hasError: boolean) => ({
    padding: "10px 12px",
    border: `1px solid ${hasError ? status.danger : gray[300]}`,
    borderRadius: "6px",
    fontSize: "0.875rem",
    fontFamily: "inherit",
    outline: "none",
    width: "100%",
    boxSizing: "border-box" as const,
    transition: "border-color 0.2s"
  });

  const errorTextStyle = {
    color: status.danger,
    fontSize: "0.75rem",
    fontWeight: 500,
    marginTop: "2px"
  };

  const chipContainerStyle = {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "8px"
  };

  const tagStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    padding: "6px 10px",
    backgroundColor: gray[50],
    border: `1px solid ${gray[100]}`,
    borderRadius: "20px",
    fontSize: "0.75rem",
    fontWeight: 600,
    color: gray[700]
  };

  const removeTagBtnStyle = {
    background: "transparent",
    border: 0,
    padding: 0,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    color: gray[400]
  };

  const dayChipStyle = (isSelected: boolean) => ({
    padding: "8px 12px",
    borderRadius: "6px",
    fontSize: "0.8125rem",
    fontWeight: 600,
    border: `1px solid ${isSelected ? palette.field : gray[300]}`,
    backgroundColor: isSelected ? palette.field : "white",
    color: isSelected ? "white" : gray[700],
    cursor: "pointer",
    textAlign: "center" as const,
    minWidth: "60px",
    transition: "all 0.2s"
  });

  const cropGridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
    gap: "10px"
  };

  const cropLabelStyle = (isSelected: boolean) => ({
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px",
    borderRadius: "6px",
    border: `1px solid ${isSelected ? palette.field : gray[300]}`,
    backgroundColor: isSelected ? `${palette.field}0a` : "white",
    fontSize: "0.8125rem",
    fontWeight: 500,
    color: isSelected ? palette.fieldDark : gray[700],
    cursor: "pointer",
    userSelect: "none" as const
  });

  const bannerErrorStyle = {
    padding: "16px",
    borderRadius: "8px",
    backgroundColor: status.dangerBg,
    border: `1px solid ${status.dangerBorder}`,
    color: status.danger,
    fontSize: "0.875rem",
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    gap: "10px"
  };

  return (
    <OperationalAccessGate
      firebaseUser={access.firebaseUser}
      principal={access.principal}
      isAuthLoading={access.isAuthLoading}
      isDataLoading={access.isDataLoading}
      isAllowed={access.canCreateWarehouses}
      limitedMessage="Creating warehouses requires warehouses:manage permission."
    >
      <div style={containerStyle}>
        {/* Back Link */}
        <button onClick={() => router.push("/warehouses")} style={backLinkStyle}>
          <ArrowLeft size={16} /> Back to Warehouses
        </button>

        {/* Header */}
        <div style={headerStyle}>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: gray[900], margin: 0 }}>
            Create New Warehouse
          </h1>
          <p style={{ fontSize: "0.875rem", color: gray[500], margin: 0 }}>
            Provision a new aggregation node, assign regional domains and supported crops.
          </p>
        </div>

        {/* Submit Error Banner */}
        {submitError && (
          <div style={bannerErrorStyle}>
            <span>⚠️ {submitError}</span>
          </div>
        )}

        <form onSubmit={(e) => { void handleSubmit(e); }} style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div style={formLayoutGrid}>
            
            {/* COLUMN 1: Profile & Location */}
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              
              {/* Identity Details Card */}
              <div style={cardStyle}>
                <h3 style={cardTitleStyle}>1. Identity Details</h3>
                
                <div style={formGroupStyle}>
                  <label htmlFor="code" style={labelStyle}>Warehouse Code *</label>
                  <input
                    id="code"
                    type="text"
                    placeholder="WH-TKW-001"
                    style={inputStyle(!!errors.code)}
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                  />
                  {errors.code && <span style={errorTextStyle}>{errors.code}</span>}
                </div>

                <div style={formGroupStyle}>
                  <label htmlFor="name" style={labelStyle}>Warehouse Name *</label>
                  <input
                    id="name"
                    type="text"
                    placeholder="Tarkwa Community Store"
                    style={inputStyle(!!errors.name)}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  {errors.name && <span style={errorTextStyle}>{errors.name}</span>}
                </div>

                <div style={formGroupStyle}>
                  <label htmlFor="status" style={labelStyle}>Initial Status</label>
                  <select
                    id="status"
                    style={inputStyle(false)}
                    value={whStatus}
                    onChange={(e: any) => setWhStatus(e.target.value)}
                  >
                    <option value="inactive">Inactive (Pending Agent Assignment)</option>
                    <option value="active">Active (Operational)</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>

              {/* Location & Catchment Card */}
              <div style={cardStyle}>
                <h3 style={cardTitleStyle}>2. Location & Catchment</h3>

                <div style={formGroupStyle}>
                  <label htmlFor="region" style={labelStyle}>Region *</label>
                  <select
                    id="region"
                    style={inputStyle(!!errors.region)}
                    value={region}
                    onChange={(e) => handleRegionChange(e.target.value as GhanaRegion)}
                  >
                    {GHANA_REGIONS.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  {errors.region && <span style={errorTextStyle}>{errors.region}</span>}
                </div>

                <div style={formGroupStyle}>
                  <label htmlFor="district" style={labelStyle}>District</label>
                  <select
                    id="district"
                    style={inputStyle(false)}
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                  >
                    <option value="">-- No District Assigned --</option>
                    {currentDistricts.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div style={formGroupStyle}>
                  <label htmlFor="community" style={labelStyle}>Primary Community *</label>
                  <select
                    id="community"
                    style={inputStyle(!!errors.community)}
                    value={community}
                    onChange={(e) => setCommunity(e.target.value)}
                  >
                    <option value="">-- Select Primary Community --</option>
                    {currentCommunities.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  {errors.community && <span style={errorTextStyle}>{errors.community}</span>}
                </div>

                <div style={formGroupStyle}>
                  <label style={labelStyle}>Served Catchment Areas (Communities) *</label>
                  <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                    <select
                      id="served-comm-select"
                      style={inputStyle(false)}
                      onChange={(e) => {
                        handleAddServedCommunity(e.target.value);
                        e.target.value = "";
                      }}
                    >
                      <option value="">-- Click to Add Served Community --</option>
                      {currentCommunities.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div style={chipContainerStyle}>
                    {servedCommunities.map(c => (
                      <span key={c} style={tagStyle}>
                        {c}
                        <button type="button" onClick={() => handleRemoveServedCommunity(c)} style={removeTagBtnStyle}>
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                  {errors.servedCommunities && <span style={errorTextStyle}>{errors.servedCommunities}</span>}
                </div>
              </div>
            </div>

            {/* COLUMN 2: Operations & Markets */}
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              
              {/* Warehouse Capacity & Crops Card */}
              <div style={cardStyle}>
                <h3 style={cardTitleStyle}>3. Storage & Crop Capabilities</h3>

                <div style={{ display: "flex", gap: "12px" }}>
                  <div style={{ ...formGroupStyle, flex: 2 }}>
                    <label htmlFor="storageCapacity" style={labelStyle}>Storage Capacity</label>
                    <input
                      id="storageCapacity"
                      type="number"
                      placeholder="e.g. 500"
                      min="0"
                      style={inputStyle(false)}
                      value={storageCapacity}
                      onChange={(e) => setStorageCapacity(e.target.value)}
                    />
                  </div>
                  <div style={{ ...formGroupStyle, flex: 1 }}>
                    <label htmlFor="capacityUnit" style={labelStyle}>Unit</label>
                    <select
                      id="capacityUnit"
                      style={inputStyle(false)}
                      value={capacityUnit}
                      onChange={(e) => setCapacityUnit(e.target.value)}
                    >
                      {CAPACITY_UNITS.map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={formGroupStyle}>
                  <label style={labelStyle}>Supported Crops *</label>
                  <div style={cropGridStyle}>
                    {SUPPORTED_CROPS.map(crop => {
                      const isSelected = supportedCrops.includes(crop);
                      return (
                        <label key={crop} style={cropLabelStyle(isSelected)}>
                          <input
                            type="checkbox"
                            style={{ display: "none" }}
                            checked={isSelected}
                            onChange={() => handleToggleCrop(crop)}
                          />
                          <span>{crop}</span>
                        </label>
                      );
                    })}
                  </div>
                  {errors.supportedCrops && <span style={errorTextStyle}>{errors.supportedCrops}</span>}
                </div>
              </div>

              {/* Operating Schedules Card */}
              <div style={cardStyle}>
                <h3 style={cardTitleStyle}>4. Operating Schedules</h3>

                <div style={formGroupStyle}>
                  <label style={labelStyle}>Intake Operating Days *</label>
                  <div style={chipContainerStyle}>
                    {DAYS_OF_WEEK.map(day => {
                      const isSelected = operatingDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => handleToggleOperatingDay(day)}
                          style={dayChipStyle(isSelected)}
                        >
                          {day.slice(0, 3)}
                        </button>
                      );
                    })}
                  </div>
                  {errors.operatingDays && <span style={errorTextStyle}>{errors.operatingDays}</span>}
                </div>

                <div style={formGroupStyle}>
                  <label style={labelStyle}>Weekly Dispatch Days</label>
                  <div style={chipContainerStyle}>
                    {DAYS_OF_WEEK.map(day => {
                      const isSelected = dispatchDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => handleToggleDispatchDay(day)}
                          style={dayChipStyle(isSelected)}
                        >
                          {day.slice(0, 3)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Destination Markets Card */}
              <div style={cardStyle}>
                <h3 style={cardTitleStyle}>5. Served Destination Markets</h3>

                <div style={formGroupStyle}>
                  <label htmlFor="market-input" style={labelStyle}>Add Destination Market *</label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input
                      id="market-input"
                      type="text"
                      placeholder="e.g. Takoradi Central Market"
                      style={inputStyle(false)}
                      value={marketInput}
                      onChange={(e) => setMarketInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const clean = marketInput.trim();
                          if (clean && !destinationMarkets.includes(clean)) {
                            setDestinationMarkets([...destinationMarkets, clean]);
                            setMarketInput("");
                          }
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={(e) => handleAddMarket(e)}
                      style={{
                        padding: "0 16px",
                        backgroundColor: gray[900],
                        color: "white",
                        border: 0,
                        borderRadius: "6px",
                        fontWeight: 600,
                        fontSize: "0.875rem",
                        cursor: "pointer"
                      }}
                    >
                      Add
                    </button>
                  </div>
                  <div style={{ ...chipContainerStyle, marginTop: "8px" }}>
                    {destinationMarkets.map(m => (
                      <span key={m} style={tagStyle}>
                        {m}
                        <button type="button" onClick={() => handleRemoveMarket(m)} style={removeTagBtnStyle}>
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                  {errors.destinationMarkets && <span style={errorTextStyle}>{errors.destinationMarkets}</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Form Actions Footer */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "12px",
              paddingTop: "16px",
              borderTop: `1px solid ${gray[100]}`,
              marginTop: "12px"
            }}
          >
            <button
              type="button"
              onClick={() => router.push("/warehouses")}
              style={{
                padding: "12px 24px",
                border: `1px solid ${gray[300]}`,
                borderRadius: "6px",
                backgroundColor: "white",
                color: gray[700],
                fontWeight: 600,
                fontSize: "0.875rem",
                cursor: "pointer"
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: "12px 24px",
                backgroundColor: isSubmitting ? gray[300] : palette.field,
                color: "white",
                border: 0,
                borderRadius: "6px",
                fontWeight: 700,
                fontSize: "0.875rem",
                cursor: isSubmitting ? "not-allowed" : "pointer",
                boxShadow: "0 2px 4px rgba(0, 0, 0, 0.05)",
                display: "flex",
                alignItems: "center",
                gap: "8px"
              }}
            >
              {isSubmitting && <Loader2 size={16} className="animate-spin" />}
              {isSubmitting ? "Creating..." : "Create Warehouse"}
            </button>
          </div>
        </form>
      </div>
    </OperationalAccessGate>
  );
}

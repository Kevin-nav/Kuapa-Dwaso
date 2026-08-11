"use client";

/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, react-hooks/immutability, react/no-unescaped-entities */

import type React from "react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";
import { useWarehouse } from "../context/WarehouseContext";
import { GHANA_REGIONS, COMMUNITIES_BY_REGION } from "@kuapa-dwaso/types";
import type { GhanaRegion } from "@kuapa-dwaso/types";
import { normalizeGhanaPhoneNumber } from "@kuapa-dwaso/utils";
import { 
  UserSearch, 
  Plus, 
  MapPin, 
  Phone, 
  User, 
  ArrowLeft, 
  AlertCircle,
  Clock
} from "lucide-react";

type LookupRecord = {
  id: string;
  fullName: string;
  phoneNumber: string;
};

export default function FarmersPage() {
  const router = useRouter();
  const { farmers, registerFarmer, activeWarehouse, assignedWarehouses, setDraftIntake, actorUserId, errorMessage } = useWarehouse();
  
  // Lookups cache
  const [recentLookups, setRecentLookups] = useState<LookupRecord[]>([]);

  // Search State
  const [searchPhone, setSearchPhone] = useState("");
  const [searched, setSearched] = useState(false);
  const [searchResult, setSearchResult] = useState<any>(null);
  const [lookupPhone, setLookupPhone] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Registration Mode
  const [isRegistering, setIsRegistering] = useState(false);

  // Registration Form State
  const [formData, setFormData] = useState<{
    fullName: string;
    phoneNumber: string;
    belongsToOther: boolean;
    ownerName: string;
    region: string;
    community: string;
    preferredWarehouseId: string;
  }>({
    fullName: "",
    phoneNumber: "",
    belongsToOther: false,
    ownerName: "",
    region: GHANA_REGIONS[0],
    community: "",
    preferredWarehouseId: ""
  });

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});



  // Hydrate lookups from cache
  useEffect(() => {
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("kuapa_ops_recent_lookups");
      if (cached) {
        setRecentLookups(JSON.parse(cached));
      }
    }
  }, []);

  useEffect(() => {
    if (activeWarehouse.id !== "unassigned") {
      const region = activeWarehouse.region || GHANA_REGIONS[0];
      const defaultComm = (COMMUNITIES_BY_REGION[region as GhanaRegion] ?? [])[0] || "";
      setFormData(prev => ({
        ...prev,
        preferredWarehouseId: prev.preferredWarehouseId || activeWarehouse.id,
        region,
        community: prev.community || defaultComm
      }));
    }
  }, [activeWarehouse.id, activeWarehouse.region]);

  const backendLookup = useQuery(
    api.farmers.getByPhoneNumber,
    actorUserId && lookupPhone
      ? {
          actorUserId: actorUserId as Id<"users">,
          phoneNumber: lookupPhone,
        }
      : "skip",
  ) as Doc<"farmers"> | null | undefined;

  useEffect(() => {
    if (!searched || !lookupPhone || backendLookup === undefined) {
      return;
    }
    if (backendLookup !== null) {
      const farmer = { ...backendLookup, id: backendLookup._id };
      setSearchResult(farmer);
      saveRecentLookup({
        id: farmer.id,
        fullName: farmer.fullName,
        phoneNumber: farmer.phoneNumber
      });
    }
  }, [backendLookup, lookupPhone, searched]);

  const saveRecentLookup = (record: LookupRecord) => {
    setRecentLookups(prev => {
      const filtered = prev.filter(r => r.id !== record.id);
      const updated = [record, ...filtered].slice(0, 5);
      if (typeof window !== "undefined") {
        localStorage.setItem("kuapa_ops_recent_lookups", JSON.stringify(updated));
      }
      return updated;
    });
  };

  // Formatting input values to 024 XXX XXXX structure
  const handlePhoneInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/\D/g, "");
    let formattedVal = rawVal;
    if (rawVal.length > 3 && rawVal.length <= 6) {
      formattedVal = `${rawVal.slice(0, 3)} ${rawVal.slice(3)}`;
    } else if (rawVal.length > 6) {
      formattedVal = `${rawVal.slice(0, 3)} ${rawVal.slice(3, 6)} ${rawVal.slice(6)}`;
    }
    setSearchPhone(formattedVal);
    setSearched(false);
    setSearchResult(null);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchPhone) return;
    setSubmitError("");

    // Standardize comparison
    const cleanedSearch = searchPhone.replace(/\s/g, "");
    const normalizedPhone = `+233${cleanedSearch.slice(-9)}`;
    
    // Find matching farmer
    const match = farmers.find(f => {
      const cleanedFarmerPhone = f.phoneNumber.replace(/\D/g, "");
      return cleanedFarmerPhone.endsWith(cleanedSearch) || cleanedSearch.endsWith(cleanedFarmerPhone.slice(-9));
    });

    setSearched(true);
    setLookupPhone(normalizedPhone);
    if (match) {
      setSearchResult(match);
      saveRecentLookup({
        id: match.id,
        fullName: match.fullName,
        phoneNumber: match.phoneNumber
      });
    } else {
      setSearchResult(null);
    }
  };

  // Cascading select handlers
  const handleRegionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const region = e.target.value;
    const defaultComm = (COMMUNITIES_BY_REGION[region as GhanaRegion] ?? [])[0] || "";
    setFormData(prev => ({ ...prev, region, community: defaultComm }));
  };

  // Form validations
  const validateField = (field: string, value: any) => {
    let err = "";
    if (field === "fullName" && !value.trim()) {
      err = "Farmer full name is required";
    }
    if (field === "phoneNumber") {
      try {
        normalizeGhanaPhoneNumber(String(value));
      } catch {
        err = "Enter 054 123 4567 or +233 54 123 4567";
      }
    }
    if (field === "ownerName" && formData.belongsToOther && !value.trim()) {
      err = "Household phone owner's name is required";
    }
    if (field === "community" && !value) {
      err = "Please select a community";
    }
    
    setErrors(prev => ({ ...prev, [field]: err }));
  };

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    validateField(field, formData[field as keyof typeof formData]);
  };

  const handleFormChange = (field: keyof typeof formData, value: any) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      if (touched[field]) {
        validateField(field, value);
      }
      return updated;
    });
  };

  const handleRegistrationSubmit = (e: React.FormEvent, startIntake: boolean) => {
    e.preventDefault();
    if (isSubmitting) return;
    
    // Validate all fields
    const newErrors: Record<string, string> = {};
    if (!formData.fullName.trim()) newErrors.fullName = "Farmer name is required";
    if (!formData.community) newErrors.community = "Community is required";
    
    let normalizedPhoneNumber = "";
    try {
      normalizedPhoneNumber = normalizeGhanaPhoneNumber(formData.phoneNumber);
    } catch {
      newErrors.phoneNumber = "Enter 054 123 4567 or +233 54 123 4567";
    }
    
    if (formData.belongsToOther && !formData.ownerName.trim()) {
      newErrors.ownerName = "Owner name is required";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      // Mark all as touched
      const allTouched = Object.keys(formData).reduce((acc, k) => ({ ...acc, [k]: true }), {});
      setTouched(allTouched);
      return;
    }

    const registrationPayload: any = {
      fullName: formData.fullName,
      phoneNumber: normalizedPhoneNumber,
      community: formData.community,
      region: formData.region,
      preferredWarehouseId: formData.preferredWarehouseId || activeWarehouse.id
    };
    if (formData.belongsToOther && formData.ownerName.trim()) {
      registrationPayload.householdPhoneOwnerName = formData.ownerName;
    }

    setIsSubmitting(true);
    setSubmitError("");
    void registerFarmer(registrationPayload)
      .then((newFarmer) => {
        if (startIntake) {
          setDraftIntake({
            farmerId: newFarmer.id,
            warehouseId: registrationPayload.preferredWarehouseId,
            step: 2
          });
          router.push("/intake");
          return;
        }
        setIsRegistering(false);
        setSearchPhone(formData.phoneNumber);
        setSearchResult(newFarmer);
        setSearched(true);
        const resetRegion = activeWarehouse?.region || GHANA_REGIONS[0];
        const resetCommunity = (COMMUNITIES_BY_REGION[resetRegion as GhanaRegion] ?? [])[0] || "";
        setFormData({
          fullName: "",
          phoneNumber: "",
          belongsToOther: false,
          ownerName: "",
          region: resetRegion,
          community: resetCommunity,
          preferredWarehouseId: activeWarehouse.id
        });
        setTouched({});
        setErrors({});
      })
      .catch((error: unknown) => {
        setSubmitError(error instanceof Error ? error.message : "Could not register farmer.");
      })
      .finally(() => setIsSubmitting(false));
  };

  const triggerRegisterMode = () => {
    setIsRegistering(true);
    const initialRegion = activeWarehouse?.region || GHANA_REGIONS[0];
    setFormData(prev => ({
      ...prev,
      phoneNumber: searchPhone,
      region: initialRegion,
      community: (COMMUNITIES_BY_REGION[initialRegion as GhanaRegion] ?? [])[0] || ""
    }));
  };

  // Start intake for existing farmer
  const startIntakeForFarmer = (farmerId: string) => {
    setDraftIntake({
      farmerId,
      warehouseId: activeWarehouse.id,
      step: 2
    });
    router.push("/intake");
  };

  if (isRegistering) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {/* Registration Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button 
            type="button" 
            className="modal-close" 
            style={{ width: "40px", height: "40px", backgroundColor: "var(--color-surface-raised)" }}
            onClick={() => setIsRegistering(false)}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 style={{ fontSize: "20px", fontWeight: "800" }}>Register New Farmer</h1>
            <p style={{ fontSize: "13px", color: "var(--gray-500)" }}>Agent-Assisted Registration</p>
          </div>
        </div>

        {/* Identity Section */}
        <form onSubmit={(e) => handleRegistrationSubmit(e, true)} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div className="section-card" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h2 className="detail-section-title">1. Farmer Identity</h2>
            
            <div className="form-group">
              <label className="form-label form-label-required" htmlFor="fullName">Full Name</label>
              <input 
                id="fullName"
                type="text" 
                className={`form-input ${(touched.fullName && errors.fullName) ? "form-input-error" : (touched.fullName && !errors.fullName) ? "form-input-success" : ""}`}
                placeholder="e.g. Ama Serwaah"
                value={formData.fullName}
                onChange={(e) => handleFormChange("fullName", e.target.value)}
                onBlur={() => handleBlur("fullName")}
              />
              {touched.fullName && errors.fullName && (
                <div className="form-error">
                  <AlertCircle size={14} />
                  <span>{errors.fullName}</span>
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label form-label-required" htmlFor="phoneNumber">Phone Number</label>
              <input 
                id="phoneNumber"
                type="tel" 
                className={`form-input ${(touched.phoneNumber && errors.phoneNumber) ? "form-input-error" : (touched.phoneNumber && !errors.phoneNumber) ? "form-input-success" : ""}`}
                placeholder="e.g. 024 123 4567"
                value={formData.phoneNumber}
                onChange={(e) => handleFormChange("phoneNumber", e.target.value)}
                onBlur={() => handleBlur("phoneNumber")}
              />
              {touched.phoneNumber && errors.phoneNumber && (
                <div className="form-error">
                  <AlertCircle size={14} />
                  <span>{errors.phoneNumber}</span>
                </div>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "8px 0" }}>
              <input 
                id="belongsToOther"
                type="checkbox" 
                style={{ width: "20px", height: "20px", marginTop: "2px", accentColor: "var(--color-field)" }}
                checked={formData.belongsToOther}
                onChange={(e) => handleFormChange("belongsToOther", e.target.checked)}
              />
              <label htmlFor="belongsToOther" style={{ fontSize: "14px", fontWeight: "600", color: "var(--gray-700)", cursor: "pointer" }}>
                This phone belongs to someone else in the household
              </label>
            </div>

            {formData.belongsToOther && (
              <div className="form-group" style={{ borderLeft: "3px solid var(--color-line)", paddingLeft: "14px", marginTop: "-8px" }}>
                <label className="form-label form-label-required" htmlFor="ownerName">Phone Owner's Name</label>
                <input 
                  id="ownerName"
                  type="text" 
                  className={`form-input ${touched.ownerName && errors.ownerName ? "form-input-error" : ""}`}
                  placeholder="e.g. Kwame Boateng (Husband)"
                  value={formData.ownerName}
                  onChange={(e) => handleFormChange("ownerName", e.target.value)}
                  onBlur={() => handleBlur("ownerName")}
                />
                {touched.ownerName && errors.ownerName && (
                  <div className="form-error">
                    <AlertCircle size={14} />
                    <span>{errors.ownerName}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Location Section */}
          <div className="section-card" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h2 className="detail-section-title">2. Farmer Location & Preferences</h2>

            <div className="form-group">
              <label className="form-label" htmlFor="region">Region</label>
              <select 
                id="region"
                className="form-select"
                value={formData.region}
                disabled={true}
                onChange={handleRegionChange}
              >
                {GHANA_REGIONS.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label form-label-required" htmlFor="community">Community</label>
              <select 
                id="community"
                className="form-select"
                value={formData.community}
                onChange={(e) => handleFormChange("community", e.target.value)}
                onBlur={() => handleBlur("community")}
              >
                {(COMMUNITIES_BY_REGION[formData.region as GhanaRegion] ?? []).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="preferredWarehouseId">Preferred Warehouse</label>
              <select 
                id="preferredWarehouseId"
                className="form-select"
                value={formData.preferredWarehouseId}
                onChange={(e) => handleFormChange("preferredWarehouseId", e.target.value)}
              >
                {assignedWarehouses.map(warehouse => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}{warehouse.id === activeWarehouse.id ? " (this warehouse)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {(submitError || errorMessage) && (
            <div className="offline-banner" style={{ margin: 0, backgroundColor: "var(--color-danger-bg)", color: "var(--color-danger)", borderColor: "var(--color-danger-border)" }}>
              <AlertCircle size={16} />
              <span>{submitError || errorMessage}</span>
            </div>
          )}

          {/* Sticky Actions Bar */}
          <div className="sticky-actions-bar">
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={isSubmitting || activeWarehouse.id === "unassigned"}
            >
              <Plus size={20} />
              <span>{isSubmitting ? "Registering..." : "Register & Start Intake"}</span>
            </button>
            <button 
              type="button" 
              className="btn btn-outline" 
              style={{ border: "0" }}
              onClick={(e) => handleRegistrationSubmit(e, false)}
              disabled={isSubmitting || activeWarehouse.id === "unassigned"}
            >
              Register Only
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: "24px", fontWeight: "800", color: "var(--color-ink)", marginBottom: "4px" }}>
          Farmer Search & Lookup
        </h1>
        <p style={{ color: "var(--gray-600)", fontSize: "14px" }}>
          Verify farmer registration status before accepting crop batches.
        </p>
      </div>

      {/* Lookup search block */}
      <section className="section-card" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <h2 style={{ fontSize: "16px", fontWeight: "700" }}>Search by Phone Number</h2>
        <form onSubmit={handleSearch} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", color: "var(--gray-400)", display: "flex", alignItems: "center" }}>
              <Phone size={20} />
            </span>
            <input 
              type="tel"
              className="form-input"
              style={{ fontSize: "20px", fontWeight: "600", paddingLeft: "48px", height: "56px" }}
              placeholder="e.g. 024 123 4567"
              value={searchPhone}
              onChange={handlePhoneInputChange}
              aria-label="Farmer Phone Number"
            />
          </div>
          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ height: "52px" }}
            disabled={!searchPhone || !actorUserId}
          >
            <UserSearch size={20} />
            <span>Search Farmer Database</span>
          </button>
        </form>
      </section>

      {/* Result Cards Display */}
      {searched && (
        <section aria-label="Search Result">
          {lookupPhone && backendLookup === undefined ? (
            <div className="section-card" style={{ textAlign: "center", padding: "32px 20px", color: "var(--gray-500)" }}>
              Searching farmer database...
            </div>
          ) : searchResult ? (
            <div className="section-card" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                {/* Initials circle */}
                <div style={{ 
                  width: "56px", 
                  height: "56px", 
                  borderRadius: "50%", 
                  backgroundColor: "var(--color-success-bg)", 
                  color: "var(--color-field)", 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center", 
                  fontSize: "20px", 
                  fontWeight: "700" 
                }}>
                  {searchResult.fullName.split(" ").map((n: string) => n[0]).join("").toUpperCase()}
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ fontSize: "20px", fontWeight: "700" }}>{searchResult.fullName}</div>
                  <div style={{ fontSize: "14px", color: "var(--gray-500)", display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>{searchResult.phoneNumber}</span>
                    <span>·</span>
                    <span className="code-chip" style={{ fontSize: "11px", padding: "2px 6px" }}>{searchResult.farmerCode}</span>
                  </div>
                </div>
              </div>

              <div style={{ borderTop: "1px solid var(--color-line)", borderBottom: "1px solid var(--color-line)", padding: "12px 0", display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "var(--gray-700)" }}>
                  <MapPin size={16} className="text-gray-500" />
                  <span>{searchResult.community} · {searchResult.region || GHANA_REGIONS[0]}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "var(--gray-700)" }}>
                  <User size={16} className="text-gray-500" />
                  <span>Farmer since {new Date(searchResult.createdAt).getFullYear()}</span>
                </div>
              </div>

              <button 
                type="button" 
                className="btn btn-primary"
                onClick={() => startIntakeForFarmer(searchResult.id)}
              >
                <Plus size={20} />
                <span>Start Intake for {searchResult.fullName.split(" ")[0]}</span>
              </button>
            </div>
          ) : (
            <div className="section-card" style={{ display: "flex", flexDirection: "column", gap: "16px", textAlign: "center", alignItems: "center", padding: "32px 20px" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "50%", backgroundColor: "var(--color-danger-bg)", color: "var(--color-danger)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <UserSearch size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "4px" }}>No Farmer Found</h3>
                <p style={{ color: "var(--gray-500)", fontSize: "14px" }}>
                  No registered farmer matches phone number <strong>{searchPhone}</strong>.
                </p>
              </div>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={triggerRegisterMode}
              >
                <Plus size={20} />
                <span>Register New Farmer</span>
              </button>
            </div>
          )}
        </section>
      )}

      {/* Recent Lookups (Last 5 cached offline) */}
      {!searched && recentLookups.length > 0 && (
        <section className="section-card" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <h3 style={{ fontSize: "14px", fontWeight: "700", textTransform: "uppercase", color: "var(--gray-400)", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: "6px" }}>
            <Clock size={14} />
            <span>Recent Lookups</span>
          </h3>
          <div className="activity-list">
            {recentLookups.map(record => (
              <div 
                key={record.id}
                className="activity-row"
                onClick={() => {
                  setSearchPhone(record.phoneNumber);
                  const fullRecord = farmers.find(f => f.id === record.id);
                  setSearchResult(fullRecord || record);
                  setSearched(true);
                }}
              >
                <div className="activity-left">
                  <span style={{ fontWeight: "700" }}>{record.fullName}</span>
                  <span style={{ fontSize: "13px", color: "var(--gray-500)" }}>{record.phoneNumber}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", color: "var(--color-field)" }}>
                  <Plus size={16} />
                  <span style={{ fontSize: "13px", fontWeight: "700", marginLeft: "4px" }}>Select</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

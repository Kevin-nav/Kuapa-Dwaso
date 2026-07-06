"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWarehouse } from "../context/WarehouseContext";
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
  const { farmers, registerFarmer, activeWarehouse, setDraftIntake } = useWarehouse();
  
  // Lookups cache
  const [recentLookups, setRecentLookups] = useState<LookupRecord[]>([]);

  // Search State
  const [searchPhone, setSearchPhone] = useState("");
  const [searched, setSearched] = useState(false);
  const [searchResult, setSearchResult] = useState<any>(null);

  // Registration Mode
  const [isRegistering, setIsRegistering] = useState(false);

  // Registration Form State
  const [formData, setFormData] = useState({
    fullName: "",
    phoneNumber: "",
    belongsToOther: false,
    ownerName: "",
    region: "Ashanti",
    community: "",
    preferredWarehouseId: "wh-1"
  });

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Cascading location lookup lists
  const communitiesByRegion: Record<string, string[]> = {
    Ashanti: ["Bantama", "Adum", "Kejetia", "Bantama Farm Gate", "Kumasi Central"],
    Bono: ["Fiapre", "Abesim", "Chiraa", "Sunyani South"],
    Northern: ["Savelugu", "Tolon", "Nyankpala", "Tamale Industrial"]
  };

  // Hydrate lookups from cache
  useEffect(() => {
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("kuapa_ops_recent_lookups");
      if (cached) {
        setRecentLookups(JSON.parse(cached));
      }
    }
  }, []);

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
      formattedVal = `${rawVal.slice(0, 3)} ${rawVal.slice(3, 6)} ${rawVal.slice(6, 10)}`;
    }
    setSearchPhone(formattedVal);
    setSearched(false);
    setSearchResult(null);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchPhone) return;

    // Standardize comparison
    const cleanedSearch = searchPhone.replace(/\s/g, "");
    
    // Find matching farmer
    const match = farmers.find(f => {
      const cleanedFarmerPhone = f.phoneNumber.replace(/\D/g, "");
      return cleanedFarmerPhone.endsWith(cleanedSearch) || cleanedSearch.endsWith(cleanedFarmerPhone.slice(-9));
    });

    setSearched(true);
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
    const defaultComm = communitiesByRegion[region]?.[0] || "";
    setFormData(prev => ({ ...prev, region, community: defaultComm }));
  };

  // Form validations
  const validateField = (field: string, value: any) => {
    let err = "";
    if (field === "fullName" && !value.trim()) {
      err = "Farmer full name is required";
    }
    if (field === "phoneNumber") {
      const digits = value.replace(/\D/g, "");
      if (digits.length < 9) {
        err = "Enter a valid phone number (at least 9 digits)";
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
    
    // Validate all fields
    const newErrors: Record<string, string> = {};
    if (!formData.fullName.trim()) newErrors.fullName = "Farmer name is required";
    if (!formData.community) newErrors.community = "Community is required";
    
    const phoneDigits = formData.phoneNumber.replace(/\D/g, "");
    if (phoneDigits.length < 9) newErrors.phoneNumber = "Enter a valid phone number";
    
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

    // Call register
    const registrationPayload: any = {
      fullName: formData.fullName,
      phoneNumber: `+233 ${phoneDigits.slice(-9)}`,
      community: formData.community,
      region: formData.region,
      preferredWarehouseId: formData.preferredWarehouseId
    };
    if (formData.belongsToOther && formData.ownerName.trim()) {
      registrationPayload.householdPhoneOwnerName = formData.ownerName;
    }
    const newFarmer = registerFarmer(registrationPayload);

    if (startIntake) {
      // Pre-fill intake step 1
      setDraftIntake({
        farmerId: newFarmer.id,
        warehouseId: formData.preferredWarehouseId,
        step: 2 // Skip directly to crop selection
      });
      router.push("/intake");
    } else {
      // Clear forms and show lookup screen again with result pre-selected
      setIsRegistering(false);
      setSearchPhone(formData.phoneNumber);
      setSearchResult(newFarmer);
      setSearched(true);
      // Reset form
      setFormData({
        fullName: "",
        phoneNumber: "",
        belongsToOther: false,
        ownerName: "",
        region: "Ashanti",
        community: "",
        preferredWarehouseId: "wh-1"
      });
      setTouched({});
      setErrors({});
    }
  };

  const triggerRegisterMode = () => {
    setIsRegistering(true);
    setFormData(prev => ({
      ...prev,
      phoneNumber: searchPhone,
      community: communitiesByRegion[prev.region]?.[0] || ""
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
                onChange={handleRegionChange}
              >
                <option value="Ashanti">Ashanti</option>
                <option value="Bono">Bono</option>
                <option value="Northern">Northern</option>
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
                {communitiesByRegion[formData.region]?.map(c => (
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
                <option value="wh-1">Kumasi Central Warehouse (this warehouse)</option>
                <option value="wh-2">Sunyani Transit Depot</option>
                <option value="wh-3">Tamale Silo Terminal</option>
              </select>
            </div>
          </div>

          {/* Sticky Actions Bar */}
          <div className="sticky-actions-bar">
            <button 
              type="submit" 
              className="btn btn-primary"
            >
              <Plus size={20} />
              <span>Register & Start Intake</span>
            </button>
            <button 
              type="button" 
              className="btn btn-outline" 
              style={{ border: "0" }}
              onClick={(e) => handleRegistrationSubmit(e, false)}
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
            disabled={!searchPhone}
          >
            <UserSearch size={20} />
            <span>Search Farmer Database</span>
          </button>
        </form>
      </section>

      {/* Result Cards Display */}
      {searched && (
        <section aria-label="Search Result">
          {searchResult ? (
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
                  <span>{searchResult.community} · {searchResult.region || "Ashanti Region"}</span>
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

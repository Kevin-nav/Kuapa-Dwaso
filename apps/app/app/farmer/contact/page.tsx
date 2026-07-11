"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useAuth } from "../../auth/AuthProvider";
import { ArrowLeft, Phone, MessageSquare, Clock, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Id } from "../../../../../convex/_generated/dataModel";

export default function ContactPage() {
  const router = useRouter();
  const { principal } = useAuth();

  const farmerProfile = principal?.profiles?.find((p) => p.profileType === "farmer");
  const farmerId = farmerProfile?.profileId as Id<"farmers"> | undefined;

  // Retrieve details
  const farmer = useQuery(
    api.farmers.getById,
    principal !== null && principal !== undefined && farmerId !== undefined
      ? { actorUserId: principal.userId as Id<"users">, farmerId }
      : "skip"
  );

  const warehouses = useQuery(api.warehouses.list, {});
  const warehouse = warehouses?.find((w) => w._id === farmer?.preferredWarehouseId);

  const warehouseName = warehouse?.name || "Akwatia Community Warehouse";
  const warehouseLocation = warehouse
    ? `${warehouse.community || "Akwatia"}, ${warehouse.region || "Eastern Region"}`
    : "Akwatia, Eastern Region, Ghana";

  // Retrieve assigned warehouse agents
  const agents = useQuery(
    api.warehouseAgents.listByWarehouseForFarmer,
    principal !== null && principal !== undefined && farmer?.preferredWarehouseId !== undefined
      ? { actorUserId: principal.userId as Id<"users">, warehouseId: farmer.preferredWarehouseId }
      : "skip"
  );

  const agent = agents && agents.length > 0 ? agents[0] : null;
  const agentName = agent?.fullName || "Warehouse Manager";
  const phone = agent?.phoneNumber || "+233240000000";
  const whatsappUrl = `https://wa.me/${phone.replace(/\+/g, "")}`;

  return (
    <div style={{ display: "flex", flex: "1 0 auto", flexDirection: "column", gap: "20px" }}>
      {/* Back button */}
      <button
        type="button"
        onClick={() => router.back()}
        style={{
          alignSelf: "flex-start",
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: "1rem",
          fontWeight: "700",
          color: "var(--color-primary)",
          padding: "8px 0"
        }}
      >
        <ArrowLeft size={18} />
        <span>Back</span>
      </button>

      <div>
        <p className="eyebrow">Assigned Facility</p>
        <h1>Warehouse Contact</h1>
      </div>

      {/* Warehouse Detail Card */}
      <div className="farmer-card" style={{ gap: "16px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <h2 style={{ fontSize: "1.25rem", color: "var(--color-ink)", fontWeight: "800" }}>{warehouseName}</h2>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.9375rem", color: "var(--color-text-muted)" }}>
            <MapPin size={16} style={{ color: "var(--color-primary)" }} />
            <span>{warehouseLocation}</span>
          </div>
        </div>

        <div style={{ borderTop: "1px dashed var(--color-line)", paddingTop: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.9375rem" }}>
            <Clock size={16} style={{ color: "var(--color-primary)" }} />
            <div>
              <strong>Opening Days:</strong> Mon – Sat
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.9375rem" }}>
            <div style={{ width: 16 }} />
            <div>
              <strong>Hours:</strong> 7am – 5pm
            </div>
          </div>
        </div>
      </div>

      {/* Deep links to whatsapp/phone */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "10px" }}>
        <a href={`tel:${phone}`} className="btn btn-primary btn-full">
          <Phone size={18} />
          <span>Call {agentName}</span>
        </a>
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-secondary btn-full"
          style={{ borderColor: "#25D366", color: "#128C7E", background: "#E8F9EE" }}
        >
          <MessageSquare size={18} style={{ stroke: "#128C7E" }} />
          <span>WhatsApp Chat</span>
        </a>
      </div>

      <div className="attention-card" style={{ backgroundColor: "var(--color-info-bg)", borderColor: "var(--color-info-border)", color: "var(--color-info)" }}>
        <div className="attention-body">
          <span className="attention-title" style={{ color: "var(--color-info)" }}>Note on Communications</span>
          <span className="attention-text">
            For rapid support regarding quantity discrepancies or fee calculations, please call during standard operating hours (7:00 AM to 5:00 PM).
          </span>
        </div>
      </div>
    </div>
  );
}

// packages/dashboard-ui/src/components/DataTable.tsx
"use client";

import { useState, useMemo } from "react";
import type { ChangeEvent, ReactNode } from "react";
import { gray, palette, status } from "@kuapa-dwaso/design-tokens";

export type Column<T> = {
  key: string;
  header: string;
  align?: "left" | "right";
  type?: "text" | "numeric";
  render?: (row: T) => ReactNode;
};

export type FilterOption = {
  value: string;
  label: string;
};

export type TableFilter = {
  key: string;
  label: string;
  options: FilterOption[];
};

export type BulkAction<T> = {
  label: string;
  onClick: (selectedRows: T[]) => void;
  styleType?: "danger" | "primary" | "secondary";
};

export type DataTableProps<T> = {
  data: T[];
  columns: Column<T>[];
  searchKey?: keyof T;
  searchPlaceholder?: string;
  filters?: TableFilter[];
  bulkActions?: BulkAction<T>[];
  drawerTitle?: string | ((row: T) => string);
  drawerContent?: (row: T, onClose: () => void) => ReactNode;
  rowIdKey: keyof T;
};

export function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  searchKey,
  searchPlaceholder = "Search records...",
  filters = [],
  bulkActions = [],
  drawerTitle,
  drawerContent,
  rowIdKey,
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [activeDrawerRow, setActiveDrawerRow] = useState<T | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(10);

  // Reset page when search or filters change
  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  const handleFilterChange = (filterKey: string, value: string) => {
    setActiveFilters((prev) => {
      const updated = { ...prev };
      if (!value) {
        delete updated[filterKey];
      } else {
        updated[filterKey] = value;
      }
      return updated;
    });
    setCurrentPage(1);
  };

  const handleRemoveFilter = (filterKey: string) => {
    setActiveFilters((prev) => {
      const updated = { ...prev };
      delete updated[filterKey];
      return updated;
    });
    setCurrentPage(1);
  };

  const handleClearAllFilters = () => {
    setActiveFilters({});
    setSearchQuery("");
    setCurrentPage(1);
  };

  // Filter & Search Data
  const filteredData = useMemo(() => {
    return data.filter((row) => {
      // 1. Search Query
      if (searchKey && searchQuery) {
        const val = String(row[searchKey] || "").toLowerCase();
        if (!val.includes(searchQuery.toLowerCase())) {
          return false;
        }
      }

      // 2. Dropdown Filters
      for (const filter of filters) {
        const activeVal = activeFilters[filter.key];
        if (activeVal) {
          const rowVal = String(row[filter.key] || "");
          if (rowVal !== activeVal) {
            return false;
          }
        }
      }

      return true;
    });
  }, [data, searchQuery, activeFilters, filters, searchKey]);

  // Paginated Data
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredData.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredData, currentPage, rowsPerPage]);

  const totalPages = Math.ceil(filteredData.length / rowsPerPage) || 1;

  // Selection handlers
  const handleSelectAll = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const ids = paginatedData.map((row) => String(row[rowIdKey]));
      setSelectedRowIds(new Set(ids));
    } else {
      setSelectedRowIds(new Set());
    }
  };

  const handleSelectRow = (e: ChangeEvent<HTMLInputElement>, rowId: string) => {
    e.stopPropagation();
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (e.target.checked) {
        next.add(rowId);
      } else {
        next.delete(rowId);
      }
      return next;
    });
  };

  const selectedRowsList = useMemo(() => {
    return data.filter((row) => selectedRowIds.has(String(row[rowIdKey])));
  }, [data, selectedRowIds, rowIdKey]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", width: "100%", position: "relative" }}>
      
      {/* Search and Filters Toolbar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          backgroundColor: gray[0],
          padding: "12px 16px",
          borderRadius: "8px",
          border: `1px solid ${gray[100]}`,
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", flex: 1, minWidth: "280px" }}>
          {searchKey && (
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder={searchPlaceholder}
              style={{
                padding: "8px 12px",
                border: `1px solid ${gray[300]}`,
                borderRadius: "6px",
                fontSize: "0.875rem",
                outline: "none",
                width: "220px",
              }}
            />
          )}

          {filters.map((filter) => (
            <select
              key={filter.key}
              value={activeFilters[filter.key] || ""}
              onChange={(e) => handleFilterChange(filter.key, e.target.value)}
              style={{
                padding: "8px 12px",
                border: `1px solid ${gray[300]}`,
                borderRadius: "6px",
                fontSize: "0.875rem",
                backgroundColor: "white",
                outline: "none",
                cursor: "pointer",
              }}
            >
              <option value="">{filter.label}</option>
              {filter.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ))}
        </div>

        <div style={{ fontSize: "0.875rem", color: gray[500], fontWeight: 500 }}>
          Showing {filteredData.length} records
        </div>
      </div>

      {/* Active Filter Chips */}
      {(Object.keys(activeFilters).length > 0 || searchQuery) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
          <span style={{ fontSize: "0.75rem", color: gray[500], fontWeight: 600 }}>Active Filters:</span>
          {searchQuery && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                backgroundColor: gray[50],
                border: `1px solid ${gray[100]}`,
                padding: "2px 8px",
                borderRadius: "4px",
                fontSize: "0.75rem",
                color: gray[700],
              }}
            >
              Search: &quot;{searchQuery}&quot;
              <button
                onClick={() => setSearchQuery("")}
                style={{ background: "none", border: 0, color: gray[500], cursor: "pointer", fontWeight: 700 }}
              >
                ×
              </button>
            </span>
          )}
          {Object.entries(activeFilters).map(([key, val]) => {
            const filterDef = filters.find((f) => f.key === key);
            const label = filterDef?.options.find((o) => o.value === val)?.label || val;
            return (
              <span
                key={key}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  backgroundColor: gray[50],
                  border: `1px solid ${gray[100]}`,
                  padding: "2px 8px",
                  borderRadius: "4px",
                  fontSize: "0.75rem",
                  color: gray[700],
                }}
              >
                {filterDef?.label}: {label}
                <button
                  onClick={() => handleRemoveFilter(key)}
                  style={{ background: "none", border: 0, color: gray[500], cursor: "pointer", fontWeight: 700 }}
                >
                  ×
                </button>
              </span>
            );
          })}
          <button
            onClick={handleClearAllFilters}
            style={{
              background: "none",
              border: 0,
              color: palette.sky,
              fontSize: "0.75rem",
              fontWeight: 600,
              cursor: "pointer",
              padding: "2px 4px",
            }}
          >
            Clear All
          </button>
        </div>
      )}

      {/* Main Table Card */}
      <div
        style={{
          backgroundColor: gray[0],
          borderRadius: "8px",
          border: `1px solid ${gray[100]}`,
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
          overflowX: "auto",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "600px", tableLayout: "auto" }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${gray[100]}`, backgroundColor: gray[50] }}>
              {bulkActions.length > 0 && (
                <th style={{ width: "48px", padding: "12px 16px", textAlign: "left" }}>
                  <input
                    type="checkbox"
                    onChange={handleSelectAll}
                    checked={paginatedData.length > 0 && paginatedData.every((row) => selectedRowIds.has(String(row[rowIdKey])))}
                    style={{ cursor: "pointer" }}
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{
                    padding: "12px 16px",
                    textAlign: col.align || (col.type === "numeric" ? "right" : "left"),
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: gray[500],
                    whiteSpace: "nowrap",
                  }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (bulkActions.length > 0 ? 1 : 0)}
                  style={{ textAlign: "center", padding: "40px", color: gray[500], fontSize: "0.875rem" }}
                >
                  No records found matching the criteria.
                </td>
              </tr>
            ) : (
              paginatedData.map((row, index) => {
                const rowId = String(row[rowIdKey]);
                const isSelected = selectedRowIds.has(rowId);
                const isEven = index % 2 === 0;

                return (
                  <tr
                    key={rowId}
                    onClick={() => {
                      if (drawerContent) setActiveDrawerRow(row);
                    }}
                    style={{
                      height: "44px",
                      borderBottom: `1px solid ${gray[100]}`,
                      backgroundColor: isSelected ? "#f0fdf4" : isEven ? gray[0] : gray[25],
                      cursor: drawerContent ? "pointer" : "default",
                      transition: "background-color 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = isEven ? gray[25] : "#eef0f3";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = isEven ? gray[0] : gray[25];
                      }
                    }}
                  >
                    {bulkActions.length > 0 && (
                      <td
                        onClick={(e) => e.stopPropagation()}
                        style={{ padding: "8px 16px", verticalAlign: "middle" }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleSelectRow(e, rowId)}
                          style={{ cursor: "pointer" }}
                        />
                      </td>
                    )}
                    {columns.map((col) => {
                      const align = col.align || (col.type === "numeric" ? "right" : "left");
                      return (
                        <td
                          key={col.key}
                          style={{
                            padding: "8px 16px",
                            textAlign: align,
                            fontSize: "0.875rem",
                            color: gray[700],
                            fontVariantNumeric: col.type === "numeric" ? "tabular-nums" : "normal",
                            whiteSpace: "nowrap",
                            fontWeight: 500,
                          }}
                        >
                          {col.render ? col.render(row) : String(row[col.key] ?? "")}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Bulk Actions Floating Bar */}
      {selectedRowIds.size > 0 && bulkActions.length > 0 && (
        <div
          style={{
            position: "sticky",
            bottom: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: gray[900],
            border: `1px solid ${gray[700]}`,
            color: "white",
            padding: "12px 24px",
            borderRadius: "50px",
            display: "flex",
            alignItems: "center",
            gap: "20px",
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.3)",
            zIndex: 100,
            animation: "slideUp 0.2s ease-out",
          }}
        >
          <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>
            {selectedRowIds.size} row{selectedRowIds.size > 1 ? "s" : ""} selected
          </span>
          <div style={{ display: "flex", gap: "10px" }}>
            {bulkActions.map((action, i) => (
              <button
                key={i}
                onClick={() => {
                  action.onClick(selectedRowsList);
                  setSelectedRowIds(new Set());
                }}
                style={{
                  background: action.styleType === "danger" ? status.danger : palette.field,
                  border: 0,
                  borderRadius: "20px",
                  color: "white",
                  padding: "6px 14px",
                  fontSize: "0.8125rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {action.label}
              </button>
            ))}
            <button
              onClick={() => setSelectedRowIds(new Set())}
              style={{
                background: "transparent",
                border: "1px solid rgba(255, 255, 255, 0.3)",
                borderRadius: "20px",
                color: "white",
                padding: "6px 14px",
                fontSize: "0.8125rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 4px" }}>
          <div style={{ fontSize: "0.8125rem", color: gray[500], fontWeight: 500 }}>
            Page {currentPage} of {totalPages}
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              style={{
                padding: "6px 12px",
                border: `1px solid ${gray[300]}`,
                borderRadius: "6px",
                backgroundColor: currentPage === 1 ? gray[50] : "white",
                color: currentPage === 1 ? gray[300] : gray[700],
                fontSize: "0.8125rem",
                fontWeight: 600,
                cursor: currentPage === 1 ? "not-allowed" : "pointer",
              }}
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              style={{
                padding: "6px 12px",
                border: `1px solid ${gray[300]}`,
                borderRadius: "6px",
                backgroundColor: currentPage === totalPages ? gray[50] : "white",
                color: currentPage === totalPages ? gray[300] : gray[700],
                fontSize: "0.8125rem",
                fontWeight: 600,
                cursor: currentPage === totalPages ? "not-allowed" : "pointer",
              }}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Side Drawer Component */}
      {activeDrawerRow !== null && drawerContent && (
        <div
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            bottom: 0,
            width: "100%",
            maxWidth: "520px",
            backgroundColor: "white",
            boxShadow: "-10px 0 25px -5px rgba(0, 0, 0, 0.1), -8px 0 10px -6px rgba(0, 0, 0, 0.1)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            animation: "slideInRight 0.2s ease-out",
            borderLeft: `1px solid ${gray[100]}`,
          }}
        >
          {/* Drawer Header */}
          <div
            style={{
              padding: "20px 24px",
              borderBottom: `1px solid ${gray[100]}`,
              backgroundColor: gray[25],
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 700, color: gray[900] }}>
                {typeof drawerTitle === "function"
                  ? drawerTitle(activeDrawerRow)
                  : drawerTitle || "Detail View"}
              </h3>
              <span style={{ fontSize: "0.75rem", color: gray[500], fontWeight: 500 }}>
                ID: {String(activeDrawerRow[rowIdKey])}
              </span>
            </div>
            <button
              onClick={() => setActiveDrawerRow(null)}
              style={{
                background: "none",
                border: 0,
                color: gray[500],
                fontSize: "1.5rem",
                cursor: "pointer",
                fontWeight: 300,
                padding: "4px 8px",
              }}
            >
              ✕
            </button>
          </div>

          {/* Drawer Content Area */}
          <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
            {drawerContent(activeDrawerRow, () => setActiveDrawerRow(null))}
          </div>
        </div>
      )}
    </div>
  );
}

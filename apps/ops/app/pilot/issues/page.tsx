"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3 } from "lucide-react";
import { api } from "../../../../../convex/_generated/api";
import { usePilotOperations } from "../../context/PilotOperationsContext";

type IssueRow = {
  _id: string;
  programmeId: string;
  requestId: string;
  issueType: string;
  status: string;
  summary: string;
  nextStep: string;
  deadlineAt?: number;
};

export default function PilotIssuesPage() {
  const { activeProgrammeId } = usePilotOperations();
  const result = useQuery(api.pilotIssues.listAssigned, {}) as IssueRow[] | undefined;
  const issues = (result ?? []).filter(
    (issue) => issue.programmeId === activeProgrammeId && !["resolved", "closed"].includes(issue.status),
  );
  const [now] = useState(() => Date.now());

  return (
    <div className="ops-page-stack">
      <header className="ops-page-header"><div><p className="ops-eyebrow">Programme control</p><h1>Blockers and next actions</h1><p>Every exception has an owner, a reason and a concrete next step.</p></div></header>
      {result === undefined ? (
        <div className="ops-empty-state">Loading blockers…</div>
      ) : issues.length === 0 ? (
        <div className="ops-empty-state"><CheckCircle2 size={30} /><h2>No open blockers</h2><p>This programme has no unresolved issue assigned to you.</p></div>
      ) : (
        <div className="ops-issue-list">
          {issues.map((issue) => {
            const overdue = issue.deadlineAt !== undefined && issue.deadlineAt < now;
            return (
              <article key={issue._id} className="ops-issue-card">
                <div className={`ops-issue-icon ${overdue ? "overdue" : ""}`}>{overdue ? <AlertTriangle size={21} /> : <Clock3 size={21} />}</div>
                <div><div className="ops-issue-heading"><strong>{issue.summary}</strong><span className={`badge ${overdue ? "badge-danger" : "badge-warning"}`}>{overdue ? "Overdue" : issue.status.replaceAll("_", " ")}</span></div><p>{issue.nextStep}</p><small>{issue.issueType.replaceAll("_", " ")}{issue.deadlineAt === undefined ? "" : ` · due ${new Date(issue.deadlineAt).toLocaleString("en-GH")}`}</small></div>
                <Link href={`/pilot/requests/${issue.requestId}`} aria-label="Open request"><ArrowRight size={19} /></Link>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

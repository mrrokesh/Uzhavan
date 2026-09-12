import { useEffect, type ReactNode } from "react";
import { titleCase } from "../lib/format";

export function Spinner() {
  return (
    <div className="center">
      <span className="spinner" />
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

type Tone = "green" | "amber" | "red" | "blue" | "solid" | "grey";

export function Badge({ tone = "grey", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`badge ${tone === "grey" ? "" : tone}`}>{children}</span>;
}

const ACCOUNT_TONE: Record<string, Tone> = {
  ACTIVE: "green",
  SUSPENDED: "amber",
  BLOCKED: "red",
};

const KYC_TONE: Record<string, Tone> = {
  VERIFIED: "green",
  PENDING: "amber",
  REJECTED: "red",
  UNVERIFIED: "grey",
};

const TICKET_TONE: Record<string, Tone> = {
  OPEN: "red",
  ASSIGNED: "amber",
  IN_PROGRESS: "blue",
  WAITING_ON_USER: "grey",
  RESOLVED: "green",
  CLOSED: "grey",
};

const PRIORITY_TONE: Record<string, Tone> = {
  URGENT: "red",
  HIGH: "amber",
  NORMAL: "grey",
  LOW: "grey",
};

export const StatusBadge = ({ status }: { status: string }) => (
  <Badge tone={ACCOUNT_TONE[status] ?? "grey"}>{titleCase(status)}</Badge>
);

export const KycBadge = ({ status }: { status: string }) => (
  <Badge tone={KYC_TONE[status] ?? "grey"}>{titleCase(status)}</Badge>
);

export const TicketBadge = ({ status }: { status: string }) => (
  <Badge tone={TICKET_TONE[status] ?? "grey"}>{titleCase(status)}</Badge>
);

export const PriorityBadge = ({ priority }: { priority: string }) => (
  <Badge tone={PRIORITY_TONE[priority] ?? "grey"}>{titleCase(priority)}</Badge>
);

export function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="backdrop" onClick={onClose}>
      <div className={`modal${wide ? " wide" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint ? (
        <p className="small muted" style={{ marginTop: 5 }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Card({
  title,
  action,
  children,
  padded = true,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  padded?: boolean;
}) {
  return (
    <div className="card">
      {title ? (
        <div className="card-head">
          <h2>{title}</h2>
          {action}
        </div>
      ) : null}
      {padded ? <div className="card-body">{children}</div> : children}
    </div>
  );
}

/** Shown where a page exists but this staff member lacks the permission. */
export function NoAccess({ what }: { what: string }) {
  return (
    <Empty>
      <h2 style={{ marginBottom: 6 }}>Not available to you</h2>
      <p className="muted">You don’t have permission to {what}. Ask an admin if you need it.</p>
    </Empty>
  );
}

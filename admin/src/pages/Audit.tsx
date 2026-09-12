import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { fullDate, titleCase, when } from "../lib/format";
import { Badge, Card, Empty, NoAccess, Spinner } from "../components/ui";
import type { AuditEntry } from "../lib/types";

/** Destructive or sensitive actions get a red badge so they stand out. */
const SEVERE = new Set([
  "ACCOUNT_BLOCKED",
  "ACCOUNT_SUSPENDED",
  "STAFF_REMOVED",
  "KYC_REJECTED",
  "APP_RELEASE_PUBLISHED",
]);

export function Audit() {
  const { can } = useAuth();

  const log = useQuery({
    queryKey: ["audit"],
    queryFn: () => api<AuditEntry[]>("/admin/audit?limit=200"),
    enabled: can("ADMIN_AUDIT_VIEW"),
    refetchInterval: 60_000,
  });

  if (!can("ADMIN_AUDIT_VIEW")) return <NoAccess what="view the audit log" />;

  const rows = log.data ?? [];

  return (
    <>
      <h1>Audit log</h1>
      <p className="muted" style={{ marginTop: 4, marginBottom: 18 }}>
        Every privileged action, with who did it and what changed. Append-only — nothing here can be
        edited or deleted.
      </p>

      <Card padded={false}>
        {log.isLoading ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <Empty>Nothing recorded yet.</Empty>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 190 }}>Action</th>
                <th>What happened</th>
                <th style={{ width: 150 }}>Who</th>
                <th style={{ width: 160 }}>When</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                const before = e.metadata?.before;
                const after = e.metadata?.after;
                return (
                  <tr key={e.id}>
                    <td>
                      <Badge tone={SEVERE.has(e.action) ? "red" : "grey"}>
                        {titleCase(e.action)}
                      </Badge>
                    </td>
                    <td>
                      {e.summary}
                      {before !== undefined && after !== undefined ? (
                        <span className="sub mono">
                          {String(before)} → {String(after)}
                        </span>
                      ) : null}
                    </td>
                    <td>
                      {e.actor ? (
                        <>
                          {e.actor.name}
                          <span className="sub">{titleCase(e.actor.role)}</span>
                        </>
                      ) : (
                        <span className="faint">System</span>
                      )}
                    </td>
                    <td className="muted" title={fullDate(e.createdAt)}>
                      {when(e.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, errorText, fetchDocument } from "../lib/api";
import { useAuth } from "../lib/auth";
import { bytes, titleCase, when } from "../lib/format";
import { Card, Empty, Field, Modal, NoAccess, Spinner } from "../components/ui";
import type { KycDoc, KycRow } from "../lib/types";

/**
 * Documents are encrypted at rest and need an auth header, so each one is
 * fetched as a blob and shown from an object URL. The URL is revoked when the
 * tile unmounts so we don't leak memory while reviewing a long queue.
 */
function DocTile({ doc, onOpen }: { doc: KycDoc; onOpen: (url: string, doc: KycDoc) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let revoked = false;
    let objectUrl: string | null = null;
    fetchDocument(doc.id)
      .then(({ url: u }) => {
        if (revoked) {
          URL.revokeObjectURL(u);
          return;
        }
        objectUrl = u;
        setUrl(u);
      })
      .catch(() => setFailed(true));
    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [doc.id]);

  const isPdf = doc.mimeType === "application/pdf";

  return (
    <div className="doc" onClick={() => url && onOpen(url, doc)}>
      {failed ? (
        <div
          className="center"
          style={{ height: 112, padding: 0, fontSize: 12, color: "var(--danger)" }}
        >
          Couldn’t load
        </div>
      ) : !url ? (
        <div className="center" style={{ height: 112, padding: 0 }}>
          <span className="spinner" />
        </div>
      ) : isPdf ? (
        <div
          className="center"
          style={{ height: 112, padding: 0, background: "var(--cream)", fontSize: 24 }}
        >
          📄
        </div>
      ) : (
        <img src={url} alt={doc.filename} />
      )}
      <div className="cap">
        <b>{titleCase(doc.type)}</b>
        <span className="faint">{bytes(doc.sizeBytes)}</span>
      </div>
    </div>
  );
}

export function Verification() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"PENDING" | "VERIFIED" | "REJECTED">("PENDING");
  const [reviewing, setReviewing] = useState<KycRow | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; doc: KycDoc } | null>(null);

  const queue = useQuery({
    queryKey: ["kyc", tab],
    queryFn: () => api<KycRow[]>(`/verification/queue?status=${tab}`),
    enabled: can("KYC_REVIEW"),
    refetchInterval: 30_000,
  });

  const decide = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: "VERIFIED" | "REJECTED" }) =>
      api(`/verification/queue/${id}`, {
        method: "POST",
        body: { decision, reason: decision === "REJECTED" ? reason.trim() : undefined },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kyc"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
      setReviewing(null);
      setReason("");
      setError(null);
    },
    onError: (err) => setError(errorText(err)),
  });

  if (!can("KYC_REVIEW")) return <NoAccess what="review verification documents" />;

  const rows = queue.data ?? [];

  return (
    <>
      <h1>Verification</h1>
      <p className="muted" style={{ marginTop: 4, marginBottom: 18 }}>
        Check the number against the document before approving. Only verified accounts get the badge
        other users see.
      </p>

      <div className="row" style={{ marginBottom: 14 }}>
        {(["PENDING", "VERIFIED", "REJECTED"] as const).map((t) => (
          <button
            key={t}
            className={tab === t ? "btn btn-sm" : "btn-ghost btn-sm"}
            onClick={() => setTab(t)}
          >
            {titleCase(t)}
          </button>
        ))}
      </div>

      <Card padded={false}>
        {queue.isLoading ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <Empty>
            {tab === "PENDING" ? "Nothing waiting for review." : `No ${tab.toLowerCase()} accounts.`}
          </Empty>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Account</th>
                <th>Type</th>
                <th>Identifier</th>
                <th>Documents</th>
                <th>Submitted</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <b>{r.business ?? r.farm?.name ?? r.name}</b>
                    <span className="sub">
                      {r.name} · {r.email}
                    </span>
                  </td>
                  <td>
                    {titleCase(r.role)}
                    <span className="sub">{r.farm?.location ?? r.district ?? "—"}</span>
                  </td>
                  <td className="mono">
                    {r.gstin ?? r.udyam ?? r.farmerCard ?? "—"}
                    {r.pan ? <span className="sub mono">PAN {r.pan}</span> : null}
                  </td>
                  <td>{r.documents.length}</td>
                  <td className="muted">{when(r.submittedAt)}</td>
                  <td>
                    <button className="btn btn-sm" onClick={() => setReviewing(r)}>
                      {tab === "PENDING" ? "Review" : "View"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {reviewing ? (
        <Modal
          wide
          title={`${reviewing.business ?? reviewing.farm?.name ?? reviewing.name}`}
          onClose={() => {
            setReviewing(null);
            setReason("");
            setError(null);
          }}
          footer={
            tab === "PENDING" ? (
              <>
                <button
                  className="btn-danger"
                  disabled={decide.isPending}
                  onClick={() => {
                    if (reason.trim().length < 3) {
                      setError("Give a reason so they know what to fix.");
                      return;
                    }
                    decide.mutate({ id: reviewing.id, decision: "REJECTED" });
                  }}
                >
                  Reject
                </button>
                <button
                  className="btn"
                  disabled={decide.isPending}
                  onClick={() => decide.mutate({ id: reviewing.id, decision: "VERIFIED" })}
                >
                  {decide.isPending ? "Saving…" : "Approve"}
                </button>
              </>
            ) : null
          }
        >
          <div className="stats" style={{ marginBottom: 16 }}>
            <div className="stat">
              <div className="l">Contact</div>
              <div style={{ fontWeight: 600, marginTop: 3 }}>{reviewing.name}</div>
              <div className="small muted">{reviewing.phone}</div>
              <div className="small muted">{reviewing.email}</div>
            </div>
            <div className="stat">
              <div className="l">
                {reviewing.role === "FARMER" ? "Farmer card" : reviewing.gstin ? "GSTIN" : "Udyam"}
              </div>
              <div className="mono" style={{ fontWeight: 600, marginTop: 3, fontSize: 14 }}>
                {reviewing.gstin ?? reviewing.udyam ?? reviewing.farmerCard ?? "—"}
              </div>
              {reviewing.pan ? <div className="small muted mono">PAN {reviewing.pan}</div> : null}
            </div>
          </div>

          <h3 style={{ marginBottom: 9 }}>Documents</h3>
          {reviewing.documents.length === 0 ? (
            <p className="muted small">No documents attached.</p>
          ) : (
            <div className="docs">
              {reviewing.documents.map((d) => (
                <DocTile key={d.id} doc={d} onOpen={(url, doc) => setPreview({ url, doc })} />
              ))}
            </div>
          )}
          <p className="small faint" style={{ marginTop: 8 }}>
            Click a document to see it full size.
          </p>

          {tab === "PENDING" ? (
            <div style={{ marginTop: 18 }}>
              <Field
                label="Reason (required to reject)"
                hint="The applicant sees this, so say what would fix it."
              >
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="The certificate is expired — upload a current one."
                />
              </Field>
            </div>
          ) : null}

          {error ? (
            <p className="err" style={{ marginTop: 12 }}>
              {error}
            </p>
          ) : null}
        </Modal>
      ) : null}

      {preview ? (
        <Modal wide title={preview.doc.filename} onClose={() => setPreview(null)}>
          {preview.doc.mimeType === "application/pdf" ? (
            <iframe
              src={preview.url}
              title={preview.doc.filename}
              style={{ width: "100%", height: "70vh", border: 0 }}
            />
          ) : (
            <img
              src={preview.url}
              alt={preview.doc.filename}
              style={{ width: "100%", borderRadius: 8 }}
            />
          )}
        </Modal>
      ) : null}
    </>
  );
}

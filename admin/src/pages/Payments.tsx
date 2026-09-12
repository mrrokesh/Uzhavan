import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, errorText } from "../lib/api";
import { useAuth } from "../lib/auth";
import { when } from "../lib/format";
import { Badge, Card, Field, Modal, NoAccess, Spinner } from "../components/ui";
import type { Gateway } from "../lib/types";

type AddDraft = {
  label: string;
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  activate: boolean;
};

const blank: AddDraft = {
  label: "",
  keyId: "",
  keySecret: "",
  webhookSecret: "",
  activate: false,
};

/**
 * Razorpay accounts. The point of holding more than one is that if an account
 * gets frozen, payments move to another without a release — so the switch has
 * to be one click, and adding a spare has to be possible before it's urgent.
 */
export function Payments() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const [adding, setAdding] = useState<AddDraft | null>(null);
  const [secretFor, setSecretFor] = useState<Gateway | null>(null);
  const [webhookSecret, setWebhookSecret] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isAdmin = !!session?.isAdmin;

  const list = useQuery({
    queryKey: ["gateways"],
    queryFn: () => api<Gateway[]>("/admin/gateways"),
    enabled: isAdmin,
  });

  const done = () => {
    qc.invalidateQueries({ queryKey: ["gateways"] });
    setAdding(null);
    setSecretFor(null);
    setWebhookSecret("");
    setError(null);
  };

  const add = useMutation({
    mutationFn: (d: AddDraft) =>
      api("/admin/gateways", {
        method: "POST",
        body: {
          label: d.label,
          keyId: d.keyId,
          keySecret: d.keySecret,
          ...(d.webhookSecret ? { webhookSecret: d.webhookSecret } : {}),
          activate: d.activate,
        },
      }),
    onSuccess: done,
    onError: (err) => setError(errorText(err)),
  });

  const activate = useMutation({
    mutationFn: (id: string) => api(`/admin/gateways/${id}/activate`, { method: "POST" }),
    onSuccess: done,
    onError: (err) => setError(errorText(err)),
  });

  const setSecret = useMutation({
    mutationFn: ({ id, secret }: { id: string; secret: string }) =>
      api(`/admin/gateways/${id}`, { method: "PATCH", body: { webhookSecret: secret } }),
    onSuccess: done,
    onError: (err) => setError(errorText(err)),
  });

  // The server refuses to remove the active account, or one that has taken
  // money. Both come back as a plain message, so just show what it says.
  const remove = useMutation({
    mutationFn: (id: string) => api(`/admin/gateways/${id}`, { method: "DELETE" }),
    onSuccess: done,
    onError: (err) => setError(errorText(err)),
  });

  // Switching who takes the money is deliberately admin-only, and not
  // delegable — see ADMIN_ONLY in the server's permissions.
  if (!isAdmin) return <NoAccess what="manage payment accounts" />;

  const rows = list.data ?? [];
  const live = rows.find((g) => g.active) ?? null;

  return (
    <>
      <div className="row" style={{ alignItems: "flex-start" }}>
        <div className="grow">
          <h1>Payments</h1>
          <p className="muted" style={{ marginTop: 4, marginBottom: 18 }}>
            The Razorpay account money goes through. Keep a spare configured — if one is frozen you
            can switch in a click instead of shipping a release.
          </p>
        </div>
        <button className="btn" onClick={() => setAdding({ ...blank })}>
          Add an account
        </button>
      </div>

      {error ? <p className="err">{error}</p> : null}

      {!list.isLoading && !live ? (
        <Card>
          <p className="err" style={{ margin: 0 }}>
            No account is active. Checkout will fail until one is switched on.
          </p>
        </Card>
      ) : null}

      {live && !live.hasWebhookSecret ? (
        <Card>
          <p style={{ margin: 0 }}>
            <Badge tone="amber">Check this</Badge>{" "}
            The active account has no webhook secret, so Razorpay’s callbacks can’t be verified and
            payment confirmation rests on the client alone. Add one below.
          </p>
        </Card>
      ) : null}

      {list.isLoading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <Card>
          <p className="muted">
            No Razorpay accounts yet. Add one with its key id and secret — the secret is encrypted
            and never sent back to this console.
          </p>
        </Card>
      ) : (
        <Card padded={false}>
          <table>
            <thead>
              <tr>
                <th>Account</th>
                <th style={{ width: 90 }}>Mode</th>
                <th style={{ width: 230 }}>Key id</th>
                <th style={{ width: 140 }}>Webhook</th>
                <th style={{ width: 230 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((g) => (
                <tr key={g.id}>
                  <td>
                    <strong>{g.label}</strong>
                    {g.active ? (
                      <>
                        {" "}
                        <Badge tone="green">Active</Badge>
                      </>
                    ) : null}
                    <div className="small muted" style={{ marginTop: 3 }}>
                      Added {when(g.createdAt)}
                    </div>
                  </td>
                  <td>
                    <Badge tone={g.mode === "LIVE" ? "red" : "blue"}>{g.mode}</Badge>
                  </td>
                  <td>
                    <code className="small">{g.keyId}</code>
                  </td>
                  <td>
                    {g.hasWebhookSecret ? (
                      <Badge tone="green">Set</Badge>
                    ) : (
                      <Badge tone="amber">Missing</Badge>
                    )}
                  </td>
                  <td>
                    <div className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
                      <button
                        className="btn-ghost btn-sm"
                        onClick={() => {
                          setSecretFor(g);
                          setWebhookSecret("");
                        }}
                      >
                        {g.hasWebhookSecret ? "Replace secret" : "Add secret"}
                      </button>
                      {!g.active ? (
                        <button
                          className="btn-ghost btn-sm"
                          onClick={() => {
                            const warn =
                              g.mode === "LIVE"
                                ? `Switch live payments to "${g.label}"? Real money will go through this account from the next checkout.`
                                : `Switch payments to "${g.label}" (TEST mode)? Real cards will stop working until you switch back.`;
                            if (window.confirm(warn)) activate.mutate(g.id);
                          }}
                        >
                          Make active
                        </button>
                      ) : null}
                      {!g.active ? (
                        <button
                          className="btn-danger btn-sm"
                          onClick={() => {
                            if (window.confirm(`Remove "${g.label}"?`)) remove.mutate(g.id);
                          }}
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {adding ? (
        <Modal
          title="Add a Razorpay account"
          onClose={() => setAdding(null)}
          footer={
            <>
              <button className="btn-ghost" onClick={() => setAdding(null)}>
                Cancel
              </button>
              <button
                className="btn"
                disabled={
                  add.isPending ||
                  adding.label.trim().length < 2 ||
                  !adding.keyId.trim() ||
                  !adding.keySecret.trim()
                }
                onClick={() => add.mutate(adding)}
              >
                {add.isPending ? "Saving…" : "Save account"}
              </button>
            </>
          }
        >
          <Field label="Name it something you'll recognise">
            <input
              value={adding.label}
              placeholder="Razorpay — main account"
              onChange={(e) => setAdding({ ...adding, label: e.target.value })}
            />
          </Field>

          <Field
            label="Key id"
            hint="Starts rzp_test_ for a test account, rzp_live_ for a real one. The mode is read from this — you don't set it separately."
          >
            <input
              value={adding.keyId}
              placeholder="rzp_test_XXXXXXXXXXXXXX"
              onChange={(e) => setAdding({ ...adding, keyId: e.target.value })}
            />
          </Field>

          <Field label="Key secret" hint="Encrypted before it's stored. It is never sent back here.">
            <input
              type="password"
              value={adding.keySecret}
              autoComplete="off"
              onChange={(e) => setAdding({ ...adding, keySecret: e.target.value })}
            />
          </Field>

          <Field
            label="Webhook secret (optional now, needed before real money)"
            hint="Without it, Razorpay's server-to-server confirmation can't be verified."
          >
            <input
              type="password"
              value={adding.webhookSecret}
              autoComplete="off"
              onChange={(e) => setAdding({ ...adding, webhookSecret: e.target.value })}
            />
          </Field>

          <label className="row" style={{ gap: 8, marginTop: 4 }}>
            <input
              type="checkbox"
              checked={adding.activate}
              onChange={(e) => setAdding({ ...adding, activate: e.target.checked })}
            />
            <span>Make this the active account straight away</span>
          </label>

          {error ? <p className="err">{error}</p> : null}
        </Modal>
      ) : null}

      {secretFor ? (
        <Modal
          title={`Webhook secret · ${secretFor.label}`}
          onClose={() => setSecretFor(null)}
          footer={
            <>
              <button className="btn-ghost" onClick={() => setSecretFor(null)}>
                Cancel
              </button>
              <button
                className="btn"
                disabled={setSecret.isPending || webhookSecret.trim().length < 8}
                onClick={() => setSecret.mutate({ id: secretFor.id, secret: webhookSecret })}
              >
                {setSecret.isPending ? "Saving…" : "Save secret"}
              </button>
            </>
          }
        >
          <Field
            label="Webhook secret"
            hint="Copy it from the Razorpay dashboard under Settings → Webhooks. At least 8 characters."
          >
            <input
              type="password"
              value={webhookSecret}
              autoComplete="off"
              onChange={(e) => setWebhookSecret(e.target.value)}
            />
          </Field>
          {error ? <p className="err">{error}</p> : null}
        </Modal>
      ) : null}
    </>
  );
}

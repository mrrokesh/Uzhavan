import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, errorText } from "../lib/api";
import { useAuth } from "../lib/auth";
import { when } from "../lib/format";
import { Badge, Card, Field, Modal, NoAccess, Spinner } from "../components/ui";
import type { AdminAnnouncement, Audience } from "../lib/types";

const AUDIENCES: { key: Audience; label: string }[] = [
  { key: "ALL", label: "Everyone" },
  { key: "FARMERS", label: "Farmers" },
  { key: "BUYERS", label: "Buyers" },
  { key: "DRIVERS", label: "Drivers" },
];

type Draft = {
  id?: string;
  title: string;
  body: string;
  audience: Audience;
  pinned: boolean;
  publish: boolean;
  expiresAt: string;
};

const blank: Draft = {
  title: "",
  body: "",
  audience: "ALL",
  pinned: false,
  publish: true,
  expiresAt: "",
};

export function Announcements() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["announcements"],
    queryFn: () => api<AdminAnnouncement[]>("/admin/announcements"),
    enabled: can("CONFIG_WRITE"),
  });

  const done = () => {
    qc.invalidateQueries({ queryKey: ["announcements"] });
    setDraft(null);
    setError(null);
  };

  const save = useMutation({
    mutationFn: (d: Draft) => {
      const body = {
        title: d.title,
        body: d.body,
        audience: d.audience,
        pinned: d.pinned,
        publish: d.publish,
        // datetime-local gives "2026-09-30T18:00"; the server wants ISO.
        expiresAt: d.expiresAt ? new Date(d.expiresAt).toISOString() : null,
      };
      return d.id
        ? api(`/admin/announcements/${d.id}`, { method: "PATCH", body })
        : api("/admin/announcements", { method: "POST", body });
    },
    onSuccess: done,
    onError: (err) => setError(errorText(err)),
  });

  const setPublished = useMutation({
    mutationFn: ({ id, publish }: { id: string; publish: boolean }) =>
      api(`/admin/announcements/${id}`, { method: "PATCH", body: { publish } }),
    onSuccess: done,
    onError: (err) => setError(errorText(err)),
  });

  const setPinned = useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) =>
      api(`/admin/announcements/${id}`, { method: "PATCH", body: { pinned } }),
    onSuccess: done,
    onError: (err) => setError(errorText(err)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/admin/announcements/${id}`, { method: "DELETE" }),
    onSuccess: done,
    onError: (err) => setError(errorText(err)),
  });

  if (!can("CONFIG_WRITE")) return <NoAccess what="write announcements" />;

  const rows = list.data ?? [];

  return (
    <>
      <div className="row" style={{ alignItems: "flex-start" }}>
        <div className="grow">
          <h1>Announcements</h1>
          <p className="muted" style={{ marginTop: 4, marginBottom: 18 }}>
            Notices that appear on the bell in the apps. Published ones go out immediately — there’s
            no scheduling, so save a draft if it isn’t ready.
          </p>
        </div>
        <button className="btn" onClick={() => setDraft({ ...blank })}>
          Write a notice
        </button>
      </div>

      {error ? <p className="err">{error}</p> : null}

      {list.isLoading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <Card>
          <p className="muted">
            Nothing written yet. A notice is the only way to reach everyone at once — price
            changes, holidays, a new feature.
          </p>
        </Card>
      ) : (
        <Card padded={false}>
          <table>
            <thead>
              <tr>
                <th>Notice</th>
                <th style={{ width: 110 }}>Audience</th>
                <th style={{ width: 130 }}>Read</th>
                <th style={{ width: 150 }}>State</th>
                <th style={{ width: 210 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const live = !!a.publishedAt;
                const lapsed = !!a.expiresAt && new Date(a.expiresAt) < new Date();
                const pct = a.audienceSize
                  ? Math.round((a.reads / a.audienceSize) * 100)
                  : 0;
                return (
                  <tr key={a.id}>
                    <td>
                      <strong>{a.title}</strong>
                      {a.pinned ? (
                        <>
                          {" "}
                          <Badge tone="amber">Pinned</Badge>
                        </>
                      ) : null}
                      <div className="small muted" style={{ marginTop: 3 }}>
                        {a.body.length > 110 ? `${a.body.slice(0, 110)}…` : a.body}
                      </div>
                      <div className="small muted" style={{ marginTop: 3 }}>
                        {a.author?.name ?? "—"} · {when(a.createdAt)}
                      </div>
                    </td>
                    <td>{AUDIENCES.find((x) => x.key === a.audience)?.label ?? a.audience}</td>
                    <td>
                      {a.reads} of {a.audienceSize}
                      <div className="small muted">{pct}%</div>
                    </td>
                    <td>
                      {lapsed ? (
                        <Badge tone="grey">Expired</Badge>
                      ) : live ? (
                        <Badge tone="green">Live</Badge>
                      ) : (
                        <Badge tone="amber">Draft</Badge>
                      )}
                      {a.expiresAt && !lapsed ? (
                        <div className="small muted" style={{ marginTop: 3 }}>
                          until {when(a.expiresAt)}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <div className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
                        <button
                          className="btn-ghost btn-sm"
                          onClick={() =>
                            setDraft({
                              id: a.id,
                              title: a.title,
                              body: a.body,
                              audience: a.audience,
                              pinned: a.pinned,
                              publish: live,
                              expiresAt: a.expiresAt ? a.expiresAt.slice(0, 16) : "",
                            })
                          }
                        >
                          Edit
                        </button>
                        <button
                          className="btn-ghost btn-sm"
                          onClick={() => setPublished.mutate({ id: a.id, publish: !live })}
                        >
                          {live ? "Unpublish" : "Publish"}
                        </button>
                        <button
                          className="btn-ghost btn-sm"
                          onClick={() => setPinned.mutate({ id: a.id, pinned: !a.pinned })}
                        >
                          {a.pinned ? "Unpin" : "Pin"}
                        </button>
                        <button
                          className="btn-danger btn-sm"
                          onClick={() => {
                            if (window.confirm(`Delete "${a.title}"? This can't be undone.`)) {
                              remove.mutate(a.id);
                            }
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {draft ? (
        <Modal
          title={draft.id ? "Edit notice" : "Write a notice"}
          onClose={() => setDraft(null)}
          footer={
            <>
              <button className="btn-ghost" onClick={() => setDraft(null)}>
                Cancel
              </button>
              <button
                className="btn"
                disabled={save.isPending || draft.title.trim().length < 4 || draft.body.trim().length < 10}
                onClick={() => save.mutate(draft)}
              >
                {save.isPending ? "Saving…" : draft.publish ? "Publish" : "Save draft"}
              </button>
            </>
          }
        >
          <Field label="Title">
            <input
              value={draft.title}
              maxLength={120}
              placeholder="Mandi closed on Friday"
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </Field>

          <Field label="Message" hint="Plain text. Keep it short — it's read on a phone.">
            <textarea
              rows={5}
              maxLength={2000}
              value={draft.body}
              placeholder="Dindigul mandi is closed this Friday for the festival. Plan your dispatches for Thursday."
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            />
          </Field>

          <Field label="Who sees it">
            <select
              value={draft.audience}
              onChange={(e) => setDraft({ ...draft, audience: e.target.value as Audience })}
            >
              {AUDIENCES.map((a) => (
                <option key={a.key} value={a.key}>
                  {a.label}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Stop showing it after (optional)"
            hint="Leave blank to keep it up until you delete it. A notice about a one-off event should expire."
          >
            <input
              type="datetime-local"
              value={draft.expiresAt}
              onChange={(e) => setDraft({ ...draft, expiresAt: e.target.value })}
            />
          </Field>

          <label className="row" style={{ gap: 8, marginTop: 4 }}>
            <input
              type="checkbox"
              checked={draft.pinned}
              onChange={(e) => setDraft({ ...draft, pinned: e.target.checked })}
            />
            <span>Pin to the top of everyone’s list</span>
          </label>

          <label className="row" style={{ gap: 8, marginTop: 8 }}>
            <input
              type="checkbox"
              checked={draft.publish}
              onChange={(e) => setDraft({ ...draft, publish: e.target.checked })}
            />
            <span>Publish now — it reaches phones straight away</span>
          </label>

          {error ? <p className="err">{error}</p> : null}
        </Modal>
      ) : null}
    </>
  );
}

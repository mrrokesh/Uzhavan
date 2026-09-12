import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, errorText } from "../lib/api";
import { useAuth } from "../lib/auth";
import { when } from "../lib/format";
import { Badge, Card, Field, Modal, Spinner } from "../components/ui";
import type { Release } from "../lib/types";

// PARTNER is the stored enum value; "Uzhavan" is what it's called everywhere
// a person can see. Keep the label, not the key, in front of staff.
const APPS = [
  { key: "PARTNER" as const, label: "Uzhavan (farmers & drivers)" },
  { key: "BUYER" as const, label: "Uzhavan Buy (wholesale buyers)" },
];

type Draft = {
  app: "BUYER" | "PARTNER";
  platform: "ANDROID" | "IOS";
  latestVersion: string;
  minSupportedVersion: string;
  releaseNotes: string;
  storeUrl: string;
  mandatory: boolean;
};

export function Releases() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const releases = useQuery({
    queryKey: ["releases"],
    queryFn: () => api<Release[]>("/admin/releases"),
  });

  const publish = useMutation({
    mutationFn: () =>
      api("/admin/releases", {
        method: "PUT",
        body: {
          ...draft,
          releaseNotes: draft?.releaseNotes.trim() || undefined,
          storeUrl: draft?.storeUrl.trim() || undefined,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["releases"] });
      setDraft(null);
      setError(null);
    },
    onError: (err) => setError(errorText(err)),
  });

  const editable = can("ADMIN_APP_RELEASE");
  const rows = releases.data ?? [];

  const open = (app: Draft["app"], platform: Draft["platform"]) => {
    const existing = rows.find((r) => r.app === app && r.platform === platform);
    setDraft({
      app,
      platform,
      latestVersion: existing?.latestVersion ?? "1.0.0",
      minSupportedVersion: existing?.minSupportedVersion ?? "1.0.0",
      releaseNotes: existing?.releaseNotes ?? "",
      storeUrl: existing?.storeUrl ?? "",
      mandatory: existing?.mandatory ?? false,
    });
    setError(null);
  };

  return (
    <>
      <h1>App updates</h1>
      <p className="muted" style={{ marginTop: 4, marginBottom: 18 }}>
        Every app checks this on launch. Below the <b>minimum</b> version it’s blocked until they
        update; behind the <b>latest</b> it just gets a prompt they can dismiss.
      </p>

      {releases.isLoading ? (
        <Spinner />
      ) : (
        APPS.map((app) => (
          <Card key={app.key} title={app.label} padded={false}>
            <table>
              <thead>
                <tr>
                  <th>Platform</th>
                  <th>Latest</th>
                  <th>Minimum supported</th>
                  <th>Behaviour</th>
                  <th>Updated</th>
                  {editable ? <th style={{ width: 90 }} /> : null}
                </tr>
              </thead>
              <tbody>
                {(["ANDROID", "IOS"] as const).map((platform) => {
                  const r = rows.find((x) => x.app === app.key && x.platform === platform);
                  return (
                    <tr key={platform}>
                      <td>
                        <b>{platform === "ANDROID" ? "Android" : "iOS"}</b>
                      </td>
                      <td className="mono">{r?.latestVersion ?? "—"}</td>
                      <td className="mono">{r?.minSupportedVersion ?? "—"}</td>
                      <td>
                        {!r ? (
                          <span className="faint">Not configured</span>
                        ) : r.mandatory ? (
                          <Badge tone="red">Forced for everyone behind {r.latestVersion}</Badge>
                        ) : r.minSupportedVersion === r.latestVersion ? (
                          <Badge tone="amber">Forced below {r.minSupportedVersion}</Badge>
                        ) : (
                          <Badge tone="green">Prompt only, forced below {r.minSupportedVersion}</Badge>
                        )}
                      </td>
                      <td className="muted">{when(r?.updatedAt)}</td>
                      {editable ? (
                        <td>
                          <button className="btn-ghost btn-sm" onClick={() => open(app.key, platform)}>
                            Edit
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        ))
      )}

      {!editable ? (
        <p className="small muted" style={{ marginTop: 12 }}>
          Publishing app updates is an admin-only action.
        </p>
      ) : null}

      {draft ? (
        <Modal
          title={`${draft.app === "BUYER" ? "Uzhavan Buy" : "Uzhavan"} · ${
            draft.platform === "ANDROID" ? "Android" : "iOS"
          }`}
          onClose={() => setDraft(null)}
          footer={
            <>
              <button className="btn-ghost" onClick={() => setDraft(null)}>
                Cancel
              </button>
              <button className="btn" disabled={publish.isPending} onClick={() => publish.mutate()}>
                {publish.isPending ? "Publishing…" : "Publish"}
              </button>
            </>
          }
        >
          <div className="row" style={{ gap: 13, alignItems: "flex-start" }}>
            <div className="grow">
              <Field label="Latest version" hint="The build you just shipped.">
                <input
                  className="mono"
                  value={draft.latestVersion}
                  onChange={(e) => setDraft({ ...draft, latestVersion: e.target.value })}
                  placeholder="1.4.0"
                />
              </Field>
            </div>
            <div className="grow">
              <Field label="Minimum supported" hint="Anything older is blocked from running.">
                <input
                  className="mono"
                  value={draft.minSupportedVersion}
                  onChange={(e) => setDraft({ ...draft, minSupportedVersion: e.target.value })}
                  placeholder="1.2.0"
                />
              </Field>
            </div>
          </div>

          <Field label="What's new" hint="Shown in the update prompt.">
            <input
              value={draft.releaseNotes}
              onChange={(e) => setDraft({ ...draft, releaseNotes: e.target.value })}
              placeholder="Faster search and a fix for truck booking."
            />
          </Field>

          <Field label="Store link" hint="Where the update button sends them.">
            <input
              value={draft.storeUrl}
              onChange={(e) => setDraft({ ...draft, storeUrl: e.target.value })}
              placeholder="https://play.google.com/store/apps/details?id=com.uzhavan.buyer"
            />
          </Field>

          <label
            className={`perm${draft.mandatory ? " on" : ""}`}
            style={{ marginTop: 14, cursor: "pointer" }}
          >
            <input
              type="checkbox"
              checked={draft.mandatory}
              onChange={(e) => setDraft({ ...draft, mandatory: e.target.checked })}
            />
            <span>
              Force this update
              <br />
              <span className="small muted" style={{ fontWeight: 400 }}>
                Everyone below {draft.latestVersion || "the latest version"} is blocked, not just
                those below the minimum. Use for a broken build or a security fix.
              </span>
            </span>
          </label>

          {error ? (
            <p className="err" style={{ marginTop: 12 }}>
              {error}
            </p>
          ) : null}
        </Modal>
      ) : null}
    </>
  );
}

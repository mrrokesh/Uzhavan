import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, errorText } from "../lib/api";
import { useAuth } from "../lib/auth";
import { when } from "../lib/format";
import { Badge, Card, Spinner } from "../components/ui";
import type { Setting } from "../lib/types";

export function Settings() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => api<Setting[]>("/admin/settings"),
  });

  // Seed the editable copy once the real values arrive.
  useEffect(() => {
    if (settings.data) {
      setDraft(Object.fromEntries(settings.data.map((s) => [s.key, s.value])));
    }
  }, [settings.data]);

  const save = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      api<Setting>(`/admin/settings/${key}`, { method: "PUT", body: { value } }),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      setSaved(updated.key);
      setError(null);
      setTimeout(() => setSaved(null), 2500);
    },
    onError: (err) => setError(errorText(err)),
  });

  const editable = can("CONFIG_WRITE");
  const rows = settings.data ?? [];

  return (
    <>
      <h1>Settings</h1>
      <p className="muted" style={{ marginTop: 4, marginBottom: 18 }}>
        The apps read these live. Change a number here and it’s in every phone within seconds — no
        release, no code.
      </p>

      {settings.isLoading ? (
        <Spinner />
      ) : (
        <Card title="Support contact" padded={false}>
          <table>
            <thead>
              <tr>
                <th>Setting</th>
                <th style={{ width: 300 }}>Value</th>
                <th>Last changed</th>
                {editable ? <th style={{ width: 100 }} /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const value = draft[s.key] ?? s.value;
                const dirty = value !== s.value;
                return (
                  <tr key={s.key}>
                    <td>
                      <b>{s.label}</b>
                      {s.description ? <span className="sub">{s.description}</span> : null}
                      {s.isPublic ? (
                        <span className="sub">
                          <Badge tone="blue">Visible in the apps</Badge>
                        </span>
                      ) : null}
                    </td>
                    <td>
                      {editable ? (
                        <input
                          value={value}
                          onChange={(e) => setDraft({ ...draft, [s.key]: e.target.value })}
                        />
                      ) : (
                        <span className="mono">{s.value}</span>
                      )}
                    </td>
                    <td className="muted">
                      {when(s.updatedAt)}
                      {saved === s.key ? (
                        <span className="sub" style={{ color: "var(--forest)" }}>
                          Saved — live now
                        </span>
                      ) : null}
                    </td>
                    {editable ? (
                      <td>
                        <button
                          className="btn btn-sm"
                          disabled={!dirty || save.isPending}
                          onClick={() => save.mutate({ key: s.key, value })}
                        >
                          Save
                        </button>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {!editable ? (
        <p className="small muted" style={{ marginTop: 12 }}>
          You can see these but not change them. An admin can grant “Edit support contact details”.
        </p>
      ) : null}

      {error ? (
        <p className="err" style={{ marginTop: 12 }}>
          {error}
        </p>
      ) : null}
    </>
  );
}

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, errorText } from "../lib/api";
import { useAuth } from "../lib/auth";
import { when } from "../lib/format";
import { Badge, Card, Empty, Field, Modal, NoAccess, Spinner, StatusBadge } from "../components/ui";
import type { Permission, StaffRow } from "../lib/types";

type Catalogue = {
  grantable: { key: Permission; label: string }[];
  adminOnly: { key: Permission; label: string }[];
  defaults: Permission[];
};

export function Staff() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<StaffRow | null>(null);
  const [removing, setRemoving] = useState<StaffRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({ name: "", email: "", phone: "+91 ", password: "" });
  const [selected, setSelected] = useState<Permission[]>([]);

  const staff = useQuery({
    queryKey: ["staff"],
    queryFn: () => api<StaffRow[]>("/admin/staff"),
    enabled: can("ADMIN_STAFF_MANAGE"),
  });

  const catalogue = useQuery({
    queryKey: ["permissions"],
    queryFn: () => api<Catalogue>("/admin/permissions"),
  });

  const done = () => {
    qc.invalidateQueries({ queryKey: ["staff"] });
    setCreating(false);
    setEditing(null);
    setRemoving(null);
    setError(null);
  };

  const create = useMutation({
    mutationFn: () =>
      api("/admin/staff", { method: "POST", body: { ...form, permissions: selected } }),
    onSuccess: done,
    onError: (err) => setError(errorText(err)),
  });

  const savePerms = useMutation({
    mutationFn: () =>
      api(`/admin/staff/${editing!.id}/permissions`, {
        method: "PUT",
        body: { permissions: selected },
      }),
    onSuccess: done,
    onError: (err) => setError(errorText(err)),
  });

  const remove = useMutation({
    mutationFn: () => api(`/admin/staff/${removing!.id}`, { method: "DELETE" }),
    onSuccess: done,
    onError: (err) => setError(errorText(err)),
  });

  if (!can("ADMIN_STAFF_MANAGE")) return <NoAccess what="manage staff" />;

  const rows = staff.data ?? [];
  const cat = catalogue.data;

  const toggle = (p: Permission) =>
    setSelected((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  const openCreate = () => {
    setForm({ name: "", email: "", phone: "+91 ", password: "" });
    setSelected(cat?.defaults ?? []);
    setError(null);
    setCreating(true);
  };

  const openEdit = (row: StaffRow) => {
    setSelected(row.permissions);
    setError(null);
    setEditing(row);
  };

  const PermGrid = () => (
    <>
      <div className="perms">
        {cat?.grantable.map((p) => (
          <label key={p.key} className={`perm${selected.includes(p.key) ? " on" : ""}`}>
            <input
              type="checkbox"
              checked={selected.includes(p.key)}
              onChange={() => toggle(p.key)}
            />
            <span>{p.label}</span>
          </label>
        ))}
      </div>
      <h3 style={{ margin: "18px 0 8px" }}>Admin only</h3>
      <p className="small muted" style={{ marginBottom: 9 }}>
        These can’t be given to staff — otherwise a staff member could promote themselves.
      </p>
      <div className="perms">
        {cat?.adminOnly.map((p) => (
          <div key={p.key} className="perm locked">
            <input type="checkbox" disabled checked={false} readOnly />
            <span>{p.label}</span>
          </div>
        ))}
      </div>
    </>
  );

  return (
    <>
      <div className="row" style={{ marginBottom: 4 }}>
        <h1 className="grow">Staff</h1>
        <button className="btn" onClick={openCreate}>
          Add staff
        </button>
      </div>
      <p className="muted" style={{ marginTop: 4, marginBottom: 18 }}>
        Give each person only what they need. Tickets are auto-assigned to whoever can reply to them.
      </p>

      <Card padded={false}>
        {staff.isLoading ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <Empty>No staff yet.</Empty>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Person</th>
                <th>Role</th>
                <th>Status</th>
                <th>Open tickets</th>
                <th>Permissions</th>
                <th>Joined</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td>
                    <b>{s.name}</b>
                    <span className="sub">{s.email}</span>
                  </td>
                  <td>
                    {s.role === "ADMIN" ? (
                      <Badge tone="solid">Admin</Badge>
                    ) : (
                      <Badge>Staff</Badge>
                    )}
                  </td>
                  <td>
                    <StatusBadge status={s.status} />
                  </td>
                  <td>{s.openTickets}</td>
                  <td className="muted small">
                    {s.role === "ADMIN" ? "Everything" : `${s.permissions.length} granted`}
                  </td>
                  <td className="muted">{when(s.createdAt)}</td>
                  <td>
                    {s.role === "ADMIN" ? (
                      <span className="faint small">—</span>
                    ) : (
                      <div className="row">
                        <button className="btn-ghost btn-sm" onClick={() => openEdit(s)}>
                          Permissions
                        </button>
                        {s.status === "ACTIVE" ? (
                          <button className="btn-danger btn-sm" onClick={() => setRemoving(s)}>
                            Remove
                          </button>
                        ) : null}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {creating ? (
        <Modal
          wide
          title="Add a staff member"
          onClose={() => setCreating(false)}
          footer={
            <>
              <button className="btn-ghost" onClick={() => setCreating(false)}>
                Cancel
              </button>
              <button className="btn" disabled={create.isPending} onClick={() => create.mutate()}>
                {create.isPending ? "Creating…" : "Create account"}
              </button>
            </>
          }
        >
          <div className="row" style={{ gap: 13, alignItems: "flex-start" }}>
            <div className="grow">
              <Field label="Name">
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Priya Raman"
                />
              </Field>
              <Field label="Phone">
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+91 90000 00000"
                />
              </Field>
            </div>
            <div className="grow">
              <Field label="Email">
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="priya@uzhavan.app"
                />
              </Field>
              <Field label="Temporary password" hint="At least 8 characters. Ask them to change it.">
                <input
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                />
              </Field>
            </div>
          </div>

          <h3 style={{ margin: "20px 0 9px" }}>What can they do?</h3>
          <PermGrid />

          {error ? (
            <p className="err" style={{ marginTop: 12 }}>
              {error}
            </p>
          ) : null}
        </Modal>
      ) : null}

      {editing ? (
        <Modal
          wide
          title={`Permissions · ${editing.name}`}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button className="btn-ghost" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button className="btn" disabled={savePerms.isPending} onClick={() => savePerms.mutate()}>
                {savePerms.isPending ? "Saving…" : "Save permissions"}
              </button>
            </>
          }
        >
          <PermGrid />
          {error ? (
            <p className="err" style={{ marginTop: 12 }}>
              {error}
            </p>
          ) : null}
        </Modal>
      ) : null}

      {removing ? (
        <Modal
          title={`Remove ${removing.name}?`}
          onClose={() => setRemoving(null)}
          footer={
            <>
              <button className="btn-ghost" onClick={() => setRemoving(null)}>
                Cancel
              </button>
              <button className="btn-danger" disabled={remove.isPending} onClick={() => remove.mutate()}>
                {remove.isPending ? "Removing…" : "Remove access"}
              </button>
            </>
          }
        >
          <p className="muted">
            They lose access immediately and every permission is cleared.
            {removing.openTickets > 0
              ? ` Their ${removing.openTickets} open ticket${removing.openTickets === 1 ? "" : "s"} will go back to the queue for reassignment.`
              : ""}
          </p>
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

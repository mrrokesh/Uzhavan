import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { fullDate } from "../lib/format";
import { Card, Empty, Spinner } from "../components/ui";

type ClientReport = {
  id: string;
  app: "BUYER" | "PARTNER";
  platform: "ANDROID" | "IOS";
  message: string;
  path: string | null;
  status: number | null;
  userId: string | null;
  createdAt: string;
};

const APP_NAME = { BUYER: "Uzhavan Buy", PARTNER: "Uzhavan" };
const PHONE = { ANDROID: "Android", IOS: "iPhone" };

export function Errors() {
  const log = useQuery({
    queryKey: ["client-errors"],
    queryFn: () => api<ClientReport[]>("/admin/errors"),
    refetchInterval: 30_000,
  });

  const rows = log.data ?? [];

  return (
    <>
      <h1>App errors</h1>
      <p className="muted" style={{ marginTop: 4, marginBottom: 18 }}>
        Failures reported by the phone apps, with which app and which phone they came from.
      </p>
      <Card padded={false}>
        {log.isLoading ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <Empty>No errors reported yet.</Empty>
        ) : (
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>App</th>
                <th>Phone</th>
                <th>What failed</th>
                <th>Request</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="muted">{fullDate(row.createdAt)}</td>
                  <td>{APP_NAME[row.app]}</td>
                  <td>{PHONE[row.platform]}</td>
                  <td>
                    {row.message}
                    {row.status ? <span className="sub">HTTP {row.status}</span> : null}
                  </td>
                  <td className="mono">{row.path ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}

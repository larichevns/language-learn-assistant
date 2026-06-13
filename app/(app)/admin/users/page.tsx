'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch } from '@/lib/api/client';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/feedback';

interface UserRow {
  id: string;
  email: string | null;
  name: string | null;
  role: 'USER' | 'ADMIN';
  tier: string;
}

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin-users'], queryFn: () => apiGet<{ items: UserRow[] }>('/api/admin/users?pageSize=100') });

  const update = useMutation({
    mutationFn: (v: { id: string; role?: string; tier?: string }) => apiPatch(`/api/admin/users/${v.id}`, { role: v.role, tier: v.tier }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-muted-foreground">
            <tr>
              <th className="p-3 font-medium">Email</th>
              <th className="p-3 font-medium">Роль</th>
              <th className="p-3 font-medium">Тариф</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((u) => (
              <tr key={u.id} className="border-b border-border last:border-0">
                <td className="p-3">{u.email ?? u.name ?? u.id}</td>
                <td className="p-3">
                  <select
                    className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                    value={u.role}
                    onChange={(e) => update.mutate({ id: u.id, role: e.target.value })}
                  >
                    <option value="USER">USER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </td>
                <td className="p-3">
                  <select
                    className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                    value={u.tier}
                    onChange={(e) => update.mutate({ id: u.id, tier: e.target.value })}
                  >
                    <option value="free">free</option>
                    <option value="pro">pro</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

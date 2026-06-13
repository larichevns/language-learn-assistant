'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/field';
import { Badge, Spinner } from '@/components/ui/feedback';

interface Template {
  id: string;
  featureId: string;
  promptType: string;
  version: number;
  systemPrompt: string;
  userPromptTemplate: string;
  isActive: boolean;
  feature: { slug: string; name: string };
}
interface Feature {
  id: string;
  slug: string;
}
interface Variable {
  id: string;
  key: string;
  name: string;
  varType: string;
}

function DiffView({ a, b }: { a: string; b: string }) {
  const al = a.split('\n');
  const bl = b.split('\n');
  const max = Math.max(al.length, bl.length);
  const rows = Array.from({ length: max });
  return (
    <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-2 font-mono text-[11px] leading-relaxed">
      <div>
        <div className="mb-1 font-sans text-xs text-muted-foreground">активная</div>
        {rows.map((_, i) => (
          <div key={i} className={al[i] !== bl[i] ? 'bg-destructive/15' : ''}>{al[i] || ' '}</div>
        ))}
      </div>
      <div>
        <div className="mb-1 font-sans text-xs text-muted-foreground">эта версия</div>
        {rows.map((_, i) => (
          <div key={i} className={al[i] !== bl[i] ? 'bg-success/15' : ''}>{bl[i] || ' '}</div>
        ))}
      </div>
    </div>
  );
}

export default function AdminPromptsPage() {
  const qc = useQueryClient();
  const templates = useQuery({ queryKey: ['admin-prompts'], queryFn: () => apiGet<Template[]>('/api/admin/prompts') });
  const features = useQuery({ queryKey: ['admin-features'], queryFn: () => apiGet<Feature[]>('/api/admin/features') });
  const variables = useQuery({ queryKey: ['admin-variables'], queryFn: () => apiGet<Variable[]>('/api/admin/variables') });
  const invalidate = () => void qc.invalidateQueries({ queryKey: ['admin-prompts'] });

  const [expanded, setExpanded] = useState<string | null>(null);
  const [diffFor, setDiffFor] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ systemPrompt: string; userPromptTemplate: string }>({ systemPrompt: '', userPromptTemplate: '' });

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ featureId: '', promptType: 'default', systemPrompt: '', userPromptTemplate: '' });
  const [varForm, setVarForm] = useState({ key: '', name: '', varType: 'string' });

  const create = useMutation({ mutationFn: () => apiPost('/api/admin/prompts', form), onSuccess: () => { setCreating(false); invalidate(); } });
  const patch = useMutation({ mutationFn: (id: string) => apiPatch(`/api/admin/prompts/${id}`, draft), onSuccess: invalidate });
  const activate = useMutation({ mutationFn: (id: string) => apiPost(`/api/admin/prompts/${id}/activate`), onSuccess: invalidate });
  const remove = useMutation({ mutationFn: (id: string) => apiDelete(`/api/admin/prompts/${id}`), onSuccess: invalidate });
  const addVar = useMutation({ mutationFn: () => apiPost('/api/admin/variables', varForm), onSuccess: () => { setVarForm({ key: '', name: '', varType: 'string' }); void qc.invalidateQueries({ queryKey: ['admin-variables'] }); } });
  const delVar = useMutation({ mutationFn: (id: string) => apiDelete(`/api/admin/variables/${id}`), onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-variables'] }) });

  function startEdit(t: Template) {
    setExpanded(expanded === t.id ? null : t.id);
    setDiffFor(null);
    setDraft({ systemPrompt: t.systemPrompt, userPromptTemplate: t.userPromptTemplate });
  }

  const activeOf = (t: Template) =>
    templates.data?.find((x) => x.featureId === t.featureId && x.promptType === t.promptType && x.isActive) ?? null;

  if (templates.isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Variables */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4">
          <h2 className="text-sm font-semibold">Переменные промптов</h2>
          <div className="flex flex-wrap gap-2">
            {variables.data?.map((v) => (
              <Badge key={v.id} variant="muted" className="gap-1">
                {`{{${v.key}}}`}
                <button className="ml-1 text-muted-foreground hover:text-destructive" onClick={() => delVar.mutate(v.id)}>
                  ×
                </button>
              </Badge>
            ))}
            {variables.data?.length === 0 && <span className="text-xs text-muted-foreground">пока нет</span>}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Input className="w-32" placeholder="key" value={varForm.key} onChange={(e) => setVarForm((f) => ({ ...f, key: e.target.value }))} />
            <Input className="w-40" placeholder="название" value={varForm.name} onChange={(e) => setVarForm((f) => ({ ...f, name: e.target.value }))} />
            <select className="h-10 rounded-lg border border-input bg-background px-2 text-sm" value={varForm.varType} onChange={(e) => setVarForm((f) => ({ ...f, varType: e.target.value }))}>
              <option value="string">string</option>
              <option value="number">number</option>
              <option value="enum">enum</option>
            </select>
            <Button size="sm" disabled={addVar.isPending || !varForm.key || !varForm.name} onClick={() => addVar.mutate()}>
              Добавить
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* New template */}
      <Card>
        <CardContent className="p-4">
          {!creating ? (
            <Button variant="outline" size="sm" onClick={() => { setCreating(true); setForm((f) => ({ ...f, featureId: features.data?.[0]?.id ?? '' })); }}>
              + Новый шаблон
            </Button>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <select className="h-10 rounded-lg border border-input bg-background px-2 text-sm" value={form.featureId} onChange={(e) => setForm((f) => ({ ...f, featureId: e.target.value }))}>
                  {features.data?.map((ft) => (
                    <option key={ft.id} value={ft.id}>{ft.slug}</option>
                  ))}
                </select>
                <Input className="w-40" placeholder="promptType" value={form.promptType} onChange={(e) => setForm((f) => ({ ...f, promptType: e.target.value }))} />
              </div>
              <Textarea rows={3} placeholder="System prompt" value={form.systemPrompt} onChange={(e) => setForm((f) => ({ ...f, systemPrompt: e.target.value }))} />
              <Textarea rows={3} placeholder="User prompt template ({{var}})" value={form.userPromptTemplate} onChange={(e) => setForm((f) => ({ ...f, userPromptTemplate: e.target.value }))} />
              <div className="flex gap-2">
                <Button size="sm" disabled={create.isPending || !form.featureId} onClick={() => create.mutate()}>Создать</Button>
                <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>Отмена</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Templates */}
      <div className="flex flex-col gap-2">
        {templates.data?.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Шаблонов нет. Оркестратор использует встроенную персону; создай шаблон для переопределения.
          </p>
        )}
        {templates.data?.map((t) => (
          <Card key={t.id}>
            <CardContent className="flex flex-col gap-2 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{t.feature.slug}</span>
                  <Badge variant="muted">{t.promptType}</Badge>
                  <Badge variant="secondary">v{t.version}</Badge>
                  {t.isActive && <Badge variant="success">активен</Badge>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => startEdit(t)}>{expanded === t.id ? 'Свернуть' : 'Изменить'}</Button>
                  {!t.isActive && <Button size="sm" variant="outline" disabled={activate.isPending} onClick={() => activate.mutate(t.id)}>Активировать</Button>}
                  <Button size="sm" variant="ghost" disabled={remove.isPending} onClick={() => remove.mutate(t.id)}>Удалить</Button>
                </div>
              </div>

              {expanded === t.id && (
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-muted-foreground">System prompt</label>
                  <Textarea rows={4} value={draft.systemPrompt} onChange={(e) => setDraft((d) => ({ ...d, systemPrompt: e.target.value }))} />
                  <label className="text-xs text-muted-foreground">User prompt template</label>
                  <Textarea rows={4} value={draft.userPromptTemplate} onChange={(e) => setDraft((d) => ({ ...d, userPromptTemplate: e.target.value }))} />
                  <div className="flex gap-2">
                    <Button size="sm" disabled={patch.isPending} onClick={() => patch.mutate(t.id)}>Сохранить</Button>
                    {activeOf(t) && activeOf(t)!.id !== t.id && (
                      <Button size="sm" variant="outline" onClick={() => setDiffFor(diffFor === t.id ? null : t.id)}>
                        {diffFor === t.id ? 'Скрыть diff' : 'Diff с активной'}
                      </Button>
                    )}
                  </div>
                  {diffFor === t.id && activeOf(t) && (
                    <DiffView
                      a={`${activeOf(t)!.systemPrompt}\n---\n${activeOf(t)!.userPromptTemplate}`}
                      b={`${draft.systemPrompt}\n---\n${draft.userPromptTemplate}`}
                    />
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

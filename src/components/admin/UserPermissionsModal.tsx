import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, LoadingCard, Modal, SearchInput } from '@/components/ui';
import { useToast } from '@/components/ToastProvider';
import { api, errorMessage } from '@/lib/api-client';
import { strings } from '@/lib/i18n';
import { roleLabel } from '@/lib/format';

type PermissionDefinition = {
  code: string;
  name: string;
  description: string;
  category: string;
};

type PermissionsResponse = {
  user: { id: string; name: string; email: string; role: string };
  catalog: PermissionDefinition[];
  rolePermissions: string[];
  overrides: { permissionCode: string; effect: string }[];
  effective: string[];
};

type Choice = 'INHERIT' | 'ALLOW' | 'DENY';

type TargetUser = { id: string; name: string; email: string; role: string };

const CHOICES: { value: Choice; label: string }[] = [
  { value: 'INHERIT', label: strings.admin.permissions.inherit },
  { value: 'ALLOW', label: strings.admin.permissions.allow },
  { value: 'DENY', label: strings.admin.permissions.deny }
];

const READ_ONLY_SUFFIXES = ['.view', '.view_own', '.view_group', '.view_all'];

function isReadPermission(code: string): boolean {
  return READ_ONLY_SUFFIXES.some((suffix) => code.endsWith(suffix));
}

function categoryLabel(category: string): string {
  const labels = strings.admin.permissions.categories as Record<string, string>;
  return labels[category] ?? category;
}

function toChoices(data: PermissionsResponse): Record<string, Choice> {
  const choices: Record<string, Choice> = {};
  for (const definition of data.catalog) choices[definition.code] = 'INHERIT';
  for (const override of data.overrides) {
    choices[override.permissionCode] = override.effect === 'DENY' ? 'DENY' : 'ALLOW';
  }
  return choices;
}

export default function UserPermissionsModal({
  user,
  onClose,
  onSaved
}: {
  user: TargetUser | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const toast = useToast();
  const copy = strings.admin.permissions;

  const [data, setData] = useState<PermissionsResponse | null>(null);
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const response = await api.get<PermissionsResponse>(`/api/users/${user.id}/permissions`);
      setData(response);
      setChoices(toChoices(response));
    } catch (error) {
      toast.error(errorMessage(error, strings.errors.loadFailed(copy.title)));
    } finally {
      setLoading(false);
    }
  }, [user, toast, copy.title]);

  useEffect(() => {
    if (!user) {
      setData(null);
      setChoices({});
      setFilter('');
      return;
    }
    load();
  }, [user, load]);

  const roleGrants = useMemo(() => new Set(data?.rolePermissions ?? []), [data]);

  const allowed = useCallback(
    (code: string) => {
      const choice = choices[code] ?? 'INHERIT';
      if (choice === 'ALLOW') return true;
      if (choice === 'DENY') return false;
      return roleGrants.has(code);
    },
    [choices, roleGrants]
  );

  const grouped = useMemo(() => {
    if (!data) return [] as { category: string; items: PermissionDefinition[] }[];

    const needle = filter.trim().toLowerCase();
    const buckets = new Map<string, PermissionDefinition[]>();

    for (const definition of data.catalog) {
      if (
        needle &&
        !definition.name.toLowerCase().includes(needle) &&
        !definition.code.toLowerCase().includes(needle) &&
        !definition.description.toLowerCase().includes(needle) &&
        !categoryLabel(definition.category).toLowerCase().includes(needle)
      ) {
        continue;
      }
      const bucket = buckets.get(definition.category);
      if (bucket) bucket.push(definition);
      else buckets.set(definition.category, [definition]);
    }

    return [...buckets.entries()].map(([category, items]) => ({ category, items }));
  }, [data, filter]);

  const counts = useMemo(() => {
    if (!data) return { added: 0, blocked: 0, allowed: 0, total: 0 };

    let added = 0;
    let blocked = 0;
    let allowedCount = 0;

    for (const definition of data.catalog) {
      const choice = choices[definition.code] ?? 'INHERIT';
      const inRole = roleGrants.has(definition.code);
      if (choice === 'ALLOW' && !inRole) added += 1;
      if (choice === 'DENY' && inRole) blocked += 1;
      if (allowed(definition.code)) allowedCount += 1;
    }

    return { added, blocked, allowed: allowedCount, total: data.catalog.length };
  }, [data, choices, roleGrants, allowed]);

  function setChoice(code: string, choice: Choice) {
    setChoices((current) => ({ ...current, [code]: choice }));
  }

  function applyReadOnly() {
    if (!data) return;
    const next: Record<string, Choice> = {};
    for (const definition of data.catalog) {
      const inRole = roleGrants.has(definition.code);
      if (inRole && !isReadPermission(definition.code)) next[definition.code] = 'DENY';
      else next[definition.code] = 'INHERIT';
    }
    setChoices(next);
  }

  function applyReset() {
    if (!data) return;
    const next: Record<string, Choice> = {};
    for (const definition of data.catalog) next[definition.code] = 'INHERIT';
    setChoices(next);
  }

  async function save() {
    if (!user || !data) return;
    setSaving(true);
    try {
      const overrides = data.catalog
        .filter((definition) => (choices[definition.code] ?? 'INHERIT') !== 'INHERIT')
        .map((definition) => ({
          permissionCode: definition.code,
          effect: choices[definition.code]
        }));

      await api.put(`/api/users/${user.id}/permissions`, { overrides });
      toast.success(copy.saved(user.name));
      await onSaved();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  if (!user) return null;

  return (
    <Modal
      open={Boolean(user)}
      onClose={onClose}
      title={copy.modalTitle(user.name)}
      description={user.email}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {strings.common.cancel}
          </Button>
          <Button onClick={save} loading={saving} disabled={loading || !data}>
            {strings.common.saveChanges}
          </Button>
        </>
      }
    >
      {loading || !data ? (
        <LoadingCard />
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">{copy.roleBaseline(roleLabel(data.user.role))}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{copy.summary(counts.allowed, counts.total)}</p>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{copy.roleBaselineHint}</p>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={applyReadOnly}>
                {copy.presetReadOnly}
              </Button>
              <Button size="sm" variant="secondary" onClick={applyReset}>
                {copy.presetReset}
              </Button>
            </div>

            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {counts.added + counts.blocked === 0
                ? copy.noOverrides
                : copy.overrideCount(counts.added, counts.blocked)}
            </p>
          </div>

          <SearchInput value={filter} onChange={setFilter} placeholder={copy.searchPlaceholder} />

          {grouped.length === 0 ? (
            <Alert tone="info">{strings.emptyState.noData}</Alert>
          ) : (
            <div className="space-y-5">
              {grouped.map((group) => (
                <section key={group.category}>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    {categoryLabel(group.category)}
                  </h3>
                  <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-700">
                    {group.items.map((definition) => {
                      const choice = choices[definition.code] ?? 'INHERIT';
                      const inRole = roleGrants.has(definition.code);
                      const isAllowed = allowed(definition.code);

                      return (
                        <li key={definition.code} className="py-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium">{definition.name}</p>
                              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{definition.description}</p>
                            </div>
                            <Badge tone={isAllowed ? 'success' : 'neutral'}>
                              {isAllowed ? copy.effectiveAllowed : copy.effectiveBlocked}
                            </Badge>
                          </div>

                          <div
                            role="radiogroup"
                            aria-label={definition.name}
                            className="mt-2 inline-flex rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-0.5"
                          >
                            {CHOICES.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                role="radio"
                                aria-checked={choice === option.value}
                                onClick={() => setChoice(definition.code, option.value)}
                                className={`min-h-[1.75rem] rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                                  choice === option.value
                                    ? option.value === 'DENY'
                                      ? 'bg-red-600 text-white'
                                      : option.value === 'ALLOW'
                                        ? 'bg-brand-600 text-white'
                                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 shadow-sm'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100'
                                }`}
                              >
                                {option.value === 'INHERIT'
                                  ? `${option.label} (${inRole ? copy.allowedByRole : copy.blockedByRole})`
                                  : option.label}
                              </button>
                            ))}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

import { useEffect, useState } from 'react';
import { Avatar, Badge, ImageViewer, LinkButton, Loader, Modal } from '@/components/ui';
import { strings } from '@/lib/i18n';
import { formatInstant } from '@/lib/format';

export type MemberProfileGroup = {
  id: string;
  name: string;
  status: string;
  isSupervisor: boolean;
  isActive: boolean;
  joinedAt: string;
  leftAt: string | null;
  stayDays: number;
};

export type MemberProfileData = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  profileImage: string | null;
  role: string;
  status: string;
  memberSince: string;
  isSelf: boolean;
  groups: MemberProfileGroup[];
};

export type MemberProfileProps = {
  userId: string | null;
  onClose: () => void;
};

function formatStay(days: number) {
  if (days < 31) return `${days} day${days === 1 ? '' : 's'}`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'}`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest === 0 ? `${years} year${years === 1 ? '' : 's'}` : `${years}y ${rest}m`;
}

export default function MemberProfile({ userId, onClose }: MemberProfileProps) {
  const [member, setMember] = useState<MemberProfileData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) {
      setMember(null);
      setError('');
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError('');
    setMember(null);

    fetch(`/api/users/${userId}/profile`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error ?? strings.members.profile.loadFailed);
        return body.member as MemberProfileData;
      })
      .then((data) => {
        if (!cancelled) setMember(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const copy = strings.members.profile;

  return (
    <Modal
      open={Boolean(userId)}
      onClose={onClose}
      title={copy.title}
      size="md"
      footer={member?.isSelf ? <LinkButton href="/profile">{copy.editMine}</LinkButton> : undefined}
    >
      {loading && <Loader />}

      {!loading && error && (
        <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>
      )}

      {!loading && !error && member && (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            {member.profileImage ? (
              <ImageViewer src={member.profileImage} alt={member.name}>
                {(open) => (
                  <button
                    type="button"
                    onClick={open}
                    className="shrink-0 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                  >
                    <Avatar name={member.name} image={member.profileImage} size="xl" />
                  </button>
                )}
              </ImageViewer>
            ) : (
              <Avatar name={member.name} size="xl" />
            )}

            <div className="min-w-0">
              <h3 className="truncate text-xl font-semibold">{member.name}</h3>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge>{member.role}</Badge>
                {member.isSelf && <Badge tone="success">{copy.you}</Badge>}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <h4 className="text-xs uppercase tracking-wide text-slate-500">{copy.contact}</h4>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-slate-500">{copy.email}</dt>
                <dd className="min-w-0 break-all font-medium">
                  <a className="hover:underline" href={`mailto:${member.email}`}>
                    {member.email}
                  </a>
                </dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-slate-500">{copy.phone}</dt>
                <dd className="font-medium">
                  {member.phone ? (
                    <a className="hover:underline" href={`tel:${member.phone}`}>
                      {member.phone}
                    </a>
                  ) : (
                    <span className="text-slate-400">{copy.phoneMissing}</span>
                  )}
                </dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-slate-500">{copy.memberSince}</dt>
                <dd className="font-medium">{formatInstant(member.memberSince, 'date')}</dd>
              </div>
            </dl>
          </div>

          <div>
            <h4 className="text-xs uppercase tracking-wide text-slate-500">{copy.inMesses}</h4>

            {member.groups.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">{copy.noSharedGroups}</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {member.groups.map((group) => (
                  <li
                    key={group.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {group.name}
                        {group.isSupervisor && (
                          <Badge tone="info" className="ml-2">
                            {copy.supervisor}
                          </Badge>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {group.isActive
                          ? copy.activeSince(formatInstant(group.joinedAt, 'date'))
                          : group.leftAt
                            ? copy.leftOn(formatInstant(group.leftAt, 'date'))
                            : strings.members.noLongerActive}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-medium text-slate-600">
                      {formatStay(group.stayDays)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

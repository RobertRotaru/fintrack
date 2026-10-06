import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { Camera, ChevronRight, LogOut, Trash2 } from 'lucide-react';
import type { User } from '@ft/core';
import { api } from '../lib/api';
import { useAuth, useUser } from '../lib/auth';
import { removeAvatar, uploadAvatar } from '../lib/avatar';
import { keys, useApiMutation } from '../lib/queries';
import { Avatar, Button, Card, Field, Input, PageHeader, clsx } from '../components/ui';

const BIO_MAX = 280;

/** Who you are: photo, name and a few words. Preferences live in Settings. */
export function Profile() {
  const user = useUser();
  const { setUser, logout } = useAuth();
  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio ?? '');
  const [photoBusy, setPhotoBusy] = useState<'upload' | 'remove' | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const save = useApiMutation((body: { name: string; bio: string }) => api<User>('/auth/me', { method: 'PATCH', body }), [keys.household]);
  const dirty = name.trim() !== user.name || bio.trim() !== (user.bio ?? '');
  const since = new Date(user.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    setPhotoBusy('upload');
    try {
      setUser(await uploadAvatar(file));
      toast.success('Photo updated');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'The photo didn’t upload');
    } finally {
      setPhotoBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const dropPhoto = async () => {
    setPhotoBusy('remove');
    try {
      setUser(await removeAvatar());
      toast.success('Photo removed');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Couldn’t remove the photo');
    } finally {
      setPhotoBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Profile" subtitle="How you appear in Fintrack and to your family." />

      <Card className="relative overflow-hidden !p-0">
        {/* A soft banner behind the photo. */}
        <div aria-hidden="true" className="h-28 bg-[linear-gradient(120deg,color-mix(in_oklab,var(--emerald)_30%,var(--surface)),color-mix(in_oklab,var(--sky)_35%,var(--surface)),color-mix(in_oklab,var(--peach)_30%,var(--surface)))]" />
        <div className="px-6 pb-6 sm:px-8">
          <div className="-mt-14 flex flex-wrap items-end gap-5">
            <div className="relative">
              <Avatar name={user.name} src={user.avatarUrl} size={112} ring />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={!!photoBusy}
                aria-label={user.avatarUrl ? 'Change photo' : 'Add a photo'}
                className="absolute bottom-1 right-1 flex size-9 items-center justify-center rounded-full border-2 border-surface bg-brand text-brand-ink shadow-[var(--shadow)] transition hover:brightness-110 disabled:opacity-60 cursor-pointer"
              >
                <Camera className={clsx('size-4', photoBusy === 'upload' && 'animate-pulse')} />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
                className="sr-only"
                data-testid="avatar-input"
                onChange={(e) => pickPhoto(e.target.files?.[0])}
              />
            </div>
            <div className="ml-auto flex gap-2 pb-1">
              <Button variant="secondary" loading={photoBusy === 'upload'} onClick={() => fileRef.current?.click()}>
                <Camera className="size-4" /> {user.avatarUrl ? 'Change photo' : 'Upload photo'}
              </Button>
              {user.avatarUrl && (
                <Button variant="ghost" loading={photoBusy === 'remove'} onClick={dropPhoto} aria-label="Remove photo">
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          </div>
          <div className="mt-4 min-w-0">
            <p className="font-display text-3xl leading-tight" data-testid="profile-name">{user.name}</p>
            <p className="mt-0.5 text-sm text-muted">
              {user.email} · Member since {since}
            </p>
          </div>
          {user.bio && <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-2" data-testid="profile-bio">{user.bio}</p>}
        </div>
      </Card>

      <Card>
        <h2 className="mb-5 font-display text-2xl">About you</h2>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <Field label="Name" hint="Shown to people in your family">
            <Input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Bio" hint={`${bio.length}/${BIO_MAX} · A line about you or what you’re saving for`}>
            <textarea
              value={bio}
              maxLength={BIO_MAX}
              rows={3}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Saving for a sailboat, one coffee at a time."
              className="w-full resize-none rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted hover:border-line-strong focus:border-brand focus:ring-4 focus:ring-brand/15"
            />
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" disabled={!dirty} onClick={() => (setName(user.name), setBio(user.bio ?? ''))}>
            Reset
          </Button>
          <Button
            disabled={!dirty || !name.trim()}
            loading={save.isPending}
            onClick={async () => {
              try {
                setUser(await save.mutateAsync({ name: name.trim(), bio: bio.trim() }));
                toast.success('Profile saved');
              } catch {
                // The global mutation error handler already showed a toast.
              }
            }}
          >
            Save
          </Button>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link to="/settings" className="row-hover group flex items-center justify-between rounded-[20px] border border-line bg-surface/60 p-5">
          <span>
            <span className="block font-semibold">Settings</span>
            <span className="text-sm text-muted">Country, main currency, appearance and categories</span>
          </span>
          <ChevronRight className="size-4 text-muted transition group-hover:translate-x-0.5" />
        </Link>
        <button type="button" onClick={logout} className="row-hover flex items-center gap-3 rounded-[20px] border border-line bg-surface/60 p-5 text-left text-bad cursor-pointer">
          <LogOut className="size-5" />
          <span>
            <span className="block font-semibold">Sign out</span>
            <span className="text-sm text-muted">You’ll need your password to come back</span>
          </span>
        </button>
      </div>
    </div>
  );
}

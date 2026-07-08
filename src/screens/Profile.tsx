import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import Avatar from '../components/Avatar';
import CrestWatermark from '../components/CrestWatermark';
import {
  AVATAR_COLORS,
  AVATAR_ICONS,
  makeAvatar,
  parseAvatar,
  type AvatarColor,
  type AvatarIcon,
} from '../lib/avatar';

const inputClass =
  'w-full bg-panel border border-white/10 rounded-xl px-3.5 py-3 text-ink text-sm outline-none focus:border-white/30 placeholder:text-faint';

const MAX_PHOTO_BYTES = 2 * 1024 * 1024; // matches the server's saveAvatarUpload limit
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

function PhotoUpload() {
  const { user, uploadAvatar, deleteAvatar } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setSaved(false);
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Please choose a PNG, JPEG, or WEBP image');
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError('Image must be under 2MB');
      return;
    }
    setBusy(true);
    try {
      await uploadAvatar(file);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    setError(null);
    setSaved(false);
    setBusy(true);
    try {
      await deleteAvatar();
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bg-panel border border-white/10 rounded-card p-[18px] max-w-[440px] mb-6">
      <h2 className="m-0 mb-3 text-sm font-semibold text-ink">Profile photo</h2>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <Avatar
            name={user.display_name ?? user.email}
            avatar={user.avatar}
            avatarUrl={user.avatar_url}
            size={80}
          />
          <p className="text-faint text-[13px] m-0">
            Upload a photo — PNG, JPEG, or WEBP, under 2MB. Uploading a photo
            replaces your preset avatar below, and picking a preset replaces
            your photo.
          </p>
        </div>

        {error && <p className="text-red-400 text-[13px] m-0">{error}</p>}
        {saved && !error && <p className="text-green text-[13px] m-0">Photo updated.</p>}

        <div className="flex gap-2">
          <label className="flex-1 h-11 rounded-xl bg-city-gold text-navy font-semibold text-[15px] cursor-pointer disabled:opacity-60 flex items-center justify-center">
            {busy ? 'Uploading…' : 'Upload photo'}
            <input
              type="file"
              accept={ACCEPTED_TYPES.join(',')}
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                void handleFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
          <button
            className="h-11 px-4 rounded-xl bg-transparent border border-white/10 text-muted text-[13px] cursor-pointer hover:border-white/20 hover:text-ink disabled:opacity-60"
            disabled={busy || !user.avatar_url}
            onClick={handleRemove}
          >
            Remove
          </button>
        </div>
      </div>
    </section>
  );
}

function AvatarPicker() {
  const { user, updateProfile } = useAuth();
  const current = parseAvatar(user?.avatar);
  const [color, setColor] = useState<AvatarColor>(current?.color ?? 'sky');
  const [icon, setIcon] = useState<AvatarIcon>(current?.icon ?? 'ball');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  const selection = makeAvatar(color, icon);
  const unchanged = user.avatar === selection;

  async function save(avatar: string | null) {
    setError(null);
    setSaved(false);
    setBusy(true);
    try {
      await updateProfile({ avatar });
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bg-panel border border-white/10 rounded-card p-[18px] max-w-[440px] mb-6">
      <h2 className="m-0 mb-3 text-sm font-semibold text-ink">Avatar</h2>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <Avatar name={user.display_name ?? user.email} avatar={selection} size={80} />
          <p className="text-faint text-[13px] m-0">
            Pick a colour and an icon, or use your initials.
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {(Object.keys(AVATAR_COLORS) as AvatarColor[]).map((c) => (
            <button
              key={c}
              aria-label={`Colour ${c}`}
              className={
                'w-9 h-9 rounded-full cursor-pointer border-2 transition ' +
                (c === color ? 'border-white' : 'border-transparent hover:border-white/40')
              }
              style={{ backgroundColor: AVATAR_COLORS[c] }}
              onClick={() => {
                setColor(c);
                setSaved(false);
              }}
            />
          ))}
        </div>

        <div className="flex gap-2 flex-wrap">
          {(Object.keys(AVATAR_ICONS) as AvatarIcon[]).map((i) => (
            <button
              key={i}
              aria-label={`Icon ${i}`}
              className={
                'w-9 h-9 rounded-[10px] cursor-pointer text-lg flex items-center justify-center border transition bg-panel-2 ' +
                (i === icon ? 'border-gold' : 'border-white/10 hover:border-white/30')
              }
              onClick={() => {
                setIcon(i);
                setSaved(false);
              }}
            >
              {AVATAR_ICONS[i]}
            </button>
          ))}
        </div>

        {error && <p className="text-red-400 text-[13px] m-0">{error}</p>}
        {saved && !error && <p className="text-green text-[13px] m-0">Avatar updated.</p>}

        <div className="flex gap-2">
          <button
            className="flex-1 h-11 rounded-xl bg-city-gold text-navy font-semibold text-[15px] cursor-pointer disabled:opacity-60"
            disabled={busy || unchanged}
            onClick={() => save(selection)}
          >
            {busy ? 'Saving…' : 'Save avatar'}
          </button>
          <button
            className="h-11 px-4 rounded-xl bg-transparent border border-white/10 text-muted text-[13px] cursor-pointer hover:border-white/20 hover:text-ink disabled:opacity-60"
            disabled={busy || user.avatar === null}
            onClick={() => save(null)}
          >
            Use initials
          </button>
        </div>
      </div>
    </section>
  );
}

export default function Profile() {
  const { user, updateProfile, changePassword } = useAuth();

  const [displayName, setDisplayName] = useState(user?.display_name ?? '');
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSaved, setNameSaved] = useState(false);
  const [nameBusy, setNameBusy] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);

  if (!user) return null;

  async function submitName() {
    setNameError(null);
    setNameSaved(false);
    setNameBusy(true);
    try {
      await updateProfile({ displayName });
      setNameSaved(true);
    } catch (e) {
      setNameError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setNameBusy(false);
    }
  }

  async function submitPassword() {
    setPasswordError(null);
    setPasswordSaved(false);
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords don't match");
      return;
    }
    setPasswordBusy(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordSaved(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e) {
      setPasswordError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setPasswordBusy(false);
    }
  }

  return (
    <div>
      <header className="relative flex items-center gap-4 mb-[26px]">
        <CrestWatermark className="w-40 h-40 -top-4 right-4" />
        <Avatar
          name={user.display_name ?? user.email}
          avatar={user.avatar}
          avatarUrl={user.avatar_url}
          size={64}
        />
        <div>
          <h1 className="m-0 text-3xl font-bold tracking-[-0.6px] text-ink">Profile</h1>
          <p className="mt-1 text-faint text-sm">{user.email}</p>
        </div>
      </header>

      <PhotoUpload />
      <AvatarPicker />

      <section className="bg-panel border border-white/10 rounded-card p-[18px] max-w-[440px] mb-6">
        <h2 className="m-0 mb-3 text-sm font-semibold text-ink">Username</h2>
        <div className="flex flex-col gap-3">
          <input
            className={inputClass}
            value={displayName}
            maxLength={20}
            autoComplete="username"
            onChange={(e) => {
              setDisplayName(e.target.value);
              setNameSaved(false);
            }}
          />
          {nameError && <p className="text-red-400 text-[13px] m-0">{nameError}</p>}
          {nameSaved && !nameError && <p className="text-green text-[13px] m-0">Username updated.</p>}
          <button
            className="h-11 rounded-xl bg-city-gold text-navy font-semibold text-[15px] cursor-pointer disabled:opacity-60"
            disabled={nameBusy || !displayName || displayName === user.display_name}
            onClick={submitName}
          >
            {nameBusy ? 'Saving…' : 'Save username'}
          </button>
        </div>
      </section>

      <section className="bg-panel border border-white/10 rounded-card p-[18px] max-w-[440px]">
        <h2 className="m-0 mb-3 text-sm font-semibold text-ink">Password</h2>
        <div className="flex flex-col gap-3">
          <input
            className={inputClass}
            type="password"
            placeholder="Current password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <input
            className={inputClass}
            type="password"
            placeholder="New password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <input
            className={inputClass}
            type="password"
            placeholder="Confirm new password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          {passwordError && <p className="text-red-400 text-[13px] m-0">{passwordError}</p>}
          {passwordSaved && !passwordError && (
            <p className="text-green text-[13px] m-0">Password updated.</p>
          )}
          <button
            className="h-11 rounded-xl bg-city-gold text-navy font-semibold text-[15px] cursor-pointer disabled:opacity-60"
            disabled={passwordBusy || !currentPassword || !newPassword || !confirmPassword}
            onClick={submitPassword}
          >
            {passwordBusy ? 'Saving…' : 'Change password'}
          </button>
        </div>
      </section>
    </div>
  );
}

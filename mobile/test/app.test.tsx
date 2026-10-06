import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import { toISODate } from '@ft/core';
import { ACCOUNT, CATEGORIES, Providers, USER, mockApi, ok } from './helpers';

jest.mock('../src/lib/auth', () => ({
  useUser: () => require('./helpers').USER,
  useAuth: () => ({ user: require('./helpers').USER, setUser: jest.fn(), signOut: jest.fn() }),
}));

const { default: QuickAdd } = jest.requireActual('../src/app/quick-add') as typeof import('../src/app/quick-add');
const { default: Home } = jest.requireActual('../src/app/(tabs)/index') as typeof import('../src/app/(tabs)/index');

const DECIMAL = (1.5).toLocaleString().includes(',') ? ',' : '.';

beforeEach(() => jest.clearAllMocks());

describe('quick add', () => {
  it('types an amount on the keypad and saves with one tap on a category', async () => {
    const posted: unknown[] = [];
    mockApi({
      '/accounts': ok([ACCOUNT]),
      '/categories': ok(CATEGORIES),
      '/transactions': ok([]),
      'POST /transactions': (init) => {
        posted.push(JSON.parse(String(init?.body)));
        return { status: 201, body: { id: 't1' } };
      },
    });
    await render(<QuickAdd />, { wrapper: Providers });
    await screen.findByText('Everyday');
    for (const k of ['1', '2']) await fireEvent.press(screen.getByLabelText(k));
    await fireEvent.press(screen.getByLabelText('Decimal separator'));
    await fireEvent.press(screen.getByLabelText('5'));
    expect(screen.getByLabelText(`Amount 12${DECIMAL}5 RON`)).toBeTruthy();
    // Income categories aren't offered for an expense.
    expect(screen.queryByLabelText('Save as Salary')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Save as Groceries'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(posted).toEqual([{ accountId: 'a1', kind: 'expense', amount: 12.5, categoryId: 'c1', date: toISODate(new Date()) }]);
  });

  it('does not save without an amount', async () => {
    const post = jest.fn(() => ({ status: 201, body: {} }));
    mockApi({ '/accounts': ok([ACCOUNT]), '/categories': ok(CATEGORIES), '/transactions': ok([]), 'POST /transactions': post });
    await render(<QuickAdd />, { wrapper: Providers });
    await screen.findByText('Everyday');
    await fireEvent.press(screen.getByLabelText('Save as Groceries'));
    await act(async () => {});
    expect(post).not.toHaveBeenCalled();
    expect(router.back).not.toHaveBeenCalled();
  });

  it('edits an existing transaction: pick a category, then Save', async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ id: 't9' });
    const patched: unknown[] = [];
    const tx = { id: 't9', accountId: 'a1', userId: 'u1', kind: 'expense', amount: 40, currency: 'RON', categoryId: 'c1', categoryName: 'Groceries', categoryColor: '#22c55e', categoryIcon: 'shopping-cart', date: toISODate(new Date()), note: 'Market', createdAt: '' };
    mockApi({
      '/accounts': ok([ACCOUNT]),
      '/categories': ok(CATEGORIES),
      '/transactions': ok([tx]),
      'PATCH /transactions/t9': (init) => {
        patched.push(JSON.parse(String(init?.body)));
        return { status: 200, body: tx };
      },
    });
    await render(<QuickAdd />, { wrapper: Providers });
    await screen.findByText('Edit');
    await fireEvent.press(await screen.findByLabelText('Dining Out'));
    await fireEvent.press(screen.getByLabelText('Save'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(patched[0]).toMatchObject({ categoryId: 'c2', amount: 40, note: 'Market' });
    expect(screen.getByLabelText(`Amount 40${DECIMAL}00 RON`)).toBeTruthy();
    (useLocalSearchParams as jest.Mock).mockReturnValue({});
  });
});

describe('home', () => {
  const routes = (accounts: unknown[]) => ({
    '/accounts': ok(accounts),
    '/transactions': ok([]),
    '/transfers': ok([]),
    '/goals': ok([]),
    '/fx': ok({ base: 'EUR', rates: { EUR: 1, RON: 5 }, updatedAt: null, source: 'fallback', attribution: { label: '', url: '' } }),
  });

  it('opens on net worth, then the mood line and the month at a glance', async () => {
    mockApi(routes([ACCOUNT, { ...ACCOUNT, id: 'a2', type: 'savings', name: 'Rainy day', balance: 5000 }]));
    await render(<Home />, { wrapper: Providers });
    expect(await screen.findByLabelText(/10,?100\.00 RON/)).toBeTruthy();
    expect(screen.getByText(/Welcome back,/)).toBeTruthy();
    expect(screen.getByTestId('home-mood')).toBeTruthy();
    expect(screen.getByLabelText(/^Saving, RON/)).toBeTruthy();
    expect(screen.getByLabelText(/^Investing, —/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Your profile and settings'));
    expect(router.push).toHaveBeenCalledWith('/profile');
  });

  it('without accounts, offers to add one or load demo data', async () => {
    mockApi(routes([]));
    await render(<Home />, { wrapper: Providers });
    expect(await screen.findByText('Let’s set up your money')).toBeTruthy();
    expect(screen.getByLabelText('Load a year of demo data')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Add your first account'));
    expect(router.push).toHaveBeenCalledWith('/account-new');
  });
});

describe('face id lock', () => {
  const { LockProvider, useLock } = jest.requireActual('../src/lib/lock') as typeof import('../src/lib/lock');
  let lock: ReturnType<typeof useLock>;
  const Probe = () => {
    lock = useLock();
    return null;
  };

  beforeEach(() => {
    jest.spyOn(LocalAuthentication, 'hasHardwareAsync').mockResolvedValue(true);
    jest.spyOn(LocalAuthentication, 'isEnrolledAsync').mockResolvedValue(true);
    jest.spyOn(LocalAuthentication, 'supportedAuthenticationTypesAsync').mockResolvedValue([LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION]);
  });

  it('turns on only after a successful Face ID check, and unlocks with one', async () => {
    const auth = jest.spyOn(LocalAuthentication, 'authenticateAsync');
    await render(
      <LockProvider>
        <Probe />
      </LockProvider>,
    );
    await waitFor(() => expect(lock.available).toBe(true));
    expect(lock.biometryLabel).toBe('Face ID');

    auth.mockResolvedValueOnce({ success: false, error: 'user_cancel' });
    await act(async () => expect(await lock.setEnabled(true)).toBe(false));
    expect(lock.enabled).toBe(false);

    auth.mockResolvedValueOnce({ success: true });
    await act(async () => expect(await lock.setEnabled(true)).toBe(true));
    expect(lock.enabled).toBe(true);

    auth.mockResolvedValueOnce({ success: true });
    await act(async () => expect(await lock.unlock()).toBe(true));
    expect(lock.locked).toBe(false);
  });
});

describe('profile photo upload', () => {
  jest.mock('expo-image-manipulator', () => ({
    SaveFormat: { JPEG: 'jpeg' },
    ImageManipulator: { manipulate: () => ({ resize: () => ({ renderAsync: async () => ({ saveAsync: async () => ({ uri: 'file:///photo.jpg' }) }) }) }) },
  }));

  it('asks for a signed link, PUTs the photo straight to storage without the session, then saves only the key', async () => {
    const { uploadAvatar } = jest.requireActual('../src/lib/avatar') as typeof import('../src/lib/avatar');
    const { setToken } = jest.requireActual('../src/lib/api') as typeof import('../src/lib/api');
    await setToken('tok');
    const calls: { url: string; method?: string; headers?: Record<string, string>; body?: unknown }[] = [];
    const blob = { size: 4321, type: 'image/jpeg' };
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, method: init?.method, headers: init?.headers as Record<string, string>, body: init?.body });
      if (url === 'file:///photo.jpg') return { blob: async () => blob } as unknown as Response;
      if (url.endsWith('/api/me/avatar/uploads')) return new Response(JSON.stringify({ key: 'avatars/u1/k.jpg', upload: { method: 'PUT', url: 'https://r2.example/b/avatars/u1/k.jpg?X-Amz-Signature=s', headers: { 'content-type': 'image/jpeg' }, size: 4321, expiresAt: '' } }), { status: 201 });
      if (url.startsWith('https://r2.example/')) return new Response(null, { status: 200 });
      return new Response(JSON.stringify({ ...USER, avatarUrl: 'https://photos.example/avatars/u1/k.jpg' }), { status: 200 });
    }) as unknown as typeof fetch;

    const user = await uploadAvatar('file:///picked.heic');
    expect(user.avatarUrl).toBe('https://photos.example/avatars/u1/k.jpg');
    const api = calls.filter((c) => c.url !== 'file:///photo.jpg');
    expect(api.map((c) => `${c.method} ${c.url.split('?')[0]}`)).toEqual([
      'POST http://192.168.1.20:4000/api/me/avatar/uploads',
      'PUT https://r2.example/b/avatars/u1/k.jpg',
      'PUT http://192.168.1.20:4000/api/me/avatar',
    ]);
    expect(JSON.parse(String(api[0]!.body))).toEqual({ contentType: 'image/jpeg', size: 4321 });
    expect(api[1]!.body).toBe(blob);
    expect(Object.keys(api[1]!.headers ?? {}).map((h) => h.toLowerCase())).not.toContain('authorization');
    expect(JSON.parse(String(api[2]!.body))).toEqual({ key: 'avatars/u1/k.jpg' });
  });
});

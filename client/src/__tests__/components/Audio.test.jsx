import { render, screen, waitFor, act, renderHook, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest';
import api, { uploadAudio, withdrawAudio, getMyAudio, transitionAudio, getAudioQueue } from '../../services/api';
import DashboardQueue from '../../pages/dashboard/DashboardQueue';
import { useAuth } from '../../context/AuthContext';
import useRecorder from '../../hooks/useRecorder';
import VariantClips from '../../components/audio/VariantClips';
import VariantCard from '../../components/concept/VariantCard';
import AudioQueueRow from '../../components/audio/AudioQueueRow';
import MyRecordings from '../../components/audio/MyRecordings';
import PublishedClips from '../../components/audio/PublishedClips';
import VariantEditForm from '../../components/moderation/VariantEditForm';
import ConceptDetail from '../../pages/ConceptDetail';
import { LookupsWrapper } from '../helpers/lookups';
import { FieldsWrapper } from '../helpers/fields';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: { data: [] } })), patch: vi.fn() },
  uploadAudio: vi.fn(),
  withdrawAudio: vi.fn(),
  getMyAudio: vi.fn(),
  transitionAudio: vi.fn(),
  getAudioQueue: vi.fn(),
  getMySuggestions: vi.fn(() => Promise.resolve({ data: { data: [] } })),
}));

vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn(() => ({ user: null })) }));

const wrap = (ui, url = '/concepts/c1') => render(
  <MemoryRouter initialEntries={[url]}>
    <LookupsWrapper>
      <FieldsWrapper>
        <Routes>
          <Route path="/concepts/:id" element={ui} />
          <Route path="/login" element={<div>Login page</div>} />
        </Routes>
      </FieldsWrapper>
    </LookupsWrapper>
  </MemoryRouter>
);

const speaker = { _id: 'u2', username: 'gul', village: 'Shakardara', region: 'Kohat' };
const clip = (fields = {}) => ({ _id: 'a1', url: 'https://storage.test/a1.webm', mimeType: 'audio/webm', durationMs: 1800, submittedBy: speaker, ...fields });

const variant = (fields = {}) => ({
  _id: 'v1', pashto: 'لمر', region: 'Kohat', definition: 'sun', example: 'لمر راختلی دی',
  audio: {}, audioOpen: [],
  audioSlots: [
    { slot: 'headword', text: 'لمر', maxSeconds: 3 },
    { slot: 'example', text: 'لمر راختلی دی', maxSeconds: 6 },
    { slot: 'form:masculine.plural.direct', text: '', maxSeconds: 3 },
  ],
  ...fields,
});

const originalCanPlay = HTMLMediaElement.prototype.canPlayType;

beforeEach(() => {
  vi.clearAllMocks();
  useAuth.mockReturnValue({ user: null });
  HTMLMediaElement.prototype.canPlayType = (type) => (type === 'audio/webm' ? 'maybe' : '');
});

afterEach(() => {
  HTMLMediaElement.prototype.canPlayType = originalCanPlay;
  delete window.MediaRecorder;
  delete navigator.mediaDevices;
});

describe('public word page', () => {
  it('plays the headword recording beside the word and credits the speaker', () => {
    wrap(<VariantCard group={[variant({ audio: { headword: clip() } })]} conceptId="c1" />);
    expect(screen.getByRole('button', { name: 'Play Kohat pronunciation' })).toBeInTheDocument();
    expect(screen.getByText('Recorded by gul (Shakardara, Kohat)')).toBeInTheDocument();
  });

  it('says so when this device cannot play the format', () => {
    wrap(<VariantCard group={[variant({ audio: { headword: clip({ mimeType: 'audio/ogg' }) } })]} conceptId="c1" />);
    expect(screen.getByText(/can.t play on this device/i)).toBeInTheDocument();
  });

  it('lists live form recordings with their text, leaving the headword and example to their own text', () => {
    const form = { slot: 'form:masculine.plural.direct', text: 'لمرونه', maxSeconds: 3 };
    wrap(<VariantClips variant={variant({ audio: { example: clip(), [form.slot]: clip({ _id: 'a2' }) }, audioSlots: [...variant().audioSlots.slice(0, 2), form] })} />);
    const list = screen.getByRole('list');
    expect(within(list).getByText('لمرونه')).toBeInTheDocument();
    expect(within(list).queryByText('Example sentence')).not.toBeInTheDocument();
    expect(within(list).getAllByRole('button')).toHaveLength(1);
  });

  it('plays the example recording beside the example sentence and credits the speaker', () => {
    wrap(<VariantCard group={[variant({ audio: { example: clip() } })]} conceptId="c1" />);
    expect(screen.getByRole('button', { name: 'Play Kohat example' })).toBeInTheDocument();
    expect(screen.getByText('Example recorded by gul (Shakardara, Kohat)')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Pronunciation recordings' })).not.toBeInTheDocument();
  });

  it('"Record the example" opens the recorder on the example sentence', async () => {
    const user = userEvent.setup();
    useAuth.mockReturnValue({ user: { id: 'u1', role: 'user' } });
    wrap(<VariantCard group={[variant()]} conceptId="c1" />);
    await user.click(screen.getByRole('button', { name: 'Record the example' }));
    expect(screen.getByRole('combobox')).toHaveValue('example');
    expect(screen.getByRole('button', { name: 'Record the example' })).toHaveAttribute('aria-expanded', 'true');
    await user.click(screen.getByRole('button', { name: /record a pronunciation/i }));
    expect(screen.getByRole('combobox')).toHaveValue('headword');
  });

  it('hides "Record the example" without an example and says so while one is under review', () => {
    const { unmount } = wrap(<VariantCard group={[variant({ example: '', audioSlots: variant().audioSlots.filter((s) => s.slot !== 'example') })]} conceptId="c1" />);
    expect(screen.queryByRole('button', { name: 'Record the example' })).not.toBeInTheDocument();
    unmount();
    wrap(<VariantCard group={[variant({ audioOpen: ['example'] })]} conceptId="c1" />);
    expect(screen.queryByRole('button', { name: 'Record the example' })).not.toBeInTheDocument();
    expect(screen.getByText(/a recording of the example is under review/i)).toBeInTheDocument();
  });

  it('opens the recorder on the linked region and slot from ?record=&slot=', async () => {
    useAuth.mockReturnValue({ user: { id: 'u1', role: 'user' } });
    api.get.mockResolvedValueOnce({ data: { data: {
      _id: 'c1', englishGloss: 'sun', partOfSpeech: 'noun',
      variants: [variant(), variant({ _id: 'v2', region: 'Hangu', example: 'لمر ګرم دی' })],
    } } });
    wrap(<ConceptDetail />, '/concepts/c1?record=v2&slot=example');
    expect(await screen.findByRole('region', { name: 'Record a pronunciation' })).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveValue('example');
    expect(screen.getByText('لمر ګرم دی')).toBeInTheDocument();
  });

  it('does not open the recorder from the link for a guest', async () => {
    api.get.mockResolvedValueOnce({ data: { data: { _id: 'c1', englishGloss: 'sun', partOfSpeech: 'noun', variants: [variant()] } } });
    wrap(<ConceptDetail />, '/concepts/c1?record=v1&slot=headword');
    expect(await screen.findByRole('button', { name: /record a pronunciation/i })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Record a pronunciation' })).not.toBeInTheDocument();
  });

  it('sends guests to log in when they try to record', async () => {
    const user = userEvent.setup();
    wrap(<VariantCard group={[variant()]} conceptId="c1" />);
    await user.click(screen.getByRole('button', { name: /record a pronunciation/i }));
    expect(await screen.findByText('Login page')).toBeInTheDocument();
  });

  it('a logged-in user picks a slot (ones under review are disabled) and uploads a file', async () => {
    const user = userEvent.setup();
    useAuth.mockReturnValue({ user: { id: 'u1', role: 'user' } });
    uploadAudio.mockResolvedValue({ data: { data: { _id: 'a9' } } });
    wrap(<VariantCard group={[variant({ audioOpen: ['headword'] })]} conceptId="c1" />);

    await user.click(screen.getByRole('button', { name: /record a pronunciation/i }));
    const select = screen.getByRole('combobox');
    expect(within(select).getByRole('option', { name: 'Word (under review)' })).toBeDisabled();
    expect(select).toHaveValue('example');
    await user.selectOptions(select, 'form:masculine.plural.direct');
    expect(screen.getByText(/this form has no text yet/i)).toBeInTheDocument();

    const file = new File([new Uint8Array([1, 2, 3])], 'note.ogg', { type: 'audio/ogg' });
    await user.upload(screen.getByLabelText('Upload a recording'), file);
    await user.click(screen.getByRole('button', { name: 'Submit for review' }));

    await waitFor(() => expect(uploadAudio).toHaveBeenCalledWith('v1', 'form:masculine.plural.direct', file));
    expect(await screen.findByText(/waiting for review/i)).toBeInTheDocument();
  });

  it('refuses files over 1 MB before uploading and shows server errors', async () => {
    const user = userEvent.setup();
    useAuth.mockReturnValue({ user: { id: 'u1', role: 'user' } });
    wrap(<VariantCard group={[variant()]} conceptId="c1" />);
    await user.click(screen.getByRole('button', { name: /record a pronunciation/i }));

    const big = new File([new Uint8Array(1024 * 1024 + 1)], 'big.mp3', { type: 'audio/mpeg' });
    await user.upload(screen.getByLabelText('Upload a recording'), big);
    expect(screen.getByRole('alert')).toHaveTextContent('1 MB or smaller');

    uploadAudio.mockRejectedValue({ response: { data: { error: { message: 'The recording is too long: this one allows up to 3 seconds' } } } });
    await user.upload(screen.getByLabelText('Upload a recording'), new File([new Uint8Array(4)], 'a.mp3', { type: 'audio/mpeg' }));
    await user.click(screen.getByRole('button', { name: 'Submit for review' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('up to 3 seconds');
  });
});

describe('useRecorder', () => {
  function installRecorder(supported) {
    const tracks = [{ stop: vi.fn() }];
    navigator.mediaDevices = { getUserMedia: vi.fn(() => Promise.resolve({ getTracks: () => tracks })) };
    class FakeRecorder {
      static isTypeSupported = (t) => supported.includes(t);
      constructor(_stream, options) { this.mimeType = options?.mimeType ?? ''; this.state = 'inactive'; }
      start() { this.state = 'recording'; }
      stop() {
        this.state = 'inactive';
        this.ondataavailable({ data: new Blob([new Uint8Array(10)]) });
        this.onstop();
      }
    }
    window.MediaRecorder = FakeRecorder;
    return tracks;
  }

  it('records Opus in WebM where supported, MP4 on Safari, and stops itself at the limit', async () => {
    vi.useFakeTimers();
    const tracks = installRecorder(['audio/mp4']);
    const { result } = renderHook(() => useRecorder(2));
    await act(async () => { await result.current.start(); });
    expect(result.current.status).toBe('recording');

    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(result.current.status).toBe('recorded');
    expect(result.current.blob.type).toBe('audio/mp4');
    expect(tracks[0].stop).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('explains a blocked microphone', async () => {
    installRecorder(['audio/webm;codecs=opus']);
    navigator.mediaDevices.getUserMedia = vi.fn(() => Promise.reject(Object.assign(new Error('no'), { name: 'NotAllowedError' })));
    const { result } = renderHook(() => useRecorder(5));
    await act(async () => { await result.current.start(); });
    expect(result.current.status).toBe('idle');
    expect(result.current.error).toMatch(/microphone access was blocked/i);
  });
});

describe('moderation', () => {
  const queued = (fields = {}) => ({
    ...clip({ _id: 'n1', submittedBy: { _id: 'u5', username: 'zarin' } }),
    slot: 'headword', status: 'pending',
    variant: { _id: 'v1', pashto: 'لمر', region: 'Kohat', concept: { englishGloss: 'sun' } },
    slotInfo: { slot: 'headword', text: 'لمر', maxSeconds: 3 },
    current: clip({ _id: 'old' }),
    ...fields,
  });

  it('a replacement shows the current and new recordings side by side, both playable', () => {
    render(<LookupsWrapper><ul><AudioQueueRow clip={queued()} isAdmin={false} userId="u1" onApprove={vi.fn()} onReject={vi.fn()} onPublish={vi.fn()} /></ul></LookupsWrapper>);
    expect(screen.getByText('Current')).toBeInTheDocument();
    expect(screen.getByText('Replacement')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play current recording' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play replacement recording' })).toBeInTheDocument();
    expect(screen.getByText('by gul (Shakardara, Kohat)')).toBeInTheDocument();
  });

  it('the queue page has an Audio view that loads recordings and approves them', async () => {
    const user = userEvent.setup();
    useAuth.mockReturnValue({ user: { id: 'u1', role: 'moderator' } });
    getAudioQueue.mockResolvedValue({ data: { data: [queued()], meta: { total: 1, limit: 20, pendingCount: 1 } } });
    transitionAudio.mockResolvedValue({ data: { data: {} } });
    render(
      <MemoryRouter initialEntries={['/dashboard/queue?view=audio']}>
        <LookupsWrapper><DashboardQueue /></LookupsWrapper>
      </MemoryRouter>
    );
    expect(screen.getByRole('tab', { name: 'Audio' })).toHaveAttribute('aria-selected', 'true');
    await user.click(await screen.findByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(transitionAudio).toHaveBeenCalledWith('n1', { status: 'approved' }));
    expect(getAudioQueue).toHaveBeenCalledTimes(2);
  });

  it('a moderator cannot review their own recording', () => {
    render(<LookupsWrapper><ul><AudioQueueRow clip={queued()} isAdmin={false} userId="u5" onApprove={vi.fn()} onReject={vi.fn()} onPublish={vi.fn()} /></ul></LookupsWrapper>);
    expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled();
    expect(screen.getByText(/another moderator must review it/i)).toBeInTheDocument();
  });

  it('an admin removes a live recording with a note', async () => {
    const user = userEvent.setup();
    transitionAudio.mockResolvedValue({ data: { data: {} } });
    render(<LookupsWrapper><PublishedClips variant={variant({ audio: { headword: clip() } })} /></LookupsWrapper>);
    await user.click(screen.getByRole('button', { name: 'Remove Word recording' }));
    await user.type(screen.getByLabelText('Reason for rejection'), 'Wrong word');
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(transitionAudio).toHaveBeenCalledWith('a1', { status: 'rejected', moderatorNote: 'Wrong word' }));
    expect(screen.queryByRole('button', { name: 'Remove Word recording' })).not.toBeInTheDocument();
  });

  it('an edit that would remove recordings warns first, then resends with confirmation', async () => {
    const user = userEvent.setup();
    api.patch
      .mockRejectedValueOnce({ response: { status: 409, data: { error: { field: 'confirmAudioRetire', message: 'This change removes 1 recording.', retiring: [{ _id: 'a1', slot: 'headword', status: 'published', speaker: 'gul' }] } } } })
      .mockResolvedValueOnce({ data: { data: { _id: 'v1' } } });
    const onSave = vi.fn();
    render(<LookupsWrapper><FieldsWrapper>
      <VariantEditForm item={{ _id: 'v1', pashto: 'لمر', region: 'Kohat', definition: 'sun', concept: { _id: 'c1' } }} onSave={onSave} onCancel={() => {}} />
    </FieldsWrapper></LookupsWrapper>);

    await user.type(screen.getByLabelText('Note'), 'spelling');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Word')).toBeInTheDocument();
    expect(within(dialog).getByText(/recorded by gul/)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: /remove recordings and save/i }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(api.patch).toHaveBeenLastCalledWith('/api/variants/v1/edit', expect.objectContaining({ confirmAudioRetire: true, note: 'spelling' }));
  });

  it('cancelling the warning saves nothing', async () => {
    const user = userEvent.setup();
    api.patch.mockRejectedValueOnce({ response: { status: 409, data: { error: { field: 'confirmAudioRetire', retiring: [{ _id: 'a1', slot: 'example', status: 'pending' }] } } } });
    const onSave = vi.fn();
    render(<LookupsWrapper><FieldsWrapper>
      <VariantEditForm item={{ _id: 'v1', pashto: 'لمر', region: 'Kohat', definition: 'sun', concept: { _id: 'c1' } }} onSave={onSave} onCancel={() => {}} />
    </FieldsWrapper></LookupsWrapper>);
    await user.type(screen.getByLabelText('Note'), 'x');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.patch).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('My recordings', () => {
  it('lists my clips with status and note, and withdraws a pending one', async () => {
    const user = userEvent.setup();
    getMyAudio.mockResolvedValue({ data: { data: [
      { ...clip({ _id: 'p1' }), slot: 'headword', status: 'pending', slotText: 'لمر', variant: { _id: 'v1', pashto: 'لمر', region: 'Kohat', concept: { _id: 'c1', englishGloss: 'sun' } } },
      { _id: 'r1', slot: 'example', status: 'rejected', moderatorNote: 'Too quiet', mimeType: 'audio/webm', slotText: 'لمر راختلی دی', variant: { _id: 'v1', pashto: 'لمر', region: 'Kohat', concept: { _id: 'c1', englishGloss: 'sun' } } },
    ], meta: { total: 2, limit: 20 } } });
    withdrawAudio.mockResolvedValue({ data: { data: {} } });
    render(<MemoryRouter><LookupsWrapper><MyRecordings /></LookupsWrapper></MemoryRouter>);

    expect(await screen.findByText('Note: Too quiet')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Withdraw' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Play your recording' })).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Withdraw' }));
    await waitFor(() => expect(withdrawAudio).toHaveBeenCalledWith('p1'));
    await waitFor(() => expect(getMyAudio).toHaveBeenCalledTimes(2));
  });

  it('says so when I have no recordings', async () => {
    getMyAudio.mockResolvedValue({ data: { data: [], meta: { total: 0 } } });
    render(<MemoryRouter><LookupsWrapper><MyRecordings /></LookupsWrapper></MemoryRouter>);
    expect(await screen.findByText('You have not recorded anything yet.')).toBeInTheDocument();
  });
});

describe('AudioQueueRow — recording sent with an unpublished word', () => {
  const withWord = (status, clipStatus = 'approved') => ({
    ...clip({ _id: 'n2', submittedBy: { _id: 'u5', username: 'zarin' } }),
    slot: 'headword', status: clipStatus, current: null,
    variant: { _id: 'v1', pashto: 'لمر', region: 'Kohat', status, concept: { englishGloss: 'sun' } },
    slotInfo: { slot: 'headword', text: 'لمر', maxSeconds: 3 },
  });

  it('shows the word status and blocks publishing until the word is published', () => {
    render(<LookupsWrapper><ul><AudioQueueRow clip={withWord('pending')} isAdmin userId="a1" onApprove={vi.fn()} onReject={vi.fn()} onPublish={vi.fn()} /></ul></LookupsWrapper>);
    expect(screen.getByText('Word pending')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled();
    expect(screen.getByText(/publish the word first/i)).toBeInTheDocument();
  });

  it('lets a moderator approve a pending clip on a pending word', () => {
    render(<LookupsWrapper><ul><AudioQueueRow clip={withWord('pending', 'pending')} isAdmin={false} userId="m1" onApprove={vi.fn()} onReject={vi.fn()} onPublish={vi.fn()} /></ul></LookupsWrapper>);
    expect(screen.getByRole('button', { name: 'Approve' })).toBeEnabled();
  });

  it('shows no word badge once the word is published', () => {
    render(<LookupsWrapper><ul><AudioQueueRow clip={withWord('published')} isAdmin userId="a1" onApprove={vi.fn()} onReject={vi.fn()} onPublish={vi.fn()} /></ul></LookupsWrapper>);
    expect(screen.queryByText(/^Word (pending|approved)$/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish' })).toBeEnabled();
  });
});

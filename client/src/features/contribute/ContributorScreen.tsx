import type { DialectInfo, TranscriptScript } from '@gram-saathi/shared';
import { ArrowDownToLine, Check, Mic, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { format, useStrings } from '@/lib/i18n';
import { buildContributionExport, consentAllowsRecording, detectScript, type LocalContribution } from './contributionLogic';
import { deleteContribution, listContributions, saveContribution } from './contributionStore';
import { contributeStrings } from './strings';

const MAX_RECORDING_MS = 15_000;
const SPEAKER_KEY = 'gs:contributor:speaker-id';

function speakerId(): string {
  let id = localStorage.getItem(SPEAKER_KEY);
  if (!id) {
    id = `speaker-${crypto.randomUUID()}`;
    localStorage.setItem(SPEAKER_KEY, id);
  }
  return id;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

export function ContributorScreen() {
  const t = useStrings(contributeStrings);
  const currentText = useRef(t);
  const [consent, setConsent] = useState(false);
  const [dialects, setDialects] = useState<DialectInfo[]>([]);
  const [label, setLabel] = useState('');
  const [district, setDistrict] = useState('');
  const [area, setArea] = useState('');
  const [codeSwitch, setCodeSwitch] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [script, setScript] = useState<TranscriptScript>('other');
  const [hindiMeaning, setHindiMeaning] = useState('');
  const [items, setItems] = useState<LocalContribution[]>([]);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState('');
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const stopTimer = useRef<number | undefined>(undefined);

  useEffect(() => { currentText.current = t; }, [t]);

  const refresh = useCallback(() => listContributions(), []);

  useEffect(() => {
    void Promise.resolve().then(refresh).then(setItems).catch(() => setNotice(currentText.current.localUnavailable));
    void api.getDialects().then(({ items: values }) => {
      setDialects(values);
      setLabel(values[0]?.id ?? '');
    }).catch(() => setNotice(currentText.current.dialectsUnavailable));
  }, [refresh]);

  useEffect(() => {
    if (!recordingBlob) return;
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      if (!navigator.onLine) {
        setNotice(currentText.current.offlineTranscribe);
        return;
      }
      setWorking(true);
      setNotice(currentText.current.transcribing);
      try {
        const response = await api.dialectTranscribe({ audio: recordingBlob });
        if (!active) return;
        setTranscript(response.transcript);
        setScript(response.script);
        setNotice(currentText.current.transcriptReady);
      } catch {
        if (active) setNotice(currentText.current.transcribeFailed);
      } finally { if (active) setWorking(false); }
    });
    return () => { active = false; };
  }, [recordingBlob]);

  useEffect(() => () => {
    window.clearTimeout(stopTimer.current);
    if (recorder.current?.state === 'recording') recorder.current.stop();
    stream.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const counts = useMemo(() => new Map(dialects.map((entry) => [entry.id, items.filter((row) => row.label === entry.id).length])), [dialects, items]);

  const stopRecording = () => {
    window.clearTimeout(stopTimer.current);
    if (recorder.current?.state === 'recording') recorder.current.stop();
  };

  const startRecording = async () => {
    if (!consentAllowsRecording(consent) || !navigator.mediaDevices?.getUserMedia) {
      setNotice(t.micNeedsSecure);
      return;
    }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const candidates = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg'];
      const mimeType = candidates.find((type) => MediaRecorder.isTypeSupported(type));
      const activeRecorder = new MediaRecorder(stream.current, mimeType ? { mimeType } : undefined);
      recorder.current = activeRecorder;
      chunks.current = [];
      startedAt.current = Date.now();
      activeRecorder.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data); };
      activeRecorder.onstop = () => {
        const elapsed = Math.min(MAX_RECORDING_MS, Date.now() - startedAt.current);
        const blob = new Blob(chunks.current, { type: activeRecorder.mimeType || 'audio/webm' });
        setDurationMs(elapsed);
        setRecordingBlob(blob);
        setTranscript('');
        setHindiMeaning('');
        setScript('other');
        setRecording(false);
        stream.current?.getTracks().forEach((track) => track.stop());
        stream.current = null;
      };
      activeRecorder.start();
      setRecording(true);
      setNotice(t.recording);
      stopTimer.current = window.setTimeout(stopRecording, MAX_RECORDING_MS);
    } catch {
      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = null;
      setNotice(t.micUnavailable);
    }
  };

  const save = async () => {
    if (!consentAllowsRecording(consent) || !recordingBlob || !label || !district.trim() || !area.trim() || !transcript.trim() || !hindiMeaning.trim()) return;
    const row: LocalContribution = {
      id: crypto.randomUUID(), label, transcript: transcript.trim(), hindiMeaning: hindiMeaning.trim(),
      script: script === 'other' ? detectScript(transcript) : script, district: district.trim(), area: area.trim(),
      speakerAnonId: speakerId(), consent: true, codeSwitch, durationMs, audioBlob: recordingBlob,
      audioMime: recordingBlob.type || 'audio/webm', createdAt: Date.now(),
    };
    setWorking(true);
    try {
      await saveContribution(row);
      setItems(await refresh());
      setRecordingBlob(null);
      setTranscript('');
      setHindiMeaning('');
      setNotice(t.saveNotice);
    } catch {
      setNotice(t.saveFailed);
    } finally { setWorking(false); }
  };

  const exportJson = async () => {
    const payload = await Promise.all(items.map(async (row) => buildContributionExport(row, await blobToBase64(row.audioBlob))));
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'gram-saathi-contributions.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4 pb-8">
      <header className="rounded-[2rem] bg-brand-950 p-6 text-white shadow-lift">
        <p className="text-sm font-bold tracking-wide text-marigold-300">{t.category}</p>
        <h1 className="mt-2 text-3xl font-extrabold">{t.title}</h1>
        <p className="mt-3 text-lg leading-relaxed text-brand-100">{t.intro}</p>
      </header>

      {!consent ? (
        <section className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-brand-200">
          <h2 className="text-xl font-extrabold text-brand-950">{t.consentTitle}</h2>
          <p className="mt-2 text-lg leading-relaxed text-slate-700">{t.consentBody}</p>
          <label className="mt-4 flex min-h-14 items-center gap-3 text-lg font-semibold text-slate-800">
            <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="size-6 accent-indigo-700" />
            {t.consentCheck}
          </label>
          <p className="mt-3 text-base text-slate-600">{t.privacy}</p>
        </section>
      ) : (
        <>
          <section className="grid gap-4 rounded-3xl bg-white p-5 shadow-soft ring-1 ring-brand-200">
            <label className="grid gap-2 text-lg font-bold">{t.variety}
              <select value={label} onChange={(event) => setLabel(event.target.value)} className="min-h-14 rounded-2xl border border-slate-300 bg-cream-50 px-4 text-lg">
                {dialects.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.nativeName}</option>)}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2 text-lg font-bold">{t.district}<input value={district} onChange={(event) => setDistrict(event.target.value)} className="min-h-14 rounded-2xl border border-slate-300 px-4" /></label>
              <label className="grid gap-2 text-lg font-bold">{t.area}<input value={area} onChange={(event) => setArea(event.target.value)} className="min-h-14 rounded-2xl border border-slate-300 px-4" /></label>
            </div>
            <label className="flex min-h-14 items-center gap-3 text-lg font-semibold"><input type="checkbox" checked={codeSwitch} onChange={(event) => setCodeSwitch(event.target.checked)} className="size-6 accent-indigo-700" />{t.codeSwitch}</label>
            <p className="rounded-2xl bg-marigold-50 p-4 text-lg leading-relaxed text-marigold-950">{t.naturalHint}</p>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="lg" onClick={() => recording ? stopRecording() : void startRecording()} disabled={working || (!consent && !recording)}>
                <Mic aria-hidden className="size-5" />{recording ? t.stop : t.record}
              </Button>
              {recording && <span role="status" className="font-semibold text-brand-800">{t.recordingShort}</span>}
            </div>
            {recordingBlob && <p className="flex items-center gap-2 text-base font-semibold text-brand-800"><Check aria-hidden className="size-5" />{format(t.audioReady, { duration: Math.round(durationMs / 100) / 10 })}</p>}
            <label className="grid gap-2 text-lg font-bold">{t.transcript}<textarea rows={3} value={transcript} onChange={(event) => { setTranscript(event.target.value); setScript(detectScript(event.target.value)); }} className="rounded-2xl border border-slate-300 bg-cream-50 p-4 text-lg font-normal leading-relaxed" placeholder={t.transcriptPlaceholder} /></label>
            <label className="grid gap-2 text-lg font-bold">{t.meaning} <span className="text-sm font-semibold text-marigold-800">{t.required}</span><textarea rows={3} value={hindiMeaning} onChange={(event) => setHindiMeaning(event.target.value)} className="rounded-2xl border border-slate-300 bg-cream-50 p-4 text-lg font-normal leading-relaxed" placeholder={t.meaningPlaceholder} /></label>
            <Button size="lg" onClick={() => void save()} disabled={working || !recordingBlob || !label || !district.trim() || !area.trim() || !transcript.trim() || !hindiMeaning.trim()}>{t.save}</Button>
          </section>
          {notice && <p role="status" aria-live="polite" className="rounded-2xl bg-brand-50 p-4 text-base font-semibold text-brand-900">{notice}</p>}
          <section className="rounded-3xl bg-white p-5 shadow-soft ring-1 ring-brand-200">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="text-xl font-extrabold">{t.recordings}</h2><p className="text-base text-slate-600">{format(t.savedCount, { count: items.length })}</p></div>
              <Button size="md" variant="secondary" onClick={() => void exportJson()} disabled={!items.length}><ArrowDownToLine aria-hidden className="size-5" />{t.export}</Button>
            </div>
            <div className="mt-4 grid gap-3">
              {dialects.map((entry) => {
                const count = counts.get(entry.id) ?? 0;
                return <div key={entry.id} className="rounded-2xl bg-cream-50 p-3 ring-1 ring-slate-200"><div className="flex justify-between gap-3 text-base font-bold"><span>{entry.name}</span><span>{count}/20</span></div><div role="progressbar" aria-label={format(t.progress, { name: entry.name })} aria-valuemin={0} aria-valuemax={20} aria-valuenow={Math.min(20, count)} className="mt-2 h-3 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-marigold-500" style={{ width: `${Math.min(100, count * 5)}%` }} /></div></div>;
              })}
            </div>
            <ul className="mt-4 grid gap-2">
              {items.map((row) => <li key={row.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 p-3"><span className="min-w-0"><span className="block truncate font-bold">{dialects.find((item) => item.id === row.label)?.name ?? row.label}</span><span className="block truncate text-base text-slate-600">{row.transcript}</span></span><button aria-label={format(t.delete, { transcript: row.transcript })} onClick={() => void deleteContribution(row.id).then(refresh).then(setItems)} className="grid size-12 shrink-0 place-items-center rounded-full text-red-800 hover:bg-red-50"><Trash2 aria-hidden /></button></li>)}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

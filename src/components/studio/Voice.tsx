import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { generateImage } from '@/lib/ai';

type Rec = { lang: string; continuous: boolean; interimResults: boolean; start: () => void; stop: () => void; onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null; onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null };

/** Bengali voice typing via the browser's speech recognition (bn-BD). Final phrases are appended to the input. */
export function MicButton({ value, onChange, disabled, onError }: { value: string; onChange: (v: string) => void; disabled?: boolean; onError: (m: string) => void }) {
  const [on, setOn] = useState(false), rec = useRef<Rec | null>(null), base = useRef('');
  const valueRef = useRef(value); valueRef.current = value;
  useEffect(() => () => rec.current?.stop(), []);
  const toggle = () => {
    if (on) { rec.current?.stop(); return; }
    const W = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
    const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Ctor) { onError('এই ব্রাউজারে ভয়েস টাইপিং নেই — Chrome বা Edge ব্যবহার করুন।'); return; }
    const r = new Ctor(); r.lang = 'bn-BD'; r.continuous = true; r.interimResults = true;
    base.current = valueRef.current ? valueRef.current.trimEnd() + ' ' : '';
    r.onresult = e => { let fin = '', tmp = ''; for (let i = 0; i < e.results.length; i++) { const res = e.results[i]!; if (res.isFinal) fin += res[0].transcript + ' '; else tmp += res[0].transcript; } onChange((base.current + fin + tmp).replace(/\s+$/, tmp ? '' : ' ')); };
    r.onerror = e => { if (e.error === 'not-allowed') onError('মাইক্রোফোনের অনুমতি দিন।'); else if (e.error !== 'no-speech' && e.error !== 'aborted') onError('ভয়েস টাইপিং ব্যর্থ: ' + e.error); };
    r.onend = () => setOn(false);
    rec.current = r; r.start(); setOn(true);
  };
  return <Button variant={on ? 'destructive' : 'ghost'} size="icon" aria-label={on ? 'ভয়েস টাইপিং বন্ধ' : 'বাংলায় বলে লিখুন'} title={on ? 'ভয়েস টাইপিং বন্ধ' : 'মাইক্রোফোনে বাংলায় বলুন'} disabled={disabled} onClick={toggle} className={on ? 'animate-pulse' : ''}>{on ? <MicOff /> : <Mic />}</Button>;
}

let current: HTMLAudioElement | null = null;
/** Speak a short Bengali summary: device Bengali voice if present, otherwise AI-generated Bengali speech. */
export async function speakBn(text: string) {
  const say = text.replace(/```[\s\S]*?```/g, '').replace(/[#*`_>-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 280);
  if (!say) return;
  window.speechSynthesis?.cancel(); current?.pause();
  const voice = window.speechSynthesis?.getVoices().find(v => v.lang.toLowerCase().startsWith('bn'));
  if (voice) { const u = new SpeechSynthesisUtterance(say); u.voice = voice; u.lang = voice.lang; window.speechSynthesis.speak(u); return; }
  try { const url = await generateImage(say, undefined, 'audio'); current = new Audio(url); await current.play(); } catch { /* optional */ }
}
export const stopSpeaking = () => { window.speechSynthesis?.cancel(); current?.pause(); };

export function SpeakToggle({ on, setOn }: { on: boolean; setOn: (v: boolean) => void }) {
  return <Button variant={on ? 'secondary' : 'ghost'} size="icon" aria-label={on ? 'AI কণ্ঠ বন্ধ' : 'AI বাংলায় বলে শোনাবে'} title={on ? 'AI কণ্ঠ বন্ধ' : 'AI প্রতিটা ধাপ ও সারাংশ বাংলায় বলবে'} onClick={() => { if (on) stopSpeaking(); setOn(!on); }}>{on ? <Volume2 /> : <VolumeX />}</Button>;
}

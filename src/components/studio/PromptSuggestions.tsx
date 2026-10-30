import { useEffect, useRef, useState } from 'react';
import { Sparkles, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { checkStatus, MODELS, streamChat } from '@/lib/ai';
import { SUGGESTION_SYSTEM } from '@/lib/agents/prompts';
export function PromptSuggestions({ value, busy, enabled, setEnabled, accept }: { value: string; busy: boolean; enabled: boolean; setEnabled: (value: boolean) => void; accept: (value: string) => void }) {
  const [suggestion, setSuggestion] = useState('');
  const [error, setError] = useState('');
  const lastCall = useRef(0);
  useEffect(() => {
    setSuggestion(''); setError('');
    if (!enabled || busy || value.trim().length < 12 || document.hidden) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      if (Date.now() - lastCall.current < 15000) return;
      lastCall.current = Date.now();
      try {
        const status = await checkStatus();
        if (controller.signal.aborted) return;
        if (!status.models.includes(MODELS.reason)) { setError('সাজেশনের জন্য Qwen 14B ইনস্টল প্রয়োজন।'); return; }
        const text = await streamChat({ model: MODELS.reason, system: SUGGESTION_SYSTEM, messages: [{ role: 'user', content: value.slice(0, 600) }], signal: controller.signal, onToken: () => {} });
        if (!controller.signal.aborted) setSuggestion(text.trim().slice(0, 180));
      } catch { if (!controller.signal.aborted) setError('সাজেশন পাওয়া যায়নি।'); }
    }, 1500);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [value, enabled, busy]);
  return <div><label className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} className="accent-primary" /><Sparkles className="h-3 w-3" />লেখার সাজেশন</label>{error && <p className="mt-1 text-xs text-warning">{error}</p>}{suggestion && <div className="mt-2 flex items-start gap-1 border-l-2 border-primary pl-2"><p className="flex-1 text-xs">{suggestion}</p><Button variant="ghost" size="icon" aria-label="সাজেশন গ্রহণ" onClick={() => { accept(suggestion); setSuggestion(''); }}><Check /></Button><Button variant="ghost" size="icon" aria-label="সাজেশন বাদ দিন" onClick={() => setSuggestion('')}><X /></Button></div>}</div>;
}

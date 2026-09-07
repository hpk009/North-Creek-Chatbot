import { AlertCircle, ArrowLeft, BookOpen, Check, ExternalLink, LoaderCircle, RotateCcw, Send, Sparkles, WifiOff } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { ChatIcon } from '@/components/school-shell';

type Source = { title: string; reference?: string; url?: string };
type ChatMessage = { id: string; role: 'assistant' | 'user'; content: string; sources?: Source[]; demo?: boolean; error?: boolean };

const suggestions = ['When is the next school holiday?', 'How do I report an absence?', 'What clubs run after school?', 'Where can I find the uniform list?'];

const demoAnswer = (question: string): { answer: string; sources: Source[] } => {
  const lower = question.toLowerCase();
  if (lower.includes('holiday') || lower.includes('term')) {
    return { answer: 'The next school holiday begins on Monday 21 October. The autumn term ends on Friday 20 December at 12:30pm. Please check the term dates page for inset days and the full year calendar.', sources: [{ title: 'North Creek High School term dates', reference: 'School calendar · page 2' }] };
  }
  if (lower.includes('absence') || lower.includes('absent') || lower.includes('sick')) {
    return { answer: 'Please report an absence before 9:00am on the first day by calling the school office or using the absence form in the parent portal. Include your child’s name, class, and a brief reason. If the absence continues, please update the school each morning.', sources: [{ title: 'Attendance and absence guide', reference: 'Family handbook · page 8' }] };
  }
  if (lower.includes('club') || lower.includes('after school')) {
    return { answer: 'After-school clubs change each term. The current list includes art studio, chess, coding, choir, football, and gardening. Places are booked through the activities page in the parent portal.', sources: [{ title: 'Clubs and activities · Autumn term', reference: 'Activities guide · page 1' }] };
  }
  if (lower.includes('uniform')) {
    return { answer: 'The uniform list is in the family handbook and on the school website under Families → Uniform. The school shop is open on Tuesday and Thursday afternoons during term time.', sources: [{ title: 'Family handbook', reference: 'Uniform and equipment · page 12' }] };
  }
  return { answer: 'I can help you find information about school dates, attendance, clubs, uniform, lunches, trips, and how to contact the right team. Try asking a little more specifically, or contact the North Creek High School office if you need personal help.', sources: [{ title: 'North Creek High School information guide', reference: 'Welcome section · page 3' }] };
};

function createSessionId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `school-session-${Date.now()}`;
}

export default function Chat() {
  const [location] = useLocation();
  const [sessionId, setSessionId] = useState(createSessionId);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'welcome', role: 'assistant', content: 'Hello. I’m The Bell, North Creek High School’s guide. What would you like to find out?', sources: [{ title: 'About The Bell', reference: 'School information guide' }] },
  ]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const initializedQuery = useRef(false);
  const webhookId = '3c8760de-d90a-4f58-b531-9f60adaefc2e';
  const configuredWebhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL as string | undefined;
  const n8nBaseUrl = import.meta.env.VITE_N8N_BASE_URL as string | undefined;
  const webhookUrl = configuredWebhookUrl || (n8nBaseUrl ? `${n8nBaseUrl.replace(/\/$/, '')}/webhook/${webhookId}` : undefined);
  const isDemo = !webhookUrl;
  const questionFromUrl = useMemo(() => new URLSearchParams(location.split('?')[1] || '').get('question') || '', [location]);

  useEffect(() => {
    if (!initializedQuery.current && questionFromUrl) {
      setInput(questionFromUrl);
      initializedQuery.current = true;
    }
  }, [questionFromUrl]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, pending]);

  const resetChat = () => {
    setSessionId(createSessionId());
    setMessages([{ id: `welcome-${Date.now()}`, role: 'assistant', content: 'Fresh page, fresh question. What can I help you find?', sources: [{ title: 'About The Bell', reference: 'School information guide' }] }]);
    setInput('');
    setError(null);
  };

  const sendQuestion = async (event?: FormEvent) => {
    event?.preventDefault();
    const question = input.trim();
    if (!question || pending) return;
    setInput('');
    setError(null);
    const userMessage: ChatMessage = { id: `user-${Date.now()}`, role: 'user', content: question };
    setMessages((current) => [...current, userMessage]);
    setPending(true);
    try {
      if (!webhookUrl) {
        await new Promise((resolve) => setTimeout(resolve, 850));
        const response = demoAnswer(question);
        setMessages((current) => [...current, { id: `answer-${Date.now()}`, role: 'assistant', content: response.answer, sources: response.sources, demo: true }]);
      } else {
        const result = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'sendMessage', chatInput: question, sessionId }),
        });
        if (!result.ok) throw new Error('The school guide could not be reached right now.');
        const rawPayload = await result.json() as unknown;
        const payload = Array.isArray(rawPayload) ? rawPayload[0] : rawPayload;
        const record = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
        const answer = [record.answer, record.output, record.response, record.text, record.message]
          .find((value): value is string => typeof value === 'string' && value.trim().length > 0);
        if (!answer) throw new Error('The response did not include an answer.');
        const rawSources = record.sources;
        const sources: Source[] = Array.isArray(rawSources)
          ? rawSources.map((source) => typeof source === 'string' ? { title: source } : source as Source)
          : [];
        setMessages((current) => [...current, { id: `answer-${Date.now()}`, role: 'assistant', content: answer, sources }]);
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Something went wrong while looking that up.';
      setError(message);
      setMessages((current) => [...current, { id: `error-${Date.now()}`, role: 'assistant', content: 'I couldn’t reach the school information right now. Please try again, or contact the school office directly.', error: true }]);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-76px)] max-w-7xl flex-col px-4 py-6 sm:px-8 lg:flex-row lg:gap-8 lg:px-12 lg:py-8">
      <aside className="mb-5 flex shrink-0 items-center justify-between lg:mb-0 lg:w-64 lg:flex-col lg:items-stretch lg:justify-start">
        <div>
          <Link href="/" data-testid="link-chat-back" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]"><ArrowLeft size={16} /> Back to home</Link>
          <div className="hidden rounded-[24px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 lg:block">
            <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-2xl bg-[hsl(var(--accent)/.15)] text-[hsl(var(--accent-foreground))]"><Sparkles size={19} /></span><div><p className="font-bold">Ask The Bell</p><p className="font-mono-ui text-[9px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">North Creek guide</p></div></div>
            <div className="mt-6 border-t border-[hsl(var(--border))] pt-5"><p className="text-xs leading-5 text-[hsl(var(--muted-foreground))]">Try a question about the school day. Answers are based on school-provided information.</p></div>
          </div>
        </div>
        <button type="button" onClick={resetChat} data-testid="button-start-over" className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] px-3.5 py-2 text-xs font-bold text-[hsl(var(--muted-foreground))] transition-colors hover:border-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]"><RotateCcw size={14} /> Start over</button>
      </aside>

      <section className="flex min-h-[650px] min-w-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-[0_20px_70px_hsl(var(--primary)/.07)]" aria-label="Conversation with The Bell">
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-5 py-4 sm:px-7">
          <div className="flex items-center gap-3"><span className="relative grid size-10 place-items-center rounded-2xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"><ChatIcon /><span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-[hsl(var(--card))] bg-[hsl(var(--secondary-foreground))]" /></span><div><h1 className="font-bold" data-testid="text-chat-title">The Bell</h1><p className="font-mono-ui text-[9px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">North Creek High School</p></div></div>
          <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 font-mono-ui text-[9px] font-bold uppercase tracking-wider ${isDemo ? 'bg-[hsl(var(--accent)/.14)] text-[hsl(var(--accent-foreground))]' : 'bg-[hsl(var(--secondary)/.55)] text-[hsl(var(--secondary-foreground))]'}`} data-testid="status-chat-mode">{isDemo ? <><WifiOff size={12} /> Preview mode</> : <><span className="size-1.5 rounded-full bg-current" /> Connected</>}</div>
        </div>

        <div className="soft-grid flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
          <div className="mx-auto max-w-2xl space-y-5">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`} data-testid={`message-${message.role}-${message.id}`}>
                <div className={`max-w-[90%] sm:max-w-[78%] ${message.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                  <div className={`rounded-[20px] px-4 py-3.5 text-sm leading-6 ${message.role === 'user' ? 'rounded-tr-sm bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : message.error ? 'rounded-tl-sm border border-[hsl(var(--destructive)/.3)] bg-[hsl(var(--destructive)/.08)] text-[hsl(var(--foreground))]' : 'rounded-tl-sm border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))]'}`}>
                    {message.error && <AlertCircle size={16} className="mb-2 text-[hsl(var(--destructive))]" />}
                    <span data-testid={`text-message-${message.id}`}>{message.content}</span>
                  </div>
                  {message.role === 'assistant' && message.demo && <span className="mt-2 font-mono-ui text-[9px] uppercase tracking-[.12em] text-[hsl(var(--accent-foreground))]" data-testid={`status-demo-${message.id}`}>Preview response · not live school data</span>}
                  {message.sources && message.sources.length > 0 && <div className="mt-3 w-full space-y-2" data-testid={`sources-${message.id}`}><p className="flex items-center gap-1.5 font-mono-ui text-[9px] font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]"><BookOpen size={12} /> Sources</p>{message.sources.map((source, index) => <a key={`${source.title}-${index}`} href={source.url || '#source'} onClick={(event) => { if (!source.url) event.preventDefault(); }} data-testid={`source-${message.id}-${index}`} className="flex items-center gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/.7)] px-3 py-2 text-xs transition-colors hover:border-[hsl(var(--accent)/.6)]"><span className="grid size-5 place-items-center rounded-full bg-[hsl(var(--secondary)/.6)] text-[hsl(var(--secondary-foreground))]"><Check size={11} strokeWidth={3} /></span><span className="min-w-0 flex-1"><span className="block truncate font-semibold">{source.title}</span>{source.reference && <span className="block truncate text-[hsl(var(--muted-foreground))]">{source.reference}</span>}</span>{source.url && <ExternalLink size={13} className="shrink-0 text-[hsl(var(--muted-foreground))]" />}</a>)}</div>}
                </div>
              </div>
            ))}
            {pending && <div className="flex justify-start" data-testid="status-loading"><div className="rounded-[20px] rounded-tl-sm border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-5 py-4"><div className="flex items-center gap-2"><span className="size-2 rounded-full bg-[hsl(var(--accent))] animate-pulse-soft" /><span className="size-2 rounded-full bg-[hsl(var(--accent))] animate-pulse-soft [animation-delay:180ms]" /><span className="size-2 rounded-full bg-[hsl(var(--accent))] animate-pulse-soft [animation-delay:360ms]" /><span className="ml-2 text-xs text-[hsl(var(--muted-foreground))]">Looking through school information…</span></div></div></div>}
            <div ref={endRef} />
          </div>
        </div>

        <div className="border-t border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 sm:p-6">
          {error && <div className="mx-auto mb-3 flex max-w-2xl items-center gap-2 rounded-xl bg-[hsl(var(--destructive)/.08)] px-3 py-2 text-xs text-[hsl(var(--destructive))]" data-testid="status-chat-error"><AlertCircle size={14} /> {error}</div>}
          {messages.length < 2 && <div className="mx-auto mb-4 flex max-w-2xl flex-wrap gap-2" data-testid="suggested-questions">{suggestions.map((suggestion, index) => <button key={suggestion} type="button" onClick={() => setInput(suggestion)} data-testid={`button-suggestion-${index}`} className="rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.45)] px-3 py-2 text-left text-xs text-[hsl(var(--muted-foreground))] transition-all hover:border-[hsl(var(--accent)/.6)] hover:bg-[hsl(var(--accent)/.08)] hover:text-[hsl(var(--foreground))]">{suggestion}</button>)}</div>}
          <form onSubmit={sendQuestion} className="mx-auto flex max-w-2xl items-end gap-2 rounded-[20px] border border-[hsl(var(--input))] bg-[hsl(var(--background))] p-2 shadow-sm transition-colors focus-within:border-[hsl(var(--accent))] focus-within:ring-2 focus-within:ring-[hsl(var(--accent)/.13)]" data-testid="form-chat">
            <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendQuestion(); } }} placeholder="Ask about school life…" rows={1} aria-label="Your question" data-testid="input-question" className="max-h-28 min-h-11 flex-1 resize-none bg-transparent px-3 py-3 text-sm outline-none placeholder:text-[hsl(var(--muted-foreground))]" />
            <button type="submit" disabled={!input.trim() || pending} data-testid="button-send-question" className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40">{pending ? <LoaderCircle size={18} className="animate-spin" /> : <Send size={17} />}</button>
          </form>
          <p className="mx-auto mt-3 max-w-2xl text-center font-mono-ui text-[9px] uppercase tracking-[.11em] text-[hsl(var(--muted-foreground))]" data-testid="text-chat-disclaimer">{isDemo ? 'Preview mode · answers are examples, not live school data' : 'Grounded in school-provided information · check the source for details'}</p>
        </div>
      </section>
    </div>
  );
}
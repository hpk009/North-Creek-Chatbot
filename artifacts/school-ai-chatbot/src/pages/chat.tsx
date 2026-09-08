import { AlertCircle, ArrowLeft, LoaderCircle, RotateCcw, Send, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { ChatIcon } from '@/components/school-shell';

type ChatMessage = { id: string; role: 'assistant' | 'user'; content: string; error?: boolean };

const suggestions = ['What are North Creek High School office hours?', 'How do I report an absence?', 'When is the next school calendar event?', 'What schedules does North Creek High School follow?'];

function createSessionId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `school-session-${Date.now()}`;
}

export default function Chat() {
  const [location] = useLocation();
  const [sessionId, setSessionId] = useState(createSessionId);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'welcome', role: 'assistant', content: 'Hello. I’m The Bell, North Creek High School’s AI assistant. What would you like to find out?' },
  ]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const initializedQuery = useRef(false);
  const configuredApiUrl = import.meta.env.VITE_NORTH_CREEK_API_URL as string | undefined;
  const apiUrl = `${(configuredApiUrl || '/api').replace(/\/$/, '')}/north-creek/chat`;
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
    setMessages([{ id: `welcome-${Date.now()}`, role: 'assistant', content: 'Fresh page, fresh question. What can I help you find?' }]);
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
      const result = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, sessionId }),
      });
      if (!result.ok) throw new Error('The North Creek website index could not be reached right now.');
      const payload = await result.json() as { answer?: unknown };
      const answer = payload.answer;
      if (typeof answer !== 'string' || !answer.trim()) throw new Error('The response did not include an answer.');
      setMessages((current) => [...current, { id: `answer-${Date.now()}`, role: 'assistant', content: answer }]);
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
             <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-2xl bg-[hsl(var(--accent)/.15)] text-[hsl(var(--accent-foreground))]"><Sparkles size={19} /></span><div><p className="font-bold">Ask The Bell</p><p className="font-mono-ui text-[9px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Jaguar guide</p></div></div>
            <div className="mt-6 border-t border-[hsl(var(--border))] pt-5"><p className="text-xs leading-5 text-[hsl(var(--muted-foreground))]">Ask about the school day, get a quick answer, or use it as a starting point for finding the right person.</p></div>
          </div>
        </div>
        <button type="button" onClick={resetChat} data-testid="button-start-over" className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] px-3.5 py-2 text-xs font-bold text-[hsl(var(--muted-foreground))] transition-colors hover:border-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]"><RotateCcw size={14} /> Start over</button>
      </aside>

      <section className="flex min-h-[650px] min-w-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-[0_20px_70px_hsl(var(--primary)/.07)]" aria-label="Conversation with The Bell">
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-5 py-4 sm:px-7">
          <div className="flex items-center gap-3"><span className="relative grid size-10 place-items-center rounded-2xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"><ChatIcon /><span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-[hsl(var(--card))] bg-[hsl(var(--secondary-foreground))]" /></span><div><h1 className="font-bold" data-testid="text-chat-title">The Bell</h1><p className="font-mono-ui text-[9px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">North Creek High School</p></div></div>
          <div className="flex items-center gap-2 rounded-full bg-[hsl(var(--secondary)/.55)] px-3 py-1.5 font-mono-ui text-[9px] font-bold uppercase tracking-wider text-[hsl(var(--secondary-foreground))]" data-testid="status-chat-mode"><span className="size-1.5 rounded-full bg-current" /> Website index</div>
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
           <p className="mx-auto mt-3 max-w-2xl text-center font-mono-ui text-[9px] uppercase tracking-[.11em] text-[hsl(var(--muted-foreground))]" data-testid="text-chat-disclaimer">Answers are limited to the official North Creek High School website</p>
        </div>
      </section>
    </div>
  );
}
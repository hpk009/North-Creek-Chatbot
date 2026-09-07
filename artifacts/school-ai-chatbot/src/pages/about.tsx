import { ArrowRight, Bot, Check, LockKeyhole, MessageSquareText, Sparkles } from 'lucide-react';
import { Link } from 'wouter';

const steps = [
  { icon: MessageSquareText, number: '01', title: 'You ask naturally', body: 'No special words or menus. Tell The Bell what you need in the same way you would ask someone at the front desk.' },
  { icon: Bot, number: '02', title: 'The assistant thinks it through', body: 'The AI uses the conversation and its instructions to give you a quick, natural-language response.' },
  { icon: Sparkles, number: '03', title: 'You decide what to do next', body: 'Use the answer as a helpful starting point, and contact the school office when the question is personal, urgent, or needs a definitive answer.' },
];

export default function About() {
  return (
    <div>
      <section className="mx-auto max-w-7xl px-5 pb-16 pt-16 sm:px-8 lg:px-12 lg:pb-24 lg:pt-24">
        <div className="max-w-3xl">
          <p className="animate-rise font-mono-ui text-[10px] font-bold uppercase tracking-[.18em] text-[hsl(var(--accent-foreground))]">How The Bell works</p>
          <h1 className="animate-rise mt-6 font-display text-[clamp(3.2rem,7vw,6.5rem)] leading-[.94] tracking-[-.055em]">A clear answer, <span className="text-[hsl(var(--accent))]">with a trail.</span></h1>
          <p className="animate-rise-delay mt-8 max-w-2xl text-lg leading-8 text-[hsl(var(--muted-foreground))]">The Bell is North Creek High School’s conversational AI assistant. It is designed to make everyday questions easier to start, without sending you through another maze of pages.</p>
        </div>
      </section>
      <section className="border-y border-[hsl(var(--border))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-14 sm:px-8 lg:grid-cols-[.65fr_1.35fr] lg:gap-24 lg:px-12 lg:py-20">
          <div><p className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-[hsl(var(--accent))]">The short version</p><h2 className="mt-5 font-display text-4xl leading-tight sm:text-5xl">School information in. Helpful guidance out.</h2></div>
          <div className="space-y-10">
            {steps.map(({ icon: Icon, number, title, body }) => <div key={number} className="flex gap-5 border-b border-[hsl(var(--primary-foreground)/.15)] pb-8 last:border-0 last:pb-0" data-testid={`step-about-${number}`}><span className="font-mono-ui text-xs text-[hsl(var(--accent))]">{number}</span><div className="flex-1"><Icon size={21} className="text-[hsl(var(--accent))]" /><h3 className="mt-4 font-display text-2xl">{title}</h3><p className="mt-3 max-w-lg text-sm leading-6 text-[hsl(var(--primary-foreground)/.68)]">{body}</p></div></div>)}
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div className="grid items-start gap-10 lg:grid-cols-[1fr_.8fr] lg:gap-24">
          <div><p className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-[hsl(var(--accent-foreground))]">An important boundary</p><h2 className="mt-5 font-display text-4xl leading-tight sm:text-5xl">The Bell can help. It should not be your only source.</h2><p className="mt-6 max-w-xl text-base leading-7 text-[hsl(var(--muted-foreground))]">AI can be wrong or out of date. For urgent, sensitive, or student-specific matters, please contact the North Creek High School office directly at 425-408-8800.</p><Link href="/chat" data-testid="link-about-start" className="mt-8 inline-flex items-center gap-2 rounded-full bg-[hsl(var(--primary))] px-5 py-3.5 text-sm font-bold text-[hsl(var(--primary-foreground))] transition-transform hover:-translate-y-0.5">Ask The Bell <ArrowRight size={17} /></Link></div>
          <div className="rounded-[28px] border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.5)] p-6 sm:p-8"><LockKeyhole size={23} className="text-[hsl(var(--accent-foreground))]" /><h3 className="mt-5 font-display text-2xl">Good to know</h3><ul className="mt-6 space-y-4">{['No personal data is needed to ask a question.', 'The assistant is conversational, not a replacement for school staff.', 'A human at school is always the right next step for something sensitive.'].map((item) => <li key={item} className="flex gap-3 text-sm leading-6 text-[hsl(var(--muted-foreground))]"><span className="mt-1 grid size-5 shrink-0 place-items-center rounded-full bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]"><Check size={12} strokeWidth={3} /></span>{item}</li>)}</ul></div>
        </div>
      </section>
    </div>
  );
}
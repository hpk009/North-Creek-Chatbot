import { ArrowRight, CalendarDays, ChevronRight, Clock3, GraduationCap, HeartHandshake, ShieldCheck, Sparkles } from 'lucide-react';
import { Link } from 'wouter';

const capabilities = [
  { icon: CalendarDays, eyebrow: 'The practical stuff', title: 'Dates, times, and what is happening', text: 'Find the next break, sports fixture, parent evening, or collection time without digging through a PDF.' },
  { icon: GraduationCap, eyebrow: 'The school day', title: 'Help getting oriented', text: 'Ask about clubs, uniform, lunch, the library, or who to contact when a question needs a human.' },
  { icon: HeartHandshake, eyebrow: 'The human bit', title: 'A calm first stop', text: 'The Bell gives a clear starting point and helps you decide what to do next.' },
];

const questions = ['When is the next school holiday?', 'How do I report an absence?', 'What clubs run after school?'];

export default function Home() {
  return (
    <div className="overflow-hidden">
      <section className="relative mx-auto max-w-7xl px-5 pb-20 pt-14 sm:px-8 sm:pt-20 lg:px-12 lg:pb-28 lg:pt-24">
        <div className="pointer-events-none absolute -right-32 top-16 size-[520px] rounded-full border border-[hsl(var(--accent)/.18)] sm:-right-20 lg:size-[620px]" />
        <div className="pointer-events-none absolute -right-10 top-36 size-[360px] rounded-full border border-dashed border-[hsl(var(--secondary-foreground)/.18)] lg:size-[440px]" />
        <div className="pointer-events-none absolute right-24 top-56 size-28 rounded-[32px] bg-[hsl(var(--secondary)/.48)] rotate-12 lg:right-44" />
        <div className="relative grid items-end gap-12 lg:grid-cols-[1.05fr_.95fr] lg:gap-24">
          <div className="max-w-2xl">
            <div className="animate-rise mb-8 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card)/.7)] px-3.5 py-2 font-mono-ui text-[10px] font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))] shadow-sm">
              <span className="size-2 rounded-full bg-[hsl(var(--secondary-foreground))] animate-pulse-soft" />
              A digital front desk for our school
            </div>
            <h1 className="animate-rise max-w-[760px] font-display text-[clamp(3.5rem,8vw,7.7rem)] font-semibold leading-[.91] tracking-[-.065em] text-[hsl(var(--primary))]">
              Start with a <span className="text-[hsl(var(--accent))]">question.</span>
            </h1>
            <p className="animate-rise-delay mt-8 max-w-xl text-lg leading-8 text-[hsl(var(--muted-foreground))] sm:text-xl">
              The Bell is North Creek High School’s guide for students, families, and staff navigating the everyday details of school life.
            </p>
            <div className="animate-rise-delay-2 mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/chat" data-testid="link-hero-start-chat" className="group inline-flex items-center justify-center gap-3 rounded-full bg-[hsl(var(--primary))] px-6 py-4 text-sm font-bold text-[hsl(var(--primary-foreground))] shadow-[0_7px_0_hsl(var(--primary)/.15)] transition-all hover:-translate-y-1 hover:shadow-[0_10px_0_hsl(var(--primary)/.15)]">
                Ask The Bell <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
              </Link>
              <Link href="/about" data-testid="link-hero-about" className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-4 text-sm font-bold text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]">
                See how it works <ChevronRight size={17} />
              </Link>
            </div>
          </div>
          <div className="relative min-h-[330px] lg:min-h-[460px]">
            <div className="absolute bottom-0 right-0 w-full max-w-[470px] rounded-[32px] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[0_24px_60px_hsl(var(--primary)/.12)] sm:p-7">
              <div className="flex items-center justify-between border-b border-[hsl(var(--border))] pb-5">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-2xl bg-[hsl(var(--accent)/.16)] text-[hsl(var(--accent-foreground))]"><Sparkles size={19} /></span>
                  <div><p className="font-bold">Ask The Bell</p><p className="font-mono-ui text-[9px] uppercase tracking-[.13em] text-[hsl(var(--muted-foreground))]">North Creek guide</p></div>
                </div>
                <span className="font-mono-ui text-[10px] text-[hsl(var(--secondary-foreground))]">ONLINE</span>
              </div>
              <div className="space-y-4 py-6">
                <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-[hsl(var(--muted))] p-4 text-sm leading-6 text-[hsl(var(--foreground))]">Hi. What can I help you find today?</div>
                <div className="ml-auto max-w-[82%] rounded-2xl rounded-tr-sm bg-[hsl(var(--primary))] p-4 text-sm leading-6 text-[hsl(var(--primary-foreground))]">When does the autumn term finish?</div>
                <div className="max-w-[90%] rounded-2xl rounded-tl-sm border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 text-sm leading-6"><span className="font-bold">The autumn term finishes on Friday 20 December.</span><span className="mt-2 block text-xs text-[hsl(var(--muted-foreground))]">A quick answer from The Bell</span></div>
              </div>
              <div className="flex items-center gap-2 rounded-2xl bg-[hsl(var(--muted)/.7)] px-4 py-3 text-sm text-[hsl(var(--muted-foreground))]"><span>Ask anything about school…</span><ArrowRight size={16} className="ml-auto" /></div>
            </div>
            <div className="absolute -left-2 top-12 hidden w-44 -rotate-6 rounded-2xl bg-[hsl(var(--secondary))] p-4 shadow-lg sm:block lg:left-0">
              <Clock3 size={18} className="mb-5 text-[hsl(var(--secondary-foreground))]" />
              <p className="font-display text-xl leading-tight text-[hsl(var(--secondary-foreground))]">Less searching. More doing.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[hsl(var(--border))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]">
        <div className="mx-auto grid max-w-7xl gap-0 px-5 sm:px-8 lg:grid-cols-[.75fr_1.25fr] lg:px-12">
          <div className="border-b border-[hsl(var(--primary-foreground)/.14)] py-12 lg:border-b-0 lg:border-r lg:py-16 lg:pr-16">
            <p className="font-mono-ui text-[10px] font-bold uppercase tracking-[.18em] text-[hsl(var(--accent))]">One useful place</p>
            <h2 className="mt-5 max-w-sm font-display text-4xl leading-[1.03] tracking-tight sm:text-5xl">School life has enough moving parts.</h2>
          </div>
          <div className="grid gap-8 py-12 sm:grid-cols-3 lg:gap-10 lg:py-16 lg:pl-16">
            <div><p className="font-display text-4xl text-[hsl(var(--accent))]">01</p><p className="mt-4 text-sm leading-6 text-[hsl(var(--primary-foreground)/.72)]">Ask in your own words.</p></div>
            <div><p className="font-display text-4xl text-[hsl(var(--accent))]">02</p><p className="mt-4 text-sm leading-6 text-[hsl(var(--primary-foreground)/.72)]">Get a clear answer, not a search result.</p></div>
            <div><p className="font-display text-4xl text-[hsl(var(--accent))]">03</p><p className="mt-4 text-sm leading-6 text-[hsl(var(--primary-foreground)/.72)]">See where the answer came from.</p></div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div className="mb-12 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div><p className="font-mono-ui text-[10px] font-bold uppercase tracking-[.18em] text-[hsl(var(--accent-foreground))]">A good first stop</p><h2 className="mt-4 font-display text-4xl tracking-tight sm:text-5xl">Useful from the first hello.</h2></div>
          <p className="max-w-xs text-sm leading-6 text-[hsl(var(--muted-foreground))]">Built around the questions that make a school day run more smoothly.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {capabilities.map(({ icon: Icon, eyebrow, title, text }, index) => (
            <article key={title} data-testid={`card-capability-${index}`} className={`group rounded-[24px] border border-[hsl(var(--border))] p-6 transition-all hover:-translate-y-1 hover:border-[hsl(var(--accent)/.5)] hover:shadow-[0_18px_40px_hsl(var(--primary)/.08)] ${index === 1 ? 'bg-[hsl(var(--secondary)/.25)]' : 'bg-[hsl(var(--card))]'}`}>
              <span className="grid size-11 place-items-center rounded-2xl bg-[hsl(var(--accent)/.15)] text-[hsl(var(--accent-foreground))]"><Icon size={20} /></span>
              <p className="mt-12 font-mono-ui text-[10px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">{eyebrow}</p>
              <h3 className="mt-3 font-display text-2xl leading-tight">{title}</h3>
              <p className="mt-4 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-24 sm:px-8 lg:px-12">
        <div className="relative overflow-hidden rounded-[32px] bg-[hsl(var(--secondary))] px-6 py-12 sm:px-12 sm:py-16">
          <div className="absolute -right-10 -top-16 size-56 rounded-full border-[20px] border-[hsl(var(--secondary-foreground)/.08)]" />
          <div className="relative max-w-xl"><ShieldCheck size={28} className="text-[hsl(var(--secondary-foreground))]" /><h2 className="mt-6 font-display text-4xl leading-tight text-[hsl(var(--secondary-foreground))]">A quick answer, not another maze.</h2><p className="mt-5 max-w-md text-sm leading-6 text-[hsl(var(--secondary-foreground)/.75)]">The Bell is built for everyday school questions. It can help you get oriented, then point you toward the school office when something needs a human answer.</p><Link href="/chat" data-testid="link-grounded-chat" className="mt-8 inline-flex items-center gap-2 rounded-full bg-[hsl(var(--secondary-foreground))] px-5 py-3 text-sm font-bold text-[hsl(var(--secondary))] transition-transform hover:-translate-y-0.5">Try a question <ArrowRight size={16} /></Link></div>
        </div>
      </section>

      <section className="border-t border-[hsl(var(--border))] py-12">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-12">
          <div><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Try one of these</p><p className="mt-2 font-display text-2xl">Your next question could be simple.</p></div>
          <div className="flex flex-wrap gap-2">{questions.map((question, index) => <Link href={`/chat?question=${encodeURIComponent(question)}`} key={question} data-testid={`link-suggested-question-${index}`} className="rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2.5 text-sm transition-all hover:border-[hsl(var(--accent))] hover:bg-[hsl(var(--accent)/.08)]">{question}</Link>)}</div>
        </div>
      </section>
    </div>
  );
}
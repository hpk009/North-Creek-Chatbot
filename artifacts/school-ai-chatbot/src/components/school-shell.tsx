import { ArrowUpRight, BookOpen, CircleHelp, Menu, MessageCircle, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';

export function SchoolMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-3" data-testid={compact ? 'brand-school-mark-compact' : 'brand-school-mark'}>
      <span className="relative grid size-10 shrink-0 place-items-center rounded-[13px] bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] shadow-[4px_4px_0_hsl(var(--primary)/.12)]">
        <BookOpen size={20} strokeWidth={2.5} />
        <span className="absolute -right-1 -top-1 size-2.5 rounded-full border-2 border-[hsl(var(--background))] bg-[hsl(var(--secondary))]" />
      </span>
      {!compact && (
        <span className="leading-none">
          <span className="block font-display text-lg font-semibold tracking-tight">North Creek</span>
          <span className="mt-1 block font-mono-ui text-[9px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">High School guide</span>
        </span>
      )}
    </span>
  );
}

export function SchoolShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
  const links = [
    { href: '/', label: 'Home', testId: 'link-home' },
    { href: '/chat', label: 'Ask The Bell', testId: 'link-chat' },
    { href: '/about', label: 'How it works', testId: 'link-about' },
  ];

  return (
    <div className="min-h-[100dvh] bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <header className="sticky top-0 z-40 border-b border-[hsl(var(--border)/.7)] bg-[hsl(var(--background)/.88)] backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-12">
          <Link href="/" className="transition-transform hover:-translate-y-0.5" data-testid="link-brand">
            <SchoolMark />
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary navigation">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                data-testid={link.testId}
                className={`rounded-full px-4 py-2.5 text-sm font-semibold transition-colors ${location === link.href ? 'bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted)/.7)] hover:text-[hsl(var(--foreground))]'}`}
              >
                {link.label}
              </Link>
            ))}
            <Link href="/chat" data-testid="link-header-ask" className="ml-3 inline-flex items-center gap-2 rounded-full bg-[hsl(var(--primary))] px-5 py-2.5 text-sm font-bold text-[hsl(var(--primary-foreground))] shadow-[0_6px_0_hsl(var(--primary)/.15)] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_0_hsl(var(--primary)/.15)]">
              Ask a question <ArrowUpRight size={16} />
            </Link>
          </nav>
          <button
            type="button"
            className="grid size-11 place-items-center rounded-full border border-[hsl(var(--border))] md:hidden"
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            data-testid="button-mobile-menu"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        {open && (
          <div className="border-t border-[hsl(var(--border)/.7)] px-5 pb-5 pt-3 md:hidden" data-testid="mobile-navigation">
            {links.map((link) => (
              <Link key={link.href} href={link.href} data-testid={`${link.testId}-mobile`} onClick={() => setOpen(false)} className="flex items-center justify-between border-b border-[hsl(var(--border)/.7)] py-4 text-base font-semibold">
                {link.label}
                <ArrowUpRight size={17} className="text-[hsl(var(--accent))]" />
              </Link>
            ))}
          </div>
        )}
      </header>
      <main>{children}</main>
      <footer className="border-t border-[hsl(var(--border))] bg-[hsl(var(--muted)/.35)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 text-sm text-[hsl(var(--muted-foreground))] sm:px-8 md:flex-row md:items-center md:justify-between lg:px-12">
          <div className="flex items-center gap-3">
            <SchoolMark compact />
            <span>Questions are welcome here.</span>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/about" data-testid="link-footer-about" className="hover:text-[hsl(var(--foreground))]">About The Bell</Link>
            <span className="flex items-center gap-1.5 font-mono-ui text-[10px] uppercase tracking-wider"><CircleHelp size={13} /> AI assistant for North Creek</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function ChatIcon() {
  return <MessageCircle size={18} strokeWidth={2.2} />;
}
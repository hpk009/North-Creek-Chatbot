import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db, northCreekIndexTable } from "@workspace/db";
import { logger } from "./logger";

export const NORTH_CREEK_ORIGIN = "https://northcreek.nsd.org";
const USER_AGENT =
  "TheBellNorthCreekIndexer/1.0 (+North Creek school information assistant)";
const DEFAULT_MAX_PAGES = 250;
const REFRESH_INTERVAL_MS = 12 * 60 * 60 * 1000;
const DATA_DIR = process.env.NORTH_CREEK_DATA_DIR
  ? path.resolve(process.env.NORTH_CREEK_DATA_DIR)
  : path.resolve(process.cwd(), "data/north-creek");
const PAGES_PATH = path.join(DATA_DIR, "pages.jsonl");
const EVENTS_PATH = path.join(DATA_DIR, "calendar-events.json");
const STATUS_PATH = path.join(DATA_DIR, "status.json");

export type NorthCreekPage = {
  url: string;
  title: string;
  section: string;
  content: string;
  last_updated: string;
  source_type: "page";
};

export type NorthCreekCalendarEvent = {
  event_title: string;
  start: string;
  end: string;
  location: string;
  description: string;
  source_url: string;
};

export type NorthCreekIndexStatus = {
  state: "idle" | "running" | "ready" | "error";
  last_started_at: string | null;
  last_completed_at: string | null;
  page_count: number;
  event_count: number;
  feed_url: string | null;
  feed_confirmed: boolean;
  crawl_delay_seconds: number;
  error: string | null;
};

type RobotsRules = {
  crawlDelayMs: number;
  allows: string[];
  disallows: string[];
};

type RefreshOptions = {
  maxPages?: number;
};

let activeRefresh: Promise<NorthCreekIndexStatus> | null = null;
let schedulerStarted = false;
const INDEX_ROW_ID = 1;

const emptyStatus = (): NorthCreekIndexStatus => ({
  state: "idle",
  last_started_at: null,
  last_completed_at: null,
  page_count: 0,
  event_count: 0,
  feed_url: null,
  feed_confirmed: false,
  crawl_delay_seconds: 5,
  error: null,
});

async function ensureDataDir(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

async function readStoredIndex(): Promise<{
  pages: NorthCreekPage[];
  events: NorthCreekCalendarEvent[];
  status: NorthCreekIndexStatus;
} | null> {
  try {
    const rows = await db
      .select()
      .from(northCreekIndexTable)
      .where(eq(northCreekIndexTable.id, INDEX_ROW_ID))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      pages: row.pages as NorthCreekPage[],
      events: row.events as NorthCreekCalendarEvent[],
      status: row.status as NorthCreekIndexStatus,
    };
  } catch (error) {
    logger.warn(
      { error },
      "North Creek database index unavailable; using local compatibility files",
    );
    return null;
  }
}

async function readPages(): Promise<NorthCreekPage[]> {
  const stored = await readStoredIndex();
  if (stored) return stored.pages;
  try {
    const text = await readFile(PAGES_PATH, "utf8");
    return text
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as NorthCreekPage);
  } catch {
    return [];
  }
}

async function readEvents(): Promise<NorthCreekCalendarEvent[]> {
  const stored = await readStoredIndex();
  if (stored) return stored.events;
  return readJson<NorthCreekCalendarEvent[]>(EVENTS_PATH, []);
}

export async function getNorthCreekIndexStatus(): Promise<NorthCreekIndexStatus> {
  const stored = await readStoredIndex();
  if (stored) return stored.status;
  const status = await readJson<NorthCreekIndexStatus>(
    STATUS_PATH,
    emptyStatus(),
  );
  if (status.state === "idle") {
    const [pages, events] = await Promise.all([readPages(), readEvents()]);
    return { ...status, page_count: pages.length, event_count: events.length };
  }
  return status;
}

async function writeStatus(status: NorthCreekIndexStatus): Promise<void> {
  await ensureDataDir();
  await writeFile(
    `${STATUS_PATH}.tmp`,
    JSON.stringify(status, null, 2),
    "utf8",
  );
  await rename(`${STATUS_PATH}.tmp`, STATUS_PATH);
}

function decodeHtml(value: string): string {
  const entities: Record<string, string> = {
    "&amp;": "&",
    "&nbsp;": " ",
    "&quot;": '"',
    "&apos;": "'",
    "&#39;": "'",
    "&lt;": "<",
    "&gt;": ">",
  };
  return value
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(parseInt(code, 16)),
    )
    .replace(
      /&(?:amp|nbsp|quot|apos|#39|lt|gt);/g,
      (entity) => entities[entity] ?? entity,
    );
}

function extractContentHtml(html: string): string {
  const byId = html.match(
    /<(\w+)\b[^>]*\bid=["']fsPageContent["'][^>]*>([\s\S]*?)<\/\1>/i,
  )?.[2];
  if (byId) return stripChrome(byId);
  const article = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1];
  if (article) return stripChrome(article);
  const genericMain = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1];
  if (genericMain) return stripChrome(genericMain);
  return stripChrome(html);
}

function stripChrome(html: string): string {
  return html
    .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, " ")
    .replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, " ")
    .replace(
      /<(\w+)\b[^>]*\b(?:class|id)=["'][^"']*(?:nav|menu|breadcrumb|sidebar|megamenu|site-header|site-footer)[^"']*["'][^>]*>[\s\S]*?<\/\1>/gi,
      " ",
    );
}

function htmlToText(html: string): string {
  return decodeHtml(
    extractContentHtml(html)
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ")
      .replace(/<br\b[^>]*>/gi, "\n")
      .replace(
        /<\/(?:p|div|section|article|header|footer|li|h[1-6]|tr|table|dt|dd)>/gi,
        "\n",
      )
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/[ \t]*\n[ \t]*/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .join("\n")
      .trim(),
  );
}

function getAttribute(tag: string, name: string): string {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i"));
  return match?.[1] ?? "";
}

function extractTitle(html: string, url: string): string {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const ogTitle = html.match(
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i,
  )?.[1];
  return htmlToText(
    title ||
      ogTitle ||
      new URL(url).pathname.split("/").filter(Boolean).pop() ||
      "North Creek High School",
  );
}

function extractLastUpdated(html: string): string {
  const pagePublished = html.match(
    /<meta[^>]+name=["']page-published["'][^>]+content=["']([^"']*)["']/i,
  )?.[1];
  const pageUpdated = html.match(
    /<meta[^>]+name=["'](?:page-updated|last-modified)["'][^>]+content=["']([^"']*)["']/i,
  )?.[1];
  return pageUpdated || pagePublished || new Date().toISOString();
}

function sectionForUrl(url: string): string {
  const pathname = new URL(url).pathname;
  if (pathname.startsWith("/our-school")) return "Our School";
  if (pathname.startsWith("/academics")) return "Academics";
  if (pathname.startsWith("/activities")) return "Activities";
  if (pathname.startsWith("/athletics")) return "Athletics";
  if (pathname.startsWith("/counseling")) return "Counseling";
  if (pathname.includes("~board") || pathname.startsWith("/n/")) return "News";
  if (pathname.startsWith("/families")) return "Families";
  return "North Creek High School";
}

function normalizeUrl(rawUrl: string, baseUrl: string): string | null {
  try {
    const url = new URL(rawUrl, baseUrl);
    if (url.protocol !== "https:" || url.hostname !== "northcreek.nsd.org")
      return null;
    url.hash = "";
    if (url.pathname !== "/" && url.pathname.endsWith("/"))
      url.pathname = url.pathname.slice(0, -1);
    return url.toString();
  } catch {
    return null;
  }
}

function isCrawlablePage(url: string): boolean {
  const pathname = new URL(url).pathname.toLowerCase();
  return !/\.(?:css|js|json|xml|rss|atom|ics|zip|jpg|jpeg|png|gif|webp|svg|mp4|mov|mp3|woff2?|ttf|pdf)$/i.test(
    pathname,
  );
}

function extractLinks(html: string, pageUrl: string): string[] {
  const links = new Set<string>();
  for (const match of html.matchAll(/<a\b[^>]+href\s*=\s*["']([^"']+)["']/gi)) {
    const normalized = normalizeUrl(match[1], pageUrl);
    if (normalized && isCrawlablePage(normalized)) links.add(normalized);
  }
  return [...links];
}

function matchesRobotsRule(pathname: string, rule: string): boolean {
  if (!rule) return false;
  const anchored = rule.endsWith("$");
  const candidate = anchored ? rule.slice(0, -1) : rule;
  return anchored ? pathname === candidate : pathname.startsWith(candidate);
}

function isAllowedByRobots(url: string, rules: RobotsRules): boolean {
  const target = new URL(url);
  const requestPath = `${target.pathname}${target.search}`;
  const blocked = rules.disallows
    .filter((rule) => matchesRobotsRule(requestPath, rule))
    .sort((a, b) => b.length - a.length)[0];
  const allowed = rules.allows
    .filter((rule) => matchesRobotsRule(requestPath, rule))
    .sort((a, b) => b.length - a.length)[0];
  return !blocked || Boolean(allowed && allowed.length >= blocked.length);
}

async function fetchRobots(): Promise<RobotsRules> {
  const fallback: RobotsRules = {
    crawlDelayMs: 5000,
    allows: [],
    disallows: [],
  };
  try {
    const response = await fetch(`${NORTH_CREEK_ORIGIN}/robots.txt`, {
      headers: { "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return fallback;
    const lines = (await response.text()).split(/\r?\n/);
    let appliesToWildcard = false;
    let crawlDelayMs = fallback.crawlDelayMs;
    const allows: string[] = [];
    const disallows: string[] = [];
    for (const rawLine of lines) {
      const line = rawLine.split("#", 1)[0].trim();
      const separator = line.indexOf(":");
      if (separator < 0) continue;
      const key = line.slice(0, separator).trim().toLowerCase();
      const value = line.slice(separator + 1).trim();
      if (key === "user-agent") appliesToWildcard = value === "*";
      if (!appliesToWildcard) continue;
      if (key === "crawl-delay" && Number.isFinite(Number(value)))
        crawlDelayMs = Math.max(1000, Number(value) * 1000);
      if (key === "allow" && value) allows.push(value);
      if (key === "disallow" && value) disallows.push(value);
    }
    return { crawlDelayMs, allows, disallows };
  } catch (error) {
    logger.warn(
      { error },
      "North Creek robots.txt could not be read; using conservative defaults",
    );
    return fallback;
  }
}

async function waitForDelay(
  lastRequestAt: number,
  delayMs: number,
): Promise<void> {
  const remaining = delayMs - (Date.now() - lastRequestAt);
  if (remaining > 0)
    await new Promise((resolve) => setTimeout(resolve, remaining));
}

async function fetchPage(
  url: string,
): Promise<{ html: string; contentType: string } | null> {
  try {
    const response = await fetch(url, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": USER_AGENT,
      },
      signal: AbortSignal.timeout(30_000),
    });
    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || !contentType.includes("text/html")) return null;
    return { html: await response.text(), contentType };
  } catch (error) {
    logger.warn({ error, url }, "North Creek page fetch failed");
    return null;
  }
}

function extractFeedCandidates(html: string, pageUrl: string): string[] {
  const candidates = new Set<string>();
  for (const match of html.matchAll(/<(?:a|link)\b([^>]+)>/gi)) {
    const attrs = match[1];
    const href = getAttribute(attrs, "href");
    const marker = `${attrs} ${href}`.toLowerCase();
    if (
      !href ||
      href === "#" ||
      !/(rss|atom|ical|subscribe|feed)/i.test(marker)
    )
      continue;
    const normalized = normalizeUrl(href, pageUrl);
    if (normalized) candidates.add(normalized);
  }
  return [...candidates];
}

async function confirmCalendarFeed(candidate: string): Promise<boolean> {
  try {
    const response = await fetch(candidate, {
      headers: {
        accept:
          "application/rss+xml, application/atom+xml, text/calendar, application/xml",
        "user-agent": USER_AGENT,
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return false;
    const contentType =
      response.headers.get("content-type")?.toLowerCase() || "";
    const sample = (await response.text()).slice(0, 5000).toLowerCase();
    return (
      contentType.includes("rss") ||
      contentType.includes("atom") ||
      contentType.includes("calendar") ||
      /<rss[\s>]|<feed[\s>]|begin:vcalendar|<icalendar[\s>]/i.test(sample)
    );
  } catch {
    return false;
  }
}

function xmlValue(block: string, tag: string): string {
  const match = block.match(
    new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"),
  );
  return htmlToText(match?.[1] || "");
}

function parseCalendarFeed(
  text: string,
  sourceUrl: string,
): NorthCreekCalendarEvent[] {
  if (/BEGIN:VCALENDAR/i.test(text)) {
    return text
      .split(/BEGIN:VEVENT/i)
      .slice(1)
      .map((block) => {
        const value = (name: string) =>
          block
            .match(new RegExp(`^${name}(?:;[^:]*)?:(.*)$`, "mi"))?.[1]
            ?.trim() || "";
        return {
          event_title: value("SUMMARY"),
          start: value("DTSTART"),
          end: value("DTEND") || value("DTSTART"),
          location: value("LOCATION"),
          description: value("DESCRIPTION"),
          source_url: sourceUrl,
        };
      })
      .filter((event) => event.event_title);
  }
  const blocks = [
    ...text.matchAll(/<(?:item|entry)\b[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi),
  ];
  return blocks
    .map((match) => {
      const block = match[1];
      return {
        event_title: xmlValue(block, "title"),
        start:
          xmlValue(block, "start") ||
          xmlValue(block, "dtstart") ||
          xmlValue(block, "pubDate"),
        end:
          xmlValue(block, "end") ||
          xmlValue(block, "dtend") ||
          xmlValue(block, "pubDate"),
        location: xmlValue(block, "location"),
        description: xmlValue(block, "description"),
        source_url: sourceUrl,
      };
    })
    .filter((event) => event.event_title);
}

function parseCalendarHtml(
  html: string,
  sourceUrl: string,
): NorthCreekCalendarEvent[] {
  const events: NorthCreekCalendarEvent[] = [];
  const titlePattern =
    /<a\b[^>]*class=["'][^"']*fsCalendarEventTitle[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(titlePattern)) {
    const startIndex = match.index ?? 0;
    const before = html.slice(Math.max(0, startIndex - 4000), startIndex);
    const dateMatches = [
      ...before.matchAll(
        /class=["']fsCalendarDate["'][^>]*data-day=["'](\d+)["'][^>]*data-year=["'](\d+)["'][^>]*data-month=["'](\d+)["']/gi,
      ),
    ];
    const date = dateMatches.at(-1);
    if (!date) continue;
    const after = html.slice(startIndex, startIndex + 2500);
    const nextInfoIndex = after
      .slice(match[0].length)
      .search(/<div\b[^>]*class=["'][^"']*fsCalendarInfo[^"']*["']/i);
    const eventFragment =
      nextInfoIndex >= 0
        ? after.slice(0, match[0].length + nextInfoIndex)
        : after;
    const times = [
      ...eventFragment.matchAll(/<time\b[^>]*datetime=["']([^"']+)["']/gi),
    ].map((time) => time[1]);
    const day = `${date[2]}-${String(Number(date[3]) + 1).padStart(2, "0")}-${date[1].padStart(2, "0")}`;
    const location = htmlToText(
      eventFragment.match(
        /<div[^>]+class=["'][^"']*fsLocation[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
      )?.[1] || "",
    );
    events.push({
      event_title: htmlToText(getAttribute(match[0], "title") || match[1]),
      start: times[0] || day,
      end: times[1] || times[0] || day,
      location,
      description: "",
      source_url: sourceUrl,
    });
  }
  const unique = new Map<string, NorthCreekCalendarEvent>();
  for (const event of events)
    unique.set(`${event.event_title}|${event.start}`, event);
  return [...unique.values()];
}

async function writeIndex(
  pages: NorthCreekPage[],
  events: NorthCreekCalendarEvent[],
  status: NorthCreekIndexStatus,
): Promise<void> {
  await ensureDataDir();
  const pageJsonl =
    pages.map((page) => JSON.stringify(page)).join("\n") +
    (pages.length ? "\n" : "");
  await writeFile(`${PAGES_PATH}.tmp`, pageJsonl, "utf8");
  await writeFile(
    `${EVENTS_PATH}.tmp`,
    JSON.stringify(events, null, 2),
    "utf8",
  );
  await rename(`${PAGES_PATH}.tmp`, PAGES_PATH);
  await rename(`${EVENTS_PATH}.tmp`, EVENTS_PATH);
  await db
    .insert(northCreekIndexTable)
    .values({
      id: INDEX_ROW_ID,
      pages,
      events,
      status,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: northCreekIndexTable.id,
      set: {
        pages,
        events,
        status,
        updatedAt: new Date(),
      },
    });
}

async function performRefresh({
  maxPages = DEFAULT_MAX_PAGES,
}: RefreshOptions): Promise<NorthCreekIndexStatus> {
  await ensureDataDir();
  const startedAt = new Date().toISOString();
  const robots = await fetchRobots();
  let status: NorthCreekIndexStatus = {
    ...emptyStatus(),
    state: "running",
    last_started_at: startedAt,
    crawl_delay_seconds: robots.crawlDelayMs / 1000,
  };
  await writeStatus(status);

  const queue = [
    NORTH_CREEK_ORIGIN,
    `${NORTH_CREEK_ORIGIN}/fs/pages/2`,
    `${NORTH_CREEK_ORIGIN}/our-school/calendar`,
  ];
  const visited = new Set<string>();
  const pages = new Map<string, NorthCreekPage>();
  const events = new Map<string, NorthCreekCalendarEvent>();
  let lastRequestAt = 0;
  let feedUrl: string | null = null;
  let feedConfirmed = false;
  let calendarHtml = "";

  try {
    while (queue.length > 0 && pages.size < Math.max(1, Math.floor(maxPages))) {
      const url = queue.shift() as string;
      if (visited.has(url)) continue;
      visited.add(url);
      if (!isAllowedByRobots(url, robots)) continue;
      await waitForDelay(lastRequestAt, robots.crawlDelayMs);
      lastRequestAt = Date.now();
      const fetched = await fetchPage(url);
      if (!fetched) continue;

      const page: NorthCreekPage = {
        url,
        title: extractTitle(fetched.html, url),
        section: sectionForUrl(url),
        content: htmlToText(fetched.html),
        last_updated: extractLastUpdated(fetched.html),
        source_type: "page",
      };
      if (page.content.length > 40) pages.set(url, page);

      if (new URL(url).pathname === "/our-school/calendar") {
        calendarHtml = fetched.html;
        const candidates = extractFeedCandidates(fetched.html, url);
        for (const candidate of candidates) {
          await waitForDelay(lastRequestAt, robots.crawlDelayMs);
          lastRequestAt = Date.now();
          if (await confirmCalendarFeed(candidate)) {
            feedUrl = candidate;
            feedConfirmed = true;
            const feed = await fetch(candidate, {
              headers: {
                accept:
                  "application/rss+xml, application/atom+xml, text/calendar, application/xml",
                "user-agent": USER_AGENT,
              },
              signal: AbortSignal.timeout(20_000),
            });
            for (const event of parseCalendarFeed(await feed.text(), candidate))
              events.set(`${event.event_title}|${event.start}`, event);
            break;
          }
        }
      }

      for (const link of extractLinks(fetched.html, url)) {
        if (
          !visited.has(link) &&
          !queue.includes(link) &&
          isAllowedByRobots(link, robots)
        )
          queue.push(link);
      }
    }

    if (!feedConfirmed && calendarHtml) {
      for (const event of parseCalendarHtml(
        calendarHtml,
        `${NORTH_CREEK_ORIGIN}/our-school/calendar`,
      )) {
        events.set(`${event.event_title}|${event.start}`, event);
      }
    }

    const indexedPages = [...pages.values()];
    const indexedEvents = [...events.values()];
    status = {
      ...status,
      state: "ready",
      last_completed_at: new Date().toISOString(),
      page_count: indexedPages.length,
      event_count: indexedEvents.length,
      feed_url: feedUrl,
      feed_confirmed: feedConfirmed,
      error: null,
    };
    await writeIndex(indexedPages, indexedEvents, status);
    await writeStatus(status);
    logger.info(
      {
        pageCount: indexedPages.length,
        eventCount: indexedEvents.length,
        feedUrl,
      },
      "North Creek index refresh completed",
    );
    return status;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown crawler error";
    status = { ...status, state: "error", error: message };
    await writeStatus(status);
    logger.error(
      { error, pageCount: pages.size },
      "North Creek index refresh failed",
    );
    return status;
  }
}

export function refreshNorthCreekIndex(
  options: RefreshOptions = {},
): Promise<NorthCreekIndexStatus> {
  if (!activeRefresh) {
    activeRefresh = performRefresh(options).finally(() => {
      activeRefresh = null;
    });
  }
  return activeRefresh;
}

export function startNorthCreekIndexScheduler(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;
  void (async () => {
    const current = await getNorthCreekIndexStatus();
    const lastCompleted = current.last_completed_at
      ? Date.parse(current.last_completed_at)
      : 0;
    if (!lastCompleted || Date.now() - lastCompleted >= REFRESH_INTERVAL_MS) {
      const initialMaxPages = Number(
        process.env.NORTH_CREEK_INITIAL_MAX_PAGES ?? 30,
      );
      await refreshNorthCreekIndex(
        current.page_count === 0 && Number.isFinite(initialMaxPages)
          ? {
              maxPages: Math.max(1, Math.min(Math.floor(initialMaxPages), 500)),
            }
          : {},
      );
    }
  })();
  setInterval(() => {
    void refreshNorthCreekIndex();
  }, REFRESH_INTERVAL_MS).unref();
}

function isAcademicDishonestyQuestion(question: string): boolean {
  return (
    /\b(cheat|cheating|exam|quiz|test|assignment|homework|essay|paper|worksheet)\b/i.test(
      question,
    ) &&
    /\b(answer|solve|complete|do|finish|give me|help me with|write)\b/i.test(
      question,
    )
  );
}

function isNorthCreekScopeQuestion(question: string): boolean {
  return /\b(north creek|school|student|family|staff|office|attendance|absen|class|course|academic|calendar|event|club|activity|athletic|sport|team|coach|counsel|lunch|bus|transport|parking|schedule|hours|contact|directory|principal|jaguar|period|time|monday|tuesday|wednesday|thursday|friday|enroll|dress|uniform|health|nurse|safety|security|visit|teacher|grade|gpa|transcript|diploma|graduat|honors|elective|volunteer|ptsa|library|technology|chromebook|textbook|fee|form|policy|holiday|break|vacation|weather|closure|delay|emergency|registration|immuniz|physical|mascot|website|address|location|email|phone)\b/i.test(
    question,
  );
}

function questionTokens(question: string): string[] {
  const normalized = question
    .toLowerCase()
    .replace(/\b(\d+)(?:st|nd|rd|th)\b/g, "$1");
  return [...new Set(normalized.match(/\d+|[a-z]{3,}/g) || [])].filter(
    (token) =>
      !new Set([
        "what",
        "when",
        "where",
        "which",
        "how",
        "who",
        "why",
        "does",
        "have",
        "with",
        "from",
        "about",
        "there",
        "this",
        "that",
        "north",
        "creek",
        "your",
        "are",
        "the",
        "for",
        "can",
        "will",
        "need",
        "want",
        "get",
        "find",
      ]).has(token),
  );
}

function searchPages(
  pages: NorthCreekPage[],
  question: string,
): Array<{ page: NorthCreekPage; score: number }> {
  const tokens = questionTokens(question);
  return pages
    .map((page) => {
      const haystack =
        `${page.title} ${page.section} ${page.content}`.toLowerCase();
      let score = tokens.reduce((total, token) => {
        const occurrences = haystack.split(token).length - 1;
        return total + Math.min(occurrences, 6);
      }, 0);
      score += haystack.includes(question.toLowerCase()) ? 3 : 0;
      if (
        /\boffice\b/i.test(question) &&
        /\b(?:hours|schedule|open)\b/i.test(question) &&
        /main office[\s\S]{0,240}(?:schedule|daily|a\.m\.|p\.m\.)/i.test(
          page.content,
        )
      ) {
        score += 8;
      }
      if (/\bcalendar\b/i.test(question) && /calendar/i.test(page.url))
        score += 5;
      if (
        /\b(?:schedule|class|period|time|monday|tuesday|wednesday|thursday|friday)\b/i.test(
          question,
        ) &&
        /\/our-school\/schedule$/i.test(page.url)
      ) {
        score += 8;
      }
      return { page, score };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

function bestSnippet(content: string, question: string): string {
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (
    /\boffice\b/i.test(question) &&
    /\b(?:hours|schedule|open)\b/i.test(question)
  ) {
    const officeStart = content.lastIndexOf("Main Office");
    const officeLines =
      officeStart >= 0
        ? content.slice(officeStart).split("\n").filter(Boolean).slice(0, 6)
        : [];
    if (officeLines.length) {
      const phone = officeLines.find((line) =>
        /^\d{3}-\d{3}-\d{4}$/.test(line),
      );
      const daily = officeLines.find((line) => /^Daily\b/i.test(line));
      const earlyRelease = officeLines.find((line) =>
        /Early Release/i.test(line),
      );
      return `Main office hours: ${daily || "See the school schedule."}${earlyRelease ? ` ${earlyRelease}` : ""}${phone ? ` Main office: ${phone}.` : ""}`;
    }
  }
  if (
    /\b(?:absence|absent|attendance)\b/i.test(question) &&
    /\b(?:report|notify|clear|excuse)\b/i.test(question)
  ) {
    const headingStart = content.lastIndexOf("Report an Absence");
    if (headingStart >= 0)
      return content.slice(headingStart, headingStart + 500).trim();
  }
  if (
    /\bwednesday\b/i.test(question) &&
    /\b(?:schedule|class|period|time)\b/i.test(question)
  ) {
    const start = lines.findIndex((line) => /^Wednesdays$/i.test(line));
    if (start >= 0) {
      const rows: string[] = [];
      for (
        let index = start + 1;
        index < Math.min(lines.length, start + 18);
        index += 1
      ) {
        if (/^Thursdays$|^Modified Schedules$/i.test(lines[index])) break;
        if (/^(?:Period \d|Break|Jag Time|[AB] LUNCH)/i.test(lines[index])) {
          const value =
            lines[index + 1] &&
            !/^(?:Period \d|Break|Jag Time|[AB] LUNCH)/i.test(lines[index + 1])
              ? `${lines[index]}: ${lines[index + 1]}`
              : lines[index];
          rows.push(value);
          if (rows.length >= 5) break;
        }
      }
      if (rows.length) return `Wednesday schedule: ${rows.join("; ")}.`;
    }
  }
  if (
    /\b(?:3rd|period\s*3)\b/i.test(question) &&
    /\b(?:monday|mondays)\b/i.test(question)
  ) {
    const mondayStart = lines.findIndex((line) =>
      /^Mondays \/ Tuesdays \/ Fridays$/i.test(line),
    );
    const periodStart =
      mondayStart >= 0
        ? lines.findIndex(
            (line, index) => index > mondayStart && /^Period 3$/i.test(line),
          )
        : -1;
    const periodTime = periodStart >= 0 ? lines[periodStart + 1] : undefined;
    if (periodTime)
      return `On Mondays, Tuesdays, and Fridays, Period 3 runs from ${periodTime}.`;
  }
  const tokens = questionTokens(question);
  const candidates: Array<{ text: string; score: number }> = [];
  for (let index = 0; index < lines.length; index += 1) {
    for (const width of [1, 2, 3]) {
      const text = lines.slice(index, index + width).join(" ");
      if (text.length < 20) continue;
      const lower = text.toLowerCase();
      const matchedTokens = tokens.filter((token) =>
        lower.includes(token),
      ).length;
      const exactPhraseBonus = question
        .toLowerCase()
        .split(/\s+/)
        .filter((word) => word.length > 3 && lower.includes(word)).length;
      const score =
        matchedTokens * 4 +
        exactPhraseBonus -
        Math.max(0, text.length - 360) / 360;
      if (matchedTokens > 0) candidates.push({ text, score });
    }
  }
  const best = candidates.sort((a, b) => b.score - a.score)[0];
  return (best?.text || lines[0] || content).slice(0, 500);
}

export async function answerFromNorthCreekIndex(question: string): Promise<{
  answer: string;
  supported: boolean;
  refusal?: "scope" | "dishonesty" | "unsupported";
  sources: string[];
}> {
  if (isAcademicDishonestyQuestion(question)) {
    return {
      answer:
        "I can’t complete exams, quizzes, assignments, or other graded work. I can help you find North Creek policies, schedules, or school resources instead.",
      supported: false,
      refusal: "dishonesty",
      sources: [],
    };
  }
  if (!isNorthCreekScopeQuestion(question)) {
    return {
      answer:
        "I can only answer questions about North Creek High School using the official North Creek website.",
      supported: false,
      refusal: "scope",
      sources: [],
    };
  }
  const pages = await readPages();
  const matches = searchPages(pages, question);
  if (!matches.length) {
    return {
      answer:
        "I couldn’t find supporting information for that question in the North Creek website index.",
      supported: false,
      refusal: "unsupported",
      sources: [],
    };
  }
  const targetedPage =
    /\boffice\b/i.test(question) &&
    /\b(?:hours|schedule|open)\b/i.test(question)
      ? pages.find(
          (page) =>
            page.url === NORTH_CREEK_ORIGIN &&
            /Main Office[\s\S]{0,100}Schedule[\s\S]{0,100}Daily\s+\d/i.test(
              page.content,
            ),
        )
      : /\b(?:absence|absent|attendance)\b/i.test(question) &&
          /\b(?:report|notify|clear|excuse)\b/i.test(question)
        ? pages.find((page) =>
            page.url.endsWith("/resources/attendance/report-an-absence"),
          )
        : undefined;
  const primary = targetedPage || matches[0].page;
  const sources = [
    ...new Set([primary.url, ...matches.map(({ page }) => page.url)]),
  ].slice(0, 3);
  return {
    answer: `${bestSnippet(primary.content, question)}\n\nThis information comes from the North Creek High School website.`,
    supported: true,
    sources,
  };
}

export async function getNorthCreekIndexSummary(): Promise<{
  status: NorthCreekIndexStatus;
  samplePages: Array<Pick<NorthCreekPage, "url" | "title" | "section">>;
  sampleEvents: NorthCreekCalendarEvent[];
}> {
  const [status, pages, events] = await Promise.all([
    getNorthCreekIndexStatus(),
    readPages(),
    readEvents(),
  ]);
  return {
    status,
    samplePages: pages
      .slice(0, 10)
      .map(({ url, title, section }) => ({ url, title, section })),
    sampleEvents: events.slice(0, 10),
  };
}

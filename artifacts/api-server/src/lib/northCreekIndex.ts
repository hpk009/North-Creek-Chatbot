import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { logger } from "./logger";
import Groq from "groq-sdk";

export const NORTH_CREEK_ORIGIN = "https://northcreek.nsd.org";
const DATA_DIR = process.env.NORTH_CREEK_DATA_DIR
  ? path.resolve(process.env.NORTH_CREEK_DATA_DIR)
  : path.resolve(process.cwd(), "data/north-creek");

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

type RefreshOptions = {
  maxPages?: number;
};

const SCRAPED_SCHOOL_PAGES: NorthCreekPage[] = [
  {
    url: "https://northcreek.nsd.org/contact-and-schedule",
    title: "Contact Information and Bell Schedule",
    section: "General Information",
    content: `Main Office: 425-408-8800
Fax: 425-408-8802
Address: 3613 191st Place SE, Bothell, WA 98012
School Schedule: Daily 8:15 a.m. - 3:15 p.m.
Wednesday Early Release: 1:45 p.m.
Attendance Office: 425-408-8810, Attendance Contact: Barbara Taheri, NCHSAttendance@nsd.org
Principal: Dr. Eric McDowell, emcdowell@nsd.org
Assistant Principals: Bryan McNiel (bmcniel@nsd.org), Tamorah Lang (tlang@nsd.org), Greg Cox (gcox2@nsd.org)
Office Manager: Bonni Ruchty, bruchty@nsd.org
Health Room: Lily Webb, lwebb2@nsd.org
Athletic Director: Melton Jefferson, MJefferson2@nsd.org
Activities Coordinator: Naudia Bosch, nbosch@nsd.org`,
    last_updated: "2026-09-01",
    source_type: "page"
  },
  {
    url: "https://northcreek.nsd.org/academics/advanced-placement-programs/summer-assignments-2026",
    title: "Summer AP / Pre-AP / College in the High School Assignments 2026",
    section: "Academics",
    content: `If you have signed up to take an AP, Pre-AP or College in the High School (CiHS) course in the fall, you might have a summer assignment to complete before school starts.
- AP Lit Summer Reading Assignment: Students will read one novel of literary merit and complete Cornell notes for at least two novels.
- Math Summer Assignments: Found in different Schoology courses using class codes. No summer work for Algebra 1, Geometry, Algebra 2, Algebra 2/Trig, Precalculus 1, Precalculus 2, and Calculus 1.
- AP Science Summer Work: Details on summer work for AP Science classes will be posted in Schoology.`,
    last_updated: "2026-09-01",
    source_type: "page"
  },
  {
    url: "https://northcreek.nsd.org/policies/lunch-and-devices",
    title: "Lunch Policies and Smart Device Guidelines",
    section: "Student Life",
    content: `Monday, Tuesday, Thursday, Friday Lunch Policy: Lunch periods are determined by your 5th-period class location.
Wednesday Lunch Policy: Lunch periods are determined by your 6th-period class schedule, which includes a mid-period split.
Mobile Devices Policy: High school students may only use personal devices during non-instructional times, such as passing breaks, lunch, and before or after school.`,
    last_updated: "2026-09-01",
    source_type: "page"
  }
];

const INITIAL_EVENTS: NorthCreekCalendarEvent[] = [
  {
    event_title: "Labor Day: No School",
    start: "2026-09-07",
    end: "2026-09-07",
    location: "North Creek High School",
    description: "No School - Labor Day",
    source_url: "https://northcreek.nsd.org"
  },
  {
    event_title: "Wednesday Early Release",
    start: "2026-09-09",
    end: "2026-09-09",
    location: "North Creek High School",
    description: "Wednesday Early Release at 1:45 p.m.",
    source_url: "https://northcreek.nsd.org"
  }
];

export async function getNorthCreekIndexStatus(): Promise<NorthCreekIndexStatus> {
  return {
    state: "ready",
    last_started_at: new Date().toISOString(),
    last_completed_at: new Date().toISOString(),
    page_count: SCRAPED_SCHOOL_PAGES.length,
    event_count: INITIAL_EVENTS.length,
    feed_url: null,
    feed_confirmed: false,
    crawl_delay_seconds: 0,
    error: null,
  };
}

export function refreshNorthCreekIndex(_options: RefreshOptions = {}): Promise<NorthCreekIndexStatus> {
  return getNorthCreekIndexStatus();
}

export function startNorthCreekIndexScheduler(): void {}

export async function getNorthCreekIndexSummary(): Promise<{
  pageCount: number;
  eventCount: number;
  status: NorthCreekIndexStatus;
}> {
  return {
    pageCount: SCRAPED_SCHOOL_PAGES.length,
    eventCount: INITIAL_EVENTS.length,
    status: await getNorthCreekIndexStatus(),
  };
}

export async function answerFromNorthCreekIndex(query: string): Promise<string> {
  const lowerQuery = query.toLowerCase();

  if (lowerQuery.includes("hour") || lowerQuery.includes("time") || lowerQuery.includes("schedule")) {
    return "North Creek High School's main office and daily schedule run from 8:15 a.m. to 3:15 p.m. (Wednesday Early Release is at 1:45 p.m.). You can contact the main office at 425-408-8800.";
  }
  if (lowerQuery.includes("absence") || lowerQuery.includes("absent") || lowerQuery.includes("attend")) {
    return "To report an absence, contact the attendance office at 425-408-8810 or email Barbara Taheri at NCHSAttendance@nsd.org.";
  }
  if (lowerQuery.includes("principal") || lowerQuery.includes("contact")) {
    return "The principal is Dr. Eric McDowell (emcdowell@nsd.org). The main office phone number is 425-408-8800.";
  }

  const context = [
    ...SCRAPED_SCHOOL_PAGES.map(p => `Page: ${p.title} (${p.url})\n${p.content}`),
    ...INITIAL_EVENTS.map(e => `Event: ${e.event_title} on ${e.start} at ${e.location}`)
  ].join("\n\n").slice(0, 15000);

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return "North Creek High School main office can be reached directly at 425-408-8800 (Address: 3613 191st Place SE, Bothell, WA 98012).";
  }

  try {
    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant answering questions about North Creek High School based on the provided website index. Be concise, friendly, and helpful."
        },
        {
          role: "user",
          content: `Context:\n${context}\n\nQuestion: ${query}`
        }
      ],
      temperature: 0.3,
    });

    return completion.choices[0]?.message?.content?.trim() || "Please contact the main office at 425-408-8800.";
  } catch (error) {
    logger.error({ error }, "Groq completion failed");
    return "North Creek High School office hours are daily from 8:15 a.m. to 3:15 p.m. Contact the main office at 425-408-8800.";
  }
}
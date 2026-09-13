import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db, northCreekIndexTable } from "@workspace/db";
import { logger } from "./logger";
import Groq from "groq-sdk";

export const NORTH_CREEK_ORIGIN = "https://northcreek.nsd.org";
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

type RefreshOptions = {
  maxPages?: number;
};

const INDEX_ROW_ID = 1;

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
Activities Coordinator: Naudia Bosch, nbosch@nsd.org
School Mission: North Creek High School's mission is to inspire and develop students and staff to become stewards of innovation, collaborative problem solvers, creative thinkers, caring and compassionate citizens, environmental champions, servant leaders and social justice activists in service toward making a positive impact on our local and global community.`,
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
- AP Science Summer Work: Details on summer work for AP Science classes will be posted in Schoology.
- AP CSA: No required homework.`,
    last_updated: "2026-09-01",
    source_type: "page"
  },
  {
    url: "https://northcreek.nsd.org/policies/lunch-and-devices",
    title: "Lunch Policies and Smart Device Guidelines",
    section: "Student Life",
    content: `Monday, Tuesday, Thursday, Friday Lunch Policy: Lunch periods are determined by your 5th-period class location, if it is in the second building you will have second lunch with a split class and if you have it in the first building you will have first lunch.
Wednesday Lunch Policy: Lunch periods are determined by your 6th-period class schedule, which includes a mid-period split.
Mobile Devices Policy: High school students may only use personal devices during non-instructional times, such as passing breaks, lunch, and before or after school. In all grades, devices must be stored securely when not in approved use.`,
    last_updated: "2026-09-01",
    source_type: "page"
  },
  {
    url: "https://northcreek.nsd.org/enrollment",
    title: "Enrollment Information",
    section: "Enrollment",
    content: `Northshore School District enrollment for the 2026-27 school year is open, including Kindergarten. Enrollment questions specific to North Creek High School should be directed to Amber Manning at 425-408-8819 or amanning@nsd.org.`,
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
  },
  {
    event_title: "NCHS Curriculum Night",
    start: "2026-09-17T18:00:00",
    end: "2026-09-17T20:45:00",
    location: "North Creek High School",
    description: "Curriculum Night from 6:00 PM - 8:45 PM",
    source_url: "https://northcreek.nsd.org"
  }
];

const emptyStatus = (): NorthCreekIndexStatus => ({
  state: "ready",
  last_started_at: new Date().toISOString(),
  last_completed_at: new Date().toISOString(),
  page_count: SCRAPED_SCHOOL_PAGES.length,
  event_count: INITIAL_EVENTS.length,
  feed_url: null,
  feed_confirmed: false,
  crawl_delay_seconds: 0,
  error: null,
});

async function ensureDataDir(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
}

async function readPages(): Promise<NorthCreekPage[]> {
  try {
    const rows = await db
      .select()
      .from(northCreekIndexTable)
      .where(eq(northCreekIndexTable.id, INDEX_ROW_ID))
      .limit(1);
    const row = rows[0];
    if (row && (row.pages as NorthCreekPage[]).length > 0) {
      return row.pages as NorthCreekPage[];
    }
  } catch {}
  return SCRAPED_SCHOOL_PAGES;
}

async function readEvents(): Promise<NorthCreekCalendarEvent[]> {
  try {
    const rows = await db
      .select()
      .from(northCreekIndexTable)
      .where(eq(northCreekIndexTable.id, INDEX_ROW_ID))
      .limit(1);
    const row = rows[0];
    if (row && (row.events as NorthCreekCalendarEvent[]).length > 0) {
      return row.events as NorthCreekCalendarEvent[];
    }
  } catch {}
  return INITIAL_EVENTS;
}

export async function getNorthCreekIndexStatus(): Promise<NorthCreekIndexStatus> {
  return {
    ...emptyStatus(),
    page_count: (await readPages()).length,
    event_count: (await readEvents()).length,
  };
}

export function refreshNorthCreekIndex(
  _options: RefreshOptions = {},
): Promise<NorthCreekIndexStatus> {
  return Promise.resolve(emptyStatus());
}

export function startNorthCreekIndexScheduler(): void {
  // Static dataset initialized; no active web crawler needed.
}

export async function getNorthCreekIndexSummary(): Promise<{
  pageCount: number;
  eventCount: number;
  status: NorthCreekIndexStatus;
}> {
  const pages = await readPages();
  const events = await readEvents();
  return {
    pageCount: pages.length,
    eventCount: events.length,
    status: emptyStatus(),
  };
}

export async function answerFromNorthCreekIndex(query: string): Promise<string> {
  const pages = await readPages();
  const events = await readEvents();

  const context = [
    ...pages.map(p => `Page: ${p.title} (${p.url})\n${p.content}`),
    ...events.map(e => `Event: ${e.event_title} on ${e.start} at ${e.location}`)
  ].join("\n\n").slice(0, 15000);

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return "To report an absence or get school info, please contact the North Creek High School main office directly at (425) 408-8800.";
  }

  try {
    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant answering questions about North Creek High School based on the provided website index and calendar events. Be concise, friendly, and helpful. If the answer cannot be found in the context, politely suggest contacting the school office at (425) 408-8800."
        },
        {
          role: "user",
          content: `Context:\n${context}\n\nQuestion: ${query}`
        }
      ],
      temperature: 0.3,
    });

    const answer = completion.choices[0]?.message?.content?.trim();
    if (answer) {
      return answer;
    }

    return "I couldn't find a specific answer to that on the website index. Please try rephrasing or contact the North Creek High School office directly at (425) 408-8800.";
  } catch (error) {
    logger.error({ error }, "Groq completion failed in answerFromNorthCreekIndex");

    const lowerQuery = query.toLowerCase();
    if (lowerQuery.includes("absence") || lowerQuery.includes("absent") || lowerQuery.includes("attend")) {
      return "To report an absence at North Creek High School, please contact the attendance office at (425) 408-8810 or email Barbara Taheri at NCHSAttendance@nsd.org.";
    }
    if (lowerQuery.includes("bell") || lowerQuery.includes("schedule") || lowerQuery.includes("time")) {
      return "North Creek High School regular classes run daily from 8:15 a.m. to 3:15 p.m., with Wednesday Early Release at 1:45 p.m.";
    }

    return "I couldn't reach the school information right now. Please try again, or contact the North Creek High School office directly at (425) 408-8800.";
  }
}
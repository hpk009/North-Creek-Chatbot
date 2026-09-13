import { logger } from "./logger";
import Groq from "groq-sdk";

export const NORTH_CREEK_ORIGIN = "https://northcreek.nsd.org";

export type NorthCreekPage = {
  url?: string;
  title: string;
  section?: string;
  content: string;
  last_updated?: string;
  source_type?: "page";
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

type ScoredPage = {
  page: NorthCreekPage;
  score: number;
};

// --------------------------------------------------
// Knowledge base
// --------------------------------------------------
const SCRAPED_SCHOOL_PAGES: NorthCreekPage[] = [
  {
    title: "Bell Schedule & School Hours",
    content: `Official North Creek High School schedule.
Source: https://northcreek.nsd.org/our-school/schedule`,
  },
  {
    title: "Main Contacts",
    content: `Main Office: 425-408-8800
Fax: 425-408-8802
Address: 3613 191st Place SE, Bothell, WA 98012

Principal: Dr. Eric McDowell (emcdowell@nsd.org)

Assistant Principals:
• Bryan McNiel – bmcniel@nsd.org
• Tamorah Lang – tlang@nsd.org
• Greg Cox – gcox2@nsd.org

Attendance Office: 425-408-8810
Attendance Secretary: Barbara Taheri (NCHSAttendance@nsd.org)
Source: https://northcreek.nsd.org/`,
  },
  {
    title: "Attendance",
    content: `To report an absence:
Call 425-408-8810 or email NCHSAttendance@nsd.org (Barbara Taheri).
Source: https://northcreek.nsd.org/`,
  },
  {
    title: "2026-27 Family Calendar",
    content: `Key dates:
- Sept 7, 2026: Labor Day
- Nov 11, 2026: Veterans Day
- Nov 26-27, 2026: Thanksgiving Break
- Dec 21, 2026 – Jan 1, 2027: Winter Break
- Jan 18, 2027: MLK Day
- Feb 15-19, 2027: Mid-Winter Break
- April 5-9, 2027: Spring Break
- May 31, 2027: Memorial Day
- June 16, 2027: Last Day of School
Source: https://www.nsd.org/calendar`,
  },
];

// --------------------------------------------------
// Status helpers
// --------------------------------------------------
export async function getNorthCreekIndexStatus(): Promise<NorthCreekIndexStatus> {
  return {
    state: "ready",
    last_started_at: new Date().toISOString(),
    last_completed_at: new Date().toISOString(),
    page_count: SCRAPED_SCHOOL_PAGES.length,
    event_count: 0,
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

export async function getNorthCreekIndexSummary() {
  return {
    pageCount: SCRAPED_SCHOOL_PAGES.length,
    eventCount: 0,
    status: await getNorthCreekIndexStatus(),
  };
}

// --------------------------------------------------
// Helper
// --------------------------------------------------
function getSourceUrl(page: NorthCreekPage): string {
  if (page.url) return page.url;
  const match =
    page.content?.match(/Source URL:\s*(https?:\/\/[^\s]+)/i) ||
    page.content?.match(/Source:\s*(https?:\/\/[^\s]+)/i);
  return match?.[1] || "https://northcreek.nsd.org/";
}

// --------------------------------------------------
// Main answer engine
// --------------------------------------------------
export async function answerFromNorthCreekIndex(question: string): Promise<{
  answer: string;
  supported: boolean;
  sources: string[];
}> {
  const lower = (question || "").toLowerCase().trim();

  // 1. Greetings
  const greetings = ["hi", "hello", "hey", "sup", "yo", "good morning", "good afternoon", "good evening"];
  if (greetings.includes(lower) || greetings.some((g) => lower.startsWith(g + " "))) {
    return {
      answer:
        "Hi! I’m **The Bell**, your North Creek High School guide.\n\nI can only answer questions using official North Creek information (schedules, contacts, counselors, calendar, etc.). How can I help?",
      supported: true,
      sources: [],
    };
  }

  // 2. Refuse cheating / homework
  if (
    lower.includes("cheat") ||
    lower.includes("do my homework") ||
    lower.includes("solve this problem") ||
    lower.includes("write my essay") ||
    lower.includes("give me the answers") ||
    lower.includes("what is the answer to") ||
    lower.includes("help me with this quiz") ||
    lower.includes("complete this assignment")
  ) {
    return {
      answer:
        "I can’t help with tests, quizzes, homework, essays, or any graded work. I’m only here to answer questions using official North Creek High School information.",
      supported: false,
      sources: [],
    };
  }

  // 3. Soft scope check
  const schoolKeywords = [
    "school", "north creek", "nchs", "schedule", "bell", "counselor", "principal",
    "attendance", "absence", "holiday", "break", "contact", "office", "teacher",
    "class", "grade", "enrollment", "calendar", "event", "sport", "club", "asb",
    "lunch", "bus", "phone", "email", "address", "hours", "time", "staff", "period",
  ];
  const hasSchoolKeyword = schoolKeywords.some((kw) => lower.includes(kw));
  if (!hasSchoolKeyword && lower.length > 15) {
    return {
      answer:
        "I can only answer questions about North Creek High School using the official school website information. Please ask something related to the school.",
      supported: false,
      sources: [],
    };
  }

  // 4. Next holiday
  if (
    lower.includes("next holiday") ||
    lower.includes("next day off") ||
    lower.includes("upcoming holiday") ||
    lower.includes("when is the next") ||
    lower.includes("next break")
  ) {
    const today = new Date();
    const holidays = [
      { name: "Labor Day", date: new Date("2026-09-07") },
      { name: "Veterans Day", date: new Date("2026-11-11") },
      { name: "Thanksgiving Break", date: new Date("2026-11-26") },
      { name: "Winter Break", date: new Date("2026-12-21") },
      { name: "Martin Luther King Jr. Day", date: new Date("2027-01-18") },
      { name: "Presidents' Day / Mid-Winter Break", date: new Date("2027-02-15") },
      { name: "Spring Break", date: new Date("2027-04-05") },
      { name: "Memorial Day", date: new Date("2027-05-31") },
      { name: "Last Day of School", date: new Date("2027-06-16") },
    ];

    const upcoming = holidays
      .filter((h) => h.date >= today)
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    if (upcoming.length === 0) {
      return {
        answer: "There are no more major holidays left in the 2026-27 school year.",
        supported: true,
        sources: ["https://www.nsd.org/calendar"],
      };
    }

    const next = upcoming[0];
    const formatted = next.date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    return {
      answer: `The next holiday / day off is **${next.name}** on **${formatted}**.`,
      supported: true,
      sources: ["https://www.nsd.org/calendar"],
    };
  }

  // 5. Lunch explanation
  if (
    lower.includes("lunch") ||
    lower.includes("what lunch") ||
    lower.includes("which lunch") ||
    lower.includes("i don't know what lunch") ||
    lower.includes("my lunch")
  ) {
    return {
      answer: `**How Lunch Works at North Creek**

**Monday, Tuesday, Thursday, Friday**
Your lunch is based on the location of your **5th period** class:
• 1st Building → **A Lunch**
• 2nd Building → **B Lunch** (this one has a split period)
• A Building / 3rd Building → Current data is not available — please ask your 5th period teacher

**Wednesday**
Your lunch is based on the location of your **6th period** class (same building rules).

Just tell me which lunch you have (**A Lunch** or **B Lunch**) and I can show you the exact period schedule for today.`,
      supported: true,
      sources: ["https://northcreek.nsd.org/our-school/schedule"],
    };
  }

  // 6. Full / detailed schedule
  if (
    lower.includes("full schedule") ||
    lower.includes("period schedule") ||
    lower.includes("all periods") ||
    lower.includes("bell schedule") ||
    lower.includes("when does each period") ||
    lower.includes("period times") ||
    lower.includes("schedule for today") ||
    lower.includes("today's schedule") ||
    lower.includes("what time is")
  ) {
    const today = new Date();
    const day = today.getDay(); // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri
    const dayName = today.toLocaleDateString("en-US", { weekday: "long" });

    const hasALunch = lower.includes("a lunch") || lower.includes("1st lunch") || lower.includes("first lunch");
    const hasBLunch = lower.includes("b lunch") || lower.includes("2nd lunch") || lower.includes("second lunch");

    // ===== WEDNESDAY =====
    if (day === 3) {
      if (hasALunch) {
        return {
          answer: `**Wednesday Schedule – A Lunch**

| Period       | Time          |
|--------------|---------------|
| Period 2     | 8:15 – 9:35   |
| Break        | 9:35 – 9:45   |
| Jag Time     | 9:50 – 10:20  |
| Period 4     | 10:25 – 11:45 |
| **A Lunch**  | 11:45 – 12:15 |
| Period 6     | 12:20 – 1:45  |

School ends at **1:45 p.m.**`,
          supported: true,
          sources: ["https://northcreek.nsd.org/our-school/schedule"],
        };
      }
      if (hasBLunch) {
        return {
          answer: `**Wednesday Schedule – B Lunch**

| Period          | Time          |
|-----------------|---------------|
| Period 2        | 8:15 – 9:35   |
| Break           | 9:35 – 9:45   |
| Jag Time        | 9:50 – 10:20  |
| Period 4        | 10:25 – 11:45 |
| Period 6 (pt 1) | 11:50 – 12:30 |
| **B Lunch**     | 12:30 – 1:00  |
| Period 6 (pt 2) | 1:05 – 1:45   |

School ends at **1:45 p.m.**`,
          supported: true,
          sources: ["https://northcreek.nsd.org/our-school/schedule"],
        };
      }
    }

    // ===== THURSDAY =====
    if (day === 4) {
      if (hasALunch) {
        return {
          answer: `**Thursday Schedule – A Lunch**

| Period       | Time          |
|--------------|---------------|
| Period 1     | 8:15 – 9:35   |
| Break        | 9:35 – 9:45   |
| Jag Time     | 9:50 – 10:20  |
| Period 3     | 10:25 – 11:45 |
| **A Lunch**  | 11:45 – 12:15 |
| Period 5     | 12:20 – 1:50  |
| Period 7     | 1:55 – 3:15   |

School ends at **3:15 p.m.**`,
          supported: true,
          sources: ["https://northcreek.nsd.org/our-school/schedule"],
        };
      }
      if (hasBLunch) {
        return {
          answer: `**Thursday Schedule – B Lunch**

| Period          | Time          |
|-----------------|---------------|
| Period 1        | 8:15 – 9:35   |
| Break           | 9:35 – 9:45   |
| Jag Time        | 9:50 – 10:20  |
| Period 3        | 10:25 – 11:45 |
| Period 5 (pt 1) | 11:50 – 12:30 |
| **B Lunch**     | 12:30 – 1:00  |
| Period 5 (pt 2) | 1:05 – 1:50   |
| Period 7        | 1:55 – 3:15   |

School ends at **3:15 p.m.**`,
          supported: true,
          sources: ["https://northcreek.nsd.org/our-school/schedule"],
        };
      }
    }

    // ===== MON / TUE / FRI =====
    if (day === 1 || day === 2 || day === 5) {
      if (hasALunch) {
        return {
          answer: `**${dayName} Regular Schedule – A Lunch**

| Period       | Time          |
|--------------|---------------|
| Period 1     | 8:15 – 9:05   |
| Period 2     | 9:10 – 10:00  |
| Break        | 10:00 – 10:10 |
| Period 3     | 10:15 – 11:05 |
| Period 4     | 11:10 – 12:00 |
| **A Lunch**  | 12:00 – 12:30 |
| Period 5     | 12:35 – 1:25  |
| Period 6     | 1:30 – 2:20   |
| Period 7     | 2:25 – 3:15   |

School ends at **3:15 p.m.**`,
          supported: true,
          sources: ["https://northcreek.nsd.org/our-school/schedule"],
        };
      }
      if (hasBLunch) {
        return {
          answer: `**${dayName} Regular Schedule – B Lunch**

| Period       | Time          |
|--------------|---------------|
| Period 1     | 8:15 – 9:05   |
| Period 2     | 9:10 – 10:00  |
| Break        | 10:00 – 10:10 |
| Period 3     | 10:15 – 11:05 |
| Period 4     | 11:10 – 12:00 |
| Period 5     | 12:05 – 12:55 |
| **B Lunch**  | 12:55 – 1:25  |
| Period 6     | 1:30 – 2:20   |
| Period 7     | 2:25 – 3:15   |

School ends at **3:15 p.m.**`,
          supported: true,
          sources: ["https://northcreek.nsd.org/our-school/schedule"],
        };
      }
    }

    // Default – ask which lunch
    return {
      answer: `I can show you the exact period schedule for **${dayName}**, but I need to know which lunch you have.

Please reply with:
• **A Lunch**
• **B Lunch**

(Or tell me your 5th period building if you’re not sure.)`,
      supported: true,
      sources: ["https://northcreek.nsd.org/our-school/schedule"],
    };
  }

  // 7. Attendance
  if (
    lower.includes("absence") ||
    lower.includes("absent") ||
    lower.includes("attendance") ||
    lower.includes("report an absence")
  ) {
    return {
      answer: `**How to Report an Absence**

Call the Attendance Office at **425-408-8810**  
or email **Barbara Taheri** at **NCHSAttendance@nsd.org**

Please include the student’s full name, grade, and reason.`,
      supported: true,
      sources: ["https://northcreek.nsd.org/"],
    };
  }

  // 8. Principal only
  if (
    (lower.includes("principal") || lower.includes("who is the principal")) &&
    !lower.includes("assistant") &&
    !lower.includes("admin") &&
    !lower.includes("staff") &&
    !lower.includes("contact")
  ) {
    return {
      answer: `**Principal**

**Dr. Eric McDowell**  
Email: emcdowell@nsd.org`,
      supported: true,
      sources: ["https://northcreek.nsd.org/"],
    };
  }

  // 9. Counselor by last name
  if (
    lower.includes("counselor") ||
    lower.includes("my counselor") ||
    lower.includes("who is my counselor")
  ) {
    const words = lower.replace(/[^a-z\s]/g, "").split(/\s+/).filter(Boolean);
    const lastName = words[words.length - 1] || "";

    const counselors = [
      { range: "A-Car", name: "Kayla Francisco-Christman", phone: "425-408-8845", email: "kfrancisco@nsd.org" },
      { range: "Cas-Gon", name: "Tiffany Frane", phone: "425-408-8823", email: "tfrane@nsd.org" },
      { range: "Goo-Kim", name: "Jeff Dennis", phone: "425-408-8820", email: "jdennis@nsd.org" },
      { range: "Kin-Mem", name: "Yuchen Zhang", phone: "425-408-8821", email: "yzhang@nsd.org" },
      { range: "Men-Pun", name: "Kate Kanin", phone: "425-408-8822", email: "kkanin@nsd.org" },
      { range: "Puo-Spe", name: "Dawn LaMance", phone: "425-408-8846", email: "dlamance@nsd.org" },
      { range: "Spf-Z", name: "Charlene Beam", phone: "425-408-8847", email: "cbeam@nsd.org" },
    ];

    let matched = null;
    if (lastName.length >= 2) {
      const firstThree = lastName.slice(0, 3).toLowerCase();
      if (firstThree <= "car") matched = counselors[0];
      else if (firstThree <= "gon") matched = counselors[1];
      else if (firstThree <= "kim") matched = counselors[2];
      else if (firstThree <= "mem") matched = counselors[3];
      else if (firstThree <= "pun") matched = counselors[4];
      else if (firstThree <= "spe") matched = counselors[5];
      else matched = counselors[6];
    }

    if (matched) {
      return {
        answer: `Your counselor is **${matched.name}** (${matched.range}).

Phone: ${matched.phone}
Email: ${matched.email}

You can schedule an appointment through Student Square.`,
        supported: true,
        sources: ["https://northcreek.nsd.org/counseling"],
      };
    }

    return {
      answer: `Here are the North Creek High School counselors by last name:

• **A–Car**: Kayla Francisco-Christman – 425-408-8845 – kfrancisco@nsd.org
• **Cas–Gon**: Tiffany Frane – 425-408-8823 – tfrane@nsd.org
• **Goo–Kim**: Jeff Dennis – 425-408-8820 – jdennis@nsd.org
• **Kin–Mem**: Yuchen Zhang – 425-408-8821 – yzhang@nsd.org
• **Men–Pun**: Kate Kanin – 425-408-8822 – kkanin@nsd.org
• **Puo–Spe**: Dawn LaMance – 425-408-8846 – dlamance@nsd.org
• **Spf–Z**: Charlene Beam – 425-408-8847 – cbeam@nsd.org

Just tell me your last name and I can tell you exactly who your counselor is.`,
      supported: true,
      sources: ["https://northcreek.nsd.org/counseling"],
    };
  }

  // 10. Full contacts
  if (
    lower.includes("contact") ||
    lower.includes("administrator") ||
    lower.includes("admin") ||
    lower.includes("staff") ||
    lower.includes("office") ||
    lower.includes("phone") ||
    lower.includes("email")
  ) {
    return {
      answer: `**North Creek High School Contacts**

**Main Office**  
425-408-8800 · Fax 425-408-8802  
3613 191st Place SE, Bothell, WA 98012

**Principal**  
Dr. Eric McDowell – emcdowell@nsd.org

**Assistant Principals**  
• Bryan McNiel – bmcniel@nsd.org  
• Tamorah Lang – tlang@nsd.org  
• Greg Cox – gcox2@nsd.org

**Attendance**  
425-408-8810 · Barbara Taheri (NCHSAttendance@nsd.org)`,
      supported: true,
      sources: ["https://northcreek.nsd.org/"],
    };
  }

  // 11. Groq fallback
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return {
        answer:
          "I don’t have enough live information for that question right now.\n\nYou can always call the main office at **425-408-8800** or visit https://northcreek.nsd.org/",
        supported: false,
        sources: ["https://northcreek.nsd.org/"],
      };
    }

    const keywords = lower.split(/\s+/).filter((w) => w.length > 2);
    const scored: ScoredPage[] = SCRAPED_SCHOOL_PAGES.map((page) => {
      const text = `${page.title} ${page.content}`.toLowerCase();
      let score = 0;
      keywords.forEach((kw) => {
        if (text.includes(kw)) score += 1;
      });
      return { page, score };
    })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);

    const contextPages = scored.length > 0 ? scored.map((s) => s.page) : SCRAPED_SCHOOL_PAGES.slice(0, 4);
    const context = contextPages
      .map((p) => `### ${p.title}\nSource: ${getSourceUrl(p)}\n${p.content.slice(0, 1800)}`)
      .join("\n\n---\n\n");

    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: `You are The Bell, the official friendly AI assistant for North Creek High School (Bothell, WA).

STRICT RULES:
- You can ONLY answer using the provided context from the official school website.
- Never help with homework, tests, quizzes, essays, or any graded work.
- Be concise, clear, and helpful.
- If the answer is not in the context, politely say you can only answer using official North Creek information.`,
        },
        {
          role: "user",
          content: `Context from the official North Creek / Northshore website:\n\n${context}\n\n---\nUser question: ${question}`,
        },
      ],
      temperature: 0.15,
      max_tokens: 500,
    });

    const answer =
      completion.choices[0]?.message?.content?.trim() ||
      "I couldn’t find a clear answer in the school records. Please try rephrasing or call the main office at 425-408-8800.";

    const sources = [...new Set(contextPages.map((p) => getSourceUrl(p)))].slice(0, 3);

    return { answer, supported: true, sources };
  } catch (error) {
    logger.error({ error }, "Groq completion failed");
    return {
      answer:
        "Sorry — I’m having a temporary issue generating a response. Please try again in a moment or call the main office at 425-408-8800.",
      supported: false,
      sources: ["https://northcreek.nsd.org/"],
    };
  }
}
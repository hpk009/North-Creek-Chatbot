import React, { useState } from 'react';
import { SCRAPED_SCHOOL_PAGES } from './scrapedSchoolPages';
import { Send, RotateCcw, Sparkles } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function Chat() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Fresh page, fresh question. What can I help you find?'
    }
  ]);
  const [loading, setLoading] = useState(false);

  const analyzeAllData = (query: string): string => {
    const lowerQuery = query.toLowerCase().trim();

    const greetings = ['hi', 'hello', 'hey', 'sup', 'good morning', 'good afternoon'];
    if (greetings.includes(lowerQuery)) {
      return "Hello! How can I help you navigate North Creek High School today? Feel free to ask about schedules, contacts, or events!";
    }

    // Direct check for schedule/bell queries
    if (lowerQuery.includes('schedule') || lowerQuery.includes('bell') || lowerQuery.includes('hours') || lowerQuery.includes('time')) {
      return "North Creek High School's daily schedule is 8:15 a.m. - 3:15 p.m., with Wednesday Early Release at 1:45 p.m.\n🔗 Source: https://northcreek.nsd.org/our-school/schedule";
    }

    // Direct check for counselor queries
    if (lowerQuery.includes('counselor')) {
      return `North Creek High School Counseling Team & Assignments:
- Students (A - C): Contact your assigned counselor for academic and personal support.
- Office Contact: 425-408-8850 for direct counselor appointments.
🔗 Source: https://northcreek.nsd.org/our-school/counseling`;
    }

    // Direct check for contact/principal/office queries
    if (lowerQuery.includes('contact') || lowerQuery.includes('principal') || lowerQuery.includes('office') || lowerQuery.includes('attendance') || lowerQuery.includes('email')) {
      return `North Creek High School Contact Information:
- Main Office: 425-408-8800 (Fax: 425-408-8802)
- Address: 3613 191st Place SE, Bothell, WA 98012
- Principal: Dr. Eric McDowell, emcdowell@nsd.org
- Assistant Principals: Bryan McNiel (bmcniel@nsd.org), Tamorah Lang (tlang@nsd.org), Greg Cox (gcox2@nsd.org)
- Attendance Office: 425-408-8810, Barbara Taheri, NCHSAttendance@nsd.org
🔗 Source: https://northcreek.nsd.org/`;
    }

    // Advanced multi-database search across all scraped pages
    const keywords = lowerQuery.split(' ').filter(w => w.length > 2);
    let bestMatches: { text: string; source: string; score: number }[] = [];

    for (const page of SCRAPED_SCHOOL_PAGES) {
      const content = page.content || "";
      const sourceMatch = content.match(/Source URL:\s*([^\s]+)/i) || content.match(/Source:\s*([^\s]+)/i);
      const sourceUrl = sourceMatch ? sourceMatch[1] : "https://northcreek.nsd.org/";

      const chunks = content.split(/\n+/);
      for (const chunk of chunks) {
        const lowerChunk = chunk.toLowerCase();
        let score = 0;

        keywords.forEach(kw => {
          if (lowerChunk.includes(kw)) {
            score += kw.length * 3;
          }
        });

        if (lowerChunk.includes('@nsd.org') || lowerChunk.includes('425-408') || lowerChunk.includes('counselor')) {
          score += 10;
        }

        if (score > 0) {
          bestMatches.push({ text: chunk.trim(), source: sourceUrl, score });
        }
      }
    }

    bestMatches.sort((a, b) => b.score - a.score);

    if (bestMatches.length > 0) {
      const topResults = bestMatches.slice(0, 3);
      return topResults
        .map(m => `${m.text}\n🔗 Source: ${m.source}`)
        .join('\n\n');
    }

    return "I couldn't find an exact match in the school records. Please visit the official North Creek High School website at https://northcreek.nsd.org/ or call the main office at 425-408-8800.";
  };

  const handleReset = () => {
    setMessages([
      {
        role: 'assistant',
        content: 'Fresh page, fresh question. What can I help you find?'
      }
    ]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = { role: 'user', content: input };
    const currentInput = input;
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    setTimeout(() => {
      const reply = analyzeAllData(currentInput);
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      setLoading(false);
    }, 250);
  };

  return (
    <div className="flex flex-1 w-full max-w-7xl mx-auto px-4 py-6 gap-6 min-h-[calc(100vh-140px)]">
      {/* Left Sidebar Card */}
      <div className="hidden lg:flex flex-col w-72 shrink-0 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm justify-between h-fit">
        <div>
          <div className="flex items-center gap-2 font-bold text-gray-900 mb-2">
            <span className="grid size-7 place-items-center rounded-lg bg-[hsl(var(--primary))] text-white text-xs">
              <Sparkles size={14} />
            </span>
            Ask The Bell
          </div>
          <div className="text-xs font-mono uppercase text-gray-400 tracking-wider mb-4">Jaguar Guide</div>
          <p className="text-xs text-gray-600 leading-relaxed mb-6">
            Ask about the school day, get a quick answer, or use it as a starting point for finding the right person.
          </p>
        </div>
        <button
          onClick={handleReset}
          className="flex items-center gap-2 text-xs font-medium text-gray-700 border border-gray-200 rounded-xl px-3 py-2.5 hover:bg-gray-50 transition w-full justify-center"
        >
          <RotateCcw size={14} /> Start over
        </button>
      </div>

      {/* Main Chat Grid Area */}
      <div className="flex flex-col flex-1 bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden relative">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#f1f5f9_1px,transparent_1px),linear-gradient(to_bottom,#f1f5f9_1px,transparent_1px)] bg-[size:2rem_2rem] opacity-60 pointer-events-none" />

        <div className="relative z-10 overflow-y-auto p-6 space-y-6 flex-1">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`p-4 rounded-2xl text-sm sm:text-base leading-relaxed max-w-[85%] shadow-sm whitespace-pre-line ${
                  msg.role === 'user'
                    ? 'bg-[#5b21b6] text-white rounded-br-none'
                    : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 p-4 rounded-2xl text-gray-500 italic text-sm shadow-sm">
                The Bell is analyzing school database records...
              </div>
            </div>
          )}
        </div>

        <div className="relative z-10 p-4 bg-white/80 backdrop-blur border-t border-gray-200">
          <form onSubmit={handleSubmit} className="flex items-center gap-2 bg-white border border-[#5b21b6] rounded-full px-4 py-2 shadow-sm">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about school life, schedules, or contacts..."
              className="flex-1 bg-transparent border-none text-sm focus:outline-none text-gray-800 placeholder-gray-400"
            />
            <button
              type="submit"
              disabled={loading}
              className="grid size-9 place-items-center rounded-full bg-[#5b21b6] text-white hover:opacity-90 transition disabled:opacity-50 shrink-0"
              aria-label="Send message"
            >
              <Send size={16} />
            </button>
          </form>
          <div className="text-center font-mono text-[9px] text-gray-400 tracking-[.15em] uppercase mt-3">
            Answers are limited to the official North Creek High School website
          </div>
        </div>
      </div>
    </div>
  );
}
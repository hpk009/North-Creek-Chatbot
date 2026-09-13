import { Router, type Request, type Response, type IRouter } from "express";
import healthRouter from "./health";
import northCreekRouter from "./north-creek";

const router: IRouter = Router();

router.use(healthRouter);
router.use(northCreekRouter);

router.post("/api/chat", async (req: Request, res: Response) => {
  try {
    const { messages } = req.body as { messages: Array<{ role: string; content: string }> };
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      res.status(500).json({ error: "GROQ_API_KEY is not configured." });
      return;
    }

    const systemPrompt = `You are The Bell, North Creek High School's AI assistant. Provide complete details answering the user's question using official school website data and the Northshore School District Rights & Responsibilities Handbook. 

Counselor assignments:
- A-Car: Kayla Francisco-Christman (425-408-8845, kfrancisco@nsd.org)
- Cas-Gon: Tiffany Frane (425-408-8823, tfrane@nsd.org)
- Goo-Kim: Jeff Dennis (425-408-8820, jdennis@nsd.org)
- Kin-Mem: Yuchen Zhang (425-408-8821, yzhang@nsd.org)
- Men-Pun: Kate Kanin (425-408-8822, kkanin@nsd.org)
- Puo-Spe: Dawn LaMance (425-408-8846, dlamance@nsd.org)
- Spf-Z: Charlene Beam (425-408-8847, cbeam@nsd.org)

Attendance reporting: Call Attendance Office at 425-408-8810 or email NCHSAttendance@nsd.org. 
Schedules: Regular M/T/Th/F (8:15 AM - 3:15 PM) and Wednesday early release (8:15 AM - 1:45 PM).

Write in plain text without markdown asterisks. Always reference the official guidelines or source URLs when answering.`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to communicate with Groq API.");
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const answer = data.choices?.[0]?.message?.content;

    if (!answer) {
      throw new Error("No response received from AI.");
    }

    res.json({ answer });
  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({ error: "Failed to process chat request." });
  }
});

export default router;
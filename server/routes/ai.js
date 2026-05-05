const router = require("express").Router();
const axios = require("axios");
const { protect } = require("../middleware/auth");
const { aiLimiter } = require("../middleware/rateLimiter");

router.post("/review", protect, aiLimiter, async (req, res) => {
  try {
    const { code, language, problem_description = "" } = req.body;
    if (!code) return res.status(400).json({ error: "code required" });

    const prompt = `You are an expert technical interviewer reviewing a candidate's code solution.

Language: ${language}
${problem_description ? `Problem: ${problem_description}` : ""}

Code:
\`\`\`${language}
${code}
\`\`\`

Analyze this code and respond ONLY with a valid JSON object in this exact format:
{
  "overall_score": <number 1-10>,
  "summary": "<2-3 sentence overall assessment>",
  "time_complexity": {
    "value": "<e.g. O(n log n)>",
    "explanation": "<brief explanation>"
  },
  "space_complexity": {
    "value": "<e.g. O(n)>",
    "explanation": "<brief explanation>"
  },
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "issues": [
    {
      "severity": "<critical|warning|suggestion>",
      "title": "<short title>",
      "description": "<detailed explanation>",
      "line_hint": "<approximate line or code snippet if applicable>"
    }
  ],
  "edge_cases_missed": ["<edge case 1>", "<edge case 2>"],
  "improved_snippet": "<optional: a small improved code snippet if there's a clear quick win, or empty string>",
  "hire_signal": "<strong_yes|yes|maybe|no>"
}`;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Gemini API key is not configured on the server.");
    }

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
      }
    );

    const raw = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!raw) {
      console.error("Gemini empty response. Full body:", JSON.stringify(response.data));
      throw new Error("AI returned an empty response");
    }

    // Robust cleaning: Find first '{' and last '}' to extract JSON from any extra text or markdown
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const cleaned = jsonMatch ? jsonMatch[0] : raw;

    let review;
    try {
      review = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("Failed to parse AI response. Raw output:", raw);
      throw new Error("AI response was not valid JSON. Please try again.");
    }

    res.json({ review });
  } catch (err) {
    console.error("AI Review Error:", err.response?.data || err.message);
    res.status(err.response?.status || 500).json({ 
      error: err.response?.data?.message || err.message || "AI review failed" 
    });
  }
});

module.exports = router;

import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

function getAI() {
  if (!aiInstance) {
    const apiKey = typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : '';
    if (!apiKey || apiKey === "undefined") {
      console.warn("GEMINI_API_KEY is missing. AI features will not work.");
    }
    aiInstance = new GoogleGenAI({ apiKey: apiKey || "" });
  }
  return aiInstance;
}

export interface LanguageResult {
  jobDescription: string;
  interviewGuide: string;
}

export interface GenerationResult {
  [language: string]: LanguageResult;
}

export async function generateRecruitmentMaterials(rawNotes: string, languages: string[]): Promise<GenerationResult> {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: [
      {
        role: "user",
        parts: [{ text: `Act as an expert Recruitment Consultant. Based on these raw notes, generate distinct outputs for each of these languages: ${languages.join(", ")}.

For EACH language, provide:
1) A polished, correctly formatted Job Description tailored for LinkedIn.
2) An Interview Guide containing 10 behavioral questions specifically targeting the soft and hard skills mentioned in that new JD.

STRICT REQUIREMENT: Use ONLY standard Markdown for formatting. Do NOT use any HTML tags like <br>, <b>, <i>, etc. Use double newlines for paragraph breaks.

Raw Notes:
${rawNotes}` }]
      }
    ],
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: languages.reduce((acc, lang) => ({
          ...acc,
          [lang]: {
            type: Type.OBJECT,
            properties: {
              jobDescription: { type: Type.STRING },
              interviewGuide: { type: Type.STRING },
            },
            required: ["jobDescription", "interviewGuide"],
          }
        }), {}),
        required: languages,
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error("No response from Gemini");
  return JSON.parse(text) as GenerationResult;
}

export async function refineMaterial(
  currentContent: string, 
  instruction: string, 
  type: "jd" | "guide",
  language: string
): Promise<string> {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: [
      {
        role: "user",
        parts: [{ text: `You are an expert Recruitment Consultant. Please refine the following ${type === "jd" ? "Job Description" : "Interview Guide"} in ${language} based on these instructions: "${instruction}".

Current Content:
${currentContent}

STRICT REQUIREMENT: Return ONLY the updated content in Markdown format. Do NOT include any conversational filler or HTML tags.` }]
      }
    ],
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
    }
  });

  return response.text || currentContent;
}

export interface ChatMessage {
  role: "user" | "model";
  text: string;
}

export async function chatWithGemini(messages: ChatMessage[]) {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-lite-preview",
    contents: messages.map(m => ({
      role: m.role,
      parts: [{ text: m.text }]
    })),
    config: {
      systemInstruction: "You are a helpful recruitment assistant in a Recruitment Sandbox app. You help users refine their job descriptions and interview questions. Keep responses concise and professional.",
    }
  });

  return response.text || "I'm sorry, I couldn't process that.";
}

export async function getRoleBenchmarks(jobTitle: string, language: string): Promise<string> {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: [
      {
        role: "user",
        parts: [{ text: `Provide industry benchmarks for the role: "${jobTitle}" in ${language}.
Include:
1. Typical Salary Ranges (Global/Regional)
2. Core Competencies (Top 5)
3. Market Demand Level
4. Common Benefits/Perks for this role
5. Key Performance Indicators (KPIs)

Format as a clean, professional Markdown report.` }]
      }
    ],
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
    }
  });

  return response.text || "No benchmarks available for this role.";
}

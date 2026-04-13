import { GoogleGenerativeAI } from "@google/generative-ai";

// Access the API key from process.env which is defined in vite.config.ts
const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

export async function analyzeMood(text: string) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const prompt = `分析以下这段心情记录的文字，推测用户的情绪（如：开心、难过、焦虑、平静、愤怒等），并给出一条简短的情绪建议。
  要求返回 JSON 格式：{"mood": "情绪词", "suggestion": "建议内容"}
  文字内容："${text}"`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const jsonStr = response.text().replace(/```json|```/g, "").trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Mood analysis failed:", error);
    return { mood: "未知", suggestion: "保持记录，关注内心。" };
  }
}

export async function generateDailySummary(entries: any[]) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const entriesText = entries.map(e => {
    const loc = e.location?.address ? ` (地点: ${e.location.address})` : "";
    return `[${e.time}] ${e.content} (情绪: ${e.mood})${loc}`;
  }).join("\n");
  
  const prompt = `根据用户今天的一系列心情记录，生成一篇图文并茂、温馨的小日记总结。
  包含：
  1. 今天的整体心情回顾。
  2. 关键事件的总结（如果记录中有地点信息，请结合地点描述）。
  3. 一段自我反思或鼓励的话。
  
  记录内容：
  ${entriesText}
  
  请使用 Markdown 格式输出。`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Summary generation failed:", error);
    return "今天也是充实的一天，继续加油！";
  }
}

export async function askAboutDay(question: string, entries: any[]) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const entriesText = entries.map(e => {
    const loc = e.location?.address ? ` (地点: ${e.location.address})` : "";
    return `[${e.time}] ${e.content} (情绪: ${e.mood})${loc}`;
  }).join("\n");

  const prompt = `用户问了一个关于他今天在干嘛的问题："${question}"
  
  这是他今天的记录：
  ${entriesText}
  
  请根据记录回答用户的问题。如果记录中有地点信息，请务必结合地点来回答。如果记录中没有提到相关内容，请委婉告知。
  回答要亲切、自然，像一个懂他的好朋友。`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("AI Q&A failed:", error);
    return "抱歉，我刚才走神了，没能想起你今天做了什么。";
  }
}

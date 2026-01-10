import { streamText, tool } from "ai";
import { createHuggingFace } from "@ai-sdk/huggingface";
import admin from "firebase-admin";
import { z } from "zod";

/* ---------------- Firebase Init (Safe Pattern) ---------------- */
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}
const db = admin.firestore();

/* ---------------- Configurations ---------------- */
const hf = createHuggingFace({ apiKey: process.env.HF_LLM_KEY });

// function generateMockStockData(symbol: string) {
//   const price = Math.floor(Math.random() * 2000) + 1000;
//   const change = (Math.random() * 200 - 100).toFixed(2);
//   const changePercent = ((parseFloat(change) / price) * 100).toFixed(2);

//   return {
//     success: true,
//     symbol: symbol.toUpperCase() + ".BOM",
//     baseSymbol: symbol.toUpperCase(),
//     latestPrice: price.toFixed(2),
//     change,
//     changePercent,
//     average30Day: (price * 0.98).toFixed(2),
//     high52Week: (price * 1.2).toFixed(2),
//     low52Week: (price * 0.8).toFixed(2),
//     avgVolume: "5000000",
//     last5Days: [
//       {
//         date: new Date(Date.now() - 0 * 86400000).toISOString().split("T")[0],
//         close: price,
//         high: price * 1.02,
//         low: price * 0.98,
//         volume: 4500000,
//       },
//       {
//         date: new Date(Date.now() - 1 * 86400000).toISOString().split("T")[0],
//         close: price * 0.99,
//         high: price * 1.01,
//         low: price * 0.97,
//         volume: 5200000,
//       },
//       {
//         date: new Date(Date.now() - 2 * 86400000).toISOString().split("T")[0],
//         close: price * 0.98,
//         high: price * 1.0,
//         low: price * 0.96,
//         volume: 4800000,
//       },
//       {
//         date: new Date(Date.now() - 3 * 86400000).toISOString().split("T")[0],
//         close: price * 1.01,
//         high: price * 1.03,
//         low: price * 0.99,
//         volume: 5100000,
//       },
//       {
//         date: new Date(Date.now() - 4 * 86400000).toISOString().split("T")[0],
//         close: price * 1.02,
//         high: price * 1.04,
//         low: price * 1.0,
//         volume: 4700000,
//       },
//     ],
//     companyInfo: {
//       name: symbol.toUpperCase(),
//       description: `${symbol.toUpperCase()} is a major company listed on the BSE.`,
//       sector: "Diversified",
//       industry: "Finance & Services",
//       marketCap: "2000000 Cr",
//       peRatio: "15.5",
//       dividendYield: "2.8%",
//       profitMargin: "12.5%",
//     },
//     lastRefreshed: new Date().toISOString().split("T")[0],
//   };
// }

async function analyzeWithFinBERT(text: string) {
  try {
    console.log("[SENTIMENT] Calling FinBERT API...");
    const response = await fetch(
      "https://api-inference.huggingface.co/models/ProsusAI/finbert",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.HF_FINBERT_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: text,
          options: { wait_for_model: true },
        }),
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!response.ok) {
      console.warn(
        `[SENTIMENT] FinBERT returned ${response.status}, using fallback`
      );
      throw new Error(`FinBERT API error: ${response.status}`);
    }

    const result = await response.json();

    if (!Array.isArray(result) || !result[0]) {
      throw new Error("Invalid FinBERT response format");
    }

    const best = result[0].reduce((a: any, b: any) =>
      a.score > b.score ? a : b
    );

    console.log("[SENTIMENT] FinBERT analysis successful:", best.label);
    return {
      label: best.label,
      confidence: Number(best.score.toFixed(3)),
    };
  } catch (error) {
    console.warn("[SENTIMENT] FinBERT failed, using keyword fallback:", error);

    const lowerText = text.toLowerCase();
    const bullishWords = [
      "strong",
      "gain",
      "positive",
      "bullish",
      "growth",
      "profit",
      "surge",
      "rally",
      "outperform",
    ];
    const bearishWords = [
      "weak",
      "loss",
      "negative",
      "bearish",
      "decline",
      "drop",
      "fall",
      "crash",
      "underperform",
    ];

    const bullishCount = bullishWords.filter((w) =>
      lowerText.includes(w)
    ).length;
    const bearishCount = bearishWords.filter((w) =>
      lowerText.includes(w)
    ).length;

    let label = "NEUTRAL";
    if (bullishCount > bearishCount) label = "POSITIVE";
    else if (bearishCount > bullishCount) label = "NEGATIVE";

    return {
      label,
      confidence: 0.7,
    };
  }
}

async function fetchStockData(symbol: string) {
  try {
    console.log(`[STOCK] Fetching data for ${symbol}...`);
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

    const response = await fetch(`${baseUrl}/api/stocks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.warn(
        `[STOCK] API returned ${response.status}, using mock data`
      );
      // return generateMockStockData(symbol);
    }

    const data = await response.json();

    if (data.error) {
      console.warn("[STOCK] API returned error, using mock data:", data.error);
    //   return generateMockStockData(symbol);
    }

    console.log("[STOCK] Live data fetched successfully");
    return data;
  } catch (error) {
    console.warn("[STOCK] API call failed, using mock data:", error);
    // return generateMockStockData(symbol);
  }
}

const stockParamsSchema = z.object({
  symbol: z.string().describe("Stock symbol"),
});

const sentimentParamsSchema = z.object({
  text: z.string().describe("Financial text to analyze"),
});

export async function POST(request: Request) {
  try {
    const { messages, chatId } = await request.json();

    console.log("[API] POST received, chatId:", chatId);

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      console.error("[API] Invalid messages");
      return new Response(
        JSON.stringify({ error: "Invalid messages format" }),
        { status: 400 }
      );
    }

    console.log("[API] Streaming with", messages.length, "messages");

    const result = await streamText({
      model: hf("meta-llama/Llama-3.1-8B-Instruct"),
      system: `You are an expert financial analyst specializing in Indian stock market analysis (BSE - Bombay Stock Exchange).

Your expertise:
- Stock price analysis and trend identification
- Technical and fundamental analysis
- Risk assessment and market sentiment
- Company financial metrics

When analyzing stocks:
1. Use getStockData tool to fetch current data
2. Analyze price trends, support/resistance levels
3. Evaluate company fundamentals if available
4. Provide risk assessment
5. Give investment perspective

Always provide structured analysis with:
- Current Price & Change
- Trend Analysis (5-day and 30-day)
- Key Support/Resistance Levels
- Company Fundamentals
- Risk Assessment
- Investment Recommendation

Be professional, accurate, and transparent about limitations.`,
      messages,
      temperature: 0.7,
  

      tools: {
        getStockData: tool({
          description:
            "Fetch comprehensive stock data including price history, company information, and financial metrics for BSE stocks.",
          inputSchema: stockParamsSchema,

          execute: async ({ symbol }) => {
            try {
              console.log("[TOOL] getStockData executing for:", symbol);
              const data = await fetchStockData(symbol);
              console.log("[TOOL] getStockData completed");
              return data;
            } catch (error) {
              console.error("[TOOL] getStockData error:", error);
              // return generateMockStockData(symbol);
            }
          },
        }),

        analyzeFinancialSentiment: tool({
          description:
            "Analyze financial news, headlines, or statements for market sentiment (Bullish, Bearish, Neutral).",
          inputSchema: sentimentParamsSchema,

          execute: async ({ text }) => {
            try {
              console.log("[TOOL] analyzeFinancialSentiment executing");
              const res = await analyzeWithFinBERT(text);

              const sentimentMap: Record<string, string> = {
                POSITIVE: "Bullish",
                NEGATIVE: "Bearish",
                NEUTRAL: "Neutral",
              };

              const result = {
                sentiment: sentimentMap[res.label] || "Neutral",
                confidence: res.confidence,
                label: res.label,
              };

              console.log("[TOOL] analyzeFinancialSentiment completed:", result);
              return result;
            } catch (error) {
              console.error("[TOOL] analyzeFinancialSentiment error:", error);
              return {
                sentiment: "Neutral",
                confidence: 0.5,
                error: "Sentiment analysis unavailable",
              };
            }
          },
        }),
      },

      onFinish: async ({ text }) => {
        console.log("[STREAM] onFinish called, saving to Firebase");

        if (!chatId) {
          console.warn("[STREAM] No chatId provided, skipping save");
          return;
        }

        try {
          const messagesRef = db
            .collection("chats")
            .doc(chatId)
            .collection("messages");

          const userMessage = messages[messages.length - 1];

          await messagesRef.add({
            role: "user",
            content: userMessage.content,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          await messagesRef.add({
            role: "assistant",
            content: text,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          console.log("[DB] Messages saved successfully");
        } catch (err) {
          console.error("[DB] Error saving messages:", err);
        }
      },

      onError: ({ error }) => {
        console.error("[STREAM] Error event:", error);
      },
    });

    console.log("[API] Returning UI message stream response");
    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("[API] Fatal Error:", error);
    return new Response(
      JSON.stringify({
        error: "Server Error",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500 }
    );
  }
}
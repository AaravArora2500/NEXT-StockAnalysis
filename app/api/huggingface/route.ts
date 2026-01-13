// app/api/huggingface/route.ts

import { generateText } from "ai"
import { createHuggingFace } from "@ai-sdk/huggingface"
import admin from "firebase-admin"

/* ---------------- Firebase Init ---------------- */
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  })
}
const db = admin.firestore()

/* ---------------- Hugging Face Init ---------------- */
const hf = createHuggingFace({ apiKey: process.env.HF_LLM_KEY! })

/* ---------------- Logic Helpers ---------------- */

const BLACKLIST = new Set(["NSE", "BSE", "BUY", "SELL", "HOLD", "STOCK", "PRICE", "INDIA"])

function extractTicker(text: string): string | null {
  const matches = text.match(/\b[A-Z]{2,10}\b/g)
  if (!matches) return null
  return matches.find(m => !BLACKLIST.has(m)) || null
}

async function fetchStockData(symbol: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"
    const res = await fetch(`${baseUrl}/api/stock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol }),
    })
    return res.ok ? await res.json() : null
  } catch {
    return null
  }
}

async function analyzeSentiment(text: string) {
  try {
    const res = await fetch("https://api-inference.huggingface.co/models/ProsusAI/finbert", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HF_FINBERT_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: text }),
    })
    const result = await res.json()
    const best = result[0].reduce((a: any, b: any) => (a.score > b.score ? a : b))
    return `${best.label} (${best.score.toFixed(2)})`
  } catch {
    return "Neutral"
  }
}

async function generateChatTitle(userMessage: string): Promise<string> {
  try {
    const { text } = await generateText({
      model: hf("meta-llama/Llama-3.1-8B-Instruct"),
      prompt: `Generate a short title (max 5 words) for a stock market chat that starts with: "${userMessage.substring(0, 50)}". Return only the title, nothing else.`,
      temperature: 0.7,
    
    })
    return text.trim().substring(0, 60) || "New Chat"
  } catch {
    return `Chat - ${new Date().toLocaleDateString()}`
  }
}

/* ==================== API ROUTES ==================== */

// GET /api/huggingface - Get all chats
export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const chatId = url.searchParams.get("chatId")

    // If chatId is provided, fetch specific chat
    if (chatId) {
      const messagesSnapshot = await db
        .collection("chats")
        .doc(chatId)
        .collection("messages")
        .orderBy("createdAt", "asc")
        .get()

      const messages = messagesSnapshot.docs.map((doc) => ({
        id: doc.id,
        role: doc.data().role,
        content: doc.data().content,
      }))

      return Response.json({ messages })
    }

    // Otherwise, fetch all chats
    const chatsSnapshot = await db
      .collection("chats")
      .orderBy("createdAt", "desc")
      .limit(50)
      .get()

    const chats = await Promise.all(
      chatsSnapshot.docs.map(async (doc) => {
        const messagesSnapshot = await db
          .collection("chats")
          .doc(doc.id)
          .collection("messages")
          .orderBy("createdAt", "asc")
          .limit(1)
          .get()

        const firstMessage = messagesSnapshot.docs[0]?.data()
        const preview = firstMessage?.content?.substring(0, 50) || "No messages"

        return {
          id: doc.id,
          title: doc.data().title || `Chat - ${new Date(doc.data().createdAt?.toDate()).toLocaleDateString()}`,
          createdAt: doc.data().createdAt?.toDate() || new Date(),
          preview,
        }
      })
    )

    return Response.json({ chats })
  } catch (error) {
    console.error("Error fetching data:", error)
    return Response.json({ error: "Failed to fetch data" }, { status: 500 })
  }
}

// POST /api/huggingface - Send message and get response
export async function POST(req: Request) {
  try {
    const { messages, chatId } = await req.json()
    const lastUserMessage = messages?.filter((m: any) => m.role === "user").pop()?.content ?? ""
    if (!lastUserMessage) return new Response("Invalid input", { status: 400 })

    // 1. Context & History Retrieval
    let historyContext = ""
    let previousSymbol = null
    let chatExists = false

    if (chatId) {
      try {
        const chatDoc = await db.collection("chats").doc(chatId).get()
        chatExists = chatDoc.exists
      } catch {
        chatExists = false
      }

      const historySnapshot = await db
        .collection("chats")
        .doc(chatId)
        .collection("messages")
        .orderBy("createdAt", "desc")
        .limit(10)
        .get()

      const historyDocs = historySnapshot.docs.reverse()
      historyContext = historyDocs
        .map(d => `${d.data().role.toUpperCase()}: ${d.data().content}`)
        .join("\n")

      for (let i = historyDocs.length - 1; i >= 0; i--) {
        const found = extractTicker(historyDocs[i].data().content)
        if (found) { previousSymbol = found; break }
      }
    }

    // 2. State Resolution
    const activeSymbol = extractTicker(lastUserMessage) || previousSymbol
    const [stockData, sentiment] = await Promise.all([
      activeSymbol ? fetchStockData(activeSymbol) : Promise.resolve(null),
      analyzeSentiment(lastUserMessage)
    ])

    // 3. Polished Prompt
    const prompt = `
Role: Expert Stock Market Analyst (NSE/BSE).
Context: ${historyContext ? "Ongoing chat session." : "New conversation."}
Status: Ticker: ${activeSymbol || "None identified"} | Data: ${JSON.stringify(stockData) || "No live data available"} | User Sentiment: ${sentiment}

USER REQUEST: "${lastUserMessage}"

INSTRUCTIONS:
- Strictly answer only stock market or financial education queries.
- Refer to ${activeSymbol || "the requested stock"} if the user says "it" or "this" otherwise ignore its usage at all times.
- Required Response Structure when user refers to ${activeSymbol}: 
  1. Current Price
  2. Trend Analysis
  3. Levels (Support/Resistance)
  4. Risk Assessment
  5. Investment View
- Use Indian terminology (Lakhs/Crores) and professional tone.
- Answer the queries the user has regarding the stock market. Do not use ${activeSymbol} for general stock market queries it is not required.
- Keep the answer short but detailed.
`.trim()

    // 4. AI Generation
    const { text: finalText } = await generateText({
      model: hf("meta-llama/Llama-3.1-8B-Instruct"),
      prompt,
      temperature: 0.8,
    })

    // 5. Background Save with Chat Creation
    if (chatId) {
      const batch = db.batch()
      const chatRef = db.collection("chats").doc(chatId)
      const msgCol = chatRef.collection("messages")

      // Create chat document if it doesn't exist
      if (!chatExists) {
        const title = await generateChatTitle(lastUserMessage)
        batch.set(chatRef, {
          title,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        })
      } else {
        // Update the updatedAt timestamp
        batch.update(chatRef, {
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        })
      }

      const entries = [
        { role: "user", content: lastUserMessage },
        { role: "assistant", content: finalText }
      ]
      
      entries.forEach(entry => {
        batch.set(msgCol.doc(), {
          ...entry,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        })
      })
      await batch.commit()
    }

    // 6. Streaming Simulation
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "start" })}\n\n`))
        const tokens = finalText.split(/(\s+)/)
        for (const token of tokens) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "token", text: token })}\n\n`))
          await new Promise(r => setTimeout(r, 10))
        }
        controller.enqueue(encoder.encode(`data: [DONE]\n\n`))
        controller.close()
      },
    })

    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    })
  } catch (err) {
    console.error(err)
    return new Response("Internal Error", { status: 500 })
  }
}

// DELETE /api/huggingface - Delete a specific chat
export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url)
    const chatId = url.searchParams.get("chatId")

    if (!chatId) {
      return Response.json({ error: "Chat ID is required" }, { status: 400 })
    }

    // Get all messages in the chat
    const messagesSnapshot = await db
      .collection("chats")
      .doc(chatId)
      .collection("messages")
      .get()

    // Delete all messages
    const batch = db.batch()
    messagesSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref)
    })
    await batch.commit()

    // Delete the chat document
    await db.collection("chats").doc(chatId).delete()

    return Response.json({ success: true })
  } catch (error) {
    console.error("Error deleting chat:", error)
    return Response.json({ error: "Failed to delete chat" }, { status: 500 })
  }
}
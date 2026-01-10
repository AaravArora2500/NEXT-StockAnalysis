"use client"

import { useState, useRef, useEffect } from "react"
import { Send, Loader2, Bot, User, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
}

const EXAMPLE_QUERIES = [
  "Analyze RELIANCE stock price trends",
  "What's the current price of TCS?",
  "Give me a financial summary of INFOSYS",
  "How is ICICIBANK performing?",
]

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [chatId] = useState(() => `chat_${Date.now()}`)

  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      )
      if (scrollElement) {
        setTimeout(() => {
          scrollElement.scrollTop = scrollElement.scrollHeight
        }, 0)
      }
    }
  }, [messages])

  const handleSubmit = async (e: React.FormEvent, messageText?: string) => {
    e.preventDefault()

    const textToSend = messageText || input.trim()

    if (!textToSend || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: textToSend,
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)
    setError(null)

    try {
      console.log("[CLIENT] Sending message:", textToSend)

      const response = await fetch("/api/huggingface", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chatId,
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      })

      console.log("[CLIENT] Response status:", response.status)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error("[CLIENT] API error:", response.status, errorData)
        throw new Error(
          `API error ${response.status}: ${errorData.error || response.statusText}`
        )
      }

      // Parse the response as a simple text stream
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error("No response body from server")
      }

      console.log("[CLIENT] Stream started...")

      let fullContent = ""
      const assistantId = `assistant_${Date.now()}`

      // Create placeholder for assistant message
      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: "assistant",
          content: "",
        },
      ])

      let chunkCount = 0

      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          console.log("[CLIENT] Stream completed, chunks:", chunkCount)
          break
        }

        chunkCount++
        const chunk = decoder.decode(value, { stream: true })
        fullContent += chunk

        console.log(
          `[CLIENT] Chunk ${chunkCount}: ${chunk.length} chars, total: ${fullContent.length}`
        )

        // Update message in real-time
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: fullContent } : m
          )
        )
      }

      console.log("[CLIENT] Final content:", fullContent.substring(0, 100))
    } catch (err) {
      console.error("[CLIENT] Error:", err)
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred"
      setError(errorMessage)

      // Remove the placeholder assistant message on error
      setMessages((prev) =>
        prev.filter((m) => !(m.role === "assistant" && m.content === ""))
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as any)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-950 dark:to-gray-900">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-4 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-blue-700">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Stock Analysis Assistant
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Real-time BSE stock analysis and financial insights
            </p>
          </div>
        </div>
      </header>

      <ScrollArea className="flex-1 px-4 py-8" ref={scrollAreaRef}>
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-600 to-blue-700 mb-4">
                <TrendingUp className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                Welcome to Stock Analysis
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-8">
                Ask me about any BSE stock for real-time analysis and financial summaries
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {EXAMPLE_QUERIES.map((query, idx) => (
                  <button
                    key={idx}
                    onClick={(e) => handleSubmit(e as any, query)}
                    disabled={isLoading}
                    className="text-left p-4 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors text-sm text-gray-700 dark:text-gray-300"
                  >
                    {query}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-4 ${
                message.role === "user" ? "flex-row-reverse" : "flex-row"
              }`}
            >
              <Avatar className="w-8 h-8 mt-1 flex-shrink-0">
                <AvatarFallback
                  className={
                    message.role === "user"
                      ? "bg-gradient-to-br from-slate-500 to-slate-600"
                      : "bg-gradient-to-br from-blue-600 to-blue-700"
                  }
                >
                  {message.role === "user" ? (
                    <User className="w-4 h-4 text-white" />
                  ) : (
                    <Bot className="w-4 h-4 text-white" />
                  )}
                </AvatarFallback>
              </Avatar>

              <div
                className={`flex-1 ${
                  message.role === "user" ? "flex justify-end" : ""
                }`}
              >
                <div
                  className={`rounded-2xl px-4 py-3 max-w-[85%] ${
                    message.role === "user"
                      ? "bg-blue-600 dark:bg-blue-700 text-white rounded-br-none"
                      : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-bl-none"
                  }`}
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    className={`prose prose-sm max-w-none ${
                      message.role === "user"
                        ? "text-white"
                        : "dark:prose-invert"
                    }`}
                    components={{
                      p: ({ children }) => (
                        <p className="mb-2 last:mb-0 text-sm">{children}</p>
                      ),
                      h2: ({ children }) => (
                        <h2 className="font-bold text-base mt-3 mb-2">
                          {children}
                        </h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className="font-semibold text-base mt-3 mb-2">
                          {children}
                        </h3>
                      ),
                      strong: ({ children }) => (
                        <strong className="font-semibold">{children}</strong>
                      ),
                      code: ({ inline, children, ...props }: any) =>
                        inline ? (
                          <code
                            className={`px-2 py-1 rounded text-xs font-mono ${
                              message.role === "user"
                                ? "bg-blue-500 bg-opacity-50"
                                : "bg-gray-200 dark:bg-gray-700"
                            }`}
                            {...props}
                          >
                            {children}
                          </code>
                        ) : (
                          <pre className="p-3 rounded bg-gray-100 dark:bg-gray-900 text-xs overflow-x-auto my-2">
                            <code {...props}>{children}</code>
                          </pre>
                        ),
                      ul: ({ children }) => (
                        <ul className="list-disc list-inside my-2 space-y-1">
                          {children}
                        </ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="list-decimal list-inside my-2 space-y-1">
                          {children}
                        </ol>
                      ),
                      li: ({ children }) => <li className="text-sm">{children}</li>,
                      table: ({ children }) => (
                        <div className="overflow-x-auto my-2">
                          <table className="text-xs border-collapse">
                            {children}
                          </table>
                        </div>
                      ),
                      th: ({ children }) => (
                        <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 font-semibold">
                          {children}
                        </th>
                      ),
                      td: ({ children }) => (
                        <td className="border border-gray-300 dark:border-gray-600 px-2 py-1">
                          {children}
                        </td>
                      ),
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-4">
              <Avatar className="w-8 h-8 mt-1 flex-shrink-0">
                <AvatarFallback className="bg-gradient-to-br from-blue-600 to-blue-700">
                  <Bot className="w-4 h-4 text-white" />
                </AvatarFallback>
              </Avatar>
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-400">
              <p className="font-semibold">Error</p>
              <p className="text-sm">{error}</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-4 shadow-md">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          <div className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about a stock... (e.g., 'Analyze RELIANCE' or 'Price of TCS')"
                className="min-h-[60px] max-h-[200px] resize-none pr-12 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                disabled={isLoading}
              />
            </div>
            <Button
              type="submit"
              size="icon"
              disabled={isLoading || !input.trim()}
              className="h-[60px] w-[60px] rounded-full bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
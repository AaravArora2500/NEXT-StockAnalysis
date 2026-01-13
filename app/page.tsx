"use client"

import { useRef, useEffect, useState } from "react"
import { Send, Loader2, TrendingUp, ArrowRight, Menu, X, Trash2, Plus } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

const EXAMPLE_QUERIES = [
  "Analyze RELIANCE stock price trends",
  "What's the current price of TCS?",
  "Give me a financial summary of INFOSYS",
  "How is ICICIBANK performing?",
]

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
}

interface ChatHistory {
  id: string
  title: string
  createdAt: string
  preview: string
}

export default function ChatPage() {
  const [chatId, setChatId] = useState(() => `chat_${Date.now()}`)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [chatHistory, setChatHistory] = useState<ChatHistory[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const [showScrollbar, setShowScrollbar] = useState(false)

  useEffect(() => {
    fetchChatHistory()
    
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
      setSidebarOpen(window.innerWidth >= 768)
    }
    
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (scrollAreaRef.current) {
        scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
      }
    }, 0)
    return () => clearTimeout(timer)
  }, [messages])

  const handleScroll = () => {
    if (scrollAreaRef.current) {
      const { scrollHeight, clientHeight, scrollTop } = scrollAreaRef.current
      const isScrollable = scrollHeight > clientHeight
      setShowScrollbar(isScrollable)
    }
  }

  useEffect(() => {
    const scrollArea = scrollAreaRef.current
    if (scrollArea) {
      scrollArea.addEventListener("scroll", handleScroll)
      handleScroll()
      return () => scrollArea.removeEventListener("scroll", handleScroll)
    }
  }, [messages])

  const fetchChatHistory = async () => {
    try {
      setIsLoadingHistory(true)
      const response = await fetch("/api/huggingface")
      if (!response.ok) throw new Error("Failed to fetch history")
      const data = await response.json()
      setChatHistory(data.chats || [])
    } catch (error) {
      console.error("Error fetching chat history:", error)
      setChatHistory([])
    } finally {
      setIsLoadingHistory(false)
    }
  }

  const loadChat = async (id: string) => {
    try {
      const response = await fetch(`/api/huggingface?chatId=${id}`)
      if (!response.ok) throw new Error("Failed to load chat")
      const data = await response.json()
      setChatId(id)
      setMessages(data.messages || [])
      if (isMobile) setSidebarOpen(false)
    } catch (error) {
      console.error("Error loading chat:", error)
    }
  }

  const deleteChat = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    try {
      const response = await fetch(`/api/huggingface?chatId=${id}`, { method: "DELETE" })
      if (!response.ok) throw new Error("Failed to delete chat")
      setChatHistory(prev => prev.filter(chat => chat.id !== id))
      if (chatId === id) {
        setChatId(`chat_${Date.now()}`)
        setMessages([])
      }
    } catch (error) {
      console.error("Error deleting chat:", error)
    }
  }

  const startNewChat = () => {
    setChatId(`chat_${Date.now()}`)
    setMessages([])
    if (isMobile) setSidebarOpen(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: input,
    }
    const userInput = input
    setMessages(prev => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    try {
      const apiMessages = [
        ...messages,
        { role: "user", content: userInput },
      ]

      const response = await fetch("/api/huggingface", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          chatId,
        }),
      })

      if (!response.ok) throw new Error(`API error: ${response.status}`)

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let assistantContent = ""
      const assistantMessageId = crypto.randomUUID()

      setMessages(prev => [
        ...prev,
        {
          id: assistantMessageId,
          role: "assistant",
          content: "",
        },
      ])

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        
        const chunk = decoder.decode(value)
        const lines = chunk.split("\n")
        
        for (const line of lines) {
          if (!line.startsWith("data:")) continue
          
          const raw = line.replace("data:", "").trim()
          if (!raw || raw === "[DONE]") {
            setIsLoading(false)
            fetchChatHistory()
            return
          }
          
          let payload
          try {
            payload = JSON.parse(raw)
          } catch {
            continue
          }
          
          if (payload.type === "token") {
            assistantContent += payload.text
            setMessages(prev =>
              prev.map(m =>
                m.id === assistantMessageId
                  ? { ...m, content: assistantContent }
                  : m
              )
            )
          }
        }
      }

    } catch (error) {
      console.error("Chat error:", error)
      setMessages(prev => [
        ...prev,
        {
          id: `msg_${Date.now()}_error`,
          role: "assistant",
          content: `Error: ${error instanceof Error ? error.message : "Failed to get response"}`,
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleAppend = (content: string) => {
    setInput(content)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as any)
    }
  }

  return (
    <div className="flex w-screen h-screen bg-slate-950" style={{
      scrollbarWidth: showScrollbar ? 'auto' : 'none',
    }}>
      {/* Sidebar */}
      <div className={`${sidebarOpen ? "w-64" : "w-0"} transition-all duration-300 border-r border-slate-800/50 bg-slate-900/50 backdrop-blur-sm flex flex-col overflow-hidden flex-shrink-0 mt-16`}>
        <div className="p-4 border-b border-slate-800/50">
          <button
            onClick={startNewChat}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-medium hover:shadow-lg hover:shadow-emerald-500/30 transition-all duration-200"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-2">
            {isLoadingHistory ? (
              <div className="text-center py-8">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-400 mx-auto" />
              </div>
            ) : chatHistory.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">No chat history yet</p>
            ) : (
              chatHistory.map(chat => (
                <div
                  key={chat.id}
                  onClick={() => loadChat(chat.id)}
                  className="group p-3 rounded-lg bg-slate-800/30 hover:bg-slate-800/50 cursor-pointer transition-all duration-200 border border-slate-800/30 hover:border-emerald-500/30"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-slate-200 truncate group-hover:text-emerald-400 transition-colors">
                        {chat.title}
                      </h3>
                      <p className="text-xs text-slate-500 truncate mt-1">
                        {chat.preview}
                      </p>
                      <p className="text-xs text-slate-600 mt-2">
                        {new Date(chat.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={(e) => deleteChat(e, chat.id)}
                      className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-all flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col w-full h-full bg-slate-950 relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
          <div className="absolute top-0 -left-40 w-80 h-80 bg-emerald-500/10 rounded-full mix-blend-multiply filter blur-3xl animate-pulse" />
          <div className="absolute -bottom-8 right-40 w-80 h-80 bg-cyan-500/10 rounded-full mix-blend-multiply filter blur-3xl animate-pulse delay-2000" />
        </div>

        {/* Header with Toggle */}
        <div className="border-b border-slate-800/50 bg-slate-950/50 backdrop-blur-xl flex-shrink-0">
          <div className="w-full px-4 sm:px-6 py-4 flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-slate-800/50 rounded-lg transition-colors md:hidden"
            >
              {sidebarOpen ? (
                <X className="w-6 h-6 text-slate-300" />
              ) : (
                <Menu className="w-6 h-6 text-slate-300" />
              )}
            </button>
            <h1 className="text-lg font-bold bg-gradient-to-r from-emerald-400 via-cyan-400 to-emerald-500 bg-clip-text text-transparent">
              MarketVista
            </h1>
            <div className="w-10" />
          </div>
        </div>

        {/* Chat Area */}
        <div 
          className="flex-1 overflow-y-auto" 
          ref={scrollAreaRef}
          style={{
            scrollbarWidth: showScrollbar ? 'thin' : 'none',
            scrollbarColor: showScrollbar ? '#10b981 #1e293b' : 'transparent transparent'
          }}
        >
          <style>{`
            div::-webkit-scrollbar {
              width: ${showScrollbar ? '8px' : '0px'};
              transition: width 0.3s;
            }
            div::-webkit-scrollbar-track {
              background: transparent;
            }
            div::-webkit-scrollbar-thumb {
              background: ${showScrollbar ? '#10b981' : 'transparent'};
              border-radius: 4px;
            }
            div::-webkit-scrollbar-thumb:hover {
              background: ${showScrollbar ? '#059669' : 'transparent'};
            }
          `}</style>
          <div className="w-full px-4 sm:px-6 py-8 space-y-6">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center min-h-full text-center space-y-8">
                <div className="space-y-4">
                  <div className="inline-flex items-center justify-center p-4 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 rounded-2xl backdrop-blur-sm">
                    <TrendingUp className="w-10 h-10 text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-emerald-400 via-cyan-400 to-emerald-500 bg-clip-text text-transparent mb-3">
                      Market Intelligence
                    </h2>
                    <p className="text-slate-400 text-lg max-w-2xl mx-auto">
                      Unlock real-time insights on Indian equities with AI-powered analysis
                    </p>
                  </div>
                </div>

                <div className="w-full max-w-3xl space-y-3">
                  <p className="text-sm text-slate-500 font-medium">Popular queries:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {EXAMPLE_QUERIES.map((query) => (
                      <button
                        key={query}
                        onClick={() => handleAppend(query)}
                        className="group text-left p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-emerald-500/60 hover:bg-slate-900/80 backdrop-blur-sm transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/10"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-sm text-slate-300 group-hover:text-emerald-300 transition-colors">
                            {query}
                          </span>
                          <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-emerald-400 flex-shrink-0 mt-0.5 transition-all duration-300 group-hover:translate-x-1" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} className={`flex gap-4 animate-in fade-in slide-in-from-bottom-3 ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                <div className={`w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center text-xs font-bold shadow-lg ${
                  m.role === "user" 
                    ? "bg-gradient-to-br from-emerald-500 to-cyan-500 text-white" 
                    : "bg-slate-800 border border-slate-700 text-slate-300"
                }`}>
                  {m.role === "user" ? "You" : "AI"}
                </div>

                <div
                  className={`rounded-2xl px-5 py-3.5 max-w-[85%] sm:max-w-[75%] ${
                    m.role === "user"
                      ? "bg-gradient-to-br from-emerald-600 to-cyan-600 text-white shadow-lg shadow-emerald-500/20"
                      : "bg-slate-900/80 border border-slate-800/50 text-slate-100 backdrop-blur-sm hover:border-slate-700/50 transition-colors"
                  }`}
                >
                  <div className="prose prose-invert max-w-none text-sm prose-p:my-2 prose-headings:my-3">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {m.content}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-4 animate-in fade-in">
                <div className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center bg-slate-800 border border-slate-700">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-400 bg-slate-900/80 rounded-2xl px-5 py-3.5 backdrop-blur-sm border border-slate-800/50">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                  <span>Analyzing market data</span>
                  <span className="animate-bounce">.</span>
                  <span className="animate-bounce delay-100">.</span>
                  <span className="animate-bounce delay-200">.</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Input Footer */}
        <footer className="border-t border-slate-800/50 bg-slate-950/50 backdrop-blur-xl flex-shrink-0">
          <div className="w-full px-4 sm:px-6 py-4">
            <div className="flex gap-3">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about stock trends, valuations, performance..."
                className="min-h-[56px] resize-none bg-slate-900/80 border border-slate-800 text-white placeholder:text-slate-600 focus:border-emerald-500/50 focus:ring-emerald-500/20 focus:ring-2 rounded-xl transition-all duration-200 backdrop-blur-sm p-4 flex-1 focus:outline-none"
                onKeyDown={handleKeyDown}
              />
              <button
                onClick={(e: any) => handleSubmit(e)}
                disabled={isLoading || !input.trim()}
                className="h-14 w-14 rounded-xl flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-emerald-500 to-cyan-500 text-white hover:shadow-lg hover:shadow-emerald-500/40 disabled:bg-slate-700 disabled:text-slate-500 disabled:shadow-none transition-all duration-200 hover:scale-105 active:scale-95 disabled:cursor-not-allowed font-semibold"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
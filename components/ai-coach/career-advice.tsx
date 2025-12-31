"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { TextStreamChatTransport, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Send,
  Bot,
  User,
  Loader2,
  Briefcase,
  Plus,
  MessageSquare,
  MoreVertical,
  Trash2,
  Pencil,
  RefreshCw,
  Square,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/types";

interface ConversationWithPreview extends Conversation {
  preview?: string;
}

export function CareerAdvice() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState<ConversationWithPreview[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState("");
  const [loadError, setLoadError] = useState<{ message: string; code?: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [chatInput, setChatInput] = useState("");
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([]);

  // Store the conversation ID ref to capture from response headers
  const pendingConversationIdRef = useRef<string | null>(null);
  const activeConversationIdRef = useRef<string | null>(null);
  const hasLoadedFromUrlRef = useRef(false);

  // Keep ref in sync with state
  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  // Fetch all conversations
  const fetchConversations = useCallback(async () => {
    try {
      const response = await fetch("/api/ai-coach/conversations", {
        credentials: "include",
      });

      if (response.ok) {
        const { conversations: convs } = await response.json();
        setConversations(convs || []);
      }
    } catch (err) {
      console.error("Failed to fetch conversations:", err);
    } finally {
      setIsLoadingConversations(false);
    }
  }, []);

  // Memoize the transport (no dependencies since we use refs for dynamic values)
  const transport = useMemo(() => {
    return new TextStreamChatTransport({
      api: "/api/ai-coach/career-advice",
      credentials: "include",
      body: (messages: UIMessage[]) => ({
        messages,
        conversationId: activeConversationIdRef.current,
      }),
      // Custom fetch to capture conversation ID from response headers
      fetch: async (input, init) => {
        const response = await fetch(input, init);

        // Capture conversation ID from headers for new conversations
        const newConversationId = response.headers.get("X-Conversation-Id");
        if (newConversationId && !activeConversationIdRef.current) {
          pendingConversationIdRef.current = newConversationId;
        }

        return response;
      },
    });
  }, []); // Empty deps - we use refs to get current values

  const {
    messages,
    sendMessage,
    setMessages,
    status,
    error,
    reload,
    stop,
  } = useChat({
    transport,
    onFinish: async ({ message }) => {
      // Update conversation ID if we got a new one
      if (pendingConversationIdRef.current) {
        const newConvId = pendingConversationIdRef.current;
        setActiveConversationId(newConvId);
        pendingConversationIdRef.current = null;

        // Update URL with new conversation ID
        const params = new URLSearchParams(searchParams.toString());
        params.set("conversation", newConvId);
        router.push(`?${params.toString()}`, { scroll: false });
      }
      // Refresh conversations to update the title and order
      await fetchConversations();

      // Generate contextual follow-up suggestions
      const messageContent = message.parts
        ?.filter((part): part is { type: "text"; text: string } => part.type === "text")
        .map((part) => part.text)
        .join("") || "";

      if (messageContent) {
        generateSuggestedPrompts(messageContent);
      }
    },
    onError: (err) => {
      console.error("Chat error:", err);
      // Error is automatically set in the error object from useChat
    },
  });

  const isLoading = status === "streaming" || status === "submitted";

  // Generate contextual suggested prompts based on AI response
  const generateSuggestedPrompts = (aiResponse: string) => {
    const lowerResponse = aiResponse.toLowerCase();
    const suggestions: string[] = [];

    // Keyword-based contextual suggestions
    const suggestionMap: Record<string, string[]> = {
      resume: [
        "How can I tailor my resume for ATS systems?",
        "What are common resume mistakes to avoid?",
      ],
      interview: [
        "What should I wear to an interview?",
        "How do I answer 'Tell me about yourself'?",
      ],
      salary: [
        "When is the right time to negotiate salary?",
        "How do I research salary ranges for my role?",
      ],
      "career change": [
        "How do I explain a career change to employers?",
        "What skills are transferable across industries?",
      ],
      networking: [
        "How do I network effectively on LinkedIn?",
        "What's the best way to follow up after networking?",
      ],
      skill: [
        "How do I identify skill gaps in my career?",
        "What are the most in-demand skills right now?",
      ],
    };

    // Find matching keywords and add relevant suggestions
    for (const [keyword, prompts] of Object.entries(suggestionMap)) {
      if (lowerResponse.includes(keyword)) {
        suggestions.push(...prompts);
      }
    }

    // Default suggestions if no keywords match
    if (suggestions.length === 0) {
      suggestions.push(
        "How can I stand out in a competitive job market?",
        "What are red flags to watch for in job postings?",
        "How do I build my personal brand?"
      );
    }

    // Limit to 3 unique suggestions
    const uniqueSuggestions = [...new Set(suggestions)].slice(0, 3);
    setSuggestedPrompts(uniqueSuggestions);
  };

  // Handle clicking a suggested prompt
  const handleSuggestedPrompt = (prompt: string) => {
    setChatInput(prompt);
    setSuggestedPrompts([]);
  };

  // Handle regenerate - remove last assistant message and resend last user message
  const handleRegenerate = async () => {
    if (messages.length < 2) return;

    // Find the last user message
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUserMessage) return;

    // Extract text from the message
    const messageText = lastUserMessage.parts
      ?.filter((part): part is { type: "text"; text: string } => part.type === "text")
      .map((part) => part.text)
      .join("") || "";

    if (!messageText) return;

    // Remove the last assistant message
    const newMessages = messages.slice(0, -1);
    setMessages(newMessages);
    setSuggestedPrompts([]);

    try {
      await sendMessage({ text: messageText });
    } catch (err) {
      console.error("Failed to regenerate message:", err);
      // Restore messages on error
      setMessages(messages);
    }
  };

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isLoading) return;

    const messageText = chatInput;
    setChatInput("");
    setLoadError(null);
    setSuggestedPrompts([]);

    try {
      await sendMessage({ text: messageText });
    } catch (err) {
      console.error("Failed to send message:", err);
      setChatInput(messageText); // Restore input on error
    }
  };

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setChatInput(e.target.value);
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load conversations on mount
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Load messages for a specific conversation
  const loadConversation = useCallback(
    async (conversationId: string, updateUrl = true) => {
      if (conversationId === activeConversationId) return;

      setIsLoadingMessages(true);
      setLoadError(null);

      try {
        const response = await fetch(`/api/ai-coach/conversations/${conversationId}`, {
          credentials: "include",
        });

        if (response.ok) {
          const { messages: convMessages } = await response.json();
          // Convert to the format expected by useChat (UIMessage format)
          const formattedMessages: UIMessage[] = (convMessages || []).map(
            (msg: { id: string; content: string; is_user: boolean; created_at: string }) => ({
              id: msg.id,
              role: msg.is_user ? "user" : "assistant",
              parts: [{ type: "text" as const, text: msg.content }],
              createdAt: new Date(msg.created_at),
            })
          );
          setMessages(formattedMessages);
          setActiveConversationId(conversationId);

          // Update URL to maintain state on refresh
          if (updateUrl) {
            const params = new URLSearchParams(searchParams.toString());
            params.set("conversation", conversationId);
            router.push(`?${params.toString()}`, { scroll: false });
          }
        } else {
          setLoadError({
            message: "Failed to load conversation",
            code: "CONVERSATION_LOAD_FAILED",
          });
        }
      } catch (err) {
        console.error("Failed to load conversation:", err);
        setLoadError({
          message: "Failed to load conversation. Please try again.",
          code: "CONVERSATION_LOAD_ERROR",
        });
      } finally {
        setIsLoadingMessages(false);
      }
    },
    // setMessages is from useChat and is guaranteed to be stable by the SDK
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeConversationId, router, searchParams]
  );

  // Restore conversation from URL on mount
  useEffect(() => {
    // Only load from URL once on initial mount
    if (hasLoadedFromUrlRef.current) return;

    const conversationId = searchParams.get("conversation");
    if (conversationId && conversations.length > 0) {
      // Verify the conversation exists before loading
      const conversationExists = conversations.some((c) => c.id === conversationId);
      if (conversationExists) {
        loadConversation(conversationId, false);
        hasLoadedFromUrlRef.current = true;
      }
    }
  }, [searchParams, conversations, loadConversation]);

  // Start a new conversation
  const startNewConversation = () => {
    setActiveConversationId(null);
    setMessages([]);
    setLoadError(null);
    setSuggestedPrompts([]);
    pendingConversationIdRef.current = null;

    // Clear conversation parameter but keep tab parameter
    const params = new URLSearchParams(searchParams.toString());
    params.delete("conversation");
    router.push(`?${params.toString()}`, { scroll: false });
  };

  // Delete a conversation
  const deleteConversation = async (conversationId: string) => {
    try {
      const response = await fetch(`/api/ai-coach/conversations/${conversationId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (response.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== conversationId));
        if (activeConversationId === conversationId) {
          // Clear the conversation and update URL
          startNewConversation();
        }
      }
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    }
    setDeleteDialogOpen(false);
    setConversationToDelete(null);
  };

  // Rename a conversation
  const renameConversation = async (conversationId: string, newTitle: string) => {
    try {
      const response = await fetch(`/api/ai-coach/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: newTitle }),
      });

      if (response.ok) {
        setConversations((prev) =>
          prev.map((c) => (c.id === conversationId ? { ...c, title: newTitle } : c))
        );
      }
    } catch (err) {
      console.error("Failed to rename conversation:", err);
    }
    setEditingTitle(null);
    setEditTitleValue("");
  };

  const handleEditTitleKeyDown = (e: React.KeyboardEvent, conversationId: string) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (editTitleValue.trim()) {
        renameConversation(conversationId, editTitleValue.trim());
      }
    } else if (e.key === "Escape") {
      setEditingTitle(null);
      setEditTitleValue("");
    }
  };

  return (
    <div className="flex gap-6 h-[calc(100vh-12rem)]">
      {/* Sidebar */}
      <Card className="w-72 flex flex-col shrink-0">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Conversations</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={startNewConversation}
              title="New conversation"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-2">
          {isLoadingConversations ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : conversations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No conversations yet
            </p>
          ) : (
            <div className="space-y-1">
              {conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={cn(
                    "group flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer hover:bg-muted",
                    activeConversationId === conversation.id && "bg-muted"
                  )}
                  onClick={() => loadConversation(conversation.id)}
                >
                  <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                  {editingTitle === conversation.id ? (
                    <Input
                      value={editTitleValue}
                      onChange={(e) => setEditTitleValue(e.target.value)}
                      onKeyDown={(e) => handleEditTitleKeyDown(e, conversation.id)}
                      onBlur={() => {
                        if (editTitleValue.trim()) {
                          renameConversation(conversation.id, editTitleValue.trim());
                        } else {
                          setEditingTitle(null);
                        }
                      }}
                      className="h-6 px-1 py-0 text-sm"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="truncate flex-1">
                      {conversation.title || "New Conversation"}
                    </span>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingTitle(conversation.id);
                          setEditTitleValue(conversation.title || "");
                        }}
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConversationToDelete(conversation.id);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header Card */}
        <Card className="mb-4">
          <CardHeader className="py-4">
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              AI Career Coach
            </CardTitle>
            <CardDescription>
              Get personalized career advice and guidance through interactive chat
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Chat Interface Card */}
        <Card className="flex-1 flex flex-col min-h-0">
          <CardContent className="flex-1 overflow-y-auto p-6">
            {isLoadingMessages ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading messages...</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-8 space-y-4">
                <p className="text-muted-foreground">
                  Welcome to your AI Career Coach! Ask me anything about your career.
                </p>
                <div className="text-sm text-muted-foreground space-y-2 max-w-md mx-auto">
                  <p className="font-medium">Example questions:</p>
                  <div className="space-y-1 text-left bg-muted/50 rounded-lg p-4">
                    <p>- How can I improve my resume for tech roles?</p>
                    <p>- What skills should I learn for data science?</p>
                    <p>- How do I negotiate a better salary?</p>
                    <p>- Tips for transitioning to product management?</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message, index) => {
                  const isLastMessage = index === messages.length - 1;
                  const isLastAssistantMessage = message.role === "assistant" && isLastMessage;

                  return (
                    <div key={message.id}>
                      <div
                        className={cn(
                          "flex gap-3",
                          message.role === "user" ? "justify-end" : "justify-start"
                        )}
                      >
                        {message.role === "assistant" && (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center flex-shrink-0">
                            <Bot className="h-5 w-5 text-white" />
                          </div>
                        )}
                        <div
                          className={cn(
                            "max-w-[80%] rounded-lg px-4 py-2",
                            message.role === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          )}
                        >
                          <ReactMarkdown
                            className="prose prose-sm max-w-none dark:prose-invert break-words
                              prose-p:my-2 prose-p:leading-relaxed
                              prose-ul:my-2 prose-li:my-1
                              prose-ol:my-2
                              prose-headings:font-semibold prose-headings:my-3
                              prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
                              prose-pre:bg-muted prose-pre:p-3 prose-pre:rounded-lg
                              prose-a:text-primary prose-a:underline prose-a:underline-offset-2
                              prose-strong:font-semibold
                              prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:pl-4 prose-blockquote:italic"
                          >
                            {message.parts
                              ?.filter((part): part is { type: "text"; text: string } => part.type === "text")
                              .map((part) => part.text)
                              .join("") || ""}
                          </ReactMarkdown>
                        </div>
                        {message.role === "user" && (
                          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                            <User className="h-5 w-5 text-primary-foreground" />
                          </div>
                        )}
                      </div>
                      {isLastAssistantMessage && !isLoading && (
                        <div className="flex gap-3 mt-2">
                          <div className="w-8" />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleRegenerate}
                            className="h-8 text-xs text-muted-foreground hover:text-foreground"
                          >
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Regenerate
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {isLoading && (
                  <div className="flex gap-3 justify-start">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center">
                      <Bot className="h-5 w-5 text-white" />
                    </div>
                    <div className="bg-muted rounded-lg px-4 py-2">
                      <div className="flex space-x-2">
                        <span className="w-2 h-2 bg-foreground/60 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                        <span className="w-2 h-2 bg-foreground/60 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                        <span className="w-2 h-2 bg-foreground/60 rounded-full animate-bounce"></span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </CardContent>

          {/* Display errors - SDK error takes precedence over load errors */}
          {(error || loadError) && (
            <div className="px-6 py-2 bg-destructive/10 text-destructive text-sm flex items-center justify-between gap-2">
              <div className="flex-1">
                <span>{error?.message || loadError?.message}</span>
                {loadError?.code && (
                  <span className="ml-2 text-xs opacity-75">({loadError.code})</span>
                )}
              </div>
              {error && status === "error" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => reload()}
                  className="h-7 text-xs"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Retry
                </Button>
              )}
              {loadError && !error && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLoadError(null)}
                  className="h-7 text-xs"
                >
                  Dismiss
                </Button>
              )}
            </div>
          )}

          {suggestedPrompts.length > 0 && !isLoading && (
            <div className="px-6 py-3 border-t bg-muted/30">
              <p className="text-xs text-muted-foreground mb-2">Suggested questions:</p>
              <div className="flex flex-wrap gap-2">
                {suggestedPrompts.map((prompt, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => handleSuggestedPrompt(prompt)}
                    className="h-auto py-1.5 px-3 text-xs text-left whitespace-normal"
                  >
                    {prompt}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-6 border-t">
            <div className="flex gap-2">
              <Input
                type="text"
                value={chatInput}
                onChange={handleInputChange}
                placeholder="Ask your career question..."
                disabled={isLoading || isLoadingMessages}
                className="flex-1"
              />
              {isLoading ? (
                <Button
                  type="button"
                  onClick={stop}
                  variant="outline"
                  size="icon"
                  title="Stop generating"
                >
                  <Square className="h-4 w-4" />
                </Button>
              ) : (
                <Button type="submit" disabled={isLoadingMessages || !chatInput.trim()} size="icon">
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>
          </form>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Conversation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this conversation? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => conversationToDelete && deleteConversation(conversationToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

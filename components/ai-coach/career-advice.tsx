"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, Bot, User, Loader2, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  content: string;
  is_user: boolean;
  created_at: string;
}

export function CareerAdvice() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch conversation history
  useEffect(() => {
    async function fetchConversation() {
      try {
        const response = await fetch("/api/ai-coach/career-advice/history", {
          method: "GET",
          credentials: "include",
        });

        if (response.ok) {
          const { messages } = await response.json();
          setMessages(messages || []);
        }
      } catch (error) {
      } finally {
        setIsLoadingHistory(false);
      }
    }

    fetchConversation();
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage,
      is_user: true,
      created_at: new Date().toISOString(),
    };

    // Optimistically update UI
    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);

    try {
      // Call API to get AI response
      const response = await fetch("/api/ai-coach/career-advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: inputMessage,
          conversationHistory: messages.slice(-10).map(msg => ({
            role: msg.is_user ? "user" : "assistant",
            content: msg.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get AI response");
      }

      const data = await response.json();

      // Add AI response to messages
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.response,
        is_user: false,
        created_at: new Date().toISOString(),
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      // Remove the optimistically added message on error
      setMessages(prev => prev.filter(msg => msg.id !== userMessage.id));
      setInputMessage(inputMessage); // Restore input
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Card - matching other tools */}
      <Card>
        <CardHeader>
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
      <Card className="flex flex-col min-h-[400px] sm:min-h-[500px] md:h-[600px]">

        <CardContent className="flex-1 overflow-y-auto p-6">
        {isLoadingHistory ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8 space-y-4">
            <p className="text-muted-foreground">
              Welcome to your AI Career Coach! Ask me anything about your career.
            </p>
            <div className="text-sm text-muted-foreground space-y-2 max-w-md mx-auto">
              <p className="font-medium">Example questions:</p>
              <div className="space-y-1 text-left bg-muted/50 rounded-lg p-4">
                <p>• "How can I improve my resume for tech roles?"</p>
                <p>• "What skills should I learn for data science?"</p>
                <p>• "How do I negotiate a better salary?"</p>
                <p>• "Tips for transitioning to product management?"</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3",
                  message.is_user ? "justify-end" : "justify-start"
                )}
              >
                {!message.is_user && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-5 w-5 text-white" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[80%] rounded-lg px-4 py-2",
                    message.is_user
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  <p className="text-xs opacity-70 mt-1">
                    {new Date(message.created_at).toLocaleTimeString()}
                  </p>
                </div>
                {message.is_user && (
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <User className="h-5 w-5 text-primary-foreground" />
                  </div>
                )}
              </div>
            ))}
            
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

        <form onSubmit={sendMessage} className="p-6 border-t">
        <div className="flex gap-2">
          <Input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Ask your career question..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            type="submit"
            disabled={isLoading || !inputMessage.trim()}
            size="icon"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        </form>
      </Card>
    </div>
  );
}

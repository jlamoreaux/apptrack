"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { MessageSquare, Sparkles, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface InterviewPrepProps {
  userId: string
}

export function InterviewPrep({ userId }: InterviewPrepProps) {
  const [jobDescription, setJobDescription] = useState("")
  const [userBackground, setUserBackground] = useState("")
  const [preparation, setPreparation] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handlePrepare = async () => {
    if (!jobDescription.trim()) {
      setError("Please provide a job description")
      return
    }

    setLoading(true)
    setError("")
    setPreparation("")

    try {
      const response = await fetch("/api/ai-coach/interview-prep", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobDescription: jobDescription.trim(),
          userBackground: userBackground.trim() || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate interview preparation")
      }

      setPreparation(data.preparation)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-blue-600" />
            Interview Preparation
          </CardTitle>
          <CardDescription>
            Get AI-generated interview questions and preparation tips tailored to your target role
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="job-desc">Job Description *</Label>
            <Textarea
              id="job-desc"
              placeholder="Paste the job description here..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              className="min-h-[150px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="background">Your Background (Optional)</Label>
            <Textarea
              id="background"
              placeholder="Briefly describe your relevant experience and skills..."
              value={userBackground}
              onChange={(e) => setUserBackground(e.target.value)}
              className="min-h-[100px]"
            />
            <p className="text-sm text-muted-foreground">This helps generate more personalized questions and advice</p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handlePrepare}
            disabled={loading || !jobDescription.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            {loading ? (
              <>
                <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                Preparing Interview Guide...
              </>
            ) : (
              <>
                <MessageSquare className="h-4 w-4 mr-2" />
                Generate Interview Prep
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {preparation && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-600" />
              Interview Preparation Guide
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none">
              <div className="whitespace-pre-wrap text-sm leading-relaxed">{preparation}</div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

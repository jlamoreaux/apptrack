"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FileText, Sparkles, AlertCircle, Copy } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"

interface CoverLetterGeneratorProps {
  userId: string
}

export function CoverLetterGenerator({ userId }: CoverLetterGeneratorProps) {
  const [jobDescription, setJobDescription] = useState("")
  const [userBackground, setUserBackground] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [coverLetter, setCoverLetter] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const { toast } = useToast()

  const handleGenerate = async () => {
    if (!jobDescription.trim() || !userBackground.trim() || !companyName.trim()) {
      setError("Please fill in all required fields")
      return
    }

    setLoading(true)
    setError("")
    setCoverLetter("")

    try {
      const response = await fetch("/api/ai-coach/cover-letter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobDescription: jobDescription.trim(),
          userBackground: userBackground.trim(),
          companyName: companyName.trim(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate cover letter")
      }

      setCoverLetter(data.coverLetter)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(coverLetter)
      toast({
        title: "Copied!",
        description: "Cover letter copied to clipboard",
      })
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Please copy the text manually",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-green-600" />
            Cover Letter Generator
          </CardTitle>
          <CardDescription>
            Generate a personalized cover letter tailored to the specific job and company
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="company">Company Name *</Label>
              <Input
                id="company"
                placeholder="e.g., Google, Microsoft, Startup Inc."
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="job-desc-cl">Job Description *</Label>
            <Textarea
              id="job-desc-cl"
              placeholder="Paste the job description here..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              className="min-h-[120px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="background-cl">Your Background & Experience *</Label>
            <Textarea
              id="background-cl"
              placeholder="Describe your relevant experience, skills, and achievements..."
              value={userBackground}
              onChange={(e) => setUserBackground(e.target.value)}
              className="min-h-[120px]"
            />
            <p className="text-sm text-muted-foreground">
              Include specific examples and quantifiable achievements when possible
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleGenerate}
            disabled={loading || !jobDescription.trim() || !userBackground.trim() || !companyName.trim()}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            {loading ? (
              <>
                <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                Generating Cover Letter...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Generate Cover Letter
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {coverLetter && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-green-600" />
                Generated Cover Letter
              </CardTitle>
              <Button variant="outline" size="sm" onClick={handleCopy}>
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none">
              <div className="whitespace-pre-wrap text-sm leading-relaxed font-mono bg-muted p-4 rounded-lg">
                {coverLetter}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

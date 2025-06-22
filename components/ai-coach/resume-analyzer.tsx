"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Brain, Sparkles, AlertCircle, Upload, FileText, Link } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface ResumeAnalyzerProps {
  userId: string
}

export function ResumeAnalyzer({ userId }: ResumeAnalyzerProps) {
  const [resumeText, setResumeText] = useState("")
  const [jobDescription, setJobDescription] = useState("")
  const [jobUrl, setJobUrl] = useState("")
  const [analysis, setAnalysis] = useState("")
  const [loading, setLoading] = useState(false)
  const [uploadLoading, setUploadLoading] = useState(false)
  const [urlLoading, setUrlLoading] = useState(false)
  const [error, setError] = useState("")
  const [inputMethod, setInputMethod] = useState<"text" | "url">("text")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      // 5MB limit
      setError("File size must be less than 5MB")
      return
    }

    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ]

    if (!allowedTypes.includes(file.type)) {
      setError("Please upload a PDF, Word document, or text file")
      return
    }

    setUploadLoading(true)
    setError("")

    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/ai-coach/upload-resume", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to process resume")
      }

      setResumeText(data.text)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload resume")
    } finally {
      setUploadLoading(false)
    }
  }

  const handleUrlFetch = async () => {
    if (!jobUrl.trim()) {
      setError("Please enter a job posting URL")
      return
    }

    setUrlLoading(true)
    setError("")

    try {
      const response = await fetch("/api/ai-coach/fetch-job-description", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: jobUrl.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch job description")
      }

      setJobDescription(data.description)
      setInputMethod("text") // Switch to text view to show the fetched content
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch job description")
    } finally {
      setUrlLoading(false)
    }
  }

  const handleAnalyze = async () => {
    if (!resumeText.trim()) {
      setError("Please provide your resume text or upload a resume file")
      return
    }

    setLoading(true)
    setError("")
    setAnalysis("")

    try {
      const response = await fetch("/api/ai-coach/analyze-resume", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          resumeText: resumeText.trim(),
          jobDescription: jobDescription.trim() || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to analyze resume")
      }

      setAnalysis(data.analysis)
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
            <Brain className="h-5 w-5 text-purple-600" />
            Resume Analysis
          </CardTitle>
          <CardDescription>
            Upload your resume or paste the text below, and optionally include a job description for targeted feedback
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Resume Input */}
          <div className="space-y-4">
            <Label>Resume *</Label>
            <div className="space-y-4">
              {/* File Upload */}
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="space-y-2">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                  <div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadLoading}
                    >
                      {uploadLoading ? (
                        <>
                          <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Upload Resume
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">PDF, Word, or text files up to 5MB</p>
                </div>
              </div>

              {/* Text Input */}
              <div className="space-y-2">
                <Label htmlFor="resume-text">Or paste your resume text</Label>
                <Textarea
                  id="resume-text"
                  placeholder="Paste your resume text here..."
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  className="min-h-[200px]"
                />
              </div>
            </div>
          </div>

          {/* Job Description Input */}
          <div className="space-y-4">
            <Label>Job Description (Optional)</Label>
            <Tabs value={inputMethod} onValueChange={(value) => setInputMethod(value as "text" | "url")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="text" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Paste Text
                </TabsTrigger>
                <TabsTrigger value="url" className="flex items-center gap-2">
                  <Link className="h-4 w-4" />
                  From URL
                </TabsTrigger>
              </TabsList>

              <TabsContent value="text" className="space-y-2">
                <Textarea
                  placeholder="Paste the job description for targeted analysis..."
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  className="min-h-[120px]"
                />
              </TabsContent>

              <TabsContent value="url" className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    placeholder="https://company.com/jobs/position"
                    value={jobUrl}
                    onChange={(e) => setJobUrl(e.target.value)}
                  />
                  <Button onClick={handleUrlFetch} disabled={urlLoading || !jobUrl.trim()} variant="outline">
                    {urlLoading ? <Sparkles className="h-4 w-4 animate-spin" /> : "Fetch"}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Enter a job posting URL to automatically extract the description
                </p>
              </TabsContent>
            </Tabs>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleAnalyze}
            disabled={loading || !resumeText.trim()}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            {loading ? (
              <>
                <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                Analyzing Resume...
              </>
            ) : (
              <>
                <Brain className="h-4 w-4 mr-2" />
                Analyze Resume
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {analysis && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              Analysis Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none">
              <div className="whitespace-pre-wrap text-sm leading-relaxed">{analysis}</div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

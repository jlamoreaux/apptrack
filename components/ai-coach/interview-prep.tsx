"use client"

import type React from "react"
import { useState } from "react"
import { Box, Button, Card, CardContent, TextField, Typography, CircularProgress, Tabs, Tab } from "@mui/material"

interface Props {
  onGenerateQuestions: (jobDescription: string) => void
}

const InterviewPrep: React.FC<Props> = ({ onGenerateQuestions }) => {
  const [jobDescription, setJobDescription] = useState("")
  const [jobUrl, setJobUrl] = useState("")
  const [urlLoading, setUrlLoading] = useState(false)
  const [activeTab, setActiveTab] = useState(0)

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue)
  }

  const handleJobDescriptionChange = (event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    setJobDescription(event.target.value)
  }

  const handleJobUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setJobUrl(event.target.value)
  }

  const handleGenerateQuestions = () => {
    onGenerateQuestions(jobDescription)
  }

  const handleFetchJobDescription = async () => {
    setUrlLoading(true)
    try {
      const response = await fetch(`/api/fetch-url?url=${jobUrl}`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      setJobDescription(data.content)
    } catch (error) {
      console.error("Failed to fetch job description:", error)
      // Optionally display an error message to the user
      setJobDescription("Failed to fetch job description. Please check the URL and try again.")
    } finally {
      setUrlLoading(false)
    }
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" component="div" gutterBottom>
          Interview Preparation
        </Typography>

        <Tabs value={activeTab} onChange={handleTabChange} aria-label="job-description-input">
          <Tab label="Text" />
          <Tab label="URL" />
        </Tabs>

        {activeTab === 0 && (
          <Box mt={2}>
            <TextField
              label="Job Description"
              multiline
              rows={10}
              fullWidth
              variant="outlined"
              value={jobDescription}
              onChange={handleJobDescriptionChange}
            />
          </Box>
        )}

        {activeTab === 1 && (
          <Box mt={2}>
            <TextField
              label="Job Description URL"
              fullWidth
              variant="outlined"
              value={jobUrl}
              onChange={handleJobUrlChange}
            />
            <Button
              variant="contained"
              color="primary"
              onClick={handleFetchJobDescription}
              disabled={urlLoading || !jobUrl}
              style={{ marginTop: "10px" }}
            >
              {urlLoading ? (
                <>
                  Loading...
                  <CircularProgress size={20} color="inherit" style={{ marginLeft: "5px" }} />
                </>
              ) : (
                "Fetch Job Description"
              )}
            </Button>
          </Box>
        )}

        <Box mt={2}>
          <Button variant="contained" color="primary" onClick={handleGenerateQuestions} disabled={!jobDescription}>
            Generate Interview Questions
          </Button>
        </Box>
      </CardContent>
    </Card>
  )
}

export default InterviewPrep

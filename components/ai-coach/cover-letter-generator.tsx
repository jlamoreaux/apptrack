"use client"

import { useState } from "react"
import { Box, Button, Text, Textarea, useToast, Tabs, TabList, TabPanels, Tab, TabPanel, Input } from "@chakra-ui/react"
import { generateCoverLetter } from "../../utils/api"

const CoverLetterGenerator = () => {
  const [jobDescription, setJobDescription] = useState("")
  const [coverLetter, setCoverLetter] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const toast = useToast()
  const [jobDescriptionURL, setJobDescriptionURL] = useState("")
  const [isURLFetching, setIsURLFetching] = useState(false)

  const handleGenerateCoverLetter = async () => {
    setIsLoading(true)
    try {
      const response = await generateCoverLetter(jobDescription)
      setCoverLetter(response.coverLetter)
      toast({
        title: "Cover Letter Generated!",
        description: "Your cover letter has been generated successfully.",
        status: "success",
        duration: 5000,
        isClosable: true,
      })
    } catch (error) {
      console.error("Error generating cover letter:", error)
      toast({
        title: "Error",
        description: "Failed to generate cover letter. Please try again.",
        status: "error",
        duration: 5000,
        isClosable: true,
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleURLFetch = async () => {
    setIsURLFetching(true)
    try {
      const response = await fetch(`/api/fetch-url?url=${jobDescriptionURL}`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()
      setJobDescription(data.content)
      toast({
        title: "Job Description Fetched!",
        description: "Job description fetched successfully from the URL.",
        status: "success",
        duration: 5000,
        isClosable: true,
      })
    } catch (error) {
      console.error("Error fetching URL:", error)
      toast({
        title: "Error",
        description: "Failed to fetch job description from the URL. Please check the URL and try again.",
        status: "error",
        duration: 5000,
        isClosable: true,
      })
    } finally {
      setIsURLFetching(false)
    }
  }

  return (
    <Box p={4}>
      <Text fontSize="xl" fontWeight="bold" mb={4}>
        AI Cover Letter Generator
      </Text>

      <Tabs variant="soft-rounded" colorScheme="green" mb={4}>
        <TabList>
          <Tab>Text Input</Tab>
          <Tab>URL Input</Tab>
        </TabList>
        <TabPanels>
          <TabPanel>
            <Textarea
              placeholder="Enter job description..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              mb={2}
            />
          </TabPanel>
          <TabPanel>
            <Input
              placeholder="Enter job description URL..."
              value={jobDescriptionURL}
              onChange={(e) => setJobDescriptionURL(e.target.value)}
              mb={2}
            />
            <Button colorScheme="teal" size="sm" onClick={handleURLFetch} isLoading={isURLFetching} mb={2}>
              Fetch Job Description
            </Button>
          </TabPanel>
        </TabPanels>
      </Tabs>

      <Button colorScheme="blue" onClick={handleGenerateCoverLetter} isLoading={isLoading} mb={4}>
        Generate Cover Letter
      </Button>

      {coverLetter && (
        <Box mt={4}>
          <Text fontSize="lg" fontWeight="bold">
            Generated Cover Letter:
          </Text>
          <Text whiteSpace="pre-line">{coverLetter}</Text>
        </Box>
      )}
    </Box>
  )
}

export default CoverLetterGenerator

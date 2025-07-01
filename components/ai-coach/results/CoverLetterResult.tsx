/**
 * CoverLetterResult Component
 * 
 * Displays generated cover letter with editing capabilities and export options.
 * Shows sections breakdown, customizations, and provides tools for refinement.
 * 
 * Features:
 * - Editable cover letter content
 * - Section-by-section breakdown with reasoning
 * - Word count and tone indicators
 * - Copy, download, and email functionality
 * - Customization highlights
 */

import { useState, useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  FileText,
  Copy,
  Download,
  Mail,
  Edit3,
  Eye,
  CheckCircle2,
  Lightbulb,
  Target,
  Building
} from "lucide-react"
import { useScreenReaderAnnouncements } from "@/lib/utils/accessibility"
import type { CoverLetterResult } from "@/types/ai-analysis"

interface CoverLetterResultProps {
  analysis: CoverLetterResult
  /** Optional className for styling customization */
  className?: string
  /** Callback when user wants to copy results */
  onCopy?: () => void
  /** Callback when user wants to download results */
  onDownload?: () => void
  /** Callback when user wants to email results */
  onEmail?: () => void
  /** Show action buttons */
  showActions?: boolean
}

export function CoverLetterResult({ 
  analysis, 
  className,
  onCopy,
  onDownload,
  onEmail,
  showActions = true
}: CoverLetterResultProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState(analysis.fullText)
  const [activeTab, setActiveTab] = useState<'preview' | 'sections' | 'details'>('preview')
  const { announceSuccess } = useScreenReaderAnnouncements()

  const currentWordCount = useMemo(() => {
    return editedContent.split(/\s+/).filter(word => word.length > 0).length
  }, [editedContent])

  const getToneColor = (tone: string) => {
    switch (tone) {
      case 'professional': return 'text-blue-600 bg-blue-100'
      case 'enthusiastic': return 'text-green-600 bg-green-100'
      case 'conversational': return 'text-purple-600 bg-purple-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleSaveEdit = () => {
    setIsEditing(false)
    announceSuccess("Cover letter updated successfully")
  }

  const handleCancelEdit = () => {
    setEditedContent(analysis.fullText)
    setIsEditing(false)
    announceSuccess("Edit cancelled")
  }

  const handleCopyLetter = () => {
    navigator.clipboard.writeText(editedContent)
      .then(() => announceSuccess('Cover letter copied to clipboard'))
      .catch(() => announceSuccess('Failed to copy cover letter'))
    onCopy?.()
  }

  return (
    <div className={`space-y-6 ${className || ''}`}>
      {/* Header */}
      <Card>
        <CardHeader className="text-center pb-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            <FileText className="h-6 w-6 text-blue-600" />
            <CardTitle className="text-xl">Cover Letter</CardTitle>
          </div>
          <div className="flex items-center justify-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Badge 
                variant="outline" 
                className={`text-xs ${getToneColor(analysis.tone)}`}
              >
                {analysis.tone}
              </Badge>
              <span>{currentWordCount} words</span>
            </div>
            <span>•</span>
            <span>Generated {formatDate(analysis.generatedAt)}</span>
          </div>
        </CardHeader>
      </Card>

      {/* Main Content Tabs */}
      <Card>
        <CardHeader>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="sections">Sections</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>

        <CardContent>
          <Tabs value={activeTab}>
            {/* Preview Tab */}
            <TabsContent value="preview" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900">Cover Letter Content</h3>
                <div className="flex items-center gap-2">
                  {!isEditing ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditing(true)}
                      className="flex items-center gap-2"
                    >
                      <Edit3 className="h-4 w-4" />
                      Edit
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCancelEdit}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSaveEdit}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Save
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {isEditing ? (
                <Textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  className="min-h-[400px] font-mono text-sm"
                  placeholder="Edit your cover letter content..."
                />
              ) : (
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <div className="whitespace-pre-wrap font-serif text-sm leading-relaxed text-gray-800">
                    {editedContent}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Word count: {currentWordCount}</span>
                {currentWordCount !== analysis.wordCount && (
                  <span className="text-blue-600">Modified from original ({analysis.wordCount} words)</span>
                )}
              </div>
            </TabsContent>

            {/* Sections Tab */}
            <TabsContent value="sections" className="space-y-4">
              <h3 className="font-medium text-gray-900">Letter Breakdown</h3>
              <div className="space-y-4">
                {analysis.sections.map((section, index) => (
                  <Card key={index} className="border-l-4 border-l-blue-500">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {section.type.charAt(0).toUpperCase() + section.type.slice(1)}
                        </Badge>
                        <h4 className="font-medium text-sm">
                          {section.type === 'opening' && 'Opening Paragraph'}
                          {section.type === 'body' && 'Body Paragraphs'}
                          {section.type === 'closing' && 'Closing Paragraph'}
                        </h4>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                          {section.content}
                        </p>
                      </div>
                      <div className="flex items-start gap-2">
                        <Lightbulb className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-gray-600">
                          <strong>Strategy:</strong> {section.reasoning}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Details Tab */}
            <TabsContent value="details" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Key Points */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-green-700 text-base">
                      <CheckCircle2 className="h-5 w-5" />
                      Key Points
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {analysis.keyPoints.map((point, index) => (
                        <div key={index} className="flex items-start gap-3">
                          <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0" />
                          <p className="text-sm text-gray-700">{point}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Company-Specific Customizations */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-blue-700 text-base">
                      <Building className="h-5 w-5" />
                      Company Customizations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {analysis.customizations.companySpecific.map((customization, index) => (
                        <div key={index} className="flex items-start gap-3">
                          <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                          <p className="text-sm text-gray-700">{customization}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Role-Specific Customizations */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-purple-700 text-base">
                      <Target className="h-5 w-5" />
                      Role-Specific Customizations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {analysis.customizations.roleSpecific.map((customization, index) => (
                        <div key={index} className="flex items-start gap-3">
                          <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0" />
                          <p className="text-sm text-gray-700">{customization}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      {showActions && (
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyLetter}
            className="flex items-center gap-2"
          >
            <Copy className="h-4 w-4" />
            Copy Letter
          </Button>
          {onEmail && (
            <Button
              variant="outline"
              size="sm"
              onClick={onEmail}
              className="flex items-center gap-2"
            >
              <Mail className="h-4 w-4" />
              Email
            </Button>
          )}
          {onDownload && (
            <Button
              variant="outline"
              size="sm"
              onClick={onDownload}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Download PDF
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
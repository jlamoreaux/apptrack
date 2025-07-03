/**
 * InterviewPreparationResult Component
 * 
 * Displays interview preparation materials in an organized, interactive format.
 * Shows questions by category, tips, company insights, and practice areas.
 * 
 * Features:
 * - Expandable question cards with STAR framework guidance
 * - Category-based organization with filtering
 * - Difficulty indicators
 * - Practice mode with timer
 * - Copy and download functionality
 */

import { useState, useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  MessageCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Lightbulb,
  Building,
  Target,
  Play,
  Copy,
  Download,
  Filter,
  Star
} from "lucide-react"
import { useScreenReaderAnnouncements } from "@/lib/utils/accessibility"
import type { InterviewPreparationResult, InterviewQuestion } from "@/types/ai-analysis"

interface InterviewPreparationResultProps {
  analysis: InterviewPreparationResult
  /** Optional className for styling customization */
  className?: string
  /** Callback when user wants to copy results */
  onCopy?: () => void
  /** Callback when user wants to download results */
  onDownload?: () => void
  /** Show action buttons */
  showActions?: boolean
  /** Loading state indicator */
  isLoading?: boolean
}

type QuestionFilter = 'all' | 'behavioral' | 'technical' | 'company-specific' | 'role-specific'

export function InterviewPreparationResult({ 
  analysis, 
  className,
  onCopy,
  onDownload,
  showActions = true,
  isLoading = false
}: InterviewPreparationResultProps) {
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set())
  const [activeFilter, setActiveFilter] = useState<QuestionFilter>('all')
  const [practiceMode, setPracticeMode] = useState(false)
  const { announceSuccess } = useScreenReaderAnnouncements()

  const toggleQuestion = (questionId: string) => {
    const newExpanded = new Set(expandedQuestions)
    if (newExpanded.has(questionId)) {
      newExpanded.delete(questionId)
    } else {
      newExpanded.add(questionId)
    }
    setExpandedQuestions(newExpanded)
  }

  const filteredQuestions = useMemo(() => {
    if (activeFilter === 'all') return analysis.questions
    return analysis.questions.filter(q => q.category === activeFilter)
  }, [analysis.questions, activeFilter])

  const questionsByCategory = useMemo(() => {
    const categories = {
      behavioral: analysis.questions.filter(q => q.category === 'behavioral'),
      technical: analysis.questions.filter(q => q.category === 'technical'),
      'company-specific': analysis.questions.filter(q => q.category === 'company-specific'),
      'role-specific': analysis.questions.filter(q => q.category === 'role-specific'),
    }
    return categories
  }, [analysis.questions])

  const getDifficultyColor = (difficulty: 'easy' | 'medium' | 'hard') => {
    switch (difficulty) {
      case 'easy': return 'text-green-600 bg-green-100'
      case 'medium': return 'text-yellow-600 bg-yellow-100'
      case 'hard': return 'text-red-600 bg-red-100'
    }
  }

  const getCategoryIcon = (category: InterviewQuestion['category']) => {
    switch (category) {
      case 'behavioral': return <MessageCircle className="h-4 w-4" />
      case 'technical': return <Target className="h-4 w-4" />
      case 'company-specific': return <Building className="h-4 w-4" />
      case 'role-specific': return <Star className="h-4 w-4" />
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

  const handleExpandAll = () => {
    if (expandedQuestions.size === filteredQuestions.length) {
      setExpandedQuestions(new Set())
      announceSuccess("Collapsed all questions")
    } else {
      setExpandedQuestions(new Set(filteredQuestions.map(q => q.id)))
      announceSuccess("Expanded all questions")
    }
  }

  const handleCopyQuestions = () => {
    const questionsText = filteredQuestions.map(q => {
      let text = `Q: ${q.question}\n`
      text += `Approach: ${q.suggestedApproach}\n`
      if (q.starFramework) {
        text += `STAR Framework:\n`
        text += `- Situation: ${q.starFramework.situation}\n`
        text += `- Task: ${q.starFramework.task}\n`
        text += `- Action: ${q.starFramework.action}\n`
        text += `- Result: ${q.starFramework.result}\n`
      }
      text += `Difficulty: ${q.difficulty}\n\n`
      return text
    }).join('')
    
    navigator.clipboard.writeText(questionsText)
    announceSuccess("Questions copied to clipboard")
  }

  return (
    <div className={`space-y-6 ${className || ''}`}>
      {/* Header */}
      <Card>
        <CardHeader className="text-center pb-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            <MessageCircle className="h-6 w-6 text-blue-600" />
            <CardTitle className="text-xl">Interview Preparation</CardTitle>
          </div>
          <div className="flex items-center justify-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{analysis.estimatedDuration} min practice time</span>
            </div>
            <span>•</span>
            <span>{analysis.questions.length} questions</span>
            <span>•</span>
            <span>Generated {formatDate(analysis.generatedAt)}</span>
          </div>
        </CardHeader>
      </Card>

      {/* Questions Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              Interview Questions
              <Badge variant="secondary">{filteredQuestions.length}</Badge>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExpandAll}
                className="text-xs"
              >
                {expandedQuestions.size === filteredQuestions.length ? 'Collapse All' : 'Expand All'}
              </Button>
              {!practiceMode && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPracticeMode(true)}
                  className="text-xs"
                >
                  <Play className="h-3 w-3 mr-1" />
                  Practice Mode
                </Button>
              )}
            </div>
          </div>
          
          {/* Filter Tabs */}
          <Tabs value={activeFilter} onValueChange={(value) => setActiveFilter(value as QuestionFilter)}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="behavioral">Behavioral</TabsTrigger>
              <TabsTrigger value="technical">Technical</TabsTrigger>
              <TabsTrigger value="company-specific">Company</TabsTrigger>
              <TabsTrigger value="role-specific">Role</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {filteredQuestions.map((question) => (
            <Card key={question.id} className="border-l-4 border-l-blue-500">
              <CardHeader 
                className="cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleQuestion(question.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      {getCategoryIcon(question.category)}
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${getDifficultyColor(question.difficulty)}`}
                      >
                        {question.difficulty}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {question.category.replace('-', ' ')}
                      </Badge>
                    </div>
                    <h4 className="font-medium text-gray-900 pr-4">
                      {question.question}
                    </h4>
                  </div>
                  <Button variant="ghost" size="sm">
                    {expandedQuestions.has(question.id) ? 
                      <ChevronUp className="h-4 w-4" /> : 
                      <ChevronDown className="h-4 w-4" />
                    }
                  </Button>
                </div>
              </CardHeader>
              
              {expandedQuestions.has(question.id) && (
                <CardContent className="border-t bg-gray-50">
                  <div className="space-y-4">
                    {/* Suggested Approach */}
                    <div>
                      <h5 className="font-medium text-sm text-gray-700 mb-2">Suggested Approach:</h5>
                      <p className="text-sm text-gray-600">{question.suggestedApproach}</p>
                    </div>

                    {/* STAR Framework (if available) */}
                    {question.starFramework && (
                      <div>
                        <h5 className="font-medium text-sm text-gray-700 mb-2">STAR Framework:</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-blue-600">Situation</p>
                            <p className="text-xs text-gray-600">{question.starFramework.situation}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-green-600">Task</p>
                            <p className="text-xs text-gray-600">{question.starFramework.task}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-orange-600">Action</p>
                            <p className="text-xs text-gray-600">{question.starFramework.action}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-purple-600">Result</p>
                            <p className="text-xs text-gray-600">{question.starFramework.result}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
          
          {filteredQuestions.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No questions found for the selected category.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tips and Insights Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* General Tips */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700">
              <Lightbulb className="h-5 w-5" />
              General Tips
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analysis.generalTips.map((tip, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0" />
                  <p className="text-sm text-gray-700 leading-relaxed">{tip}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Company Insights */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-700">
              <Building className="h-5 w-5" />
              Company Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analysis.companyInsights.map((insight, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                  <p className="text-sm text-gray-700 leading-relaxed">{insight}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Role-Specific Advice */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-purple-700">
              <Target className="h-5 w-5" />
              Role-Specific Advice
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analysis.roleSpecificAdvice.map((advice, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0" />
                  <p className="text-sm text-gray-700 leading-relaxed">{advice}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Practice Areas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-700">
              <Play className="h-5 w-5" />
              Practice Areas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analysis.practiceAreas.map((area, index) => (
                <Badge key={index} variant="outline" className="mr-2 mb-2">
                  {area}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      {showActions && (
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={onCopy || handleCopyQuestions}
            className="flex items-center gap-2"
          >
            <Copy className="h-4 w-4" />
            Copy Questions
          </Button>
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
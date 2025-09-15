"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { 
  Clock, 
  Calendar, 
  Building2, 
  Briefcase,
  ChevronRight,
  Trash2,
  Eye,
  EyeOff
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import type { InterviewPreparationResult } from "@/types/ai-analysis";

interface SavedInterviewPrep {
  id: string;
  user_id: string;
  job_description?: string;
  job_url?: string;
  interview_context?: string;
  prep_content: string | InterviewPreparationResult;
  created_at: string;
  updated_at: string;
  resume_text?: string;
  user_resume_id?: string;
}

interface InterviewPrepHistoryProps {
  onSelectPrep: (prep: InterviewPreparationResult) => void;
  currentUserId?: string | null;
}

export const InterviewPrepHistory: React.FC<InterviewPrepHistoryProps> = ({ 
  onSelectPrep,
  currentUserId 
}) => {
  const [savedPreps, setSavedPreps] = useState<SavedInterviewPrep[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; prepId: string | null }>({ 
    open: false, 
    prepId: null 
  });
  const { toast } = useToast();

  useEffect(() => {
    if (currentUserId) {
      fetchSavedPreps();
    }
  }, [currentUserId]);

  const fetchSavedPreps = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/ai-coach/interview-prep/history", {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch saved interview preps");
      }

      const data = await response.json();
      setSavedPreps(data.preps || []);
    } catch (error) {
      console.error("Error fetching saved preps:", error);
      toast({
        title: "Error",
        description: "Failed to load saved interview preparations",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = (prepId: string) => {
    setDeleteConfirm({ open: true, prepId });
  };

  const deletePrep = async () => {
    const prepId = deleteConfirm.prepId;
    if (!prepId) return;

    // Find the prep being deleted for better user feedback
    const prepToDelete = savedPreps.find(p => p.id === prepId);
    const { company, role } = prepToDelete ? extractContext(prepToDelete) : { company: "Unknown", role: "Unknown" };
    
    try {
      const response = await fetch(`/api/ai-coach/interview-prep/history/${prepId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || "Failed to delete interview prep");
      }

      // Update state to remove the deleted prep
      setSavedPreps(prev => prev.filter(p => p.id !== prepId));
      
      // Close the dialog
      setDeleteConfirm({ open: false, prepId: null });
      
      // Show success toast
      toast({
        title: "Deleted Successfully",
        description: `Interview prep for ${role} at ${company} has been deleted`,
      });
    } catch (error) {
      console.error("Error deleting prep:", error);
      
      // Close the dialog
      setDeleteConfirm({ open: false, prepId: null });
      
      // Show error toast
      toast({
        title: "Deletion Failed",
        description: error instanceof Error ? error.message : "Unable to delete interview preparation. Please try again.",
        variant: "destructive",
      });
    }
  };

  const extractContext = (prep: SavedInterviewPrep) => {
    // Extract company and role from interview context or job description
    let company = "Unknown Company";
    let role = "Unknown Position";

    if (prep.interview_context) {
      const contextMatch = prep.interview_context.match(/Interview for (.+?) position at (.+)/);
      if (contextMatch) {
        role = contextMatch[1];
        company = contextMatch[2];
      }
    } else if (prep.job_description) {
      // Try to extract from job description
      const lines = prep.job_description.split('\n').slice(0, 3);
      const text = lines.join(' ');
      // Simple extraction - could be improved
      if (text.includes(' at ')) {
        const parts = text.split(' at ');
        if (parts[1]) company = parts[1].split(/[,.\s]/)[0];
      }
    }

    return { company, role };
  };

  const parsePreparation = (prep: SavedInterviewPrep): InterviewPreparationResult | null => {
    if (typeof prep.prep_content === 'object' && prep.prep_content !== null) {
      return prep.prep_content as InterviewPreparationResult;
    }
    
    // Try to parse if it's a string
    if (typeof prep.prep_content === 'string') {
      try {
        const parsed = JSON.parse(prep.prep_content);
        if (parsed.questions && Array.isArray(parsed.questions)) {
          return parsed as InterviewPreparationResult;
        }
      } catch {
        // Not valid JSON
      }
    }
    
    return null;
  };

  const handleSelectPrep = (prep: SavedInterviewPrep) => {
    const parsedPrep = parsePreparation(prep);
    if (parsedPrep) {
      onSelectPrep(parsedPrep);
      
      // Show toast with action to scroll to content
      toast({
        title: "Loaded Successfully",
        description: "Interview preparation has been loaded",
        action: (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // Scroll to the interview prep display
              const prepDisplay = document.querySelector('[data-interview-prep-display]');
              if (prepDisplay) {
                prepDisplay.scrollIntoView({ behavior: 'smooth', block: 'start' });
                
                // Add a brief highlight animation
                prepDisplay.classList.add('animate-pulse');
                setTimeout(() => {
                  prepDisplay.classList.remove('animate-pulse');
                }, 2000);
              } else {
                // Fallback: scroll to top where the content usually appears
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
          >
            View
          </Button>
        ),
      });
    } else {
      toast({
        title: "Error",
        description: "This preparation cannot be displayed in the current format",
        variant: "destructive",
      });
    }
  };

  if (!currentUserId) {
    return null;
  }

  return (
    <>
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Saved Interview Preparations
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <>
                <EyeOff className="h-4 w-4 mr-1" />
                Hide
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-1" />
                Show ({savedPreps.length})
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4 text-muted-foreground">
              Loading saved preparations...
            </div>
          ) : savedPreps.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              No saved interview preparations yet
            </div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto pr-2">
              <div className="space-y-3">
                {savedPreps.map((prep) => {
                  const { company, role } = extractContext(prep);
                  const parsedPrep = parsePreparation(prep);
                  const questionCount = parsedPrep?.questions?.length || 0;
                  
                  return (
                    <Card 
                      key={prep.id} 
                      className="cursor-pointer hover:bg-accent/50 transition-colors"
                      onClick={() => handleSelectPrep(prep)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{company}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Briefcase className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">{role}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(prep.created_at), "MMM d, yyyy 'at' h:mm a")}
                              </span>
                            </div>
                            {questionCount > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                {questionCount} questions
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteClick(prep.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
      
      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => !open && setDeleteConfirm({ open: false, prepId: null })}
        title="Delete Interview Preparation"
        description={(() => {
          const prep = savedPreps.find(p => p.id === deleteConfirm.prepId);
          if (prep) {
            const { company, role } = extractContext(prep);
            return `Are you sure you want to delete the interview prep for ${role} at ${company}? This action cannot be undone.`;
          }
          return "Are you sure you want to delete this interview preparation? This action cannot be undone.";
        })()}
        onConfirm={deletePrep}
        confirmText="Delete"
        cancelText="Cancel"
        destructive={true}
      />
      
      {/* Toast notifications */}
      <Toaster />
    </>
  );
};
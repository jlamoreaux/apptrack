"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  Plus, 
  Trash2, 
  ExternalLink, 
  User,
  Loader2,
  Edit2,
  Save,
  X,
  StickyNote
} from "lucide-react";
import { getInitialsFromName, extractProfileInfoFromUrl } from "@/lib/utils/linkedin";

// LinkedIn logo as SVG component
const LinkedInIcon = ({ className }: { className?: string }) => (
  <svg 
    className={className} 
    viewBox="0 0 24 24" 
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

interface LinkedInProfile {
  id: string;
  profile_url: string;
  name?: string | null;
  title?: string | null;
  company?: string | null;
  profile_photo_url?: string | null;
  headline?: string | null;
  notes?: string | null;
}

interface LinkedInContactsSectionProps {
  profiles: LinkedInProfile[];
  onAddProfile: (profileData: { profile_url: string; name?: string; title?: string; company?: string }) => Promise<{ success: boolean; error?: string }>;
  onDeleteProfile: (profileId: string) => Promise<{ success: boolean; error?: string }>;
  onUpdateProfile?: (profileId: string, updates: { notes?: string; name?: string; title?: string; company?: string }) => Promise<{ success: boolean; error?: string }>;
  isLoading?: boolean;
}

export function LinkedInContactsSection({
  profiles,
  onAddProfile,
  onDeleteProfile,
  onUpdateProfile,
  isLoading = false
}: LinkedInContactsSectionProps) {
  const [newProfileUrl, setNewProfileUrl] = useState("");
  const [newProfileName, setNewProfileName] = useState("");
  const [newProfileTitle, setNewProfileTitle] = useState("");
  const [newProfileCompany, setNewProfileCompany] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState("");
  const [editingProfile, setEditingProfile] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editCompany, setEditCompany] = useState("");

  const handleUrlChange = (url: string) => {
    setNewProfileUrl(url);
    setError("");
    
    // Auto-extract name from URL if not already set
    if (url.includes("linkedin.com/in/") && !newProfileName) {
      const info = extractProfileInfoFromUrl(url);
      if (info.suggestedName) {
        setNewProfileName(info.suggestedName);
      }
    }
  };

  const handleAddProfile = async () => {
    if (!newProfileUrl.trim()) return;

    // Basic LinkedIn URL validation
    if (!newProfileUrl.includes("linkedin.com/in/")) {
      setError("Please enter a valid LinkedIn profile URL");
      return;
    }

    setIsAdding(true);
    setError("");

    try {
      const result = await onAddProfile({
        profile_url: newProfileUrl,
        name: newProfileName || undefined,
        title: newProfileTitle || undefined,
        company: newProfileCompany || undefined,
      });

      if (result.success) {
        setNewProfileUrl("");
        setNewProfileName("");
        setNewProfileTitle("");
        setNewProfileCompany("");
        setShowAddForm(false);
      } else {
        setError(result.error || "Failed to add profile");
      }
    } catch (err) {
      setError("Failed to add profile");
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteProfile = async (profileId: string) => {
    setIsDeleting(profileId);
    try {
      await onDeleteProfile(profileId);
    } finally {
      setIsDeleting(null);
    }
  };

  const handleStartEditingNotes = (profileId: string, currentNotes: string | null | undefined) => {
    setEditingNotes(profileId);
    setNotesValue(currentNotes || "");
  };

  const handleSaveNotes = async (profileId: string) => {
    if (!onUpdateProfile) return;
    
    try {
      const result = await onUpdateProfile(profileId, { notes: notesValue });
      if (result.success) {
        setEditingNotes(null);
        setNotesValue("");
      }
    } catch (error) {
      console.error("Failed to save notes:", error);
    }
  };

  const handleCancelEditingNotes = () => {
    setEditingNotes(null);
    setNotesValue("");
  };

  const handleStartEditingProfile = (profile: LinkedInProfile) => {
    setEditingProfile(profile.id);
    setEditName(profile.name || "");
    setEditTitle(profile.title || "");
    setEditCompany(profile.company || "");
  };

  const handleSaveProfile = async (profileId: string) => {
    if (!onUpdateProfile) return;
    
    try {
      const result = await onUpdateProfile(profileId, { 
        name: editName || undefined,
        title: editTitle || undefined,
        company: editCompany || undefined
      });
      if (result.success) {
        setEditingProfile(null);
        setEditName("");
        setEditTitle("");
        setEditCompany("");
      }
    } catch (error) {
      console.error("Failed to save profile:", error);
    }
  };

  const handleCancelEditingProfile = () => {
    setEditingProfile(null);
    setEditName("");
    setEditTitle("");
    setEditCompany("");
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <LinkedInIcon className="h-5 w-5 text-[#0A66C2]" />
              LinkedIn Contacts
            </CardTitle>
            <CardDescription>
              Save relevant LinkedIn profiles for networking
            </CardDescription>
          </div>
          {!showAddForm && profiles.length > 0 && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowAddForm(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Contact
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {profiles.length === 0 && !showAddForm && (
          <div className="text-center py-8">
            <div className="mx-auto w-16 h-16 bg-[#0A66C2]/10 dark:bg-[#0A66C2]/20 rounded-full flex items-center justify-center mb-4">
              <LinkedInIcon className="h-8 w-8 text-[#0A66C2]" />
            </div>
            <h3 className="text-sm font-medium mb-1">No LinkedIn contacts yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add contacts to keep track of important connections
            </p>
            <Button 
              variant="outline"
              size="sm"
              onClick={() => setShowAddForm(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add First Contact
            </Button>
          </div>
        )}

        {/* Profiles List */}
        {profiles.length > 0 && (
          <div className="space-y-2">
            {profiles.map((profile) => (
              <div 
                key={profile.id} 
                className="space-y-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <Avatar className="h-10 w-10 flex-shrink-0">
                    <AvatarImage 
                      src={profile.profile_photo_url || undefined} 
                      alt={profile.name || "LinkedIn profile"}
                    />
                    <AvatarFallback className="bg-[#0A66C2]/10 dark:bg-[#0A66C2]/20 text-[#0A66C2] dark:text-[#0A66C2] text-sm font-medium">
                      {getInitialsFromName(profile.name)}
                    </AvatarFallback>
                  </Avatar>
                  
                  {/* Profile Info */}
                  <div className="flex-1 min-w-0">
                    {editingProfile === profile.id ? (
                      <div className="space-y-2">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Name"
                          className="h-8 text-sm"
                        />
                        <div className="flex gap-2">
                          <Input
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            placeholder="Title"
                            className="h-8 text-sm"
                          />
                          <Input
                            value={editCompany}
                            onChange={(e) => setEditCompany(e.target.value)}
                            placeholder="Company"
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <a
                            href={profile.profile_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-sm hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1"
                          >
                            {profile.name || profile.profile_url.split("/").pop() || "LinkedIn Profile"}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                        {(profile.title || profile.company) && (
                          <p className="text-xs text-muted-foreground truncate">
                            {[profile.title, profile.company].filter(Boolean).join(" at ")}
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-1">
                    {onUpdateProfile && (
                      <>
                        {editingProfile === profile.id ? (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSaveProfile(profile.id)}
                              className="h-8 w-8 p-0"
                            >
                              <Save className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleCancelEditingProfile}
                              className="h-8 w-8 p-0"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleStartEditingProfile(profile)}
                              className="h-8 w-8 p-0"
                              disabled={editingNotes === profile.id}
                            >
                              <Edit2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (editingNotes === profile.id) {
                                  handleCancelEditingNotes();
                                } else {
                                  handleStartEditingNotes(profile.id, profile.notes);
                                }
                              }}
                              className="h-8 w-8 p-0"
                              disabled={editingProfile === profile.id}
                            >
                              {editingNotes === profile.id ? (
                                <X className="h-4 w-4" />
                              ) : (
                                <StickyNote className="h-4 w-4 text-muted-foreground" />
                              )}
                            </Button>
                          </>
                        )}
                      </>
                    )}
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isDeleting === profile.id}
                          className="h-8 w-8 p-0"
                        >
                          {isDeleting === profile.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove LinkedIn Contact</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to remove {profile.name || "this LinkedIn contact"}? 
                            This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => handleDeleteProfile(profile.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                {/* Notes Section */}
                {editingProfile === profile.id ? null : editingNotes === profile.id ? (
                  <div className="space-y-2">
                    <Textarea
                      value={notesValue}
                      onChange={(e) => setNotesValue(e.target.value)}
                      placeholder="Add notes about this contact..."
                      className="min-h-[80px] text-sm"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleSaveNotes(profile.id)}
                        className="bg-[#0A66C2] hover:bg-[#004182] text-white"
                      >
                        <Save className="h-3 w-3 mr-1" />
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCancelEditingNotes}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : profile.notes ? (
                  <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
                    {profile.notes}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}

        {/* Add Form */}
        {showAddForm && (
          <>
            {profiles.length > 0 && <Separator />}
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="profile-url">LinkedIn Profile URL</Label>
                <Input
                  id="profile-url"
                  type="url"
                  placeholder="https://linkedin.com/in/username"
                  value={newProfileUrl}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  disabled={isAdding}
                />
                {error && (
                  <p className="text-xs text-destructive">{error}</p>
                )}
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="profile-name">Name (Optional)</Label>
                  <Input
                    id="profile-name"
                    type="text"
                    placeholder="John Doe"
                    value={newProfileName}
                    onChange={(e) => setNewProfileName(e.target.value)}
                    disabled={isAdding}
                  />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="profile-title">Title (Optional)</Label>
                    <Input
                      id="profile-title"
                      type="text"
                      placeholder="Senior Engineer"
                      value={newProfileTitle}
                      onChange={(e) => setNewProfileTitle(e.target.value)}
                      disabled={isAdding}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="profile-company">Company (Optional)</Label>
                    <Input
                      id="profile-company"
                      type="text"
                      placeholder="TechCorp"
                      value={newProfileCompany}
                      onChange={(e) => setNewProfileCompany(e.target.value)}
                      disabled={isAdding}
                    />
                  </div>
                </div>
              </div>


              <div className="flex gap-2">
                <Button 
                  onClick={handleAddProfile} 
                  disabled={!newProfileUrl.trim() || isAdding}
                  className="bg-[#0A66C2] hover:bg-[#004182] text-white"
                >
                  {isAdding ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Contact
                    </>
                  )}
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewProfileUrl("");
                    setNewProfileName("");
                    setNewProfileTitle("");
                    setNewProfileCompany("");
                    setError("");
                  }}
                  disabled={isAdding}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
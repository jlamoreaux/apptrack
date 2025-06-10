"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { NavigationClient } from "@/components/navigation-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
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
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ArrowLeft, ExternalLink, Plus, Trash2, Linkedin, Edit, MoreVertical, Archive, Trash } from "lucide-react"
import { useSupabaseAuth } from "@/hooks/use-supabase-auth"
import { useSupabaseApplications, useLinkedinProfiles } from "@/hooks/use-supabase-applications"
import type { Application } from "@/lib/supabase"
import { OfferReceivedModal } from "@/components/offer-received-modal"
import { useSubscription } from "@/hooks/use-subscription"
import { StatusSelector } from "@/components/status-selector"
import { EditApplicationModal } from "@/components/edit-application-modal"
import { archiveApplicationAction, deleteApplicationAction } from "@/lib/actions"

export default function ApplicationDetailPage() {
  const { user, loading: authLoading } = useSupabaseAuth()
  const { getApplication, updateApplication } = useSupabaseApplications(user?.id || null)
  const [application, setApplication] = useState<Application | null>(null)
  const [newNote, setNewNote] = useState("")
  const [newLinkedinProfile, setNewLinkedinProfile] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const params = useParams()
  const [showOfferModal, setShowOfferModal] = useState(false)
  const { isOnFreePlan } = useSubscription(user?.id || null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [isArchiving, setIsArchiving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const { profiles: linkedinProfiles, addProfile, deleteProfile } = useLinkedinProfiles(application?.id || null)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
      return
    }

    if (user && params.id) {
      fetchApplication()
    }
  }, [user, authLoading, params.id, router])

  const fetchApplication = async () => {
    try {
      const app = await getApplication(params.id as string)
      setApplication(app)
    } catch (error) {
      console.error("Failed to fetch application:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateApplication = async (updates: Partial<Application>) => {
    if (!application) return

    setSaving(true)
    try {
      const result = await updateApplication(application.id, updates)
      if (result.success) {
        setApplication(result.application!)

        // Show congratulations modal if status changed to "Offer"
        if (updates.status === "Offer" && application.status !== "Offer") {
          setShowOfferModal(true)
        }
      }
    } catch (error) {
      console.error("Failed to update application:", error)
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateNotes = async (notes: string) => {
    if (!application) return

    handleUpdateApplication({ notes })
  }

  const handleAddNote = () => {
    if (!newNote.trim() || !application) return

    const updatedNotes =
      application.notes + (application.notes ? "\n\n" : "") + `[${new Date().toLocaleDateString()}] ${newNote}`
    handleUpdateNotes(updatedNotes)
    setNewNote("")
  }

  const handleAddLinkedinProfile = async () => {
    if (!newLinkedinProfile.trim()) return

    const result = await addProfile({
      profile_url: newLinkedinProfile,
    })

    if (result.success) {
      setNewLinkedinProfile("")
    }
  }

  const handleRemoveLinkedinProfile = async (profileId: string) => {
    await deleteProfile(profileId)
  }

  const handleArchiveApplication = async () => {
    if (!application) return

    setIsArchiving(true)
    try {
      const result = await archiveApplicationAction(application.id)
      if (result.success) {
        router.push("/dashboard")
      } else {
        console.error("Failed to archive application:", result.error)
      }
    } catch (error) {
      console.error("Failed to archive application:", error)
    } finally {
      setIsArchiving(false)
    }
  }

  const handleDeleteApplication = async () => {
    if (!application) return

    setIsDeleting(true)
    try {
      const result = await deleteApplicationAction(application.id)
      if (result.success) {
        router.push("/dashboard")
      } else {
        console.error("Failed to delete application:", result.error)
      }
    } catch (error) {
      console.error("Failed to delete application:", error)
    } finally {
      setIsDeleting(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <NavigationClient />
        <div className="container mx-auto py-8">
          <div className="flex items-center justify-center">
            <div className="text-center">Loading...</div>
          </div>
        </div>
      </div>
    )
  }

  if (!user || !application) return null

  return (
    <div className="min-h-screen bg-background">
      <NavigationClient />
      <div className="container mx-auto py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          </div>

          {/* Application Overview */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <CardTitle className="text-2xl">{application.role}</CardTitle>
                  <CardDescription className="text-lg">{application.company}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <StatusSelector
                    currentStatus={application.status}
                    onStatusChange={(status) => handleUpdateApplication({ status })}
                    disabled={saving}
                  />
                  <Button variant="outline" size="sm" onClick={() => setShowEditModal(true)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={handleArchiveApplication} disabled={isArchiving}>
                        <Archive className="h-4 w-4 mr-2" />
                        {isArchiving ? "Archiving..." : "Archive"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600"
                            onSelect={(e) => e.preventDefault()}
                          >
                            <Trash className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Application</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to permanently delete this application? This action cannot be undone
                              and will remove all associated data including notes and LinkedIn profiles.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={handleDeleteApplication}
                              disabled={isDeleting}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              {isDeleting ? "Deleting..." : "Delete"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Date Applied</Label>
                  <p className="text-sm">{new Date(application.date_applied).toLocaleDateString()}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Job Posting</Label>
                  <div className="flex items-center gap-2">
                    {application.role_link ? (
                      <a
                        href={application.role_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                      >
                        View Original Posting
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-sm text-muted-foreground">No link provided</span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Interview Notes */}
            <Card>
              <CardHeader>
                <CardTitle>Interview Notes</CardTitle>
                <CardDescription>Keep track of interview questions, feedback, and follow-ups</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={application.notes}
                    onChange={(e) => handleUpdateNotes(e.target.value)}
                    placeholder="Add your interview notes here..."
                    className="min-h-[200px]"
                    disabled={saving}
                  />
                  {saving && <p className="text-xs text-muted-foreground">Saving...</p>}
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="newNote">Add New Note</Label>
                  <div className="flex gap-2">
                    <Textarea
                      id="newNote"
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Add a new note..."
                      className="min-h-[80px]"
                    />
                    <Button onClick={handleAddNote} size="sm" disabled={!newNote.trim()}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* LinkedIn Contacts */}
            <Card>
              <CardHeader>
                <CardTitle>LinkedIn Contacts</CardTitle>
                <CardDescription>Save relevant LinkedIn profiles for networking</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {linkedinProfiles.map((profile) => (
                    <div key={profile.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <Linkedin className="h-4 w-4 text-blue-600" />
                        <a
                          href={profile.profile_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline"
                        >
                          {profile.name || profile.profile_url.split("/").pop() || profile.profile_url}
                        </a>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleRemoveLinkedinProfile(profile.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="newProfile">Add LinkedIn Profile</Label>
                  <div className="flex gap-2">
                    <Input
                      id="newProfile"
                      value={newLinkedinProfile}
                      onChange={(e) => setNewLinkedinProfile(e.target.value)}
                      placeholder="https://linkedin.com/in/username"
                    />
                    <Button onClick={handleAddLinkedinProfile} size="sm" disabled={!newLinkedinProfile.trim()}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <OfferReceivedModal
        isOpen={showOfferModal}
        onClose={() => setShowOfferModal(false)}
        companyName={application.company}
        roleName={application.role}
        isSubscribed={!isOnFreePlan()}
        userId={user.id}
      />
      <EditApplicationModal
        application={application}
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSave={handleUpdateApplication}
      />
    </div>
  )
}

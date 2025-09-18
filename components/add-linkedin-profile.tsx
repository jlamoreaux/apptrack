"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Linkedin, Loader2 } from "lucide-react";
import { parseLinkedInUrl, extractProfileInfoFromUrl } from "@/lib/utils/linkedin";
import type { CreateLinkedInProfileInput } from "@/types/linkedin";

interface AddLinkedInProfileProps {
  applicationId: string;
  userId: string;
  onAdd: (profile: Partial<CreateLinkedInProfileInput>) => Promise<void>;
}

export function AddLinkedInProfile({ 
  applicationId, 
  userId,
  onAdd 
}: AddLinkedInProfileProps) {
  const [open, setOpen] = useState(false);
  const [profileUrl, setProfileUrl] = useState("");
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    // Validate LinkedIn URL
    if (!profileUrl.includes("linkedin.com/in/")) {
      setError("Please enter a valid LinkedIn profile URL");
      return;
    }

    setIsAdding(true);
    try {
      const profileData: Partial<CreateLinkedInProfileInput> = {
        user_id: userId,
        application_id: applicationId,
        profile_url: profileUrl,
        name: name || undefined,
        title: title || undefined,
        company: company || undefined,
      };

      await onAdd(profileData);
      
      // Reset form
      setProfileUrl("");
      setName("");
      setTitle("");
      setCompany("");
      setOpen(false);
    } catch (error) {
      setError("Failed to add LinkedIn profile");
    } finally {
      setIsAdding(false);
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setProfileUrl(url);
    
    // Try to extract username from URL as a suggestion for name field
    if (url.includes("linkedin.com/in/")) {
      const extracted = extractProfileInfoFromUrl(url);
      if (extracted.username && !name) {
        // Convert username to readable name (replace hyphens with spaces, capitalize)
        const suggestedName = extracted.username
          .split("-")
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");
        setName(suggestedName);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add LinkedIn Contact
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Linkedin className="h-5 w-5 text-blue-600" />
            Add LinkedIn Contact
          </DialogTitle>
          <DialogDescription>
            Add a LinkedIn profile to track networking contacts for this application
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="profile-url">
                LinkedIn Profile URL <span className="text-red-500">*</span>
              </Label>
              <Input
                id="profile-url"
                type="url"
                placeholder="https://www.linkedin.com/in/username"
                value={profileUrl}
                onChange={handleUrlChange}
                required
              />
              {error && (
                <p className="text-sm text-red-500">{error}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Optional: Add their name for easier reference
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="title">Job Title</Label>
              <Input
                id="title"
                type="text"
                placeholder="Senior Software Engineer"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                type="text"
                placeholder="Tech Company Inc."
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isAdding}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isAdding || !profileUrl}>
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
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
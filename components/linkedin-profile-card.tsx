"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink, Trash2, User, Briefcase, MapPin } from "lucide-react";
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
import type { LinkedInProfile } from "@/types/linkedin";

interface LinkedInProfileCardProps {
  profile: LinkedInProfile;
  onDelete?: (profileId: string) => Promise<void>;
  compact?: boolean;
}

export function LinkedInProfileCard({ 
  profile, 
  onDelete,
  compact = false 
}: LinkedInProfileCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!onDelete) return;
    
    setIsDeleting(true);
    try {
      await onDelete(profile.id);
    } catch (error) {
    } finally {
      setIsDeleting(false);
    }
  };

  // Extract initials for avatar fallback
  const getInitials = (name?: string | null) => {
    if (!name) return "LP";
    const parts = name.split(" ");
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Extract LinkedIn username from URL for fallback display
  const getLinkedInUsername = (url: string) => {
    try {
      const urlParts = url.split("/");
      const inIndex = urlParts.indexOf("in");
      if (inIndex !== -1 && inIndex < urlParts.length - 1) {
        return urlParts[inIndex + 1];
      }
      return "LinkedIn Profile";
    } catch {
      return "LinkedIn Profile";
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
        <Avatar className="h-10 w-10">
          <AvatarImage 
            src={profile.profile_photo_url || undefined} 
            alt={profile.name || "LinkedIn profile"}
          />
          <AvatarFallback>{getInitials(profile.name)}</AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm truncate">
              {profile.name || getLinkedInUsername(profile.profile_url)}
            </p>
            <a
              href={profile.profile_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          {profile.title && (
            <p className="text-xs text-muted-foreground truncate">{profile.title}</p>
          )}
        </div>

        {onDelete && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                disabled={isDeleting}
                className="h-8 w-8 p-0"
              >
                <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove LinkedIn Profile</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to remove {profile.name || "this LinkedIn profile"}? 
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage 
              src={profile.profile_photo_url || undefined} 
              alt={profile.name || "LinkedIn profile"}
            />
            <AvatarFallback>{getInitials(profile.name)}</AvatarFallback>
          </Avatar>
          
          <div className="flex-1 space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold">
                  {profile.name || getLinkedInUsername(profile.profile_url)}
                </h3>
                {profile.headline && (
                  <p className="text-sm text-muted-foreground">{profile.headline}</p>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <a
                  href={profile.profile_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary/80"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button variant="outline" size="sm">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Profile
                  </Button>
                </a>
                
                {onDelete && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isDeleting}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove LinkedIn Profile</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to remove {profile.name || "this LinkedIn profile"}? 
                          This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={handleDelete}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
            
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              {profile.title && (
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  <span>{profile.title}</span>
                </div>
              )}
              {profile.company && (
                <div className="flex items-center gap-1">
                  <Briefcase className="h-3 w-3" />
                  <span>{profile.company}</span>
                </div>
              )}
              {profile.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  <span>{profile.location}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
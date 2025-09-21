"use client";

import { useState, useEffect } from "react";
import { X, ExternalLink, AlertCircle, CheckCircle, Info, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

interface Announcement {
  id: string;
  announcement_id: string;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'success' | 'error';
  cta_text?: string;
  cta_link?: string;
  priority: number;
}

export function ActiveAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const response = await fetch('/api/announcements/active');
      if (!response.ok) return;
      
      const data = await response.json();
      setAnnouncements(data);
      
      // Load dismissed announcements from localStorage
      const dismissed = localStorage.getItem('dismissedAnnouncements');
      if (dismissed) {
        setDismissedIds(new Set(JSON.parse(dismissed)));
      }
    } catch (error) {
      console.error('Error fetching announcements:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async (announcement: Announcement) => {
    // Mark as seen in the backend
    try {
      await fetch('/api/onboarding/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ announcementId: announcement.announcement_id })
      });
    } catch (error) {
      console.error('Error marking announcement as seen:', error);
    }

    // Update local state
    const newDismissedIds = new Set(dismissedIds);
    newDismissedIds.add(announcement.id);
    setDismissedIds(newDismissedIds);
    
    // Persist to localStorage
    localStorage.setItem('dismissedAnnouncements', JSON.stringify(Array.from(newDismissedIds)));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5" />;
      case 'error':
        return <AlertCircle className="h-5 w-5" />;
      default:
        return <Info className="h-5 w-5" />;
    }
  };

  const getStyles = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200';
      case 'warning':
        return 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200';
      case 'error':
        return 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200';
      default:
        return 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200';
    }
  };

  if (loading) return null;

  const visibleAnnouncements = announcements.filter(a => !dismissedIds.has(a.id));

  if (visibleAnnouncements.length === 0) return null;

  return (
    <div className="space-y-3 mb-6">
      <AnimatePresence>
        {visibleAnnouncements.map((announcement) => (
          <motion.div
            key={announcement.id}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className={`rounded-lg border p-4 ${getStyles(announcement.type)}`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                {getIcon(announcement.type)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm mb-1">
                  {announcement.title}
                </h3>
                <p className="text-sm opacity-90">
                  {announcement.content}
                </p>
                {announcement.cta_text && announcement.cta_link && (
                  <div className="mt-3">
                    {announcement.cta_link.startsWith('http') ? (
                      <a
                        href={announcement.cta_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm font-medium hover:underline"
                      >
                        {announcement.cta_text}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <Link
                        href={announcement.cta_link}
                        className="inline-flex items-center gap-1 text-sm font-medium hover:underline"
                      >
                        {announcement.cta_text}
                      </Link>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => handleDismiss(announcement)}
                className="flex-shrink-0 ml-2 opacity-70 hover:opacity-100 transition-opacity"
                aria-label="Dismiss announcement"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
"use client";

import { useState } from "react";
import { ResumeListCard } from "./ResumeListCard";
import { ResumeUploadDialog } from "./ResumeUploadDialog";
import { ResumeEditDialog } from "./ResumeEditDialog";
import type { UserResume } from "@/types";

interface ResumeManagementContainerProps {
  userId: string;
}

export function ResumeManagementContainer({
  userId,
}: ResumeManagementContainerProps) {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedResume, setSelectedResume] = useState<UserResume | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleUploadClick = () => {
    setUploadDialogOpen(true);
  };

  const handleEditClick = (resume: UserResume) => {
    setSelectedResume(resume);
    setEditDialogOpen(true);
  };

  const handleUploadSuccess = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const handleEditSuccess = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <>
      <ResumeListCard
        key={refreshKey}
        userId={userId}
        onUploadClick={handleUploadClick}
        onEditClick={handleEditClick}
      />

      <ResumeUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onUploadSuccess={handleUploadSuccess}
      />

      <ResumeEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        resume={selectedResume}
        onEditSuccess={handleEditSuccess}
      />
    </>
  );
}

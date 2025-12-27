import React from "react";
import ReactMarkdown from "react-markdown";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface MarkdownOutputCardProps {
  title?: string;
  icon?: React.ReactNode;
  content: string;
}

export const MarkdownOutputCard: React.FC<MarkdownOutputCardProps> = ({
  title,
  icon,
  content,
}) => (
  <Card>
    {(title || icon) && (
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
    )}
    <CardContent>
      <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </CardContent>
  </Card>
);

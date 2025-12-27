import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

interface JobDescriptionInputTabsProps {
  inputMethod: "text" | "url";
  setInputMethod: (method: "text" | "url") => void;
  jobDescription: string;
  setJobDescription: (desc: string) => void;
  jobUrl: string;
  setJobUrl: (url: string) => void;
  jobDescriptionPlaceholder?: string;
  jobUrlPlaceholder?: string;
}

export const JobDescriptionInputTabs: React.FC<
  JobDescriptionInputTabsProps
> = ({
  inputMethod,
  setInputMethod,
  jobDescription,
  setJobDescription,
  jobUrl,
  setJobUrl,
  jobDescriptionPlaceholder = "Paste the job description for targeted analysis...",
  jobUrlPlaceholder = "https://company.com/jobs/position",
}) => (
  <Tabs
    value={inputMethod}
    onValueChange={(v) => setInputMethod(v as "text" | "url")}
  >
    <TabsList className="grid w-full grid-cols-2">
      <TabsTrigger value="text">Paste Text</TabsTrigger>
      <TabsTrigger value="url">From URL</TabsTrigger>
    </TabsList>
    <TabsContent value="text" className="space-y-2">
      <Textarea
        placeholder={jobDescriptionPlaceholder}
        value={jobDescription}
        onChange={(e) => setJobDescription(e.target.value)}
        className="min-h-[100px]"
      />
    </TabsContent>
    <TabsContent value="url" className="space-y-2">
      <Input
        placeholder={jobUrlPlaceholder}
        value={jobUrl}
        onChange={(e) => setJobUrl(e.target.value)}
      />
    </TabsContent>
  </Tabs>
);

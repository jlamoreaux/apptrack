"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Flame, Copy, Twitter, TrendingUp, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useRoastAnalytics, ROAST_EVENTS } from "@/lib/roast/analytics";

interface RoastData {
  content: string;
  emojiScore: string;
  scoreLabel: string;
  tagline: string;
  firstName: string | null;
  categories: {
    buzzwordBingo: boolean;
    lengthCrimes: boolean;
    formattingDisasters: boolean;
    skillsInflation: boolean;
    genericDisease: boolean;
    industryMisalignment: boolean;
  };
  createdAt: string;
  viewCount: number;
}

const categoryLabels = {
  buzzwordBingo: "Buzzword Overload",
  lengthCrimes: "Length Issues",
  formattingDisasters: "Formatting Problems",
  skillsInflation: "Inflated Skills",
  genericDisease: "Too Generic",
  industryMisalignment: "Industry Mismatch",
};

const categoryEmojis = {
  buzzwordBingo: "🎯",
  lengthCrimes: "📏",
  formattingDisasters: "🎨",
  skillsInflation: "🎈",
  genericDisease: "🥱",
  industryMisalignment: "🎭",
};

export default function RoastDisplay({ roast, roastId, isCreator = false }: { roast: RoastData; roastId: string; isCreator?: boolean }) {
  const router = useRouter();
  const { trackEvent } = useRoastAnalytics();
  const [copied, setCopied] = useState(false);
  
  // Track page view
  useEffect(() => {
    trackEvent(ROAST_EVENTS.ROAST_VIEWED, { roastId, emojiScore: roast.emojiScore });
  }, [roastId, roast.emojiScore, trackEvent]);

  const shareUrl = typeof window !== "undefined" 
    ? `${window.location.origin}/roast/${roastId}`
    : `https://apptrack.ing/roast/${roastId}`;

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    trackEvent(ROAST_EVENTS.ROAST_SHARED, { method: "copy", roastId });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTwitterShare = () => {
    const text = `My resume scored ${roast.emojiScore}\n\n"${roast.tagline}"\n\nGet roasted:`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
    trackEvent(ROAST_EVENTS.ROAST_SHARED, { method: "twitter", roastId });
    window.open(twitterUrl, "_blank");
  };

  const handleLinkedInShare = () => {
    // LinkedIn's share URL needs to be formatted differently
    // Using the feed share endpoint which works better
    const linkedInText = `Just got my resume roasted! Score: ${roast.emojiScore}\n\n"${roast.tagline}"\n\nDare to get roasted? ${shareUrl}`;
    const linkedInUrl = `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(linkedInText)}`;
    trackEvent(ROAST_EVENTS.ROAST_SHARED, { method: "linkedin", roastId });
    window.open(linkedInUrl, "_blank");
  };

  const getScoreColor = (emojiScore: string) => {
    if (emojiScore.includes("💀") || emojiScore.includes("💩")) return "text-destructive";
    if (emojiScore.includes("🤢") || emojiScore.includes("😬")) return "text-orange-600";
    if (emojiScore.includes("🥱") || emojiScore.includes("🤡")) return "text-yellow-600";
    return "text-amber-500";
  };

  const getScoreMessage = (emojiScore: string) => {
    if (emojiScore.includes("💀")) return "Your resume died. RIP.";
    if (emojiScore.includes("🤢")) return "Physically painful to read";
    if (emojiScore.includes("😬")) return "Maximum cringe achieved";
    if (emojiScore.includes("🥱")) return "Cured my insomnia, thanks";
    if (emojiScore.includes("💩")) return "Straight to the trash";
    if (emojiScore.includes("🤡")) return "Is this satire?";
    if (emojiScore.includes("🔥")) return "Dumpster fire status";
    if (emojiScore.includes("🫠")) return "Secondhand embarrassment overload";
    if (emojiScore.includes("🙈")) return "Can't even look at it";
    if (emojiScore.includes("🗑️")) return "Delete immediately";
    return "Impressively terrible";
  };

  const activeCategories = Object.entries(roast.categories)
    .filter(([_, value]) => value)
    .map(([key]) => key as keyof typeof categoryLabels);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-primary/5">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Flame className="h-8 w-8 text-red-500" />
            <h1 className="text-3xl sm:text-4xl font-bold text-primary">
              {isCreator ? "Your Resume Got Roasted" : "Resume Roasted"}
            </h1>
            <Flame className="h-8 w-8 text-red-500" />
          </div>
          {isCreator && (
            <p className="text-muted-foreground">
              Share this roast with your friends and watch them cringe!
            </p>
          )}
          {!isCreator && roast.firstName && (
            <p className="text-muted-foreground">
              {roast.firstName}'s resume just got destroyed
            </p>
          )}
        </div>

        {/* Score Card */}
        <Card className="p-6 mb-6 bg-white/50 dark:bg-gray-800/50 backdrop-blur">
          <div className="text-center">
            <div className={`text-6xl font-bold mb-2 ${getScoreColor(roast.emojiScore)}`}>
              {roast.emojiScore}
            </div>
            <div className="text-2xl font-semibold mb-2">{roast.scoreLabel}</div>
            <p className="text-gray-600 dark:text-gray-300">
              {getScoreMessage(roast.emojiScore)}
            </p>
          </div>
        </Card>

        {/* Categories */}
        {activeCategories.length > 0 && (
          <Card className="p-6 mb-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-primary" />
              Issues Found
            </h3>
            <div className="flex flex-wrap gap-2">
              {activeCategories.map((category) => (
                <span
                  key={category}
                  className="px-3 py-1 bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-foreground rounded-full text-sm flex items-center gap-1"
                >
                  <span>{categoryEmojis[category]}</span>
                  <span>{categoryLabels[category]}</span>
                </span>
              ))}
            </div>
          </Card>
        )}

        {/* Roast Content */}
        <Card className="p-8 mb-8 shadow-xl">
          <div className="prose prose-lg dark:prose-invert max-w-none">
            {roast.content.split("\n\n").map((paragraph, index) => (
              <p key={index} className="mb-4 text-gray-800 dark:text-gray-200">
                {paragraph}
              </p>
            ))}
          </div>
        </Card>

        {/* Share Section - Show to everyone for viral spread */}
        <Card className="p-6 mb-8 bg-gradient-to-r from-primary/10 to-secondary/10 dark:from-primary/20 dark:to-secondary/20">
          <h3 className="font-semibold mb-4 text-center">
            {isCreator ? "Share Your Roast" : "Share This Roast"}
          </h3>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={handleCopyLink}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Copy className="h-4 w-4" />
              {copied ? "Copied!" : "Copy Link"}
            </Button>
            <Button
              onClick={handleTwitterShare}
              className="flex items-center gap-2 bg-black hover:bg-gray-800"
            >
              <Twitter className="h-4 w-4" />
              Share on X
            </Button>
            <Button
              onClick={handleLinkedInShare}
              className="flex items-center gap-2 bg-[#0A66C2] hover:bg-[#004182]"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              Share on LinkedIn
            </Button>
          </div>
          <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-4">
            {roast.viewCount} {roast.viewCount === 1 ? "person has" : "people have"} viewed this roast
          </p>
        </Card>

        {/* CTA Section */}
        <div className="text-center space-y-6">
          <Card className="p-8 bg-primary/5">
            {isCreator ? (
              <>
                <TrendingUp className="h-12 w-12 text-blue-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-4">Ready to Fix These Issues?</h2>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  Get personalized advice, unlimited roasts, and track your improvement over time
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button
                    size="lg"
                    onClick={() => {
                      trackEvent(ROAST_EVENTS.SIGNUP_CLICKED, { roastId, source: "results_page" });
                      router.push("/signup");
                    }}
                  >
                    Sign Up for Free
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => {
                      trackEvent("roast_try_another", { roastId });
                      router.push("/roast-my-resume");
                    }}
                  >
                    Roast Another Resume
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Flame className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-4">Think You Can Do Better?</h2>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  Get your own resume roasted and see how you stack up.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button
                    size="lg"
                    onClick={() => {
                      trackEvent(ROAST_EVENTS.ROAST_VIEWED, { roastId, action: "visitor_cta" });
                      router.push("/roast-my-resume");
                    }}
                  >
                    <Flame className="mr-2 h-4 w-4 text-red-500" />
                    Roast My Resume Now
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => {
                      trackEvent(ROAST_EVENTS.SIGNUP_CLICKED, { roastId, source: "visitor_view" });
                      router.push("/signup");
                    }}
                  >
                    Sign Up for AppTrack
                  </Button>
                </div>
              </>
            )}
          </Card>

          <Link
            href="/"
            className="text-sm text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300 inline-block"
          >
            Back to AppTrack
          </Link>
        </div>
      </div>
    </div>
  );
}
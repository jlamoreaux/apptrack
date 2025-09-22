import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import RoastDisplay from "./roast-display";
import { getRoastCache } from "@/lib/roast/cache";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  
  const { data: roast } = await supabase
    .from("roasts")
    .select("emoji_score, score_label, first_name")
    .eq("shareable_id", id)
    .single();

  const emojiScore = roast?.emoji_score || "💀/10";
  const label = roast?.score_label || "Resume Crime Scene";
  const firstName = roast?.first_name;
  
  const title = firstName 
    ? `${firstName}'s Resume Got Roasted - ${emojiScore}`
    : `Resume Roast Results - ${emojiScore}`;
    
  const description = `This resume scored ${emojiScore} - "${label}". Get your resume roasted with brutally honest AI feedback!`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: `https://apptrack.ing/roast/${id}`,
      siteName: "AppTrack",
      images: [
        {
          url: `https://apptrack.ing/roast/${id}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: "Resume Roast Results",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`https://apptrack.ing/roast/${id}/opengraph-image`],
      creator: "@apptrack",
    },
  };
}

export default async function RoastResultPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { id } = await params;
  const cookieStore = await cookies();
  
  // Check if user is logged in
  const { data: { user } } = await supabase.auth.getUser();
  
  // Try to get from cache first
  const cache = getRoastCache();
  const cacheKey = `roast-${id}`;
  let roast = cache.get(cacheKey);
  let error = null;
  
  // If not in cache, fetch from database
  if (!roast) {
    const result = await supabase
      .from("roasts")
      .select("*")
      .eq("shareable_id", id)
      .single();
    
    roast = result.data;
    error = result.error;
    
    // Cache the result if successful
    if (roast && !error) {
      cache.set(cacheKey, roast);
    }
  }
    
  if (error || !roast) {
    notFound();
  }
  
  // Check if expired
  if (new Date(roast.expires_at) < new Date()) {
    notFound();
  }
  
  // Check if viewer is the creator (either by cookie or by being the logged-in user who created it)
  const isCreator = cookieStore.has(`roast_creator_${id}`) || (user && roast.user_id === user.id);
  
  // Increment view count only for non-creators (fire and forget)
  if (!isCreator) {
    supabase
      .from("roasts")
      .update({ view_count: (roast.view_count || 0) + 1 })
      .eq("shareable_id", id)
      .then(() => {})
      .catch(() => {});
  }
  
  const roastData = {
    content: roast.content,
    emojiScore: roast.emoji_score,
    scoreLabel: roast.score_label,
    tagline: roast.tagline || "This resume is a masterclass in what not to do.",
    firstName: roast.first_name,
    categories: roast.roast_categories,
    createdAt: roast.created_at,
    viewCount: roast.view_count || 0,
  };
  
  return <RoastDisplay roast={roastData} roastId={id} isCreator={isCreator} />;
}
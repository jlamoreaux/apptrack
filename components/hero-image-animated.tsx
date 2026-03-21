"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { Sparkles } from "lucide-react";
import { IMAGE_SIZES, IMAGE_QUALITY_HERO } from "@/lib/constants/homepage-content";

export function HeroImageAnimated() {
  return (
    <div className="relative">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="rounded-xl shadow-2xl border border-border overflow-hidden"
      >
        <Image
          src="/screenshots/features/sankey-chart.png"
          alt="AppTrack pipeline visualization showing how applications flow from Applied through Interview to Offer and Hired stages"
          width={800}
          height={500}
          className="w-full h-auto"
          priority
          sizes={IMAGE_SIZES}
          quality={IMAGE_QUALITY_HERO}
        />
      </motion.div>
      {/* Floating badge */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 0.8 }}
        className="absolute -top-3 -right-3 bg-surface-1 rounded-lg shadow-lg px-3 py-2 border border-border"
      >
        <span className="text-sm font-medium">
          <Sparkles className="inline h-4 w-4 text-primary mr-1.5" />
          Your pipeline, visualized
        </span>
      </motion.div>
    </div>
  );
}

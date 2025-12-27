"use client";

import { ResumeRoastLogo } from "@/components/roast/resume-roast-logo";
import { ScoreIcon } from "@/components/roast/score-icon";
import { Flame } from "lucide-react";

export default function VisualAssetsPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-12">
        <div>
          <h1 className="text-3xl font-bold mb-2">Resume Roast Visual Assets</h1>
          <p className="text-gray-600 mb-8">
            Preview different logo variations. Take screenshots or use browser dev tools to export.
          </p>
        </div>

        {/* Hero Version */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Hero Version (for landing pages)</h2>
          <div className="bg-white rounded-lg p-12 shadow-sm border">
            <ResumeRoastLogo variant="hero" size="lg" animated />
          </div>
        </section>

        {/* Card Versions */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Card Versions</h2>
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-lg p-8 shadow-sm border">
              <ResumeRoastLogo variant="card" size="md" />
            </div>
            <div className="bg-white rounded-lg p-8 shadow-sm border">
              <ResumeRoastLogo variant="card" size="lg" />
            </div>
          </div>
        </section>

        {/* Standard Versions */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Standard Versions (different sizes)</h2>
          <div className="space-y-4">
            <div className="bg-white rounded-lg p-6 shadow-sm border">
              <ResumeRoastLogo size="sm" />
            </div>
            <div className="bg-white rounded-lg p-6 shadow-sm border">
              <ResumeRoastLogo size="md" />
            </div>
            <div className="bg-white rounded-lg p-6 shadow-sm border">
              <ResumeRoastLogo size="lg" />
            </div>
            <div className="bg-white rounded-lg p-6 shadow-sm border">
              <ResumeRoastLogo size="xl" />
            </div>
          </div>
        </section>

        {/* Dark Background Versions */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">On Dark Background</h2>
          <div className="bg-gray-900 rounded-lg p-12 shadow-sm">
            <div className="text-white">
              <ResumeRoastLogo size="lg" />
            </div>
          </div>
        </section>

        {/* Score Icons */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Score Icons System</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-lg p-6 shadow-sm border">
              <h3 className="text-sm font-medium mb-4">Icon Scores</h3>
              <div className="space-y-3">
                <ScoreIcon score="dead" showLabel size="md" />
                <ScoreIcon score="nauseous" showLabel size="md" />
                <ScoreIcon score="cringe" showLabel size="md" />
                <ScoreIcon score="boring" showLabel size="md" />
                <ScoreIcon score="garbage" showLabel size="md" />
              </div>
            </div>
            <div className="bg-white rounded-lg p-6 shadow-sm border">
              <h3 className="text-sm font-medium mb-4">More Scores</h3>
              <div className="space-y-3">
                <ScoreIcon score="joke" showLabel size="md" />
                <ScoreIcon score="fire" showLabel size="md" />
                <ScoreIcon score="melting" showLabel size="md" />
                <ScoreIcon score="cant-look" showLabel size="md" />
                <ScoreIcon score="trash" showLabel size="md" />
              </div>
            </div>
          </div>
        </section>

        {/* Social Media Sized Boxes */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Social Media Formats</h2>
          
          {/* Square (Instagram Post) */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-600">Square (1080x1080) - Instagram Post</h3>
            <div 
              className="bg-gradient-to-br from-orange-500 via-red-500 to-purple-600 rounded-lg shadow-lg flex items-center justify-center text-white relative overflow-hidden"
              style={{ width: "540px", height: "540px" }}
            >
              {/* Background pattern */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-10 left-10">
                  <Flame className="h-32 w-32" />
                </div>
                <div className="absolute bottom-10 right-10">
                  <Flame className="h-32 w-32" />
                </div>
              </div>
              
              <div className="text-center relative z-10">
                <div className="flex items-center gap-4 justify-center mb-4">
                  <Flame className="h-20 w-20 text-yellow-300" />
                  <div>
                    <h1 className="text-6xl font-bold">Resume</h1>
                    <h1 className="text-6xl font-bold">Roast</h1>
                  </div>
                  <Flame className="h-20 w-20 text-orange-300" />
                </div>
                <p className="text-2xl opacity-90">Get brutally honest AI feedback</p>
                <div className="flex gap-6 justify-center mt-8">
                  <ScoreIcon score="dead" size="lg" className="text-white/80" />
                  <ScoreIcon score="fire" size="lg" className="text-white/80" />
                  <ScoreIcon score="trash" size="lg" className="text-white/80" />
                  <ScoreIcon score="joke" size="lg" className="text-white/80" />
                </div>
              </div>
            </div>
          </div>

          {/* Story (Instagram/TikTok) */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-600">Story (1080x1920) - Instagram/TikTok Story</h3>
            <div 
              className="bg-gradient-to-br from-orange-500 via-red-500 to-purple-600 rounded-lg shadow-lg flex items-center justify-center text-white relative overflow-hidden"
              style={{ width: "270px", height: "480px" }}
            >
              <div className="text-center px-6 relative z-10">
                <Flame className="h-16 w-16 mx-auto mb-4 text-yellow-300" />
                <h1 className="text-4xl font-bold mb-2">Resume</h1>
                <h1 className="text-4xl font-bold mb-4">Roast</h1>
                <p className="text-sm opacity-90 mb-6">Get brutally honest AI feedback</p>
                <div className="flex gap-3 justify-center">
                  <ScoreIcon score="dead" size="sm" className="text-white/80" />
                  <ScoreIcon score="fire" size="sm" className="text-white/80" />
                  <ScoreIcon score="trash" size="sm" className="text-white/80" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Color Palette */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Brand Colors</h2>
          <div className="grid grid-cols-5 gap-4">
            <div>
              <div className="h-24 bg-orange-500 rounded-lg shadow-sm"></div>
              <p className="text-sm mt-2 text-gray-600">Orange 500<br />#f97316</p>
            </div>
            <div>
              <div className="h-24 bg-red-500 rounded-lg shadow-sm"></div>
              <p className="text-sm mt-2 text-gray-600">Red 500<br />#ef4444</p>
            </div>
            <div>
              <div className="h-24 bg-purple-600 rounded-lg shadow-sm"></div>
              <p className="text-sm mt-2 text-gray-600">Purple 600<br />#9333ea</p>
            </div>
            <div>
              <div className="h-24 bg-yellow-400 rounded-lg shadow-sm"></div>
              <p className="text-sm mt-2 text-gray-600">Yellow 400<br />#fbbf24</p>
            </div>
            <div>
              <div className="h-24 bg-gradient-to-r from-orange-500 via-red-500 to-purple-600 rounded-lg shadow-sm"></div>
              <p className="text-sm mt-2 text-gray-600">Fire Gradient<br />Orange → Red → Purple</p>
            </div>
          </div>
        </section>

        {/* Instructions */}
        <section className="bg-blue-50 rounded-lg p-6 border border-blue-200">
          <h2 className="text-lg font-semibold mb-2">How to Export These Assets</h2>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>• <strong>Screenshot:</strong> Use ⌘+Shift+4 (Mac) or Win+Shift+S (Windows) to capture any element</li>
            <li>• <strong>High Quality:</strong> Open DevTools, right-click element → "Capture node screenshot"</li>
            <li>• <strong>Transparent BG:</strong> In DevTools, temporarily add `background: transparent` to the parent div</li>
            <li>• <strong>Different Sizes:</strong> Use DevTools responsive mode to resize before capturing</li>
            <li>• <strong>For Print:</strong> Scale up the browser zoom to 200% before capturing for higher resolution</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
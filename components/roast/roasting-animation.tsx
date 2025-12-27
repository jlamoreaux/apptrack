"use client";

import { useEffect, useState } from "react";
import { Flame } from "lucide-react";

export function RoastingAnimation() {
  const [progress, setProgress] = useState(0);
  const [flameSize, setFlameSize] = useState(1);
  
  useEffect(() => {
    // Animate progress from 0 to 100 over 5 seconds
    const duration = 5000;
    const interval = 50;
    const increment = (100 / duration) * interval;
    
    const timer = setInterval(() => {
      setProgress(prev => {
        const next = Math.min(prev + increment, 100);
        if (next >= 100) {
          clearInterval(timer);
        }
        return next;
      });
    }, interval);
    
    // Flame pulsing animation
    const flameTimer = setInterval(() => {
      setFlameSize(prev => prev === 1 ? 1.2 : 1);
    }, 500);
    
    return () => {
      clearInterval(timer);
      clearInterval(flameTimer);
    };
  }, []);
  
  const messages = [
    "Lighting the fire...",
    "Adding more fuel...",
    "Turning up the heat...",
    "Maximum roast mode...",
    "Almost crispy..."
  ];
  
  const messageIndex = Math.min(Math.floor(progress / 20), messages.length - 1);
  
  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="max-w-md w-full mx-auto p-8 text-center">
        {/* Resume on fire animation */}
        <div className="relative mb-8">
          {/* Resume paper */}
          <div className="w-48 h-64 mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-2xl relative overflow-hidden border-2 border-gray-300 dark:border-gray-600">
            {/* Resume lines (placeholder content) */}
            <div className="p-4 space-y-2">
              <div className="h-2 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
              <div className="h-2 bg-gray-300 dark:bg-gray-600 rounded w-full"></div>
              <div className="h-2 bg-gray-300 dark:bg-gray-600 rounded w-5/6"></div>
              <div className="h-8"></div>
              <div className="h-2 bg-gray-300 dark:bg-gray-600 rounded w-full"></div>
              <div className="h-2 bg-gray-300 dark:bg-gray-600 rounded w-4/5"></div>
              <div className="h-2 bg-gray-300 dark:bg-gray-600 rounded w-full"></div>
            </div>
            
            {/* Burn effect from bottom */}
            <div 
              className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-orange-600 via-red-500 to-transparent opacity-90 transition-all duration-300"
              style={{ height: `${progress}%` }}
            >
              {/* Char effect at the edge */}
              <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-gray-900 to-transparent opacity-70"></div>
            </div>
          </div>
          
          {/* Flames at the bottom */}
          <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
            <Flame 
              className="text-red-500 animate-pulse" 
              size={32 * flameSize}
              style={{ 
                animation: 'flicker 0.5s infinite alternate',
                transform: `scale(${flameSize})`
              }}
            />
            <Flame 
              className="text-orange-500 animate-pulse" 
              size={40 * flameSize}
              style={{ 
                animation: 'flicker 0.7s infinite alternate',
                animationDelay: '0.2s',
                transform: `scale(${flameSize})`
              }}
            />
            <Flame 
              className="text-red-600 animate-pulse" 
              size={36 * flameSize}
              style={{ 
                animation: 'flicker 0.6s infinite alternate',
                animationDelay: '0.4s',
                transform: `scale(${flameSize})`
              }}
            />
          </div>
        </div>
        
        {/* Progress text */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-primary">
            Roasting Your Resume
          </h2>
          <p className="text-lg text-muted-foreground animate-pulse">
            {messages[messageIndex]}
          </p>
          
          {/* Progress bar */}
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-orange-500 to-red-500 transition-all duration-300 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
          
          <p className="text-sm text-muted-foreground">
            {Math.round(progress)}% complete
          </p>
        </div>
      </div>
      
      <style jsx>{`
        @keyframes flicker {
          0% { opacity: 0.8; transform: translateY(0); }
          100% { opacity: 1; transform: translateY(-2px); }
        }
      `}</style>
    </div>
  );
}
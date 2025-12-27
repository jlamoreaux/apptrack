"use client";

import { useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface BeforeAfterComparisonProps {
  beforeSrc: string;
  afterSrc: string;
  beforeAlt?: string;
  afterAlt?: string;
  beforeLabel?: string;
  afterLabel?: string;
  className?: string;
  vertical?: boolean;
}

export function BeforeAfterComparison({
  beforeSrc,
  afterSrc,
  beforeAlt = "Before",
  afterAlt = "After",
  beforeLabel = "Before",
  afterLabel = "After",
  className,
  vertical = false
}: BeforeAfterComparisonProps) {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [beforeError, setBeforeError] = useState(false);
  const [afterError, setAfterError] = useState(false);

  const handleMouseDown = () => setIsDragging(true);
  const handleMouseUp = () => setIsDragging(false);
  const handleMouseLeave = () => setIsDragging(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const position = vertical 
      ? ((e.clientY - rect.top) / rect.height) * 100
      : ((e.clientX - rect.left) / rect.width) * 100;
    
    setSliderPosition(Math.max(0, Math.min(100, position)));
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const touch = e.touches[0];
    const position = vertical
      ? ((touch.clientY - rect.top) / rect.height) * 100
      : ((touch.clientX - rect.left) / rect.width) * 100;
    
    setSliderPosition(Math.max(0, Math.min(100, position)));
  };

  const renderPlaceholder = (label: string) => (
    <div className="bg-gray-100 dark:bg-gray-800 flex items-center justify-center w-full h-full rounded-lg">
      <div className="text-center p-8">
        <p className="text-gray-500 dark:text-gray-400 mb-2">{label} Screenshot</p>
        <p className="text-sm text-gray-400 dark:text-gray-500">Image will be displayed here</p>
      </div>
    </div>
  );

  return (
    <div className={cn("space-y-6", className)}>
      {/* Slider Comparison View */}
      <div 
        className="relative overflow-hidden rounded-lg shadow-xl cursor-ew-resize select-none"
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchMove={handleTouchMove}
        onTouchStart={() => setIsDragging(true)}
        onTouchEnd={() => setIsDragging(false)}
      >
        {/* After Image (Background) */}
        <div className="relative w-full" style={{ aspectRatio: '16/10' }}>
          {afterError ? (
            renderPlaceholder(afterLabel)
          ) : (
            <Image
              src={afterSrc}
              alt={afterAlt}
              fill
              className="object-cover"
              onError={() => setAfterError(true)}
            />
          )}
          <div className="absolute top-4 right-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
            {afterLabel}
          </div>
        </div>

        {/* Before Image (Foreground with clip) */}
        <div 
          className="absolute inset-0"
          style={{
            clipPath: vertical 
              ? `inset(0 0 ${100 - sliderPosition}% 0)`
              : `inset(0 ${100 - sliderPosition}% 0 0)`
          }}
        >
          {beforeError ? (
            renderPlaceholder(beforeLabel)
          ) : (
            <Image
              src={beforeSrc}
              alt={beforeAlt}
              fill
              className="object-cover"
              onError={() => setBeforeError(true)}
            />
          )}
          <div className="absolute top-4 left-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
            {beforeLabel}
          </div>
        </div>

        {/* Slider Line */}
        <div 
          className={cn(
            "absolute bg-white shadow-lg",
            vertical 
              ? "w-full h-1 left-0"
              : "w-1 h-full top-0"
          )}
          style={vertical 
            ? { top: `${sliderPosition}%` }
            : { left: `${sliderPosition}%` }
          }
        >
          {/* Slider Handle */}
          <div className={cn(
            "absolute bg-white border-2 border-gray-300 rounded-full shadow-lg",
            "flex items-center justify-center",
            vertical
              ? "w-8 h-8 -top-4 left-1/2 -translate-x-1/2"
              : "w-8 h-8 -left-4 top-1/2 -translate-y-1/2"
          )}>
            <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h8m-4-4v8" />
            </svg>
          </div>
        </div>
      </div>

      {/* Side by Side View (Alternative) */}
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-semibold mb-2 text-red-600 dark:text-red-400">{beforeLabel}</h3>
          <div className="rounded-lg overflow-hidden shadow-lg border-2 border-red-200 dark:border-red-800">
            {beforeError ? (
              renderPlaceholder(beforeLabel)
            ) : (
              <div className="relative" style={{ aspectRatio: '16/10' }}>
                <Image
                  src={beforeSrc}
                  alt={beforeAlt}
                  fill
                  className="object-cover"
                  onError={() => setBeforeError(true)}
                />
              </div>
            )}
          </div>
        </div>
        <div>
          <h3 className="text-lg font-semibold mb-2 text-green-600 dark:text-green-400">{afterLabel}</h3>
          <div className="rounded-lg overflow-hidden shadow-lg border-2 border-green-200 dark:border-green-800">
            {afterError ? (
              renderPlaceholder(afterLabel)
            ) : (
              <div className="relative" style={{ aspectRatio: '16/10' }}>
                <Image
                  src={afterSrc}
                  alt={afterAlt}
                  fill
                  className="object-cover"
                  onError={() => setAfterError(true)}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
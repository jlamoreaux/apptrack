/**
 * AnalysisTabNavigation Component
 * 
 * Handles tab navigation for AI analysis features.
 * Extracted from ApplicationAIAnalysis for better separation of concerns.
 */

import { Target, MessageCircle, FileText } from "lucide-react";
import {
  getTabAccessibilityProps,
  getTabListAccessibilityProps,
  useTabKeyboardNavigation,
} from "@/lib/utils/accessibility";
import {
  AI_FEATURES,
  A11Y_CONFIG,
} from "@/lib/constants/ai-analysis";
import type { AIAnalysisTab } from "@/types/ai-analysis";

interface AnalysisTabNavigationProps {
  activeTab: AIAnalysisTab;
  onTabChange: (tab: AIAnalysisTab) => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
  registerTab: (tabId: string, element: HTMLElement | null) => void;
}

export function AnalysisTabNavigation({
  activeTab,
  onTabChange,
  onKeyDown,
  registerTab,
}: AnalysisTabNavigationProps) {
  const getTabIcon = (iconName: string) => {
    const iconMap = {
      Target,
      MessageCircle,
      FileText,
    } as const;

    const Icon = iconMap[iconName as keyof typeof iconMap];
    return Icon ? <Icon className="h-4 w-4" /> : null;
  };

  return (
    <div className="border-b border-border -mt-2">
      <nav
        {...getTabListAccessibilityProps(A11Y_CONFIG.tablistLabel)}
        onKeyDown={onKeyDown}
        className="flex px-6"
      >
        {AI_FEATURES.map((feature, index) => (
          <button
            key={feature.id}
            ref={(el) => registerTab(feature.id, el)}
            onClick={() => onTabChange(feature.id)}
            {...getTabAccessibilityProps(
              feature.id,
              activeTab === feature.id,
              index,
              AI_FEATURES.length
            )}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
              activeTab === feature.id
                ? "text-primary border-b-2 border-primary bg-primary/5"
                : "text-muted-foreground hover:text-primary hover:bg-primary/5 border-b-2 border-transparent"
            }`}
          >
            {getTabIcon(feature.icon)}
            <span className="hidden sm:inline">{feature.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
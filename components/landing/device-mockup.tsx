import { cn } from '@/lib/utils';

interface DeviceMockupProps {
  children: React.ReactNode;
  device: 'desktop' | 'mobile' | 'tablet';
  className?: string;
}

export function DeviceMockup({ children, device, className }: DeviceMockupProps) {
  if (device === 'desktop') {
    return (
      <div className={cn("relative", className)}>
        {/* Browser Frame */}
        <div className="bg-gray-800 dark:bg-gray-900 rounded-t-lg p-3 flex items-center gap-2">
          {/* Browser Dots */}
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>
          {/* URL Bar */}
          <div className="flex-1 bg-gray-700 dark:bg-gray-800 rounded px-3 py-1 text-xs text-gray-400 text-center">
            app.trackjobs.io/dashboard
          </div>
        </div>
        {/* Content */}
        <div className="bg-white dark:bg-gray-950 rounded-b-lg shadow-2xl border border-gray-200 dark:border-gray-700 border-t-0">
          {children}
        </div>
      </div>
    );
  }

  if (device === 'mobile') {
    return (
      <div className={cn("relative inline-block", className)}>
        {/* iPhone Frame */}
        <div className="relative bg-gray-900 dark:bg-black rounded-[3rem] p-2 shadow-2xl">
          {/* Notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-7 bg-gray-900 dark:bg-black rounded-b-3xl" />
          {/* Screen */}
          <div className="bg-white dark:bg-gray-950 rounded-[2.5rem] overflow-hidden">
            {/* Status Bar */}
            <div className="bg-white dark:bg-gray-950 h-7 flex items-center justify-between px-6 text-xs">
              <span className="font-semibold">9:41</span>
              <div className="flex gap-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M2 17h20v2H2zm1.15-4.05L4 11.47l.85 1.48 1.3-.75-.85-1.48H7v-1.5H2v1.5h2.15L3 10.72zm6.7-.75l1.48.85 1.48-.85-.85-1.48H14v-1.5h-5v1.5h2.05l-.85 1.48zM23 9.22h-1.35l1.14 1.97-.79.46-1.15-2-1.15 2-.79-.46 1.14-1.97H19V7.72h4v1.5z"/>
                </svg>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M1 9l2-2v8a2 2 0 002 2h14a2 2 0 002-2V7l2 2V2H1v7z"/>
                </svg>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M2 9h3v12H2V9zm5-3h3v18H7V6zm5 6h3v12h-3V12zm5-9h3v18h-3V3z"/>
                </svg>
              </div>
            </div>
            {/* Content */}
            <div className="relative">
              {children}
            </div>
            {/* Home Indicator */}
            <div className="bg-white dark:bg-gray-950 h-8 flex items-center justify-center">
              <div className="w-32 h-1 bg-gray-900 dark:bg-gray-300 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (device === 'tablet') {
    return (
      <div className={cn("relative inline-block", className)}>
        {/* iPad Frame */}
        <div className="relative bg-gray-800 dark:bg-black rounded-3xl p-4 shadow-2xl">
          {/* Screen */}
          <div className="bg-white dark:bg-gray-950 rounded-2xl overflow-hidden">
            {/* Status Bar */}
            <div className="bg-white dark:bg-gray-950 h-6 flex items-center justify-between px-4 text-xs">
              <span className="font-semibold">9:41 AM</span>
              <div className="flex gap-2">
                <span>100%</span>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M2 9h3v12H2V9zm5-3h3v18H7V6zm5 6h3v12h-3V12zm5-9h3v18h-3V3z"/>
                </svg>
              </div>
            </div>
            {/* Content */}
            <div className="relative">
              {children}
            </div>
          </div>
          {/* Home Button */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-12 h-12 bg-gray-700 dark:bg-gray-800 rounded-full" />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
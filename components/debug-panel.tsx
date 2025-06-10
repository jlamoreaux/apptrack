"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase-client";

export function DebugPanel() {
  const [logs, setLogs] = useState<string[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  const addLog = (message: string) => {
    const timestamp = new Date().toISOString();
    setLogs((prev) => [...prev, `${timestamp}: ${message}`]);
    console.log(`DEBUG: ${message}`);
  };

  const testDatabaseConnection = async () => {
    addLog("Testing database connection...");

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("count")
        .limit(1);
      if (error) {
        addLog(`Database error: ${error.message}`);
      } else {
        addLog("Database connection successful");
      }
    } catch (error) {
      addLog(`Database connection failed: ${error}`);
    }
  };

  const testAuth = async () => {
    addLog("Testing auth session...");

    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();
      if (error) {
        addLog(`Auth error: ${error.message}`);
      } else {
        addLog(`Auth session: ${session ? "Found" : "None"}`);
        if (session) {
          addLog(`User ID: ${session.user.id}`);
        }
      }
    } catch (error) {
      addLog(`Auth test failed: ${error}`);
    }
  };

  const testSubscriptionTables = async () => {
    addLog("Testing subscription tables...");

    try {
      const { data: plans, error: plansError } = await supabase
        .from("subscription_plans")
        .select("*")
        .limit(1);

      if (plansError) {
        addLog(`Subscription plans error: ${plansError.message}`);
      } else {
        addLog(`Subscription plans: ${plans?.length || 0} found`);
      }

      const { data: subs, error: subsError } = await supabase
        .from("user_subscriptions")
        .select("*")
        .limit(1);

      if (subsError) {
        addLog(`User subscriptions error: ${subsError.message}`);
      } else {
        addLog(`User subscriptions table accessible`);
      }

      const { data: usage, error: usageError } = await supabase
        .from("usage_tracking")
        .select("*")
        .limit(1);

      if (usageError) {
        addLog(`Usage tracking error: ${usageError.message}`);
      } else {
        addLog(`Usage tracking table accessible`);
      }
    } catch (error) {
      addLog(`Subscription tables test failed: ${error}`);
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button onClick={() => setIsVisible(true)} variant="outline" size="sm">
          Debug
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Debug Panel</CardTitle>
            <Button
              onClick={() => setIsVisible(false)}
              variant="ghost"
              size="sm"
            >
              ×
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-2">
            <Button
              onClick={testDatabaseConnection}
              size="sm"
              variant="outline"
            >
              Test DB
            </Button>
            <Button onClick={testAuth} size="sm" variant="outline">
              Test Auth
            </Button>
            <Button
              onClick={testSubscriptionTables}
              size="sm"
              variant="outline"
            >
              Test Subs
            </Button>
            <Button onClick={clearLogs} size="sm" variant="outline">
              Clear
            </Button>
          </div>
          <div className="max-h-48 overflow-y-auto text-xs bg-gray-100 p-2 rounded">
            {logs.length === 0 ? (
              <div className="text-gray-500">No logs yet...</div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="mb-1">
                  {log}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

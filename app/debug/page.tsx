"use client"

import { useState } from "react"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useSupabaseAuthDebug } from "@/hooks/use-supabase-auth-debug"
import { DebugPanel } from "@/components/debug-panel"

export default function DebugPage() {
  const [email, setEmail] = useState("test@example.com")
  const [password, setPassword] = useState("password123")
  const { user, profile, loading, signIn, signOut, debugLogs } = useSupabaseAuthDebug()

  const handleTestLogin = async () => {
    await signIn(email, password)
  }

  const handleTestLogout = async () => {
    await signOut()
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto py-8 space-y-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Debug Page</h1>

          {/* Auth Status */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Auth Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p>
                  <strong>Loading:</strong> {loading ? "Yes" : "No"}
                </p>
                <p>
                  <strong>User:</strong> {user ? user.email : "None"}
                </p>
                <p>
                  <strong>Profile:</strong> {profile ? profile.full_name : "None"}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Test Login */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Test Login</CardTitle>
              <CardDescription>Test the login flow with debug logging</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-4">
                <Button onClick={handleTestLogin} disabled={loading}>
                  {loading ? "Logging in..." : "Test Login"}
                </Button>
                <Button onClick={handleTestLogout} variant="outline" disabled={loading}>
                  Test Logout
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Debug Logs */}
          <Card>
            <CardHeader>
              <CardTitle>Debug Logs</CardTitle>
              <CardDescription>Real-time auth debugging information</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-y-auto bg-gray-100 p-4 rounded text-sm font-mono">
                {debugLogs.length === 0 ? (
                  <div className="text-gray-500">No logs yet...</div>
                ) : (
                  debugLogs.map((log, index) => (
                    <div key={index} className="mb-1">
                      {log}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <DebugPanel />
    </div>
  )
}

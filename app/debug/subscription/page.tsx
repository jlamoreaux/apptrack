import { getUser } from "@/lib/auth-server"
import { createClient } from "@/lib/supabase-server"
import { stripe } from "@/lib/stripe"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, ExternalLink } from "lucide-react"

export default async function SubscriptionDebugPage() {
  const user = await getUser()

  if (!user) {
    return <div>Please log in to view subscription debug info</div>
  }

  const supabase = await createClient()

  // Get user profile
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()

  // Get subscription from database
  const { data: dbSubscription } = await supabase
    .from("user_subscriptions")
    .select(`
      *,
      subscription_plans (*)
    `)
    .eq("user_id", user.id)
    .maybeSingle()

  // Get usage data
  const { data: usage } = await supabase.from("usage_tracking").select("*").eq("user_id", user.id).single()

  // Get applications count
  const { data: applications } = await supabase.from("applications").select("id").eq("user_id", user.id)

  // Try to get Stripe subscription if we have a subscription ID
  let stripeSubscription = null
  let stripeCustomer = null
  let stripeSubscriptions = []

  if (dbSubscription?.stripe_subscription_id) {
    try {
      stripeSubscription = await stripe.subscriptions.retrieve(dbSubscription.stripe_subscription_id)
    } catch (error) {
      console.error("Error fetching Stripe subscription:", error)
    }
  }

  if (dbSubscription?.stripe_customer_id) {
    try {
      stripeCustomer = await stripe.customers.retrieve(dbSubscription.stripe_customer_id)
      const subs = await stripe.subscriptions.list({
        customer: dbSubscription.stripe_customer_id,
        limit: 10,
      })
      stripeSubscriptions = subs.data
    } catch (error) {
      console.error("Error fetching Stripe customer:", error)
    }
  }

  // Try to find customer by email
  let customersByEmail = []
  if (user.email) {
    try {
      const customers = await stripe.customers.list({
        email: user.email,
        limit: 10,
      })
      customersByEmail = customers.data
    } catch (error) {
      console.error("Error searching customers by email:", error)
    }
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Subscription Debug</h1>
        <form action="/api/debug/sync-subscription" method="POST">
          <input type="hidden" name="userId" value={user.id} />
          <Button type="submit" variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Sync from Stripe
          </Button>
        </form>
      </div>

      {/* User Info */}
      <Card>
        <CardHeader>
          <CardTitle>User Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <strong>User ID:</strong> {user.id}
          </div>
          <div>
            <strong>Email:</strong> {user.email}
          </div>
          <div>
            <strong>Profile Created:</strong>{" "}
            {profile?.created_at ? new Date(profile.created_at).toLocaleString() : "N/A"}
          </div>
        </CardContent>
      </Card>

      {/* Database Subscription */}
      <Card>
        <CardHeader>
          <CardTitle>Database Subscription</CardTitle>
          <CardDescription>What our database thinks about your subscription</CardDescription>
        </CardHeader>
        <CardContent>
          {dbSubscription ? (
            <div className="space-y-2">
              <div>
                <strong>Plan:</strong> {dbSubscription.subscription_plans?.name || "Unknown"}
              </div>
              <div>
                <strong>Status:</strong>{" "}
                <Badge variant={dbSubscription.status === "active" ? "default" : "secondary"}>
                  {dbSubscription.status}
                </Badge>
              </div>
              <div>
                <strong>Billing Cycle:</strong> {dbSubscription.billing_cycle}
              </div>
              <div>
                <strong>Current Period:</strong> {new Date(dbSubscription.current_period_start).toLocaleDateString()} -{" "}
                {new Date(dbSubscription.current_period_end).toLocaleDateString()}
              </div>
              <div>
                <strong>Stripe Subscription ID:</strong> {dbSubscription.stripe_subscription_id}
              </div>
              <div>
                <strong>Stripe Customer ID:</strong> {dbSubscription.stripe_customer_id}
              </div>
              <div>
                <strong>Last Updated:</strong> {new Date(dbSubscription.updated_at).toLocaleString()}
              </div>
            </div>
          ) : (
            <p>No subscription found in database</p>
          )}
        </CardContent>
      </Card>

      {/* Usage Data */}
      <Card>
        <CardHeader>
          <CardTitle>Usage Data</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div>
              <strong>Applications Count (Usage Table):</strong> {usage?.applications_count || 0}
            </div>
            <div>
              <strong>Applications Count (Actual):</strong> {applications?.length || 0}
            </div>
            <div>
              <strong>Max Applications:</strong> {dbSubscription?.subscription_plans?.max_applications || 5}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stripe Subscription */}
      <Card>
        <CardHeader>
          <CardTitle>Stripe Subscription</CardTitle>
          <CardDescription>Direct from Stripe API</CardDescription>
        </CardHeader>
        <CardContent>
          {stripeSubscription ? (
            <div className="space-y-2">
              <div>
                <strong>ID:</strong> {stripeSubscription.id}
              </div>
              <div>
                <strong>Status:</strong>{" "}
                <Badge variant={stripeSubscription.status === "active" ? "default" : "secondary"}>
                  {stripeSubscription.status}
                </Badge>
              </div>
              <div>
                <strong>Customer:</strong> {stripeSubscription.customer}
              </div>
              <div>
                <strong>Current Period:</strong>{" "}
                {new Date(stripeSubscription.current_period_start * 1000).toLocaleDateString()} -{" "}
                {new Date(stripeSubscription.current_period_end * 1000).toLocaleDateString()}
              </div>
              <div>
                <strong>Price:</strong> ${(stripeSubscription.items.data[0]?.price.unit_amount || 0) / 100} /{" "}
                {stripeSubscription.items.data[0]?.price.recurring?.interval}
              </div>
              <div>
                <strong>Metadata:</strong>
                <pre className="bg-muted p-2 rounded text-sm mt-1">
                  {JSON.stringify(stripeSubscription.metadata, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <p>No Stripe subscription found with stored ID</p>
          )}
        </CardContent>
      </Card>

      {/* All Stripe Subscriptions for Customer */}
      {stripeSubscriptions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>All Customer Subscriptions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stripeSubscriptions.map((sub) => (
                <div key={sub.id} className="border p-3 rounded">
                  <div>
                    <strong>ID:</strong> {sub.id}
                  </div>
                  <div>
                    <strong>Status:</strong>{" "}
                    <Badge variant={sub.status === "active" ? "default" : "secondary"}>{sub.status}</Badge>
                  </div>
                  <div>
                    <strong>Created:</strong> {new Date(sub.created * 1000).toLocaleString()}
                  </div>
                  <div>
                    <strong>Metadata:</strong>
                    <pre className="bg-muted p-2 rounded text-sm mt-1">{JSON.stringify(sub.metadata, null, 2)}</pre>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Customers by Email */}
      {customersByEmail.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Stripe Customers by Email</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {customersByEmail.map((customer) => (
                <div key={customer.id} className="border p-3 rounded">
                  <div>
                    <strong>ID:</strong> {customer.id}
                  </div>
                  <div>
                    <strong>Email:</strong> {customer.email}
                  </div>
                  <div>
                    <strong>Created:</strong> {new Date(customer.created * 1000).toLocaleString()}
                  </div>
                  <div>
                    <strong>Metadata:</strong>
                    <pre className="bg-muted p-2 rounded text-sm mt-1">
                      {JSON.stringify(customer.metadata, null, 2)}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Debug Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action="/api/debug/sync-subscription" method="POST" className="inline">
            <input type="hidden" name="userId" value={user.id} />
            <Button type="submit">Sync Subscription from Stripe</Button>
          </form>

          <form action="/api/debug/update-usage" method="POST" className="inline">
            <input type="hidden" name="userId" value={user.id} />
            <Button type="submit" variant="outline">
              Update Usage Count
            </Button>
          </form>

          <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer">
            <Button variant="outline">
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Stripe Dashboard
            </Button>
          </a>
        </CardContent>
      </Card>
    </div>
  )
}

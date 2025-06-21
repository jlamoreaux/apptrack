// Mock Supabase client for v0 preview environment
const mockUser = {
  id: "mock-user-123",
  email: "demo@example.com",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  user_metadata: {
    full_name: "Demo User",
  },
}

const mockProfile = {
  id: "mock-user-123",
  email: "demo@example.com",
  full_name: "Demo User",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

// Mock auth methods
const mockAuth = {
  getSession: async () => ({
    data: { session: { user: mockUser } },
    error: null,
  }),

  signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
    // Simulate loading delay
    await new Promise((resolve) => setTimeout(resolve, 1000))

    if (email === "demo@example.com" && password === "password") {
      return {
        data: { user: mockUser },
        error: null,
      }
    }
    return {
      data: { user: null },
      error: { message: "Invalid credentials" },
    }
  },

  signUp: async ({ email, password, options }: any) => {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    return {
      data: { user: { ...mockUser, email } },
      error: null,
    }
  },

  signOut: async () => {
    await new Promise((resolve) => setTimeout(resolve, 500))
    return { error: null }
  },

  onAuthStateChange: (callback: (event: string, session: any) => void) => {
    // Simulate initial auth state
    setTimeout(() => {
      callback("INITIAL_SESSION", { user: mockUser })
    }, 100)

    return {
      data: {
        subscription: {
          unsubscribe: () => {},
        },
      },
    }
  },

  getUser: async () => ({
    data: { user: mockUser },
    error: null,
  }),
}

// Mock database methods
const mockFrom = (table: string) => ({
  select: (columns = "*") => ({
    eq: (column: string, value: any) => ({
      single: async () => {
        if (table === "profiles") {
          return { data: mockProfile, error: null }
        }
        return { data: null, error: { code: "PGRST116", message: "No rows found" } }
      },
      maybeSingle: async () => {
        if (table === "profiles") {
          return { data: mockProfile, error: null }
        }
        return { data: null, error: null }
      },
    }),
  }),
})

export const supabase = {
  auth: mockAuth,
  from: mockFrom,
}

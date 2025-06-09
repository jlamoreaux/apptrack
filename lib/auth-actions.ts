"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "./supabase-server"

export async function signInWithPassword(email: string, password: string) {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return { error: error.message }
    }

    revalidatePath("/", "layout")
    return { success: true, user: data.user }
  } catch (error) {
    console.error("Sign in error:", error)
    return { error: "An unexpected error occurred during sign in" }
  }
}

export async function signUpWithPassword(email: string, password: string, fullName: string) {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    })

    if (error) {
      return { error: error.message }
    }

    revalidatePath("/", "layout")
    return { success: true, user: data.user }
  } catch (error) {
    console.error("Sign up error:", error)
    return { error: "An unexpected error occurred during sign up" }
  }
}

export async function signOut() {
  try {
    const supabase = await createClient()
    await supabase.auth.signOut()
    revalidatePath("/", "layout")
    return { success: true }
  } catch (error) {
    console.error("Sign out error:", error)
    return { error: "An unexpected error occurred during sign out" }
  }
}

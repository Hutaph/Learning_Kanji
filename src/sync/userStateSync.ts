import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";
import type { KanjiProgress, VocabularyEntry } from "../types";

export type JlptLevelKey = "N5" | "N4" | "N3" | "N2" | "N1";

export type JlptSyncState = {
  learned: Record<JlptLevelKey, Record<string, boolean>>;
  wrongReview: Record<JlptLevelKey, string[]>;
  settings: Record<string, string>;
};

export type UserStatePayload = {
  version: 1;
  data: {
    appSettings: {
      theme: "light" | "dark";
      layoutMode: "full" | "compact";
      studyGroup: string;
      studyFocus: "priority" | "due" | "new";
    };
    kanjiProgress: Record<string, KanjiProgress>;
    customVocabulary: VocabularyEntry[];
    customGroups: string[];
    jlpt: JlptSyncState;
  };
};

const TABLE_NAME = "user_state";
const PROFILE_TABLE = "profiles";

export type UserProfile = {
  username: string;
  email: string;
  full_name: string;
  gender: string;
  birth_date: string;
  avatar_url: string;
};

export async function getCurrentSession(): Promise<Session | null> {
  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw error;
  }
  return data.session;
}

export async function loadUserState(userId: string): Promise<UserStatePayload | null> {
  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("payload")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!data?.payload) {
    return null;
  }
  return data.payload as UserStatePayload;
}

export async function saveUserState(userId: string, payload: UserStatePayload): Promise<void> {
  if (!supabase) {
    return;
  }
  const { error } = await supabase
    .from(TABLE_NAME)
    .upsert(
      {
        user_id: userId,
        payload,
        updated_at: new Date().toISOString()
      },
      { onConflict: "user_id" }
    );
  if (error) {
    throw error;
  }
}

export async function loadUserProfile(userId: string): Promise<UserProfile | null> {
  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase
    .from(PROFILE_TABLE)
    .select("username,email,full_name,gender,birth_date,avatar_url")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    return null;
  }
  return {
    username: data.username || "",
    email: data.email || "",
    full_name: data.full_name || "",
    gender: data.gender || "",
    birth_date: data.birth_date || "",
    avatar_url: data.avatar_url || ""
  };
}

export async function saveUserProfile(userId: string, profile: UserProfile): Promise<void> {
  if (!supabase) {
    return;
  }
  const { error } = await supabase.from(PROFILE_TABLE).upsert(
    {
      user_id: userId,
      username: profile.username,
      email: profile.email,
      full_name: profile.full_name || null,
      gender: profile.gender || null,
      birth_date: profile.birth_date || null,
      avatar_url: profile.avatar_url || null,
      updated_at: new Date().toISOString()
    },
    { onConflict: "user_id" }
  );
  if (error) {
    throw error;
  }
}

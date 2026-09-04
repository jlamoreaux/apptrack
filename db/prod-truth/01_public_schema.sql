--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.5

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: auto_assign_default_resume(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_assign_default_resume() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  next_resume_id UUID;
BEGIN
  -- If a default resume was deleted and user still has other resumes
  IF OLD.is_default = true THEN
    -- Find the resume with the lowest display_order
    SELECT id INTO next_resume_id
    FROM public.user_resumes
    WHERE user_id = OLD.user_id
      AND id != OLD.id
    ORDER BY display_order ASC
    LIMIT 1;

    -- Set it as default if found
    IF next_resume_id IS NOT NULL THEN
      UPDATE public.user_resumes
      SET is_default = true,
          updated_at = NOW()
      WHERE id = next_resume_id;
    END IF;
  END IF;

  RETURN OLD;
END;
$$;


--
-- Name: check_ai_feature_allowance(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_ai_feature_allowance(p_user_id uuid, p_feature_type text, p_subscription_tier text DEFAULT 'free'::text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  usage_count INTEGER;
  max_free_uses INTEGER := 1; -- Each feature gets 1 free try
BEGIN
  -- AI Coach tier gets unlimited access
  IF p_subscription_tier = 'ai_coach' THEN
    RETURN TRUE;
  END IF;

  -- Career advice is AI Coach only (no free tier)
  IF p_feature_type = 'career_advice' OR p_feature_type = 'career_chat' THEN
    RETURN FALSE;
  END IF;

  -- Check free tier usage count using correct column name
  SELECT COALESCE(SUM(ai_feature_usage.usage_count), 0)
  INTO usage_count
  FROM ai_feature_usage
  WHERE user_id = p_user_id
    AND feature_name = p_feature_type;

  -- Return TRUE if user has free tries remaining
  RETURN usage_count < max_free_uses;
END;
$$;


--
-- Name: check_resume_limit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_resume_limit() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  resume_count INTEGER;
  user_plan TEXT;
  max_resumes INTEGER;
BEGIN
  SELECT COUNT(*) INTO resume_count
  FROM public.user_resumes
  WHERE user_id = NEW.user_id;

  -- Get user's plan (AI Coach/Pro = 100, Free = 1)
  SELECT COALESCE(sp.name, 'Free') INTO user_plan
  FROM public.profiles p
  LEFT JOIN public.user_subscriptions us ON p.id = us.user_id
  LEFT JOIN public.subscription_plans sp ON us.plan_id = sp.id
  WHERE p.id = NEW.user_id
    AND (us.status IN ('active', 'trialing') OR us.status IS NULL);

  max_resumes := CASE WHEN user_plan IN ('AI Coach', 'Pro') THEN 100 ELSE 1 END;

  IF TG_OP = 'INSERT' AND resume_count >= max_resumes THEN
    RAISE EXCEPTION 'Resume limit reached. Your % plan allows % resume(s).', user_plan, max_resumes
      USING ERRCODE = '23514'; -- check_violation
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: cleanup_expired_roasts(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_expired_roasts() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete roasts that have expired
  WITH deleted AS (
    DELETE FROM public.roasts
    WHERE expires_at < NOW()
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  
  -- Log the cleanup (optional - you can create a cleanup_logs table if you want to track this)
  RAISE NOTICE 'Cleaned up % expired roasts at %', deleted_count, NOW();
  
  -- You could also insert into a log table here if you want to track cleanup history
  -- INSERT INTO cleanup_logs (table_name, deleted_count, cleaned_at)
  -- VALUES ('roasts', deleted_count, NOW());
END;
$$;


--
-- Name: cleanup_expired_trial_results(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_expired_trial_results() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_deleted_count integer;
BEGIN
  DELETE FROM public.ai_trial_results
  WHERE expires_at <= now();
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$;


--
-- Name: cleanup_old_ai_preview_sessions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_old_ai_preview_sessions() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- Delete unconverted preview sessions older than 30 days
  DELETE FROM ai_preview_sessions
  WHERE created_at < NOW() - INTERVAL '30 days'
    AND user_id IS NULL;  -- Only delete unconverted sessions

  -- Delete rate limit entries older than 7 days
  DELETE FROM ai_preview_usage
  WHERE used_at < NOW() - INTERVAL '7 days';

  -- Log cleanup (optional - for monitoring)
  RAISE NOTICE 'Cleaned up old AI preview sessions and rate limit entries';
END;
$$;


--
-- Name: consume_ai_analysis(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.consume_ai_analysis(p_user_id uuid, p_limit integer DEFAULT 5) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  new_count INTEGER;
BEGIN
  UPDATE public.profiles
  SET ai_analyses_used = ai_analyses_used + 1,
      updated_at = NOW()
  WHERE id = p_user_id
    AND ai_analyses_used < p_limit
  RETURNING ai_analyses_used INTO new_count;

  IF new_count IS NULL THEN
    RETURN -1; -- Budget exhausted
  END IF;

  RETURN new_count;
END;
$$;


--
-- Name: convert_guest_to_user(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.convert_guest_to_user(p_user_id uuid, p_guest_identifier jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_first_session record;
  v_last_session record;
  v_trial_count integer;
  v_time_to_conversion integer;
BEGIN
  -- Find first and last sessions for this guest
  SELECT * INTO v_first_session
  FROM public.ai_guest_sessions
  WHERE ip_hash = p_guest_identifier->>'ip_hash'
    AND browser_fingerprint = p_guest_identifier->>'browser_fingerprint'
  ORDER BY session_started_at ASC
  LIMIT 1;
  
  SELECT * INTO v_last_session
  FROM public.ai_guest_sessions
  WHERE ip_hash = p_guest_identifier->>'ip_hash'
    AND browser_fingerprint = p_guest_identifier->>'browser_fingerprint'
  ORDER BY session_started_at DESC
  LIMIT 1;
  
  -- Count total trials
  SELECT COUNT(*) INTO v_trial_count
  FROM public.ai_guest_sessions
  WHERE ip_hash = p_guest_identifier->>'ip_hash'
    AND browser_fingerprint = p_guest_identifier->>'browser_fingerprint';
  
  -- Calculate time to conversion
  v_time_to_conversion := EXTRACT(EPOCH FROM (now() - v_first_session.session_started_at))::integer;
  
  -- Update the last session as converted
  UPDATE public.ai_guest_sessions
  SET 
    converted_to_signup = true,
    converted_user_id = p_user_id
  WHERE id = v_last_session.id;
  
  -- Track conversion
  INSERT INTO public.ai_guest_conversions (
    guest_session_id,
    user_id,
    time_to_conversion_seconds,
    trial_count_before_conversion,
    first_feature_tried,
    last_feature_tried
  ) VALUES (
    v_last_session.id,
    p_user_id,
    v_time_to_conversion,
    v_trial_count,
    v_first_session.feature_name,
    v_last_session.feature_name
  );
END;
$$;


--
-- Name: delete_expired_roasts(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_expired_roasts() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    DELETE FROM roasts WHERE expires_at < NOW();
END;
$$;


--
-- Name: enforce_one_default_resume(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_one_default_resume() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- When setting a resume as default, lock all user's resumes to prevent race conditions
  IF NEW.is_default = true THEN
    -- Lock all user's resumes for this transaction to prevent concurrent modifications
    -- This prevents TOCTOU (Time-of-check to time-of-use) race conditions where
    -- two concurrent requests could both try to set different resumes as default
    PERFORM 1 FROM public.user_resumes
    WHERE user_id = NEW.user_id
    FOR UPDATE;

    -- Now safely unset all other defaults for this user
    UPDATE public.user_resumes
    SET is_default = false
    WHERE user_id = NEW.user_id
      AND id != NEW.id
      AND is_default = true;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: ensure_single_welcome_offer(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ensure_single_welcome_offer() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- If setting this code as welcome offer, unset all others
  IF NEW.is_welcome_offer = true THEN
    UPDATE public.promo_codes 
    SET is_welcome_offer = false 
    WHERE id != NEW.id AND is_welcome_offer = true;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: generate_shareable_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_shareable_id() RETURNS character varying
    LANGUAGE plpgsql
    AS $$
DECLARE
    chars TEXT := 'abcdefghijklmnopqrstuvwxyz0123456789';
    result VARCHAR := '';
    i INTEGER;
BEGIN
    -- Generate 8 character random string
    FOR i IN 1..8 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    RETURN result;
END;
$$;


--
-- Name: get_ai_usage_count(uuid, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_ai_usage_count(p_user_id uuid, p_feature_name text, p_window_hours integer DEFAULT 24) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM public.ai_usage_tracking
    WHERE user_id = p_user_id
      AND feature_name = p_feature_name
      AND used_at > (now() - interval '1 hour' * p_window_hours)
      AND success = true
  );
END;
$$;


--
-- Name: get_guest_trial_result(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_guest_trial_result(p_session_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Get the most recent trial result for the session
  SELECT result_data INTO v_result
  FROM public.ai_trial_results
  WHERE session_id = p_session_id
    AND user_id IS NULL  -- Only for guest sessions
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Update access tracking if result found
  IF v_result IS NOT NULL THEN
    UPDATE public.ai_trial_results
    SET 
      accessed_at = now(),
      access_count = access_count + 1
    WHERE session_id = p_session_id
      AND user_id IS NULL
      AND expires_at > now();
  END IF;
  
  RETURN v_result;
END;
$$;


--
-- Name: get_guest_usage_count(character varying, character varying, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_guest_usage_count(p_ip_hash character varying, p_browser_fingerprint character varying, p_feature_name text, p_window_hours integer DEFAULT 24) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM public.ai_guest_sessions
    WHERE (ip_hash = p_ip_hash OR browser_fingerprint = p_browser_fingerprint)
      AND feature_name = p_feature_name
      AND session_started_at > (now() - interval '1 hour' * p_window_hours)
  );
END;
$$;


--
-- Name: get_next_display_order(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_next_display_order(p_user_id uuid) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
  next_order INTEGER;
BEGIN
  -- Lock the user's resumes to prevent concurrent inserts getting the same order
  -- This ensures atomicity when calculating the next display_order
  SELECT COALESCE(MAX(display_order), 0) + 1 INTO next_order
  FROM public.user_resumes
  WHERE user_id = p_user_id
  FOR UPDATE;

  RETURN next_order;
END;
$$;


--
-- Name: get_trial_result(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_trial_result(p_user_id uuid, p_session_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT result_data INTO v_result
  FROM public.ai_trial_results
  WHERE session_id = p_session_id
    AND (user_id = p_user_id OR user_id IS NULL)
    AND expires_at > now();
  
  -- Update access tracking
  IF v_result IS NOT NULL THEN
    UPDATE public.ai_trial_results
    SET 
      accessed_at = now(),
      access_count = access_count + 1,
      user_id = p_user_id -- Link to user if not already linked
    WHERE session_id = p_session_id
      AND expires_at > now();
  END IF;
  
  RETURN v_result;
END;
$$;


--
-- Name: get_user_ai_limits(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_ai_limits(p_user_id uuid, p_feature_name text, p_subscription_tier text) RETURNS TABLE(daily_limit integer, hourly_limit integer)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- First check for user-specific overrides
  RETURN QUERY
  SELECT uo.daily_limit, uo.hourly_limit
  FROM public.ai_user_limit_overrides uo
  WHERE uo.user_id = p_user_id
    AND uo.feature_name = p_feature_name
    AND (uo.expires_at IS NULL OR uo.expires_at > now())
  LIMIT 1;
  
  -- If no override found, return default limits for tier
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT fl.daily_limit, fl.hourly_limit
    FROM public.ai_feature_limits fl
    WHERE fl.feature_name = p_feature_name
      AND fl.subscription_tier = p_subscription_tier
    LIMIT 1;
  END IF;
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email)
  );
  RETURN new;
END;
$$;


--
-- Name: handle_new_user_subscription(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user_subscription() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    free_plan_id UUID;
BEGIN
    -- Get the free plan ID
    SELECT id INTO free_plan_id FROM public.subscription_plans WHERE name = 'Free' LIMIT 1;
    
    -- Create default subscription
    INSERT INTO public.user_subscriptions (user_id, plan_id, current_period_end)
    VALUES (
        NEW.id,
        free_plan_id,
        NOW() + INTERVAL '1 year' -- Free plan doesn't expire
    );
    
    -- Create usage tracking
    INSERT INTO public.usage_tracking (user_id, applications_count)
    VALUES (NEW.id, 0);
    
    RETURN NEW;
END;
$$;


--
-- Name: handle_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: increment_access_count(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_access_count(p_user_id uuid, p_feature_name text) RETURNS void
    LANGUAGE sql
    AS $$
  UPDATE ai_trial_results 
  SET 
    accessed_at = NOW(),
    access_count = COALESCE(access_count, 0) + 1
  WHERE user_id = p_user_id 
    AND feature_name = p_feature_name;
$$;


--
-- Name: increment_ai_feature_usage(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_ai_feature_usage(p_user_id uuid, p_feature_name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.ai_feature_usage (user_id, feature_name, usage_count)
  VALUES (p_user_id, p_feature_name, 1)
  ON CONFLICT (user_id, feature_name, usage_date)
  DO UPDATE SET 
    usage_count = ai_feature_usage.usage_count + 1,
    updated_at = now();
END;
$$;


--
-- Name: increment_promo_code_usage(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_promo_code_usage(promo_code_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE promo_codes 
  SET used_count = used_count + 1
  WHERE id = promo_code_id;
END;
$$;


--
-- Name: increment_roast_views(character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_roast_views(p_shareable_id character varying) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE roasts 
    SET view_count = view_count + 1
    WHERE shareable_id = p_shareable_id;
END;
$$;


--
-- Name: link_trial_results_to_user(uuid, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.link_trial_results_to_user(p_user_id uuid, p_session_ids uuid[]) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_updated_count integer;
BEGIN
  UPDATE public.ai_trial_results
  SET user_id = p_user_id
  WHERE session_id = ANY(p_session_ids)
    AND user_id IS NULL
    AND expires_at > now();
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count;
END;
$$;


--
-- Name: refresh_application_ai_analyses(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_application_ai_analyses() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Refresh materialized view concurrently (doesn't block reads)
  -- Note: CONCURRENTLY requires the unique index we created above
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.application_ai_analyses;
  RETURN NULL;
END;
$$;


--
-- Name: refund_ai_analysis(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refund_ai_analysis(p_user_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  new_count INTEGER;
BEGIN
  UPDATE public.profiles
  SET ai_analyses_used = GREATEST(ai_analyses_used - 1, 0),
      updated_at = NOW()
  WHERE id = p_user_id
  RETURNING ai_analyses_used INTO new_count;

  RETURN COALESCE(new_count, 0);
END;
$$;


--
-- Name: set_shareable_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_shareable_id() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    new_id VARCHAR;
    id_exists BOOLEAN;
BEGIN
    -- Keep generating until we get a unique ID
    LOOP
        new_id := generate_shareable_id();
        SELECT EXISTS(SELECT 1 FROM roasts WHERE shareable_id = new_id) INTO id_exists;
        EXIT WHEN NOT id_exists;
    END LOOP;
    
    NEW.shareable_id := new_id;
    RETURN NEW;
END;
$$;


--
-- Name: store_trial_result(uuid, text, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.store_trial_result(p_session_id uuid, p_feature_name text, p_input_data jsonb, p_result_data jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_result_id uuid;
BEGIN
  INSERT INTO public.ai_trial_results (
    session_id,
    feature_name,
    input_data,
    result_data
  ) VALUES (
    p_session_id,
    p_feature_name,
    p_input_data,
    p_result_data
  ) RETURNING id INTO v_result_id;
  
  RETURN v_result_id;
END;
$$;


--
-- Name: track_ai_feature_usage(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.track_ai_feature_usage(p_user_id uuid, p_feature_name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO ai_feature_usage (user_id, feature_name, usage_date, usage_count)
  VALUES (p_user_id, p_feature_name, CURRENT_DATE, 1)
  ON CONFLICT (user_id, feature_name, usage_date)
  DO UPDATE SET
    usage_count = ai_feature_usage.usage_count + 1,
    updated_at = now();
END;
$$;


--
-- Name: track_guest_session(character varying, character varying, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.track_guest_session(p_ip_hash character varying, p_browser_fingerprint character varying, p_feature_name text, p_metadata jsonb DEFAULT '{}'::jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_session_id uuid;
BEGIN
  INSERT INTO public.ai_guest_sessions (
    ip_hash,
    browser_fingerprint,
    feature_name,
    client_metadata
  ) VALUES (
    p_ip_hash,
    p_browser_fingerprint,
    p_feature_name,
    p_metadata
  ) RETURNING id INTO v_session_id;
  
  RETURN v_session_id;
END;
$$;


--
-- Name: update_audience_members_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_audience_members_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_career_goals_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_career_goals_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_guest_session_preview(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_guest_session_preview(p_session_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.ai_guest_sessions
  SET 
    result_previewed = true,
    session_completed_at = now()
  WHERE id = p_session_id;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_usage_count(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_usage_count() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Increment count
        INSERT INTO public.usage_tracking (user_id, applications_count, last_updated)
        VALUES (NEW.user_id, 1, NOW())
        ON CONFLICT (user_id) 
        DO UPDATE SET 
            applications_count = usage_tracking.applications_count + 1,
            last_updated = NOW();
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Decrement count
        UPDATE public.usage_tracking 
        SET 
            applications_count = GREATEST(0, applications_count - 1),
            last_updated = NOW()
        WHERE user_id = OLD.user_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;


--
-- Name: update_wins_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_wins_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: upsert_linkedin_profile(text, text, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.upsert_linkedin_profile(p_profile_url text, p_name text DEFAULT NULL::text, p_headline text DEFAULT NULL::text, p_title text DEFAULT NULL::text, p_company text DEFAULT NULL::text, p_location text DEFAULT NULL::text, p_profile_photo_url text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
declare
  v_profile_id uuid;
  v_username text;
begin
  -- Extract username from URL
  v_username := regexp_replace(p_profile_url, '.*linkedin\.com/in/([^/]+).*', '\1');
  
  -- Try to insert or update the profile
  insert into public.linkedin_profiles (
    profile_url, username, name, headline, title, company, location, profile_photo_url
  ) values (
    p_profile_url, v_username, p_name, p_headline, p_title, p_company, p_location, p_profile_photo_url
  )
  on conflict (profile_url) do update set
    name = coalesce(excluded.name, linkedin_profiles.name),
    headline = coalesce(excluded.headline, linkedin_profiles.headline),
    title = coalesce(excluded.title, linkedin_profiles.title),
    company = coalesce(excluded.company, linkedin_profiles.company),
    location = coalesce(excluded.location, linkedin_profiles.location),
    profile_photo_url = coalesce(excluded.profile_photo_url, linkedin_profiles.profile_photo_url),
    updated_at = now()
  returning id into v_profile_id;
  
  return v_profile_id;
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.applications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    company text NOT NULL,
    role text NOT NULL,
    role_link text,
    date_applied date NOT NULL,
    status text DEFAULT 'Applied'::text,
    notes text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    archived boolean DEFAULT false,
    job_description text,
    CONSTRAINT applications_status_check CHECK ((status = ANY (ARRAY['Applied'::text, 'Interview Scheduled'::text, 'Interviewed'::text, 'Offer'::text, 'Hired'::text, 'Rejected'::text])))
);


--
-- Name: active_applications; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.active_applications WITH (security_invoker='on') AS
 SELECT id,
    user_id,
    company,
    role,
    role_link,
    date_applied,
    status,
    notes,
    created_at,
    updated_at,
    archived
   FROM public.applications
  WHERE (archived = false);


--
-- Name: admin_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    notes text
);


--
-- Name: ai_feature_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_feature_limits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    feature_name text NOT NULL,
    subscription_tier text NOT NULL,
    daily_limit integer NOT NULL,
    hourly_limit integer NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: ai_feature_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_feature_usage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    feature_name text NOT NULL,
    usage_date date DEFAULT CURRENT_DATE NOT NULL,
    usage_count integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT ai_feature_usage_feature_check CHECK ((feature_name = ANY (ARRAY['job_fit_analysis'::text, 'cover_letter'::text, 'resume_analysis'::text, 'interview_prep'::text, 'career_advice'::text])))
);


--
-- Name: ai_guest_conversions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_guest_conversions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    guest_session_id uuid NOT NULL,
    user_id uuid NOT NULL,
    converted_at timestamp with time zone DEFAULT now(),
    time_to_conversion_seconds integer,
    trial_count_before_conversion integer DEFAULT 1,
    first_feature_tried text NOT NULL,
    last_feature_tried text NOT NULL,
    signup_source text
);


--
-- Name: ai_guest_rate_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_guest_rate_limits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ip_hash character varying(64) NOT NULL,
    browser_fingerprint character varying(64) NOT NULL,
    feature_name text NOT NULL,
    attempted_at timestamp with time zone DEFAULT now(),
    was_allowed boolean DEFAULT true,
    rate_limit_window text,
    retry_after_seconds integer
);


--
-- Name: ai_guest_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_guest_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ip_hash character varying(64) NOT NULL,
    browser_fingerprint character varying(64) NOT NULL,
    feature_name text NOT NULL,
    session_started_at timestamp with time zone DEFAULT now(),
    session_completed_at timestamp with time zone,
    result_previewed boolean DEFAULT false,
    converted_to_signup boolean DEFAULT false,
    converted_user_id uuid,
    conversion_method text,
    client_metadata jsonb,
    CONSTRAINT ai_guest_sessions_feature_check CHECK ((feature_name = ANY (ARRAY['job_fit_analysis'::text, 'cover_letter'::text, 'resume_analysis'::text, 'interview_prep'::text, 'career_advice'::text])))
);


--
-- Name: ai_guest_funnel; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.ai_guest_funnel AS
 WITH funnel_stages AS (
         SELECT date(ai_guest_sessions.session_started_at) AS date,
            count(DISTINCT ((ai_guest_sessions.ip_hash)::text || (ai_guest_sessions.browser_fingerprint)::text)) AS stage_1_unique_visitors,
            count(*) AS stage_2_trials_started,
            count(*) FILTER (WHERE (ai_guest_sessions.result_previewed = true)) AS stage_3_previews_shown,
            count(DISTINCT ((ai_guest_sessions.ip_hash)::text || (ai_guest_sessions.browser_fingerprint)::text)) FILTER (WHERE (EXISTS ( SELECT 1
                   FROM public.ai_guest_rate_limits rl
                  WHERE (((rl.ip_hash)::text = (ai_guest_sessions.ip_hash)::text) AND ((rl.browser_fingerprint)::text = (ai_guest_sessions.browser_fingerprint)::text) AND (rl.was_allowed = false))))) AS stage_4_limit_reached,
            count(*) FILTER (WHERE (ai_guest_sessions.converted_to_signup = true)) AS stage_5_converted
           FROM public.ai_guest_sessions
          GROUP BY (date(ai_guest_sessions.session_started_at))
        )
 SELECT date,
    stage_1_unique_visitors,
    stage_2_trials_started,
    stage_3_previews_shown,
    stage_4_limit_reached,
    stage_5_converted,
    round((((stage_5_converted)::numeric / (NULLIF(stage_1_unique_visitors, 0))::numeric) * (100)::numeric), 2) AS overall_conversion_rate
   FROM funnel_stages
  ORDER BY date DESC;


--
-- Name: ai_guest_metrics_daily; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.ai_guest_metrics_daily AS
 SELECT date(session_started_at) AS date,
    feature_name,
    count(DISTINCT ((ip_hash)::text || (browser_fingerprint)::text)) AS unique_guests,
    count(*) AS total_sessions,
    count(*) FILTER (WHERE (result_previewed = true)) AS previews_shown,
    count(*) FILTER (WHERE (converted_to_signup = true)) AS conversions,
    round((((count(*) FILTER (WHERE (converted_to_signup = true)))::numeric / (NULLIF(count(*), 0))::numeric) * (100)::numeric), 2) AS conversion_rate
   FROM public.ai_guest_sessions
  GROUP BY (date(session_started_at)), feature_name;


--
-- Name: ai_preview_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_preview_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_fingerprint text NOT NULL,
    feature_type text NOT NULL,
    input_data jsonb NOT NULL,
    preview_content jsonb NOT NULL,
    full_content_encrypted text NOT NULL,
    user_id uuid,
    converted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    ip_address inet,
    user_agent text,
    shareable_id text,
    share_count integer DEFAULT 0,
    CONSTRAINT ai_preview_sessions_feature_type_check CHECK ((feature_type = ANY (ARRAY['resume_analysis'::text, 'job_fit'::text, 'cover_letter'::text, 'interview_prep'::text])))
);


--
-- Name: ai_preview_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_preview_usage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    fingerprint text NOT NULL,
    ip_address inet NOT NULL,
    feature_type text NOT NULL,
    used_at timestamp with time zone DEFAULT now()
);


--
-- Name: ai_trial_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_trial_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    user_id uuid,
    feature_name text NOT NULL,
    input_data jsonb NOT NULL,
    result_data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval),
    accessed_at timestamp with time zone,
    access_count integer DEFAULT 0,
    CONSTRAINT ai_trial_results_feature_check CHECK ((feature_name = ANY (ARRAY['job_fit_analysis'::text, 'cover_letter'::text, 'resume_analysis'::text, 'interview_prep'::text, 'career_advice'::text])))
);


--
-- Name: ai_usage_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_usage_stats (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    feature_name text NOT NULL,
    stat_date date NOT NULL,
    stat_hour integer,
    total_requests integer DEFAULT 0,
    unique_users integer DEFAULT 0,
    successful_requests integer DEFAULT 0,
    failed_requests integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: ai_usage_tracking; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_usage_tracking (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    feature_name text NOT NULL,
    used_at timestamp with time zone DEFAULT now(),
    success boolean DEFAULT true,
    error_message text,
    metadata jsonb,
    response_time_ms integer
);


--
-- Name: ai_user_limit_overrides; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_user_limit_overrides (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    feature_name text NOT NULL,
    daily_limit integer,
    hourly_limit integer,
    expires_at timestamp with time zone,
    reason text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: cover_letters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cover_letters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    application_id uuid,
    company_name text,
    role_name text,
    job_description text NOT NULL,
    cover_letter text NOT NULL,
    tone text DEFAULT 'professional'::text,
    additional_info text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    user_resume_id uuid
);


--
-- Name: interview_prep; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.interview_prep (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    user_resume_id uuid,
    resume_text text,
    job_description text,
    job_url text,
    interview_context text,
    prep_content jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);


--
-- Name: job_fit_analysis; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_fit_analysis (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    job_description text NOT NULL,
    analysis_result text NOT NULL,
    fit_score integer NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    application_id uuid,
    user_resume_id uuid,
    CONSTRAINT job_fit_analysis_fit_score_check CHECK (((fit_score >= 0) AND (fit_score <= 100)))
);


--
-- Name: application_ai_analyses; Type: MATERIALIZED VIEW; Schema: public; Owner: -
--

CREATE MATERIALIZED VIEW public.application_ai_analyses AS
 SELECT a.id AS application_id,
    a.user_id,
    (count(DISTINCT jf.id))::integer AS job_fit_count,
    (count(DISTINCT cl.id))::integer AS cover_letter_count,
    (count(DISTINCT ip.id))::integer AS interview_prep_count,
    max(jf.created_at) AS latest_job_fit,
    max(cl.created_at) AS latest_cover_letter,
    max(ip.created_at) AS latest_interview_prep,
    max(jf.fit_score) AS best_fit_score
   FROM (((public.applications a
     LEFT JOIN public.job_fit_analysis jf ON ((a.id = jf.application_id)))
     LEFT JOIN public.cover_letters cl ON ((a.id = cl.application_id)))
     LEFT JOIN public.interview_prep ip ON (((ip.user_id = a.user_id) AND (ip.job_url IS NOT NULL) AND (a.role_link IS NOT NULL) AND (ip.job_url = a.role_link))))
  GROUP BY a.id, a.user_id
  WITH NO DATA;


--
-- Name: application_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.application_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    application_id uuid NOT NULL,
    old_status text,
    new_status text NOT NULL,
    changed_at timestamp with time zone DEFAULT now(),
    notes text
);


--
-- Name: application_linkedin_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.application_linkedin_contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    application_id uuid NOT NULL,
    linkedin_profile_id uuid NOT NULL,
    user_id uuid NOT NULL,
    relationship_type text,
    notes text,
    contacted boolean DEFAULT false NOT NULL,
    contacted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: audience_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audience_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    user_id uuid,
    current_audience text NOT NULL,
    resend_contact_id text,
    subscribed boolean DEFAULT true,
    first_name text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT audience_members_audience_check CHECK ((current_audience = ANY (ARRAY['leads'::text, 'free-users'::text, 'trial-users'::text, 'paid-users'::text])))
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    user_email text,
    user_name text,
    action text NOT NULL,
    entity_type text,
    entity_id text,
    old_values jsonb,
    new_values jsonb,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: campaign_sends; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_sends (
    campaign text NOT NULL,
    sent_at timestamp with time zone DEFAULT now() NOT NULL,
    recipient_count integer DEFAULT 0 NOT NULL,
    metadata jsonb
);


--
-- Name: career_advice; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.career_advice (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    content text NOT NULL,
    is_user boolean DEFAULT true NOT NULL,
    conversation_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: career_goals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.career_goals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    goal text NOT NULL,
    timeframe text DEFAULT '90d'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone
);


--
-- Name: career_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.career_profiles (
    user_id uuid NOT NULL,
    mode text DEFAULT 'promotion'::text NOT NULL,
    role text,
    level text,
    time_in_role text,
    target text,
    review_date date,
    zero_to_case_completed_at timestamp with time zone,
    starter_case text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT career_profiles_mode_check CHECK ((mode = ANY (ARRAY['promotion'::text, 'raise'::text, 'job_search'::text])))
);


--
-- Name: career_waitlist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.career_waitlist (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    user_id uuid,
    review_timing text,
    source text NOT NULL,
    utm jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT career_waitlist_review_timing_check CHECK ((review_timing = ANY (ARRAY['lt_3_months'::text, '3_6_months'::text, '6_12_months'::text, 'no_formal_reviews'::text, 'not_sure'::text]))),
    CONSTRAINT career_waitlist_source_check CHECK ((source = ANY (ARRAY['email'::text, 'banner'::text, 'direct'::text])))
);


--
-- Name: cleanup_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cleanup_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    table_name character varying(50) NOT NULL,
    deleted_count integer DEFAULT 0 NOT NULL,
    cleaned_at timestamp with time zone DEFAULT now(),
    metadata jsonb DEFAULT '{}'::jsonb
);


--
-- Name: coach_memory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coach_memory (
    user_id uuid NOT NULL,
    summary text,
    messages jsonb DEFAULT '[]'::jsonb NOT NULL,
    goal_id text,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: comp_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comp_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    effective_date date NOT NULL,
    base numeric(12,2) NOT NULL,
    bonus numeric(12,2) DEFAULT 0 NOT NULL,
    equity numeric(12,2) DEFAULT 0 NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    ticker text,
    shares numeric(14,4),
    vest_start date,
    vest_years numeric(4,2),
    vest_cliff_months integer
);


--
-- Name: conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: drip_emails; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.drip_emails (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    user_id uuid,
    audience text NOT NULL,
    template_id text NOT NULL,
    scheduled_for timestamp with time zone NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    sent_at timestamp with time zone,
    error text,
    created_at timestamp with time zone DEFAULT now(),
    opened_at timestamp with time zone,
    clicked_at timestamp with time zone,
    CONSTRAINT drip_emails_audience_check CHECK ((audience = ANY (ARRAY['leads'::text, 'free-users'::text, 'trial-users'::text, 'paid-users'::text]))),
    CONSTRAINT drip_emails_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text, 'cancelled'::text])))
);


--
-- Name: email_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_preferences (
    user_id uuid NOT NULL,
    drip_enabled boolean DEFAULT true NOT NULL,
    reminders_enabled boolean DEFAULT true NOT NULL,
    digest_enabled boolean DEFAULT true NOT NULL,
    unsubscribed_all boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: linkedin_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.linkedin_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    application_id uuid NOT NULL,
    profile_url text NOT NULL,
    name text,
    title text,
    created_at timestamp with time zone DEFAULT now(),
    user_id uuid,
    profile_photo_url text,
    headline text,
    company text,
    location text,
    username text,
    notes text
);


--
-- Name: linkedin_profiles_new; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.linkedin_profiles_new (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_url text NOT NULL,
    username text,
    name text,
    headline text,
    title text,
    company text,
    location text,
    profile_photo_url text,
    last_scraped_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    full_name text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    onboarding_completed boolean DEFAULT false,
    career_mode text DEFAULT 'job_seeking'::text NOT NULL,
    career_mode_updated_at timestamp with time zone DEFAULT now(),
    ai_analyses_used integer DEFAULT 0 NOT NULL,
    ai_trial_onboarding_completed boolean DEFAULT false NOT NULL,
    CONSTRAINT ai_analyses_used_non_negative CHECK ((ai_analyses_used >= 0)),
    CONSTRAINT profiles_career_mode_check CHECK ((career_mode = ANY (ARRAY['job_seeking'::text, 'employed'::text, 'exploring'::text])))
);


--
-- Name: promo_code_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promo_code_usage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    code text NOT NULL,
    type text,
    applied_at timestamp with time zone DEFAULT now(),
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT promo_code_usage_type_check CHECK ((type = ANY (ARRAY['discount'::text, 'free_forever'::text, 'trial'::text])))
);


--
-- Name: promo_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promo_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    description text,
    trial_days integer DEFAULT 90 NOT NULL,
    plan_name text DEFAULT 'AI Coach'::text NOT NULL,
    max_uses integer,
    used_count integer DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    code_type text DEFAULT 'trial'::text NOT NULL,
    stripe_coupon_id text,
    discount_percent integer,
    discount_amount integer,
    discount_duration text,
    discount_duration_months integer,
    applicable_plans jsonb DEFAULT '["All Plans"]'::jsonb,
    stripe_promotion_code_id text,
    is_welcome_offer boolean DEFAULT false,
    CONSTRAINT promo_codes_code_type_check CHECK ((code_type = ANY (ARRAY['trial'::text, 'discount'::text, 'premium_free'::text]))),
    CONSTRAINT promo_codes_discount_amount_check CHECK ((discount_amount >= 0)),
    CONSTRAINT promo_codes_discount_duration_check CHECK ((discount_duration = ANY (ARRAY['once'::text, 'repeating'::text, 'forever'::text]))),
    CONSTRAINT promo_codes_discount_percent_check CHECK (((discount_percent >= 0) AND (discount_percent <= 100)))
);


--
-- Name: resume_analysis; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.resume_analysis (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    user_resume_id uuid,
    resume_text text,
    job_description text,
    job_url text,
    analysis_result jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);


--
-- Name: roasts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roasts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shareable_id character varying(12) NOT NULL,
    content text NOT NULL,
    score_label character varying(50),
    first_name character varying(50),
    roast_categories jsonb,
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone DEFAULT (now() + '30 days'::interval),
    ip_hash character varying(64),
    browser_fingerprint character varying(64),
    view_count integer DEFAULT 0,
    user_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb,
    emoji_score character varying(50),
    tagline text
);


--
-- Name: scheduled_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scheduled_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    email text NOT NULL,
    type text NOT NULL,
    scheduled_for timestamp with time zone NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    sent_at timestamp with time zone,
    error text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT scheduled_notifications_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text, 'cancelled'::text])))
);


--
-- Name: stock_prices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_prices (
    ticker text NOT NULL,
    price numeric(14,4) NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    as_of timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: subscription_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    price_monthly numeric(10,2),
    price_yearly numeric(10,2),
    max_applications integer,
    features jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    stripe_monthly_price_id text,
    stripe_yearly_price_id text,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: tailored_resumes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tailored_resumes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    application_id uuid NOT NULL,
    tailored_text text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: trial_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trial_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    promo_code text NOT NULL,
    trial_start timestamp with time zone NOT NULL,
    trial_end timestamp with time zone NOT NULL,
    plan_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: usage_tracking; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usage_tracking (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    applications_count integer DEFAULT 0,
    last_updated timestamp with time zone DEFAULT now()
);


--
-- Name: user_announcements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_announcements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    announcement_id character varying(50) NOT NULL,
    seen_at timestamp with time zone DEFAULT now() NOT NULL,
    dismissed boolean DEFAULT false,
    clicked_cta boolean DEFAULT false
);


--
-- Name: user_application_analyses; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.user_application_analyses AS
 SELECT application_id,
    user_id,
    job_fit_count,
    cover_letter_count,
    interview_prep_count,
    latest_job_fit,
    latest_cover_letter,
    latest_interview_prep,
    best_fit_score
   FROM public.application_ai_analyses
  WHERE (user_id = auth.uid());


--
-- Name: user_onboarding; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_onboarding (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    flow_id character varying(50) NOT NULL,
    flow_version integer DEFAULT 1 NOT NULL,
    current_step_index integer DEFAULT 0 NOT NULL,
    completed_steps text[] DEFAULT '{}'::text[],
    skipped_steps text[] DEFAULT '{}'::text[],
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    dismissed boolean DEFAULT false,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_onboarding_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_onboarding_preferences (
    user_id uuid NOT NULL,
    enable_tooltips boolean DEFAULT true,
    enable_announcements boolean DEFAULT true,
    enable_guided_tours boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_resumes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_resumes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    file_url text NOT NULL,
    file_type text NOT NULL,
    extracted_text text,
    uploaded_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    name text DEFAULT 'My Resume'::text NOT NULL,
    description text,
    is_default boolean DEFAULT false,
    display_order integer DEFAULT 0,
    CONSTRAINT check_display_order_positive CHECK ((display_order > 0)),
    CONSTRAINT check_name_not_empty CHECK ((TRIM(BOTH FROM name) <> ''::text))
);


--
-- Name: user_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    status text DEFAULT 'active'::text,
    billing_cycle text DEFAULT 'monthly'::text,
    current_period_start timestamp with time zone DEFAULT now(),
    current_period_end timestamp with time zone,
    stripe_subscription_id text,
    stripe_customer_id text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    cancel_at_period_end boolean DEFAULT false,
    CONSTRAINT user_subscriptions_billing_cycle_check CHECK ((billing_cycle = ANY (ARRAY['monthly'::text, 'yearly'::text]))),
    CONSTRAINT user_subscriptions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'canceled'::text, 'past_due'::text, 'trialing'::text])))
);


--
-- Name: weekly_recaps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.weekly_recaps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    week_start date NOT NULL,
    generated_text text,
    wins_included integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT weekly_recaps_week_start_check CHECK ((EXTRACT(isodow FROM week_start) = (1)::numeric)),
    CONSTRAINT weekly_recaps_week_start_monday CHECK ((EXTRACT(dow FROM week_start) = (1)::numeric))
);


--
-- Name: wins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wins (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    text text NOT NULL,
    impact_number text,
    tag text,
    source text DEFAULT 'manual'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    edited_at timestamp with time zone,
    CONSTRAINT wins_source_check CHECK ((source = ANY (ARRAY['manual'::text, 'recap'::text, 'zero_to_case'::text, 'import'::text]))),
    CONSTRAINT wins_tag_check CHECK ((tag = ANY (ARRAY['delivery'::text, 'leadership'::text, 'collaboration'::text, 'craft'::text])))
);


--
-- Name: admin_users admin_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_pkey PRIMARY KEY (id);


--
-- Name: admin_users admin_users_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_user_id_key UNIQUE (user_id);


--
-- Name: ai_feature_limits ai_feature_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_feature_limits
    ADD CONSTRAINT ai_feature_limits_pkey PRIMARY KEY (id);


--
-- Name: ai_feature_limits ai_feature_limits_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_feature_limits
    ADD CONSTRAINT ai_feature_limits_unique UNIQUE (feature_name, subscription_tier);


--
-- Name: ai_feature_usage ai_feature_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_feature_usage
    ADD CONSTRAINT ai_feature_usage_pkey PRIMARY KEY (id);


--
-- Name: ai_feature_usage ai_feature_usage_unique_user_feature_date; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_feature_usage
    ADD CONSTRAINT ai_feature_usage_unique_user_feature_date UNIQUE (user_id, feature_name, usage_date);


--
-- Name: ai_guest_conversions ai_guest_conversions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_guest_conversions
    ADD CONSTRAINT ai_guest_conversions_pkey PRIMARY KEY (id);


--
-- Name: ai_guest_conversions ai_guest_conversions_unique_user; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_guest_conversions
    ADD CONSTRAINT ai_guest_conversions_unique_user UNIQUE (user_id);


--
-- Name: ai_guest_rate_limits ai_guest_rate_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_guest_rate_limits
    ADD CONSTRAINT ai_guest_rate_limits_pkey PRIMARY KEY (id);


--
-- Name: ai_guest_sessions ai_guest_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_guest_sessions
    ADD CONSTRAINT ai_guest_sessions_pkey PRIMARY KEY (id);


--
-- Name: ai_preview_sessions ai_preview_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_preview_sessions
    ADD CONSTRAINT ai_preview_sessions_pkey PRIMARY KEY (id);


--
-- Name: ai_preview_sessions ai_preview_sessions_shareable_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_preview_sessions
    ADD CONSTRAINT ai_preview_sessions_shareable_id_key UNIQUE (shareable_id);


--
-- Name: ai_preview_usage ai_preview_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_preview_usage
    ADD CONSTRAINT ai_preview_usage_pkey PRIMARY KEY (id);


--
-- Name: ai_trial_results ai_trial_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_trial_results
    ADD CONSTRAINT ai_trial_results_pkey PRIMARY KEY (id);


--
-- Name: ai_usage_stats ai_usage_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage_stats
    ADD CONSTRAINT ai_usage_stats_pkey PRIMARY KEY (id);


--
-- Name: ai_usage_stats ai_usage_stats_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage_stats
    ADD CONSTRAINT ai_usage_stats_unique UNIQUE (feature_name, stat_date, stat_hour);


--
-- Name: ai_usage_tracking ai_usage_tracking_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage_tracking
    ADD CONSTRAINT ai_usage_tracking_pkey PRIMARY KEY (id);


--
-- Name: ai_user_limit_overrides ai_user_limit_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_user_limit_overrides
    ADD CONSTRAINT ai_user_limit_overrides_pkey PRIMARY KEY (id);


--
-- Name: ai_user_limit_overrides ai_user_limit_overrides_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_user_limit_overrides
    ADD CONSTRAINT ai_user_limit_overrides_unique UNIQUE (user_id, feature_name);


--
-- Name: application_history application_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_history
    ADD CONSTRAINT application_history_pkey PRIMARY KEY (id);


--
-- Name: application_linkedin_contacts application_linkedin_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_linkedin_contacts
    ADD CONSTRAINT application_linkedin_contacts_pkey PRIMARY KEY (id);


--
-- Name: applications applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_pkey PRIMARY KEY (id);


--
-- Name: audience_members audience_members_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audience_members
    ADD CONSTRAINT audience_members_email_key UNIQUE (email);


--
-- Name: audience_members audience_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audience_members
    ADD CONSTRAINT audience_members_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: campaign_sends campaign_sends_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_sends
    ADD CONSTRAINT campaign_sends_pkey PRIMARY KEY (campaign);


--
-- Name: career_advice career_advice_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.career_advice
    ADD CONSTRAINT career_advice_pkey PRIMARY KEY (id);


--
-- Name: career_goals career_goals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.career_goals
    ADD CONSTRAINT career_goals_pkey PRIMARY KEY (id);


--
-- Name: career_profiles career_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.career_profiles
    ADD CONSTRAINT career_profiles_pkey PRIMARY KEY (user_id);


--
-- Name: career_waitlist career_waitlist_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.career_waitlist
    ADD CONSTRAINT career_waitlist_email_key UNIQUE (email);


--
-- Name: career_waitlist career_waitlist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.career_waitlist
    ADD CONSTRAINT career_waitlist_pkey PRIMARY KEY (id);


--
-- Name: cleanup_logs cleanup_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cleanup_logs
    ADD CONSTRAINT cleanup_logs_pkey PRIMARY KEY (id);


--
-- Name: coach_memory coach_memory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coach_memory
    ADD CONSTRAINT coach_memory_pkey PRIMARY KEY (user_id);


--
-- Name: comp_entries comp_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comp_entries
    ADD CONSTRAINT comp_entries_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: cover_letters cover_letters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cover_letters
    ADD CONSTRAINT cover_letters_pkey PRIMARY KEY (id);


--
-- Name: drip_emails drip_emails_email_template_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drip_emails
    ADD CONSTRAINT drip_emails_email_template_id_key UNIQUE (email, template_id);


--
-- Name: drip_emails drip_emails_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drip_emails
    ADD CONSTRAINT drip_emails_pkey PRIMARY KEY (id);


--
-- Name: email_preferences email_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_preferences
    ADD CONSTRAINT email_preferences_pkey PRIMARY KEY (user_id);


--
-- Name: interview_prep interview_prep_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_prep
    ADD CONSTRAINT interview_prep_pkey PRIMARY KEY (id);


--
-- Name: job_fit_analysis job_fit_analysis_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_fit_analysis
    ADD CONSTRAINT job_fit_analysis_pkey PRIMARY KEY (id);


--
-- Name: linkedin_profiles_new linkedin_profiles_new_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_profiles_new
    ADD CONSTRAINT linkedin_profiles_new_pkey PRIMARY KEY (id);


--
-- Name: linkedin_profiles_new linkedin_profiles_new_profile_url_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_profiles_new
    ADD CONSTRAINT linkedin_profiles_new_profile_url_key UNIQUE (profile_url);


--
-- Name: linkedin_profiles linkedin_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_profiles
    ADD CONSTRAINT linkedin_profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_email_key UNIQUE (email);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: promo_code_usage promo_code_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_code_usage
    ADD CONSTRAINT promo_code_usage_pkey PRIMARY KEY (id);


--
-- Name: promo_codes promo_codes_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_codes
    ADD CONSTRAINT promo_codes_code_key UNIQUE (code);


--
-- Name: promo_codes promo_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_codes
    ADD CONSTRAINT promo_codes_pkey PRIMARY KEY (id);


--
-- Name: resume_analysis resume_analysis_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resume_analysis
    ADD CONSTRAINT resume_analysis_pkey PRIMARY KEY (id);


--
-- Name: roasts roasts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roasts
    ADD CONSTRAINT roasts_pkey PRIMARY KEY (id);


--
-- Name: roasts roasts_shareable_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roasts
    ADD CONSTRAINT roasts_shareable_id_key UNIQUE (shareable_id);


--
-- Name: scheduled_notifications scheduled_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_notifications
    ADD CONSTRAINT scheduled_notifications_pkey PRIMARY KEY (id);


--
-- Name: stock_prices stock_prices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_prices
    ADD CONSTRAINT stock_prices_pkey PRIMARY KEY (ticker);


--
-- Name: subscription_plans subscription_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_plans
    ADD CONSTRAINT subscription_plans_pkey PRIMARY KEY (id);


--
-- Name: tailored_resumes tailored_resumes_application_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tailored_resumes
    ADD CONSTRAINT tailored_resumes_application_unique UNIQUE (user_id, application_id);


--
-- Name: tailored_resumes tailored_resumes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tailored_resumes
    ADD CONSTRAINT tailored_resumes_pkey PRIMARY KEY (id);


--
-- Name: trial_history trial_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trial_history
    ADD CONSTRAINT trial_history_pkey PRIMARY KEY (id);


--
-- Name: trial_history trial_history_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trial_history
    ADD CONSTRAINT trial_history_user_id_key UNIQUE (user_id);


--
-- Name: application_linkedin_contacts unique_application_profile; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_linkedin_contacts
    ADD CONSTRAINT unique_application_profile UNIQUE (application_id, linkedin_profile_id);


--
-- Name: usage_tracking unique_user_usage; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_tracking
    ADD CONSTRAINT unique_user_usage UNIQUE (user_id);


--
-- Name: usage_tracking usage_tracking_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_tracking
    ADD CONSTRAINT usage_tracking_pkey PRIMARY KEY (id);


--
-- Name: user_announcements user_announcements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_announcements
    ADD CONSTRAINT user_announcements_pkey PRIMARY KEY (id);


--
-- Name: user_announcements user_announcements_user_id_announcement_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_announcements
    ADD CONSTRAINT user_announcements_user_id_announcement_id_key UNIQUE (user_id, announcement_id);


--
-- Name: user_onboarding user_onboarding_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_onboarding
    ADD CONSTRAINT user_onboarding_pkey PRIMARY KEY (id);


--
-- Name: user_onboarding_preferences user_onboarding_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_onboarding_preferences
    ADD CONSTRAINT user_onboarding_preferences_pkey PRIMARY KEY (user_id);


--
-- Name: user_onboarding user_onboarding_user_id_flow_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_onboarding
    ADD CONSTRAINT user_onboarding_user_id_flow_id_key UNIQUE (user_id, flow_id);


--
-- Name: user_resumes user_resumes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_resumes
    ADD CONSTRAINT user_resumes_pkey PRIMARY KEY (id);


--
-- Name: user_subscriptions user_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_subscriptions
    ADD CONSTRAINT user_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: weekly_recaps weekly_recaps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_recaps
    ADD CONSTRAINT weekly_recaps_pkey PRIMARY KEY (id);


--
-- Name: weekly_recaps weekly_recaps_user_id_week_start_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_recaps
    ADD CONSTRAINT weekly_recaps_user_id_week_start_key UNIQUE (user_id, week_start);


--
-- Name: wins wins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wins
    ADD CONSTRAINT wins_pkey PRIMARY KEY (id);


--
-- Name: comp_entries_user_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX comp_entries_user_date_idx ON public.comp_entries USING btree (user_id, effective_date DESC);


--
-- Name: idx_admin_users_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_users_user_id ON public.admin_users USING btree (user_id);


--
-- Name: idx_ai_feature_limits_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_feature_limits_lookup ON public.ai_feature_limits USING btree (feature_name, subscription_tier);


--
-- Name: idx_ai_feature_usage_feature_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_feature_usage_feature_date ON public.ai_feature_usage USING btree (feature_name, usage_date DESC);


--
-- Name: idx_ai_feature_usage_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_feature_usage_user_date ON public.ai_feature_usage USING btree (user_id, usage_date DESC);


--
-- Name: idx_ai_guest_conversions_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_guest_conversions_time ON public.ai_guest_conversions USING btree (converted_at DESC);


--
-- Name: idx_ai_guest_conversions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_guest_conversions_user ON public.ai_guest_conversions USING btree (user_id);


--
-- Name: idx_ai_guest_rate_limits_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_guest_rate_limits_lookup ON public.ai_guest_rate_limits USING btree (ip_hash, browser_fingerprint, feature_name, attempted_at DESC);


--
-- Name: idx_ai_guest_rate_limits_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_guest_rate_limits_time ON public.ai_guest_rate_limits USING btree (attempted_at DESC);


--
-- Name: idx_ai_guest_sessions_conversion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_guest_sessions_conversion ON public.ai_guest_sessions USING btree (converted_to_signup, session_started_at DESC) WHERE (converted_to_signup = true);


--
-- Name: idx_ai_guest_sessions_feature_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_guest_sessions_feature_time ON public.ai_guest_sessions USING btree (feature_name, session_started_at DESC);


--
-- Name: idx_ai_guest_sessions_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_guest_sessions_lookup ON public.ai_guest_sessions USING btree (ip_hash, browser_fingerprint);


--
-- Name: idx_ai_guest_sessions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_guest_sessions_user ON public.ai_guest_sessions USING btree (converted_user_id) WHERE (converted_user_id IS NOT NULL);


--
-- Name: idx_ai_preview_feature_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_preview_feature_type ON public.ai_preview_sessions USING btree (feature_type, created_at);


--
-- Name: idx_ai_preview_fingerprint; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_preview_fingerprint ON public.ai_preview_sessions USING btree (session_fingerprint, created_at);


--
-- Name: idx_ai_preview_shareable; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_preview_shareable ON public.ai_preview_sessions USING btree (shareable_id) WHERE (shareable_id IS NOT NULL);


--
-- Name: idx_ai_preview_usage_ip; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_preview_usage_ip ON public.ai_preview_usage USING btree (ip_address, feature_type, used_at);


--
-- Name: idx_ai_preview_usage_rate_limit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_preview_usage_rate_limit ON public.ai_preview_usage USING btree (fingerprint, feature_type, used_at);


--
-- Name: idx_ai_preview_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_preview_user ON public.ai_preview_sessions USING btree (user_id) WHERE (user_id IS NOT NULL);


--
-- Name: idx_ai_trial_results_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_trial_results_expires ON public.ai_trial_results USING btree (expires_at);


--
-- Name: idx_ai_trial_results_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_trial_results_session ON public.ai_trial_results USING btree (session_id);


--
-- Name: idx_ai_trial_results_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_trial_results_user ON public.ai_trial_results USING btree (user_id) WHERE (user_id IS NOT NULL);


--
-- Name: idx_ai_usage_stats_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_usage_stats_lookup ON public.ai_usage_stats USING btree (stat_date DESC, feature_name);


--
-- Name: idx_ai_usage_tracking_used_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_usage_tracking_used_at ON public.ai_usage_tracking USING btree (used_at DESC);


--
-- Name: idx_ai_usage_tracking_user_feature; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_usage_tracking_user_feature ON public.ai_usage_tracking USING btree (user_id, feature_name, used_at DESC);


--
-- Name: idx_app_linkedin_contacts_app_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_linkedin_contacts_app_id ON public.application_linkedin_contacts USING btree (application_id);


--
-- Name: idx_app_linkedin_contacts_profile_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_linkedin_contacts_profile_id ON public.application_linkedin_contacts USING btree (linkedin_profile_id);


--
-- Name: idx_app_linkedin_contacts_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_linkedin_contacts_user_id ON public.application_linkedin_contacts USING btree (user_id);


--
-- Name: idx_application_ai_analyses_app_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_application_ai_analyses_app_id ON public.application_ai_analyses USING btree (application_id);


--
-- Name: idx_application_ai_analyses_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_application_ai_analyses_user_id ON public.application_ai_analyses USING btree (user_id);


--
-- Name: idx_application_history_application_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_application_history_application_id ON public.application_history USING btree (application_id);


--
-- Name: idx_application_history_changed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_application_history_changed_at ON public.application_history USING btree (changed_at);


--
-- Name: idx_applications_archived; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_applications_archived ON public.applications USING btree (user_id, archived);


--
-- Name: idx_applications_date_applied; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_applications_date_applied ON public.applications USING btree (date_applied);


--
-- Name: idx_applications_job_description; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_applications_job_description ON public.applications USING gin (to_tsvector('english'::regconfig, job_description)) WHERE (job_description IS NOT NULL);


--
-- Name: idx_applications_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_applications_status ON public.applications USING btree (status);


--
-- Name: idx_applications_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_applications_user_id ON public.applications USING btree (user_id);


--
-- Name: idx_audience_members_audience; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audience_members_audience ON public.audience_members USING btree (current_audience);


--
-- Name: idx_audience_members_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audience_members_user_id ON public.audience_members USING btree (user_id);


--
-- Name: idx_audit_logs_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (action);


--
-- Name: idx_audit_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at DESC);


--
-- Name: idx_audit_logs_entity_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_entity_type_id ON public.audit_logs USING btree (entity_type, entity_id);


--
-- Name: idx_audit_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_user_id ON public.audit_logs USING btree (user_id);


--
-- Name: idx_career_advice_conversation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_career_advice_conversation_id ON public.career_advice USING btree (conversation_id);


--
-- Name: idx_career_advice_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_career_advice_created_at ON public.career_advice USING btree (created_at DESC);


--
-- Name: idx_career_advice_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_career_advice_user_id ON public.career_advice USING btree (user_id);


--
-- Name: idx_career_goals_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_career_goals_user_id ON public.career_goals USING btree (user_id);


--
-- Name: idx_career_waitlist_review_timing; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_career_waitlist_review_timing ON public.career_waitlist USING btree (review_timing);


--
-- Name: idx_cleanup_logs_cleaned_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cleanup_logs_cleaned_at ON public.cleanup_logs USING btree (cleaned_at DESC);


--
-- Name: idx_conversations_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_updated_at ON public.conversations USING btree (updated_at DESC);


--
-- Name: idx_conversations_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_user_id ON public.conversations USING btree (user_id);


--
-- Name: idx_cover_letters_application_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cover_letters_application_id ON public.cover_letters USING btree (application_id);


--
-- Name: idx_cover_letters_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cover_letters_created_at ON public.cover_letters USING btree (created_at DESC);


--
-- Name: idx_cover_letters_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cover_letters_user_id ON public.cover_letters USING btree (user_id);


--
-- Name: idx_cover_letters_user_resume_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cover_letters_user_resume_id ON public.cover_letters USING btree (user_resume_id);


--
-- Name: idx_drip_emails_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_drip_emails_email ON public.drip_emails USING btree (email);


--
-- Name: idx_drip_emails_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_drip_emails_pending ON public.drip_emails USING btree (scheduled_for, status) WHERE (status = 'pending'::text);


--
-- Name: idx_drip_emails_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_drip_emails_user_id ON public.drip_emails USING btree (user_id);


--
-- Name: idx_interview_prep_job_url; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interview_prep_job_url ON public.interview_prep USING btree (job_url);


--
-- Name: idx_interview_prep_user_resume_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interview_prep_user_resume_id ON public.interview_prep USING btree (user_resume_id);


--
-- Name: idx_job_fit_analysis_application_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_fit_analysis_application_id ON public.job_fit_analysis USING btree (application_id);


--
-- Name: idx_job_fit_analysis_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_fit_analysis_created_at ON public.job_fit_analysis USING btree (created_at);


--
-- Name: idx_job_fit_analysis_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_fit_analysis_user_id ON public.job_fit_analysis USING btree (user_id);


--
-- Name: idx_job_fit_analysis_user_resume_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_fit_analysis_user_resume_id ON public.job_fit_analysis USING btree (user_resume_id);


--
-- Name: idx_linkedin_profiles_application_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linkedin_profiles_application_id ON public.linkedin_profiles USING btree (application_id);


--
-- Name: idx_linkedin_profiles_url; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_linkedin_profiles_url ON public.linkedin_profiles_new USING btree (profile_url);


--
-- Name: idx_linkedin_profiles_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linkedin_profiles_user_id ON public.linkedin_profiles USING btree (user_id);


--
-- Name: idx_profiles_career_mode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_career_mode ON public.profiles USING btree (career_mode);


--
-- Name: idx_profiles_onboarding; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_onboarding ON public.profiles USING btree (onboarding_completed) WHERE (onboarding_completed = false);


--
-- Name: idx_promo_code_usage_applied_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promo_code_usage_applied_at ON public.promo_code_usage USING btree (applied_at);


--
-- Name: idx_promo_code_usage_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promo_code_usage_code ON public.promo_code_usage USING btree (code);


--
-- Name: idx_promo_code_usage_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promo_code_usage_user_id ON public.promo_code_usage USING btree (user_id);


--
-- Name: idx_promo_codes_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promo_codes_active ON public.promo_codes USING btree (active, expires_at);


--
-- Name: idx_promo_codes_applicable_plans; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promo_codes_applicable_plans ON public.promo_codes USING gin (applicable_plans);


--
-- Name: idx_promo_codes_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promo_codes_code ON public.promo_codes USING btree (code) WHERE (active = true);


--
-- Name: idx_promo_codes_welcome_offer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_promo_codes_welcome_offer ON public.promo_codes USING btree (is_welcome_offer) WHERE ((is_welcome_offer = true) AND (active = true));


--
-- Name: idx_resume_analysis_user_resume_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resume_analysis_user_resume_id ON public.resume_analysis USING btree (user_resume_id);


--
-- Name: idx_roasts_browser_fingerprint; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_roasts_browser_fingerprint ON public.roasts USING btree (browser_fingerprint);


--
-- Name: idx_roasts_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_roasts_created_at ON public.roasts USING btree (created_at DESC);


--
-- Name: idx_roasts_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_roasts_expires_at ON public.roasts USING btree (expires_at);


--
-- Name: idx_roasts_ip_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_roasts_ip_hash ON public.roasts USING btree (ip_hash);


--
-- Name: idx_roasts_shareable_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_roasts_shareable_id ON public.roasts USING btree (shareable_id);


--
-- Name: idx_roasts_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_roasts_user_id ON public.roasts USING btree (user_id);


--
-- Name: idx_scheduled_notifications_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scheduled_notifications_pending ON public.scheduled_notifications USING btree (scheduled_for, status) WHERE (status = 'pending'::text);


--
-- Name: idx_scheduled_notifications_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scheduled_notifications_user ON public.scheduled_notifications USING btree (user_id);


--
-- Name: idx_subscription_plans_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_plans_active ON public.subscription_plans USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_subscription_plans_monthly_price; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_plans_monthly_price ON public.subscription_plans USING btree (stripe_monthly_price_id);


--
-- Name: idx_subscription_plans_yearly_price; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_plans_yearly_price ON public.subscription_plans USING btree (stripe_yearly_price_id);


--
-- Name: idx_usage_tracking_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usage_tracking_user_id ON public.usage_tracking USING btree (user_id);


--
-- Name: idx_user_announcements_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_announcements_user_id ON public.user_announcements USING btree (user_id);


--
-- Name: idx_user_onboarding_completed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_onboarding_completed ON public.user_onboarding USING btree (user_id, completed_at);


--
-- Name: idx_user_onboarding_flow_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_onboarding_flow_id ON public.user_onboarding USING btree (flow_id);


--
-- Name: idx_user_onboarding_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_onboarding_user_id ON public.user_onboarding USING btree (user_id);


--
-- Name: idx_user_resumes_one_default_per_user; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_user_resumes_one_default_per_user ON public.user_resumes USING btree (user_id) WHERE (is_default = true);


--
-- Name: idx_user_resumes_user_display_order; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_user_resumes_user_display_order ON public.user_resumes USING btree (user_id, display_order);


--
-- Name: idx_user_resumes_user_id_default; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_resumes_user_id_default ON public.user_resumes USING btree (user_id, is_default);


--
-- Name: idx_user_resumes_user_id_is_default; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_resumes_user_id_is_default ON public.user_resumes USING btree (user_id, is_default) WHERE (is_default = true);


--
-- Name: idx_user_resumes_user_id_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_resumes_user_id_order ON public.user_resumes USING btree (user_id, display_order);


--
-- Name: idx_user_subscriptions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_subscriptions_status ON public.user_subscriptions USING btree (status);


--
-- Name: idx_user_subscriptions_user_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_user_subscriptions_user_active ON public.user_subscriptions USING btree (user_id) WHERE (status = 'active'::text);


--
-- Name: idx_user_subscriptions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_subscriptions_user_id ON public.user_subscriptions USING btree (user_id);


--
-- Name: tailored_resumes_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tailored_resumes_user_idx ON public.tailored_resumes USING btree (user_id, created_at DESC);


--
-- Name: weekly_recaps_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX weekly_recaps_user_idx ON public.weekly_recaps USING btree (user_id, week_start DESC);


--
-- Name: wins_user_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX wins_user_created_idx ON public.wins USING btree (user_id, created_at DESC);


--
-- Name: career_goals career_goals_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER career_goals_updated_at BEFORE UPDATE ON public.career_goals FOR EACH ROW EXECUTE FUNCTION public.update_career_goals_updated_at();


--
-- Name: promo_codes ensure_single_welcome_offer_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER ensure_single_welcome_offer_trigger BEFORE INSERT OR UPDATE ON public.promo_codes FOR EACH ROW EXECUTE FUNCTION public.ensure_single_welcome_offer();


--
-- Name: applications handle_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: career_profiles handle_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.career_profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: cover_letters handle_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.cover_letters FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: profiles handle_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: ai_feature_usage handle_updated_at_ai_feature_usage; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER handle_updated_at_ai_feature_usage BEFORE UPDATE ON public.ai_feature_usage FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: promo_codes handle_updated_at_promo_codes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER handle_updated_at_promo_codes BEFORE UPDATE ON public.promo_codes FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: user_subscriptions handle_updated_at_subscriptions; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER handle_updated_at_subscriptions BEFORE UPDATE ON public.user_subscriptions FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: audience_members trigger_audience_members_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_audience_members_updated_at BEFORE UPDATE ON public.audience_members FOR EACH ROW EXECUTE FUNCTION public.update_audience_members_updated_at();


--
-- Name: user_resumes trigger_auto_assign_default_resume; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_auto_assign_default_resume BEFORE DELETE ON public.user_resumes FOR EACH ROW EXECUTE FUNCTION public.auto_assign_default_resume();


--
-- Name: user_resumes trigger_check_resume_limit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_check_resume_limit BEFORE INSERT ON public.user_resumes FOR EACH ROW EXECUTE FUNCTION public.check_resume_limit();


--
-- Name: user_resumes trigger_enforce_one_default_resume; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_enforce_one_default_resume BEFORE INSERT OR UPDATE ON public.user_resumes FOR EACH ROW EXECUTE FUNCTION public.enforce_one_default_resume();


--
-- Name: applications trigger_refresh_analyses_on_application; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_refresh_analyses_on_application AFTER INSERT OR DELETE ON public.applications FOR EACH STATEMENT EXECUTE FUNCTION public.refresh_application_ai_analyses();


--
-- Name: cover_letters trigger_refresh_analyses_on_cover_letter; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_refresh_analyses_on_cover_letter AFTER INSERT OR DELETE OR UPDATE ON public.cover_letters FOR EACH STATEMENT EXECUTE FUNCTION public.refresh_application_ai_analyses();


--
-- Name: interview_prep trigger_refresh_analyses_on_interview_prep; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_refresh_analyses_on_interview_prep AFTER INSERT OR DELETE OR UPDATE ON public.interview_prep FOR EACH STATEMENT EXECUTE FUNCTION public.refresh_application_ai_analyses();


--
-- Name: job_fit_analysis trigger_refresh_analyses_on_job_fit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_refresh_analyses_on_job_fit AFTER INSERT OR DELETE OR UPDATE ON public.job_fit_analysis FOR EACH STATEMENT EXECUTE FUNCTION public.refresh_application_ai_analyses();


--
-- Name: roasts trigger_set_shareable_id; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_set_shareable_id BEFORE INSERT ON public.roasts FOR EACH ROW WHEN ((new.shareable_id IS NULL)) EXECUTE FUNCTION public.set_shareable_id();


--
-- Name: user_resumes trigger_user_resumes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_user_resumes_updated_at BEFORE UPDATE ON public.user_resumes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: applications update_usage_on_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_usage_on_delete AFTER DELETE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.update_usage_count();


--
-- Name: applications update_usage_on_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_usage_on_insert AFTER INSERT ON public.applications FOR EACH ROW EXECUTE FUNCTION public.update_usage_count();


--
-- Name: user_onboarding_preferences update_user_onboarding_preferences_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_onboarding_preferences_updated_at BEFORE UPDATE ON public.user_onboarding_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: user_onboarding update_user_onboarding_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_onboarding_updated_at BEFORE UPDATE ON public.user_onboarding FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: admin_users admin_users_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: ai_feature_usage ai_feature_usage_user_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_feature_usage
    ADD CONSTRAINT ai_feature_usage_user_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: ai_guest_conversions ai_guest_conversions_session_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_guest_conversions
    ADD CONSTRAINT ai_guest_conversions_session_fkey FOREIGN KEY (guest_session_id) REFERENCES public.ai_guest_sessions(id) ON DELETE CASCADE;


--
-- Name: ai_guest_conversions ai_guest_conversions_user_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_guest_conversions
    ADD CONSTRAINT ai_guest_conversions_user_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: ai_guest_sessions ai_guest_sessions_user_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_guest_sessions
    ADD CONSTRAINT ai_guest_sessions_user_fkey FOREIGN KEY (converted_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: ai_preview_sessions ai_preview_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_preview_sessions
    ADD CONSTRAINT ai_preview_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: ai_trial_results ai_trial_results_session_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_trial_results
    ADD CONSTRAINT ai_trial_results_session_fkey FOREIGN KEY (session_id) REFERENCES public.ai_guest_sessions(id) ON DELETE CASCADE;


--
-- Name: ai_trial_results ai_trial_results_user_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_trial_results
    ADD CONSTRAINT ai_trial_results_user_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: ai_usage_tracking ai_usage_tracking_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage_tracking
    ADD CONSTRAINT ai_usage_tracking_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: ai_user_limit_overrides ai_user_limit_overrides_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_user_limit_overrides
    ADD CONSTRAINT ai_user_limit_overrides_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: ai_user_limit_overrides ai_user_limit_overrides_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_user_limit_overrides
    ADD CONSTRAINT ai_user_limit_overrides_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: application_history application_history_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_history
    ADD CONSTRAINT application_history_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;


--
-- Name: application_linkedin_contacts application_linkedin_contacts_app_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_linkedin_contacts
    ADD CONSTRAINT application_linkedin_contacts_app_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;


--
-- Name: application_linkedin_contacts application_linkedin_contacts_profile_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_linkedin_contacts
    ADD CONSTRAINT application_linkedin_contacts_profile_fkey FOREIGN KEY (linkedin_profile_id) REFERENCES public.linkedin_profiles_new(id) ON DELETE RESTRICT;


--
-- Name: application_linkedin_contacts application_linkedin_contacts_user_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_linkedin_contacts
    ADD CONSTRAINT application_linkedin_contacts_user_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: applications applications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: audience_members audience_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audience_members
    ADD CONSTRAINT audience_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: career_advice career_advice_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.career_advice
    ADD CONSTRAINT career_advice_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: career_advice career_advice_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.career_advice
    ADD CONSTRAINT career_advice_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: career_goals career_goals_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.career_goals
    ADD CONSTRAINT career_goals_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: career_profiles career_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.career_profiles
    ADD CONSTRAINT career_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: career_waitlist career_waitlist_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.career_waitlist
    ADD CONSTRAINT career_waitlist_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: coach_memory coach_memory_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coach_memory
    ADD CONSTRAINT coach_memory_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: comp_entries comp_entries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comp_entries
    ADD CONSTRAINT comp_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: cover_letters cover_letters_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cover_letters
    ADD CONSTRAINT cover_letters_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE SET NULL;


--
-- Name: cover_letters cover_letters_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cover_letters
    ADD CONSTRAINT cover_letters_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: cover_letters cover_letters_user_resume_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cover_letters
    ADD CONSTRAINT cover_letters_user_resume_id_fkey FOREIGN KEY (user_resume_id) REFERENCES public.user_resumes(id) ON DELETE SET NULL;


--
-- Name: drip_emails drip_emails_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drip_emails
    ADD CONSTRAINT drip_emails_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: email_preferences email_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_preferences
    ADD CONSTRAINT email_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: interview_prep interview_prep_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_prep
    ADD CONSTRAINT interview_prep_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: interview_prep interview_prep_user_resume_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interview_prep
    ADD CONSTRAINT interview_prep_user_resume_id_fkey FOREIGN KEY (user_resume_id) REFERENCES public.user_resumes(id) ON DELETE SET NULL;


--
-- Name: job_fit_analysis job_fit_analysis_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_fit_analysis
    ADD CONSTRAINT job_fit_analysis_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;


--
-- Name: job_fit_analysis job_fit_analysis_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_fit_analysis
    ADD CONSTRAINT job_fit_analysis_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: job_fit_analysis job_fit_analysis_user_resume_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_fit_analysis
    ADD CONSTRAINT job_fit_analysis_user_resume_id_fkey FOREIGN KEY (user_resume_id) REFERENCES public.user_resumes(id) ON DELETE SET NULL;


--
-- Name: linkedin_profiles linkedin_profiles_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_profiles
    ADD CONSTRAINT linkedin_profiles_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;


--
-- Name: linkedin_profiles linkedin_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linkedin_profiles
    ADD CONSTRAINT linkedin_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: promo_code_usage promo_code_usage_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_code_usage
    ADD CONSTRAINT promo_code_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: resume_analysis resume_analysis_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resume_analysis
    ADD CONSTRAINT resume_analysis_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: resume_analysis resume_analysis_user_resume_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resume_analysis
    ADD CONSTRAINT resume_analysis_user_resume_id_fkey FOREIGN KEY (user_resume_id) REFERENCES public.user_resumes(id) ON DELETE SET NULL;


--
-- Name: roasts roasts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roasts
    ADD CONSTRAINT roasts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: scheduled_notifications scheduled_notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_notifications
    ADD CONSTRAINT scheduled_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: tailored_resumes tailored_resumes_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tailored_resumes
    ADD CONSTRAINT tailored_resumes_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE;


--
-- Name: tailored_resumes tailored_resumes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tailored_resumes
    ADD CONSTRAINT tailored_resumes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: trial_history trial_history_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trial_history
    ADD CONSTRAINT trial_history_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.subscription_plans(id);


--
-- Name: trial_history trial_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trial_history
    ADD CONSTRAINT trial_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: usage_tracking usage_tracking_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage_tracking
    ADD CONSTRAINT usage_tracking_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: user_announcements user_announcements_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_announcements
    ADD CONSTRAINT user_announcements_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_onboarding_preferences user_onboarding_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_onboarding_preferences
    ADD CONSTRAINT user_onboarding_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_onboarding user_onboarding_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_onboarding
    ADD CONSTRAINT user_onboarding_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_resumes user_resumes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_resumes
    ADD CONSTRAINT user_resumes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: user_subscriptions user_subscriptions_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_subscriptions
    ADD CONSTRAINT user_subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.subscription_plans(id);


--
-- Name: user_subscriptions user_subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_subscriptions
    ADD CONSTRAINT user_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: weekly_recaps weekly_recaps_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_recaps
    ADD CONSTRAINT weekly_recaps_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: wins wins_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wins
    ADD CONSTRAINT wins_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: user_resumes Allow authenticated users to delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to delete" ON public.user_resumes FOR DELETE TO authenticated USING (true);


--
-- Name: user_resumes Allow authenticated users to insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to insert" ON public.user_resumes FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: user_resumes Allow authenticated users to select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to select" ON public.user_resumes FOR SELECT TO authenticated USING (true);


--
-- Name: user_resumes Allow authenticated users to update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to update" ON public.user_resumes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: subscription_plans Anyone can view subscription plans; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view subscription plans" ON public.subscription_plans FOR SELECT USING (true);


--
-- Name: roasts Authenticated users can create roasts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can create roasts" ON public.roasts FOR INSERT WITH CHECK (((auth.uid() = user_id) OR (user_id IS NULL)));


--
-- Name: ai_guest_sessions Authenticated users can read guest sessions for linking; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can read guest sessions for linking" ON public.ai_guest_sessions FOR SELECT TO authenticated USING (true);


--
-- Name: ai_guest_sessions Authenticated users can update guest sessions they link; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can update guest sessions they link" ON public.ai_guest_sessions FOR UPDATE TO authenticated USING (((converted_user_id IS NULL) OR (converted_user_id = auth.uid()))) WITH CHECK ((converted_user_id = auth.uid()));


--
-- Name: cleanup_logs Cleanup logs are viewable by authenticated users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Cleanup logs are viewable by authenticated users" ON public.cleanup_logs FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: roasts Public roasts are viewable by shareable_id; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public roasts are viewable by shareable_id" ON public.roasts FOR SELECT USING (true);


--
-- Name: promo_code_usage Service role can insert promo code usage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can insert promo code usage" ON public.promo_code_usage FOR INSERT WITH CHECK (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


--
-- Name: ai_feature_usage Service role full access to AI usage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access to AI usage" ON public.ai_feature_usage TO service_role USING (true);


--
-- Name: audience_members Service role full access to audience_members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access to audience_members" ON public.audience_members TO service_role USING (true) WITH CHECK (true);


--
-- Name: campaign_sends Service role full access to campaign_sends; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access to campaign_sends" ON public.campaign_sends TO service_role USING (true) WITH CHECK (true);


--
-- Name: career_waitlist Service role full access to career_waitlist; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access to career_waitlist" ON public.career_waitlist TO service_role USING (true) WITH CHECK (true);


--
-- Name: ai_guest_conversions Service role full access to conversions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access to conversions" ON public.ai_guest_conversions TO service_role USING (true);


--
-- Name: drip_emails Service role full access to drip_emails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access to drip_emails" ON public.drip_emails TO service_role USING (true) WITH CHECK (true);


--
-- Name: email_preferences Service role full access to email_preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access to email_preferences" ON public.email_preferences TO service_role USING (true) WITH CHECK (true);


--
-- Name: ai_trial_results Service role full access to trial results; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access to trial results" ON public.ai_trial_results TO service_role USING (true);


--
-- Name: ai_feature_usage Service role has full access to feature usage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role has full access to feature usage" ON public.ai_feature_usage USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


--
-- Name: ai_preview_sessions Service role has full access to preview sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role has full access to preview sessions" ON public.ai_preview_sessions USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


--
-- Name: ai_preview_usage Service role has full access to preview usage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role has full access to preview usage" ON public.ai_preview_usage USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


--
-- Name: ai_guest_rate_limits Service role only for guest rate limits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role only for guest rate limits" ON public.ai_guest_rate_limits TO service_role USING (true);


--
-- Name: scheduled_notifications System can create notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can create notifications" ON public.scheduled_notifications FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: promo_code_usage System can create promo code usage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can create promo code usage" ON public.promo_code_usage FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: trial_history System can create trial history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can create trial history" ON public.trial_history FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: ai_usage_tracking System can insert usage tracking; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can insert usage tracking" ON public.ai_usage_tracking FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: scheduled_notifications System can update notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can update notifications" ON public.scheduled_notifications FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: career_goals Users can CRUD own goals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can CRUD own goals" ON public.career_goals USING ((auth.uid() = user_id));


--
-- Name: interview_prep Users can access their own interview prep; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can access their own interview prep" ON public.interview_prep USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: resume_analysis Users can access their own resume analysis; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can access their own resume analysis" ON public.resume_analysis USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: promo_code_usage Users can check their promo code usage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can check their promo code usage" ON public.promo_code_usage FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: linkedin_profiles Users can delete linkedin profiles for own applications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete linkedin profiles for own applications" ON public.linkedin_profiles FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.applications
  WHERE ((applications.id = linkedin_profiles.application_id) AND (applications.user_id = auth.uid())))));


--
-- Name: applications Users can delete own applications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own applications" ON public.applications FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: user_resumes Users can delete own resume; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own resume" ON public.user_resumes FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: application_linkedin_contacts Users can delete their own LinkedIn contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own LinkedIn contacts" ON public.application_linkedin_contacts FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: linkedin_profiles Users can delete their own LinkedIn profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own LinkedIn profiles" ON public.linkedin_profiles FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: application_history Users can delete their own application history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own application history" ON public.application_history FOR DELETE USING ((application_id IN ( SELECT applications.id
   FROM public.applications
  WHERE (applications.user_id = auth.uid()))));


--
-- Name: career_advice Users can delete their own career advice messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own career advice messages" ON public.career_advice FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: coach_memory Users can delete their own coach memory; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own coach memory" ON public.coach_memory FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: conversations Users can delete their own conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own conversations" ON public.conversations FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: cover_letters Users can delete their own cover letters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own cover letters" ON public.cover_letters FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: job_fit_analysis Users can delete their own job fit analyses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own job fit analyses" ON public.job_fit_analysis FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: linkedin_profiles Users can insert linkedin profiles for own applications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert linkedin profiles for own applications" ON public.linkedin_profiles FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.applications
  WHERE ((applications.id = linkedin_profiles.application_id) AND (applications.user_id = auth.uid())))));


--
-- Name: applications Users can insert own applications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own applications" ON public.applications FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles Users can insert own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: user_resumes Users can insert own resume; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own resume" ON public.user_resumes FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_subscriptions Users can insert own subscription; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own subscription" ON public.user_subscriptions FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: usage_tracking Users can insert own usage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own usage" ON public.usage_tracking FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: application_linkedin_contacts Users can insert their own LinkedIn contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own LinkedIn contacts" ON public.application_linkedin_contacts FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: linkedin_profiles Users can insert their own LinkedIn profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own LinkedIn profiles" ON public.linkedin_profiles FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: application_history Users can insert their own application history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own application history" ON public.application_history FOR INSERT WITH CHECK ((application_id IN ( SELECT applications.id
   FROM public.applications
  WHERE (applications.user_id = auth.uid()))));


--
-- Name: career_advice Users can insert their own career advice messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own career advice messages" ON public.career_advice FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: coach_memory Users can insert their own coach memory; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own coach memory" ON public.coach_memory FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: conversations Users can insert their own conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own conversations" ON public.conversations FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: cover_letters Users can insert their own cover letters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own cover letters" ON public.cover_letters FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: job_fit_analysis Users can insert their own job fit analyses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own job fit analyses" ON public.job_fit_analysis FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_onboarding_preferences Users can manage their own preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own preferences" ON public.user_onboarding_preferences USING ((auth.uid() = user_id));


--
-- Name: promo_codes Users can read active promo codes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read active promo codes" ON public.promo_codes FOR SELECT TO authenticated USING ((active = true));


--
-- Name: admin_users Users can see own admin record; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can see own admin record" ON public.admin_users FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: ai_feature_usage Users can track own usage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can track own usage" ON public.ai_feature_usage FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: linkedin_profiles Users can update linkedin profiles for own applications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update linkedin profiles for own applications" ON public.linkedin_profiles FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.applications
  WHERE ((applications.id = linkedin_profiles.application_id) AND (applications.user_id = auth.uid())))));


--
-- Name: applications Users can update own applications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own applications" ON public.applications FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: email_preferences Users can update own email preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own email preferences" ON public.email_preferences FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: user_resumes Users can update own resume; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own resume" ON public.user_resumes FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: user_subscriptions Users can update own subscription; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own subscription" ON public.user_subscriptions FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: ai_feature_usage Users can update own usage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own usage" ON public.ai_feature_usage FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: usage_tracking Users can update own usage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own usage" ON public.usage_tracking FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: application_linkedin_contacts Users can update their own LinkedIn contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own LinkedIn contacts" ON public.application_linkedin_contacts FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: linkedin_profiles Users can update their own LinkedIn profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own LinkedIn profiles" ON public.linkedin_profiles FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: application_history Users can update their own application history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own application history" ON public.application_history FOR UPDATE USING ((application_id IN ( SELECT applications.id
   FROM public.applications
  WHERE (applications.user_id = auth.uid()))));


--
-- Name: career_advice Users can update their own career advice messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own career advice messages" ON public.career_advice FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: coach_memory Users can update their own coach memory; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own coach memory" ON public.coach_memory FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: conversations Users can update their own conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own conversations" ON public.conversations FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: cover_letters Users can update their own cover letters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own cover letters" ON public.cover_letters FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: job_fit_analysis Users can update their own job fit analyses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own job fit analyses" ON public.job_fit_analysis FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: ai_usage_stats Users can view aggregated stats; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view aggregated stats" ON public.ai_usage_stats FOR SELECT USING (true);


--
-- Name: ai_feature_limits Users can view feature limits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view feature limits" ON public.ai_feature_limits FOR SELECT USING (true);


--
-- Name: linkedin_profiles Users can view linkedin profiles for own applications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view linkedin profiles for own applications" ON public.linkedin_profiles FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.applications
  WHERE ((applications.id = linkedin_profiles.application_id) AND (applications.user_id = auth.uid())))));


--
-- Name: applications Users can view own applications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own applications" ON public.applications FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: audience_members Users can view own audience membership; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own audience membership" ON public.audience_members FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: drip_emails Users can view own drip emails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own drip emails" ON public.drip_emails FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: email_preferences Users can view own email preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own email preferences" ON public.email_preferences FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: scheduled_notifications Users can view own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own notifications" ON public.scheduled_notifications FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: profiles Users can view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: promo_code_usage Users can view own promo code usage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own promo code usage" ON public.promo_code_usage FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_resumes Users can view own resume; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own resume" ON public.user_resumes FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: ai_preview_sessions Users can view own sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own sessions" ON public.ai_preview_sessions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_subscriptions Users can view own subscription; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own subscription" ON public.user_subscriptions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: trial_history Users can view own trial history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own trial history" ON public.trial_history FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: ai_feature_usage Users can view own usage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own usage" ON public.ai_feature_usage FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: usage_tracking Users can view own usage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own usage" ON public.usage_tracking FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: ai_feature_usage Users can view their own AI usage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own AI usage" ON public.ai_feature_usage FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: application_linkedin_contacts Users can view their own LinkedIn contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own LinkedIn contacts" ON public.application_linkedin_contacts FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: linkedin_profiles Users can view their own LinkedIn profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own LinkedIn profiles" ON public.linkedin_profiles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_announcements Users can view their own announcements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own announcements" ON public.user_announcements USING ((auth.uid() = user_id));


--
-- Name: application_history Users can view their own application history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own application history" ON public.application_history FOR SELECT USING ((application_id IN ( SELECT applications.id
   FROM public.applications
  WHERE (applications.user_id = auth.uid()))));


--
-- Name: career_advice Users can view their own career advice messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own career advice messages" ON public.career_advice FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: coach_memory Users can view their own coach memory; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own coach memory" ON public.coach_memory FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: conversations Users can view their own conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own conversations" ON public.conversations FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: ai_guest_conversions Users can view their own conversion; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own conversion" ON public.ai_guest_conversions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: cover_letters Users can view their own cover letters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own cover letters" ON public.cover_letters FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: job_fit_analysis Users can view their own job fit analyses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own job fit analyses" ON public.job_fit_analysis FOR SELECT USING (((auth.uid() = user_id) AND (application_id IN ( SELECT applications.id
   FROM public.applications
  WHERE (applications.user_id = auth.uid())))));


--
-- Name: ai_user_limit_overrides Users can view their own limit overrides; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own limit overrides" ON public.ai_user_limit_overrides FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_onboarding Users can view their own onboarding progress; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own onboarding progress" ON public.user_onboarding USING ((auth.uid() = user_id));


--
-- Name: roasts Users can view their own roasts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own roasts" ON public.roasts FOR SELECT USING (((auth.uid() = user_id) OR (user_id IS NULL)));


--
-- Name: ai_trial_results Users can view their own trial results; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own trial results" ON public.ai_trial_results FOR SELECT USING (((auth.uid() = user_id) AND (expires_at > now())));


--
-- Name: ai_usage_tracking Users can view their own usage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own usage" ON public.ai_usage_tracking FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: admin_users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_feature_limits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_feature_limits ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_feature_usage; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_feature_usage ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_guest_conversions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_guest_conversions ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_guest_rate_limits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_guest_rate_limits ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_guest_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_guest_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_preview_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_preview_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_preview_usage; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_preview_usage ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_trial_results; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_trial_results ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_usage_stats; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_usage_stats ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_usage_tracking; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_usage_tracking ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_user_limit_overrides; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_user_limit_overrides ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_guest_sessions anon_can_insert_guest_sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_can_insert_guest_sessions ON public.ai_guest_sessions FOR INSERT TO anon WITH CHECK (true);


--
-- Name: ai_guest_sessions anon_can_select_guest_sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anon_can_select_guest_sessions ON public.ai_guest_sessions FOR SELECT TO anon USING (true);


--
-- Name: application_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.application_history ENABLE ROW LEVEL SECURITY;

--
-- Name: application_linkedin_contacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.application_linkedin_contacts ENABLE ROW LEVEL SECURITY;

--
-- Name: applications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

--
-- Name: audience_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audience_members ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_sends; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_sends ENABLE ROW LEVEL SECURITY;

--
-- Name: career_advice; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.career_advice ENABLE ROW LEVEL SECURITY;

--
-- Name: career_goals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.career_goals ENABLE ROW LEVEL SECURITY;

--
-- Name: career_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.career_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: career_waitlist; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.career_waitlist ENABLE ROW LEVEL SECURITY;

--
-- Name: cleanup_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cleanup_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: coach_memory; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.coach_memory ENABLE ROW LEVEL SECURITY;

--
-- Name: comp_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.comp_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: cover_letters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cover_letters ENABLE ROW LEVEL SECURITY;

--
-- Name: drip_emails; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.drip_emails ENABLE ROW LEVEL SECURITY;

--
-- Name: email_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: interview_prep; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.interview_prep ENABLE ROW LEVEL SECURITY;

--
-- Name: job_fit_analysis; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.job_fit_analysis ENABLE ROW LEVEL SECURITY;

--
-- Name: linkedin_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.linkedin_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: linkedin_profiles_new; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.linkedin_profiles_new ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: promo_code_usage; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.promo_code_usage ENABLE ROW LEVEL SECURITY;

--
-- Name: promo_codes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

--
-- Name: resume_analysis; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.resume_analysis ENABLE ROW LEVEL SECURITY;

--
-- Name: roasts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.roasts ENABLE ROW LEVEL SECURITY;

--
-- Name: scheduled_notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.scheduled_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_guest_sessions service_role_full_access_guest_sessions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_full_access_guest_sessions ON public.ai_guest_sessions TO service_role USING (true) WITH CHECK (true);


--
-- Name: stock_prices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stock_prices ENABLE ROW LEVEL SECURITY;

--
-- Name: subscription_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: tailored_resumes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tailored_resumes ENABLE ROW LEVEL SECURITY;

--
-- Name: trial_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trial_history ENABLE ROW LEVEL SECURITY;

--
-- Name: usage_tracking; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;

--
-- Name: user_announcements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_announcements ENABLE ROW LEVEL SECURITY;

--
-- Name: user_onboarding; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_onboarding ENABLE ROW LEVEL SECURITY;

--
-- Name: user_onboarding_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_onboarding_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: user_resumes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_resumes ENABLE ROW LEVEL SECURITY;

--
-- Name: user_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: weekly_recaps; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.weekly_recaps ENABLE ROW LEVEL SECURITY;

--
-- Name: wins; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.wins ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


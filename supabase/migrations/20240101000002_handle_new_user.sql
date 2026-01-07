-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NULL)
  );
  
  -- Initialize scan credits (free tier: 10 credits per month)
  INSERT INTO public.scan_credits (user_id, credits_remaining, plan_tier, reset_date)
  VALUES (
    NEW.id,
    10,
    'free',
    (CURRENT_DATE + INTERVAL '1 month')::DATE
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile and credits when user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

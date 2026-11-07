# Daily room code SMS setup

To text the daily room code to both partners automatically:

1. Create a Twilio account and get Account SID, Auth Token, and a phone number.
2. Deploy the edge function in `supabase/functions/send-daily-code`.
3. Set Supabase secrets:
   - TWILIO_ACCOUNT_SID
   - TWILIO_AUTH_TOKEN
   - TWILIO_FROM_NUMBER
4. Schedule a daily job (Supabase cron or external) that calls the function for each partner's phone number with the day's code (compute via the same SHA-256 logic in `lib/lock.ts`).
5. Store partner phone numbers in a secure table or environment.

The app shows today's code in Settings for manual sharing as a fallback.
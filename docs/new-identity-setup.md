# New identity setup checklist

The owner performs these steps in Apple/GitHub/Supabase. Code only consumes results.

1. New explicit App ID / bundle identifier in Apple Developer (push enabled, not wildcard).
2. New App Store Connect app record for that bundle ID.
3. New ASC API key, `.p8` downloaded once; record Key ID and Issuer ID.
4. New empty GitHub repo for the app, and a second new empty repo for match.
5. New Supabase project; record URL and anon key.
6. Add all GitHub secrets (see deploy-ios.yml).
7. Run the `bootstrap-match` workflow once, manually, to generate fresh certs and a fresh profile for the new bundle ID into the new match repo.
8. Only then let normal pushes run `deploy-ios`.

Signing rules:
- `bootstrap_match` is the only lane allowed to write to match (`readonly: false`).
- `beta` must run `match(readonly: true)`. It never creates or repairs signing assets.
- Never run both workflows at once.
- If Apple's distribution-cert limit is hit during bootstrap, stop and show the error. Never revoke a certificate without explicit approval.
- The profile name in `beta` comes from the match profile mapping for the new bundle ID, never hardcoded.
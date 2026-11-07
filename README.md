# ILY Always

A tracker / calendar / daily app for iPhone and Android, built with Expo (React Native) so it can be developed and run without a Mac.

## Run on iPhone (no Mac needed)

1. Install **Expo Go** from the App Store on your iPhone.
2. On this computer, install dependencies (already done) and start the dev server:

   ```bash
   npm install
   npm start
   ```

3. Scan the QR code shown in the terminal with your iPhone camera (opens Expo Go).
4. The app runs live on your phone. Changes reload automatically.

## Build a standalone .ipa (optional, requires Apple Developer account)

Use Expo Application Services (EAS) in the cloud — no Mac required:

```bash
npm install -g eas-cli
eas login
eas build --platform ios
```

## Features (Home tab 🏠)

- Relationship tracker: together since 08/09/19, live elapsed time.
- Word of the Day and Fact of the Day, changes daily.
- Cover photos that reset daily, each with an editable caption (Daddy 🍆 & Princess 🍑).
- Daily time-on-app tracker per user, resets at midnight.
- Active user selector: Daddy 🍆 / Princess 🍑.

## Notes

- Git: do not push or commit without explicit permission.
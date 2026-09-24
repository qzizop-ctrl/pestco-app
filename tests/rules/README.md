# Firestore rules tests

Tests for `src/firestore.rules`, run against the local Firestore emulator.
They are separate from `npm test` because they need Java and the Firebase CLI.

One-time setup (Java 21 recommended, plus):

```bash
npm install --no-save @firebase/rules-unit-testing@^3 firebase-tools
```

Run:

```bash
npm run test:rules
```

`--no-save` keeps these two tools out of `package.json` / `package-lock.json`
so the normal build (`npm ci`) doesn't have to download them. Move them to
`devDependencies` if you'd rather have them installed with everything else.

CI runs the same thing from `.github/workflows/test-rules.yml` whenever
`src/firestore.rules` or these tests change.

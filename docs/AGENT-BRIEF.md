# BUILD BRIEF — `easy-expo-setup` v2 ("Easy Expo Setup, Pro Edition")

> Hand this whole document to the implementing agent. Everything it needs that cannot be
> discovered from the repo is written here. Where a fact is stated, it was verified on the
> machine below — do not re-litigate it, but do re-verify versions before pinning anything.

---

## 0. Mission

Turn the current one-shot scaffolding script into a **preset-driven, self-verifying Expo/React
Native app generator with a lifecycle**, so that a user who runs one command ends up with:

1. an app that **already looks professional** (light/dark theming, UI primitives, strict TS,
   lint/format/hooks, tests, CI, EAS profiles, typed env, generated docs), and
2. a **clean folder layout** where they only ever add feature code — never setup code.

Success is not "the script ran". Success is: *the user's first commit is a real feature, not
configuration.* Everything below serves that sentence.

---

## 1. Context you can rely on (verified on this machine)

| Fact | Value |
| --- | --- |
| Repo path | `/home/kali/Desktop/projects/easy-expo-setup` |
| Remote | `https://github.com/Boatengadams/easy-expo-setup.git` (branch `main`) |
| Current entry point | `setup-project.js` — 258 lines, Node-only, **zero runtime dependencies** |
| Current pipeline | 7 steps: scaffold → verify/chdir → `expo install expo@latest --fix` → write `src/nativewind-env.d.ts` → patch `tsconfig.json` → personalize home screen → enable web (`react-native-web`, `react-dom` + `app.json` web config) |
| Secondary impl | `setup-project.sh` — 221 lines, bash, **only 5 steps** (no personalization, no web) → parity gap to remove |
| Launchers | `setup.bat` (Windows), `setup.command` (macOS), `setup.sh` (Linux) → all call `node setup-project.js`, then hold the window open |
| Exit-code contract | `0` ok · `1` validation · `2` missing dependency · `3` target dir exists · `4` step failure (via a `SetupError { code }` class) |
| Existing safety behaviour | per-step `*.backup` of edited JSON with restore-on-invalid, `*.original` copy of the personalized screen, non-fatal `warnings[]` array, idempotent personalization (skips if `Welcome <name>` is present) |
| Scaffolder used | `npx rn-new@latest …` = **create-expo-stack (CES)**. Latest published `rn-new` = **2.23.3**; the existing generated app records `cesVersion 2.23.2`. Template/EJS based (`cli/src/templates/{base,packages}`). |
| Generated app present | `BAGS/` (untracked, 708 MB with `node_modules`): Expo **57.0.22**, React **19.2.3**, RN **0.86.3**, expo-router ~57.0.21, NativeWind **4.2.6**, Reanimated 4.5.1 + worklets, TS ~6.0.3, `experiments: { typedRoutes, tsconfigPaths }` |
| Toolchain available | node **v24.19.0**, npm **11.16.0**, global `expo` at `/usr/local/bin/expo`, `git`, `uv` |
| Tool repo currently has no | `package.json`, tests, CI, `docs/` (this file creates it) |

### Known defects to fix (part of the job)

1. **Dark mode is impossible in the generated app.** `BAGS/app.json` has `"userInterfaceStyle": "light"`.
   Expo's default template ships `"automatic"`. This must become `automatic`, and the generator must write it that way.
2. **Duplicate `/` route.** `BAGS/app/index.tsx` (hand-written BAGSGRAPHICS home) and
   `BAGS/app/(tabs)/index.tsx` (script-generated "Welcome BAGS") both resolve to `/`, while the root
   `app/_layout.tsx` Stack declares only `index` and `modal`. Two files, one route → the biggest
   correctness issue in the current output.
3. **JS/Bash parity gap** — `setup-project.sh` reimplements a subset of the pipeline. It must become a thin wrapper over the Node pipeline.
4. **Launchers swallow the exit code** — `setup.sh`/`setup.command` run node, then `echo` + `read`, so the shell always reports success.
5. **`--noGit` is passed to the scaffolder**, so users get a project with no version control.
6. **Stale git worktree** registered by the (now uninstalled) kilo CLI: `BAGS/.kilo/worktrees/gregarious-papyrus`, recorded in `.git/worktrees/gregarious-papyrus`.
7. `BAGS/app/(tabs)/index.tsx.original` exists as a setup backup (correct behaviour), but the new pipeline must keep backups out of generated source dirs — write them to `.easy-expo-setup/backups/` or document them.
8. `expo-env.d.ts` carries a "should be in your git ignore" note but `.gitignore` does not list it.

---

## 2. What "easy" must mean (the three layers)

| Layer | Requirement | Example |
| --- | --- | --- |
| **A. CLI asks nothing** | Presets, `--yes`, sane defaults, `--dry-run` prints the plan | `npx easy-expo-setup MyApp --preset pro --yes` |
| **B. Generated app is already professional** | Strict TS, lint+format+pre-commit, tests, CI, EAS profiles, typed env, docs — all green on the first run | `npm run lint && npm run typecheck && npm test` pass immediately after generation |
| **C. Features are pre-wired** | Light/dark/system theme with a toggle, UI primitives, feature slices, a generator for new features | `npm run gen:feature invoices` produces a working, themed, routed screen |

---

## 3. Hard constraints (non-negotiable)

1. **Node ≥ 20**, and the tool keeps **zero runtime npm dependencies**. Dev-only tooling is fine.
   Do not introduce commander/inquirer/chalk/etc.
2. **Preserve the exit-code contract** (`0/1/2/3/4`) exactly. A CI caller must be able to branch on it.
3. **Cross-platform**: Windows (`cmd`/`PowerShell`), macOS, Linux. No bash-isms in Node, no POSIX-only
   paths, and when spawning keep the existing pattern `{ shell: process.platform === 'win32' }`.
4. **`setup-project.js` must keep working** with its current CLI signature — the three launchers and the
   published README depend on it. Turn it into a thin shim over the new `bin/` entry point.
5. **Every step is idempotent and self-verifying**: each step owns a `verify()` returning named checks;
   the runner fails the run if any non-optional check fails. Re-running on an existing project must not corrupt it.
6. **All edits to `package.json` / `app.json` / `tsconfig.json` / `babel.config.js` / `metro.config.js` /
   `tailwind.config.js` go through one patch helper** that backs up, validates, and restores on failure.
   No ad-hoc `JSON.stringify` writes.
7. **Never end a run silently half-configured**: always write the manifest and print a recovery message
   naming the failed step, the exit code, and how to re-run just that step.
8. **Locate, don't assume.** Upstream CES renames files between versions. Resolve targets with locator
   utilities and degrade to a warning instead of failing hard (the existing `findHomeScreen()` recursive
   search is the right precedent — formalize it).
9. **Do not destroy user content.** No `rm -rf` outside the project being generated, no deleting the
   author's `BAGS/` screens, no history rewrite, no force-push. Work on a branch (`feat/v2`), commit per milestone.
10. **Network scope**: only `npm`/`npx`/`expo` invocations. No telemetry, no analytics endpoints.
11. **Long commands**: `npx` downloads can exceed this machine's 30-second command budget. Run them in
    the background with output redirected to a file and poll that file; never block waiting.

---

## 4. Milestone A — modular engine (behaviour-preserving refactor)

**Goal:** identical user-visible behaviour to today, but decomposed, testable, and dry-runnable.

### 4.1 Target repo layout

```
easy-expo-setup/
├── bin/easy-expo-setup.js       # arg parsing → runner
├── src/
│   ├── runner.js                # plan → run → verify → report; honours --dry-run/--only/--skip/--yes
│   ├── context.js               # { name, flags, preset, cwd, warnings[], applied[], backups[] }
│   ├── steps/                   # one module per step (see 4.3)
│   ├── fsx.js                   # atomicWrite, patchJson, backup/restore, copyTemplate, render
│   ├── locate.js                # findHomeScreen, findAppConfig, findTailwindConfig, ...
│   ├── templates/               # plain files with {{token}} substitution (no EJS dependency)
│   └── report.js                # step table, warnings, next-commands, doctor output
├── presets/{minimal,pro,saas,offline}.json
├── commands/{doctor,add,upgrade,generate}.js
├── tests/                       # node:test; fixtures written into gitignored try/
├── setup-project.js             # LEGACY SHIM → require('./bin/easy-expo-setup.js')
├── setup.{bat,command,sh}       # unchanged except exit-code pass-through (see defect 4)
└── docs/AGENT-BRIEF.md          # this file
```

### 4.2 Step contract (exact interface — all steps implement it)

```js
// src/steps/05-theme.js
module.exports = {
  id: 'theme',                          // unique, used by --only/--skip/dependsOn
  title: 'Installing the light/dark theme system',
  optional: false,                      // false → failure aborts (exit 4); true → warning only
  when: (ctx) => ctx.preset.features.theme === true,
  run: async (ctx) => { /* side effects via ctx.fs helpers only */ },
  verify: (ctx) => [                    // array of [label, boolean] pairs
    ['src/theme/tokens.ts exists', ctx.fs.exists('src/theme/tokens.ts')],
    ['tailwind darkMode is "class"', ctx.fs.readJson5Like('tailwind.config.js').darkMode === 'class'],
    ['userInterfaceStyle is "automatic"', ctx.appConfig().expo.userInterfaceStyle === 'automatic'],
  ],
};
```

Runner rules:
- Ordered execution; a step may declare `dependsOn: ['scaffold']`.
- `--dry-run` prints `id · title · would-run/would-skip · expected files` and performs **no** writes.
- On failure: record the step id, print `❌ SETUP FAILED / Step / Reason / exit code`, write the manifest
  with the partial state, and still print the recovery line (`npx easy-expo-setup add <step>`).
- After all steps, run a final `16-verify` acceptance gate.
- Never swallow a non-zero child-process status.

### 4.3 Steps to implement (M-A keeps today's set; M-B adds the rest)

| # | id | M-A behaviour (= today) | M-B additions |
| --- | --- | --- | --- |
| 01 | `preflight` | node/npm/npx present, name regex `^[A-Za-z0-9][A-Za-z0-9._-]*$`, dir collision (exit 3) | + disk-space check, + `git --version` check |
| 02 | `scaffold` | `npx rn-new@latest <name> --expo-router --nativewind --tabs --npm --noGit`, then verify dir + `package.json`, then `chdir` | flags built from the preset; keep `--noGit` here but do `git init` ourselves in `15-manifest` |
| 03 | `expo-sync` | `npx expo install expo@latest --fix -- --yes` | unchanged |
| 04 | `strip-demo` | *(new)* | remove `EditScreenInfo`, `ScreenContent`, `Container`, `two.tsx`, demo tab copy; guarded by `--clean`/preset |
| 05 | `theme` | *(new — see §6)* | tokens, provider, toggle, tailwind/global.css, splash/status bar |
| 06 | `ui-primitives` | *(new — see §6.5)* | Button, Text, Card, Input, Screen, Icon, List |
| 07 | `tsconfig` | backup → parse → ensure `include` array → push `src/nativewind-env.d.ts` → validate → restore on failure | + `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `@/*` alias; write `src/nativewind-env.d.ts` here too |
| 08 | `app-config` | *(today this lives inside the web-support step)* | `app.config.ts` (env-aware), `userInterfaceStyle: "automatic"`, `scheme`, splash light+dark, icon/bundle ids |
| 09 | `quality` | *(new)* | ESLint flat config, Prettier, `lint-staged` + `husky`, `typecheck` script |
| 10 | `tests` | *(new)* | `jest-expo` + `@testing-library/react-native`, 2 passing samples (light + dark render) |
| 11 | `env` | *(new)* | `.env.example`, `.env.local` gitignored, typed+validated `src/config/env.ts` |
| 12 | `cicd` | *(new)* | `.github/workflows/ci.yml` (install → typecheck → lint → test) |
| 13 | `eas` | *(new)* | `eas.json` with `development`/`preview`/`production` + build scripts |
| 14 | `docs` | *(new)* | generated `README.md` (scripts table, folder map, "add a screen in 3 steps"), `docs/{THEMING,ARCHITECTURE,ADD_A_FEATURE}.md` |
| 15 | `manifest` | *(new)* | `.easy-expo-setup.json` (schema in §7) + `git init` + first commit + `.gitattributes` |
| 16 | `verify` | today's `finalVerify`: `package.json`, `src/nativewind-env.d.ts` exact contents, `tsconfig.include`, `node_modules`, `react-native-web` + `react-dom` in deps | + every step's `verify()` must pass; + `userInterfaceStyle === 'automatic'`; + no duplicate routes; + tests/lint/typecheck actually run when `--verify-deep` |

**M-A acceptance:** running the refactored tool on a clean fixture produces a project byte-comparable in
intent to today's output (same files, same content except formatting), exit codes `1/2/3` still trigger on
bad name / missing npm / existing dir, and `node --test` passes.

---

## 5. Milestone B — clean generated folder + professional defaults

### 5.1 Required generated layout ("routes are dumb, features are smart")

```
my-app/
├── app/                          # routing ONLY; route files ≤ ~30 lines, no data fetching
│   ├── _layout.tsx               # ThemeProvider → SafeAreaProvider → ErrorBoundary → Stack + StatusBar
│   ├── (tabs)/_layout.tsx
│   ├── (tabs)/index.tsx          # export { HomeScreen as default } from '@/features/home'
│   ├── (tabs)/settings.tsx       # hosts <ThemeToggle />
│   ├── (auth)/login.tsx
│   ├── +not-found.tsx            # themed
│   └── +html.tsx
├── src/
│   ├── theme/                    # tokens.ts · ThemeProvider.tsx · useTheme.ts · ThemeToggle.tsx
│   ├── components/ui/            # Button · Text · Card · Input · Screen · List · Icon
│   ├── components/layout/        # Header · Container
│   ├── features/
│   │   ├── home/                 # HomeScreen.tsx · components/ · hooks/ · api/ · types.ts
│   │   └── auth/
│   ├── lib/                      # apiClient · storage · format · logger · result
│   ├── hooks/
│   ├── config/                   # env.ts (typed + validated) · constants.ts
│   └── types/
├── docs/                         # ARCHITECTURE.md · THEMING.md · ADD_A_FEATURE.md
├── __tests__/                    # renders Home in light AND dark
├── .github/workflows/ci.yml
├── eas.json · .env.example · .nvmrc · .editorconfig · .gitattributes
├── app.config.ts
├── tailwind.config.js · global.css · metro.config.js · babel.config.js
├── .easy-expo-setup.json         # manifest (§7)
└── README.md                     # generated, project-specific
```

**Rules:** one route → exactly one file (add a duplicate-route check to `16-verify`); nothing but routing in
`app/`; every screen consumes theme tokens, never raw palette classes; `--clean` and the `minimal` preset
strip all demo scaffolding so the first `npm run start` shows a real Home screen, not a template artifact.

### 5.2 `gen:feature` (the "focus on building" win)

`npm run gen:feature <name>` must create
`src/features/<name>/{<Name>Screen.tsx, hooks/use<Name>.ts, api/<name>.api.ts, types.ts}` plus a thin route
at `app/(tabs)/<name>.tsx`, register it in the tab layout, and print
"now add your logic to src/features/<name>/<Name>Screen.tsx". Also `gen:component <Name>` →
`src/components/ui/<Name>.tsx` (themed) and `gen:screen <path>` → a route file that delegates to a feature.

### 5.3 Professional baseline written by the generator

| Area | Deliverable |
| --- | --- |
| TypeScript | `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `@/*` alias, `typedRoutes` + `tsconfigPaths`, `src/nativewind-env.d.ts` in `include` |
| Lint/format | ESLint flat config (expo + prettier + import order), Prettier, `lint`/`format`/`typecheck` scripts |
| Git | `git init` + first commit, `husky` + `lint-staged` (staged lint/format), `.gitattributes` (`* text=auto eol=lf`, `*.bat text eol=crlf`) |
| Tests | `jest-expo` + `@testing-library/react-native`, 2+ passing samples, `npm test -- --coverage` |
| CI | `.github/workflows/ci.yml`: install → typecheck → lint → test on push/PR |
| Build | `eas.json` (development/preview/production) + `build:android`/`build:ios` scripts |
| Env | `app.config.ts` reads env; `.env.example`; `.env.local` gitignored; `src/config/env.ts` validates and throws a human message on missing keys |
| Resilience | themed `ErrorBoundary` re-exported from the root layout; themed `+not-found` |
| Docs | generated `README.md` (scripts table, folder map, "add a screen in 3 steps", troubleshooting), `docs/THEMING.md`, `docs/ARCHITECTURE.md`, `docs/ADD_A_FEATURE.md` |
| Hygiene | `.editorconfig`, `.nvmrc`, `engines`, `.gitignore` (adds `.easy-expo-setup/` and `expo-env.d.ts` per its own note), `LICENSE` |

### 5.4 M-B acceptance (must all hold on a freshly generated app)

`npm run typecheck` → 0 errors · `npm run lint` → 0 errors · `npm test` → green · `npm run web` renders Home
in light, toggling to dark renders dark, a reload keeps the choice, and there is no white flash on cold start
(if no device/emulator is available, assert the splash-gated sequence in the provider unit test and **say so
explicitly** rather than claiming a visual check you did not do) · `git log` shows an initial commit ·
`userInterfaceStyle` is `automatic` in the resolved config.

---

## 6. Milestone B — the theme system (light / dark / system, no flash)

The flagship feature. Implement all five parts; each gets `verify()` checks in the `theme` step.

### 6.1 Tokens — `src/theme/tokens.ts` (single source of truth)

Semantic names only — `bg`, `surface`, `text`, `textMuted`, `primary`, `border`, `danger` — defined for
`light` and `dark`, plus `radius` and `space` scales. Export `type ThemeName = 'light' | 'dark'`. App code
must never reference a raw palette value. Support brand substitution from `--brand-color`
(default `#2563eb` light / `#60a5fa` dark).

### 6.2 Provider — `src/theme/ThemeProvider.tsx` + `useTheme()`

- Mode type `'system' | 'light' | 'dark'` — **always offer "System"**.
- Use NativeWind v4's API: read via `useColorScheme()` from `nativewind`, apply via `colorScheme.set(mode)`
  (docs: nativewind.dev → Core Concepts → Dark Mode → *Manual Selection*; under the hood it uses RN
  `Appearance` on native and `prefers-color-scheme` on web).
  **Verify these exports against the installed `node_modules/nativewind` before coding** — v4.2.6 is
  installed here and v5 is in RC upstream, so never copy v5-only APIs.
- Persist the choice (AsyncStorage; MMKV only in the `offline` preset) and rehydrate before first paint.
- Expose `{ mode, scheme, setMode, toggle, tokens }` from `useTheme()`.
- **No-flash sequence**: `SplashScreen.preventAutoHideAsync()` → load persisted mode → `colorScheme.set()` →
  `SplashScreen.hideAsync()`; render a root `View` whose `backgroundColor` comes from tokens.

### 6.3 Config wiring the pipeline must write

- `tailwind.config.js`: `darkMode: 'class'` (so `dark:` variants follow the toggle, not only the OS),
  `presets: [require('nativewind/preset')]`, `content` including `./src/**/*.{js,ts,tsx}`.
- `global.css`: `@tailwind base/components/utilities` **plus** the palette as CSS custom properties under
  `:root` and `.dark:root`, referenced from Tailwind theme values via NativeWind's `vars()`/CSS-variable
  support — one palette usable from both class names and inline styles.
- `app.config.ts`: **`userInterfaceStyle: 'automatic'`** (fixes defect 1) and `expo-system-ui` installed —
  Expo's docs are explicit that Android ignores `userInterfaceStyle` without it.
- Splash: `expo-splash-screen`'s `dark: { image, backgroundColor }` variant so the launch screen matches the theme.
- `expo-status-bar`: `style={scheme === 'dark' ? 'light' : 'dark'}` driven by the provider, not per screen.

### 6.4 Theming tests

Two minimum: Home renders in light, Home renders in dark (mock `useColorScheme`), asserting the root
background comes from the correct token. Also assert `darkMode: 'class'` and
`userInterfaceStyle === 'automatic'` inside the `theme` step's `verify()`.

### 6.5 UI primitives (themed)

`Button` (primary/secondary/ghost/danger; sizes; loading; disabled), `Text` (variant scale
display/title/body/caption; tone default/muted/danger), `Card`, `Input` (label, error, focus ring),
`Screen` (safe-area + themed background + optional scroll + optional keyboard-avoid), `List`, `Icon`
(`@expo/vector-icons` wrapper with themed color). Each primitive is theme-aware and has ≥1 render test.

### 6.6 `<ThemeToggle />`

Segmented System / Light / Dark control, accessible (`accessibilityRole="radiogroup"`, labeled options),
mounted on `app/(tabs)/settings.tsx`, with a short "Appearance" section explaining that System follows the device.

---

## 7. Milestone C — lifecycle commands + the manifest

### 7.1 `.easy-expo-setup.json` (written by step `15-manifest`, into every generated project)

This file is what makes `doctor`/`add`/`upgrade` possible months later. Schema:

```json
{
  "tool": "easy-expo-setup",
  "toolVersion": "2.0.0",
  "preset": "pro",
  "generatedAt": "2026-09-23T04:00:00.000Z",
  "scaffolder": { "name": "rn-new", "version": "2.23.3" },
  "versions": { "expo": "57.0.22", "react": "19.2.3", "reactNative": "0.86.3", "nativewind": "4.2.6" },
  "theme": "tokens-v1",
  "features": { "theme": true, "tabs": true, "ui": true, "tests": true, "ci": true, "eas": true, "env": true, "i18n": false, "auth": null },
  "steps": { "preflight": "ok", "scaffold": "ok", "theme": "ok", "quality": "ok", "verify": "ok" },
  "env": { "node": "v24.19.0", "npm": "11.16.0", "os": "linux-x64" }
}
```

`theme: "tokens-v1"` is a **version tag for the theme layout** — bump it when the token/provider contract
changes so `doctor` can say "your theme predates tokens-v1; run `npx easy-expo-setup add theme`".

### 7.2 `npx easy-expo-setup doctor [--fix]`

Audits an existing project against the standard and prints a check-by-check report with a fix hint per
failure. Required checks (at minimum):

```
✓ TypeScript strict enabled
✓ @/* alias + typedRoutes
✗ userInterfaceStyle is "light"            → expected "automatic"                       [--fix]
✗ expo-system-ui missing (Android theming) → npx expo install expo-system-ui           [--fix]
✗ src/theme/tokens.ts missing (theme: tokens-v1) → npx easy-expo-setup add theme       [--fix]
! duplicate route: app/index.tsx and app/(tabs)/index.tsx both match "/"               [manual]
✓ 2 tests passing · lint clean · typecheck clean
```

Exit codes: `0` all good · `4` issues found (so CI can gate on it). `--fix` applies only the safe,
non-destructive fixes it advertised.

### 7.3 `npx easy-expo-setup add <feature>`

Adds one feature to an existing project by re-running just that step: `theme`, `ui`, `tests`, `ci`, `eas`,
`env`, `i18n`, `auth`. Must read the manifest first, skip what is already present, and be safe to run twice.

### 7.4 `npx easy-expo-setup gen:feature|gen:component|gen:screen <name>`

As specified in §5.2. Pure code generation — no network, no dependency changes.

### 7.5 `npx easy-expo-setup upgrade [--dry-run]`

Bumps Expo SDK + aligned deps (`npx expo install expo@latest --fix`), re-runs config steps that are safe to
re-apply, refreshes the manifest, and reports a diff summary. Never touches user code.

---

## 8. Dogfooding / the existing `BAGS/` project

Do this on a branch, and **never delete the author's own screens without being asked**:

1. Generate a fresh fixture app under `try/` (gitignored) and run the full M-B acceptance on it — this is the primary proof.
2. Apply the `theme` + `ui` steps to `BAGS/` as a real-world reference, on a branch, and report the diff.
3. Fix the two defects in `BAGS/` and report exactly what changed:
   - `userInterfaceStyle: "light"` → `"automatic"` (and add `expo-system-ui` if it is not present — it is currently listed as a dependency, verify).
   - The duplicate `/` route: consolidate to a single route **preserving the hand-written BAGSGRAPHICS
     content** (make that content the `(tabs)/index.tsx` screen or move it there), keep the displaced file
     as a documented backup, and state the trade-off you chose. Do not silently discard either screen.
4. Prune the stale worktree with `git worktree remove BAGS/.kilo/worktrees/gregarious-papyrus` (then
   `git worktree prune`), and add `.kilo/` to `.gitignore` so agent tooling cannot re-register one.
5. **Do not commit** the 708 MB `BAGS/node_modules` — confirm `.gitignore` covers it before any `git add`.

---

## 9. Execution order, budget and stopping rules

Work in this order and **stop at the end of each milestone to report** (do not batch all milestones into one
unreviewable change):

| Order | Work | Rough budget |
| --- | --- | --- |
| 1 | M-A: split into `src/steps/*`, runner, `fsx`, `locate`, presets, `--dry-run`/`--yes`, legacy shim, `node --test` suite | 0.5–1 day |
| 2 | M-A proof: parity run into `try/`, exit-code tests, `setup-project.sh` becomes a wrapper, launchers pass the code through | 0.5 day |
| 3 | M-B: theme system + UI primitives + `--clean` + `gen:feature` | 1–1.5 days |
| 4 | M-B: quality/tests/CI/EAS/env/docs steps, `git init` + first commit, `.gitattributes` | 0.5–1 day |
| 5 | M-C: manifest, `doctor --fix`, `add`, `upgrade` | 1 day |
| 6 | Dogfood on `BAGS/` + fix the two defects + prune the worktree | 0.5 day |

If you run out of time, **finish a milestone or revert it** — never leave the tool in a state where
`setup-project.js` does not run.

---

## 10. Definition of done (machine-checkable)

- [ ] `node setup-project.js MyApp` (legacy path) still scaffolds, via the new engine.
- [ ] `node bin/easy-expo-setup.js MyApp --preset pro --yes --dry-run` prints the plan and writes nothing.
- [ ] Real run with `--preset pro` exits `0` and prints a per-step summary.
- [ ] Exit codes: bad name → `1`; `npm` hidden from PATH → `2`; existing folder → `3`; forced step failure → `4`.
- [ ] `node --test` green, including: name validation, `patchJson` restore-on-invalid, locator fallbacks, dry-run writes nothing.
- [ ] Generated app: `npm run typecheck` and `npm run lint` exit `0`; `npm test` passes.
- [ ] Generated app toggles light ⇄ dark ⇄ system; the choice survives reload; no white flash (or the splash-gated proof is documented as the substitute).
- [ ] Generated app contains no demo clutter (`EditScreenInfo`, `ScreenContent`, `two.tsx`) under `--clean`/`minimal`.
- [ ] `gen:feature demo` produces a routed, themed, passing screen.
- [ ] `.easy-expo-setup.json` exists, is valid JSON, and matches the schema in §7.1.
- [ ] `doctor` on the generated app exits `0`; on `BAGS` it correctly reports the theme/SDK gaps.
- [ ] `setup-project.sh`, `setup.bat`, `setup.command` still launch the flow and forward the exit code.
- [ ] `BAGS/` defects fixed (or documented with a proposed patch if you chose not to apply); worktree pruned.
- [ ] `docs/AGENT-BRIEF.md` updated where your implementation differed from this brief.

---

## 11. What your final report must contain

1. **Milestone status** — what is complete, what is not, and why.
2. **Exact commands run** with their observed results (paste the check output, not a summary of it).
3. **File inventory** — every file added/changed, grouped by purpose.
4. **The generated app's evidence**: typecheck/lint/test output, `npm run web` behaviour (say plainly whether
   you *saw* light↔dark or only asserted it in a test).
5. **Screenshots or logs** where a claim is visual; otherwise state the limitation.
6. **Deviations** from this brief and the reason.
7. **Follow-ups** you deliberately did not do (e.g. i18n, auth presets, E2E).
8. **Git state**: branch name, commits, and confirmation that nothing was pushed/force-pushed.
9. **Untouched-but-relevant observations** (e.g. `BAGS` issues you found but were told not to change).

---

## 12. Out of scope for this build

Authentication providers (`saas` preset internals), i18n, Sentry/analytics, offline storage, E2E
(Maestro/Detox), app-store submission automation, a docs website, Windows/macOS CI runners for the tool
itself, and any change to the GitHub remote settings. Design the seams for them (presets/step flags) but do
not implement them.

---

## 13. Risks and how to handle them

| Risk | Handling |
| --- | --- |
| Upstream CES drift (`rn-new` 2.23.3 → 2.24.x-next) | Pin the version you test, record it in the manifest, use locators instead of hard-coded paths |
| Expo SDK churn (57.0.22 here) | Never hand-write versions that `npx expo install` can resolve; assert only on files you own |
| NativeWind v4.2.6 vs v5 RC | Read the installed package's exports/types before use; do not copy v5 docs |
| `npx` slower than the 30 s command budget | Background + redirect to a file, then poll |
| Cross-platform line endings / paths | `path.join` everywhere, `.gitattributes` in generated apps, never `/`-only assumptions |
| Breaking the author's repo | Branch per milestone, small commits, no force-push, no deleting user content, `--dry-run` before real runs |
| Long install cycles in `BAGS/` | Prefer a fresh `try/` fixture for iteration; touch `BAGS` only for the reference pass |

---

## 14. Appendix — reference sketches (verify APIs against installed packages before use)

**A. Target `tailwind.config.js`**
```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',                                  // toggle-driven dark: variants
  content: ['./app/**/*.{js,ts,tsx}', './src/**/*.{js,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: { extend: { /* map semantic tokens here if you use vars() */ } },
  plugins: [],
};
```

**B. Provider shape (illustrative, not final code)**
```tsx
import { colorScheme, useColorScheme } from 'nativewind';
import * as SplashScreen from 'expo-splash-screen';

type Mode = 'system' | 'light' | 'dark';

// boot: preventAutoHideAsync() → read persisted mode → colorScheme.set(mode) → hideAsync()
// expose { mode, scheme, setMode, toggle, tokens }; persist on change; render themed root View
```

**C. Step + filesystem helper signatures the runner must provide**
```js
// ctx.fs
exists(p), read(p), write(p, text), atomicWrite(p, text),
patchJson(p, mutator),            // backup → parse → mutate → validate → restore-on-failure
copyTemplate(relSrc, relDest, tokens), backup(p), restore(p)

// ctx.locate
findHomeScreen(), findAppConfig(), findTailwindConfig(), findMetroConfig(), routesForPath('/')
```

**D. Launcher exit-code pass-through (fixes defect 4)** — `setup.sh` / `setup.command` end with:
```bash
node setup-project.js "$@"
status=$?
echo
read -n 1 -s -r -p "Press any key to close this window..."
exit "$status"
```
`setup.bat`: `node "%~dp0setup-project.js" %*` then `set "status=%errorlevel%"` → `pause` → `exit /b %status%`.

**E. First commands to run (start here)**
```bash
cd /home/kali/Desktop/projects/easy-expo-setup
git switch -c feat/v2
node -v && npm -v                     # expect v24.x / 11.x
node --test                           # after the M-A test suite exists
node bin/easy-expo-setup.js MyApp --preset pro --yes --dry-run
# real run (background, because npx can exceed the command timeout):
( npx rn-new@latest --help > /tmp/rnnew.txt 2>&1 & )   # probe upstream flags if needed
```

---

## 15. One-paragraph version (if the receiving agent only reads one thing)

> Refactor the existing zero-dependency Node scaffolder `setup-project.js` (7 steps, exit codes 0/1/2/3/4)
> into a modular, preset-driven, self-verifying generator: `src/steps/*` with a `{id,title,when,run,verify}`
> contract behind a runner that supports `--dry-run --only --skip --yes`, plus a `.easy-expo-setup.json`
> manifest that later powers `doctor --fix`, `add`, `gen:feature` and `upgrade`. Generate apps that are
> immediately professional — light/dark/system theming with a toggle and no startup flash
> (`darkMode: 'class'`, NativeWind `colorScheme.set()` + persistence, `userInterfaceStyle: "automatic"`,
> `expo-system-ui`, dark splash variant, themed StatusBar), themed UI primitives, strict TypeScript with
> `@/*` aliases, ESLint+Prettier+husky+lint-staged, jest-expo tests that render light and dark, CI, EAS
> profiles, typed env validation, and generated docs — in a **clean folder** where `app/` holds only thin
> routes and all real code lives in `src/features/*`, `src/theme/*`, `src/components/ui/*`, `src/lib/*`.
> Keep `setup-project.js` and the three OS launchers working (forwarding exit codes), never break the
> author's repo, work on a branch, prove everything by running it into `try/`, and fix the two known
> defects: `BAGS/app.json` forcing `userInterfaceStyle: "light"` and the duplicate `/` route between
> `BAGS/app/index.tsx` and `BAGS/app/(tabs)/index.tsx`.

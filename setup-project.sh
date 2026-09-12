#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'

# Exit codes:
#   0 - setup completed successfully
#   1 - validation error
#   2 - missing dependency
#   3 - pre-existing directory conflict
#   4 - scaffold/build/setup step failure

PROJECT_NAME="${1-}"
CURRENT_STEP="Validation"
SETUP_FAILED=0
FINAL_STATUS="pending"

log_error() {
  printf '❌ %s\n' "$*" >&2
}

log_step() {
  local step_number=$1
  local title=$2
  printf '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
  printf 'STEP %s/5 — %s\n' "$step_number" "$title"
  printf '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
}

handle_error() {
  local failed_command=${1:-unknown}
  local failed_line=${2:-unknown}

  SETUP_FAILED=1
  log_error 'SETUP FAILED'
  printf '\nStep: %s\n' "$CURRENT_STEP" >&2
  printf 'Command: %s\n' "$failed_command" >&2
  printf 'Line: %s\n\n' "$failed_line" >&2
  printf 'The project may have been partially created.\n\n' >&2
  printf 'Please inspect:\n  %s/\n\n' "$PROJECT_NAME" >&2
  printf 'Then resolve the error and rerun the failed step manually.\n' >&2
  exit 4
}

handle_exit() {
  local exit_code=$?

  if [[ $exit_code -eq 0 && "$SETUP_FAILED" -eq 0 ]]; then
    FINAL_STATUS="success"
    printf '\n✅ FINAL STATUS: SUCCESS\n'
  else
    FINAL_STATUS="failure"
    printf '\n❌ FINAL STATUS: FAILED (exit code %s)\n' "$exit_code" >&2
  fi
}

handle_signal() {
  local signal=$1
  SETUP_FAILED=1
  log_error "Setup cancelled by ${signal}."
  exit 4
}

trap 'handle_error "$BASH_COMMAND" "$LINENO"' ERR
trap handle_exit EXIT
trap 'handle_signal INT' INT
trap 'handle_signal TERM' TERM

validate_project_name() {
  if [[ -z "$PROJECT_NAME" || ! "$PROJECT_NAME" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]]; then
    if [[ -z "$PROJECT_NAME" || "$PROJECT_NAME" =~ ^[[:space:]]*$ ]]; then
      log_error 'Project name is required.'
    else
      log_error "Invalid project name: \"$PROJECT_NAME\"."
      printf 'Use a name matching: ^[A-Za-z0-9][A-Za-z0-9._-]*$\n\n' >&2
    fi
    printf 'Usage:\n  ./setup-project.sh <project-name>\n\nExample:\n  ./setup-project.sh Bagsgraphics\n' >&2
    exit 1
  fi
}

check_dependencies() {
  local dependency
  for dependency in node npm npx; do
    if ! command -v "$dependency" >/dev/null 2>&1; then
      log_error "Required dependency '$dependency' was not found on PATH."
      printf 'Install Node.js and npm from https://nodejs.org/ (or your OS package manager), then rerun this script.\n' >&2
      exit 2
    fi
  done

  printf 'Detected tooling:\n'
  printf '  node %s\n' "$(node --version)"
  printf '  npm  %s\n' "$(npm --version)"
  printf '  npx  %s\n' "$(npx --version)"
}

guard_existing_dir() {
  if [[ -e "$PROJECT_NAME" || -L "$PROJECT_NAME" ]]; then
    log_error "A directory named \"$PROJECT_NAME\" already exists."
    printf '\nChoose another project name or remove/rename the existing directory manually.\n' >&2
    exit 3
  fi
}

scaffold_project() {
  CURRENT_STEP='Creating Expo project'
  log_step 1 "$CURRENT_STEP"
  npx rn-new@latest "$PROJECT_NAME" --expo-router --nativewind --tabs --npm --noGit
}

verify_scaffold_and_enter() {
  CURRENT_STEP='Verifying scaffold and entering project'
  log_step 2 "$CURRENT_STEP"

  if [[ ! -d "$PROJECT_NAME" ]]; then
    log_error "Expected scaffold directory was not created: $PROJECT_NAME"
    exit 4
  fi
  if [[ ! -f "$PROJECT_NAME/package.json" ]]; then
    log_error "Expected scaffold package.json was not created: $PROJECT_NAME/package.json"
    exit 4
  fi
  cd -- "$PROJECT_NAME"
}

sync_expo_deps() {
  CURRENT_STEP='Syncing Expo dependencies'
  log_step 3 "$CURRENT_STEP"
  npx expo install expo@latest --fix -- --yes
}

write_nativewind_types() {
  local nativewind_file='src/nativewind-env.d.ts'
  local expected='/// <reference types="nativewind/types" />'

  CURRENT_STEP='Writing NativeWind TypeScript declaration'
  log_step 4 "$CURRENT_STEP"
  mkdir -p src

  if [[ -f "$nativewind_file" ]] && [[ "$(<"$nativewind_file")" == "$expected" ]]; then
    return 0
  fi

  local temp_file
  temp_file=$(mktemp)
  printf '%s\n' "$expected" > "$temp_file"
  mv -- "$temp_file" "$nativewind_file"
}

patch_tsconfig() {
  CURRENT_STEP='Patching tsconfig.json'
  log_step 5 "$CURRENT_STEP"

  if [[ ! -f tsconfig.json ]]; then
    log_error 'tsconfig.json was not found; cannot safely configure NativeWind types.'
    exit 4
  fi

  cp -- tsconfig.json tsconfig.json.backup

  node <<'NODE'
const fs = require('fs');
const path = 'tsconfig.json';
const source = fs.readFileSync(path, 'utf8');
const config = JSON.parse(source);

if (!Object.prototype.hasOwnProperty.call(config, 'include')) {
  config.include = [];
} else if (!Array.isArray(config.include)) {
  throw new Error('tsconfig.json "include" must be an array.');
}

if (!config.include.includes('src/nativewind-env.d.ts')) {
  config.include.push('src/nativewind-env.d.ts');
}

fs.writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`);
NODE

  if ! node -e 'JSON.parse(require("fs").readFileSync("tsconfig.json","utf8"))'; then
    cp -- tsconfig.json.backup tsconfig.json
    log_error 'tsconfig.json became invalid.'
    printf '\nThe setup has been stopped to prevent continuing with a broken project configuration.\n' >&2
    exit 4
  fi

  rm -- tsconfig.json.backup
}

final_verify() {
  CURRENT_STEP='Final verification'

  [[ -d . ]]
  [[ -f package.json ]]
  [[ -f src/nativewind-env.d.ts ]]
  [[ "$(<src/nativewind-env.d.ts)" == '/// <reference types="nativewind/types" />' ]]
  [[ -f tsconfig.json ]]
  node -e 'const c=JSON.parse(require("fs").readFileSync("tsconfig.json","utf8")); if (!Array.isArray(c.include) || !c.include.includes("src/nativewind-env.d.ts")) process.exit(1)'
  [[ -d node_modules ]]

  printf '\n✅ SETUP COMPLETED SUCCESSFULLY\n'
  printf 'Verified: project directory, package.json, NativeWind declaration, valid tsconfig.json include entry, and node_modules/.\n'
  printf 'Next step: cd %s && npm run start\n' "$PROJECT_NAME"
  printf 'This verifies setup artifacts only; it does not claim the generated application is error-free.\n'
}

main() {
  validate_project_name
  CURRENT_STEP='Checking required tooling'
  check_dependencies
  CURRENT_STEP='Checking for an existing project directory'
  guard_existing_dir
  scaffold_project
  verify_scaffold_and_enter
  sync_expo_deps
  write_nativewind_types
  patch_tsconfig
  final_verify
}

main "$@"

#!/usr/bin/env node

/* Exit codes: 0 success, 1 validation, 2 missing dependency,
 * 3 existing directory, 4 setup/step failure. */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const readline = require("readline");

const NATIVEWIND_LINE = '/// <reference types="nativewind/types" />';
const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const warnings = [];

class SetupError extends Error {
  constructor(message, code = 4) { super(message); this.code = code; }
}

function usage() {
  console.error("\nUsage:\n  node setup-project.js <project-name>\n\nExample:\n  node setup-project.js Bagsgraphics");
}

function banner(number, title) {
  console.log("\n==================================================");
  console.log(`STEP ${number}/7 - ${title}`);
  console.log("==================================================");
}

function validateName(name) {
  if (!name || name.trim() === "") return "A project name is required.";
  if (!NAME_RE.test(name)) return "Use letters, numbers, periods, hyphens, or underscores; no spaces, and start with a letter or number.";
  return null;
}

async function promptForName() {
  let name = process.argv[2];
  if (name !== undefined) {
    const error = validateName(name);
    if (error) { console.error(`❌ ${error}`); usage(); return null; }
    return name;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const lines = rl[Symbol.asyncIterator]();
    rl.setPrompt("What should your project be called? ");
    rl.prompt();
    name = (await lines.next()).value;
    let error = validateName(name);
    if (error) {
      console.error(`❌ ${error}`);
      rl.setPrompt("Please enter a valid project name: ");
      rl.prompt();
      name = (await lines.next()).value;
      error = validateName(name);
      if (error) { console.error(`❌ ${error}`); usage(); return null; }
    }
    return name;
  } finally {
    rl.close();
  }
}

function command(cmd, args, description) {
  const result = spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (result.error) throw new SetupError(`${description} could not start: ${result.error.message}`);
  if (result.status !== 0) throw new SetupError(`${description} failed with exit code ${result.status}.`);
}

function checkDependencies() {
  console.log(`Detected Node.js ${process.version}`);
  for (const cmd of ["npm", "npx"]) {
    console.log(`Detected ${cmd} version:`);
    const result = spawnSync(cmd, ["--version"], { stdio: "inherit", shell: process.platform === "win32" });
    if (result.error || result.status !== 0) throw new SetupError(`${cmd} is unavailable. Install Node.js LTS from https://nodejs.org; npm and npx are included.`, 2);
  }
}

function guardExistingDir(name) {
  if (fs.existsSync(name)) throw new SetupError(`A folder named "${name}" already exists here.\n\nChoose a different project name, or move/rename the existing folder, then try again.`, 3);
}

function scaffoldProject(name) {
  banner(1, "Creating your app");
  command("npx", ["rn-new@latest", name, "--expo-router", "--nativewind", "--tabs", "--npm", "--noGit"], "Creating your app");
}

function verifyScaffold(name) {
  banner(2, "Checking your new app");
  if (!fs.existsSync(name) || !fs.statSync(name).isDirectory()) throw new SetupError(`The app folder was not created: ${name}`);
  const pkg = path.join(name, "package.json");
  if (!fs.existsSync(pkg) || !fs.statSync(pkg).isFile()) throw new SetupError(`The new app is missing ${pkg}.`);
  process.chdir(name);
}

function syncExpoDeps() {
  banner(3, "Installing the latest Expo pieces");
  command("npx", ["expo", "install", "expo@latest", "--fix", "--", "--yes"], "Installing Expo");
}

function writeNativeWindTypes() {
  banner(4, "Adding NativeWind TypeScript support");
  fs.mkdirSync("src", { recursive: true });
  const file = path.join("src", "nativewind-env.d.ts");
  const content = `${NATIVEWIND_LINE}\n`;
  if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== content) fs.writeFileSync(file, content, "utf8");
}

function findHomeScreen() {
  const candidates = [
    path.join("app", "(tabs)", "index.tsx"),
    path.join("app", "(tabs)", "index.js"),
    path.join("app", "index.tsx"),
    path.join("app", "index.js"),
  ];
  for (const file of candidates) if (fs.existsSync(file)) return file;

  function search(directory) {
    if (!fs.existsSync(directory)) return null;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        const match = search(file);
        if (match) return match;
      } else if (/\.tsx?$|\.js$/.test(entry.name)) {
        if (fs.readFileSync(file, "utf8").includes("export default function")) return file;
      }
    }
    return null;
  }
  return search("app");
}

function personalizeHome(projectName) {
  banner(6, "Personalizing your app");
  try {
    const file = findHomeScreen();
    if (!file) {
      warnings.push("Could not find a home screen file to personalize — skipping.");
      return;
    }
    const original = fs.readFileSync(file, "utf8");
    if (original.includes(`Welcome ${projectName}`)) return;
    const backup = `${file}.original`;
    if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
    const welcome = `import { View, Text, StyleSheet } from "react-native";\n\nexport default function HomeScreen() {\n  return (\n    <View style={styles.container}>\n      <Text style={styles.title}>Welcome ${projectName}</Text>\n      <Text style={styles.subtitle}>Your app is set up and ready. Start editing this screen to build your project.</Text>\n    </View>\n  );\n}\n\nconst styles = StyleSheet.create({\n  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },\n  title: { fontSize: 28, fontWeight: "700", marginBottom: 12, textAlign: "center" },\n  subtitle: { fontSize: 16, textAlign: "center", opacity: 0.7 },\n});\n`;
    fs.writeFileSync(file, welcome, "utf8");
  } catch (error) {
    warnings.push(`Could not personalize the home screen — ${error.message}`);
  }
}

function updateAppJson() {
  const jsonFile = fs.existsSync("app.json") ? "app.json" : fs.existsSync("app.config.json") ? "app.config.json" : null;
  if (jsonFile) {
    const backup = `${jsonFile}.backup`;
    fs.copyFileSync(jsonFile, backup);
    let config;
    try { config = JSON.parse(fs.readFileSync(jsonFile, "utf8")); }
    catch (error) { throw new SetupError(`${jsonFile} is not valid JSON: ${error.message}. The backup was kept at ${backup}.`); }
    if (!config.expo || typeof config.expo !== "object" || Array.isArray(config.expo)) config.expo = {};
    if (!config.expo.web) config.expo.web = { bundler: "metro" };
    if (Array.isArray(config.expo.platforms)) {
      if (!config.expo.platforms.includes("web")) config.expo.platforms.push("web");
    } else if (!Object.prototype.hasOwnProperty.call(config.expo, "platforms")) {
      config.expo.platforms = ["ios", "android", "web"];
    }
    fs.writeFileSync(jsonFile, `${JSON.stringify(config, null, 2)}\n`, "utf8");
    try { JSON.parse(fs.readFileSync(jsonFile, "utf8")); }
    catch (error) {
      fs.copyFileSync(backup, jsonFile);
      throw new SetupError("Something went wrong updating the Expo web configuration. The original file was restored and the backup was kept.");
    }
    fs.unlinkSync(backup);
    return;
  }
  if (fs.existsSync("app.config.js") || fs.existsSync("app.config.ts")) {
    warnings.push("Web config uses app.config.js/ts — please confirm the web bundler setting manually.");
  } else {
    warnings.push("Could not find an Expo app config file to update for web support.");
  }
}

function enableWebSupport() {
  banner(7, "Enabling web support");
  command("npx", ["expo", "install", "react-native-web", "react-dom"], "Enabling web support");
  updateAppJson();
}

function patchTsconfig() {
  banner(5, "Updating your TypeScript settings");
  const file = "tsconfig.json";
  const backup = "tsconfig.json.backup";
  if (!fs.existsSync(file)) throw new SetupError("tsconfig.json was not found, so the TypeScript settings could not be updated.");
  fs.copyFileSync(file, backup);
  let config;
  try { config = JSON.parse(fs.readFileSync(file, "utf8")); }
  catch (error) { throw new SetupError(`tsconfig.json is not valid JSON: ${error.message}. The backup was kept at tsconfig.json.backup.`); }
  if (!Object.prototype.hasOwnProperty.call(config, "include")) config.include = [];
  else if (!Array.isArray(config.include)) throw new SetupError('tsconfig.json "include" must be an array. The backup was kept at tsconfig.json.backup.');
  if (!config.include.includes("src/nativewind-env.d.ts")) config.include.push("src/nativewind-env.d.ts");
  fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  try { JSON.parse(fs.readFileSync(file, "utf8")); }
  catch (error) {
    try { fs.copyFileSync(backup, file); }
    catch (restoreError) { throw new SetupError(`Something went wrong updating tsconfig.json, and the original could not be restored: ${restoreError.message}. The backup remains at tsconfig.json.backup.`); }
    throw new SetupError("Something went wrong updating tsconfig.json.\n\nSetup has stopped so your project isn't left in a broken state.\nA backup of the original file was kept at tsconfig.json.backup.");
  }
  fs.unlinkSync(backup);
}

function finalVerify(name) {
  if (!fs.existsSync("package.json")) throw new SetupError("package.json could not be verified.");
  const nativewind = path.join("src", "nativewind-env.d.ts");
  if (!fs.existsSync(nativewind) || fs.readFileSync(nativewind, "utf8") !== `${NATIVEWIND_LINE}\n`) throw new SetupError("The NativeWind TypeScript file could not be verified.");
  let config;
  try { config = JSON.parse(fs.readFileSync("tsconfig.json", "utf8")); }
  catch (error) { throw new SetupError(`tsconfig.json could not be verified: ${error.message}`); }
  if (!Array.isArray(config.include) || !config.include.includes("src/nativewind-env.d.ts")) throw new SetupError("The NativeWind entry in tsconfig.json could not be verified.");
  if (!fs.existsSync("node_modules") || !fs.statSync("node_modules").isDirectory()) throw new SetupError("node_modules could not be verified.");
  if (!fs.existsSync(".") || !fs.statSync(".").isDirectory()) throw new SetupError(`The project folder could not be verified: ${name}`);
  const packageConfig = JSON.parse(fs.readFileSync("package.json", "utf8"));
  for (const dependency of ["react-native-web", "react-dom"]) {
    if (!packageConfig.dependencies || !packageConfig.dependencies[dependency]) throw new SetupError(`${dependency} could not be verified in package.json dependencies.`);
  }
}

async function main() {
  let currentStep = "Getting the project name";
  let projectName;
  try {
    projectName = await promptForName();
    if (projectName === null) { process.exitCode = 1; return; }
    currentStep = "Checking required software"; checkDependencies();
    currentStep = "Checking for an existing folder"; guardExistingDir(projectName);
    currentStep = "Creating your app"; scaffoldProject(projectName);
    currentStep = "Checking your new app"; verifyScaffold(projectName);
    currentStep = "Installing the latest Expo pieces"; syncExpoDeps();
    currentStep = "Adding NativeWind TypeScript support"; writeNativeWindTypes();
    currentStep = "Updating your TypeScript settings"; patchTsconfig();
    currentStep = "Personalizing your app"; personalizeHome(projectName);
    currentStep = "Enabling web support"; enableWebSupport();
    currentStep = "Verifying the setup"; finalVerify(projectName);
    let summary = `\n✅ ALL DONE!\n\nYour app "${projectName}" is ready.\n\nTo try it on your phone:\n  cd ${projectName}\n  npm run start\n  (then scan the QR code with Expo Go)\n\nTo try it in your browser:\n  cd ${projectName}\n  npm run web\n\nSetup finished correctly; this does not guarantee that the generated app builds or runs perfectly.`;
    if (warnings.length) summary += `\n\nNotes:\n${warnings.map((warning) => `⚠️  ${warning}`).join("\n")}`;
    console.log(summary);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    if (error instanceof SetupError && error.code === 3) {
      console.error(`❌ ${reason}`);
      process.exitCode = 3;
      return;
    }
    console.error(`\n❌ SETUP FAILED\n\nStep: ${currentStep}\nReason: ${reason}\n\nThe project may have been partially created.\n\nPlease check the folder:\n  ${projectName || "<ProjectName>"}/\n\nThen fix the issue and run the command again.`);
    process.exitCode = error instanceof SetupError ? error.code : 4;
  }
}

main();

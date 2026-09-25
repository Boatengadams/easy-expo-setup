#!/usr/bin/env node

/* Exit codes: 0 success, 1 validation, 2 missing dependency,
 * 3 existing directory, 4 setup/step failure. */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const readline = require("readline");

const warnings = [];
const projectsRoot = path.join(process.env.HOME || process.cwd(), "Desktop", "projects");
const noStart = process.argv.includes("--no-start");
const helpRequested = process.argv.includes("--help") || process.argv.includes("-h");

const NATIVEWIND_LINE = '/// <reference types="nativewind/types" />';
const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

class SetupError extends Error {
  constructor(message, code = 4) { super(message); this.code = code; }
}

function usage() {
  console.error("\nUsage:\n  node setup-project.js <project-name> [--no-start]\n\nExample:\n  node setup-project.js MyApp");
}

function banner(number, title) {
  console.log("\n==================================================");
  console.log(`STEP ${number}/8 - ${title}`);
  console.log("==================================================");
}

function validateName(name) {
  if (!name || name.trim() === "") return "A project name is required.";
  if (!NAME_RE.test(name)) return "Use letters, numbers, periods, hyphens, or underscores; no spaces, and start with a letter or number.";
  return null;
}

async function promptForName() {
  if (helpRequested) {
    usage();
    return null;
  }
  let name = process.argv.slice(2).find((argument) => !argument.startsWith("--"));
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

async function promptForType() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const lines = rl[Symbol.asyncIterator]();
    console.log("\nWhat type of app are you creating?");
    console.log("1. Starter app");
    console.log("2. Authentication app");
    rl.setPrompt("Choose [1]: ");
    rl.prompt();
    const answer = ((await lines.next()).value || "1").trim();
    if (answer !== "1" && answer !== "2") throw new SetupError("Choose 1 for a starter app or 2 for an authentication app.", 1);
    return answer === "1" ? "starter" : "auth";
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
  const target = path.join(projectsRoot, name);
  if (fs.existsSync(target)) throw new SetupError(`A folder named "${name}" already exists in ${projectsRoot}.\n\nChoose a different project name, or move/rename the existing folder, then try again.`, 3);
}

function scaffoldProject(name) {
  banner(1, "Creating your app");
  fs.mkdirSync(projectsRoot, { recursive: true });
  process.chdir(projectsRoot);
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

function installFeatureDependencies(type) {
  if (type !== "auth") return;
  banner(4, "Installing authentication features");
  command("npx", ["expo", "install", "formik", "expo-constants"], "Installing Formik and Expo Constants");
}

function writeFile(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}

function createAuthScreens(projectName) {
  banner(6, "Creating authentication screens");
  const authLayout = `import { Stack } from 'expo-router';\n\nexport default function AuthLayout() {\n  return <Stack screenOptions={{ headerShown: false }} />;\n}\n`;
  const login = `import { Formik, FormikHelpers } from 'formik';
import { Link, useRouter } from 'expo-router';
import { Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import Constants from 'expo-constants';

type LoginValues = { email: string; password: string };

export default function LoginScreen() {
  const router = useRouter();
  const initialValues: LoginValues = { email: '', password: '' };
  const validate = (values: LoginValues) => {
    const errors: Partial<LoginValues> = {};
    if (!values.email) errors.email = 'Email is required';
    else if (!/^\\S+@\\S+\\.\\S+$/.test(values.email)) errors.email = 'Enter a valid email';
    if (!values.password) errors.password = 'Password is required';
    return errors;
  };
  const submit = (_values: LoginValues, helpers: FormikHelpers<LoginValues>) => {
    helpers.setSubmitting(false);
    router.replace('/');
  };
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Welcome to ${projectName}</Text>
        <Text style={styles.subtitle}>Sign in to continue</Text>
        <Formik initialValues={initialValues} validate={validate} onSubmit={submit}>
          {({ handleChange, handleBlur, handleSubmit, isSubmitting, errors, touched }) => (
            <View>
              <TextInput placeholder="Email" autoCapitalize="none" keyboardType="email-address" style={styles.input} onChangeText={handleChange('email')} onBlur={handleBlur('email')} />
              {touched.email && errors.email ? <Text style={styles.error}>{errors.email}</Text> : null}
              <TextInput placeholder="Password" secureTextEntry style={styles.input} onChangeText={handleChange('password')} onBlur={handleBlur('password')} />
              {touched.password && errors.password ? <Text style={styles.error}>{errors.password}</Text> : null}
              <Pressable style={styles.button} disabled={isSubmitting} onPress={handleSubmit}><Text style={styles.buttonText}>{isSubmitting ? 'Signing in…' : 'Sign in'}</Text></Pressable>
            </View>
          )}
        </Formik>
        <Link href="/(auth)/signup" asChild><Pressable><Text style={styles.link}>Create an account</Text></Pressable></Link>
        <Text style={styles.version}>v{Constants.expoConfig?.version ?? '1.0.0'}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#f5f7fb' }, card: { gap: 12, backgroundColor: 'white', borderRadius: 20, padding: 24 }, title: { fontSize: 28, fontWeight: '700', textAlign: 'center' }, subtitle: { color: '#64748b', textAlign: 'center', marginBottom: 12 }, input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 14, marginBottom: 6 }, error: { color: '#dc2626', fontSize: 12, marginBottom: 4 }, button: { backgroundColor: '#2563eb', borderRadius: 10, padding: 15, alignItems: 'center', marginTop: 8 }, buttonText: { color: 'white', fontWeight: '700', fontSize: 16 }, link: { color: '#2563eb', textAlign: 'center', padding: 12 }, version: { color: '#94a3b8', textAlign: 'center', fontSize: 12 } });
`;
  const signup = login.replaceAll(`Welcome to ${projectName}`, 'Create your account').replace('Sign in to continue', 'Start building today').replace('Sign in', 'Create account').replace('Creating an account', 'Already have an account? Sign in').replace('href="/(auth)/signup"', 'href="/(auth)/login"');
  writeFile(path.join('app', '(auth)', '_layout.tsx'), authLayout);
  writeFile(path.join('app', '(auth)', 'login.tsx'), login);
  writeFile(path.join('app', '(auth)', 'signup.tsx'), signup);
}

function createCleanRoutes(projectName) {
  const tabs = path.join('app', '(tabs)');
  if (fs.existsSync(tabs)) fs.rmSync(tabs, { recursive: true, force: true });
  const home = `import { SafeAreaView, StyleSheet, Text, View } from 'react-native';\n\nexport default function HomeScreen() {\n  return (\n    <SafeAreaView style={styles.container}>\n      <View style={styles.content}>\n        <Text style={styles.title}>${projectName}</Text>\n        <Text style={styles.subtitle}>Your app is ready. Start building your feature here.</Text>\n      </View>\n    </SafeAreaView>\n  );\n}\n\nconst styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#f5f7fb' }, content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }, title: { fontSize: 30, fontWeight: '700', marginBottom: 10 }, subtitle: { color: '#64748b', textAlign: 'center' } });\n`;
  const rootLayout = `import '../global.css';\nimport { SafeAreaProvider } from 'react-native-safe-area-context';\nimport { Stack } from 'expo-router';\n\nexport default function RootLayout() {\n  return <SafeAreaProvider><Stack screenOptions={{ headerShown: false }}><Stack.Screen name="index" /><Stack.Screen name="(auth)" /><Stack.Screen name="modal" options={{ presentation: 'modal' }} /></Stack></SafeAreaProvider>;\n}\n`;
  writeFile(path.join('app', 'index.tsx'), home);
  writeFile(path.join('app', '_layout.tsx'), rootLayout);
}

function writeNativeWindTypes() {
  banner(5, "Adding NativeWind TypeScript support");
  fs.mkdirSync('src', { recursive: true });
  writeFile(path.join('src', 'nativewind-env.d.ts'), `${NATIVEWIND_LINE}\n`);
}

function findHomeScreen() {
  return path.join("app", "index.tsx");
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
    const welcome = `import { SafeAreaView, View, Text, StyleSheet } from "react-native";\n\nexport default function HomeScreen() {\n  return (\n    <SafeAreaView style={styles.safeArea}>\n      <View style={styles.container}>\n        <Text style={styles.title}>Welcome ${projectName}</Text>\n        <Text style={styles.subtitle}>Your app is set up and ready. Start editing this screen to build your project.</Text>\n      </View>\n    </SafeAreaView>\n  );\n}\n\nconst styles = StyleSheet.create({\n  safeArea: { flex: 1 },\n  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },\n  title: { fontSize: 28, fontWeight: "700", marginBottom: 12, textAlign: "center" },\n  subtitle: { fontSize: 16, textAlign: "center", opacity: 0.7 },\n});\n`;
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

function launchProject() {
  if (noStart) return;
  banner(8, "Starting your app");
  command("npm", ["start"], "Starting Expo");
}

function finalVerify(name, type) {
  const projectPath = path.resolve(process.cwd());
  if (projectPath !== path.join(projectsRoot, name)) throw new SetupError(`The project was created outside the expected folder: ${projectPath}`);
  if (!fs.existsSync("package.json")) throw new SetupError("package.json could not be verified.");
  if (type === "auth" && (!fs.existsSync(path.join("app", "(auth)", "login.tsx")) || !fs.existsSync(path.join("app", "(auth)", "signup.tsx")))) throw new SetupError("Authentication screens could not be verified.");
  if (type !== "auth" && fs.existsSync(path.join("app", "(auth)"))) throw new SetupError("Starter app should not contain authentication routes.");
  if (fs.existsSync(path.join("app", "(tabs)"))) throw new SetupError("Duplicate tab routes could not be removed.");
  if (!fs.existsSync(path.join("app", "index.tsx")) || !fs.existsSync(path.join("app", "_layout.tsx"))) throw new SetupError("Home routes could not be verified.");
  const nativewind = path.join("src", "nativewind-env.d.ts");
  if (!fs.existsSync(nativewind) || fs.readFileSync(nativewind, "utf8") !== `${NATIVEWIND_LINE}\n`) throw new SetupError("The NativeWind TypeScript file could not be verified.");
  let config;
  try { config = JSON.parse(fs.readFileSync("tsconfig.json", "utf8")); }
  catch (error) { throw new SetupError(`tsconfig.json could not be verified: ${error.message}`); }
  if (!Array.isArray(config.include) || !config.include.includes("src/nativewind-env.d.ts")) throw new SetupError("The NativeWind entry in tsconfig.json could not be verified.");
  if (!fs.existsSync("node_modules") || !fs.statSync("node_modules").isDirectory()) throw new SetupError("node_modules could not be verified.");
  const packageConfig = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const dependencies = ["react-native-web", "react-dom"];
  if (type === "auth") dependencies.push("formik", "expo-constants");
  for (const dependency of dependencies) {
    if (!packageConfig.dependencies || !packageConfig.dependencies[dependency]) throw new SetupError(`${dependency} could not be verified in package.json dependencies.`);
  }
}

async function main() {
  let currentStep = "Getting the project name";
  let projectName;
  let projectType;
  try {
    projectName = await promptForName();
    if (projectName === null) {
      if (helpRequested) return;
      process.exitCode = 1;
      return;
    }
    currentStep = "Choosing the app type"; projectType = await promptForType();
    currentStep = "Checking required software"; checkDependencies();
    currentStep = "Checking for an existing folder"; guardExistingDir(projectName);
    currentStep = "Creating your app"; scaffoldProject(projectName);
    currentStep = "Checking your new app"; verifyScaffold(projectName);
    currentStep = "Installing the latest Expo pieces"; syncExpoDeps();
    currentStep = "Installing authentication features"; installFeatureDependencies(projectType);
    currentStep = "Adding NativeWind TypeScript support"; writeNativeWindTypes();
    currentStep = "Updating your TypeScript settings"; patchTsconfig();
    currentStep = "Creating clean routes"; createCleanRoutes(projectName);
    if (projectType === "auth") {
      currentStep = "Creating authentication screens";
      createAuthScreens(projectName);
    }
    currentStep = "Enabling web support"; enableWebSupport();
    currentStep = "Verifying the setup"; finalVerify(projectName, projectType);
    currentStep = "Starting your app"; launchProject();
    let summary = `\n✅ ALL DONE!\n\nYour app "${projectName}" is ready.\n\nProject folder:\n  ${path.join(projectsRoot, projectName)}\n\nTo start it later:\n  cd ${path.join(projectsRoot, projectName)}\n  npm run start\n\nTo open it in your browser:\n  cd ${path.join(projectsRoot, projectName)}\n  npm run web`;
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

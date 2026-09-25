# Easy Expo Project Setup

![Easy Expo Setup](expo_setup.png)

This folder contains a simple, cross-platform setup tool for creating an
Expo/React Native app with NativeWind, tabs, Expo Router, and web support.

## Before you begin

You need Node.js installed first. Download it from [nodejs.org](https://nodejs.org)
(choose the LTS version) and use the installer with the default options.

## Clone this project

```bash
git clone https://github.com/Boatengadams/easy-expo-setup.git
cd easy-expo-setup
```

After cloning, run the launcher for your operating system or use the JavaScript setup directly:

```bash
node setup-project.js
```

## Install globally from GitHub

Install the setup command once so it can run from any directory:

```bash
npm install -g github:Boatengadams/easy-expo-setup
```

Then start a new project from anywhere:

```bash
easy-expo-setup
```

You can also pass a project name directly:

```bash
easy-expo-setup MyApp
```

The command creates new apps in your Desktop `projects` folder, regardless of your current working directory.


## Windows

1. Double-click `setup.bat`.
2. If that does not work, right-click the folder, choose **Open in Terminal**,
   and run `node setup-project.js`.

## macOS

1. Double-click `setup.command`.
2. If nothing happens, right-click it and choose **Open**, then click **Open**
   again in the popup. If needed, run `chmod +x setup.command` once in Terminal.
3. If double-clicking still does not work, open Terminal in this folder and run
   `bash setup.command`.

## Linux

1. Double-click `setup.sh`.
2. If that does not work, right-click the folder, choose **Open in Terminal**,
   and type `bash setup.sh`.

If any launcher is incompatible with your system, you can always open a
terminal in this folder and run the JavaScript setup directly:

```bash
node setup-project.js
```

After setup, the script asks for the project name and app type. The default is a clean starter app with no authentication. Choose option `2` to add Formik-powered login and signup screens. It creates the project in your Desktop `projects` folder and starts Expo automatically when setup is complete.

Use `--no-start` when you only want to create and configure the app without launching it:

```bash
node setup-project.js MyProjectName --no-start
```

## Resume an interrupted setup

Setup checkpoints each completed step. If your computer stops, the network drops, or a command is interrupted, run the same command again:

```bash
easy-expo-setup MyProjectName --resume
```

The setup state is stored outside the project at:

```text
~/Desktop/projects/.easy-expo-setup/MyProjectName.json
```

Completed steps are skipped safely. To inspect the saved progress:

```bash
easy-expo-setup MyProjectName --status
```

If the project folder already exists without a saved state, the tool stops instead of overwriting it.

## Command-line option

If you prefer to use a terminal, open this folder and run:

```bash
easy-expo-setup MyProjectName
```

Replace `MyProjectName` with the name you want for your app. After setup finishes:

```bash
cd MyProjectName
npm run start
```

To open the app in a browser, run:

```bash
npm run web
```

Setup can take a few minutes. Keep the window open until you see `ALL DONE!`.
## Author

Created by [Boateng Adams](https://www.linkedin.com/in/adamsboateng/).



The script confirms that setup finished correctly. It does not guarantee that
the generated app builds or runs perfectly.

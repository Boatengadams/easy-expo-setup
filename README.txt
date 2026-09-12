Easy Expo Project Setup
=======================

This folder contains a simple, cross-platform setup tool for creating an
Expo/React Native app with NativeWind, tabs, Expo Router, and web support.

Before you begin
----------------
You need Node.js installed first. Download it from https://nodejs.org
(choose the LTS version) and click through the installer with default options.

Windows
-------
1. Double-click setup.bat.

macOS
-----
1. Double-click setup.command.
2. If nothing happens, right-click it and choose Open, then click Open again
   in the popup. If needed, run chmod +x setup.command once in Terminal.

Linux
-----
1. Double-click setup.sh.
2. If that does not work, right-click the folder, choose "Open in Terminal",
   and type: bash setup.sh
   Alternatively run chmod +x setup.sh, then ./setup.sh.

What happens next
-----------------
You'll be asked to name your app, then it will set everything up automatically.
This can take a few minutes — don't close the window until you see ALL DONE!

Command-line option
-------------------
If you prefer to use a terminal, open this folder and run:

  node setup-project.js MyProjectName
  example 
  node setup-project.js BAGSGRAPHICS

Replace MyProjectName with the name you want for your app. After setup finishes:

  cd MyProjectName // like cd BAGSGRAPHICS
  npm run start

To open the app in a browser, run:

  npm run web

The script confirms that setup finished correctly. It does not guarantee that
the generated app builds or runs perfectly.

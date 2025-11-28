# Polite Exam - Android Build Guide

This guide explains how to build and deploy the Polite Exam app as a native Android application using Capacitor.

## Prerequisites

1. **Node.js** (v14 or higher)
2. **Android Studio** (latest version)
3. **Java JDK 17** (required by Android Studio)
4. **Android SDK** (installed via Android Studio)

## Project Structure

```
polite-exam/
├── android/                 # Android Studio project (open this folder)
│   ├── app/                 # Main Android app module
│   │   ├── src/main/
│   │   │   ├── assets/public/   # Web assets (auto-synced)
│   │   │   ├── java/            # Android Java code
│   │   │   ├── res/             # Android resources (icons, splash)
│   │   │   └── AndroidManifest.xml
│   │   └── build.gradle
│   └── build.gradle
├── www/                     # Built web assets (created by npm run build)
├── icons/                   # Source icons for the app
├── capacitor.config.json    # Capacitor configuration
└── package.json             # npm scripts and dependencies
```

## Quick Start

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Build Web Assets
```bash
npm run build
```

### Step 3: Sync with Android
```bash
npm run cap:sync
```

### Step 4: Open in Android Studio
```bash
npm run cap:open:android
```

Or simply:
```bash
npm run android:studio
```

## Building APK/AAB in Android Studio

### For Testing (Debug APK)

1. Open Android Studio
2. Wait for Gradle sync to complete
3. Go to **Build → Build Bundle(s) / APK(s) → Build APK(s)**
4. Find the APK at: `android/app/build/outputs/apk/debug/app-debug.apk`

### For Production (Signed AAB)

1. Go to **Build → Generate Signed Bundle / APK**
2. Select **Android App Bundle**
3. Create or select a keystore:
   - **Create New**: Store it safely (required for updates!)
   - Key alias: `polite-exam`
   - Validity: 25+ years
4. Select **release** build variant
5. Find the AAB at: `android/app/build/outputs/bundle/release/app-release.aab`

## Updating App Icons

1. In Android Studio, right-click on `res` folder
2. Select **New → Image Asset**
3. Choose **Launcher Icons (Adaptive and Legacy)**
4. For foreground: Select `icons/icon-maskable-512.png`
5. For background: Select a color (#2c3e50)
6. Click **Next → Finish**

## App Configuration

### Package ID
- **Current**: `com.politecoaching.exam`
- **Change in**: `android/app/build.gradle` (applicationId)

### App Name
- **Current**: "Polite Exam"
- **Change in**: `android/app/src/main/res/values/strings.xml`

### Theme Colors
- **Primary**: #2c3e50
- **Accent**: #3498db
- **Change in**: `android/app/src/main/res/values/colors.xml`

### Version
- **Version Code**: 1 (increment for each release)
- **Version Name**: "1.0"
- **Change in**: `android/app/build.gradle`

## Deploying to Play Store

### 1. Prepare App Listing
- App name: Polite Exam
- Description: Exam management system for Polite Coaching Centre
- Category: Education
- Screenshots: At least 2 phone screenshots

### 2. Upload AAB
1. Go to [Google Play Console](https://play.google.com/console)
2. Create new app → Fill details
3. Go to **Production → Create new release**
4. Upload the signed AAB file
5. Complete store listing requirements

### 3. Required Assets
- Feature graphic: 1024x500 px
- App icon: 512x512 px (already in `icons/`)
- Screenshots: Phone and tablet (optional)

## Updating the App

When you make changes to the web app:

```bash
# Rebuild web assets and sync
npm run android:build

# Then rebuild in Android Studio
```

## API Configuration

The app connects to your Vercel-deployed backend. Make sure:

1. Your Vercel deployment is live
2. The API URL in `api-integration.js` points to your Vercel URL
3. Environment variables are set in Vercel dashboard

## Troubleshooting

### Gradle Sync Failed
- Check internet connection
- File → Invalidate Caches and Restart

### App Crashes on Launch
- Check logcat in Android Studio
- Verify API connectivity

### Web Assets Not Updating
```bash
npm run build
npm run cap:sync
```
Then rebuild in Android Studio.

### Icons Not Showing
Regenerate icons using Android Studio's Image Asset Studio.

## NPM Scripts Reference

| Script | Description |
|--------|-------------|
| `npm run build` | Build web assets to www/ |
| `npm run cap:sync` | Sync web assets to Android |
| `npm run cap:open:android` | Open Android Studio |
| `npm run android:build` | Build + sync (one command) |
| `npm run android:studio` | Build, sync, and open Android Studio |

## Support

For issues with:
- **Web app**: Check browser console
- **Android build**: Check Android Studio's Build output
- **Runtime errors**: Check logcat in Android Studio

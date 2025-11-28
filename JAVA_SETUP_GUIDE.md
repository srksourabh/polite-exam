# 🔧 Java Setup & Android Build Guide

## ❌ Problem
You encountered: **"Unsupported class file major version 69"**

This means:
- Java 25 is installed on your system
- Android build tools need Java 17 (LTS version)
- JAVA_HOME environment variable is not set

## ✅ Solutions (Choose One)

### **Option 1: Quick Build (Try This First)** ⭐

1. Run: `quick-build.bat`
2. This will:
   - Auto-detect your Java installation
   - Set JAVA_HOME temporarily  
   - Build the Android app

**When to use:** If you just want to build quickly

---

### **Option 2: Install Java 17 (Recommended)** 🎯

1. Run: `install-java17-and-build.bat`
2. This will:
   - Download Java 17 LTS (~170 MB)
   - Install it properly with JAVA_HOME
   - Build your Android app automatically

**When to use:** For permanent, stable Android development

---

### **Option 3: Manual Java 17 Installation**

1. Go to: https://adoptium.net/temurin/releases/?version=17
2. Download: **Windows x64 JDK .msi installer**
3. Install and check these options:
   - ✅ Set JAVA_HOME variable
   - ✅ Add to PATH
4. Restart Command Prompt
5. Verify: `java -version` should show "17.x.x"
6. Build: Run `build-release.bat`

---

## 🧪 What We Fixed

### Modified Files:
1. **android/app/build.gradle**
   - Added Java 17 compatibility settings
   - Configured source/target compatibility

2. **android/build.gradle**
   - Added Java toolchain configuration
   - Forces Java 17 for all compilation

### What This Does:
- Even with Java 25 installed, build will use Java 17 compatibility
- Prevents "unsupported class file version" errors
- Follows Android development best practices

---

## 📱 After Java is Fixed

Run one of these to build:
```cmd
# Option A: Use the automated script
build-release.bat

# Option B: Manual commands
cd android
gradlew clean
gradlew bundleRelease
```

Output location:
```
android\app\build\outputs\bundle\release\app-release.aab
```

---

## 🔍 Troubleshooting

### "JAVA_HOME is not set"
- Run `install-java17-and-build.bat` to fix permanently
- OR use `quick-build.bat` for temporary fix

### "java: command not found"
- Java is not in your PATH
- Install Java 17 using Option 2 above

### Build still fails
1. Close ALL Command Prompt windows
2. Restart computer
3. Try again with `quick-build.bat`

---

## 💡 Why Java 17?

- **LTS (Long Term Support)**: Stable for years
- **Android Standard**: Required by modern Android build tools
- **Compatibility**: Works with all Android Gradle Plugin versions
- **Tested**: Billions of Android apps use Java 17

---

## 📊 Version Information

| Component | Version | Status |
|-----------|---------|--------|
| Your Java | 25.0.1 | Too new for Android |
| Required | 17.x | ✅ LTS, Stable |
| Android Gradle Plugin | 8.13.1 | ✅ Latest |
| Gradle | 8.13 | ✅ Latest |

---

## 🚀 Next Steps

1. Choose a solution above
2. Run the corresponding script
3. Wait for build to complete (~2-5 minutes)
4. Find AAB file in: `android\app\build\outputs\bundle\release\`
5. Upload to Google Play Console

---

## 📞 Need Help?

If builds still fail:
1. Take a screenshot of the error
2. Note which option you tried
3. Check the full error message in the terminal

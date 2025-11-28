#!/usr/bin/env node

/**
 * Copy icons to Android project
 * This copies the PWA icons to the Android mipmap directories
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const ICONS_DIR = path.join(ROOT_DIR, 'icons');
const ANDROID_RES = path.join(ROOT_DIR, 'android', 'app', 'src', 'main', 'res');

// Source icon file (512x512 is the largest)
const sourceIcon = path.join(ICONS_DIR, 'icon-512.png');
const sourceMaskable = path.join(ICONS_DIR, 'icon-maskable-512.png');

// Target mipmap directories with sizes
const mipmapSizes = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192
};

console.log('\n📱 Copying icons to Android project...\n');

// Note: This script serves as documentation for icon placement
// For actual icon resizing, use Android Studio's Image Asset Studio
// or a tool like android-icon-resize-cli

console.log('To update Android app icons:');
console.log('');
console.log('1. Open Android Studio');
console.log('2. Right-click on res folder -> New -> Image Asset');
console.log('3. Select the source icon from icons/icon-512.png');
console.log('4. Configure foreground layer with icons/icon-maskable-512.png');
console.log('5. Generate all required icon sizes');
console.log('');
console.log('Source icons available:');
console.log(`  - ${path.relative(ROOT_DIR, sourceIcon)}`);
console.log(`  - ${path.relative(ROOT_DIR, sourceMaskable)}`);
console.log('');

// For now, copy the 192x192 icons to the appropriate directories as a fallback
const icon192 = path.join(ICONS_DIR, 'icon-192.png');
const iconMaskable192 = path.join(ICONS_DIR, 'icon-maskable-192.png');

if (fs.existsSync(icon192)) {
  // Copy to xhdpi and xxhdpi as close matches
  const targets = ['mipmap-xhdpi', 'mipmap-xxhdpi'];

  for (const target of targets) {
    const destDir = path.join(ANDROID_RES, target);
    if (fs.existsSync(destDir)) {
      // Copy as foreground for adaptive icons
      const dest = path.join(destDir, 'ic_launcher_foreground.png');
      fs.copyFileSync(iconMaskable192 || icon192, dest);
      console.log(`Copied to ${target}/ic_launcher_foreground.png`);
    }
  }
}

console.log('\n✅ Basic icons copied.');
console.log('For best results, use Android Studio Image Asset Studio.\n');

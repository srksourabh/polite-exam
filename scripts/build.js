#!/usr/bin/env node

/**
 * Build script for Polite Exam Android deployment
 * Copies all web assets to the www directory for Capacitor
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const WWW_DIR = path.join(ROOT_DIR, 'www');

// Files and directories to copy to www
const filesToCopy = [
  'index.html',
  'api-integration.js',
  'sw.js',
  'manifest.json',
  'assetlinks.json'
];

const directoriesToCopy = [
  'icons',
  '.well-known'
];

// Helper function to copy file
function copyFile(src, dest) {
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  fs.copyFileSync(src, dest);
  console.log(`  Copied: ${path.relative(ROOT_DIR, src)} -> ${path.relative(ROOT_DIR, dest)}`);
}

// Helper function to copy directory recursively
function copyDirectory(src, dest) {
  if (!fs.existsSync(src)) {
    console.log(`  Skipped (not found): ${path.relative(ROOT_DIR, src)}`);
    return;
  }

  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      // Skip markdown files
      if (entry.name.endsWith('.md')) continue;
      copyFile(srcPath, destPath);
    }
  }
}

// Clean www directory
function cleanWww() {
  if (fs.existsSync(WWW_DIR)) {
    fs.rmSync(WWW_DIR, { recursive: true });
    console.log('Cleaned www directory');
  }
  fs.mkdirSync(WWW_DIR, { recursive: true });
}

// Main build function
function build() {
  console.log('\n🔨 Building Polite Exam for Android...\n');

  // Clean and create www directory
  cleanWww();

  // Copy individual files
  console.log('Copying files:');
  for (const file of filesToCopy) {
    const src = path.join(ROOT_DIR, file);
    const dest = path.join(WWW_DIR, file);

    if (fs.existsSync(src)) {
      copyFile(src, dest);
    } else {
      console.log(`  Skipped (not found): ${file}`);
    }
  }

  // Copy directories
  console.log('\nCopying directories:');
  for (const dir of directoriesToCopy) {
    const src = path.join(ROOT_DIR, dir);
    const dest = path.join(WWW_DIR, dir);
    console.log(`  Copying ${dir}/...`);
    copyDirectory(src, dest);
  }

  console.log('\n✅ Build complete! Output in www/\n');
  console.log('Next steps:');
  console.log('  1. Run: npm run cap:sync');
  console.log('  2. Run: npm run cap:open:android');
  console.log('  3. Build APK/AAB in Android Studio\n');
}

// Run build
build();

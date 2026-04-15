const { withAndroidManifest } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PACKAGE_PATH = 'com/mjones4/soundzone';
const PACKAGE_NAME = 'com.mjones4.soundzone';

module.exports = function withSoundZoneService(config) {
  config = withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const mainApplication = manifest.application[0];

    // Step 1 — Add service to AndroidManifest
    if (!mainApplication.service) mainApplication.service = [];
    const serviceName = `${PACKAGE_NAME}.SoundZoneForegroundService`;
    const alreadyAdded = mainApplication.service.some(
      (s) => s.$?.['android:name'] === serviceName
    );
    if (!alreadyAdded) {
      mainApplication.service.push({
        $: {
          'android:name': serviceName,
          'android:foregroundServiceType': 'microphone',
          'android:stopWithTask': 'false',
          'android:exported': 'false',
        },
      });
      console.log('[SoundZone Plugin] Added SoundZoneForegroundService to AndroidManifest');
    }

    // Step 2 — Add permissions
    if (!manifest['uses-permission']) manifest['uses-permission'] = [];
    const requiredPermissions = [
      'android.permission.RECORD_AUDIO',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_MICROPHONE',
      'android.permission.WAKE_LOCK',
      'android.permission.POST_NOTIFICATIONS',
    ];
    for (const permission of requiredPermissions) {
      const exists = manifest['uses-permission'].some(
        (p) => p.$?.['android:name'] === permission
      );
      if (!exists) {
        manifest['uses-permission'].push({ $: { 'android:name': permission } });
        console.log(`[SoundZone Plugin] Added permission: ${permission}`);
      }
    }

    const projectRoot = cfg.modRequest.projectRoot;
    const androidRoot = path.join(projectRoot, 'android');

    // Step 3 — Copy Kotlin files into Android project
    const destDir = path.join(androidRoot, 'app/src/main/java', PACKAGE_PATH);
    fs.mkdirSync(destDir, { recursive: true });

    const srcDir = path.join(projectRoot, 'soundzone-foreground-service-src/android/src/main/java', PACKAGE_PATH);
    const filesToCopy = [
      'SoundZoneForegroundService.kt',
      'SoundZoneForegroundModule.kt',
    ];
    for (const file of filesToCopy) {
      const src = path.join(srcDir, file);
      const dest = path.join(destDir, file);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log(`[SoundZone Plugin] Copied ${file}`);
      } else {
        console.warn(`[SoundZone Plugin] Missing: ${src}`);
      }
    }

    // Step 4 — Patch settings.gradle
    const settingsGradlePath = path.join(androidRoot, 'settings.gradle');
    if (fs.existsSync(settingsGradlePath)) {
      let settings = fs.readFileSync(settingsGradlePath, 'utf8');
      if (!settings.includes(':soundzone-foreground-service')) {
        const includeBlock = `
// SoundZone Foreground Service
include ':soundzone-foreground-service'
project(':soundzone-foreground-service').projectDir = new File(rootProject.projectDir, '../soundzone-foreground-service-src/android')
`;
        settings += includeBlock;
        fs.writeFileSync(settingsGradlePath, settings);
        console.log('[SoundZone Plugin] Patched settings.gradle');
      }
    }

    // Step 5 — Patch app/build.gradle
    const appBuildGradlePath = path.join(androidRoot, 'app/build.gradle');
    if (fs.existsSync(appBuildGradlePath)) {
      let buildGradle = fs.readFileSync(appBuildGradlePath, 'utf8');
      if (!buildGradle.includes(':soundzone-foreground-service')) {
        buildGradle = buildGradle.replace(
          /dependencies \{/,
          `dependencies {\n    implementation project(':soundzone-foreground-service')`
        );
        fs.writeFileSync(appBuildGradlePath, buildGradle);
        console.log('[SoundZone Plugin] Patched app/build.gradle');
      }
    }

    return cfg;
  });

  return config;
};
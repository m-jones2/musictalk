const { withAndroidManifest } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PACKAGE_NAME = 'com.mjones4.soundzone';
const PACKAGE_PATH = 'com/mjones4/soundzone';

module.exports = function withSoundZoneService(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const mainApplication = manifest.application[0];
    const projectRoot = cfg.modRequest.projectRoot;

    // Copy Kotlin files into Android project
    const androidSrcDir = path.join(
      projectRoot,
      'android/app/src/main/java',
      PACKAGE_PATH
    );

    fs.mkdirSync(androidSrcDir, { recursive: true });

    const kotlinSrcDir = path.join(
      projectRoot,
      'modules/soundzone-foreground-service/android/src/main/java',
      PACKAGE_PATH
    );

    const filesToCopy = [
      'SoundZoneForegroundService.kt',
      'SoundZoneForegroundModule.kt',
    ];

    for (const file of filesToCopy) {
      const src = path.join(kotlinSrcDir, file);
      const dest = path.join(androidSrcDir, file);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log(`[SoundZone Plugin] Copied ${file} to Android project`);
      } else {
        console.warn(`[SoundZone Plugin] Missing file: ${src}`);
      }
    }

    // Add service declaration
    if (!mainApplication.service) {
      mainApplication.service = [];
    }

    const serviceName = `${PACKAGE_NAME}.SoundZoneForegroundService`;
    const alreadyAdded = mainApplication.service.some(
      (s) => s.$?.['android:name'] === serviceName
    );

    if (!alreadyAdded) {
      mainApplication.service.push({
        $: {
          'android:name': serviceName,
          'android:foregroundServiceType': 'microphone',
          'android:stopWithTask': 'true',
          'android:exported': 'false',
        },
      });
      console.log('[SoundZone Plugin] Added SoundZoneForegroundService to AndroidManifest');
    }

    // Add permissions
    if (!manifest['uses-permission']) {
      manifest['uses-permission'] = [];
    }

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
        manifest['uses-permission'].push({
          $: { 'android:name': permission },
        });
        console.log(`[SoundZone Plugin] Added permission: ${permission}`);
      }
    }

    return cfg;
  });
};
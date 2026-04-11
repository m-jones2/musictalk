const { withAndroidManifest } = require('@expo/config-plugins');

const PACKAGE_NAME = 'com.mjones4.soundzone';

module.exports = function withSoundZoneService(config) {
  // Step 1: Inject service declaration into AndroidManifest
  config = withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const mainApplication = manifest.application[0];

    // Ensure service array exists
    if (!mainApplication.service) {
      mainApplication.service = [];
    }

    const serviceName = `${PACKAGE_NAME}.SoundZoneForegroundService`;

    // Avoid duplicate service declarations
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

    // Step 2: Ensure required permissions are declared
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

  return config;
};
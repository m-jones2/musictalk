module.exports = {
  expo: {
    owner: "mjones4",
    name: "SoundZone",
    slug: "musictalk",
    version: "1.0.0",
    icon: "./assets/images/icon.png",
    scheme: "soundzone",
    splash: {
      image: "./assets/images/splash-icon.png",
      backgroundColor: "#0f0f0f",
      resizeMode: "contain",
    },
    android: {
      package: "com.mjones4.soundzone",
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON || "./google-services.json",
      adaptiveIcon: {
        foregroundImage: "./assets/images/android-icon-foreground.png",
        backgroundColor: "#0f0f0f",
      },
    },
    extra: {
      eas: {
        projectId: "9e5dc256-5eee-4850-acf7-44568d9cb25f",
      },
    },
    plugins: [
      [
        "expo-build-properties",
        {
          ios: {
            useFrameworks: "static",
          },
        },
      ],
      [
        "expo-notifications",
        {
          icon: "./assets/images/icon.png",
          color: "#1DB954",
        },
      ],
    ],
  },
};
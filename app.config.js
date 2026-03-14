module.exports = {
  expo: {
    name: "MusicTalk",
    slug: "musictalk",
    version: "1.0.0",
    android: {
      package: "com.mjones4.musictalk",
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
    ],
  },
};
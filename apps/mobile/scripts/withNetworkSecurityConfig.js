const {
  withAndroidManifest,
  withDangerousMod,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

function withNetworkSecurityConfig(config) {
  // 1️⃣ 修改 AndroidManifest.xml
  config = withAndroidManifest(config, (config) => {
    const app = config.modResults.manifest.application?.[0];
    if (app) {
      app.$['android:networkSecurityConfig'] =
        '@xml/network_security_config';
      
      // 添加 smallestScreenSize 到 configChanges
      const mainActivity = app.activity?.find((activity) => {
        return activity['intent-filter']?.some((filter) => {
          return filter.action?.some((action) => action.$['android:name'] === 'android.intent.action.MAIN') &&
                 filter.category?.some((category) => category.$['android:name'] === 'android.intent.category.LAUNCHER');
        });
      });

      if (mainActivity?.$) {
        const configChanges = mainActivity.$['android:configChanges'] || '';
        if (configChanges && !configChanges.includes('smallestScreenSize')) {
          mainActivity.$['android:configChanges'] = `${configChanges}|smallestScreenSize`;
          console.log(`Updated android:configChanges to: ${mainActivity.$['android:configChanges']}`);
        }
      }
    }
    return config;
  });

  // 2️⃣ 复制 network_security_config.xml
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const src = path.join(
        config.modRequest.projectRoot,
        'network_security_config.xml'
      );
      const dest = path.join(
        config.modRequest.platformProjectRoot,
        'app/src/main/res/xml/network_security_config.xml'
      );

      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);

      return config;
    },
  ]);

  return config;
}

module.exports = withNetworkSecurityConfig;

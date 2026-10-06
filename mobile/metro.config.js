// Metro for a workspace: Expo's defaults already watch the repo root and resolve
// hoisted packages. One addition: the web app uses a newer React than this SDK,
// so every import of react/react-dom (including from hoisted packages like
// react-native) must resolve to this app's own copy.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const own = (name) => path.dirname(require.resolve(`${name}/package.json`, { paths: [__dirname] }));
const pinned = { react: own('react'), 'react-dom': own('react-dom') };

const resolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const [pkg, ...rest] = moduleName.split('/');
  if (pinned[pkg]) {
    const target = path.join(pinned[pkg], ...rest);
    return (resolveRequest ?? context.resolveRequest)({ ...context, originModulePath: path.join(__dirname, 'index.js') }, target, platform);
  }
  return (resolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;

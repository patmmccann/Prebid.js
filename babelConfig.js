
let path = require('path');

function useLocal(module) {
  return require.resolve(module, {
    paths: [
      __dirname
    ]
  })
}

module.exports = function (options = {}) {
  return {
    'presets': [
      [
        useLocal('@babel/preset-env'),
        {
          // target modern browsers that support ES modules
          'targets': { 'esmodules': true },
          // disable module transformation for non-test builds
          'modules': options.test ? 'commonjs' : false,
        }
      ]
    ],
    'plugins': (() => {
      const plugins = [
        [path.resolve(__dirname, './plugins/pbjsGlobals.js'), options],
        [useLocal('@babel/plugin-transform-runtime')],
      ];
      if (options.codeCoverage) {
        plugins.push([useLocal('babel-plugin-istanbul')])
      }
      return plugins;
    })(),
  }
}

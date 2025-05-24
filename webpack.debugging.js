var path = require('path');

module.exports = {
  mode: 'production',
  devtool: 'source-map',
  cache: {
    type: 'filesystem'
  },
  resolve: {
    modules: [
      path.resolve('.'),
      'node_modules'
    ],
  },
  entry: {
    'debugging-standalone': {
      import: './modules/debugging/standalone.js',
    }
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: path.resolve('./node_modules'), // required to prevent loader from choking non-Prebid.js node_modules
        use: [
          {
            loader: 'babel-loader',
            options: {
              cacheDirectory: true,
              cacheCompression: false
            }
          }
        ]
      },
    ]
  }
};

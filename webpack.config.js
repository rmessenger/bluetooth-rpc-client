const path = require('path');

module.exports = {
    entry: './index.js',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'bluetooth-rpc-client.js',
        library: 'BluetoothRPCClient',
        libraryTarget: 'umd'
    },
};

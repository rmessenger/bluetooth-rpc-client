# Bluetooth RPC Client

The client side of a library allowing Remove Procedure Call (RPC) from a web application to a Node.js server on a Bluetooth-enabled device.

## Installation

To install, simply run:

    npm install bluetooth-rpc-client

## Usage

**This library is designed to be used with [bluetooth-rpc-server](https://www.npmjs.com/package/bluetooth-rpc-server)**
**This library requires a browser which supports [Web Bluetooth](https://developers.google.com/web/updates/2015/07/interact-with-ble-devices-on-the-web)**

    import * as BluetoothRPCClient from 'bluetooth-rpc-client';
    const serviceUuid = '...this is defined on the server...';
    const characteristicUuid = '...this is defined on the server...';

    BluetoothRPCClient.connect({ serviceUuid, characteristicUuid });
        .then(device => device.doSomething(1, 2, 3)) // doSomething(x, y, z) is an async function defined on the server
        .then(returnValue => {
            // ... do something with the return value here ...
        });

Upon calling `BluetoothRPCClient.connect()`, the user will be presented with
a dialog to select the device they wish to connect to. If your server is
running, you will see the device name you defined in the list. If everything
goes well, the Promise will resolve with a `device` object, which you can use
to call methods corresponding to the `handlers` defined on the server.

**Note: all of these handlers will return a Promise, regardless of whether they
were defined as async functions on the server.**

import Murmurhash from 'murmurhash';
import { encode, decode } from 'msgpack-lite';

const packetSize = 21;
const readDelayGrowthFactor = 1.2;
const initialReadDelay = 10;
const emptyPacket = new Uint8Array(0);

function BluetoothRpcClient(characteristic) {
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function write(object) {
        const msg = encode(object);
        for (let i = 0; i < msg.byteLength; i += packetSize) {
            const thisPacketSize = Math.min(packetSize, msg.byteLength - i);
            const packet = new Uint8Array(thisPacketSize);
            for (let j = 0; j < thisPacketSize; j ++) {
                packet[j] = msg[i + j];
            }
            await characteristic.writeValue(packet);
            // eslint-disable-next-line no-console
            console.log('sent packet', packet);
        }
        if (msg.byteLength % packetSize === 0) {
            await characteristic.writeValue(emptyPacket);
            // eslint-disable-next-line no-console
            console.log('sent empty packet');
        }
    }

    async function read() {
        let packets = [];
        let done = false;
        do {
            const packet = await characteristic.readValue();
            packets.push(packet);
            // eslint-disable-next-line no-console
            console.log('received packet', packet);
            if (packet.byteLength !== packetSize) {
                done = true;
            }
        } while (!done);
        let msgSize = packets.reduce((total, p) => total + p.byteLength, 0);
        let msg = new Uint8Array(msgSize);
        let msgPosition = 0;
        for (let i = 0; i < packets.length; i++) {
            for (let j = 0; j < packets[i].byteLength; j++) {
                msg[msgPosition++] = packets[i].getUint8(j);
            }
        }
        return decode(msg);
    }

    async function sendRequest(handler, args) {
        const id = Math.round(Math.random() * 1024 * 1024);
        let requestObj = { h: Murmurhash.v3(handler), i: id };
        if (args.length > 0) {
            requestObj.a = args;
        }
        await write(requestObj);
        return id;
    }

    let unsentRequests = [];
    let sentRequests = [];
    let processingRequests = false;

    async function processRequests() {
        if (processingRequests) { return; }
        processingRequests = true;
        let readDelay = initialReadDelay;
        let nextRead = Date.now();
        while (unsentRequests.length > 0 || sentRequests.length > 0) {
            if (unsentRequests.length > 0) {
                readDelay = initialReadDelay;
                let ur = unsentRequests.pop();
                try {
                    ur.id = await sendRequest(ur.handler, ur.args);
                    sentRequests.unshift(ur);
                } catch (error) {
                    ur.reject(error);
                }
            }
            if (sentRequests.length > 0 && Date.now() >= nextRead) {
                // eslint-disable-next-line no-console
                const response = await read();
                const id = response ? response.i : null;
                const sr = sentRequests.find(r => r.id === id);
                if (sr) {
                    readDelay = initialReadDelay;
                    sentRequests = sentRequests.filter(r => r.id !== sr.id);
                    if (response.e) {
                        sr.reject(new Error(response.e));
                    } else {
                        sr.resolve(response.r);
                    }
                } else if (unsentRequests.length === 0) {
                    readDelay *= readDelayGrowthFactor;
                    nextRead = Date.now() + readDelay;
                    await sleep(initialReadDelay);
                }
            }
        }
        processingRequests = false;
    }

    this.request = function(handler, args) {
        return new Promise((resolve, reject) => {
            unsentRequests.unshift({
                handler,
                args,
                resolve,
                reject,
            });
            processRequests();
        });
    }
}

function directHandlerCallWrapper (cs) {
    return new Proxy(cs, {
        get: function (target, name) {
            if (name === 'then' || name === 'catch') {
                return undefined;
            }
            return (...args) => target.request(name, args);
        }
    });
}

export async function connect({serviceUuid, characteristicUuid}) {
    if (!navigator.bluetooth) {
        throw new Error('This device does not support bluetooth!');
    }
    const device = await navigator.bluetooth.requestDevice({
        filters: [
            {services: [serviceUuid]},
        ],
    });
    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(serviceUuid);
    const characteristics = await service.getCharacteristics(characteristicUuid);
    if (characteristics.length === 1) {
        const cs = new BluetoothRpcClient(characteristics[0]);
        return directHandlerCallWrapper(cs);
    } else {
        throw new Error('Wrong number of characteristics!');
    }
}

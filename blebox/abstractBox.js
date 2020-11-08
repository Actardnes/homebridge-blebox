const communication = require("../common/communication");
const bleboxCommands = require("../common/bleboxCommands");

const NON_ALPHANUMERIC_REGEX = /[^a-zA-Z0-9\u00C0-\u024F]/g;
const maxBadRequestsCount = 4;
const deviceInfoIntervalInMs = 30000;
const specificStateIntervalInMs = 10000;

class AbstractAccessoryWrapper {
    constructor(accessory, log, api) {
        this._log = log;
        this.badRequestsCounter = 0;

        this.nameCharacteristic = api.hap.Characteristic.Name;
        this.accessory = accessory;
    }

    init(servicesDefList, subtypes, deviceInfo, stateInfo) {
        if (deviceInfo && stateInfo) {
            this.createBleboxContext();
            this.updateDeviceInfo(deviceInfo);
            for (let serviceNumber = 0; serviceNumber < servicesDefList.length; serviceNumber++) {
                const subType = subtypes[serviceNumber];
                this.accessory.addService(servicesDefList[serviceNumber], this.getServiceName(serviceNumber), subType);
            }
            this.updateDeviceInfo(deviceInfo);
            this.updateStateInfo(stateInfo);
        }
    }

    log(message) {
        const device = this.getDevice();
        const params = Array.prototype.slice.call(arguments, 1) || [];
        params.unshift("%s ( %s ): " + message, this.type.toUpperCase(), device.deviceName);
        this._log.apply(this._log, params)
    }

    getAccessory() {
        return this.accessory;
    };

    createBleboxContext() {
        this.accessory.context.blebox = this.accessory.context.blebox || {};
    }

    assignCharacteristics() {
        for (let i = 1; i < this.accessory.services.length; i++) {
            const service = this.accessory.services[i];
            const serviceNumber = i - 1;
            service.getCharacteristic(this.nameCharacteristic)
                .on('get', this.onGetServiceName.bind(this, serviceNumber));
        }
    }

    updateDeviceInfoCharacteristics() {
        for (let i = 1; i < this.accessory.services.length; i++) {
            const service = this.accessory.services[i];
            const serviceNumber = i - 1;
            service.updateCharacteristic(this.nameCharacteristic, this.getServiceName(serviceNumber))
        }
    }

    updateStateInfoCharacteristics() {
        this.log("Not supported method: updateStateInfo")
    };

    getServiceName(serviceNumber) {
        const device = this.getDevice();
        return device.deviceName;
    }

    onGetServiceName(serviceNumber, callback) {
        const serviceName = this.getServiceName(serviceNumber);
        this.log("Getting 'name' characteristic ...");
        if (this.isResponding() && serviceName) {
            this.log("Current 'name' characteristic is %s", serviceName);
            callback(null, serviceName);
        } else {
            this.log("Error getting 'name' characteristic. Name: %s", serviceName);
            callback(new Error("Error getting 'name'."));
        }
    };

    parseDeviceInfo(deviceInfo) {
        if (deviceInfo) {
            const device = deviceInfo.device || deviceInfo;
            if (!device.ip && deviceInfo.network) {
                device.ip = deviceInfo.network.ip;
            }
            device.deviceName = device.deviceName ? device.deviceName.replace(NON_ALPHANUMERIC_REGEX, ' ') : "";
            return device;
        }
    };

    updateDeviceInfo(deviceInfo) {
        const newDevice = this.parseDeviceInfo(deviceInfo);
        if (newDevice) {
            const device = this.getDevice();
            this.accessory.context.blebox.device = newDevice;
            if (device && device.deviceName !== newDevice.deviceName) {
                this.updateDeviceInfoCharacteristics();
            }
        }
    };

    updateStateInfo(stateInfo) {
        this.log("Not supported method: updateStateInfo")
    }

    getDevice() {
        return this.accessory.context.blebox.device;
    };

    isResponding() {
        return this.badRequestsCounter <= maxBadRequestsCount;
    };

    checkDeviceState() {
        const device = this.getDevice();
        const self = this;
        communication.send(bleboxCommands.getDeviceState, device.ip, {
            onSuccess: function (deviceInfo) {
                const newDevice = self.parseDeviceInfo(deviceInfo)
                if (newDevice) {
                    if (device.id === newDevice.id) {
                        self.badRequestsCounter = 0;
                        self.updateDeviceInfo(deviceInfo);
                    }
                    // else {
                    //     self.badRequestsCounter = maxBadRequestsCount + 1;
                    //     self.stopListening();
                    // }
                }
            }, onError: function () {
                self.badRequestsCounter++;
            }
        });
    };

    checkSpecificState() {
        const device = this.getDevice();
        const self = this;
        communication.send(this.checkStateCommand, device.ip, {
            onSuccess: function (stateInfo) {
                if (stateInfo) {
                    self.badRequestsCounter = 0;
                    self.updateStateInfo(stateInfo);
                    self.updateStateInfoCharacteristics();
                }
            }, onError: function () {
                self.badRequestsCounter++;
            }
        });
    };

    startListening() {
        this.stopListening();
        const randomDelay = Math.floor(Math.random() * 5000);
        this.checkDeviceState();
        this.deviceInfoInterval = setInterval(this.checkDeviceState.bind(this), deviceInfoIntervalInMs + randomDelay);
        this.checkSpecificState();
        this.specificStateInterval = setInterval(this.checkSpecificState.bind(this), specificStateIntervalInMs + randomDelay);
    };

    stopListening() {
        clearInterval(this.deviceInfoInterval);
        clearInterval(this.specificStateInterval);
    };
}

module.exports = AbstractAccessoryWrapper;
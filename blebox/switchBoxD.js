const communication = require("../common/communication");
const bleboxCommands = require("../common/bleboxCommands");
const SWITCHBOXD_TYPE = require("../common/bleboxConst").BLEBOX_TYPE.SWITCHBOXD;
const AbstractBoxWrapper = require("./abstractBox");

class SwitchBoxDAccessoryWrapper extends AbstractBoxWrapper {
    constructor(accessory, log, api, deviceInfo, stateInfo) {
        super(accessory, log, api);

        this.type = SWITCHBOXD_TYPE;
        this.checkStateCommand = bleboxCommands.getRelayState;

        this.servicesDefList = [api.hap.Service.Switch, api.hap.Service.Switch];
        this.servicesSubTypes = ['Output 1', 'Output 2'];

        this.onCharacteristic = api.hap.Characteristic.On;

        this.init(deviceInfo, stateInfo);

        this.assignCharacteristics();

        this.startListening();
    }

    assignCharacteristics() {
        super.assignCharacteristics();
        for (let serviceNumber = 0; serviceNumber < this.servicesDefList.length; serviceNumber++) {
            const service = this.getService(serviceNumber);
            service.getCharacteristic(this.onCharacteristic)
                .on('get', this.onGetOnState.bind(this, serviceNumber))
                .on('set', this.onSetOnState.bind(this, serviceNumber));
        }
    }

    updateStateInfoCharacteristics() {
        const relays = this.getRelays();
        if (relays) {
            for (let serviceNumber = 0; serviceNumber < this.servicesDefList.length; serviceNumber++) {
                const service = this.getService(serviceNumber);
                service.updateCharacteristic(this.onCharacteristic, this.getCurrentRelayValue(serviceNumber));
            }
        }
    };

    updateStateInfo(stateInfo) {
        if (stateInfo) {
            this.accessory.context.blebox.relays = stateInfo.relays || stateInfo;
            this.updateStateInfoCharacteristics();
        }
    }

    getRelays() {
        return this.accessory.context.blebox.relays;
    }

    getServiceName(serviceNumber) {
        const serviceName = super.getServiceName(serviceNumber);
        const suffix = this.getServiceNameSuffix(serviceNumber);
        return `${serviceName} ${suffix}`;
    }

    getServiceNameSuffix(serviceNumber) {
        const relays = this.getRelays() || [];
        const {name = this.servicesSubTypes[serviceNumber]} = relays[serviceNumber] || {};
        return name;
    }

    getCurrentRelayValue(serviceNumber) {
        const relays = this.getRelays() || [];
        const {state = false} = relays[serviceNumber] || {};
        return !!state;
    };

    onGetOnState(serviceNumber, callback) {
        this.log("Getting 'On' characteristic ...");
        const relays = this.getRelays();
        if (this.isResponding() && relays) {
            const value = this.getCurrentRelayValue(serviceNumber);
            this.log("Current 'On' characteristic is %s", value);
            callback(null, value);
        } else {
            this.log("Error getting 'On' characteristic. Relays: %s", relays);
            callback(new Error("Error getting 'On'."));
        }
    };

    onSetOnState(serviceNumber, turnOn, callback) {
        this.log("Setting 'On' characteristic to %s ...", turnOn);
        const onOffParam = (turnOn ? "1" : "0");
        const device = this.getDevice();
        const self = this;
        communication.send(bleboxCommands.setSimpleRelaysState, device.ip, {
            params: [serviceNumber, onOffParam],
            onSuccess: function (stateInfo) {
                self.updateStateInfo(stateInfo);
                callback(null); // success
            },
            onError: function () {
                callback(new Error("Error setting 'On'."));
            }
        });
    };

}


module.exports = {
    type: SWITCHBOXD_TYPE,
    checkStateCommand: bleboxCommands.getRelayState,
    create: function (accessory, log, api, deviceInfo, stateInfo) {
        return new SwitchBoxDAccessoryWrapper(accessory, log, api, deviceInfo, stateInfo);
    }, restore: function (accessory, log, api) {
        return new SwitchBoxDAccessoryWrapper(accessory, log, api);
    }
};

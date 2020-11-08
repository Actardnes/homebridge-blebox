const communication = require("../common/communication");
const bleboxCommands = require("../common/bleboxCommands");
const SWITCHBOX_TYPE = require("../common/bleboxConst").BLEBOX_TYPE.SWITCHBOX;
const AbstractBoxWrapper = require("./abstractBox");


class SwitchBoxAccessoryWrapper extends AbstractBoxWrapper {
    constructor(accessory, log, api, deviceInfo, stateInfo) {
        super(accessory, log, api);

        this.type = SWITCHBOX_TYPE;
        this.checkStateCommand = bleboxCommands.getRelayState;

        this.servicesDefList = [api.hap.Service.Switch];
        this.servicesSubTypes = [];

        this.onCharacteristic = api.hap.Characteristic.On;

        this.init(this.servicesDefList, this.servicesSubTypes, deviceInfo, stateInfo);

        this.assignCharacteristics();

        this.startListening();
    }

    assignCharacteristics() {
        super.assignCharacteristics();
        const serviceNumber = 1;
        const service = this.accessory.services[serviceNumber];
        service.getCharacteristic(this.onCharacteristic)
            .on('get', this.onGetOnState.bind(this))
            .on('set', this.onSetOnState.bind(this));
    }

    updateStateInfoCharacteristics() {
        const relays = this.getRelays();
        if (relays) {
            //update characteristics
            const serviceNumber = 1;
            const service = this.accessory.services[serviceNumber];
            service.updateCharacteristic(this.onCharacteristic, this.getCurrentRelayValue());
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

    getCurrentRelayValue() {
        const relays = this.getRelays() || [];
        const {state = false} = relays[0] || {};
        return !!state;
    };

    onGetOnState(callback) {
        this.log("Getting 'On' characteristic ...");
        const relays = this.getRelays();
        if (this.isResponding() && relays) {
            const value = this.getCurrentRelayValue();
            this.log("Current 'On' characteristic is %s", value);
            callback(null, value);
        } else {
            this.log("Error getting 'On' characteristic. Relay: %s", relays);
            callback(new Error("Error getting 'On'."));
        }
    };

    onSetOnState(turnOn, callback) {
        this.log("Setting 'On' characteristic to %s ...", turnOn);
        const onOffParam = (turnOn ? "1" : "0");
        const self = this;
        const device = this.getDevice();
        communication.send(bleboxCommands.setSimpleRelayState, device.ip, {
            params: [onOffParam],
            onSuccess: function (stateInfo) {
                self.updateStateInfo(stateInfo);
                callback(null);
            },
            onError: function () {
                callback(new Error("Error setting 'On'."));
            }
        });
    };
}


module.exports = {
    type: SWITCHBOX_TYPE,
    checkStateCommand: bleboxCommands.getRelayState,
    create: function (accessory, log, api, deviceInfo, stateInfo) {
        return new SwitchBoxAccessoryWrapper(accessory, log, api, deviceInfo, stateInfo);
    }, restore: function (accessory, log, api) {
        return new SwitchBoxAccessoryWrapper(accessory, log, api);
    }
};

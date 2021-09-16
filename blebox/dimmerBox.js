const communication = require("../common/communication");
const bleboxCommands = require("../common/bleboxCommands");
const DIMMERBOX_TYPE = require("../common/bleboxConst").BLEBOX_TYPE.DIMMERBOX;
const AbstractBoxWrapper = require("./abstractBox");
const colorHelper = require("../common/colorHelper");

class DimmerBoxAccessoryWrapper extends AbstractBoxWrapper {
    constructor(accessory, log, api, deviceInfo, stateInfo) {
        super(accessory, log, api);

        this.type = DIMMERBOX_TYPE;
        this.checkStateCommand = bleboxCommands.getDimmerState;

        this.servicesDefList = [api.hap.Service.Lightbulb];

        this.onCharacteristic = api.hap.Characteristic.On;
        this.brightnessCharacteristic = api.hap.Characteristic.Brightness;

        this.init(deviceInfo, stateInfo);

        this.assignCharacteristics();

        this.startListening();
    }

    assignCharacteristics() {
        super.assignCharacteristics();
        const serviceNumber = 0;
        const service = this.getService(serviceNumber);

        service.getCharacteristic(this.onCharacteristic)
            .on('get', this.onGetOnState.bind(this))
            .on('set', this.onSetOnState.bind(this));

        service.getCharacteristic(this.brightnessCharacteristic)
            .on('get', this.onGetBrightness.bind(this))
            .on('set', this.onSetBrightness.bind(this));
    }

    updateStateInfoCharacteristics() {
        const dimmer = this.getDimmer();
        if (dimmer) {
            //update characteristics
            const serviceNumber = 0;
            const service = this.getService(serviceNumber);
            service.updateCharacteristic(this.onCharacteristic, this.getOnState());
            service.updateCharacteristic(this.brightnessCharacteristic, this.getBrightness());
        }
    };

    updateStateInfo(stateInfo) {
        if (stateInfo) {
            this.accessory.context.blebox.dimmer = stateInfo.dimmer || stateInfo;
            this.updateStateInfoCharacteristics();
        }
    }

    getDimmer() {
        return this.accessory.context.blebox.dimmer;
    }

    getOnState() {
        const {desiredBrightness = 0} = this.getDimmer() || {};
        return desiredBrightness !== 0;
    };

    getBrightness() {
        const {desiredBrightness = 0} = this.getDimmer() || {};
        return Number((desiredBrightness / 255 * 100).toFixed(0)) || 0;

    };

    onGetOnState(callback) {
        this.log("Getting 'On' characteristic ...");
        const dimmer = this.getDimmer();
        if (this.isResponding() && dimmer) {
            const currentOnValue = this.getOnState();
            this.log("Current 'On' characteristic is %s", currentOnValue);
            callback(null, currentOnValue);
        } else {
            this.log("Error getting 'On' characteristic. Dimmer: %s", dimmer);
            callback(new Error("Error getting 'On'."));
        }
    };

    onSetOnState(turnOn, callback) {
        // We should handle only turn OFF
        if (!turnOn) {
            this.log("Setting 'On' characteristic to %s ...", turnOn);
            const brightness = 0;
            this.sendSetSimpleDimmerStateCommand(brightness, callback);
        } else {
            callback(null);
        }
    };

    onGetBrightness(callback) {
        this.log("Getting 'Brightness' characteristic ...");
        const dimmer = this.getDimmer();
        if (this.isResponding() && dimmer) {
            const currentBrightness = this.getBrightness();
            this.log("Current 'Brightness' characteristic is %s", currentBrightness);
            callback(null, currentBrightness);
        } else {
            this.log("Error getting 'Brightness' characteristic. Dimmer: %s", dimmer);
            callback(new Error("Error getting 'On'."));
        }
    };

    onSetBrightness(brightness, callback) {
        this.log("Setting 'Brightness' characteristic to %s ...", brightness);
        const parsedBrightness = Number((brightness / 100 * 255).toFixed(0));
        this.sendSetSimpleDimmerStateCommand(parsedBrightness, callback)
    };

    sendSetSimpleDimmerStateCommand(brightness, callback) {
        const device = this.getDevice();
        const self = this;
        communication.send(bleboxCommands.setSimpleDimmerState, device.ip, {
            params: [colorHelper.toHex(brightness)],
            onSuccess: function (stateInfo) {
                self.updateStateInfo(stateInfo);
                callback(null);
            },
            onError: function () {
                callback(new Error("Error setting 'Target brightness'."));
            }
        });
    };

}


module.exports = {
    type: DIMMERBOX_TYPE,
    checkStateCommand: bleboxCommands.getDimmerState,
    create: function (accessory, log, api, deviceInfo, stateInfo) {
        return new DimmerBoxAccessoryWrapper(accessory, log, api, deviceInfo, stateInfo);
    }, restore: function (accessory, log, api) {
        return new DimmerBoxAccessoryWrapper(accessory, log, api);
    }
};

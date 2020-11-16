const communication = require("../common/communication");
const bleboxCommands = require("../common/bleboxCommands");
const WLIGHTBOXS_TYPE = require("../common/bleboxConst").BLEBOX_TYPE.WLIGHTBOXS;
const AbstractBoxWrapper = require("./abstractBox");
const colorHelper = require("../common/colorHelper");

class WLightBoxSAccessoryWrapper extends AbstractBoxWrapper {
    constructor(accessory, log, api, deviceInfo, stateInfo) {
        super(accessory, log, api);

        this.type = WLIGHTBOXS_TYPE;
        this.checkStateCommand = bleboxCommands.Lightbulb;

        this.servicesDefList = [api.hap.Service.Lightbulb];

        this.nameCharacteristic = api.hap.Characteristic.Name;
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
        const light = this.getLight();
        if (light) {
            //update characteristics
            const serviceNumber = 0;
            const service = this.getService(serviceNumber);
            service.updateCharacteristic(this.onCharacteristic, this.getOnStateValue());

            service.updateCharacteristic(this.brightnessCharacteristic, this.getBrightnessValue());
        }
    }

    updateStateInfo(stateInfo) {
        if (stateInfo) {
            this.accessory.context.blebox.light = stateInfo.light || stateInfo;
            this.updateStateInfoCharacteristics();
        }
    }

    getLight() {
        return this.accessory.context.blebox.light;
    }

    getBrightnessValue() {
        const {desiredColor = "00"} = this.getLight() || {};
        return Number((parseInt(desiredColor, 16) / 255 * 100).toFixed(0)) || 0;
    }

    getOnStateValue() {
        return this.getBrightnessValue() !== 0;
    }

    sendSetSimpleLightStateCommand(value, callback) {
        const self = this;
        const device = this.getDevice();
        communication.send(bleboxCommands.setSimpleLightState, device.ip, {
            params: [value],
            onSuccess: function (stateInfo) {
                self.updateStateInfo(stateInfo);
                callback(null);
            },
            onError: function () {
                callback(new Error("Error setting new light value: " + value));
            }
        });
    };

    onGetOnState(callback) {
        this.log("Getting 'On' characteristic ...");
        const light = this.getLight();
        if (this.isResponding() && light) {
            const currentOnValue = this.getOnStateValue();
            this.log("Current 'On' characteristic is %s", currentOnValue);
            callback(null, currentOnValue);
        } else {
            this.log("Error getting 'On' characteristic. Light: %s", light);
            callback(new Error("Error getting 'On'."));
        }
    }

    onSetOnState(turnOn, callback) {
        // We should only handle turn OFF
        if (!turnOn) {
            this.log("Setting 'On white' characteristic to %s ...", turnOn);
            const newValue = colorHelper.toHex(0);
            this.sendSetSimpleLightStateCommand(newValue, callback);
        } else {
            callback(null); // success
        }
    }

    onGetBrightness(callback) {
        this.log("Getting 'Brightness' characteristic ...");
        const light = this.getLight();
        if (this.isResponding() && light) {
            const currentBrightnessValue = this.getBrightnessValue()
            this.log("Current 'Brightness' characteristic is %s", currentBrightnessValue);
            callback(null, currentBrightnessValue);
        } else {
            this.log("Error getting 'Brightness' characteristic. Light: %s", light);
            callback(new Error("Error getting 'Brightness'."));
        }
    }
    
    onSetBrightness(brightness, callback) {
        this.log("WLIGHTBOXS: Setting 'Brightness' characteristic to %s ...", brightness);
        const newValue = colorHelper.toHex(brightness / 100 * 255);
        this.sendSetSimpleLightStateCommand(newValue, callback);
    }
}


module.exports = {
    type: WLIGHTBOXS_TYPE,
    checkStateCommand: bleboxCommands.getLightState,
    create: function (accessory, log, api, deviceInfo, stateInfo) {
        return new WLightBoxSAccessoryWrapper(accessory, log, api, deviceInfo, stateInfo);
    }, restore: function (accessory, log, api) {
        return new WLightBoxSAccessoryWrapper(accessory, log, api);
    }
};

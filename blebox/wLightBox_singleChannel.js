const communication = require("../common/communication");
const bleboxCommands = require("../common/bleboxCommands");
const WLIGHTBOX_SINGLE_CHANNEL_TYPE = require("../common/bleboxConst").BLEBOX_TYPE.WLIGHTBOX_SINGLE_CHANNEL;
const AbstractBoxWrapper = require("./abstractBox");
const colorHelper = require("../common/colorHelper");


class WLightBoxSingleChannelAccessoryWrapper extends AbstractBoxWrapper {
    constructor(accessory, log, api, deviceInfo, stateInfo) {
        super(accessory, log, api);

        this.type = WLIGHTBOX_SINGLE_CHANNEL_TYPE;
        this.checkStateCommand = bleboxCommands.getRgbwState;

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
        const rgbw = this.getRgbw();
        if (rgbw) {
            //update characteristics
            const serviceNumber = 0;
            const service = this.getService(serviceNumber);
            service.updateCharacteristic(this.onCharacteristic, this.getOnStateValue());

            service.updateCharacteristic(this.brightnessCharacteristic, this.getBrightnessValue());
        }
    }

    updateStateInfo(stateInfo) {
        if (stateInfo) {
            this.accessory.context.blebox.rgbw = stateInfo.rgbw || stateInfo;
            this.updateStateInfoCharacteristics();
        }
    }

    getRgbw() {
        return this.accessory.context.blebox.rgbw;
    }

    getBrightnessValue() {
        const {desiredColor = "00"} = this.getRgbw() || {};
        return Number((parseInt(desiredColor, 16) / 255 * 100).toFixed(0)) || 0;
    }

    getOnStateValue() {
        return this.getBrightnessValue() !== 0;
    }

    sendSetSimpleRgbStateCommand(value, callback) {
        const self = this;
        const device = this.getDevice();
        communication.send(bleboxCommands.setSimpleRgbwState, device.ip, {
            params: [value],
            onSuccess: function (stateInfo) {
                self.updateStateInfo(stateInfo);
                callback(null);
            },
            onError: function () {
                callback(new Error("Error setting new color: " + value));
            }
        });
    };

    onGetOnState(callback) {
        this.log("Getting 'On' characteristic ...");
        const rgbw = this.getRgbw();
        if (this.isResponding() && rgbw) {
            const currentOnValue = this.getOnStateValue();
            this.log("Current 'On' characteristic is %s", currentOnValue);
            callback(null, currentOnValue);
        } else {
            this.log("Error getting 'On' characteristic. Rgbw: %s", rgbw);
            callback(new Error("Error getting 'On'."));
        }
    }

    onSetOnState(turnOn, callback) {
        // We should only handle turn OFF
        if (!turnOn) {
            this.log("Setting 'On white' characteristic to %s ...", turnOn);
            const newValue = colorHelper.toHex(0);
            this.sendSetSimpleRgbStateCommand(newValue, callback);
        } else {
            callback(null); // success
        }
    }

    onGetBrightness(callback) {
        this.log("Getting 'Brightness' characteristic ...");
        const rgbw = this.getRgbw();
        if (this.isResponding() && rgbw) {
            const currentBrightnessValue = this.getBrightnessValue()
            this.log("Current 'Brightness' characteristic is %s", currentBrightnessValue);
            callback(null, currentBrightnessValue);
        } else {
            this.log("Error getting 'Brightness' characteristic. Rgbw: %s", rgbw);
            callback(new Error("Error getting 'Brightness'."));
        }
    }

    onSetBrightness(brightness, callback) {
        this.log("Setting 'Brightness' characteristic to %s ...", brightness);
        const newValue = colorHelper.toHex(brightness / 100 * 255);
        this.sendSetSimpleRgbStateCommand(newValue, callback);
    }
}


module.exports = {
    type: WLIGHTBOX_SINGLE_CHANNEL_TYPE,
    checkStateCommand: bleboxCommands.getRgbwState,
    create: function (accessory, log, api, deviceInfo, stateInfo) {
        return new WLightBoxSingleChannelAccessoryWrapper(accessory, log, api, deviceInfo, stateInfo);
    }, restore: function (accessory, log, api) {
        return new WLightBoxSingleChannelAccessoryWrapper(accessory, log, api);
    }
};

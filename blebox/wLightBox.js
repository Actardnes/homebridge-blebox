const communication = require("../common/communication");
const bleboxCommands = require("../common/bleboxCommands");
const WLIGHTBOX_TYPE = require("../common/bleboxConst").BLEBOX_TYPE.WLIGHTBOX;
const AbstractBoxWrapper = require("./abstractBox");
const colorHelper = require("../common/colorHelper");


class WLightBoxAccessoryWrapper extends AbstractBoxWrapper {
    constructor(accessory, log, api, deviceInfo, stateInfo) {
        super(accessory, log, api);

        this.type = WLIGHTBOX_TYPE;
        this.checkStateCommand = bleboxCommands.getRgbwState;

        this.servicesDefList = [api.hap.Service.Lightbulb, api.hap.Service.Lightbulb];
        this.servicesSubTypes = ['RGB', 'WHITE'];

        this.onCharacteristic = api.hap.Characteristic.On;
        this.brightnessCharacteristic = api.hap.Characteristic.Brightness;
        this.hueCharacteristic = api.hap.Characteristic.Hue;
        this.saturationCharacteristic = api.hap.Characteristic.Saturation;

        this.desiredHsv = {h: 0, s: 0, v: 0};

        this.init(deviceInfo, stateInfo);

        this.assignCharacteristics();

        this.startListening();
    }

    assignCharacteristics() {
        super.assignCharacteristics();
        const rgbServiceNumber = 0;
        const rgbService = this.getService(rgbServiceNumber);
        rgbService.getCharacteristic(this.onCharacteristic)
            .on('get', this.onGetRgbOnState.bind(this))
            .on('set', this.onSetRgbOnState.bind(this));

        rgbService.getCharacteristic(this.brightnessCharacteristic)
            .on('get', this.onGetRgbBrightness.bind(this))
            .on('set', this.onSetRgbBrightness.bind(this));

        rgbService.getCharacteristic(this.hueCharacteristic)
            .on('get', this.onGetRgbHue.bind(this))
            .on('set', this.onSetRgbHue.bind(this));

        rgbService.getCharacteristic(this.saturationCharacteristic)
            .on('get', this.onGetRgbSaturation.bind(this))
            .on('set', this.onSetRgbSaturation.bind(this));

        const whiteServiceNumber = 1;
        const whiteService = this.getService(whiteServiceNumber);
        whiteService.getCharacteristic(this.onCharacteristic)
            .on('get', this.onGetWhiteOnState.bind(this))
            .on('set', this.onSetWhiteOnState.bind(this));

        whiteService.getCharacteristic(this.brightnessCharacteristic)
            .on('get', this.onGetWhiteBrightness.bind(this))
            .on('set', this.onSetWhiteBrightness.bind(this));
    }

    updateStateInfoCharacteristics() {
        const rgbw = this.getRgbw();
        if (rgbw) {
            //update characteristics
            const rgbServiceNumber = 0;
            const rgbService = this.getService(rgbServiceNumber);
            rgbService.updateCharacteristic(this.onCharacteristic, this.getRgbOnValue());

            rgbService.updateCharacteristic(this.hueCharacteristic, this.getRgbHueValue());

            rgbService.updateCharacteristic(this.saturationCharacteristic, this.getRgbSaturationValue());

            rgbService.updateCharacteristic(this.brightnessCharacteristic, this.getRgbBrightnessValue());

            const whiteServiceNumber = 1;
            const whiteService = this.getService(whiteServiceNumber);
            whiteService.updateCharacteristic(this.onCharacteristic, this.getWhiteOnValue());

            whiteService.updateCharacteristic(this.brightnessCharacteristic, this.getWhiteBrightnessValue());
        }
    }

    updateStateInfo(stateInfo) {
        if (stateInfo) {
            this.accessory.context.blebox.rgbw = stateInfo.rgbw || stateInfo;
            this.desiredHsv = this._getRgbAsHsv();
            this.updateStateInfoCharacteristics();
        }
    }

    getRgbw() {
        return this.accessory.context.blebox.rgbw;
    }

    getServiceName(serviceNumber) {
        const serviceName = super.getServiceName(serviceNumber);
        const suffix = this.getServiceNameSuffix(serviceNumber);
        return `${serviceName} ${suffix}`;
    }

    getServiceNameSuffix(serviceNumber) {
        return this.servicesSubTypes[serviceNumber];
    }


    _getRgbAsHsv() {
        const {desiredColor = ""} = this.getRgbw() || {};
        const desiredRgbHex = desiredColor.substring(0, 6) || "00000000";
        return colorHelper.rgbToHsv(colorHelper.hexToRgb(desiredRgbHex));
    }

    getRgbOnValue() {
        const rgbAsHsv = this._getRgbAsHsv();
        return rgbAsHsv.v !== 0;
    }

    getRgbHueValue() {
        const rgbAsHsv = this._getRgbAsHsv();
        return rgbAsHsv.h;
    }

    getRgbSaturationValue() {
        const rgbAsHsv = this._getRgbAsHsv();
        return rgbAsHsv.s;
    }

    getRgbBrightnessValue() {
        const rgbAsHsv = this._getRgbAsHsv();
        return rgbAsHsv.v;
    }

    _getWhiteValue() {
        const {desiredColor = ""} = this.getRgbw() || {};
        const desiredWhiteHex = desiredColor.substring(6, 8) || "00";
        return Number((parseInt(desiredWhiteHex, 16) / 255 * 100).toFixed(0));
    }

    getWhiteOnValue() {
        const whiteValue = this._getWhiteValue();
        return whiteValue !== 0;
    }

    getWhiteBrightnessValue() {
        return this._getWhiteValue();
    }

    sendSetSimpleRgbStateCommand(hsv, white, callback) {
        const newRgbwColorHex = colorHelper.rgbToHex(colorHelper.hsvToRgb(hsv)) + colorHelper.toHex(white / 100 * 255);
        const self = this;
        const device = this.getDevice();
        communication.send(bleboxCommands.setSimpleRgbwState, device.ip, {
            params: [newRgbwColorHex],
            onSuccess: function (stateInfo) {
                self.updateStateInfo(stateInfo);
                callback(null);
            },
            onError: function () {
                callback(new Error("Error setting new color: " + newRgbwColorHex));
            }
        });
    };

    onGetRgbOnState(callback) {
        this.log("Getting 'On' characteristic ...");
        const rgbw = this.getRgbw();
        if (this.isResponding() && rgbw) {
            const currentRgbOnValue = this.getRgbOnValue();
            this.log("Current 'On' characteristic is %s", currentRgbOnValue);
            callback(null, currentRgbOnValue);
        } else {
            this.log("Error getting 'On' characteristic. Rgbw: %s", rgbw);
            callback(new Error("Error getting 'On'."));
        }
    };

    onSetRgbOnState(turnOn, callback) {
        // We should only handle turn OFF
        if (!turnOn) {
            this.log("Setting 'On' characteristic to %s ...", turnOn);
            this.desiredHsv = {h: 0, s: 0, v: 0};
            this.sendSetSimpleRgbStateCommand(this.desiredHsv, this._getWhiteValue(), callback);
        } else {
            callback(null);
        }
    }

    onGetRgbBrightness(callback) {
        this.log("Getting 'Brightness' characteristic ...");
        const rgbw = this.getRgbw();
        if (this.isResponding() && rgbw) {
            const currentRgbBrightnessValue = this.getRgbBrightnessValue();
            this.log("Current 'Brightness' characteristic is %s", currentRgbBrightnessValue);
            callback(null, currentRgbBrightnessValue);
        } else {
            this.log("Error getting 'Brightness' characteristic. Rgbw: %s", rgbw);
            callback(new Error("Error getting 'Brightness'."));
        }
    }

    onSetRgbBrightness(brightness, callback) {
        this.log("Setting 'Brightness' characteristic to %s ...", brightness);
        this.desiredHsv.v = brightness
        this.sendSetSimpleRgbStateCommand(this.desiredHsv, this._getWhiteValue(), callback);
    }

    onGetRgbHue(callback) {
        this.log("Getting 'Hue' characteristic ...");
        const rgbw = this.getRgbw();
        if (this.isResponding() && rgbw) {
            const currentRgbHueValue = this.getRgbHueValue()
            this.log("Current 'Hue' characteristic is %s", currentRgbHueValue);
            callback(null, currentRgbHueValue);
        } else {
            this.log("Error getting 'Hue' characteristic. Rgbw: %s", rgbw);
            callback(new Error("Error getting 'Hue'."));
        }
    }


    onSetRgbHue(hue, callback) {
        this.log("Setting 'Hue' characteristic to %s ...", hue);
        this.desiredHsv.h = hue;
        this.desiredHsv.v = this.desiredHsv.v || 100;
        this.sendSetSimpleRgbStateCommand(this.desiredHsv, this._getWhiteValue(), callback);
    }

    onGetRgbSaturation(callback) {
        this.log("Getting 'Saturation' characteristic ...");
        const rgbw = this.getRgbw();
        if (this.isResponding() && rgbw) {
            const currentRgbSaturationValue = this.getRgbSaturationValue()
            this.log("Current 'Saturation' characteristic is %s", currentRgbSaturationValue);
            callback(null, currentRgbSaturationValue);
        } else {
            this.log("Error getting 'Saturation' characteristic. Rgbw: %s", rgbw);
            callback(new Error("Error getting 'Saturation'."));
        }
    }

    onSetRgbSaturation(saturation, callback) {
        this.log("Setting 'Saturation' characteristic to %s ...", saturation);
        this.desiredHsv.s = saturation;
        this.desiredHsv.v = this.desiredHsv.v || 100;
        this.sendSetSimpleRgbStateCommand(this.desiredHsv, this._getWhiteValue(), callback);
    }

    onGetWhiteOnState(callback) {
        this.log("Getting 'On white' characteristic ...");
        const rgbw = this.getRgbw();
        if (this.isResponding() && rgbw) {
            const currentWhiteOnValue = this.getWhiteOnValue();
            this.log("Current 'On white' characteristic is %s", currentWhiteOnValue);
            callback(null, currentWhiteOnValue);
        } else {
            this.log("Error getting 'On white' characteristic. Rgbw: %s", rgbw);
            callback(new Error("Error getting 'On white'."));
        }
    }


    onSetWhiteOnState(turnOn, callback) {
        // We should only handle turn OFF
        if (!turnOn) {
            this.log("Setting 'On white' characteristic to %s ...", turnOn);
            const newWhite = 0;
            this.sendSetSimpleRgbStateCommand(this._getRgbAsHsv(), newWhite, callback);
        } else {
            callback(null); // success
        }
    }

    onGetWhiteBrightness(callback) {
        this.log("Getting 'Brightness white' characteristic ...");
        const rgbw = this.getRgbw();
        if (this.isResponding() && rgbw) {
            const currentWhiteBrightnessValue = this.getWhiteBrightnessValue();
            this.log("Current 'Brightness white' characteristic is %s", currentWhiteBrightnessValue);
            callback(null, currentWhiteBrightnessValue);
        } else {
            this.log("Error getting 'Brightness white' characteristic. Rgbw: %s", rgbw);
            callback(new Error("Error getting 'Brightness white'."));
        }
    }

    onSetWhiteBrightness(brightness, callback) {
        this.log("Setting 'Brightness white' characteristic to %s ...", brightness);
        this.sendSetSimpleRgbStateCommand(this._getRgbAsHsv(), brightness, callback);
    }

}


module.exports = {
    type: WLIGHTBOX_TYPE,
    checkStateCommand: bleboxCommands.getRgbwState,
    create: function (accessory, log, api, deviceInfo, stateInfo) {
        return new WLightBoxAccessoryWrapper(accessory, log, api, deviceInfo, stateInfo);
    }, restore: function (accessory, log, api) {
        return new WLightBoxAccessoryWrapper(accessory, log, api);
    }
};

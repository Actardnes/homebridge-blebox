var communication = require("../common/communication");
var bleboxCommands = require("../common/bleboxCommands");
var WLIGHTBOX_TYPE = require("../common/bleboxConst").BLEBOX_TYPE.WLIGHTBOX;
var AbstractBoxWrapper = require("./abstractBox");
var colorHelper = require("../common/colorHelper");

module.exports = {
    create: function (homebridge, log, api, deviceInfo, rgbwInfo) {
        return new WLightBoxAccessoryWrapper(homebridge, null, log, api, deviceInfo, rgbwInfo);
    }, restore: function (accessory, log, api, deviceInfo) {
        return new WLightBoxAccessoryWrapper(null, accessory, log, api, deviceInfo.device, deviceInfo.rgbw);
    }
};

function WLightBoxAccessoryWrapper(homebridge, accessory, log, api, deviceInfo, rgbwInfo) {
    AbstractBoxWrapper.call(this, accessory, log, deviceInfo);
    this.rgbw = rgbwInfo ? (rgbwInfo.rgbw || rgbwInfo) : null;
    this.desiredHSVColor = {h: 0, s: 0, v: 0};
    this.desiredWhite = 0;

    this.rgbServiceSubtype = "RGB";
    this.whiteServiceSubtype = "WHITE";

    this.nameCharacteristic = api.hap.Characteristic.Name;
    this.onCharacteristic = api.hap.Characteristic.On;
    this.brightnessCharacteristic = api.hap.Characteristic.Brightness;
    this.hueCharacteristic = api.hap.Characteristic.Hue;
    this.saturationCharacteristic = api.hap.Characteristic.Saturation;
    this.lightBulbService = api.hap.Service.Lightbulb;

    if (!this.accessory) {
        var uuid = homebridge.hap.uuid.generate(this.deviceName + WLIGHTBOX_TYPE + this.deviceIp);
        this.accessory = new homebridge.platformAccessory(this.deviceName, uuid);

        this.firstServiceName = this.rgbServiceSubtype + " " + this.deviceName;
        this.accessory.addService(this.lightBulbService, this.firstServiceName, this.rgbServiceSubtype);

        this.secondServiceName = this.whiteServiceSubtype + " " + this.deviceName;
        this.accessory.addService(this.lightBulbService, this.secondServiceName, this.whiteServiceSubtype);
    }

    this.accessory.getServiceByUUIDAndSubType(this.lightBulbService, this.rgbServiceSubtype)
        .getCharacteristic(this.onCharacteristic)
        .on('get', this.getRgbOnState.bind(this))
        .on('set', this.setRgbOnState.bind(this));

    this.accessory.getServiceByUUIDAndSubType(this.lightBulbService, this.rgbServiceSubtype)
        .getCharacteristic(this.brightnessCharacteristic)
        .on('get', this.getRgbBrightness.bind(this))
        .on('set', this.setRgbBrightness.bind(this));

    this.accessory.getServiceByUUIDAndSubType(this.lightBulbService, this.rgbServiceSubtype)
        .getCharacteristic(this.hueCharacteristic)
        .on('get', this.getRgbHue.bind(this))
        .on('set', this.setRgbHue.bind(this));

    this.accessory.getServiceByUUIDAndSubType(this.lightBulbService, this.rgbServiceSubtype)
        .getCharacteristic(this.saturationCharacteristic)
        .on('get', this.getRgbSaturation.bind(this))
        .on('set', this.setRgbSaturation.bind(this));

    this.accessory.getServiceByUUIDAndSubType(this.lightBulbService, this.whiteServiceSubtype)
        .getCharacteristic(this.onCharacteristic)
        .on('get', this.getWhiteOnState.bind(this))
        .on('set', this.setWhiteOnState.bind(this));

    this.accessory.getServiceByUUIDAndSubType(this.lightBulbService, this.whiteServiceSubtype)
        .getCharacteristic(this.brightnessCharacteristic)
        .on('get', this.getWhiteBrightness.bind(this))
        .on('set', this.setWhiteBrightness.bind(this));

    //for restore purpose
    this.accessory.context.blebox = {
        "type": WLIGHTBOX_TYPE,
        "device": {
            "id": this.deviceId,
            "ip": this.deviceIp,
            "deviceName": this.deviceName
        }, "rgbw": this.rgbw
    };

    this.setDesiredColorsAndUpdateCharacteristics();
    this.startListening();
}

WLightBoxAccessoryWrapper.prototype = Object.create(AbstractBoxWrapper.prototype);

WLightBoxAccessoryWrapper.prototype.checkSpecificState = function () {
    var self = this;
    communication.send(bleboxCommands.getRgbwState, self.deviceIp, {
        onSuccess: function (rgbwState) {
            if (rgbwState) {
                self.badRequestsCounter = 0;
                rgbwState = rgbwState.rgbw || rgbwState;
                self.rgbw = rgbwState;
                self.setDesiredColorsAndUpdateCharacteristics();
            }
        }, onError: function () {
            self.badRequestsCounter++;
        }
    });
};

WLightBoxAccessoryWrapper.prototype.onDeviceNameChange = function () {
    this.accessory.getService(this.lightBulbService)
        .updateCharacteristic(this.nameCharacteristic, this.deviceName);
};


WLightBoxAccessoryWrapper.prototype.sendSetSimpleRgbStateCommand = function (callback, errorMsg) {
    var newValue = colorHelper.rgbToHex(colorHelper.hsvToRgb(this.desiredHSVColor)).substring(1, 7) + colorHelper.toHex(this.desiredWhite / 100 * 255);
    var self = this;
    communication.send(bleboxCommands.setSimpleRgbwState, this.deviceIp, {
        params: [newValue],
        onSuccess: function (rgbwState) {
            if (rgbwState) {
                self.rgbw = rgbwState.rgbw || rgbwState;
                self.setDesiredColorsAndUpdateCharacteristics();
                callback(null); // success
            } else {
                callback(new Error(errorMsg));
            }
        },
        onError: function () {
            callback(new Error(errorMsg));
        }
    });
};

WLightBoxAccessoryWrapper.prototype.setDesiredColorsAndUpdateCharacteristics = function () {
    if (this.rgbw && this.rgbw.desiredColor) {
        this.desiredHSVColor = colorHelper.rgbToHsv(colorHelper.hexToRgb(this.rgbw.desiredColor.substring(0, 6)));
        this.desiredWhite = Number((parseInt(this.rgbw.desiredColor.substring(6, 8), 16) / 255 * 100).toFixed(0));

        //update characteristics
        var isRgbOn = this.desiredHSVColor.v !== 0;
        this.accessory.getServiceByUUIDAndSubType(this.lightBulbService, this.rgbServiceSubtype)
            .updateCharacteristic(this.onCharacteristic, isRgbOn);

        this.accessory.getServiceByUUIDAndSubType(this.lightBulbService, this.rgbServiceSubtype)
            .updateCharacteristic(this.hueCharacteristic, this.desiredHSVColor.h);

        this.accessory.getServiceByUUIDAndSubType(this.lightBulbService, this.rgbServiceSubtype)
            .updateCharacteristic(this.saturationCharacteristic, this.desiredHSVColor.s);

        this.accessory.getServiceByUUIDAndSubType(this.lightBulbService, this.rgbServiceSubtype)
            .updateCharacteristic(this.brightnessCharacteristic, this.desiredHSVColor.v);

        var isWhiteOn = this.desiredWhite !== 0;
        this.accessory.getServiceByUUIDAndSubType(this.lightBulbService, this.whiteServiceSubtype)
            .updateCharacteristic(this.onCharacteristic, isWhiteOn);

        this.accessory.getServiceByUUIDAndSubType(this.lightBulbService, this.whiteServiceSubtype)
            .updateCharacteristic(this.brightnessCharacteristic, this.desiredWhite);
    }
};

WLightBoxAccessoryWrapper.prototype.getRgbOnState = function (callback) {
    this.log("WLIGHTBOX ( %s ): Getting 'On' characteristic ...", this.deviceName);
    if (this.isResponding() && this.desiredHSVColor) {
        var currentOnValue = this.desiredHSVColor.v !== 0;
        this.log("WLIGHTBOX ( %s ): Current 'On' characteristic is %s", this.deviceName, currentOnValue);
        callback(null, currentOnValue);
    } else {
        this.log("WLIGHTBOX ( %s ): Error getting 'On' characteristic. Rgbw: %s", this.deviceName, this.rgbw);
        callback(new Error("Error getting 'On'."));
    }
};

WLightBoxAccessoryWrapper.prototype.setRgbOnState = function (turnOn, callback) {
    if (!turnOn) {
        this.log("WLIGHTBOX ( %s ): Setting 'On' characteristic to %s ...", this.deviceName, turnOn);
        this.desiredHSVColor.h = 0;
        this.desiredHSVColor.s = 0;
        this.desiredHSVColor.v = 0;
        this.sendSetSimpleRgbStateCommand(callback, "Error setting 'On'.");
    } else {
        callback(null)
    }

};

WLightBoxAccessoryWrapper.prototype.getRgbBrightness = function (callback) {
    this.log("WLIGHTBOX ( %s ): Getting 'Brightness' characteristic ...", this.deviceName);
    if (this.isResponding() && this.desiredHSVColor) {
        this.log("WLIGHTBOX ( %s ): Current 'Brightness' characteristic is %s", this.deviceName, this.desiredHSVColor.v);
        callback(null, this.desiredHSVColor.v);
    } else {
        this.log("WLIGHTBOX ( %s ): Error getting 'Brightness' characteristic. Rgbw: %s", this.deviceName, this.rgbw);
        callback(new Error("Error getting 'Brightness'."));
    }
};

WLightBoxAccessoryWrapper.prototype.setRgbBrightness = function (brightness, callback) {
    this.log("WLIGHTBOX ( %s ): Setting 'Brightness' characteristic to %s ...", this.deviceName, brightness);
    this.desiredHSVColor.v = brightness;
    this.sendSetSimpleRgbStateCommand(callback, "Error setting 'Brightness'.");
};

WLightBoxAccessoryWrapper.prototype.getRgbHue = function (callback) {
    this.log("WLIGHTBOX ( %s ): Getting 'Hue' characteristic ...", this.deviceName);
    if (this.isResponding() && this.desiredHSVColor) {
        this.log("WLIGHTBOX ( %s ): Current 'Hue' characteristic is %s", this.deviceName, this.desiredHSVColor.h);
        callback(null, this.desiredHSVColor.h);
    } else {
        this.log("WLIGHTBOX ( %s ): Error getting 'Hue' characteristic. Rgbw: %s", this.deviceName, this.rgbw);
        callback(new Error("Error getting 'Hue'."));
    }
};

WLightBoxAccessoryWrapper.prototype.setRgbHue = function (hue, callback) {
    this.log("WLIGHTBOX ( %s ): Setting 'Hue' characteristic to %s ...", this.deviceName, hue);
    this.desiredHSVColor.h = hue;
    this.desiredHSVColor.v = this.desiredHSVColor.v || 100;
    this.sendSetSimpleRgbStateCommand(callback, "Error setting 'Hue'.");
};

WLightBoxAccessoryWrapper.prototype.getRgbSaturation = function (callback) {
    this.log("WLIGHTBOX ( %s ): Getting 'Saturation' characteristic ...", this.deviceName);
    if (this.isResponding() && this.desiredHSVColor) {
        this.log("WLIGHTBOX ( %s ): Current 'Saturation' characteristic is %s", this.deviceName, this.desiredHSVColor.s);
        callback(null, this.desiredHSVColor.s);
    } else {
        this.log("WLIGHTBOX ( %s ): Error getting 'Saturation' characteristic. Rgbw: %s", this.deviceName, this.rgbw);
        callback(new Error("Error getting 'Saturation'."));
    }
};

WLightBoxAccessoryWrapper.prototype.setRgbSaturation = function (saturation, callback) {
    this.log("WLIGHTBOX ( %s ): Setting 'Saturation' characteristic to %s ...", this.deviceName, saturation);
    this.desiredHSVColor.s = saturation;
    this.desiredHSVColor.v = this.desiredHSVColor.v || 100;
    this.sendSetSimpleRgbStateCommand(callback, "Error setting 'Saturation'.");
};

WLightBoxAccessoryWrapper.prototype.getWhiteOnState = function (callback) {
    this.log("WLIGHTBOX ( %s ): Getting 'On white' characteristic ...", this.deviceName);
    if (this.isResponding()) {
        var isOn = this.desiredWhite !== 0;
        this.log("WLIGHTBOX ( %s ): Current 'On white' characteristic is %s", this.deviceName, isOn);
        callback(null, isOn);
    } else {
        this.log("WLIGHTBOX ( %s ): Error getting 'On white' characteristic. Rgbw: %s", this.deviceName, this.rgbw);
        callback(new Error("Error getting 'On white'."));
    }
};

WLightBoxAccessoryWrapper.prototype.setWhiteOnState = function (turnOn, callback) {
    // Turning on option is handled by @setWhiteBrightness
    if (!turnOn) {
        this.log("WLIGHTBOX ( %s ): Setting 'On white' characteristic to %s ...", this.deviceName, turnOn);
        this.desiredWhite = turnOn ? 100 : 0;
        this.sendSetSimpleRgbStateCommand(callback, "Error setting 'On white'.");
    } else {
        callback(null); // success
    }
};

WLightBoxAccessoryWrapper.prototype.getWhiteBrightness = function (callback) {
    this.log("WLIGHTBOX ( %s ): Getting 'Brightness white' characteristic ...", this.deviceName);
    if (this.isResponding()) {
        var currentBrightness = this.desiredWhite || 0;
        this.log("WLIGHTBOX ( %s ): Current 'Brightness white' characteristic is %s", this.deviceName, currentBrightness);
        callback(null, currentBrightness);
    } else {
        this.log("WLIGHTBOX ( %s ): Error getting 'Brightness white' characteristic. Rgbw: %s", this.deviceName, this.rgbw);
        callback(new Error("Error getting 'Brightness white'."));
    }
};

WLightBoxAccessoryWrapper.prototype.setWhiteBrightness = function (brightness, callback) {
    this.log("WLIGHTBOX ( %s ): Setting 'Brightness white' characteristic to %s ...", this.deviceName, brightness);
    this.desiredWhite = brightness;
    this.sendSetSimpleRgbStateCommand(callback, "Error setting 'Brightness white'.");
};

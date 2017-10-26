var communication = require("../common/communication");
var bleboxCommands = require("../common/bleboxCommands");
var WLIGHTBOXS_TYPE = require("../common/bleboxConst").BLEBOX_TYPE.WLIGHTBOXS;
var AbstractBoxWrapper = require("./abstractBox");
var colorHelper = require("../common/colorHelper");

module.exports = {
    create: function (homebridge, log, api, deviceInfo, lightInfo) {
        return new WLightBoxSAccessoryWrapper(homebridge, null, log, api, deviceInfo, lightInfo);
    }, restore: function (accessory, log, api, deviceInfo) {
        return new WLightBoxSAccessoryWrapper(null, accessory, log, api, deviceInfo.device, deviceInfo.light);
    }
};

function WLightBoxSAccessoryWrapper(homebridge, accessory, log, api, deviceInfo, lightInfo) {
    AbstractBoxWrapper.call(this, accessory, log, deviceInfo);
    this.light = lightInfo ? (lightInfo.light || lightInfo) : null;

    this.nameCharacteristic = api.hap.Characteristic.Name;
    this.onCharacteristic = api.hap.Characteristic.On;
    this.brightnessCharacteristic = api.hap.Characteristic.Brightness;
    this.lightBulbService = api.hap.Service.Lightbulb;

    if (!this.accessory) {
        var uuid = homebridge.hap.uuid.generate(this.deviceName + WLIGHTBOXS_TYPE + this.deviceIp);
        this.accessory = new homebridge.platformAccessory(this.deviceName, uuid);
        this.accessory.addService(this.lightBulbService, this.deviceName);
    }

    this.accessory.getService(this.lightBulbService)
        .getCharacteristic(this.onCharacteristic)
        .on('get', this.getOnState.bind(this))
        .on('set', this.setOnState.bind(this));

    this.accessory.getService(this.lightBulbService)
        .getCharacteristic(this.brightnessCharacteristic)
        .on('get', this.getBrightness.bind(this))
        .on('set', this.setBrightness.bind(this));

    this.accessory.getService(this.lightBulbService)
        .getCharacteristic(this.nameCharacteristic)
        .on('get', this.getName.bind(this));

    //for restore purpose
    this.accessory.context.blebox = {
        "type": WLIGHTBOXS_TYPE,
        "device": {
            "id": this.deviceId,
            "ip": this.deviceIp,
            "deviceName": this.deviceName
        }, "light": this.light
    };

    this.updateCharacteristics();
    this.startListening();
}

WLightBoxSAccessoryWrapper.prototype = Object.create(AbstractBoxWrapper.prototype);

WLightBoxSAccessoryWrapper.prototype.checkSpecificState = function () {
    var self = this;
    communication.send(bleboxCommands.getLightState, self.deviceIp, {
        onSuccess: function (lightState) {
            if (lightState) {
                self.badRequestsCounter = 0;
                lightState = lightState.light || lightState;
                self.light = lightState;
                self.updateCharacteristics();
            }
        }, onError: function () {
            self.badRequestsCounter++;
        }
    });
};

WLightBoxSAccessoryWrapper.prototype.updateCharacteristics = function () {
    if (this.light && this.light.desiredColor) {
        var currentBrightness = Number((parseInt(this.light.desiredColor, 16) / 255 * 100).toFixed(0)) || 0;
        var currentOnValue = currentBrightness !== 0;

        this.accessory.getService(this.lightBulbService)
            .updateCharacteristic(this.onCharacteristic, currentOnValue);

        this.accessory.getService(this.lightBulbService)
            .updateCharacteristic(this.brightnessCharacteristic, currentBrightness);
    }
};

WLightBoxSAccessoryWrapper.prototype.sendSetSimpleLightStateCommand = function (value, callback, errorMsg) {
    var self = this;
    communication.send(bleboxCommands.setSimpleLightState, this.deviceIp, {
        params: [value],
        onSuccess: function (lightState) {
            if (lightState) {
                self.light = lightState.light || lightState;
                self.updateCharacteristics();

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

WLightBoxSAccessoryWrapper.prototype.onDeviceNameChange = function () {
    this.accessory.getService(this.lightBulbService)
        .updateCharacteristic(this.nameCharacteristic, this.deviceName);
};

WLightBoxSAccessoryWrapper.prototype.getOnState = function (callback) {
    this.log("WLIGHTBOXS ( %s ): Getting 'On' characteristic ...", this.deviceName);
    if (this.isResponding() && this.light) {
        var currentOnValue = (parseInt(this.light.desiredColor, 16) / 255 * 100).toFixed(0) != 0;
        this.log("WLIGHTBOXS ( %s ): Current 'On' characteristic is %s", this.deviceName, currentOnValue);
        callback(null, currentOnValue);
    } else {
        this.log("WLIGHTBOXS ( %s ): Error getting 'On' characteristic. Light: %s", this.deviceName, this.light);
        callback(new Error("Error getting 'On'."));
    }
};

WLightBoxSAccessoryWrapper.prototype.setOnState = function (turnOn, callback) {
    // Turning on option is handled by @setBrightness
    if (!turnOn) {
        this.log("WLIGHTBOXS: Setting 'On white' characteristic to %s ...", turnOn);
        var newValue = colorHelper.toHex(0);
        this.sendSetSimpleLightStateCommand(newValue, callback, "Error setting 'On'.");
    } else {
        callback(null); // success
    }

};

WLightBoxSAccessoryWrapper.prototype.getBrightness = function (callback) {
    this.log("WLIGHTBOXS ( %s ): Getting 'Brightness' characteristic ...", this.deviceName);
    if (this.isResponding() && this.light) {
        var currentBrightness = Number((parseInt(this.light.desiredColor, 16) / 255 * 100).toFixed(0)) || 0;
        this.log("WLIGHTBOXS ( %s ): Current 'Brightness' characteristic is %s", this.deviceName, currentBrightness);
        callback(null, currentBrightness);
    } else {
        this.log("WLIGHTBOXS ( %s ): Error getting 'Brightness' characteristic. Light: %s", this.deviceName, this.light);
        callback(new Error("Error getting 'Brightness'."));
    }
};

WLightBoxSAccessoryWrapper.prototype.setBrightness = function (brightness, callback) {
    this.log("WLIGHTBOXS: Setting 'Brightness' characteristic to %s ...", brightness);
    var newValue = colorHelper.toHex(brightness / 100 * 255);
    this.sendSetSimpleLightStateCommand(newValue, callback, "Error setting 'Brightness'.");
};
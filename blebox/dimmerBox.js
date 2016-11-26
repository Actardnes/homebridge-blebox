var communication = require("../common/communication");
var bleboxCommands = require("../common/bleboxCommands");
var DIMMERBOX_TYPE = require("../common/bleboxConst").BLEBOX_TYPE.DIMMERBOX;
var AbstractBoxWrapper = require("./abstractBox");

module.exports = {
    create: function (homebridge, log, api, deviceInfo, dimmerInfo) {
        return new DimmerBoxAccessoryWrapper(homebridge, null, log, api, deviceInfo, dimmerInfo);
    }, restore: function (accessory, log, api, deviceInfo) {
        return new DimmerBoxAccessoryWrapper(null, accessory, log, api, deviceInfo.device, deviceInfo.dimmer);
    }
};

function DimmerBoxAccessoryWrapper(homebridge, accessory, log, api, deviceInfo, dimmerInfo) {
    AbstractBoxWrapper.call(this, accessory, log, deviceInfo);
    this.dimmer = dimmerInfo ? (dimmerInfo.dimmer || dimmerInfo) : null;

    this.nameCharacteristic = api.hap.Characteristic.Name;
    this.onCharacteristic = api.hap.Characteristic.On;
    this.brightnessCharacteristic = api.hap.Characteristic.Brightness;
    this.lightBulbService = api.hap.Service.Lightbulb;

    if (!this.accessory) {
        var uuid = homebridge.hap.uuid.generate(this.deviceName + DIMMERBOX_TYPE + this.deviceIp);
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
        "type": DIMMERBOX_TYPE,
        "device": {
            "id": this.deviceId,
            "ip": this.deviceIp,
            "deviceName": this.deviceName
        }, "dimmer": this.dimmer
    };

    this.updateCharacteristics();
    this.startListening();
}

DimmerBoxAccessoryWrapper.prototype = Object.create(AbstractBoxWrapper.prototype);

DimmerBoxAccessoryWrapper.prototype.checkSpecificState = function () {
    var self = this;
    communication.send(bleboxCommands.getDimmerState, self.deviceIp, {
        onSuccess: function (dimmerState) {
            if (dimmerState) {
                self.badRequestsCounter = 0;
                dimmerState = dimmerState.dimmer || dimmerState;
                self.dimmer = dimmerState;
                self.updateCharacteristics();
            }
        }, onError: function () {
            self.badRequestsCounter++;
        }
    });
};

DimmerBoxAccessoryWrapper.prototype.updateCharacteristics = function () {
    if (this.dimmer && this.dimmer.desiredBrightness) {
        var currentBrightness = Number((this.dimmer.desiredBrightness / 255 * 100).toFixed(0));
        var currentOnValue = currentBrightness != 0;

        this.accessory.getService(this.lightBulbService)
            .updateCharacteristic(this.onCharacteristic, currentOnValue);

        this.accessory.getService(this.lightBulbService)
            .updateCharacteristic(this.brightnessCharacteristic, currentBrightness);
    }
};

DimmerBoxAccessoryWrapper.prototype.sendSetSimpleDimmerStateCommand = function (value, callback, errorMsg) {
    var self = this;
    communication.send(bleboxCommands.setSimpleDimmerState, this.deviceIp, {
        params: [value.toString(16)],
        onSuccess: function (dimmerState) {
            if (dimmerState) {
                self.dimmer = dimmerState.dimmer || dimmerState;
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

DimmerBoxAccessoryWrapper.prototype.onDeviceNameChange = function () {
    this.accessory.getService(this.lightBulbService)
        .updateCharacteristic(this.nameCharacteristic, this.deviceName);
};

DimmerBoxAccessoryWrapper.prototype.getOnState = function (callback) {
    this.log("DIMMERBOX ( %s ): Getting 'On' characteristic ...", this.deviceName);
    if (this.isResponding() && this.dimmer) {
        var currentOnValue = this.dimmer.desiredBrightness != 0;
        this.log("DIMMERBOX ( %s ): Current 'On' characteristic is %s", this.deviceName, currentOnValue);
        callback(null, currentOnValue);
    } else {
        this.log("DIMMERBOX ( %s ): Error getting 'On' characteristic. Dimmer: %s", this.deviceName, this.dimmer);
        callback(new Error("Error getting 'On'."));
    }
};

DimmerBoxAccessoryWrapper.prototype.setOnState = function (turnOn, callback) {
    this.log("DIMMERBOX ( %s ): Setting 'On' characteristic to %s ...", this.deviceName, turnOn);
    var brightness = turnOn ? 255 : 0;
    this.sendSetSimpleDimmerStateCommand(brightness, callback, "Error setting 'On'.");
};

DimmerBoxAccessoryWrapper.prototype.getBrightness = function (callback) {
    this.log("DIMMERBOX ( %s ): Getting 'setBrightness' characteristic ...", this.deviceName);
    if (this.isResponding() && this.dimmer) {
        var currentBrightness = Number((this.dimmer.currentBrightness / 255 * 100).toFixed(0));
        this.log("DIMMERBOX ( %s ): Current 'setBrightness' characteristic is %s", this.deviceName, currentBrightness);
        callback(null, currentBrightness);
    } else {
        this.log("DIMMERBOX ( %s ): Error getting 'setBrightness' characteristic. Dimmer: %s", this.deviceName, this.dimmer);
        callback(new Error("Error getting 'On'."));
    }
};

DimmerBoxAccessoryWrapper.prototype.setBrightness = function (brightness, callback) {
    this.log("DIMMERBOX ( %s ): Setting 'Brightness' characteristic to %s ...", this.deviceName, brightness);
    brightness = Number((brightness / 100 * 255).toFixed(0));
    this.sendSetSimpleDimmerStateCommand(brightness, callback, "Error setting 'setBrightness'.")
};
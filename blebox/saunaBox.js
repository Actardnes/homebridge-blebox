var communication = require("../common/communication");
var bleboxCommands = require("../common/bleboxCommands");
var SAUNABOX_TYPE = require("../common/bleboxConst").BLEBOX_TYPE.SAUNABOX;
var AbstractBoxWrapper = require("./abstractBox");

module.exports = {
    create: function (homebridge, log, api, deviceInfo, shutterInfo) {
        return new SaunaBoxAccessoryWrapper(homebridge, null, log, api, deviceInfo, shutterInfo);
    }, restore: function (accessory, log, api, deviceInfo) {
        return new SaunaBoxAccessoryWrapper(null, accessory, log, api, deviceInfo.device, deviceInfo.shutter);
    }
};

function SaunaBoxAccessoryWrapper(homebridge, accessory, log, api, deviceInfo, heatInfo) {
    AbstractBoxWrapper.call(this, accessory, log, deviceInfo);
    this.heat = heatInfo ? (heatInfo.heat || heatInfo) : null;

    this.nameCharacteristic = api.hap.Characteristic.Name;
    this.currentHeatingCoolingStateCharacteristic = api.hap.Characteristic.CurrentHeatingCoolingState;
    this.targetHeatingCoolingStateCharacteristic = api.hap.Characteristic.TargetHeatingCoolingState;
    this.currentTemperatureCharacteristic = api.hap.Characteristic.CurrentTemperature;
    this.targetTemperatureCharacteristic = api.hap.Characteristic.TargetTemperature;
    this.temperatureDisplayUnitsCharacteristic = api.hap.Characteristic.TemperatureDisplayUnits;

    this.thermostatService = api.hap.Service.Thermostat;

    if (!this.accessory) {
        var uuid = homebridge.hap.uuid.generate(this.deviceName + SAUNABOX_TYPE + this.deviceIp);
        this.accessory = new homebridge.platformAccessory(this.deviceName, uuid);
        this.accessory.addService(this.thermostatService, this.deviceName);
    }

    this.accessory.getService(this.thermostatService)
        .getCharacteristic(this.currentHeatingCoolingStateCharacteristic)
        .on('get', this.getCurrentHeatingCoolingState.bind(this));

    this.accessory.getService(this.thermostatService)
        .getCharacteristic(this.targetHeatingCoolingStateCharacteristic)
        .on('get', this.getTargetHeatingCoolingState.bind(this))
        .on('set', this.setTargetHeatingCoolingState.bind(this));

    this.accessory.getService(this.thermostatService)
        .getCharacteristic(this.currentTemperatureCharacteristic)
        .on('get', this.getCurrentTemperature.bind(this));

    this.accessory.getService(this.thermostatService)
        .getCharacteristic(this.targetTemperatureCharacteristic)
        .on('get', this.getTargetTemperature.bind(this))
        .on('set', this.setTargetTemperature.bind(this));

    this.accessory.getService(this.thermostatService)
        .getCharacteristic(this.temperatureDisplayUnitsCharacteristic)
        .on('get', this.getTemperatureDisplayUnits.bind(this))
        .on('set', this.setTemperatureDisplayUnits.bind(this));

    this.accessory.getService(this.thermostatService)
        .getCharacteristic(this.nameCharacteristic)
        .on('get', this.getName.bind(this));

    //for restore purpose
    this.accessory.context.blebox = {
        "type": SAUNABOX_TYPE,
        "device": {
            "id": this.deviceId,
            "ip": this.deviceIp,
            "deviceName": this.deviceName
        }, "heat": this.heat
    };

    this.updateCharacteristics();
    this.startListening();
}

SaunaBoxAccessoryWrapper.prototype = Object.create(AbstractBoxWrapper.prototype);

SaunaBoxAccessoryWrapper.prototype.checkSpecificState = function () {
    var self = this;
    communication.send(bleboxCommands.getHeatState, this.deviceIp, {
        onSuccess: function (heatState) {
            if (heatState) {
                self.badRequestsCounter = 0;
                heatState = heatState.heat || heatState;
                self.heat = heatState;
                self.updateCharacteristics();
            }
        }, onError: function () {
            self.badRequestsCounter++;
        }
    });
};

SaunaBoxAccessoryWrapper.prototype.updateCharacteristics = function () {
    if (this.heat) {
        //update characteristics
        this.accessory.getService(this.thermostatService)
            .updateCharacteristic(this.currentHeatingCoolingStateCharacteristic, this.getCurrentHeatingCoolingStateValue());

        this.accessory.getService(this.thermostatService)
            .updateCharacteristic(this.targetHeatingCoolingStateCharacteristic, this.getTargetHeatingCoolingStateValue());

        this.accessory.getService(this.thermostatService)
            .updateCharacteristic(this.currentTemperatureCharacteristic, this.getCurrentTemperatureValue());

        this.accessory.getService(this.thermostatService)
            .updateCharacteristic(this.targetTemperatureCharacteristic, this.getTargetTemperatureValue());

        this.accessory.getService(this.thermostatService)
            .updateCharacteristic(this.temperatureDisplayUnitsCharacteristic, this.getTemperatureDisplayUnitsValue());
    }
};

SaunaBoxAccessoryWrapper.prototype.getCurrentHeatingCoolingStateValue = function () {
    return this.heat && this.heat.state ? this.currentHeatingCoolingStateCharacteristic.HEAT : this.currentHeatingCoolingStateCharacteristic.OFF;
};

SaunaBoxAccessoryWrapper.prototype.getTargetHeatingCoolingStateValue = function () {
    return this.heat && this.heat.state ? this.targetHeatingCoolingStateCharacteristic.HEAT : this.targetHeatingCoolingStateCharacteristic.OFF;
};

SaunaBoxAccessoryWrapper.prototype.getCurrentTemperatureValue = function () {
    var currentTemperature = 0;
    if (this.heat && this.heat.sensors && this.heat.sensors.length) {
        currentTemperature = Number((this.heat.sensors[0].value / 100).toFixed(1)) || 0;
    }
    return currentTemperature;
};

SaunaBoxAccessoryWrapper.prototype.getTargetTemperatureValue = function () {
    var targetTemperature = 0;
    if (this.heat) {
        targetTemperature = Number((this.heat.desiredTemp / 100).toFixed(1)) || 0;
    }
    return targetTemperature;
};

SaunaBoxAccessoryWrapper.prototype.getTemperatureDisplayUnitsValue = function () {
    return this.temperatureDisplayUnitsCharacteristic.CELSIUS;
};

SaunaBoxAccessoryWrapper.prototype.onDeviceNameChange = function () {
    this.accessory.getService(this.thermostatService)
        .updateCharacteristic(this.nameCharacteristic, this.deviceName);
};

SaunaBoxAccessoryWrapper.prototype.getCurrentHeatingCoolingState = function (callback) {
    this.log("SAUNABOX ( %s ): Getting 'Current heating cooling state' characteristic ...", this.deviceName);
    if (this.isResponding() && this.heat) {
        var currentHeatingCoolingStateValue = this.getCurrentHeatingCoolingStateValue();
        this.log("SAUNABOX ( %s ): Current 'Current heating cooling state' characteristic is %s", this.deviceName, currentHeatingCoolingStateValue);

        callback(null, currentHeatingCoolingStateValue);
    } else {
        this.log("SAUNABOX ( %s ): Error getting 'Current heating cooling state' characteristic. Heat: %s", this.deviceName, this.heat);
        callback(new Error("Error getting 'Current heating cooling state'."));
    }
};

SaunaBoxAccessoryWrapper.prototype.getTargetHeatingCoolingState = function (callback) {
    this.log("SAUNABOX ( %s ): Getting 'Target heating cooling state' characteristic ...", this.deviceName);
    if (this.isResponding() && this.heat) {
        var targetHeatingCoolingStateValue = this.getTargetHeatingCoolingStateValue();
        this.log("SAUNABOX ( %s ): Current 'Target heating cooling state' characteristic is %s", this.deviceName, targetHeatingCoolingStateValue);

        callback(null, targetHeatingCoolingStateValue);
    } else {
        this.log("SAUNABOX ( %s ): Error getting 'Target heating cooling state' characteristic. Heat: %s", this.deviceName, this.heat);
        callback(new Error("Error getting 'Target heating cooling state'."));
    }
};

SaunaBoxAccessoryWrapper.prototype.setTargetHeatingCoolingState = function (targetHeatingCoolingState, callback) {
    this.log("SAUNABOX: Setting 'Target heating cooling' characteristic to %s ...", targetHeatingCoolingState);
    var self = this;

    if (targetHeatingCoolingState !== this.targetHeatingCoolingStateCharacteristic.COOL) {

        //if OFF then send OFF otherwise send HEAT
        targetHeatingCoolingState = targetHeatingCoolingState === this.targetHeatingCoolingStateCharacteristic.OFF ?
            targetHeatingCoolingState :
            this.targetHeatingCoolingStateCharacteristic.HEAT;

        communication.send(bleboxCommands.setSimpleHeatState, this.deviceIp, {
            params: [targetHeatingCoolingState],
            onSuccess: function (heatState) {
                if (heatState) {
                    self.heat = heatState.heat || heatState;
                    self.updateCharacteristics();
                    callback(null); // success
                } else {
                    callback(new Error("Error setting 'Target heating cooling'."));
                }
            },
            onError: function () {
                callback(new Error("Error setting 'Target heating cooling'."));
            }
        });
    } else {
        callback(new Error("Not supported value for setting 'Target heating cooling': " + targetHeatingCoolingState));
    }
};

SaunaBoxAccessoryWrapper.prototype.getCurrentTemperature = function (callback) {
    this.log("SAUNABOX ( %s ): Getting 'Current temperature' characteristic ...", this.deviceName);
    if (this.isResponding() && this.heat) {
        var currentTemperatureValue = this.getCurrentTemperatureValue();
        this.log("SAUNABOX ( %s ): Current 'Current temperature' characteristic is %s", this.deviceName, currentTemperatureValue);

        callback(null, currentTemperatureValue);
    } else {
        this.log("SAUNABOX ( %s ): Error getting 'Current temperature' characteristic. Heat: %s", this.deviceName, this.heat);
        callback(new Error("Error getting 'Current temperature'."));
    }
};

SaunaBoxAccessoryWrapper.prototype.getTargetTemperature = function (callback) {
    this.log("SAUNABOX ( %s ): Getting 'Target temperature' characteristic ...", this.deviceName);
    if (this.isResponding() && this.heat) {
        var targetTemperatureValue = this.getTargetTemperatureValue();
        this.log("SAUNABOX ( %s ): Current 'Target temperature' characteristic is %s", this.deviceName, targetTemperatureValue);

        callback(null, targetTemperatureValue);
    } else {
        this.log("SAUNABOX ( %s ): Error getting 'Target temperature' characteristic. Heat: %s", this.deviceName, this.heat);
        callback(new Error("Error getting 'Target temperature'."));
    }
};

SaunaBoxAccessoryWrapper.prototype.setTargetTemperature = function (targetTemperature, callback) {
    this.log("SAUNABOX: Setting 'Target temperature' characteristic to %s ...", targetTemperature);
    var self = this;

    communication.send(bleboxCommands.setSimpleHeatDesiredTemperature, this.deviceIp, {
        params: [targetTemperature * 100],
        onSuccess: function (heatState) {
            if (heatState) {
                self.heat = heatState.heat || heatState;
                self.updateCharacteristics();
                callback(null); // success
            } else {
                callback(new Error("Error setting 'Target temperature'."));
            }
        },
        onError: function () {
            callback(new Error("Error setting 'Target temperature'."));
        }
    });
};

SaunaBoxAccessoryWrapper.prototype.getTemperatureDisplayUnits = function (callback) {
    this.log("SAUNABOX ( %s ): Getting 'Temperature display units' characteristic ...", this.deviceName);
    if (this.isResponding()) {
        var temperatureDisplayUnitsValue = this.getTemperatureDisplayUnitsValue();
        this.log("SAUNABOX ( %s ): Current 'Temperature display units' characteristic is %s", this.deviceName, temperatureDisplayUnitsValue);

        callback(null, temperatureDisplayUnitsValue);
    } else {
        this.log("SAUNABOX ( %s ): Error getting 'Temperature display units' characteristic. Heat: %s", this.deviceName, this.heat);
        callback(new Error("Error getting 'Temperature display units'."));
    }
};

SaunaBoxAccessoryWrapper.prototype.setTemperatureDisplayUnits = function (temperatureDisplayUnits, callback) {
    callback(new Error("Setting 'Temperature display units' is not supported."));
};

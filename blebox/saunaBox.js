const communication = require("../common/communication");
const bleboxCommands = require("../common/bleboxCommands");
const SAUNABOX_TYPE = require("../common/bleboxConst").BLEBOX_TYPE.SAUNABOX;
const AbstractBoxWrapper = require("./abstractBox");

class SaunaBoxAccessoryWrapper extends AbstractBoxWrapper {
    constructor(accessory, log, api, deviceInfo, stateInfo) {
        super(accessory, log, api);

        this.type = SAUNABOX_TYPE;
        this.checkStateCommand = bleboxCommands.getHeatState;

        this.servicesDefList = [api.hap.Service.Thermostat];
        this.servicesSubTypes = [];

        this.currentHeatingCoolingStateCharacteristic = api.hap.Characteristic.CurrentHeatingCoolingState;
        this.targetHeatingCoolingStateCharacteristic = api.hap.Characteristic.TargetHeatingCoolingState;
        this.currentTemperatureCharacteristic = api.hap.Characteristic.CurrentTemperature;
        this.targetTemperatureCharacteristic = api.hap.Characteristic.TargetTemperature;
        this.temperatureDisplayUnitsCharacteristic = api.hap.Characteristic.TemperatureDisplayUnits;

        this.init(this.servicesDefList, this.servicesSubTypes, deviceInfo, stateInfo);

        this.assignCharacteristics();

        this.startListening();
    }

    assignCharacteristics() {
        super.assignCharacteristics();
        const serviceNumber = 1;
        const service = this.accessory.services[serviceNumber];
        service.getCharacteristic(this.currentHeatingCoolingStateCharacteristic)
            .on('get', this.onGetCurrentHeatingCoolingState.bind(this));

        service.getCharacteristic(this.targetHeatingCoolingStateCharacteristic)
            .on('get', this.onGetTargetHeatingCoolingState.bind(this))
            .on('set', this.onSetTargetHeatingCoolingState.bind(this));

        service.getCharacteristic(this.currentTemperatureCharacteristic)
            .on('get', this.onGetCurrentTemperature.bind(this));

        service.getCharacteristic(this.targetTemperatureCharacteristic)
            .on('get', this.onGetTargetTemperature.bind(this))
            .on('set', this.onSetTargetTemperature.bind(this));

        service.getCharacteristic(this.temperatureDisplayUnitsCharacteristic)
            .on('get', this.onGetTemperatureDisplayUnits.bind(this))
            .on('set', this.onSetTemperatureDisplayUnits.bind(this));
    }

    updateStateInfoCharacteristics() {
        const heat = this.getHeat();
        if (heat) {
            //update characteristics
            const serviceNumber = 1;
            const service = this.accessory.services[serviceNumber];
            service.updateCharacteristic(this.currentHeatingCoolingStateCharacteristic, this.getCurrentHeatingCoolingStateValue());

            service.updateCharacteristic(this.targetHeatingCoolingStateCharacteristic, this.getTargetHeatingCoolingStateValue());

            service.updateCharacteristic(this.currentTemperatureCharacteristic, this.getCurrentTemperatureValue());

            service.updateCharacteristic(this.targetTemperatureCharacteristic, this.getTargetTemperatureValue());

            service.updateCharacteristic(this.temperatureDisplayUnitsCharacteristic, this.getTemperatureDisplayUnitsValue());
        }
    };

    updateStateInfo(stateInfo) {
        if (stateInfo) {
            this.accessory.context.blebox.heat = stateInfo.heat || stateInfo;
            this.updateStateInfoCharacteristics();
        }
    }

    getHeat() {
        return this.accessory.context.blebox.heat;
    }

    getCurrentHeatingCoolingStateValue() {
        const heat = this.getHeat();
        return heat && heat.state ? this.currentHeatingCoolingStateCharacteristic.HEAT : this.currentHeatingCoolingStateCharacteristic.OFF;
    };

    getTargetHeatingCoolingStateValue() {
        const heat = this.getHeat();
        return heat && heat.state ? this.targetHeatingCoolingStateCharacteristic.HEAT : this.targetHeatingCoolingStateCharacteristic.OFF;
    };

    getCurrentTemperatureValue() {
        const {sensors: [{value: currentTemperature = 0} = {}] = []} = this.getHeat() || {};
        return Number((currentTemperature / 100).toFixed(1)) || 0;
    };

    getTargetTemperatureValue() {
        const {desiredTemp = 0} = this.getHeat() || {};
        return Number((desiredTemp / 100).toFixed(1)) || 0;
    };

    getTemperatureDisplayUnitsValue() {
        return this.accessory.context.blebox.temperatureDisplayUnits || this.temperatureDisplayUnitsCharacteristic.CELSIUS;
    };

    onGetCurrentHeatingCoolingState(callback) {
        this.log("Getting 'Current heating cooling state' characteristic ...");
        const heat = this.getHeat();
        if (this.isResponding() && heat) {
            const currentHeatingCoolingStateValue = this.getCurrentHeatingCoolingStateValue();
            this.log("Current 'Current heating cooling state' characteristic is %s", currentHeatingCoolingStateValue);

            callback(null, currentHeatingCoolingStateValue);
        } else {
            this.log("Error getting 'Current heating cooling state' characteristic. Heat: %s", heat);
            callback(new Error("Error getting 'Current heating cooling state'."));
        }
    };

    onGetTargetHeatingCoolingState(callback) {
        this.log("Getting 'Target heating cooling state' characteristic ...");
        const heat = this.getHeat();
        if (this.isResponding() && heat) {
            const targetHeatingCoolingStateValue = this.getTargetHeatingCoolingStateValue();
            this.log("Current 'Target heating cooling state' characteristic is %s", targetHeatingCoolingStateValue);

            callback(null, targetHeatingCoolingStateValue);
        } else {
            this.log("Error getting 'Target heating cooling state' characteristic. Heat: %s", heat);
            callback(new Error("Error getting 'Target heating cooling state'."));
        }
    };

    onSetTargetHeatingCoolingState(targetHeatingCoolingState, callback) {
        this.log("SAUNABOX: Setting 'Target heating cooling' characteristic to %s ...", targetHeatingCoolingState);
        //if not OFF always send HEAT (saunaBox support only 0/1 values)
        if (targetHeatingCoolingState !== this.targetHeatingCoolingStateCharacteristic.OFF) {
            targetHeatingCoolingState = this.targetHeatingCoolingStateCharacteristic.HEAT;
        }
        const device = this.getDevice();
        const self = this;
        communication.send(bleboxCommands.setSimpleHeatState, device.ip, {
            params: [targetHeatingCoolingState],
            onSuccess: function (stateInfo) {
                self.updateStateInfo(stateInfo);
                callback(null);
            },
            onError: function () {
                callback(new Error("Error setting 'Target heating cooling'."));
            }
        });
    };

    onGetCurrentTemperature(callback) {
        this.log("Getting 'Current temperature' characteristic ...");
        const heat = this.getHeat();
        if (this.isResponding() && heat) {
            const currentTemperatureValue = this.getCurrentTemperatureValue();
            this.log("Current 'Current temperature' characteristic is %s", currentTemperatureValue);
            callback(null, currentTemperatureValue);
        } else {
            this.log("Error getting 'Current temperature' characteristic. Heat: %s", heat);
            callback(new Error("Error getting 'Current temperature'."));
        }
    };

    onGetTargetTemperature(callback) {
        this.log("Getting 'Target temperature' characteristic ...");
        const heat = this.getHeat();
        if (this.isResponding() && heat) {
            const targetTemperatureValue = this.getTargetTemperatureValue();
            this.log("Current 'Target temperature' characteristic is %s", targetTemperatureValue);
            callback(null, targetTemperatureValue);
        } else {
            this.log("Error getting 'Target temperature' characteristic. Heat: %s", heat);
            callback(new Error("Error getting 'Target temperature'."));
        }
    };

    onSetTargetTemperature(targetTemperature, callback) {
        this.log("Setting 'Target temperature' characteristic to %s ...", targetTemperature);
        const device = this.getDevice();
        const self = this;
        communication.send(bleboxCommands.setSimpleHeatDesiredTemperature, device.ip, {
            params: [targetTemperature * 100],
            onSuccess: function (stateInfo) {
                self.updateStateInfo(stateInfo);
                callback(null);
            },
            onError: function () {
                callback(new Error("Error setting 'Target temperature'."));
            }
        });
    };

    onGetTemperatureDisplayUnits(callback) {
        this.log("Getting 'Temperature display units' characteristic ...");
        if (this.isResponding()) {
            const temperatureDisplayUnitsValue = this.getTemperatureDisplayUnitsValue();
            this.log("Current 'Temperature display units' characteristic is %s", temperatureDisplayUnitsValue);
            callback(null, temperatureDisplayUnitsValue);
        } else {
            const heat = this.getHeat();
            this.log("Error getting 'Temperature display units' characteristic. Heat: %s", heat);
            callback(new Error("Error getting 'Temperature display units'."));
        }
    };

    onSetTemperatureDisplayUnits(temperatureDisplayUnits, callback) {
        this.accessory.context.blebox.temperatureDisplayUnits = temperatureDisplayUnits;
        callback(null);
    };
}

module.exports = {
    type: SAUNABOX_TYPE,
    checkStateCommand: bleboxCommands.getHeatState,
    create: function (accessory, log, api, deviceInfo, stateInfo) {
        return new SaunaBoxAccessoryWrapper(accessory, log, api, deviceInfo, stateInfo);
    }, restore: function (accessory, log, api) {
        return new SaunaBoxAccessoryWrapper(accessory, log, api);
    }
};
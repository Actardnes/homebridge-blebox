const bleboxCommands = require("../common/bleboxCommands");
const TEMPSENSOR_TYPE = require("../common/bleboxConst").BLEBOX_TYPE.TEMPSENSOR;
const AbstractBoxWrapper = require("./abstractBox");

class TempSensorAccessoryWrapper extends AbstractBoxWrapper {
    constructor(accessory, log, api, deviceInfo, stateInfo) {
        super(accessory, log, api);

        this.type = TEMPSENSOR_TYPE;
        this.checkStateCommand = bleboxCommands.getTempSensorState;

        this.servicesDefList = [api.hap.Service.TemperatureSensor];

        this.currentTemperatureCharacteristic = api.hap.Characteristic.CurrentTemperature;

        this.init(deviceInfo, stateInfo);

        this.assignCharacteristics();

        this.startListening();
    }

    assignCharacteristics() {
        super.assignCharacteristics();
        const serviceNumber = 0;
        const service = this.getService(serviceNumber);

        service.getCharacteristic(this.currentTemperatureCharacteristic)
            .setProps({
                maxValue: 125,
                minValue: -125,
            })
            .on('get', this.onGetCurrentTemperature.bind(this));
    }

    updateStateInfoCharacteristics() {
        const tempSensor = this.getTempSensor();
        if (tempSensor) {
            //update characteristics
            const serviceNumber = 0;
            const service = this.getService(serviceNumber);
            service.updateCharacteristic(this.currentTemperatureCharacteristic, this.getCurrentTemperatureValue());
        }
    };

    updateStateInfo(stateInfo) {
        if (stateInfo) {
            this.accessory.context.blebox.tempSensor = stateInfo.tempSensor || stateInfo;
            this.updateStateInfoCharacteristics();
        }
    }

    getTempSensor() {
        return this.accessory.context.blebox.tempSensor;
    }

    getCurrentTemperatureValue() {
        const {sensors: [{value: currentTemperature = 0} = {}] = []} = this.getTempSensor() || {};
        return Number((currentTemperature / 100).toFixed(1)) || 0;
    };

    onGetCurrentTemperature(callback) {
        this.log("Getting 'Current temperature' characteristic ...");
        const tempSensor = this.getTempSensor();
        if (this.isResponding() && tempSensor) {
            const currentTemperatureValue = this.getCurrentTemperatureValue();
            this.log("Current 'Current temperature' characteristic is %s", currentTemperatureValue);
            callback(null, currentTemperatureValue);
        } else {
            this.log("Error getting 'Current temperature' characteristic. TempSensor: %s", tempSensor);
            callback(new Error("Error getting 'Current temperature'."));
        }
    };
}

module.exports = {
    type: TEMPSENSOR_TYPE,
    checkStateCommand: bleboxCommands.getTempSensorState,
    create: function (accessory, log, api, deviceInfo, stateInfo) {
        return new TempSensorAccessoryWrapper(accessory, log, api, deviceInfo, stateInfo);
    }, restore: function (accessory, log, api) {
        return new TempSensorAccessoryWrapper(accessory, log, api);
    }
};
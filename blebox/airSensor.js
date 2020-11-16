const _ = require("lodash");
const bleboxCommands = require("../common/bleboxCommands");
const AIRSENSOR_TYPE = require("../common/bleboxConst").BLEBOX_TYPE.AIRSENSOR;
const AbstractBoxWrapper = require("./abstractBox");

const PM_TYPES = {
    PM2_5 : "pm2.5",
    PM10: "pm10"
}

class AirSensorAccessoryWrapper extends AbstractBoxWrapper {
    constructor(accessory, log, api, deviceInfo, stateInfo) {
        super(accessory, log, api);

        this.type = AIRSENSOR_TYPE;
        this.checkStateCommand = bleboxCommands.getAirSensorState;

        this.servicesDefList = [api.hap.Service.AirQualitySensor];

        this.airQualityCharacteristic = api.hap.Characteristic.AirQuality;
        this.pm2_5DensityCharacteristic = api.hap.Characteristic.PM2_5Density;
        this.pm10DensityCharacteristic = api.hap.Characteristic.PM10Density;

        this.init(deviceInfo, stateInfo);

        this.assignCharacteristics();

        this.startListening();
    }

    assignCharacteristics() {
        super.assignCharacteristics();
        const serviceNumber = 0;
        const service = this.getService(serviceNumber);

        service.getCharacteristic(this.airQualityCharacteristic)
            .on('get', this.onGetCurrentAirQuality.bind(this));

        service.getCharacteristic(this.pm2_5DensityCharacteristic)
            .on('get', this.onGetPmDensity.bind(this, PM_TYPES.PM2_5));

        service.getCharacteristic(this.pm10DensityCharacteristic)
            .on('get', this.onGetPmDensity.bind(this, PM_TYPES.PM10));
    }

    updateStateInfoCharacteristics() {
        const airSensor = this.getAirSensor();
        if (airSensor) {
            //update characteristics
            const serviceNumber = 0;
            const service = this.getService(serviceNumber);
            service.updateCharacteristic(this.airQualityCharacteristic, this.getCurrentAirQualityValue());
            service.updateCharacteristic(this.pm2_5DensityCharacteristic, this.getPmDensityValue(PM_TYPES.PM2_5));
            service.updateCharacteristic(this.pm10DensityCharacteristic, this.getPmDensityValue(PM_TYPES.PM10));
        }
    };

    updateStateInfo(stateInfo) {
        if (stateInfo) {
            this.accessory.context.blebox.airSensor = stateInfo.air || stateInfo;
            this.updateStateInfoCharacteristics();
        }
    }

    getAirSensor() {
        return this.accessory.context.blebox.airSensor;
    }

    getCurrentAirQualityValue() {
        let {sensors, airQualityLevel} = this.getAirSensor() || {};
        if(_.isUndefined(airQualityLevel)){
            airQualityLevel = (_.maxBy(sensors, function (sensor) {
                return sensor.qualityLevel;
            }) || {}).qualityLevel || this.airQualityCharacteristic.UNKNOWN;
        }
        return Math.max(this.airQualityCharacteristic.UNKNOWN, Math.min(airQualityLevel, this.airQualityCharacteristic.POOR));
    };

    getPmDensityValue(pmType){
        const {sensors} = this.getAirSensor() || {};
        const sensorForPmType = _.find(sensors, function (sensor){
            return sensor && sensor.type === pmType;
        }) || {};

        return sensorForPmType.value || 0;
    }

    onGetCurrentAirQuality(callback) {
        this.log("Getting 'Current air quality' characteristic ...");
        const airSensor = this.getAirSensor();
        if (this.isResponding() && airSensor) {
            const airQualityValue = this.getCurrentAirQualityValue();
            this.log("Current 'Current air quality' characteristic is %s", airQualityValue);
            callback(null, airQualityValue);
        } else {
            this.log("Error getting 'Current air quality' characteristic. AirSensor: %s", airSensor);
            callback(new Error("Error getting 'Current air quality'."));
        }
    };

    onGetPmDensity(pmType, callback){
        this.log("Getting 'Current pm %s density' characteristic ...", pmType);
        const airSensor = this.getAirSensor();
        if (this.isResponding() && airSensor) {
            const pmDensityValue = this.getPmDensityValue(pmType);
            this.log("Current 'Current pm %s density' characteristic is %s", pmType, pmDensityValue);
            callback(null, pmDensityValue);
        } else {
            this.log("Error getting 'Current pm %s density' characteristic. AirSensor: %s", pmType, airSensor);
            callback(new Error(`Error getting 'Current pm ${pmType} density'."`));
        }
    }
}

module.exports = {
    type: AIRSENSOR_TYPE,
    checkStateCommand: bleboxCommands.getAirSensorState,
    create: function (accessory, log, api, deviceInfo, stateInfo) {
        return new AirSensorAccessoryWrapper(accessory, log, api, deviceInfo, stateInfo);
    }, restore: function (accessory, log, api) {
        return new AirSensorAccessoryWrapper(accessory, log, api);
    }
};
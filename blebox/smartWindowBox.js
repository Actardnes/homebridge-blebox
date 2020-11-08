const communication = require("../common/communication");
const bleboxCommands = require("../common/bleboxCommands");
const SMARTWINDOWBOX_TYPE = require("../common/bleboxConst").BLEBOX_TYPE.SMARTWINDOWBOX;
const AbstractBoxWrapper = require("./abstractBox");

class SmartWindowBoxAccessoryWrapper extends AbstractBoxWrapper {
    constructor(accessory, log, api, deviceInfo, stateInfo) {
        super(accessory, log, api);

        this.type = SMARTWINDOWBOX_TYPE;
        this.checkStateCommand = bleboxCommands.getRelayState;

        this.servicesDefList = [
            api.hap.Service.WindowCovering,
            api.hap.Service.WindowCovering,
            api.hap.Service.WindowCovering
        ];
        this.servicesSubTypes = [
            'Motor 1',
            'Motor 2',
            'Motor 3'
        ];

        this.currentPositionCharacteristic = api.hap.Characteristic.CurrentPosition;
        this.targetPositionCharacteristic = api.hap.Characteristic.TargetPosition;
        this.postitionStateCharacteristic = api.hap.Characteristic.PositionState;

        this.init(this.servicesDefList, this.servicesSubTypes, deviceInfo, stateInfo);

        this.assignCharacteristics();

        this.startListening();
    }

    assignCharacteristics() {
        super.assignCharacteristics();
        for (let i = 1; i < this.accessory.services.length; i++) {
            const service = this.accessory.services[i];
            const serviceNumber = i - 1;
            service.getCharacteristic(this.postitionStateCharacteristic)
                .on('get', this.onGetPositionState.bind(this, serviceNumber));

            service.getCharacteristic(this.currentPositionCharacteristic)
                .on('get', this.onGetCurrentPosition.bind(this, serviceNumber));

            service.getCharacteristic(this.targetPositionCharacteristic)
                .on('get', this.onGetTargetPosition.bind(this, serviceNumber))
                .on('set', this.onSetTargetPosition.bind(this, serviceNumber));
        }
    }

    updateStateInfoCharacteristics() {
        const window = this.getWindow();
        if (window) {
            for (let i = 1; i < this.accessory.services.length; i++) {
                const service = this.accessory.services[i];
                const serviceNumber = i - 1;
                service.updateCharacteristic(this.currentPositionCharacteristic, this.getCurrentPositionValue(serviceNumber));

                service.updateCharacteristic(this.targetPositionCharacteristic, this.getTargetPositionValue(serviceNumber));

                service.updateCharacteristic(this.postitionStateCharacteristic, this.getPositionStateValue(serviceNumber));
            }
        }
    }

    updateStateInfo(stateInfo) {
        if (stateInfo) {
            this.accessory.context.blebox.window = stateInfo.window || stateInfo;
            this.updateStateInfoCharacteristics();
        }
    }

    getWindow() {
        return this.accessory.context.blebox.window;
    }

    getServiceName(serviceNumber) {
        const serviceName = super.getServiceName(serviceNumber);
        const suffix = this.getServiceNameSuffix(serviceNumber);
        return `${serviceName} ${suffix}`;
    }

    getServiceNameSuffix(serviceNumber) {
        const {motors = []} = this.getWindow() || {};
        const {name = this.servicesSubTypes[serviceNumber]} = motors[serviceNumber] || {};
        return name;
    };

    _getPositionValue(serviceNumber, positionType) {
        const {motors = []} = this.getWindow() || {};
        const {[positionType]: {position = 0} = {}} = motors[serviceNumber] || {};
        return 100 - Math.min(Math.max(position, 0), 100);
    }

    getCurrentPositionValue(serviceNumber) {
        return this._getPositionValue(serviceNumber, 'currentPos');
    }

    getTargetPositionValue(serviceNumber) {
        return this._getPositionValue(serviceNumber, 'desiredPos');
    }

    getPositionStateValue(serviceNumber) {
        let positionState = this.postitionStateCharacteristic.STOPPED;
        const {motors = []} = this.getWindow() || {};
        const {state} = motors[serviceNumber] || {};
        if (state === 0) { //down
            positionState = this.postitionStateCharacteristic.DECREASING;
        } else if (state === 1) { //up
            positionState = this.postitionStateCharacteristic.INCREASING;
        }
        return positionState;
    }

    onGetCurrentPosition(serviceNumber, callback) {
        this.log("Getting 'Current position' characteristic for motor %s ...", serviceNumber);
        const window = this.getWindow();
        if (this.isResponding() && window) {
            const currentPosition = this.getCurrentPositionValue(serviceNumber);
            this.log("Current 'Current position' characteristic for motor %s is %s", serviceNumber, currentPosition);

            callback(null, currentPosition);
        } else {
            this.log("Error getting 'Current position' characteristic for motor %s. Window: %s", serviceNumber, window);
            callback(new Error("Error getting 'Current position'."));
        }
    }

    onGetTargetPosition(serviceNumber, callback) {
        this.log("Getting 'Target position' characteristic for motor %s ...", serviceNumber);
        const window = this.getWindow();
        if (this.isResponding() && window) {
            const currentPosition = this.getTargetPositionValue(serviceNumber);
            this.log("Current 'Target position' characteristic for motor %s is %s", serviceNumber, currentPosition);

            callback(null, currentPosition);
        } else {
            this.log("Error getting 'Target position' characteristic for motor %s. Window: %s", serviceNumber, window);
            callback(new Error("Error getting 'Target position'."));
        }
    }

    onSetTargetPosition(serviceNumber, position, callback) {
        this.log("Setting 'target position' characteristic for motor %s to %s ...", serviceNumber, position);
        position = 100 - position;
        const self = this;
        const device = this.getDevice();
        communication.send(bleboxCommands.setWindowPositionPercentage, device.ip, {
            params: [serviceNumber, position],
            onSuccess: function (stateInfo) {
                self.updateStateInfo(stateInfo);
                callback(null); // success
            },
            onError: function () {
                callback(new Error("Error setting 'target position'."));
            }
        });
    }

    onGetPositionState(serviceNumber, callback) {
        this.log("Getting 'Position state' characteristic for motor %s ...", serviceNumber);
        const window = this.getWindow();
        if (this.isResponding() && window) {
            const positionState = this.getPositionStateValue();
            this.log("Current 'Position state' characteristic for motor %s is %s", serviceNumber, positionState);
            callback(null, positionState); // success
        } else {
            this.log("Error getting 'Position state' characteristic for motor. Window: %s", serviceNumber, window);
            callback(new Error("Error getting 'Position state'."));
        }
    }
}

module.exports = {
    type: SMARTWINDOWBOX_TYPE,
    checkStateCommand: bleboxCommands.getWindowState,
    create: function (accessory, log, api, deviceInfo, stateInfo) {
        return new SmartWindowBoxAccessoryWrapper(accessory, log, api, deviceInfo, stateInfo);
    }, restore: function (accessory, log, api) {
        return new SmartWindowBoxAccessoryWrapper(accessory, log, api);
    }
};
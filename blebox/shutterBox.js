const communication = require("../common/communication");
const bleboxCommands = require("../common/bleboxCommands");
const SHUTTERBOX_TYPE = require("../common/bleboxConst").BLEBOX_TYPE.SHUTTERBOX;
const AbstractBoxWrapper = require("./abstractBox");


class ShutterBoxAccessoryWrapper extends AbstractBoxWrapper {
    constructor(accessory, log, api, deviceInfo, stateInfo) {
        super(accessory, log, api);

        this.type = SHUTTERBOX_TYPE;
        this.checkStateCommand = bleboxCommands.getShutterState;

        this.servicesDefList = [api.hap.Service.WindowCovering];
        this.servicesSubTypes = [];

        this.currentPositionCharacteristic = api.hap.Characteristic.CurrentPosition;
        this.targetPositionCharacteristic = api.hap.Characteristic.TargetPosition;
        this.postitionStateCharacteristic = api.hap.Characteristic.PositionState;

        this.init(this.servicesDefList, this.servicesSubTypes, deviceInfo, stateInfo);

        this.assignCharacteristics();

        this.startListening();
    }

    assignCharacteristics() {
        this.log("Services: "+this.getAccessory().services.length);
        super.assignCharacteristics();
        const serviceNumber = 1;
        const service = this.accessory.services[serviceNumber];
        service.getCharacteristic(this.postitionStateCharacteristic)
            .on('get', this.onGetPositionState.bind(this));

        service.getCharacteristic(this.targetPositionCharacteristic)
            .on('get', this.onGetTargetPosition.bind(this))
            .on('set', this.onSetTargetPosition.bind(this));

        service.getCharacteristic(this.currentPositionCharacteristic)
            .on('get', this.onGetCurrentPosition.bind(this));
    }

    updateStateInfoCharacteristics() {
        const shutter = this.getShutter();
        if (shutter) {
            //update characteristics
            const serviceNumber = 1;
            const service = this.accessory.services[serviceNumber];
            service.updateCharacteristic(this.currentPositionCharacteristic, this.getCurrentPositionValue());

            service.updateCharacteristic(this.targetPositionCharacteristic, this.getTargetPositionValue());

            service.updateCharacteristic(this.postitionStateCharacteristic, this.getPositionStateValue());

        }
    };

    updateStateInfo(stateInfo) {
        if (stateInfo) {
            this.accessory.context.blebox.shutter = stateInfo.shutter || stateInfo;
            this.updateStateInfoCharacteristics();
        }
    }

    getShutter() {
        return this.accessory.context.blebox.shutter;
    }

    _getPositionValue(positionType) {
        let position = 0;
        const shutter = this.getShutter();
        if (shutter) {
            const shutterPosition = shutter[positionType];
            position = !isNaN(Number(shutterPosition.position)) ? shutterPosition.position : shutterPosition;
            position = 100 - (Math.min(Math.max(position, 0), 100) || 0);
        }
        return position;
    }

    getCurrentPositionValue() {
        return this._getPositionValue('currentPos');
    };

    getTargetPositionValue() {
        return this._getPositionValue('desiredPos');
    };

    getPositionStateValue() {
        let positionState = this.postitionStateCharacteristic.STOPPED;
        const shutter = this.getShutter();
        if (shutter) {
            switch (shutter.state) {
                case 0: //down
                    positionState = this.postitionStateCharacteristic.DECREASING;
                    break;
                case 1: // up
                    positionState = this.postitionStateCharacteristic.INCREASING;
                    break;
                default:
                    positionState = this.postitionStateCharacteristic.STOPPED;
                    break;
            }
        }
        return positionState;
    };

    onGetCurrentPosition(callback) {
        this.log("Getting 'Current position' characteristic ...");
        const shutter = this.getShutter();
        if (this.isResponding() && shutter) {
            const currentPosition = this.getCurrentPositionValue();
            this.log("Current 'Current position' characteristic is %s", currentPosition);
            callback(null, currentPosition);
        } else {
            this.log("Error getting 'Current position' characteristic. Shutter: %s", shutter);
            callback(new Error("Error getting 'Current position'."));
        }
    };

    onGetTargetPosition(callback) {
        this.log("Getting 'Target position' characteristic ...");
        const shutter = this.getShutter();
        if (this.isResponding() && shutter) {
            const currentPosition = this.getTargetPositionValue();
            this.log("Current 'Target position' characteristic is %s", currentPosition);
            callback(null, currentPosition);
        } else {
            this.log("Error getting 'Target position' characteristic. Shutter: %s", shutter);
            callback(new Error("Error getting 'Target position'."));
        }
    };

    onSetTargetPosition(position, callback) {
        this.log("Setting 'target position' characteristic to %s ...", position);
        position = 100 - position;
        const self = this;
        const shutter = this.getShutter();
        const command = shutter && shutter.desiredPos.position !== undefined ? bleboxCommands.setSimplePositionShutterState : bleboxCommands.setSimpleShutterState;
        const device = this.getDevice();
        communication.send(command, device.ip, {
            params: [position],
            onSuccess: function (stateInfo) {
                self.updateStateInfo(stateInfo);
                callback(null);
            },
            onError: function () {
                callback(new Error("Error setting 'target position'."));
            }
        });
    };

    onGetPositionState(callback) {
        this.log("Getting 'Position state' characteristic ...");
        const shutter = this.getShutter();
        if (this.isResponding() && shutter) {
            const positionState = this.getPositionStateValue();
            this.log("Current 'Position state' characteristic is %s", positionState);
            callback(null, positionState); // success
        } else {
            this.log("Error getting 'Position state' characteristic. Shutter: %s", shutter);
            callback(new Error("Error getting 'Position state'."));
        }
    };
}

module.exports = {
    type: SHUTTERBOX_TYPE,
    checkStateCommand: bleboxCommands.getShutterState,
    create: function (accessory, log, api, deviceInfo, stateInfo) {
        return new ShutterBoxAccessoryWrapper(accessory, log, api, deviceInfo, stateInfo);
    }, restore: function (accessory, log, api) {
        return new ShutterBoxAccessoryWrapper(accessory, log, api);
    }
};

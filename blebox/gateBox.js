const communication = require("../common/communication");
const bleboxCommands = require("../common/bleboxCommands");
const GATEBOX_TYPE = require("../common/bleboxConst").BLEBOX_TYPE.GATEBOX;
const AbstractBoxWrapper = require("./abstractBox");

class GateBoxAccessoryWrapper extends AbstractBoxWrapper {
    constructor(accessory, log, api, deviceInfo, stateInfo) {
        super(accessory, log, api);

        this.type = GATEBOX_TYPE;
        this.checkStateCommand = bleboxCommands.getGateState;

        this.servicesDefList = [api.hap.Service.GarageDoorOpener];

        this.currentDoorStateCharacteristic = api.hap.Characteristic.CurrentDoorState;
        this.targetDoorStateCharacteristic = api.hap.Characteristic.TargetDoorState;
        this.obstructionDetectedCharacteristic = api.hap.Characteristic.ObstructionDetected;

        this.init(deviceInfo, stateInfo);

        this.assignCharacteristics();

        this.startListening();
    }

    assignCharacteristics() {
        super.assignCharacteristics();
        const serviceNumber = 0;
        const service = this.getService(serviceNumber);

        service.getCharacteristic(this.currentDoorStateCharacteristic)
            .on('get', this.onGetCurrentDoorState.bind(this));

        service.getCharacteristic(this.targetDoorStateCharacteristic)
            .on('get', this.onGetTargetDoorState.bind(this))
            .on('set', this.onSetTargetDoorState.bind(this));

        service.getCharacteristic(this.obstructionDetectedCharacteristic)
            .on('get', this.onGetObstructionDetected.bind(this));

    }

    updateStateInfoCharacteristics() {
        const gate = this.getGate();
        if (gate) {
            //update characteristics
            const serviceNumber = 0;
            const service = this.getService(serviceNumber);
            service.updateCharacteristic(this.currentDoorStateCharacteristic, this.getCurrentDoorStateValue());
        }
    };

    updateStateInfo(stateInfo) {
        if (stateInfo) {
            this.accessory.context.blebox.gate = stateInfo.gate || stateInfo;
            this.updateStateInfoCharacteristics();
        }
    }

    getGate() {
        return this.accessory.context.blebox.gate;
    }

    getCurrentDoorStateValue() {
        let state = this.currentDoorStateCharacteristic.OPEN;
        const gate = this.getGate();
        if (gate) {
            const currentPosition = Number(gate.currentPos) || 0;
            if (currentPosition === 0) {
                state = this.currentDoorStateCharacteristic.CLOSED;
            }
        }
        return state;
    };

    onGetCurrentDoorState(callback) {
        this.log("Getting 'current door' characteristic ...");
        const gate = this.getGate();
        if (this.isResponding() && gate) {
            const currentState = this.getCurrentDoorStateValue();
            this.log("Current 'current door' characteristic is %s", currentState);
            callback(null, currentState);
        } else {
            this.log("Error getting 'current door' characteristic. GateInfo: %s", gate);
            callback(new Error("Error getting 'current door'."));
        }
    };

    onGetTargetDoorState(callback) {
        this.log("Getting 'target door' characteristic ...");
        const gate = this.getGate();
        if (this.isResponding() && gate) {
            const targetState = this.getCurrentDoorStateValue();
            this.log("Current 'target door' characteristic is %s", targetState);
            callback(null, targetState);
        } else {
            this.log("Error getting 'target door' characteristic. GateInfo: %s", gate);
            callback(new Error("Error getting 'current door'."));
        }
    };

    onSetTargetDoorState(state, callback) {
        this.log("Setting 'target door' characteristic to %s", state);
        const device = this.getDevice();
        const self = this;
        communication.send(bleboxCommands.setSimpleGateState, device.ip, {
            onSuccess: function (stateInfo) {
                self.updateStateInfo(stateInfo);
                callback(null);
            }, onError: function () {
                callback(new Error("Error setting 'target door'."));
            }
        });
    };

    onGetObstructionDetected(callback) {
        this.log("Getting 'obstruction detected' characteristic ...");
        if (this.isResponding()) {
            const isObstructionDetected = false;
            this.log("Current 'obstruction detected' characteristic is %s", isObstructionDetected);
            callback(null, isObstructionDetected);
        } else {
            this.log("Error getting 'obstruction detected' characteristic.");
            callback(new Error("Error getting 'obstruction detected'."));
        }
    };
}


module.exports = {
    type: GATEBOX_TYPE,
    checkStateCommand: bleboxCommands.getGateState,
    create: function (accessory, log, api, deviceInfo, stateInfo) {
        return new GateBoxAccessoryWrapper(accessory, log, api, deviceInfo, stateInfo);
    }, restore: function (accessory, log, api) {
        return new GateBoxAccessoryWrapper(accessory, log, api);
    }
};

var os = require('os');
var communication = require("./../common/communication");
var bleboxCommands = require("./../common/bleboxCommands");
var BLEBOX_TYPE = require("./../common/bleboxConst").BLEBOX_TYPE;
var GateBoxAccessoryWrapperFactory = require("./../blebox/gateBox");
var DimmerBoxAccessoryWrapperFactory = require("./../blebox/dimmerBox");
var ShutterBoxAccessoryWrapperFactory = require("./../blebox/shutterBox");
var SwitchBoxAccessoryWrapperFactory = require("./../blebox/switchBox");
var SwitchBoxDAccessoryWrapperFactory = require("./../blebox/switchBoxD");
var WLightBoxAccessoryWrapperFactory = require("./../blebox/wLightBox");
var WLightBoxSAccessoryWrapperFactory = require("./../blebox/wLightBoxS");
var SmartWindowBoxAccessoryWrapperFactory = require("./../blebox/smartWindowBox");
var SaunaBoxAccessoryWrapperFactory = require("./../blebox/saunaBox");

module.exports = BleBoxPlatform;

function BleBoxPlatform(homebridge, log, config, api) {
    this.log = log;
    this.config = config;
    this.startNextScanDelayInMin = Number(this.config["NEXT_SCAN_DELAY_IN_MIN"]) || 0;
    this.ipList = [];
    this.scanNextIpDelayInMs = 100;
    this.accessoriesWrapperList = [];
    this.accessoriesWrapperObj = {};
    this.homebridge = homebridge;
    this.api = api;

    this.prepareIpListToScan();

    this.api.on('didFinishLaunching', function () {
        this.startSearching();
    }.bind(this));
}

BleBoxPlatform.prototype.prepareIpListToScan = function () {
    var interfaces = os.networkInterfaces();
    for (var i in interfaces) {
        for (var j in interfaces[i]) {
            var netInterface = interfaces[i][j];
            if (netInterface.family === 'IPv4' && !netInterface.internal) {
                this.addIpsFromInterface(netInterface);
                break;
            }
        }
    }
};

BleBoxPlatform.prototype.addIpsFromInterface = function (netInterface) {
    var maskArray = netInterface.netmask.split('.', 4);
    var maskBitsCount = 0;
    for (var i in maskArray) {
        var maskNode = Number(maskArray[i]);
        maskBitsCount += (((maskNode >>> 0).toString(2)).match(/1/g) || []).length;
    }
    if (maskBitsCount > 16 && maskBitsCount < 32) {
        var ipNumber = ipStringToNumber(netInterface.address);
        if (ipNumber) {
            var firstPossibleIpNumber = ipNumber & ((-1 << (32 - maskBitsCount))); //network address
            var lastPossibleIpNumber = firstPossibleIpNumber + Math.pow(2, (32 - maskBitsCount)) - 1; // broadcast address

            var possibleIpAddressesCount = lastPossibleIpNumber - firstPossibleIpNumber;
            // add all addresses except network and broadcast
            for (var j = 1; j < possibleIpAddressesCount; j++) {
                var currentIpNumber = firstPossibleIpNumber + j;
                var currentIpString = ipNumberToString(currentIpNumber);
                if (this.ipList.indexOf(currentIpString) === -1) {
                    this.ipList.push(currentIpString);
                }
            }
        }
    }

    function ipNumberToString(ipNumber) {
        var byte1 = (ipNumber >>> 24);
        var byte2 = (ipNumber >>> 16) & 255;
        var byte3 = (ipNumber >>> 8) & 255;
        var byte4 = ipNumber & 255;
        return (byte1 + '.' + byte2 + '.' + byte3 + '.' + byte4);
    }

    function ipStringToNumber(ipString) {
        var split = ipString.split('.', 4);
        if (split.length === 4) {
            var myInt = (
                parseFloat(split[0] * 16777216)    /* 2^24 */
                + parseFloat(split[1] * 65536)        /* 2^16 */
                + parseFloat(split[2] * 256)        /* 2^8  */
                + parseFloat(split[3])
            );
            return myInt;
        }
        return null;
    }
};

BleBoxPlatform.prototype.configureAccessory = function (accessory) {
    var accessoryWrapperFactory;
    var accessoryWrapper;
    switch (accessory.context.blebox.type) {
        case BLEBOX_TYPE.WLIGHTBOXS:
            accessoryWrapperFactory = WLightBoxSAccessoryWrapperFactory;
            break;
        case BLEBOX_TYPE.WLIGHTBOX:
            accessoryWrapperFactory = WLightBoxAccessoryWrapperFactory;
            break;
        case BLEBOX_TYPE.DIMMERBOX:
            accessoryWrapperFactory = DimmerBoxAccessoryWrapperFactory;
            break;
        case BLEBOX_TYPE.SHUTTERBOX:
            accessoryWrapperFactory = ShutterBoxAccessoryWrapperFactory;
            break;
        case BLEBOX_TYPE.GATEBOX:
            accessoryWrapperFactory = GateBoxAccessoryWrapperFactory;
            break;
        case BLEBOX_TYPE.SWITCHBOXD:
            accessoryWrapperFactory = SwitchBoxDAccessoryWrapperFactory;
            break;
        case BLEBOX_TYPE.SWITCHBOX:
            accessoryWrapperFactory = SwitchBoxAccessoryWrapperFactory;
            break;
        case BLEBOX_TYPE.SMARTWINDOWBOX:
            accessoryWrapperFactory = SmartWindowBoxAccessoryWrapperFactory;
            break;
        case BLEBOX_TYPE.SAUNABOX:
            accessoryWrapperFactory = SaunaBoxAccessoryWrapperFactory;
            break;
        default :
            console.log("Wrong accessory!", accessory);
            this.api.unregisterPlatformAccessories("homebridge-blebox", "BleBoxPlatform", [accessory]);
            return;
    }

    accessoryWrapper = accessoryWrapperFactory.restore(accessory, this.log, this.api, accessory.context.blebox);
    this.addAccessoryWrapper(accessoryWrapper, false);
};

BleBoxPlatform.prototype.startSearching = function () {
    this.log("Searching blebox devices started!");
    this.sendSearchRequest(0);
};

BleBoxPlatform.prototype.sendSearchRequest = function (index) {
    (function (index) {
        var ipAddress = this.ipList[index];
        if (ipAddress) {
            var self = this;
            console.log("Checking ip: %s", ipAddress);
            communication.send(bleboxCommands.getDeviceState, ipAddress, {
                onSuccess: function (deviceInfo) {
                    if (deviceInfo) {
                        deviceInfo = deviceInfo.device || deviceInfo;
                        if (deviceInfo.id && deviceInfo.type) {
                            deviceInfo.ip = ipAddress;
                            var accessoryWrapperObj = self.accessoriesWrapperObj[deviceInfo.id];
                            if (!accessoryWrapperObj) {
                                self.checkSpecificStateAndAddAccessory(deviceInfo)
                            } else {
                                accessoryWrapperObj.setDeviceIp(deviceInfo);
                            }
                        }
                    }
                    self.checkIfSearchIsFinishedAndScheduleNext(index);
                }, onError: function () {
                    self.checkIfSearchIsFinishedAndScheduleNext(index);
                }
            });
        }
    }).call(this, index);

    index++;
    if (index < this.ipList.length) {
        setTimeout(this.sendSearchRequest.bind(this, index), this.scanNextIpDelayInMs);
    }
};

BleBoxPlatform.prototype.checkIfSearchIsFinishedAndScheduleNext = function (index) {
    if (index >= this.ipList.length - 1) {
        this.log("Searching blebox devices finished!");
        if (this.startNextScanDelayInMin) { //if defined and different than 0
            var startNextScanDelayInMs = this.startNextScanDelayInMin * 60 * 1000;
            setTimeout(this.startSearching.bind(this), startNextScanDelayInMs);
        }
    }
};

BleBoxPlatform.prototype.createAndAddAccessoryWrapper = function (accessoryWrapperFactory, deviceInfo, stateInfo) {
    if (accessoryWrapperFactory && deviceInfo && stateInfo) {
        var accessoryWrapper = accessoryWrapperFactory.create(this.homebridge, this.log, this.api, deviceInfo, stateInfo);
        this.addAccessoryWrapper(accessoryWrapper, true);
    }
};

BleBoxPlatform.prototype.checkSpecificStateAndAddAccessory = function (deviceInfo) {
    var ipAddress = deviceInfo.ip;
    var self = this;
    var deviceType = deviceInfo.type.toLowerCase();
    switch (deviceType) {
        case BLEBOX_TYPE.WLIGHTBOXS:
            communication.send(bleboxCommands.getLightState, ipAddress, {
                onSuccess: function (lightInfo) {
                    self.createAndAddAccessoryWrapper(WLightBoxSAccessoryWrapperFactory, deviceInfo, lightInfo);
                }
            });
            break;
        case BLEBOX_TYPE.WLIGHTBOX:
            communication.send(bleboxCommands.getRgbwState, ipAddress, {
                onSuccess: function (rgbState) {
                    self.createAndAddAccessoryWrapper(WLightBoxAccessoryWrapperFactory, deviceInfo, rgbState);
                }
            });
            break;
        case BLEBOX_TYPE.DIMMERBOX:
            communication.send(bleboxCommands.getDimmerState, ipAddress, {
                onSuccess: function (dimmerInfo) {
                    self.createAndAddAccessoryWrapper(DimmerBoxAccessoryWrapperFactory, deviceInfo, dimmerInfo);
                }
            });
            break;
        case BLEBOX_TYPE.SHUTTERBOX:
            communication.send(bleboxCommands.getShutterState, ipAddress, {
                onSuccess: function (shutterInfo) {
                    self.createAndAddAccessoryWrapper(ShutterBoxAccessoryWrapperFactory, deviceInfo, shutterInfo);
                }
            });
            break;
        case BLEBOX_TYPE.GATEBOX:
            communication.send(bleboxCommands.getGateState, ipAddress, {
                onSuccess: function (gateInfo) {
                    self.createAndAddAccessoryWrapper(GateBoxAccessoryWrapperFactory, deviceInfo, gateInfo);
                }
            });
            break;
        case BLEBOX_TYPE.SWITCHBOXD:
            communication.send(bleboxCommands.getRelayState, ipAddress, {
                onSuccess: function (relayInfo) {
                    self.createAndAddAccessoryWrapper(SwitchBoxDAccessoryWrapperFactory, deviceInfo, relayInfo);
                }
            });
            break;
        case BLEBOX_TYPE.SWITCHBOX:
            communication.send(bleboxCommands.getRelayState, ipAddress, {
                onSuccess: function (relayInfo) {
                    self.createAndAddAccessoryWrapper(SwitchBoxAccessoryWrapperFactory, deviceInfo, relayInfo);
                }
            });
            break;
        case BLEBOX_TYPE.SMARTWINDOWBOX:
            communication.send(bleboxCommands.getWindowState, ipAddress, {
                onSuccess: function (windowInfo) {
                    self.createAndAddAccessoryWrapper(SmartWindowBoxAccessoryWrapperFactory, deviceInfo, windowInfo);
                }
            });
            break;
        case BLEBOX_TYPE.SAUNABOX:
            communication.send(bleboxCommands.getHeatState, ipAddress, {
                onSuccess: function (heatInfo) {
                    self.createAndAddAccessoryWrapper(SaunaBoxAccessoryWrapperFactory, deviceInfo, heatInfo);
                }
            });
            break;
        default:
            this.log("Unknown device type: %s", deviceInfo.type);
            break;
    }

};

BleBoxPlatform.prototype.addAccessoryWrapper = function (accessoryWrapper, register) {
    if (accessoryWrapper && this.accessoriesWrapperList.length < 98) { // we cannot have more than 98 devices
        this.accessoriesWrapperList.push(accessoryWrapper);
        this.accessoriesWrapperObj[accessoryWrapper.deviceId] = accessoryWrapper;
        if (register) {
            this.api.registerPlatformAccessories("homebridge-blebox", "BleBoxPlatform", [accessoryWrapper.getAccessory()]);
        }
        this.log("Added accessory! Now we have: %s", this.accessoriesWrapperList.length);
    }
};

BleBoxPlatform.prototype.accessories = function (callback) {
    var accessoriesList = [];
    for (var i = 0; i < this.accessoriesWrapperList.length; i++) {
        accessoriesList.push(this.accessoriesWrapperList[i].getAccessory());
    }
    callback(accessoriesList);
};

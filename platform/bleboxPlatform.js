var os = require('os');
var communication = require("./../common/communication");
var bleboxCommands = require("./../common/bleboxCommands");
var bleBoxAccessoryWrapperFactories = require("./../blebox")

class BleBoxPlatform {
    constructor(homebridge, log, config, api) {
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

    // Implement for DynamicPlatformPlugin
    configureAccessory(accessory) {
        const deviceType = accessory.context.blebox.device.type || accessory.context.blebox.type || "";
        const accessoryWrapperFactory = bleBoxAccessoryWrapperFactories[deviceType.toLowerCase()];
        if (accessoryWrapperFactory) {
            const accessoryWrapper = accessoryWrapperFactory.restore(accessory, this.log, this.api);
            this.addAccessoryWrapper(accessoryWrapper, false);
        }else{
            this.log(JSON.stringify(accessory.context))
            this.api.unregisterPlatformAccessories("homebridge-blebox", "BleBoxPlatform", [accessory]);
        }
    };

    // Implement for StaticPlatformPlugin
    accessories(callback) {
        var accessoriesList = [];
        for (var i = 0; i < this.accessoriesWrapperList.length; i++) {
            accessoriesList.push(this.accessoriesWrapperList[i].getAccessory());
        }
        callback(accessoriesList);
    };

    prepareIpListToScan() {
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

    addIpsFromInterface(netInterface) {
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

    startSearching() {
        this.log("Searching blebox devices started!");
        this.sendSearchRequest(0);
    };

    sendSearchRequest(index) {
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
                                    accessoryWrapperObj.updateDeviceInfo(deviceInfo);
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

    checkIfSearchIsFinishedAndScheduleNext(index) {
        if (index >= this.ipList.length - 1) {
            this.log("Searching blebox devices finished!");
            if (this.startNextScanDelayInMin) { //if defined and different than 0
                var startNextScanDelayInMs = this.startNextScanDelayInMin * 60 * 1000;
                setTimeout(this.startSearching.bind(this), startNextScanDelayInMs);
            }
        }
    };

    createAndAddAccessoryWrapper(accessoryWrapperFactory, deviceInfo, stateInfo) {
        if (deviceInfo && stateInfo) {
            var uuid = this.homebridge.hap.uuid.generate(accessoryWrapperFactory.type + deviceInfo.ip);
            var accessory = new this.homebridge.platformAccessory(deviceInfo.deviceName, uuid);
            var accessoryWrapper = accessoryWrapperFactory.create(accessory, this.log, this.api, deviceInfo, stateInfo);
            this.addAccessoryWrapper(accessoryWrapper, true);
        }
    };

    checkSpecificStateAndAddAccessory(deviceInfo) {
        var ipAddress = deviceInfo.ip;
        var self = this;
        var deviceType = deviceInfo.type.toLowerCase();
        var accessoryWrapperFactory = bleBoxAccessoryWrapperFactories[deviceType];
        if (accessoryWrapperFactory) {
            communication.send(accessoryWrapperFactory.checkStateCommand, ipAddress, {
                onSuccess: function (stateInfo) {
                    self.createAndAddAccessoryWrapper(accessoryWrapperFactory, deviceInfo, stateInfo);
                }
            })
        } else {
            this.log("Unknown device type: %s", deviceType);
        }
    };

    addAccessoryWrapper(accessoryWrapper, register) {
        if (accessoryWrapper && this.accessoriesWrapperList.length < 98) { // we cannot have more than 98 devices
            this.accessoriesWrapperList.push(accessoryWrapper);
            this.accessoriesWrapperObj[accessoryWrapper.getAccessory().context.blebox.device.id] = accessoryWrapper;
            if (register) {
                this.api.registerPlatformAccessories("homebridge-blebox", "BleBoxPlatform", [accessoryWrapper.getAccessory()]);
                this.log("Added new accessory %s!", accessoryWrapper.type);
            } else {
                this.log("Restored accessory %s!", accessoryWrapper.type);
            }
            this.log("Now we have: %s", this.accessoriesWrapperList.length);
        }
    };
}

module.exports = BleBoxPlatform;
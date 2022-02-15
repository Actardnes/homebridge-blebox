# homebridge-blebox
----------
Supports BleBox devices on HomeBridge Platform

# Installation
----------
More information about installation [homebridge](https://www.npmjs.com/package/homebridge) on Raspberry Pi you can find:
[Install homebridge on raspberry](https://github.com/nfarina/homebridge/wiki/Running-HomeBridge-on-a-Raspberry-Pi)

Install homebridge using: 
```sh
    npm install -g homebridge
```

Install this plugin using:
```sh
    npm install -g homebridge-blebox
```
Update your configuration file as bellow.

# Configuration
---------- 
By default configuration file **config.json** is in *{HOME_PATH}/.homebridge* folder. If this file and folder doesn't exists create them.

Configuration sample (remove comments) :
```json
{
    "bridge": {
        "name": "SomeBridgeName", // Custom bridge name
        "username": "08:D4:0C:B5:DE:71", // Unique username, best solution to use bridge mac address
        "port": 51826, // Don't change this
        "pin": "131-45-155" // Pin must be in this format, but you can change this numbers
    },
    
    "description": "Custom description",

    "platforms": [
            {
            "platform": "BleBoxPlatform", // Don't change this
            "name": "SomePlatformName" // Custom platform name
            "NEXT_SCAN_DELAY_IN_MIN" : 0 // (Optional, default: 0) How often platform should scan network for blebox devices( 0 - only once at startup, Other value - number of minutes between scanning)
            "IP_LIST" : null // (Optional, default: null) Provide a IP list to scan for blebox devices, example value: ["192.168.0.191","192.168.0.192","192.168.10.19"]) 
        }

    ],

    "accessories": []
}
```

# Usage

Run Home app on your Iphone.

Choose "Add accessory".

Your Bridge should be found. Choose it.

Enter PIN you set in **config.json**.

Proceed steps in Home app. 
*In some IOS version during configuring accessory we may see error: "Cannot communicate with accessory". Just click OK. 

Control your BleBox devices by app or voice commands (Siri).

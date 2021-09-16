const _ = require("lodash");

const airSensor = require("./airSensor");
const dimmerBox = require("./dimmerBox");
const gateBox = require("./gateBox");
const saunaBox = require("./saunaBox");
const shutterBox = require("./shutterBox");
const smartWindowBox = require("./smartWindowBox");
const switchBox = require("./switchBox");
const switchBoxD = require("./switchBoxD");
const tempSensor = require("./tempSensor");
const wLightBox = require("./wLightBox");
const wLightBox_singleChannel = require("./wLightBox_singleChannel");
const wLightBoxS = require("./wLightBoxS");


const wrappers = [
    airSensor,
    dimmerBox,
    gateBox,
    saunaBox,
    shutterBox,
    smartWindowBox,
    switchBox,
    switchBoxD,
    tempSensor,
    wLightBox,
    wLightBox_singleChannel,
    wLightBoxS
];


const wrappersByType = _.reduce(wrappers, (acc, wrapper) => {
    acc[wrapper.type] = wrapper;
    return acc;
}, {})

const getWrapper = (type, state, services) => {
    if (type === wLightBox.type) {
        // when wlightboxs will change into wlightbox we need to check state with a little weird path: `light.rgbw.currentColor`
        const currentColorFallback = _.get(state,'light.rgbw.currentColor','');
        const {rgbw: {currentColor = currentColorFallback} = state} = state || {};
        const channelsCount = currentColor.length / 2;
        // wLightBox: 3 services
        // wLightBox_singleChannel: 2 services
        if (channelsCount === 1 || _.size(services) === 2) {
            return wLightBox_singleChannel;
        }
        return wLightBox;
    } else {
        return wrappersByType[type];
    }
}

module.exports = getWrapper;
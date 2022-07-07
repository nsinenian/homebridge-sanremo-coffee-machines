import {
  AccessoryConfig,
  AccessoryPlugin,
  API,
  CharacteristicEventTypes,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicValue,
  HAP,
  Logging,
  Service
} from "homebridge";

import fetch from "node-fetch";

/*
 * IMPORTANT NOTICE
 *
 * One thing you need to take care of is, that you never ever ever import anything directly from the "homebridge" module (or the "hap-nodejs" module).
 * The above import block may seem like, that we do exactly that, but actually those imports are only used for types and interfaces
 * and will disappear once the code is compiled to Javascript.
 * In fact you can check that by running `npm run build` and opening the compiled Javascript file in the `dist` folder.
 * You will notice that the file does not contain a `... = require("homebridge");` statement anywhere in the code.
 *
 * The contents of the above import statement MUST ONLY be used for type annotation or accessing things like CONST ENUMS,
 * which is a special case as they get replaced by the actual value and do not remain as a reference in the compiled code.
 * Meaning normal enums are bad, const enums can be used.
 *
 * You MUST NOT import anything else which remains as a reference in the code, as this will result in
 * a `... = require("homebridge");` to be compiled into the final Javascript code.
 * This typically leads to unexpected behavior at runtime, as in many cases it won't be able to find the module
 * or will import another instance of homebridge causing collisions.
 *
 * To mitigate this the {@link API | Homebridge API} exposes the whole suite of HAP-NodeJS inside the `hap` property
 * of the api object, which can be acquired for example in the initializer function. This reference can be stored
 * like this for example and used to access all exported variables and classes from HAP-NodeJS.
 */
let hap: HAP;

/*
 * Initializer function called when the plugin is loaded.
 */

module.exports = (api : API) => {
  hap = api.hap;
  api.registerAccessory('SanremoCube', SanremoCube);
};

class SanremoCube implements AccessoryPlugin {


  private readonly reg_string = 'registers'   
  private readonly reg_index_status = 12;
  private readonly reg_index_temp = 0;
  private readonly reg_status_standby_bitmask = 16;
  private readonly reg_status_ready_bitmask = 0b0100000;

  private readonly cmd_state =  'key=151';
  private readonly cmd_config = 'key=152';
  private readonly cmd_standby = 'key=200&id=12&value=1'
  private readonly cmd_on = 'key=200&id=11&value=1'

  private readonly log: Logging;
  private readonly name: string;
  private readonly ip: string;

  private readonly switchService: Service;
  private readonly temperatureSensorService: Service;
  private readonly informationService: Service;

  private active = false;
  private currentTemperature = 0;

  constructor(log: Logging, config: AccessoryConfig, api: API) {
    this.log = log;
    this.name = config.name;
    this.ip = config.ip;

    this.informationService = new hap.Service.AccessoryInformation()
      .setCharacteristic(hap.Characteristic.Manufacturer, "Sanremo")
      .setCharacteristic(hap.Characteristic.Model, "Cube");

    // Setup standby switch
    this.switchService = new hap.Service.Switch(this.name);
    this.switchService.getCharacteristic(hap.Characteristic.On)
      .on(CharacteristicEventTypes.GET,this.handleOnGet.bind(this))
      .on(CharacteristicEventTypes.SET,this.handleOnSet.bind(this));
  
    // Setup (boiler) temperature sensor
    this.temperatureSensorService = new hap.Service.TemperatureSensor(this.name);
    this.temperatureSensorService.getCharacteristic(hap.Characteristic.CurrentTemperature)
      .on(CharacteristicEventTypes.GET,this.handleCurrentTemperatureGet.bind(this)); 
  
  }

  /*
   * This method is optional to implement. It is called when HomeKit ask to identify the accessory.
   * Typical this only ever happens at the pairing process.
   */
  identify(): void {
  }

  /*
   * This method is called directly after creation of this instance.
   * It should return all services which should be added to the accessory.
   */
  getServices(): Service[] {
    return [
      this.informationService,
      this.switchService,
      this.temperatureSensorService
    ];
  }

  /**
   * Handle requests to get the current value of the "On" characteristic
   */
  handleOnGet(callback: CharacteristicGetCallback) {


    fetch('http://' + this.ip + '/ajax/post', {
      method: 'POST',
      body: this.cmd_state
    })
    .then(r => r.json())
    .then(r => {
      this.active = (Number(r['registers'][12][1]) & this.reg_status_standby_bitmask) == 0;
    }).catch(error => console.error('Error', error))
    callback(undefined,this.active);
  }

  /**
   * Handle requests to set the "On" characteristic
   */
  async handleOnSet(value:CharacteristicValue, callback: CharacteristicSetCallback) {
    let content = value? this.cmd_on : this.cmd_standby;
    fetch('http://' + this.ip + '/ajax/post', {
      method: 'POST',
      body: content
    });
    callback();
  }

  /**
   * Handle requests to get teh "Current Temperature" characteristic
   */
  handleCurrentTemperatureGet(callback: CharacteristicGetCallback) {
    
    fetch('http://' + this.ip + '/ajax/post', {
      method: 'POST',
      body: this.cmd_state
    })
    .then(r => r.json())
    .then(r => {
      this.currentTemperature = Number(r['registers'][0][1]);
    }).catch(error => console.error('Error', error))
    callback(undefined,this.currentTemperature);
    return this.currentTemperature;
  }
}

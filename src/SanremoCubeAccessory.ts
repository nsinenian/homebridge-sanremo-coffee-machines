import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';

import { SanremoCoffeeMachines } from './SanremoCoffeeMachines';

import fetch from "node-fetch";

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class SanremoCubeAccessory {
    
    private heaterService: Service;
    
    /** REST Commands */
    private readonly cmdGetDeviceInfo = 'key=150';
    private readonly cmdGetReadOnlyParameters =  'key=151';
    private readonly cmdGetReadWriteParameters = 'key=152';
    private readonly cmdStandby = 'key=200&id=12&value=1'
    private readonly cmdActive = 'key=200&id=11&value=1'
    private readonly cmdSetTemperature = 'key=200&id=1&value='
    private readonly cmdResetFilterExpiration = 'key=200&id=23&value=0'
    
    
    /** Read-only registers */
    private readonly regString = 'registers'
    
    private readonly roRegIndexTemp = 0;
    private readonly roRegIndexDayCoffee = 0;
    private readonly roRegIndexWeekCoffee = 0;
    private readonly roRegIndexMonthCoffee = 0;
    private readonly roRegIndexYearCoffee = 0;
    private readonly roRegIndexTotalCoffee = 0;
    private readonly roRegIndexFilterDaysRemaining = 10;
    private readonly roRegIndexStatus = 12;
    private readonly roRegIndexAlarm = 14;
    
    private roFilterChangeThresholdDays = 0;
    
    private readonly statusMaskTankLevelOk = 1;
    private readonly statusMaskBoilerLevelOk = 2;
    private readonly statusMaskPreAlarmTankLevel = 4;
    private readonly statusMaskWaterSource = 8;
    private readonly statusMaskStandby = 16;
    private readonly statusMaskReady = 32;
    private readonly statusMaskSteamBoosterHeating = 256;
    private readonly statusMaskSteamBoosterSetPointOk = 512;
    
    private readonly alarmMaskNeedChangeFilters = 128;
    
    private readonly cubeMinTempDegC = 115;
    private readonly cubeMaxTempDegC = 130;
    
    private roRegStatus = 0;
    private roRegAlarm = 0;
    private roRegTemp = 0;
    private roRegFilterDaysRemaining = 0;
    
    /** Read-write registers */
    private readonly rwRegIndexTemp = 0;
    
    private rwRegTemp = this.cubeMinTempDegC;
    
    private readonly postUrl: string;
    
    constructor(
      private readonly platform: SanremoCoffeeMachines,
      private readonly accessory: PlatformAccessory,
      private readonly ipAddress: string,)
    {
        this.postUrl = 'http://' + ipAddress + '/ajax/post';
        
        // set accessory information
        this.accessory.getService(this.platform.Service.AccessoryInformation)!
        .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Sanremo')
        .setCharacteristic(this.platform.Characteristic.Model, 'Cube')
        .setCharacteristic(this.platform.Characteristic.SerialNumber, ipAddress);
        
        this.heaterService = this.accessory.getService(this.platform.Service.HeaterCooler) ||
        this.accessory.addService(this.platform.Service.HeaterCooler);
        
        // Setup heater service on/off
        this.heaterService.getCharacteristic(this.platform.Characteristic.Active).onGet(
                                                                                        this.handleActiveGet.bind(this));
        this.heaterService.getCharacteristic(this.platform.Characteristic.Active).onSet(
                                                                                        this.handleActiveSet.bind(this));
        
        // Setup heater service current temperature
        const currentTemperatureCharacteristic = this.heaterService.getCharacteristic(this.platform.Characteristic.CurrentTemperature);
        currentTemperatureCharacteristic.onGet(this.handleCurrentTemperatureGet.bind(this));
        currentTemperatureCharacteristic.setProps({ minValue: 0, maxValue: 150 });
        
        // Setup heater service target temperature
        const heatingThresholdCharacteristic = this.heaterService.getCharacteristic(this.platform.Characteristic.HeatingThresholdTemperature);
        heatingThresholdCharacteristic.onSet(this.handleTargetTemperatureSet.bind(this));
        heatingThresholdCharacteristic.onGet(this.handleTargetTemperatureGet.bind(this));
        heatingThresholdCharacteristic.setProps( {minValue: this.cubeMinTempDegC, maxValue: this.cubeMaxTempDegC, minStep: 1});
        
        // Setup heater service current heater cooler state
        const currentHeaterState = this.heaterService.getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState);
        currentHeaterState.onGet(this.handleCurrentHeaterStateGet.bind(this));
        currentHeaterState.setProps({
          // validValues: hap.Characteristic.CurrentHeaterCoolerState.INACTIVE,
          //              hap.Characteristic.CurrentHeaterCoolerState.IDLE,
          //              hap.Characteristic.CurrentHeaterCoolerState.HEATING,
          //              hap.Characteristic.CurrentHeaterCoolerState.COOLING
            minValue: 0,
            maxValue: 2,
            validValues: [0, 1, 2]
        });
        
        const targetHeaterState = this.heaterService.getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState);
        targetHeaterState.onSet(this.handleTargetHeaterStateSet.bind(this));// this.handleTarget//hap.Characteristic.CurrentHeaterCoolerState.IDLE);
        targetHeaterState.onGet(this.handleTargetHeaterStateGet.bind(this));
        targetHeaterState.setProps({
          // validValues: [hap.Characteristic.TargetHeaterCoolerState.HEAT,hap.Characteristic.TargetHeaterCoolerState.COOL],
          minValue: 1,
          maxValue: 1,
          validValues: [1, 1]
        });
        
        this.heaterService.addCharacteristic(this.platform.Characteristic.FilterChangeIndication).onGet(this.handleFilterChangeIndicationGet.bind(this));
        this.heaterService.addCharacteristic(this.platform.Characteristic.FilterLifeLevel).onGet(this.handleFilterLifeLevelGet.bind(this));
        this.heaterService.addCharacteristic(this.platform.Characteristic.ResetFilterIndication).onSet(this.ResetFilterIndicationSet.bind(this));
    }
    
    getReadWriteParameters() {
        return fetch(this.postUrl, { method: 'POST', body: this.cmdGetReadWriteParameters })
        .then(r => r.json())
        .then(r => {
            this.rwRegTemp = Number(r[this.regString][this.rwRegIndexTemp][1])/10;
        }).catch(error => console.error('Error', error))
    }
    
    getReadOnlyParameters() {
        return fetch(this.postUrl, { method: 'POST', body: this.cmdGetReadOnlyParameters }).then((response) => {
          if (response.ok) {
            return response.json();
          }
          throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
        })
        .then((responseJson) => {
            this.roRegStatus = Number(responseJson[this.regString][this.roRegIndexStatus][1]);
            this.roRegAlarm = Number(responseJson[this.regString][this.roRegIndexAlarm][1]);
            this.roRegTemp = Number(responseJson[this.regString][this.roRegIndexTemp][1]);
            this.roRegFilterDaysRemaining = Number(responseJson[this.regString][this.roRegIndexFilterDaysRemaining][1]);
            this.roFilterChangeThresholdDays = Number(responseJson['ThesholdWarningChangeFilter']);
        })
        .catch((error) => {
            console.log(error)
            return false;
        });
    }
    
    /*** Heater-cooler implementation ***/
    async handleActiveGet() {
        await this.getReadOnlyParameters();
        return ( (this.roRegStatus & this.statusMaskStandby) == 0 );
    }
    
    async handleActiveSet(value: CharacteristicValue) {
        const content = value? this.cmdActive : this.cmdStandby;
        fetch(this.postUrl, { method: 'POST', body: content });
    }
    
    async handleCurrentTemperatureGet() {
        await this.getReadOnlyParameters();
        return this.roRegTemp as number;
    }
    
    async handleTargetTemperatureSet(value: CharacteristicValue) {
        const targetTemperature = Number(value);
        const content = this.cmdSetTemperature + String(targetTemperature);
        
        fetch(this.postUrl, { method: 'POST', body: content });
    }
    
    async handleTargetTemperatureGet() {
      await this.getReadWriteParameters();
      return this.rwRegTemp;
    }
    
    async handleCurrentHeaterStateGet() {
      await this.getReadOnlyParameters();
        
      const readyToBrew = !( (this.roRegStatus & this.statusMaskReady) == 0);
      return readyToBrew ? this.platform.Characteristic.CurrentHeaterCoolerState.IDLE : this.platform.Characteristic.CurrentHeaterCoolerState.HEATING;
    }
    
    async handleTargetHeaterStateSet() {
        
    }
    
    handleTargetHeaterStateGet() {
        return this.platform.Characteristic.TargetHeaterCoolerState.HEAT;
    }
    

    /*** Filter maintenance implementation ***/
    
    async handleFilterChangeIndicationGet() {
        await this.getReadOnlyParameters();
        const needChangeFilter = ( (this.roRegAlarm & this.alarmMaskNeedChangeFilters) != 0);
        
        return needChangeFilter ? this.platform.Characteristic.FilterChangeIndication.CHANGE_FILTER : this.platform.Characteristic.FilterChangeIndication.FILTER_OK;
    }
    
    async handleFilterLifeLevelGet() {
        await this.getReadOnlyParameters();
        const filterRemainingPercent = this.roRegFilterDaysRemaining / this.roFilterChangeThresholdDays * 100;
        return isNaN(filterRemainingPercent) ? 0 : filterRemainingPercent;
    }
    
    async ResetFilterIndicationSet() {
        fetch(this.postUrl, { method: 'POST', body: this.cmdResetFilterExpiration });
    }
}

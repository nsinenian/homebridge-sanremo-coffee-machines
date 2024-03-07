# Sanremo Coffee Machines Hombridge Plugin

This plugin currently only supports the Sanremo Cube.  It implements a heater widget to allow for switching the Cube into or out of standby mode, to monitor and alter the boiler temperature, and to monitor and provide indications for water filter maintenance.

The following prerequisites apply when using this plugin:

1. The machine should be left switched on (hard rocker switch in the on position) to facilitate communication between the internal WiFi module and homebridge.
2. The machine should be connected to the same network as Homebridge (consult the machine  manual on how to connect the machine to a wireless network)
2. A known static IP address should be assigned (consult the machine manual)

# Plugin Configuration

After installing the plugin, configure as follows:

    "platforms": [
        {
            "name": "Config",
            "port": 8581,
            "platform": "config"
        },
        {
            "platform": "SanremoCoffeeMachines",
            "name": "SanremoCoffeeMachines",
            "machines": [
                {
                    "name": "Sanremo Cube",
                    "type": "Cube",
                    "ip": "[Your statically configure IP here]"
                }
            ]
        }
        
 Note that multiple machines are supported (i.e., see "machines" array above). The only "type" currently supported is the "Cube" and must be indicated as such. Other machines may be supported in the future.
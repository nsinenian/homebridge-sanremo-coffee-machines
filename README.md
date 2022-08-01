# Sanremo Cube Hombridge Plugin
This plugin implements a switch and temperature sensor that allows for switching the Sanremo Cube into or out of standby mode and for monitoring the heat exchanger temperature.  The latter is limited as HomeKit only supports display of temperatures up to 100 degC. 

The following prerequisites apply when using this plugin:

1. The Sanremo Cube should be left switched on (hard rocker switch in the on position)
2. The unit should be connected to the same network as Homebridge (consult the Sanremo Cube manual on how to connect the Cube to a wireless network)
2. A known static IP address should be assigned (consult the Sanremo Cube manual)

# Plugin Configuration

After installing the plugin, configure as follows:

    {
        "accessory": "SanremoCube", 
        "name": "Sanremo Cube",
        "ip": "[Your Statically Configured IP address here]"
    }
    
In the above excerpt, the first line should be exactly as shown above.  The second line ("name") can be customized to the user's liking.  The third entry should match the IP address you have configured (by following the Sanremo setup guide).

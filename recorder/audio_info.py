import pyaudio
import json

audio = pyaudio.PyAudio()


print("----------------------record device list---------------------")
info = audio.get_host_api_info_by_index(0)
numdevices = info.get('deviceCount')
for i in range(0, numdevices):
        if (audio.get_device_info_by_host_api_device_index(0, i).get('maxInputChannels')) > 0:
            print("Input Device id ", i, " - ", audio.get_device_info_by_host_api_device_index(0, i).get('name'))

print("-------------------------------------------------------------")

print("   ")

print("------------------default input device --------------------- ")
info = audio.get_default_input_device_info()
print(json.dumps(info, indent=4, separators=(". ", " = ")))

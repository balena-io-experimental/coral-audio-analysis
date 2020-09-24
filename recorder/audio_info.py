import pyaudio
import json
from datetime import datetime

audio = pyaudio.PyAudio()

outp ="Audio Information as of {0}\n\n".format(datetime.now())
outp = outp + "----------------------record device list---------------------\n"
info = audio.get_host_api_info_by_index(0)
numdevices = info.get('deviceCount')
for i in range(0, numdevices):
        if (audio.get_device_info_by_host_api_device_index(0, i).get('maxInputChannels')) > 0:
            outp = outp + "Input Device index {0} - {1}\n".format(i, audio.get_device_info_by_host_api_device_index(0, i).get('name'))

outp = outp + "-------------------------------------------------------------\n"

outp = outp + "   \n"

outp = outp + "------------------default input device --------------------- \n"
info = audio.get_default_input_device_info()
outp = outp + json.dumps(info, indent=4, separators=(". ", " = ")) + "\n"

print(outp)
file1 = open("/data/sound_app/audio_info.txt", "w")
file1.writelines(outp)
file1.close()

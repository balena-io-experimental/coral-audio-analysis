# coral-audio-analysis
Coral Edge TPU project for analyzing noise pollution using the Coral Dev board or a Raspberry Pi 4 with the Edge TPU.

The on-board mic listens for noises above a certain intensity level. The noises are saved as wav files and then various audio features (such as a spectrogram) are extracted from the sounds and analyzed by a Tensorflow Lite model running on the Edge TPU. The included model is trained to recognize 10 noises from the [UrbanSound8K dataset](https://urbansounddataset.weebly.com/urbansound8k.html) based on patterns in its audio features: air conditioner, car horn, children playing, dog bark, drilling, engine idling, gun shot, jackhammer, siren, and street music. You can view the detected noises and model predictions on a web page hosted on-device.

An optional master node will soon be available that has an S3-compatible object store which can receive manually-classified audio files from the nodes in order to re-train and improve the model for all devices in the fleet.

Use the button below to deploy this application to your device or use the CLI.

[![](https://www.balena.io/deploy.png)](https://dashboard.balena-cloud.com/deploy?repoUrl=https://github.com/balenalabs-incubator/coral-audio-analysis)

**Overview:**

**recorder** - continuously listens through the mic and records audio files in 4 second chunks if they are above a certain volume threshold.

**classifier** - looks for newly recorded wav files and anaylzes them using the model. If they are not a reasonable match, they are saved for later analysis and possible upload to the master training node.

**sound_edgetpu.tflite** - Tensorflow model in the classifier folder trained on the [Urban Sound 8k dataset](https://urbansounddataset.weebly.com/) of 8,000+ sound files in 10 classes. This model has been converted to Tensorflow Lite and integer post-quantized on the internal layers so they will run on the Edge TPU. The input and output tensors are still float32. 70% of the model should execute on the Edge TPU.

**webserver** - Express webserver that runs on port 80 to provide a view into the sound app activity, listen to files and decide which ones to upload. 

To see the sounds that have been detected by the device, as well as the classification, browse to the device's IP or public URL if enabled.
Use the device variables below to customize the behavior of the application:

(Recorder)

`WAV_REC_THRESHOLD` - minimum intensity of audio reaching mic that triggers a recording start (default is 2000)

`INPUT_INDEX` - index of physical audio input to use for recording (default is to use the board's default input) - You can see the audio details in the "recorder" log window when the container starts.

`FAN_SPEED` - (Coral Dev board only) set a value in rpm (average range is 2000 - 8000) to run the board fan at a constant speed. Without this set, the fan is supposed to run automatically at 65 C. (Note that any fan noise will be picked up by the on-board microphone and cause significantly less accurate predictions by the classifier)

`WAV_FILE_LIMIT` - total size of all wav files saved to disk in bytes before a warning is issued (default is 6000000000)

(Classifier)

`LABEL_FILE` - path and filename of text file with ordered list of classes for associated model (default is `/data/sound_app/labels.txt`)

`MODEL_FILE` - path and filename of Edge TPU model file. (default is `/data/sound_app/sound_edgetpu.tflite`)

`CERTAINTY_THRESHOLD` - minimum percentage value of top guess to be considered a valid guess (default is 70)

`AUTO_DELETE` - files with a prediction certainty above the `CERTAINTY_THRESHOLD` will automatically be deleted unless this is set to false. (default is false)

(all)

`WAV_PATH` - path where wav files are recorded (default is `/data/sound_app/`)

`DB_PATH` - path and filename of SQLite database (default is `/data/sound_app/sound_app.db`)

(webserver)

`MASTER_NODE` - full UUID of the master node to upload sound files and data for re-training the model. The "Upload" button will be disabled if this is not set.

`MINIO_ACCESS_KEY` - access key for master node's Minio server, the data store for uploading sound files. 

`MINIO_SECRET_KEY` - secret key for master node's Minio server, the data store for uploading sound files. 

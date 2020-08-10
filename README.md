# coral-audio-analysis
Coral Edge TPU project for analyzing noise pollution using the Coral Dev board - work in progress...

**Highlights:**

**recorder** - files for container that continuously listens through the mic and records audio files in 4 second chunks if they are above a certain volume threshold.

**classifier** - files for container that looks for newly recorded wav files and anaylzes them using the model. If they are not a reasonable match, they are saved for later analysis and possible upload to the master training node.

**qmodel3a8p2_edgetpu.tflite** - Tensorflow model in the classifier folder trained on the Urban Sound 8k dataset of 8,000+ sound files in 10 classes. This model has been converted to Tensorflow Lite and integer post-quantized on the internal layers so they will run on the Edge TPU. The input and output tensors are still float32. 70% of the model should execute on the Edge TPU.

**webserver** - small webserver that runs on port 80 to provide a view into the sound app activity, listen to files and decide which ones to upload. 

**samples** - some wav files that can be used for testing purposes. Not uploaded to device any longer.

Device Variables:

(Recorder)

`WAV_FILE_LIMIT` - total size of all wav files saved to disk in bytes before a warning is issued (default is 6000000000)

`WAV_REC_THRESHOLD` - minimum intensity of audio reaching mic that triggers a recording start (default is 2000)

`INPUT_INDEX` - index of physical audio input to use for recording (default is to use the board's default input)

(Classifier)

`LABEL_FILE` - path and filename of text file with ordered list of classes for associated model (default is `/data/sound_app/labels.txt`)

`CERTAINTY_THRESHOLD` - minimum percentage value of top guess to be considered a valid guess (default is 70)

(both)

`WAV_PATH` - path where wav files are recorded (default is ``/data/sound_app/`)

`DB_PATH` - path and filename of SQLite database (default is `/data/sound_app/sound_app.db`)


# coral-audio-analysis
Coral Edge TPU project for analyzing noise pollution using the Coral Dev board - work in progress...

**Highlights:**

**Dockerfile** - builds [Librosa](https://librosa.org/doc/latest/index.html#) and all dependencies (including sci-kit, numpy, numba, llvm) as well as pyaudio. Librosa is used to turn large WAV files into small numpy arrays which are fed into the model for interpretation.

**qmodel3a8p2_edgetpu.tflite** - Tensorflow model trained on the Urban Sound 8k dataset of 8,000+ sound files in 10 classes. This model has been converted to Tensorflow Lite and integer post-quantized on the internal layers so they will run on the Edge TPU. The input and output tensors are still float32. The model has been compiled for the Edge TPU.

**capture.py** - test file for capturing audio from the mic on the Coral Dev board using pyaudio.

**play.py** - test file for playing back sound on the Coral board. Alsa aplayer is also installed.

**classify.py** - Working python script that classifies wav files using the tflite model above. Set for using the sound files in the samples folder. Uses the EdgeTPU when possible, about 70% of the operations for this model.

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


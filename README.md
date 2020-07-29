# coral-audio-analysis
Coral Edge TPU project for analyzing noise pollution using the Coral Dev board - work in progress...

**Highlights:**

**Dockerfile** - builds [Librosa](https://librosa.org/doc/latest/index.html#) and all dependencies (including sci-kit, numpy, numba, llvm) as well as pyaudio. Librosa is used to turn large WAV files into small numpy arrays which are fed into the model for interpretation.

**qmodel3a8p2_edgetpu.tflite** - Tensorflow model trained on the Urban Sound 8k dataset of 8,000+ sound files in 10 folds. This model has been converted to Tensorflow Lite and integer post-quantized on the internal layers so they will run on the Edge TPU. The input and output tensors are still float32. The model has been compiled for the Edge TPU.

**capture.py** - test file for capturing audio from the mic on the Coral Dev board using pyaudio.

**play.py** - test file for playing back sound on the Coral board. Alsa aplayer is also installed.

**classify.py** - Working python script that classifies wav files using the tflite model above. Set for using the sound files in the samples folder. Uses the EdgeTPU when possible, about 70% of the operations for this model.



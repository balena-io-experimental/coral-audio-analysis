import tflite_runtime.interpreter as tflite
import glob
import os
import librosa
import numpy as np

sound_file_paths = ["aircon.wav", "carhorn.wav", "play.wav", "dogbark.wav", "drill.wav",
                    "engine.wav","gunshots.wav","jackhammer.wav","siren.wav","music.wav"]
sound_names = ["air conditioner","car horn","children playing","dog bark","drilling","engine idling",
               "gun shot","jackhammer","siren","street music"]
parent_dir = 'samples/'

# just extract the features
def extract_features_only(filename):
    features = np.empty((0,193))
    X, sample_rate = librosa.load(filename)
    stft = np.abs(librosa.stft(X))
    mfccs = np.mean(librosa.feature.mfcc(y=X, sr=sample_rate, n_mfcc=40).T,axis=0)
    chroma = np.mean(librosa.feature.chroma_stft(S=stft, sr=sample_rate).T,axis=0)
    mel = np.mean(librosa.feature.melspectrogram(X, sr=sample_rate).T,axis=0)
    contrast = np.mean(librosa.feature.spectral_contrast(S=stft, sr=sample_rate).T,axis=0)
    tonnetz = np.mean(librosa.feature.tonnetz(y=librosa.effects.harmonic(X), sr=sample_rate).T,axis=0)
    ext_features = np.hstack([mfccs,chroma,mel,contrast,tonnetz])
    features = np.vstack([features,ext_features])
    return features


# Specify a TensorFlow Lite delegate for the Edge TPU.
# Then, whenever the interpreter encounters a graph node
# that's compiled for the Edge TPU, it sends that operation
# to the Edge TPU instead of the CPU

interpreter = tflite.Interpreter(model_path="qmodel3a8p2_edgetpu.tflite", experimental_delegates=[tflite.load_delegate('libedgetpu.so.1')])
input_details = interpreter.get_input_details()
output_details = interpreter.get_output_details()
interpreter.allocate_tensors()
print("== Input details ==")
print("shape:", input_details[0]['shape'])
print("type:", input_details[0]['dtype'])
print("\n== Output details ==")
print("shape:", output_details[0]['shape'])
print("type:", output_details[0]['dtype'])

# create predictions for each of the sound classes
for s in range(len(sound_names)):
    print("\n----- ", sound_names[s], "-----")
    # load audio file and extract features
    predict_file = parent_dir + sound_file_paths[s]
    predict_x = extract_features_only(predict_file)

    interpreter.set_tensor(input_details[0]['index'], predict_x.astype(np.float32))
    interpreter.invoke()

    tflite_model_predictions = interpreter.get_tensor(output_details[0]['index'])

    # get the indices of the top 2 predictions, invert into descending order
    ind = np.argpartition(tflite_model_predictions[0], -2)[-2:]
    ind[np.argsort(tflite_model_predictions[0][ind])]
    ind = ind[::-1]

    print("Top guess: ", sound_names[ind[0]], " (",round(tflite_model_predictions[0,ind[0]],3),")")
    print("2nd guess: ", sound_names[ind[1]], " (",round(tflite_model_predictions[0,ind[1]],3),")")

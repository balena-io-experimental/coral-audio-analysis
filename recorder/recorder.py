import pyaudio
import wave
import audioop
from collections import deque
import os
from os import path
from pathlib import Path
import time
import math
import sqlite3

# based on https://github.com/jeysonmc/python-google-speech-scripts/blob/master/stt_google.py

DB_PATH = os.getenv("DB_PATH", "/data/sound_app/sound_app.db")  # path and filename of database

# FYI: Database schema below, only one table
# CREATE TABLE wav_file(my_rowid INTEGER PRIMARY KEY, timestamp_created TEXT, timestamp_evaluated TEXT, timestamp_deleted TEXT, interpreter_class TEXT, interpreter_certainty INT,
#   interpreter_class2 TEXT, interpreter_certainty2 INT, system_notes TEXT, user_description TEXT, user_notes TEXT, 
#   timestamp_uploaded TEXT, current_status TEXT, filename TEXT, threshold INT, avg_intensity REAL, classify_duration TEXT, 
#   user_class TEXT, timestamp_ready TEXT, remote_filename TEXT, upload_msg TEXT, certainty_threshold INT, t3 TEXT, t4 TEXT, n1 INT, n2 INT,
#   interpreter_class_id INT, interpreter_class2_id INT, user_class_id INT);

WAV_FILE_PATH = os.getenv("WAV_PATH", "/data/sound_app/") # path to location for saving wav files

wf = os.getenv("WAV_FILE_LIMIT", "6000000000") # Total size limit in bytes of stored wav files before warning
if wf.isnumeric():
    WAV_FILE_LIMIT = int(wf)
else:
    WAV_FILE_LIMIT = 6000000000

UUID = os.environ.get('RESIN_DEVICE_UUID')[:7] # First seven chars of device UUID

# Microphone stream config.
CHUNK = 1024  # CHUNKS of bytes to read each time from mic
FORMAT = pyaudio.paInt16
CHANNELS = 1
RATE = 44100
th = os.getenv("WAV_REC_THRESHOLD", "2000")  # The threshold intensity that defines silence
                  # and noise signal (an int. lower than THRESHOLD is silence).
                  # based on peak ampltude in each chunk of audio data
if th.isnumeric():
    THRESHOLD = int(th)
else:
    THRESHOLD = 2000

SILENCE_LIMIT = 1  # Silence limit in seconds. The max ammount of seconds where
                   # only silence is recorded. When this time passes the
                   # recording is saved and evaluated.

PREV_AUDIO = 0.5  # Previous audio (in seconds) to prepend. When noise
                  # is detected, how much of previously recorded audio is
                  # prepended. This helps to prevent chopping the beggining
                  # of the sound.

idx = os.getenv("INPUT_INDEX", "x")  # Which physical input to record from
if idx.isnumeric():
    INPUT_INDEX = int(idx)
else:
    INPUT_INDEX = 'x'

MAX_FILE_LENGTH = 4 # Number of seconds until a new file is started while reording

file_count = 0 # counter for how many files created in this session.

def append_db(filename, max_intensity):
    """
    Writes record to database for new sound file recording
    """

    if not(path.exists(DB_PATH)):
        print("Database not found. Sleeping 5 seconds awaiting db copy.")
        time.sleep(5)
        
    try:
        conn = sqlite3.connect(DB_PATH)
    except Error as e:
        print("Error connecting to database: ", e)

    cur = conn.cursor()
    sql = """INSERT INTO 'wav_file'('filename', 'timestamp_created', 'current_status', 'threshold', 'avg_intensity')
        VALUES(?, ?, ?, ?, ?);"""
    data_tuple = (filename, time.strftime('%Y-%m-%d %H:%M:%S'), 'created', THRESHOLD, max_intensity)
    cur.execute(sql, data_tuple)
    conn.commit()

def listen_for_speech(threshold=THRESHOLD, num_phrases=-1):
    """
    Listens to microphone, extracts phrases from it and saves as wav file
    to be analyzed by the classifier. a "phrase" is sound
    surrounded by silence (according to threshold). num_phrases controls
    how many phrases to process before finishing the listening process
    (-1 for infinite).
    """
    global file_count, INPUT_INDEX
    #Open stream
    p = pyaudio.PyAudio()

    # Get default input device
    if INPUT_INDEX == "x":
        INPUT_INDEX = p.get_default_input_device_info()["index"]
    print("Using audio input index {0}.".format(INPUT_INDEX))
    stream = p.open(format=FORMAT,
                    channels=CHANNELS,
                    rate=RATE,
                    input_device_index=INPUT_INDEX,
                    input=True,
                    frames_per_buffer=CHUNK)

    print("Listening to audio input...")
    audio2send = []
    cur_data = ''  # current chunk  of audio data
    rel = RATE/CHUNK
    slid_win = deque(maxlen=int(SILENCE_LIMIT * rel)+1)
    # print("slid_win length: ", len(slid_win))
    #Prepend audio from 0.5 seconds before noise was detected
    prev_audio = deque(maxlen=int(PREV_AUDIO * rel)+1)
    # print("prev_audio length: ", len(prev_audio))
    started = False
    n = num_phrases
    response = []
    file_split = 0
    while (num_phrases == -1 or n > 0):
        cur_data = stream.read(CHUNK, exception_on_overflow = False)
        slid_win.append(math.sqrt(abs(audioop.avg(cur_data, 4))))
        #print("slid_win length: ", len(slid_win))
        #print("prev_audio length: ", len(prev_audio))
        #print("sum x > threshold: ", sum([x > THRESHOLD for x in slid_win]))
        #print slid_win[-1]
        if(sum([x > THRESHOLD for x in slid_win]) > 0 and file_split == 0):
            if(not started):
                print("Starting file recording...")
                started = True
            audio2send.append(cur_data)
            #print("audio2send length: ", len(audio2send))
            #print("seconds: ", len(audio2send)/rel)
            if len(audio2send)/rel > (MAX_FILE_LENGTH - 0.5):
                file_split = 1
        elif (started is True):
            print("Finished recording.")
            # The limit was reached, finish capture
            filename = save_speech(list(prev_audio) + audio2send, p)
            print("Saving file {0}, length {1}s.".format(filename, round(len(audio2send)/rel),2))
            # Add file info to db so classifier can evaluate it
            append_db(filename, -1)
            # Reset all
            started = False
            slid_win = deque(maxlen=int(SILENCE_LIMIT * rel)+1)
            prev_audio = deque(maxlen=int(0.5 * rel)+1)
            audio2send = []
            n -= 1
            file_split = 0
            file_count = file_count + 1
            if file_count % 10 == 0:
                # every ten files that are created, check wav file space usage
                print("{0} files created so far.".format(str(file_count)))
                root_directory = Path('WAV_FILE_PATH')
                wav_space = sum(f.stat().st_size for f in root_directory.glob('*.wav') if f.is_file())
                if wav_space > WAV_FILE_LIMIT:
                    print("Warning: wav files are utilizing more drive space than the specified limit!")
                    #TODO: Create a more useful warning
            print("Listening ...")
        else:
            prev_audio.append(cur_data)

    print("Finished recording.")
    stream.close()
    p.terminate()

    return response


def save_speech(data, p):
    """ Saves mic data to WAV file. Returns filename of saved
        file """

    filename = str(int(time.time()))
    # writes data to WAV file
    data = b''.join(data)
    wf = wave.open(WAV_FILE_PATH + filename + '.wav', 'wb')
    wf.setnchannels(1)
    wf.setsampwidth(p.get_sample_size(pyaudio.paInt16))
    wf.setframerate(RATE)
    wf.writeframes(data)
    wf.close()
    return filename + '.wav'

if(__name__ == '__main__'):
    listen_for_speech()  # listen to mic.

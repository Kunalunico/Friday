import whisper
import pyaudio
import wave
import streamlit as st
import time

# Audio recording settings
FORMAT = pyaudio.paInt16
CHANNELS = 1
RATE = 44100
CHUNK = 1024
RECORD_SECONDS = 10
WAVE_OUTPUT_FILENAME = "recorded_audio.wav"

def record_audio():
    """Record audio for a fixed duration."""
    audio = pyaudio.PyAudio()
    st.info("Recording audio... Speak now!")
    
    stream = audio.open(format=FORMAT, channels=CHANNELS, rate=RATE, input=True, frames_per_buffer=CHUNK)
    frames = []

    for _ in range(0, int(RATE / CHUNK * RECORD_SECONDS)):
        data = stream.read(CHUNK)
        frames.append(data)

    stream.stop_stream()
    stream.close()
    audio.terminate()

    with wave.open(WAVE_OUTPUT_FILENAME, 'wb') as wf:
        wf.setnchannels(CHANNELS)
        wf.setsampwidth(audio.get_sample_size(FORMAT))
        wf.setframerate(RATE)
        wf.writeframes(b''.join(frames))

    return WAVE_OUTPUT_FILENAME

# def transcribe_audio(file_path):
#     """Transcribe audio using Whisper model."""
#     st.info("Transcribing audio...")
#     model = whisper.load_model("base")
#     result = model.transcribe(file_path)
#     return result.get("text", "")

def transcribe_audio(file_path):
    """Transcribe audio using Whisper model and measure execution time."""
    st.info("Transcribing audio...")

    # Load model
    model = whisper.load_model("base")

    # Start time measurement
    start_time = time.time()

    # Perform transcription
    result = model.transcribe(file_path)

    # End time measurement
    end_time = time.time()

    # Calculate and display duration
    transcription_time = end_time - start_time
    st.success(f"Transcription completed in {transcription_time:.2f} seconds.")

    return result.get("text", "")


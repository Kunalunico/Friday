# import whisper
# from pydub import AudioSegment
# import os
# import sounddevice as sd
# import soundfile as sf
# import numpy as np

# def record_audio(duration: int = 5, sample_rate: int = 44100) -> str:
#     """
#     Record audio for specified duration and save it as a WAV file
    
#     Args:
#         duration (int): Recording duration in seconds
#         sample_rate (int): Sample rate for recording
        
#     Returns:
#         str: Path to the recorded audio file
#     """
#     try:
#         # Record audio
#         recording = sd.rec(int(duration * sample_rate),
#                          samplerate=sample_rate,
#                          channels=1,
#                          dtype='float32')
#         sd.wait()  # Wait until recording is finished
        
#         # Generate filename with timestamp
#         filename = f"recording_{int(time.time())}.wav"
        
#         # Save as WAV file
#         sf.write(filename, recording, sample_rate)
        
#         return filename
#     except Exception as e:
#         raise Exception(f"Error recording audio: {str(e)}")

# def transcribe_audio(file_path: str) -> str:
#     """
#     Transcribe audio file using OpenAI Whisper with automatic language detection
#     """
#     try:
#         # Load the audio file using pydub
#         audio = AudioSegment.from_file(file_path)
        
#         # Export as wav if not already wav (Whisper works best with wav)
#         if not file_path.endswith('.wav'):
#             wav_path = file_path + '.wav'
#             audio.export(wav_path, format='wav')
#             file_to_transcribe = wav_path
#         else:
#             file_to_transcribe = file_path

#         # Load Whisper model and transcribe with language detection
#         model = whisper.load_model("base")
#         result = model.transcribe(file_to_transcribe, task="transcribe")

#         # Clean up temporary wav file if created
#         if file_to_transcribe != file_path:
#             os.remove(file_to_transcribe)

#         return result["text"]
#     except Exception as e:
#         raise Exception(f"Error transcribing audio: {str(e)}")
import whisper
from pydub import AudioSegment
import os
import sounddevice as sd
import soundfile as sf
import numpy as np
import time

def record_audio(duration: int = 5, sample_rate: int = 44100) -> str:
    """
    Record audio for specified duration and save it as a WAV file
    
    Args:
        duration (int): Recording duration in seconds
        sample_rate (int): Sample rate for recording
        
    Returns:
        str: Path to the recorded audio file
    """
    try:
        # Record audio
        recording = sd.rec(int(duration * sample_rate),
                         samplerate=sample_rate,
                         channels=1,
                         dtype='float32')
        sd.wait()  # Wait until recording is finished
        
        # Generate filename with timestamp
        filename = f"recording_{int(time.time())}.wav"
        
        # Save as WAV file
        sf.write(filename, recording, sample_rate)
        
        return filename
    except Exception as e:
        raise Exception(f"Error recording audio: {str(e)}")

def transcribe_audio(file_path: str, model_size: str = "base") -> dict:
    """
    Transcribe audio file using OpenAI Whisper with automatic language detection
    
    Args:
        file_path (str): Path to the audio file
        model_size (str): Whisper model size ('tiny', 'base', 'small', 'medium', 'large')
        
    Returns:
        dict: Dictionary containing transcribed text, detected language, and confidence
    """
    try:
        # Load the audio file using pydub
        audio = AudioSegment.from_file(file_path)
        
        # Export as wav if not already wav (Whisper works best with wav)
        if not file_path.endswith('.wav'):
            wav_path = file_path + '.wav'
            audio.export(wav_path, format='wav')
            file_to_transcribe = wav_path
        else:
            file_to_transcribe = file_path

        # Load Whisper model and transcribe with language detection
        model = whisper.load_model(model_size)
        result = model.transcribe(file_to_transcribe, task="transcribe")

        # Clean up temporary wav file if created
        if file_to_transcribe != file_path:
            os.remove(file_to_transcribe)

        return {
            "text": result["text"],
            "language": result["language"],
            "language_probability": result.get("language_probability", 0.0)
        }
    except Exception as e:
        raise Exception(f"Error transcribing audio: {str(e)}")

def transcribe_with_translation(file_path: str, model_size: str = "base") -> dict:
    """
    Transcribe and translate audio to English
    
    Args:
        file_path (str): Path to the audio file
        model_size (str): Whisper model size
        
    Returns:
        dict: Dictionary containing original text, translated text, and detected language
    """
    try:
        model = whisper.load_model(model_size)
        
        # Transcribe in original language
        original_result = model.transcribe(file_path, task="transcribe")
        
        # Translate to English
        translated_result = model.transcribe(file_path, task="translate")
        
        return {
            "original_text": original_result["text"],
            "translated_text": translated_result["text"],
            "language": original_result["language"],
            "language_probability": original_result.get("language_probability", 0.0)
        }
    except Exception as e:
        raise Exception(f"Error in transcription/translation: {str(e)}")
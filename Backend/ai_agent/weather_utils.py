from typing import Dict, Optional, Union
import aiohttp
import asyncio
from dataclasses import dataclass
import logging
from datetime import datetime

@dataclass
class WeatherCondition:
    temperature_c: float
    temperature_f: float
    condition: str
    humidity: int
    wind_kph: float
    feelslike: float
    wind_dir: str
    pressure: float
    visibility: float
    icon: str
    location: str

class WeatherAPI:
    def __init__(self, api_key: str):
        """
        Initialize WeatherAPI with API key
        
        Args:
            api_key (str): WeatherStack API key
        """
        self.api_key = api_key
        self.base_url = "http://api.weatherstack.com/current"
        
        # Configure logging
        self.logger = logging.getLogger(__name__)
        
        # Extended weather icon mapping
        self._weather_icons = {
            'clear': '☀️',
            'sunny': '☀️',
            'partly cloudy': '⛅',
            'cloudy': '☁️',
            'overcast': '☁️',
            'rain': '🌧️',
            'light rain': '🌦️',
            'heavy rain': '⛈️',
            'thunderstorm': '⛈️',
            'snow': '🌨️',
            'mist': '🌫️',
            'fog': '🌫️',
            'drizzle': '🌧️',
            'shower': '🌧️',
            'sleet': '🌨️',
            'storm': '⛈️',
            'hail': '🌨️',
            'wind': '💨'
        }

    def _get_weather_icon(self, condition: str) -> str:
        """
        Get weather emoji icon based on condition
        
        Args:
            condition (str): Weather condition description
            
        Returns:
            str: Weather emoji icon
        """
        condition = condition.lower()
        
        for key, icon in self._weather_icons.items():
            if key in condition:
                return icon
        return '🌡️'

    def _validate_weather_data(self, data: Dict) -> Optional[str]:
        """
        Validate weather API response data
        
        Args:
            data (Dict): Weather API response data
            
        Returns:
            Optional[str]: Error message if validation fails, None if successful
        """
        required_fields = {
            'location': ['name'],
            'current': [
                'temperature',
                'weather_descriptions',
                'humidity',
                'wind_speed',
                'feelslike',
                'wind_dir',
                'pressure',
                'visibility'
            ]
        }

        for section, fields in required_fields.items():
            if section not in data:
                return f"Missing {section} section in API response"
            
            for field in fields:
                if field not in data[section]:
                    return f"Missing {field} in {section} section"
                
                if data[section][field] is None:
                    return f"Null value for {field} in {section} section"

        return None

    async def _fetch_weather_data(self, location: str) -> Dict:
        """
        Asynchronously fetch weather data from WeatherStack API
        
        Args:
            location (str): Location query string
            
        Returns:
            Dict: Weather API response data
        """
        params = {
            "access_key": self.api_key,
            "query": location
        }

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(self.base_url, params=params) as response:
                    if response.status != 200:
                        error_msg = f"API request failed with status {response.status}"
                        self.logger.error(error_msg)
                        return {"error": error_msg}
                    
                    return await response.json()
                    
        except aiohttp.ClientError as e:
            error_msg = f"Network error: {str(e)}"
            self.logger.error(error_msg)
            return {"error": error_msg}
        except Exception as e:
            error_msg = f"Unexpected error: {str(e)}"
            self.logger.error(error_msg)
            return {"error": error_msg}

    def _process_weather_data(self, weather_data: Dict) -> Union[WeatherCondition, Dict[str, str]]:
        """
        Process raw weather data into WeatherCondition object
        
        Args:
            weather_data (Dict): Raw weather API data
            
        Returns:
            Union[WeatherCondition, Dict[str, str]]: Processed weather data or error
        """
        validation_error = self._validate_weather_data(weather_data)
        if validation_error:
            return {"error": validation_error}

        try:
            current = weather_data["current"]
            location = weather_data["location"]["name"]
            
            temp_c = float(current["temperature"])
            temp_f = temp_c * 9/5 + 32
            
            condition = current["weather_descriptions"][0]
            weather_icon = self._get_weather_icon(condition)

            return WeatherCondition(
                temperature_c=temp_c,
                temperature_f=temp_f,
                condition=condition,
                humidity=current["humidity"],
                wind_kph=float(current["wind_speed"]),
                feelslike=float(current["feelslike"]),
                wind_dir=current["wind_dir"],
                pressure=float(current["pressure"]),
                visibility=float(current["visibility"]),
                icon=weather_icon,
                location=location
            )
            
        except (ValueError, KeyError) as e:
            error_msg = f"Error processing weather data: {str(e)}"
            self.logger.error(error_msg)
            return {"error": error_msg}

    async def get_weather(self, location: str) -> Dict:
        """
        Get weather information for a location
        
        Args:
            location (str): Location query string
            
        Returns:
            Dict: Processed weather information or error
        """
        weather_data = await self._fetch_weather_data(location)
        
        if "error" in weather_data:
            return weather_data
            
        result = self._process_weather_data(weather_data)
        
        if isinstance(result, WeatherCondition):
            return result.__dict__
        return result
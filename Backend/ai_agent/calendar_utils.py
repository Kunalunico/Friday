from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import os.path
import pickle
import logging

class GoogleCalendarAPI:
    def __init__(self):
        self.SCOPES = ['https://www.googleapis.com/auth/calendar']
        self.creds = None
        self.service = None
        # Try to authenticate immediately upon initialization
        try:
            self.authenticate()
        except Exception as e:
            logging.error(f"Authentication failed during initialization: {str(e)}")

    def authenticate(self):
        """Handle Google Calendar authentication"""
        try:
            # Check if token.pickle exists with stored credentials
            if os.path.exists('calendar_token.pickle'):
                with open('calendar_token.pickle', 'rb') as token:
                    self.creds = pickle.load(token)
                logging.info("Loaded credentials from token.pickle")

            # If no valid credentials available, let user log in
            if not self.creds or not self.creds.valid:
                if self.creds and self.creds.expired and self.creds.refresh_token:
                    logging.info("Refreshing expired credentials")
                    self.creds.refresh(Request())
                else:
                    logging.info("Starting new authentication flow")
                    if not os.path.exists('credentials.json'):
                        raise FileNotFoundError("credentials.json not found")
                    
                    flow = InstalledAppFlow.from_client_secrets_file(
                        'credentials.json', self.SCOPES)
                    print("About to run run_local_server")
                    self.creds = flow.run_local_server(port=0)
                    print("Did run_local_server return?")
                    logging.info("New authentication completed")

                # Save credentials for future use
                with open('token.pickle', 'wb') as token:
                    pickle.dump(self.creds, token)
                logging.info("Saved new credentials to token.pickle")

            self.service = build('calendar', 'v3', credentials=self.creds)
            logging.info("Calendar service built successfully")
            
        except Exception as e:
            logging.error(f"Authentication error: {str(e)}")
            raise

    def list_upcoming_events(self, max_results: int=10) -> List[Dict]:
        """List upcoming calendar events"""
        if not self.service:
            self.authenticate()

        now = datetime.now(datetime.timezone.utc).isoformat() + 'Z'
        try:
            events_result = self.service.events().list(
                calendarId='primary',
                timeMin=now,
                maxResults=max_results,
                singleEvents=True,
                orderBy='startTime'
            ).execute()
            events = events_result.get('items',[])

            formatted_events = []
            for event in events:
                start = event['start'].get('dateTime', event['start'].get('date')),
                formatted_events.append({
                    'summary': event['summary'],
                    'start': start,
                    'description': event.get('description', ''),
                    'location': event.get('location', ''),
                })

            return formatted_events
        
        except Exception as e:
            return [{"error": str(e)}]
        
    def create_event(self, summary: str, start_time: str, 
                     end_time: str, description: str = '', 
                     location: str = '', attendees: List[str] = None) -> Dict:
        """Create a new calendar event"""
        try:
            if not self.service:
                self.authenticate()

            event = {
                'summary': summary,
                'location': location,
                'description': description,
                'start': {
                    'dateTime': start_time,
                    'timeZone': 'Asia/Kolkata',
                },
                'end': {
                    'dateTime': end_time,
                    'timeZone': 'Asia/Kolkata',
                }
            }

            if attendees:
                event['attendees'] = [{'email': attendee} for attendee in attendees]

            # Execute the API call synchronously
            created_event = self.service.events().insert(
                calendarId='primary',
                body=event,
                sendUpdates='all'
            ).execute()

            return {
                'success': True,
                'eventId': created_event['id'],
                'link': created_event['htmlLink']
            }

        except Exception as e:
            logging.error(f"Error creating event: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }

    def delete_event(self, event_id: str) -> Dict:
        """Delete a calendar event"""
        if not self.service:
            self.authenticate()

        try:
            self.service.events().delete(
                calendarId='primary',
                eventId=event_id
            ).execute()
            return {'success': True}
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
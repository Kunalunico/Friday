from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from google.auth.transport.requests import Request
from googleapiclient.errors import HttpError
from email.mime.text import MIMEText
import base64
import os.path
import pickle
import logging

class GmailAPI:
    def __init__(self):
        self.SCOPES = ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/gmail.readonly']
        self.creds = None
        self.service = None
        self.setup_logging()
        # Try to authenticate immediately upon initialization
        try:
            self.authenticate()
        except Exception as e:
            logging.error(f"Authentication failed during initialization: {str(e)}")
            self.service = None

    def setup_logging(self):
        """Configure logging settings"""
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s'
        )

    def authenticate(self):
        """Handle Gmail authentication with proper error handling"""
        try:
            # Check if token.pickle exists with stored credentials
            if os.path.exists('gmail_token.pickle'):
                with open('gmail_token.pickle', 'rb') as token:
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
                        raise FileNotFoundError("credentials.json not found in the current directory")
                    
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

            self.service = build('gmail', 'v1', credentials=self.creds)
            logging.info("Gmail service built successfully")
            return True

        except FileNotFoundError as e:
            logging.error(f"Authentication error - File not found: {str(e)}")
            raise
        except Exception as e:
            logging.error(f"Authentication error: {str(e)}")
            raise

    def send_email(self, recipient: str, subject: str, body: str) -> str:
        """
        Send an email using Gmail API
        
        Args:
            recipient (str): Email address of the recipient
            subject (str): Email subject
            body (str): Email body content
            
        Returns:
            str: Success or error message
        """
        try:
            if not self.service:
                raise ValueError("Gmail service not initialized. Please check authentication.")

            message = MIMEText(body)
            message['to'] = recipient
            message['subject'] = subject
            
            encoded_message = base64.urlsafe_b64encode(message.as_bytes()).decode()
            create_message = {'raw': encoded_message}

            # Send the email
            sent_message = self.service.users().messages().send(
                userId="me", 
                body=create_message
            ).execute()

            logging.info(f"Email sent successfully to {recipient}")
            return f"Email sent successfully to {recipient}"

        except HttpError as error:
            error_message = f"Failed to send email: {str(error)}"
            logging.error(error_message)
            return error_message
        except Exception as e:
            error_message = f"An error occurred while sending email: {str(e)}"
            logging.error(error_message)
            return error_message

    def list_emails(self, max_results: int = 5) -> list:
        """
        List recent emails from Gmail inbox
        
        Args:
            max_results (int): Maximum number of emails to retrieve
            
        Returns:
            list: List of email snippets or error message
        """
        try:
            if not self.service:
                raise ValueError("Gmail service not initialized. Please check authentication.")

            # Validate max_results
            max_results = min(max(1, max_results), 50)  # Ensure between 1 and 50

            results = self.service.users().messages().list(
                userId="me", 
                maxResults=max_results
            ).execute()

            messages = results.get('messages', [])
            email_list = []

            for message in messages:
                msg = self.service.users().messages().get(
                    userId="me", 
                    id=message['id']
                ).execute()
                snippet = msg.get('snippet', '')
                email_list.append(snippet)

            logging.info(f"Successfully retrieved {len(email_list)} emails")
            return email_list

        except HttpError as error:
            error_message = f"Failed to retrieve emails: {str(error)}"
            logging.error(error_message)
            return [error_message]
        except Exception as e:
            error_message = f"An error occurred while retrieving emails: {str(e)}"
            logging.error(error_message)
            return [error_message]

    def is_service_initialized(self) -> bool:
        """Check if the Gmail service is properly initialized"""
        return self.service is not None
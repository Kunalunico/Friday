from openai import OpenAI
import json
from ai_agent.weather_utils import WeatherAPI
from ai_agent.calendar_utils import GoogleCalendarAPI
from ai_agent.gmail_utils import GmailAPI
from datetime import datetime, timedelta
import asyncio
import pytz
from typing import Optional, List
import logging

class AIAssistant:
    def __init__(self, openai_api_key, weather_api_key):
        self.client = OpenAI(api_key=openai_api_key)
        self.weather_api = WeatherAPI(weather_api_key)
        self.calendar_api = GoogleCalendarAPI()
        self.gmail_service = GmailAPI()
        self.default_timezone = pytz.timezone('Asia/Kolkata')  # Set your default timezone here

        # Add email mapping
        self.email_mapping = {
            "[Name]": "[Email ID]",
            "[Name]": "[Email ID]",
            "[Name]": "[Email ID]"
        }

        # Initialize the function schema
        self.weather_function = {
            "name": "get_weather",
            "description": "Get the current weather in a given location",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "The city and state, e.g. San Francisco, CA",
                    },
                },
                "required": ["location"]
            }
        }

        # Initialize the gmail function schema
        self.gmail_function = [
            {
            "name": "send_email",
            "description": "Send an email to a recipient",
            "parameters": {
                "type": "object",
                "properties": {
                    "recipient": {
                        "type": "string",
                        "description": "Email address of the recipient"
                    },
                    "subject": {
                        "type": "string",
                        "description": "Email subject"
                    },
                    "body": {
                        "type": "string",
                        "description": "Email body"
                    }
                },
                "required": ["recipient", "subject", "body"]
            }
        },
        {
            "name": "list_emails",
            "description": "List recent emails",
            "parameters": {
                "type": "object",
                "properties": {
                    "max_results": {
                        "type": "integer",
                        "description": "Maximum number of emails to return"
                    }
                }
            }
        }
]

        # Initialize the calendar function schema
        self.calendar_function = [
            {
        "name": "list_events",
        "description": "List upcoming calendar events",
        "parameters": {
            "type": "object",
            "properties": {
                "max_results": {
                    "type": "integer",
                    "description": "Maximum number of events to return"
                }
            }
        }
    },
    {
        "name": "create_event",
        "description": "Create a new calendar event",
        "parameters": {
            "type": "object",
            "properties": {
                "summary": {
                    "type": "string",
                    "description": "Event title"
                },
                "start_time": {
                    "type": "string",
                    "description": "Event start time in IST format"
                },
                "end_time": {
                    "type": "string",
                    "description": "Event end time in ISO format"
                },
                "description": {
                    "type": "string",
                    "description": "Event description"
                },
                "location": {
                    "type": "string",
                    "description": "Event location"
                },
                "attendees": {
                    "type": "array",
                    "items": {
                        "type": "string"
                    },
                    "description": "List of attendees"
                }
            },
            "required": ["summary", "start_time", "end_time"]
        }
    }
]

    async def classify_query(self, user_input: str) -> str:
        classify_prompt = """
        Strictly classify this query into one of these categories: weather, gmail, calendar, or general
        Rules for classification:
        - 'gmail': Any query that involves:
            * Starts with phrases like "send an email", "Send email", "write an email", "compose email"
            * Any request to check, read, show, list or view emails
            * Any mention of inbox, unread messages, or recent emails
            * Contains email-related keywords: subject, body, message, forward, reply
            * Contains email addresses or names with @domain.com
            * Contains verbs like "send", "mail", "email", "write" followed by "to" or a recipient
            * Any query about email status, drafts, or attachments
            * Questions about emails from specific senders or about specific topics
            * Requests to check spam or trash folders
            * Any query containing words: inbox, compose, draft, sent, folder, spam
            
        - 'calendar': Any query that involves:
            * Creating/scheduling new calendar events or meetings
            * Specifically asks to "schedule", "set up", or "arrange" a meeting
            * Checking calendar availability
            * Managing or updating existing calendar events
            * Must involve explicit calendar management (not just mentioning a meeting in an email)

        - 'weather': Any query that involves:
            * Current weather conditions
            * Weather forecasts
            * Temperature queries
            * Contains words like: weather, temperature, rain, forecast, sunny

        - 'general': Anything that doesn't clearly match the above categories

        Priority Rules:
        1. If the query contains ANY email-related keywords or actions, classify as 'gmail'
        2. Email actions take precedence over meeting mentions
        3. When in doubt between email and calendar, choose 'gmail' if there's any email context

        Query: {query}

        Return only one word without any punctuation or explanation: weather, gmail, calendar, or general
        """
        response = self.client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[{
                "role": "user",
                "content": classify_prompt.format(query=user_input)
            }]
        )
        result = response.choices[0].message.content.lower().strip()
        logging.info(f"Query '{user_input}' classified as: {result}")
        return result
    
    def parse_datetime_to_iso(self, date_str: str, time_str: str) -> str:
        """
        Convert date and time strings to ISO format with debug logging
        
        Args:
            date_str (str): Date string (e.g., '2025-01-15')
            time_str (str): Time string (e.g., '4:00 PM')
        
        Returns:
            str: ISO formatted datetime string in Asia/Kolkata timezone
        """
        try:
            # Remove any extra spaces and clean up the time string
            time_str = ' '.join(time_str.strip().split())
            
            # Parse the time first
            try:
                # For 12-hour format (e.g., "4:00 PM")
                time_obj = datetime.strptime(time_str.strip(), "%I:%M %p").time()
            except ValueError:
                # For 24-hour format (e.g., "16:00")
                time_obj = datetime.strptime(time_str.strip(), "%H:%M").time()
            
            # Parse the date
            date_obj = datetime.strptime(date_str, "%Y-%m-%d").date()
            
            # Combine date and time
            dt = datetime.combine(date_obj, time_obj)
            
            # Set timezone to IST
            ist = pytz.timezone('Asia/Kolkata')
            dt = ist.localize(dt)
            
            # Convert to ISO format
            return dt.isoformat()
            
        except Exception as e:
            logging.error(f"Date parsing error: {str(e)}")
            logging.error(f"Input date: {date_str}, Input time: {time_str}")
            raise ValueError(f"Could not parse date/time. Date: {date_str}, Time: {time_str}")
        
    def parse_datetime_to_iso(self, date_str: str, time_str: str) -> str:
        """
        Convert date and time strings to ISO format with debug logging
        
        Args:
            date_str (str): Date string (e.g., '2025-01-15')
            time_str (str): Time string (e.g., '4:00 PM')
        
        Returns:
            str: ISO formatted datetime string in Asia/Kolkata timezone
        """
        try:
            # Remove any extra spaces and clean up the time string
            time_str = ' '.join(time_str.strip().split())
            
            # Parse the time first
            try:
                # For 12-hour format (e.g., "4:00 PM")
                time_obj = datetime.strptime(time_str.strip(), "%I:%M %p").time()
            except ValueError:
                # For 24-hour format (e.g., "16:00")
                time_obj = datetime.strptime(time_str.strip(), "%H:%M").time()
            
            # Parse the date
            date_obj = datetime.strptime(date_str, "%Y-%m-%d").date()
            
            # Combine date and time
            dt = datetime.combine(date_obj, time_obj)
            
            # Set timezone to IST
            ist = pytz.timezone('Asia/Kolkata')
            dt = ist.localize(dt)
            
            # Convert to ISO format
            return dt.isoformat()
            
        except Exception as e:
            logging.error(f"Date parsing error: {str(e)}")
            logging.error(f"Input date: {date_str}, Input time: {time_str}")
            raise ValueError(f"Could not parse date/time. Date: {date_str}, Time: {time_str}")
        
    async def handle_gmail_query(self, user_input: str) -> str:
        try:
            print("Processing Gmail query...")

            # Validate Gmail service initialization
            if not self.gmail_service or not self.gmail_service.service:
                logging.error("Gmail service not initialized")
                return "Error: Gmail service is not available. Please check your authentication."
            
            # Add debug print for function schema
            print("Gmail function schema:", json.dumps(self.gmail_function, indent=2))
            
            # Define system guidance for email handling
            messages = [
                {
                    "role": "system",
                    "content": """You are an AI assistant with access to Gmail. When handling email-related queries:
                    1. Determine whether the user wants to send an email or retrieve emails.
                    2. Extract necessary details for sending emails (recipient, subject, and body).
                    3. Ensure clear and professional formatting of email responses.
                    4. For retrieving emails, list recent messages with concise summaries."""
                },
                {"role": "user", "content": user_input}
            ]

            print("Making OpenAI API call for function selection")
            response = self.client.chat.completions.create(
                model="gpt-4.1-mini",
                messages=messages,
                tools=[{"type": "function", "function": func} for func in self.gmail_function]
            )

            if not response.choices or not response.choices[0].message.tool_calls:
                logging.error("No function call received from OpenAI")
                return "Error: Unable to process the email request. Please try again."
        
            print("OpenAI response received")
            tool_call = response.choices[0].message.tool_calls[0]
            function_name = tool_call.function.name
            print(f"Selected function: {function_name}")

            try:
                function_args = json.loads(tool_call.function.arguments)
            except json.JSONDecodeError as e:
                logging.error(f"Failed to parse function arguments: {e}")
                return "Error: Invalid function arguments received."

            if function_name == "send_email":
                # Ensure all required arguments are present
                required_fields = ["recipient", "subject", "body"]
                missing_fields = [field for field in required_fields if not function_args.get(field)]

                if missing_fields:
                    error_msg = f"Missing required fields: {', '.join(missing_fields)}"
                    logging.error(error_msg)
                    return f"Error: {error_msg}"
                
                # Validate email format
                recipient = function_args["recipient"]
                if not '@' in recipient:
                    logging.error(f"Invalid email format: {recipient}")
                    return "Error: Invalid email address format."
                
                try:
                    # Call the Gmail API with proper service reference
                    result = self.gmail_service.send_email(
                        recipient,
                        function_args["subject"],
                        function_args["body"]
                    )

                    if isinstance(result, str) and "successfully" in result.lower():
                        return f"Email sent successfully to {recipient} with subject: '{function_args['subject']}'"
                    else:
                        logging.error(f"Failed to send email: {result}")
                        return f"Failed to send email: {result}"

                except Exception as e:
                    logging.error(f"Error sending email: {str(e)}")
                    return f"Failed to send email: {str(e)}"

            elif function_name == "list_emails":
                try:
                    max_results = min(function_args.get("max_results", 5), 10)
                    emails = self.gmail_service.list_emails(max_results)

                    if not emails:
                        return "No recent emails found."
                    
                    if isinstance(emails, str) and "error" in emails.lower():
                        logging.error(f"Error listing emails: {emails}")
                        return f"Error listing emails: {emails}"
                    
                    email_summaries = "\n".join([f"- {email}" for email in emails])
                    return f"Recent Emails:\n{email_summaries}"
                
                except Exception as e:
                    logging.error(f"Error listing emails: {str(e)}")
                    return f"Failed to retrieve emails: {str(e)}"

            return "Unsupported Gmail operation."

        except Exception as e:
            logging.error(f"Gmail query error: {str(e)}")
            return f"An error occurred while processing Gmail query: {str(e)}"

        
    async def handle_calendar_query(self, user_input: str) -> str:
        try:
            print("Processing calendar query....")
            # Extract potential name from the query
            email_parts = user_input.split('with ')
            if len(email_parts) > 1:
                attendee_email = email_parts[1].split(' on ')[0].strip()
                attendee_emails = [attendee_email]
            else:
                return "No email address found in the query"

            messages = [
                {
                    "role": "system",
                    "content": """You are an AI assistant with access to Google Calendar. When scheduling meetings:
                    1. Extract exact date and time from the request
                    2. Convert times to ISO format (YYYY-MM-DDTHH:MM:SS)
                    3. Include all mentioned attendees
                    4. Keep the original specified time (don't modify the requested time)
                    5. Create clear and professional meeting summaries"""
                },
                {"role": "user", "content": user_input}
            ]

            print("Making OpenAI API call for function selection")
            response = self.client.chat.completions.create(
                model="gpt-4.1-mini",
                messages=messages,
                tools=[{
                    "type": "function",
                    "function": func
                } for func in self.calendar_function]
            )

            print("OpenAI response received")
            tool_call = response.choices[0].message.tool_calls[0]
            function_name = tool_call.function.name
            print(f"Selected function: {function_name}")
            function_args = json.loads(tool_call.function.arguments)

            if function_name == "create_event":
                # Parse the date and time correctly
                date_match = user_input.split("on ")[-1].split(" from ")[0]
                time_parts = user_input.split("from ")[-1].split(" to ")
                start_time = time_parts[0]
                end_time = time_parts[1].split(" ?")[0]  # Remove the question mark
                
                # Create proper ISO format
                start_iso = self.parse_datetime_to_iso(date_match, start_time)
                end_iso = self.parse_datetime_to_iso(date_match, end_time)

                # Update the function arguments
                function_args.update({
                    "start_time": start_iso,
                    "end_time": end_iso,
                    "attendees": attendee_emails,
                    "summary": "Meeting with " + attendee_emails[0].split('@')[0]
                })

                # Call the calendar API synchronously
                result = self.calendar_api.create_event(**function_args)

                if not result.get('success', False):
                    error_msg = result.get('error', 'Unknown error')
                    logging.error(f"Calendar API error: {error_msg}")
                    return f"Calendar error: {error_msg}"

                # Format success response
                response_message = (
                    f"Meeting scheduled successfully!\n"
                    f"Title: {function_args['summary']}\n"
                    f"Date: {date_match}\n"
                    f"Time: {start_time} - {end_time}\n"
                    f"Attendees: {', '.join(attendee_emails)}\n"
                    f"Calendar link: {result.get('link', 'No link available')}"
                )

                return response_message

            elif function_name == "list_events":
                max_results = function_args.get("max_results", 10)
                events = self.calendar_api.list_upcoming_events(max_results)
                
                if not events:
                    return "You don't have any upcoming events scheduled."
                    
                return json.dumps(events, indent=2)

            return "Unsupported calendar operation"

        except Exception as e:
            logging.error(f"Calendar query error: {str(e)}")
            return f"An error occurred while processing calendar query: {str(e)}"

    async def handle_weather_query(self, user_input: str) -> str:
        """Process weather-related queries"""
        messages = [{"role": "user", "content": user_input}]
        
        response = self.client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=messages,
            tools=[{
                "type": "function",
                "function": self.weather_function
            }],
            tool_choice={"type": "function", "function": {"name": "get_weather"}}
        )

        tool_call = response.choices[0].message.tool_calls[0]
        function_args = json.loads(tool_call.function.arguments)
    
        # Await the async weather API call
        weather_info = await self.weather_api.get_weather(function_args["location"])
        
        if "error" in weather_info:
            return f"Sorry, I couldn't get the weather information: {weather_info['error']}"
        
        messages.extend([
            {
                "role": "assistant",
                "content": None,
                "tool_calls": [tool_call]
            },
            {
                "role": "tool",
                "tool_call_id": tool_call.id,
                "name": "get_weather",
                "content": json.dumps(weather_info)
            }
        ])
        
        final_response = self.client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=messages
        )
        
        response_content = final_response.choices[0].message.content
        if 'icon' in weather_info:
            response_content = f"{weather_info['icon']} {response_content}"
        return response_content

    def handle_general_query(self, user_input: str) -> str:
        """Process non-weather queries"""
        response = self.client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[{"role": "user", "content": user_input}]
        )
        return response.choices[0].message.content

    async def generate_response(self, message, google_creds=None) -> str:
        try:
            print(f"Processing user input: {message}")  # Use 'message' instead of 'user_input'
            query_type = await self.classify_query(message)
            print(f"Query classified as: {query_type}")

            if query_type == 'weather':
                print("Entering weather handler")
                return await self.handle_weather_query(message)
            elif query_type == 'calendar':
                print("Entering calendar handler")
                return await self.handle_calendar_query(message)
            elif query_type == 'gmail':
                print("Entering Gmail handler")
                return await self.handle_gmail_query(message)
            else:
                print("Entering general handler")
                return self.handle_general_query(message)
        except Exception as e:
            logging.error(f"Error generating response: {str(e)}")
            return f"An error occurred: {str(e)}"
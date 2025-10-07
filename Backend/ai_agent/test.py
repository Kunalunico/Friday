from ai_agent.gmail_utils import GmailAPI

def test_gmail():
    gmail = GmailAPI()
    # Force authentication
    gmail.authenticate()
    print("Gmail authentication completed")

if __name__ == "__main__":
    test_gmail()
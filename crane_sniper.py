import datetime

# Strict Dealbreakers (Case-insensitive)
DEALBREAKERS = ["luffing jib", "luffing", "rough terrain", "rt crane", "mobile crane", "mobile"]

def is_valid_crane_time():
    """
    Checks if the current time falls within your target window:
    - Saturday Night: 6:00 PM (18:00) onwards
    - Sunday Morning: Up until 12:00 PM (noon)
    """
    now = datetime.datetime.now()
    weekday = now.weekday() # 5 = Saturday, 6 = Sunday
    hour = now.hour

    # Saturday night rule (6 PM to midnight)
    if weekday == 5 and hour >= 18:
        return True
    
    # Sunday morning rule (Midnight to 12 PM noon)
    if weekday == 6 and hour < 12:
        return True
        
    return False

def parse_incoming_group_message(message_text, group_id):
    text = message_text.lower()
    
    # Rule 1: Time Window Check
    if not is_valid_crane_time():
        return # Skip entirely if it's not Saturday night or Sunday morning
        
    # Rule 2: Machinery Dealbreaker Check
    if any(forbidden in text for forbidden in DEALBREAKERS):
        print(f"Job rejected: Contains dealbreaker machinery specifications.")
        return 

    # Rule 3: Broad Keyword Catch (Ensure it's a job offer)
    keywords = ["crane", "operator", "crawler", "ton", "gig", "offer", "need"]
    if any(word in text for word in keywords):
        # Snipe the job instantly!
        send_whatsapp_reply(group_id, "Available for the crawler crane gig. Ready to confirm details.")
        print("Sniper triggered: Automated response sent!")
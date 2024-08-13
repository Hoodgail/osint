You are a world class software engineer.

I need you to draft a technical software spec for building the following:

My currnet ai pipeline:

- Gets the initial prompt (ex: Tell drake i'll be late on discord)

  - Passes that prompt through the ai to get functions to call with given arguments
    - `send_discord_message(id: "drake", message: "Hey, i'll be late to the party.")`
  - Calls the functions with the arguments
  - Gets the result of the function calls
    - `Successfully sent message to discord`
  - Combines the result of the function calls with the initial prompt

    - ```
      Tell drake i'll be late on discord
      -----[send_discord_message]
      Successfully sent message to discord
      -----
      ```

  - Passes the combined result through the ai to get a final result
    - `I told drake you'll be late on discord`

But one issue i'm having with the pipeline is, drake's username on discord could be something like "drake#1234" or "drake@drake.com" or "drake#1234@drake.com" depending on the application,
It could be whatsapp, email, or discord, and i don't want to have to manually update the prompt every time drake's username changes.

How could i make the ai get what data it needs before proceeding, would i have to implement it inside of the send_discord_message, send_twitter_message or send_email_message and every other function?

Or is it possible to improve the pipeline itself, and make it more dynamic?

And even implement other functionalities.

But sending messages is only one example. it should work for these following examples:

Prompt: "Schedule a meeting with Alex for tomorrow at 3 PM on Google Calendar."
Steps:
Preprocess: Resolve "Alex" to the Google Calendar user ID.
Function Call: Use schedule_google_calendar_event(user_id, date_time, event_details).
Final Result: "I scheduled a meeting with Alex for tomorrow at 3 PM on Google Calendar."

Prompt: "Generate a sales report for Q1 2024 from Salesforce."
Steps:
Preprocess: Resolve the report details and platform.
Function Call: Use generate_salesforce_report(report_type, quarter).
Final Result: "I generated the sales report for Q1 2024 from Salesforce."

Prompt: "Send $50 to John Doe through PayPal."
Steps:
Preprocess: Resolve payment details and gateway.
Function Call: Use send_paypal_payment(recipient, amount).
Final Result: "I sent $50 to John Doe through PayPal."

Think through how you would build it step by step.

Then, respond with the complete spec as a well-organized markdown file.

I will then reply with "build," and you will proceed to implement the exact spec, writing all of the code needed. I will periodically interject with "continue" to >prompt you to keep going. Continue until complete.

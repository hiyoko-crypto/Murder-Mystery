import openai

openai.api_key = "AIzaSyBBiHjCu6PkYEMrAK8Tu1BfcFCDIGW-Jhg"
openai.api_base = "http://localhost:11434/v1"

response = openai.ChatCompletion.create(
    model="llama-3.1-8b-instant",
    messages=[
        {"role": "system", "content": "You are a murder mystery author. Respond ONLY with JSON."},
        {"role": "user", "content": "Create a murder mystery with a victim named John Smith. Return JSON with keys: victim_name, murder_weapon, killer_name."}
    ],
    max_tokens=500,
    temperature=0.7
)

print(response['choices'][0]['message']['content'])
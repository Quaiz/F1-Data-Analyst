import g4f
from g4f.client import Client

def test_chat():
    messages = [{"role": "user", "content": "Say hello in 5 words"}]
    client = Client()
    
    providers = [getattr(g4f.Provider, name) for name in dir(g4f.Provider) if not name.startswith("_")]
    
    for provider in providers:
        try:
            if not getattr(provider, "working", False): continue
            if getattr(provider, "needs_auth", False): continue
            
            name = provider.__name__
            print(f"Testing {name}...")
            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                provider=provider,
                messages=messages,
                timeout=8
            )
            text = response.choices[0].message.content
            if text and len(text) > 5 and "does not exist" not in text and "error" not in text.lower():
                print(f"SUCCESS [{name}]: {text[:80]}")
        except Exception as e:
            print(f"FAIL [{name}]: {str(e)[:60]}")

test_chat()

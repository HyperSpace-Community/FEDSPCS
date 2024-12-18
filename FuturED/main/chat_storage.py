import json
from datetime import datetime
from pathlib import Path

class ChatStorage:
    def __init__(self, storage_dir="chat_history"):
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(exist_ok=True)
    
    def save_message(self, chat_id: str, message: str, response: str):
        chat_file = self.storage_dir / f"{chat_id}.json"
        
        if chat_file.exists():
            with open(chat_file, 'r') as f:
                chat_data = json.load(f)
        else:
            chat_data = {
                'id': chat_id,
                'timestamp': datetime.now().isoformat(),
                'messages': []
            }
        
        chat_data['messages'].append({
            'timestamp': datetime.now().isoformat(),
            'message': message,
            'response': response
        })
        
        with open(chat_file, 'w') as f:
            json.dump(chat_data, f, indent=2)
    
    def get_chat_history(self):
        chats = []
        for chat_file in self.storage_dir.glob('*.json'):
            with open(chat_file, 'r') as f:
                chat_data = json.load(f)
                # Get first message as title, or use default
                title = chat_data['messages'][0]['message'][:50] if chat_data['messages'] else 'New Chat'
                chats.append({
                    'id': chat_data['id'],
                    'timestamp': chat_data['timestamp'],
                    'title': title
                })
        return sorted(chats, key=lambda x: x['timestamp'], reverse=True)
    
    def get_chat(self, chat_id: str):
        chat_file = self.storage_dir / f"{chat_id}.json"
        if not chat_file.exists():
            return None
        
        with open(chat_file, 'r') as f:
            return json.load(f)
    
    def export_chat(self, chat_id: str) -> str:
        chat_data = self.get_chat(chat_id)
        if not chat_data:
            return "Chat not found"
        
        export_text = f"Chat Export - {chat_data['timestamp']}\n\n"
        for msg in chat_data['messages']:
            export_text += f"User: {msg['message']}\n"
            export_text += f"Assistant: {msg['response']}\n\n"
        
        return export_text 
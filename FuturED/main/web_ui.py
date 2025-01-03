from flask import Flask, render_template, request, jsonify, current_app
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from cachetools import TTLCache
from main import process_message, get_current_datetime, lazy_gmail_toolkit, local_rag_tool, google_calendar_toolkit, table_data, top_level_agent
import threading
import queue
import logging
from concurrent.futures import ThreadPoolExecutor
import signal
import sys

# Configure logging with more detail
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['MAX_WORKERS'] = 3  # Adjust based on your needs
app.config['RESPONSE_CACHE_TTL'] = 300  # 5 minutes cache

# Initialize rate limiter
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["100 per minute", "5 per second"]
)

# Initialize response cache
response_cache = TTLCache(maxsize=100, ttl=app.config['RESPONSE_CACHE_TTL'])

# Use ThreadPoolExecutor instead of single thread
executor = ThreadPoolExecutor(max_workers=app.config['MAX_WORKERS'])
message_queue = queue.Queue()
response_queue = queue.Queue()

def cleanup():
    """Cleanup resources on shutdown"""
    logger.info("Shutting down thread pool...")
    executor.shutdown(wait=False)
    
    # Cleanup resources from main.py
    if hasattr(lazy_gmail_toolkit, 'gmail_toolkit'):
        logger.info("Cleaning up Gmail toolkit...")
    
    if hasattr(local_rag_tool, 'vector_store'):
        logger.info("Cleaning up RAG tool...")
        local_rag_tool.clear_memory()
    
    sys.exit(0)

def process_message_with_retry(message, max_retries=3):
    """Process message with retry logic"""
    for attempt in range(max_retries):
        try:
            current_time = get_current_datetime()
            timestamped_message = f"{message} (Current time: {current_time})"
            
            # Check cache first
            cache_key = hash(timestamped_message)
            if cache_key in response_cache:
                logger.info("Cache hit for message")
                return response_cache[cache_key]
            
            logger.info(f"Processing message (attempt {attempt + 1}): {timestamped_message}")
            
            # Use top_level_agent directly
            response = top_level_agent.run(timestamped_message)
            
            # Format response if needed
            if not any(identifier in response.lower() for identifier in ['latmo', 'futured spaces']):
                response = f" {response}"
            
            # Cache the response
            response_cache[cache_key] = response
            return response
            
        except Exception as e:
            logger.error(f"Error processing message (attempt {attempt + 1}): {str(e)}")
            if attempt == max_retries - 1:
                raise
            
def process_message_queue():
    """Process messages from queue with improved error handling"""
    while True:
        message = None
        try:
            # Get message from queue with timeout
            message = message_queue.get(timeout=1)  
            
            # Process message
            future = executor.submit(process_message_with_retry, message)
            response = future.result(timeout=300)  # 5 minute timeout
            response_queue.put(response)
            
        except queue.Empty:
            # Just continue if queue is empty, don't call task_done()
            continue
        except Exception as e:
            logger.error(f"Error in message queue processing: {str(e)}")
            # Only put error response if we actually got a message
            if message is not None:
                response_queue.put(f"Error: {str(e)}")
        finally:
            # Only mark task as done if we actually got a message
            if message is not None:
                message_queue.task_done()

# Start the message processing thread
processing_thread = threading.Thread(target=process_message_queue, daemon=True)
processing_thread.start()

@app.route('/')
@limiter.limit("30 per minute")  # Add rate limiting to home page
def home():
    try:
        return render_template('chat.html')
    except Exception as e:
        logger.error(f"Error rendering template: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/send_message', methods=['POST'])
@limiter.limit("20 per minute")  # Add rate limiting to API endpoint
def send_message():
    try:
        message = request.json.get('message', '').strip()
        if not message:
            return jsonify({'error': 'No message provided'}), 400
        
        logger.info(f"Received message: {message[:100]}...")  # Log truncated message
        message_queue.put(message)
        
        try:
            response = response_queue.get(timeout=300)
            logger.info(f"Generated response: {response[:100]}...")
            return jsonify({'response': response})
        except queue.Empty:
            logger.error("Response timeout")
            return jsonify({'error': 'Response timeout'}), 408
            
    except Exception as e:
        logger.error(f"Error in send_message: {str(e)}", exc_info=True)
        return jsonify({'error': 'Internal server error'}), 500

@app.errorhandler(Exception)
def handle_error(error):
    logger.error(f"Unhandled error: {str(error)}", exc_info=True)
    return jsonify({'error': 'Internal server error'}), 500

# Register cleanup handler
signal.signal(signal.SIGINT, lambda s, f: cleanup())
signal.signal(signal.SIGTERM, lambda s, f: cleanup())

if __name__ == '__main__':
    app.run(debug=False, port=5000, threaded=True) 
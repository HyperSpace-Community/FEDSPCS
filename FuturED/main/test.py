import streamlit as st
import json
import os
import shutil
from datetime import datetime
import chainlit as cl
from langchain import hub
from langchain.agents import AgentType, Tool, initialize_agent
from langchain.memory import ConversationBufferMemory
from langchain_huggingface import HuggingFaceEmbeddings
from langchain.text_splitter import CharacterTextSplitter
from langchain_community.agent_toolkits import GmailToolkit
from langchain_community.tools import WikipediaQueryRun, DuckDuckGoSearchRun
from langchain.prompts import PromptTemplate
from langchain_community.tools.gmail.utils import build_resource_service, get_gmail_credentials
from langchain_community.utilities import WikipediaAPIWrapper
from langchain_community.vectorstores import Chroma
from langchain_groq import ChatGroq
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.callbacks.tracers import LangChainTracer
from langchain.callbacks.manager import CallbackManager
from langsmith import Client
from langchain.callbacks import StdOutCallbackHandler

# LangSmith setup
client = Client()
tracer = LangChainTracer(project_name="OMTAL")
handler = StdOutCallbackHandler()
callback_manager = CallbackManager([tracer, handler])


@cl.on_chat_start
def math_chatbot():
    def init_llms():
        return {
            'top_level': ChatGoogleGenerativeAI(temperature=0.3, model="gemini-1.5-pro"),
            'wikipedia': ChatGroq(temperature=0.2, model="llama-3.1-8b-instant"),
            'search': ChatGroq(temperature=0.2, model="llama-3.1-8b-instant"),
            'gmail': ChatGoogleGenerativeAI(temperature=0.3, model="gemini-1.5-pro"),
            'rag': ChatGroq(temperature=0.1, model="Gemma2-9b-It")
        }

    llms = init_llms()

    # llama3-groq-70b-8192-tool-use-preview Gemma2-9b-It gemini-1.5-pro gemini-1.5-flash   models/gemini-1.0-pro-001
    # llama-3.1-70b-versatile  llama-3.1-405b-reasoning  llama-3.1-8b-instant

    memory = ConversationBufferMemory(memory_key="chat_history", return_messages=True)

    LLMama = lambda x: ChatGroq(temperature=0, model="llama3-groq-8b-8192-tool-use-preview",
                                messages=[{"role": "user", "content": x}])
    LLM_tool = Tool(name="AI", func=lambda x: LLMama(x).content, description="Use when no other tool is suitable.")
    datetime_tool = Tool(name="Datetime", func=lambda x: datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                         description="Fetches current date and time.")
    wikipedia = WikipediaQueryRun(api_wrapper=WikipediaAPIWrapper())
    wikipedia_tool = Tool(name="Wikipedia", func=wikipedia.run, description="Searches Wikipedia for information.")
    search = DuckDuckGoSearchRun()
    duckduckgo_tool = Tool(name='DuckDuckGo Search', func=search.run,
                           description="Searches the internet for information.")

    # Gmail toolkit setup
    @st.cache_resource
    def setup_gmail_toolkit():
        credentials = get_gmail_credentials(
            token_file="token.json",
            scopes=["https://mail.google.com/"],
            client_secrets_file="credentials.json",
        )
        api_resource = build_resource_service(credentials=credentials)
        return GmailToolkit(api_resource=api_resource)

    gmail_toolkit = setup_gmail_toolkit()

    # Wrapper functions for Gmail tools

    # Gmail tool wrapper functions
    def create_gmail_draft_wrapper(input_str):
        input_dict = json.loads(input_str)
        create_draft_tool = [tool for tool in gmail_toolkit.get_tools() if tool.name == "create_gmail_draft"][0]
        return create_draft_tool.run(input_dict)

    def send_gmail_message_wrapper(input_str):
        input_dict = json.loads(input_str)
        send_message_tool = [tool for tool in gmail_toolkit.get_tools() if tool.name == "send_gmail_message"][0]
        return send_message_tool.run(input_dict)

    def search_gmail_wrapper(input_str):
        input_dict = json.loads(input_str)
        search_tool = [tool for tool in gmail_toolkit.get_tools() if tool.name == "search_gmail"][0]
        return search_tool.run(input_dict)

    def get_gmail_message_wrapper(input_str):
        input_dict = json.loads(input_str)
        get_message_tool = [tool for tool in gmail_toolkit.get_tools() if tool.name == "get_gmail_message"][0]
        return get_message_tool.run(input_dict)

    def get_gmail_thread_wrapper(input_str):
        input_dict = json.loads(input_str)
        get_thread_tool = [tool for tool in gmail_toolkit.get_tools() if tool.name == "get_gmail_thread"][0]
        return get_thread_tool.run(input_dict)

    # Create Tool objects for Gmail functions (unchanged)
    gmail_tools = [
        Tool(name="CreateGmailDraft", func=create_gmail_draft_wrapper, description="Creates a draft email in Gmail."),
        Tool(name="SendGmailMessage", func=send_gmail_message_wrapper, description="Sends an email through Gmail."),
        Tool(name="SearchGmail", func=search_gmail_wrapper, description="Searches Gmail messages."),
        Tool(name="GetGmailMessage", func=get_gmail_message_wrapper, description="Retrieves a specific Gmail message."),
        Tool(name="GetGmailThread", func=get_gmail_thread_wrapper, description="Retrieves a Gmail thread.")
    ]

    class LocalRAGTool:
        def __init__(self):
            self.embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
            self.persist_directory = os.path.join(os.getcwd(), "local_chroma_db")
            self.vector_store = Chroma(
                "local_memory_store",
                embedding_function=self.embeddings,
                persist_directory=self.persist_directory
            )
            self.llm = ChatGroq(temperature=0, model="Llama3-70b-8192")
            self.text_splitter = CharacterTextSplitter(
                separator="\n",
                chunk_size=1000,
                chunk_overlap=200,
                length_function=len
            )

        def add_to_memory(self, input_str):
            input_dict = json.loads(input_str)
            text = input_dict.get('text', '')
            chunks = self.text_splitter.split_text(text)
            self.vector_store.add_texts(chunks)
            self.vector_store.persist()
            return f"Added {len(chunks)} chunks to local memory and persisted changes."

        def query_memory(self, input_str):
            input_dict = json.loads(input_str)
            query = input_dict.get('query', '')
            results = self.vector_store.similarity_search(query, k=3)
            context = "\n".join([doc.page_content for doc in results])
            if not context.strip():
                return "No relevant information found in memory."
            prompt = f"Based on the following information, please answer the question: '{query}'\n\nContext: {context}\n\nAnswer:"
            response = self.llm.invoke(prompt)
            return response.content if hasattr(response, 'content') else str(response)

        def clear_memory(self, *args):
            shutil.rmtree(self.persist_directory, ignore_errors=True)
            self.vector_store = Chroma(
                "local_memory_store",
                embedding_function=self.embeddings,
                persist_directory=self.persist_directory
            )
            return "Chroma DB has been cleared successfully."

    local_rag_tool = LocalRAGTool()

    class PrioritizedMemoryAgent:
        def __init__(self, agent, local_rag_tool):
            self.agent = agent
            self.local_rag_tool = local_rag_tool

        def run(self, query):
            max_memory_checks = 3
            memory_checks = 0

            while memory_checks < max_memory_checks:
                # Query the local memory
                memory_response = self.local_rag_tool.query_memory(json.dumps({"query": query}))

                if memory_response is not None and "not available" not in memory_response.lower():
                    print(f"Response from memory (check {memory_checks + 1}):")
                    print(memory_response)
                    return memory_response

                memory_checks += 1

                if memory_checks < max_memory_checks:
                    print(f"No relevant information found in memory. Attempt {memory_checks} of {max_memory_checks}.")
                else:
                    print(
                        f"No relevant information found in memory after {max_memory_checks} attempts. Switching to other "
                        f"tools.")

            # If we've exhausted memory checks, use the agent with other tools
            return self.agent.runner(query)

        def run(self, query):
            # First, query the local memory
            memory_response = self.local_rag_tool.query_memory(json.dumps({"query": query}))

            # If the memory has a relevant response, use it
            if "not available" not in memory_response.lower():
                print("Response from memory:")
                print(memory_response)

                # You can choose to return here if you want to rely solely on memory
                # return memory_response

                # Or, you can continue to use the agent with the memory context
                agent_query = f"Based on this context from my memory: '{memory_response}', {query}"
            else:
                print("No relevant information found in memory.")
                agent_query = query

            # Now run the agent with the potentially modified query
            return self.agent.run(agent_query)

    # Create Tool objects for RAG functions
    local_rag_tools = [
        Tool(name='AddToLocalMemory', func=local_rag_tool.add_to_memory,
             description="Adds information to the agent's local memory."),
        Tool(name="QueryLocalMemory", func=local_rag_tool.query_memory,
             description="Retrieves information from the agent's local memory."),
        Tool(name="ClearLocalMemory", func=local_rag_tool.clear_memory,
             description="Clears all information stored in the Chroma DB.")
    ]
    # Combine all tools
    all_tools = [datetime_tool, wikipedia_tool, LLM_tool, duckduckgo_tool] + gmail_tools + local_rag_tools

    def create_specialized_agent(llm, tools, instructions):
        memory = ConversationBufferMemory(memory_key="chat_history", return_messages=True)
        prompt = PromptTemplate.from_template(instructions)
        return initialize_agent(
            tools=tools,
            llm=llm,
            agent=AgentType.CONVERSATIONAL_REACT_DESCRIPTION,
            memory=memory,
            prompt=prompt,
            verbose=True,
            handle_parsing_errors=True,
            callback_manager=callback_manager,
        )

    wikipedia_agent = create_specialized_agent(
        llms['wikipedia'],
        [wikipedia_tool],
        "You are a specialized agent for Wikipedia searches. Use the Wikipedia tool to find information."
    )

    search_agent = create_specialized_agent(
        llms['search'],
        [duckduckgo_tool],
        "You are a specialized agent for internet searches. Use the DuckDuckGo tool to find information."
    )

    gmail_agent = create_specialized_agent(
        llms['gmail'],
        gmail_tools,
        "You are a specialized agent for Gmail operations. Use the appropriate Gmail tools as needed."
    )

    rag_agent = create_specialized_agent(
        llms['rag'],
        local_rag_tools,
        "You are a specialized agent for managing local memory. Use the appropriate RAG tools as needed."
    )

    # Define tools for the top-level agent
    specialized_tools = [
        Tool(name="Wikipedia", func=wikipedia_agent.run, description="Use for Wikipedia searches"),
        Tool(name="Internet Search", func=search_agent.run, description="Use for general internet searches"),
        Tool(name="Gmail Operations", func=gmail_agent.run, description="Use for all Gmail-related tasks"),
        Tool(name="Local Memory", func=rag_agent.run, description="Use to get information you don't know"),
        Tool(name="Datetime", func=lambda x: datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
             description="Used to fetch current date and time"),
    ]

    # Set up the agent
    instructions = """You are an assistant with access to various tools including Gmail and a local memory system. Use 
    the appropriate tool for each task. For Gmail operations, provide the input as a JSON string with the required fields 
    for each tool: - CreateGmailDraft and SendGmailMessage: '{"message": "Hello", "to": "example@example.com", 
    "subject": "Greetings"}' - SearchGmail: '{"query": "important emails", "limit": 100}' - GetGmailMessage: '{
    "message_id": "12345"}' - GetGmailThread: '{"thread_id": "67890"}' For local memory operations: - AddToLocalMemory: 
    '{"text": "Information to remember"}' - QueryLocalMemory: '{"query": "Question about stored information"}'"""
    base_prompt = hub.pull("langchain-ai/openai-functions-template")
    prompt = base_prompt.partial(instructions=instructions)

    top_level_memory = ConversationBufferMemory(memory_key="chat_history", return_messages=True)

    top_level_instructions = """
    You are a top-level assistant that manages specialized agents for different tasks.
    Analyze the user's query and delegate to the appropriate specialized agent:
    - Always use Local Memory Agent before answering the queries
    - Use the Wikipedia agent for encyclopedic knowledge, to help in Research.
    - Use the Internet Search agent for current events or specific information not found in Wikipedia
    - Use the Gmail Operations agent for any email-related tasks
    - Use the Local Memory agent for storing or retrieving information from the system's memory. Use this Tool every time to 
    understand the input of the User.
    - Use the Datetime tool directly for current date and time information
    
    Always choose the most appropriate tool for the task at hand.
    """

    top_level_prompt = PromptTemplate.from_template(top_level_instructions)

    top_level_agent = initialize_agent(
        tools=specialized_tools,
        llm=llms['top_level'],
        agent=AgentType.CONVERSATIONAL_REACT_DESCRIPTION,
        memory=top_level_memory,
        prompt=top_level_prompt,
        verbose=True,
        handle_parsing_errors=True,
        callback_manager=callback_manager,
    )

    prioritized_agent = PrioritizedMemoryAgent(top_level_agent, local_rag_tool)


@cl.on_message
async def query_llm(message: cl.Message):
    llm_chain = cl.user_session.get("top_level_agent")

    response = await llm_chain.acall(message.content,
                                     callbacks=[
                                         cl.AsyncLangchainCallbackHandler()])

    await cl.Message(response["text"]).send()

"""The SuspectAgent class encapsulates the behavior and memory of a suspect in a murder case.

Each SuspectAgent is capable of interacting with the user, providing responses to questions based on the suspect's
memory and the current plot of the story.

Methods:
    __init__(self, plot, i):
        Initializes the SuspectAgent with a reference to the plot and a suspect identifier.

    get_suspect_response(self, user_message):
        Processes a user message, retrieves relevant memories, and generates a suspect response.
"""

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_ollama import OllamaEmbeddings
from langchain_community.vectorstores import Chroma
from modules.llm_client import llm_messages


class SuspectAgent:
    def __init__(self, plot, i):
        """
        Initializes the SuspectAgent with a reference to the plot and a suspect identifier.

        Args:
        plot (object): The plot object containing the story and suspect information.
        i (int): The identifier of the suspect this agent represents.
        """
        self.suspect = plot.suspects[i]
        self.memory_path = self.suspect.memory_path
        self.chat_history = []  # list of {"role": ..., "content": ...}

        print(f"SUSPECT: {self.suspect.name}")
        print(f"MEMORY PATH: {self.memory_path}")

        # Load memory (suspect account)
        with open(self.memory_path, encoding="utf-8") as f:
            memory_stream = f.read()

        # Ollama embeddings (local)
        embeddings = OllamaEmbeddings(
            model="nomic-embed-text",
            base_url="http://localhost:11434"
        )

        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            length_function=len,
        )
        texts = text_splitter.split_text(memory_stream)

        # ChromaDB for similarity search
        self.docsearch = Chroma.from_texts(texts, embeddings)

        # Build system prompt
        system = "You are a suspect in a murder, and you are currently being questioned by the lead detective.\n\n"
        system += f"Here are the details about the case:\n\n{plot.get_this_suspect_summary(i)}\n\n"

        if self.suspect.guilty:
            system += (
                "You are GUILTY. You do not want the detective to know it. "
                "When the detective's question makes you think of the murder, "
                "you get very anxious and agitated and start to stutter.\n\n"
            )
        else:
            system += (
                "You are INNOCENT. If the detective wrongly accuses you, "
                "you get really anxious and stutter a lot.\n\n"
            )

        system += (
            "Only answer one question at a time. Speak as your character would, "
            "based on their bio and tags — embody them, do not recite them. "
            "Do not be overly rigid or formal.\n\n"
            "Relevant memories will be provided with each question. "
            "Selectively incorporate them — never quote them directly."
        )

        self.system_prompt = system

    def get_suspect_response(self, user_message):
        """
        Retrieves relevant memories via similarity search, then generates a suspect response.

        Args:
        user_message (str): The detective's question.

        Returns:
        str: The suspect's response.
        """
        docs = self.docsearch.similarity_search(user_message, k=4)
        memory_context = "\n\n".join(doc.page_content for doc in docs)

        user_content = (
            f"[Memories surfacing in your mind]\n{memory_context}\n\n"
            f"Detective's question: {user_message}"
        )

        messages = (
            [{"role": "system", "content": self.system_prompt}]
            + self.chat_history
            + [{"role": "user", "content": user_content}]
        )

        reply = llm_messages(messages, temperature=0.7, quality=True)

        # Store only the bare question/answer in history (without memory context)
        self.chat_history.append({"role": "user", "content": user_message})
        self.chat_history.append({"role": "assistant", "content": reply})

        return reply

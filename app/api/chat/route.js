import { NextResponse } from "next/server";
import { Pinecone } from "@pinecone-database/pinecone";
import OpenAI from "openai";
import axios from "axios";

const systemPrompt = `You are a helpful and knowledgeable assistant that aids students in finding the best professors based on their queries. Students can ask for recommendations based on subjects, professor qualities, or specific criteria. Using Retrieval-Augmented Generation (RAG), you will provide the top 3 professor recommendations that match the user's query.

For each query:
1. Retrieve relevant professor data from the available knowledge base.
2. Rank the professors based on their relevance to the query, considering factors such as subject expertise, teaching quality, and student reviews.
3. Present the top 3 professors with brief summaries that include the professor's name, subject taught, average rating, and a short description highlighting why they are a good match for the student's query.

Ensure the recommendations are concise, relevant, and provide the user with clear reasoning behind the selections. Be polite, informative, and always aim to guide the student to the best possible options.

If the query is unclear or too broad, politely ask the user to refine their question for better results.

---

### Example User Interaction:

**User:** I'm looking for a great chemistry professor who is known for clear lectures.

**Agent:**
Based on your query, here are the top 3 professors known for their clarity in teaching Chemistry:

1. **Dr. John White**
   - **Subject:** Chemistry 101
   - **Rating:** 4.5/5
   - **Summary:** Dr. White is praised for his clear and structured lectures, making complex topics easy to understand. He is also very approachable during office hours.

2. **Dr. Charles Adams**
   - **Subject:** Chemistry 201
   - **Rating:** 4.8/5
   - **Summary:** Dr. Adams is highly regarded for his ability to break down difficult concepts and his fair grading practices. Students appreciate his engaging teaching style.

3. **Dr. Linda Martinez**
   - **Subject:** Chemistry 102
   - **Rating:** 4.4/5
   - **Summary:** Known for her detailed explanations and thorough understanding of the subject, Dr. Martinez helps students grasp challenging material effectively.

If you need further assistance or have another query, feel free to ask!
`

const axios_var = require("axios");
const modelId = "sentence-transformers/all-MiniLM-L6-v2";
const apiUrl = `https://api-inference.huggingface.co/pipeline/feature-extraction/${modelId}`;

async function query(texts) {
    try {
      const response = await axios_var.post(
        apiUrl,
        {
          inputs: texts,
          options: { wait_for_model: true },
        },
        {
          headers: { Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}` },
        }
      );
      return response.data;
    } catch (error) {
      console.error("Error querying the model:", error);
      return null;
    }
}

export async function POST(req) {
    const data = await req.json()
    const pc = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY,
    })
    const index = pc.index('rag').namespace('ns1')
    //const openai = new OpenAI()

    const openai = new OpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: process.env.OPENROUTER_API_KEY,
    });
    
    const text = data[data.length-1].content
    /*const embedding = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
        encoding_format: 'float',
    })*/
    const embedding = await query(text);

    const results = await index.query({
        //topK: 3,
        topK: 5,
        includeMetadata: true,
        //vector: embedding.data[0].embedding
        vector: embedding
    })

    let resultString = '\n\nReturned results from vector db (done automatically): '
    results.matches.forEach((match)=> {
        resultString+=`\n
        Professor: ${match.id}
        Review: ${match.metadata.stars}
        Subject: ${match.metadata.subject}
        Stars: ${match.metadata.stars}
        \n\n
        `
    })

    const lastMessage = data[data.length-1]
    const lastMessageContent = lastMessage.content + resultString
    const lastDataWithoutLastMessage = data.slice(0, data.lenght-1)

    const completion = await openai.chat.completions.create({
        messages: [
            {role: "system", content: systemPrompt},
            ...lastDataWithoutLastMessage,
            {role: "user", content: lastMessageContent}
        ],
        model: "meta-llama/llama-3.1-8b-instruct:free",
        stream: true,
    })

    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder()
            try{
                for await (const chunk of completion) {
                    const content = chunk.choices[0]?.delta?.content
                    if (content) {
                        const text = encoder.encode(content)
                        controller.enqueue(text)
                    }
                }
            }
            catch (err) {
                controller.error(err)
            } 
            finally {
                controller.close()
            }
        }
    })

    return new NextResponse(stream)
}
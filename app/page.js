'use client'
import {Box, Stack, TextField, Button, Typography} from "@mui/material";
import { useState } from "react";
import React from 'react'
import ReactMarkdown from 'react-markdown'

export default function Home() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hi! I'm the Rate My Professor support assistant. How can I help you today?"
    }
  ])
  const [message, setMessage] = useState('')
  const sendMessage = async () => {
    setMessages((messages) => [
      ...messages,
      {role: "user", content: message},
      {role: "assistant", content: ''}
    ])
    setMessage('')

    const response = fetch('/api/chat', {
      method: "POST",
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([...messages, {role: "user", content: message}])
    }).then((async(res) => {
      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      let result = ''
      return reader.read().then(function processText({done, value}) {
        if (done) {
          return result
        }
        const text = decoder.decode(value || new Uint8Array(), {stream: true})
        setMessages((messages)=>{
          let lastMessage = messages[messages.length-1]
          let otherMessages = messages.slice(0, messages.length-1)
          return [
            ...otherMessages, 
            {...lastMessage, content: lastMessage.content+text}
          ]
        })

        return reader.read().then(processText)
      })
    }))
    
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      sendMessage();
    }
  }

  return (
    <Box 
      width="100vw" 
      height="100vh" 
      display="flex" 
      flexDirection="column" 
      justifyContent="center" 
      paddingLeft={5}
      alignItems="left"
    >
      <Box 
        width="380px" 
        height="100px" 
        border="1px solid black"
        display="flex" 
        alignItems="left" 
        justifyContent="center"
        paddingTop={1}
        paddingBottom={1}
        marginBottom={1}
        marginTop={1}
      >
        <Typography variant="h2" color="black">
          RateProf AI
        </Typography>
      </Box>
      <Stack 
        direction="column" 
        width="1800px" 
        height="700px" 
        border="1px solid black" 
        borderRadius={1}
        p={2} 
        spacing={3}
        bgcolor="white"
      >
        <Stack direction="column" spacing={2} flexGrow={1} overflow={"auto"} maxHeight={"100%"}>
          {
            messages.map((message, index)=>(
              <Box 
                key={index} 
                display="flex" 
                justifyContent={
                  message.role === 'assistant' ? 'flex-start' : 'flex-end'
                }
              >
                <Box 
                  bgcolor={
                    message.role === 'assistant' ? 'primary.main' : 'secondary.main'
                  }
                  color="white"
                  borderRadius={16}
                  p={3}
                >
                  {message.role === 'user' ? 'You' : 'Assistant'}:
                  <ReactMarkdown>
                    {message.content}
                  </ReactMarkdown>
                </Box>
              </Box>
            ))
          }
        </Stack>
        <Stack direction="row" spacing={2}>
          <TextField 
            label="Message" 
            fullWidth 
            value={message} 
            onChange={(e)=>{ setMessage(e.target.value)}}
            onKeyDown={handleKeyDown}
          />
          <Button variant="contained" onClick={sendMessage}>Send</Button>
        </Stack>
      </Stack>
    </Box>
  );
}

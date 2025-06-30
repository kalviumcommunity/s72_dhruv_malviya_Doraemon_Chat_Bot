import React, { useState, useRef, useEffect } from 'react';
import { PaperAirplaneIcon, ChatBubbleLeftIcon } from '@heroicons/react/24/outline';

const ChatInterface = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const token = localStorage.getItem('token');
    if (!token) {
      setError('Please log in to continue');
      return;
    }

    const userMessage = {
      role: 'user',
      content: input,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError('');

    try {
      const response = await axios.post(
        `${process.env.REACT_APP_SERVER_URL}/api/chat/send`,
        { message: input },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const aiMessage = {
        role: 'assistant',
        content: response.data.message,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error in chat:', error);
      setError(error.response?.data?.message || error.message || 'Failed to get response');

      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full p-4 bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm p-4 rounded-lg mb-4">
        <div className="flex items-center space-x-2">
          <ChatBubbleLeftIcon className="w-6 h-6 text-primary" />
          <h2 className="text-xl font-semibold text-gray-900">
            Chat with Doraemon
          </h2>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Chat with Doraemon about anything
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 border border-gray-200 rounded-lg bg-white">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.role === 'user'
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
              <p className="text-xs mt-1 opacity-70">
                {new Date(message.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg p-3">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {error && (
        <div className="mt-2 px-4 py-2 bg-red-50 text-red-600 text-sm rounded-lg">
          {error}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="mt-4">
        <div className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50"
          >
            <PaperAirplaneIcon className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChatInterface;

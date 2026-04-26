import { useEffect, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';

interface Props {
  creatorId: string;
}

interface Message {
  id: string;
  fan_id: string;
  display_name: string;
  draft: {
    generated_text: string;
    ai_confidence: number;
  };
  created_at: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function Dashboard({ creatorId }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!creatorId) return;
    loadMessages();
  }, [creatorId]);

  const loadMessages = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/messages/pending`, {
        params: { creator_id: creatorId },
      });
      setMessages(response.data);
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const approveMessage = async (messageId: string) => {
    try {
      await axios.post(`${API_URL}/api/messages/${messageId}/approve`, {}, {
        params: { creator_id: creatorId },
      });
      loadMessages();
    } catch (error) {
      console.error('Failed to approve message:', error);
    }
  };

  const rejectMessage = async (messageId: string) => {
    try {
      await axios.post(`${API_URL}/api/messages/${messageId}/reject`, {}, {
        params: { creator_id: creatorId },
      });
      loadMessages();
    } catch (error) {
      console.error('Failed to reject message:', error);
    }
  };

  return (
    <div style={{ fontFamily: 'Arial, sans-serif' }}>
      <nav style={{
        backgroundColor: '#1976D2',
        color: 'white',
        padding: '16px 20px',
        marginBottom: '20px',
        display: 'flex',
        gap: '20px',
        alignItems: 'center',
      }}>
        <h2 style={{ margin: 0, flex: 1 }}>Fanvue AI Chatbot</h2>
        <Link href="/">
          <a style={{ color: 'white', textDecoration: 'none', marginRight: '16px' }}>Messages</a>
        </Link>
        <Link href="/fans">
          <a style={{ color: 'white', textDecoration: 'none', marginRight: '16px' }}>Fans</a>
        </Link>
        <Link href="/requests">
          <a style={{ color: 'white', textDecoration: 'none' }}>Requests</a>
        </Link>
      </nav>

      <div style={{ padding: '20px' }}>
        <h1>📨 Message Approval Queue</h1>

      {loading ? (
        <p>Loading messages...</p>
      ) : messages.length === 0 ? (
        <p>No pending messages</p>
      ) : (
        <div>
          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                border: '1px solid #ddd',
                padding: '15px',
                marginBottom: '15px',
                borderRadius: '8px',
                backgroundColor: '#f9f9f9',
              }}
            >
              <div style={{ marginBottom: '10px' }}>
                <strong>To: {msg.display_name}</strong>
                <span style={{ float: 'right', fontSize: '12px', color: '#666' }}>
                  Confidence: {(msg.draft.ai_confidence * 100).toFixed(0)}%
                </span>
              </div>

              <div
                style={{
                  backgroundColor: '#fff',
                  padding: '10px',
                  borderRadius: '4px',
                  marginBottom: '10px',
                  minHeight: '60px',
                }}
              >
                <p>{msg.draft.generated_text}</p>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => approveMessage(msg.id)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  ✓ Approve & Send
                </button>
                <button
                  onClick={() => rejectMessage(msg.id)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#f44336',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  ✕ Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}

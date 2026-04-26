import { useEffect, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';

interface Props {
  creatorId: string;
}

interface Fan {
  id: string;
  display_name: string;
  subscription_tier: string;
  lifetime_value: number;
  engagement_score: number;
  churn_risk: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function Fans({ creatorId }: Props) {
  const [fans, setFans] = useState<Fan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!creatorId) return;
    loadFans();
  }, [creatorId]);

  const loadFans = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/fans`, {
        params: { creator_id: creatorId },
      });
      setFans(response.data.data);
    } catch (error) {
      console.error('Failed to load fans:', error);
    } finally {
      setLoading(false);
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
        <h1>👥 Fans CRM</h1>

      {loading ? (
        <p>Loading fans...</p>
      ) : fans.length === 0 ? (
        <p>No fans yet</p>
      ) : (
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            marginTop: '20px',
          }}
        >
          <thead>
            <tr style={{ backgroundColor: '#f0f0f0' }}>
              <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                Name
              </th>
              <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                Tier
              </th>
              <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                Lifetime Value
              </th>
              <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                Engagement
              </th>
              <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                Churn Risk
              </th>
              <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {fans.map((fan) => (
              <tr key={fan.id} style={{ borderBottom: '1px solid #ddd' }}>
                <td style={{ padding: '10px' }}>{fan.display_name}</td>
                <td style={{ padding: '10px' }}>{fan.subscription_tier}</td>
                <td style={{ padding: '10px' }}>${fan.lifetime_value.toFixed(2)}</td>
                <td style={{ padding: '10px' }}>
                  {(fan.engagement_score || 0).toFixed(1)}/10
                </td>
                <td style={{ padding: '10px' }}>
                  {((fan.churn_risk || 0) * 100).toFixed(0)}%
                </td>
                <td style={{ padding: '10px' }}>
                  <Link href={`/fan-details/${fan.id}`}>
                    <a style={{
                      padding: '6px 12px',
                      backgroundColor: '#2196F3',
                      color: 'white',
                      textDecoration: 'none',
                      borderRadius: '4px',
                    }}>
                      Manage
                    </a>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      </div>
    </div>
  );
}

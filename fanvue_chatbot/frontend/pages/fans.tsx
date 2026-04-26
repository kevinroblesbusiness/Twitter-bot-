import { useEffect, useState } from 'react';
import axios from 'axios';

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
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
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
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

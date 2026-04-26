import { useEffect, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';

interface Props {
  creatorId: string;
}

interface FanRequest {
  id: string;
  fan_id: string;
  fan_name: string;
  request_text: string;
  request_type: string | null;
  status: string;
  date_requested: string;
  creator_note: string | null;
  fulfilled_date: string | null;
}

export default function Requests({ creatorId }: Props) {
  const [requests, setRequests] = useState<FanRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!creatorId) return;
    loadRequests();
  }, [creatorId]);

  const loadRequests = async () => {
    try {
      const response = await axios.get(
        `http://localhost:3001/api/fan-details/creator/${creatorId}/pending-requests`
      );
      setRequests(response.data);
    } catch (error) {
      console.error('Failed to load requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (requestId: string, newStatus: string) => {
    try {
      await axios.patch(
        `http://localhost:3001/api/fan-details/requests/${requestId}`,
        {
          status: newStatus,
          fulfilledDate: newStatus === 'fulfilled' ? new Date().toISOString() : null,
        }
      );
      loadRequests();
    } catch (error) {
      console.error('Failed to update request:', error);
      alert('Failed to update request status');
    }
  };

  const filteredRequests = filterStatus === 'all'
    ? requests
    : requests.filter((r) => r.status === filterStatus);

  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const fulfilledCount = requests.filter((r) => r.status === 'fulfilled').length;

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

      <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
        <h1>📋 Fan Requests</h1>

      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
        <div style={{ padding: '16px', backgroundColor: '#FFC107', borderRadius: '4px', color: 'white', flex: 1 }}>
          <h3 style={{ margin: '0 0 8px 0' }}>Pending</h3>
          <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>{pendingCount}</p>
        </div>
        <div style={{ padding: '16px', backgroundColor: '#4CAF50', borderRadius: '4px', color: 'white', flex: 1 }}>
          <h3 style={{ margin: '0 0 8px 0' }}>Fulfilled</h3>
          <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>{fulfilledCount}</p>
        </div>
        <div style={{ padding: '16px', backgroundColor: '#2196F3', borderRadius: '4px', color: 'white', flex: 1 }}>
          <h3 style={{ margin: '0 0 8px 0' }}>Total</h3>
          <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>{requests.length}</p>
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ marginRight: '12px' }}>Filter: </label>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
        >
          <option value="all">All Requests</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="fulfilled">Fulfilled</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {loading ? (
        <p>Loading requests...</p>
      ) : filteredRequests.length === 0 ? (
        <p>No requests found.</p>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {filteredRequests.map((request) => (
            <div
              key={request.id}
              style={{
                border: '1px solid #ddd',
                borderRadius: '4px',
                padding: '16px',
                backgroundColor:
                  request.status === 'fulfilled'
                    ? '#e8f5e9'
                    : request.status === 'pending'
                      ? '#fff3e0'
                      : '#f3f3f3',
                cursor: 'pointer',
              }}
              onClick={() => setExpandedId(expandedId === request.id ? null : request.id)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: '0 0 8px 0' }}>
                    {request.fan_name}
                  </h3>
                  <p style={{ margin: '0 0 8px 0', fontSize: '14px' }}>
                    "{request.request_text}"
                  </p>
                  <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>
                    Asked on {new Date(request.date_requested).toLocaleDateString()}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '6px 12px',
                      borderRadius: '4px',
                      backgroundColor:
                        request.status === 'fulfilled'
                          ? '#4CAF50'
                          : request.status === 'pending'
                            ? '#FFC107'
                            : '#9E9E9E',
                      color: request.status === 'pending' ? 'black' : 'white',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      marginBottom: '8px',
                    }}
                  >
                    {request.status.toUpperCase()}
                  </span>
                </div>
              </div>

              {expandedId === request.id && (
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #ddd' }}>
                  {request.request_type && (
                    <p>
                      <strong>Type:</strong> {request.request_type}
                    </p>
                  )}

                  <div style={{ marginTop: '12px' }}>
                    <strong>Update Status:</strong>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      {['pending', 'in_progress', 'fulfilled', 'cancelled'].map((status) => (
                        <button
                          key={status}
                          onClick={() => handleStatusUpdate(request.id, status)}
                          style={{
                            padding: '8px 12px',
                            backgroundColor:
                              request.status === status ? '#2196F3' : '#f0f0f0',
                            color: request.status === status ? 'white' : 'black',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                          }}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>

                  {request.fulfilled_date && (
                    <p style={{ marginTop: '12px', fontSize: '12px', color: '#666' }}>
                      Fulfilled on {new Date(request.fulfilled_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}

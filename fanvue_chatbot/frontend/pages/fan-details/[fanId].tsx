import { useState, useEffect } from 'react';
import axios from 'axios';

interface FanDetail {
  id: string;
  fan_id: string;
  name: string | null;
  age: number | null;
  birthday: string | null;
  location: string | null;
  job_title: string | null;
  company: string | null;
  hobbies: string[];
  relationship_status: string | null;
  partner_name: string | null;
  kids: any[];
  pets: any[];
  favorite_things: string[];
  goals: string[];
  fears: string[];
  emotional_triggers: string[];
}

interface FanRequest {
  id: string;
  request_text: string;
  request_type: string | null;
  status: string;
  date_requested: string;
  fulfilled_date: string | null;
}

export default function FanDetailPage({ fanId }: { fanId: string }) {
  const [fanDetails, setFanDetails] = useState<FanDetail | null>(null);
  const [fanRequests, setFanRequests] = useState<FanRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<FanDetail>>({});

  useEffect(() => {
    const queryFanId = window.location.pathname.split('/')[2];
    fetchFanDetails(queryFanId);
    fetchFanRequests(queryFanId);
  }, []);

  async function fetchFanDetails(id: string) {
    try {
      const response = await axios.get(`http://localhost:3001/api/fan-details/${id}/details`);
      setFanDetails(response.data);
      setEditData(response.data);
    } catch (error) {
      console.error('Failed to fetch fan details:', error);
    }
  }

  async function fetchFanRequests(id: string) {
    try {
      const response = await axios.get(`http://localhost:3001/api/fan-details/${id}/requests`);
      setFanRequests(response.data);
    } catch (error) {
      console.error('Failed to fetch fan requests:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    try {
      await axios.put(
        `http://localhost:3001/api/fan-details/${fanId}/details`,
        editData
      );
      setFanDetails(editData as FanDetail);
      setEditing(false);
      alert('Fan details updated!');
    } catch (error) {
      console.error('Failed to save fan details:', error);
      alert('Failed to save changes');
    }
  }

  const handleFieldChange = (field: string, value: any) => {
    setEditData({
      ...editData,
      [field]: value,
    });
  };

  const handleArrayFieldChange = (field: string, index: number, value: string) => {
    const arr = (editData[field as keyof FanDetail] as string[]) || [];
    arr[index] = value;
    setEditData({
      ...editData,
      [field]: arr,
    });
  };

  if (loading) return <div style={{ padding: '20px' }}>Loading...</div>;

  return (
    <div style={{ padding: '20px', maxWidth: '900px', margin: '0 auto' }}>
      <h1>Fan Details</h1>

      {fanDetails && (
        <div style={{ marginBottom: '30px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h2>{fanDetails.name || 'Unnamed Fan'}</h2>
            <button
              onClick={() => {
                setEditing(!editing);
                if (editing) fetchFanDetails(fanId);
              }}
              style={{
                padding: '8px 16px',
                backgroundColor: editing ? '#f44336' : '#2196F3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              {editing ? 'Cancel' : 'Edit'}
            </button>
          </div>

          {editing ? (
            <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label>Name</label>
                  <input
                    type="text"
                    value={editData.name || ''}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                    style={{ width: '100%', padding: '8px', marginTop: '4px' }}
                  />
                </div>
                <div>
                  <label>Age</label>
                  <input
                    type="number"
                    value={editData.age || ''}
                    onChange={(e) => handleFieldChange('age', e.target.value ? parseInt(e.target.value) : null)}
                    style={{ width: '100%', padding: '8px', marginTop: '4px' }}
                  />
                </div>
                <div>
                  <label>Birthday</label>
                  <input
                    type="date"
                    value={editData.birthday || ''}
                    onChange={(e) => handleFieldChange('birthday', e.target.value)}
                    style={{ width: '100%', padding: '8px', marginTop: '4px' }}
                  />
                </div>
                <div>
                  <label>Location</label>
                  <input
                    type="text"
                    value={editData.location || ''}
                    onChange={(e) => handleFieldChange('location', e.target.value)}
                    style={{ width: '100%', padding: '8px', marginTop: '4px' }}
                  />
                </div>
                <div>
                  <label>Job Title</label>
                  <input
                    type="text"
                    value={editData.job_title || ''}
                    onChange={(e) => handleFieldChange('job_title', e.target.value)}
                    style={{ width: '100%', padding: '8px', marginTop: '4px' }}
                  />
                </div>
                <div>
                  <label>Company</label>
                  <input
                    type="text"
                    value={editData.company || ''}
                    onChange={(e) => handleFieldChange('company', e.target.value)}
                    style={{ width: '100%', padding: '8px', marginTop: '4px' }}
                  />
                </div>
                <div>
                  <label>Relationship Status</label>
                  <select
                    value={editData.relationship_status || ''}
                    onChange={(e) => handleFieldChange('relationship_status', e.target.value)}
                    style={{ width: '100%', padding: '8px', marginTop: '4px' }}
                  >
                    <option value="">Select...</option>
                    <option value="single">Single</option>
                    <option value="in_relationship">In a Relationship</option>
                    <option value="married">Married</option>
                    <option value="complicated">Complicated</option>
                  </select>
                </div>
                <div>
                  <label>Partner Name</label>
                  <input
                    type="text"
                    value={editData.partner_name || ''}
                    onChange={(e) => handleFieldChange('partner_name', e.target.value)}
                    style={{ width: '100%', padding: '8px', marginTop: '4px' }}
                  />
                </div>
              </div>

              <div style={{ marginTop: '20px' }}>
                <h3>Hobbies (top 3)</h3>
                {[0, 1, 2].map((i) => (
                  <input
                    key={`hobby-${i}`}
                    type="text"
                    placeholder={`Hobby ${i + 1}`}
                    value={(editData.hobbies || [])[i] || ''}
                    onChange={(e) => {
                      const arr = [...(editData.hobbies || [])];
                      arr[i] = e.target.value;
                      handleFieldChange('hobbies', arr.filter(h => h));
                    }}
                    style={{ width: '100%', padding: '8px', marginBottom: '8px' }}
                  />
                ))}
              </div>

              <div style={{ marginTop: '20px' }}>
                <h3>Pets</h3>
                {editData.pets && editData.pets.map((pet: any, i: number) => (
                  <div key={`pet-${i}`} style={{ marginBottom: '12px', padding: '12px', backgroundColor: '#f5f5f5' }}>
                    <input
                      type="text"
                      placeholder="Pet name"
                      value={pet.name || ''}
                      onChange={(e) => {
                        const pets = [...editData.pets];
                        pets[i].name = e.target.value;
                        handleFieldChange('pets', pets);
                      }}
                      style={{ width: '100%', padding: '8px', marginBottom: '8px' }}
                    />
                    <input
                      type="text"
                      placeholder="Pet type (dog, cat, etc)"
                      value={pet.type || ''}
                      onChange={(e) => {
                        const pets = [...editData.pets];
                        pets[i].type = e.target.value;
                        handleFieldChange('pets', pets);
                      }}
                      style={{ width: '100%', padding: '8px' }}
                    />
                  </div>
                ))}
              </div>

              <div style={{ marginTop: '20px' }}>
                <h3>Emotional Triggers (what gets them engaged)</h3>
                <textarea
                  value={(editData.emotional_triggers || []).join(', ')}
                  onChange={(e) => handleFieldChange('emotional_triggers', e.target.value.split(',').map(t => t.trim()))}
                  style={{ width: '100%', padding: '8px', height: '60px' }}
                  placeholder="e.g., personal details, slow content, custom requests"
                />
              </div>

              <button
                type="submit"
                style={{
                  marginTop: '20px',
                  padding: '10px 20px',
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Save Changes
              </button>
            </form>
          ) : (
            <div style={{ backgroundColor: '#f5f5f5', padding: '16px', borderRadius: '4px' }}>
              <p><strong>Name:</strong> {fanDetails.name || 'Not provided'}</p>
              <p><strong>Age:</strong> {fanDetails.age || 'Not provided'}</p>
              <p><strong>Birthday:</strong> {fanDetails.birthday || 'Not provided'}</p>
              <p><strong>Location:</strong> {fanDetails.location || 'Not provided'}</p>
              <p><strong>Job:</strong> {fanDetails.job_title || 'Not provided'}</p>
              <p><strong>Company:</strong> {fanDetails.company || 'Not provided'}</p>
              {fanDetails.hobbies && fanDetails.hobbies.length > 0 && (
                <p><strong>Hobbies:</strong> {fanDetails.hobbies.join(', ')}</p>
              )}
              {fanDetails.pets && fanDetails.pets.length > 0 && (
                <p>
                  <strong>Pets:</strong>{' '}
                  {fanDetails.pets.map((p: any) => `${p.name} (${p.type})`).join(', ')}
                </p>
              )}
              {fanDetails.emotional_triggers && fanDetails.emotional_triggers.length > 0 && (
                <p><strong>Emotional Triggers:</strong> {fanDetails.emotional_triggers.join(', ')}</p>
              )}
            </div>
          )}
        </div>
      )}

      <div>
        <h2>Pending Requests</h2>
        {fanRequests.length === 0 ? (
          <p>No pending requests from this fan.</p>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {fanRequests.map((req) => (
              <div
                key={req.id}
                style={{
                  padding: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  backgroundColor: req.status === 'fulfilled' ? '#e8f5e9' : '#fff3e0',
                }}
              >
                <p><strong>Request:</strong> {req.request_text}</p>
                <p>
                  <strong>Status:</strong>{' '}
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    backgroundColor: req.status === 'fulfilled' ? '#4CAF50' : '#FFC107',
                    color: req.status === 'fulfilled' ? 'white' : 'black',
                  }}>
                    {req.status}
                  </span>
                </p>
                <p><strong>Asked on:</strong> {new Date(req.date_requested).toLocaleDateString()}</p>
                {req.fulfilled_date && (
                  <p><strong>Fulfilled on:</strong> {new Date(req.fulfilled_date).toLocaleDateString()}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export async function getServerSideProps(context: any) {
  return {
    props: {
      fanId: context.params.fanId,
    },
  };
}

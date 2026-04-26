const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function Login() {
  const handleLogin = () => {
    window.location.href = `${API_URL}/api/auth/login`;
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontFamily: 'Arial, sans-serif',
        backgroundColor: '#f5f5f5',
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          padding: '40px',
          borderRadius: '8px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          textAlign: 'center',
        }}
      >
        <h1>🚀 Fanvue AI Chatbot</h1>
        <p>Automate fan engagement with AI</p>
        <button
          onClick={handleLogin}
          style={{
            padding: '12px 30px',
            fontSize: '16px',
            backgroundColor: '#007AFF',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            marginTop: '20px',
          }}
        >
          Login with Fanvue
        </button>
      </div>
    </div>
  );
}

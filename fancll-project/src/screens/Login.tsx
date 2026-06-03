import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Skeleton: no real auth yet. Any input gets you in.
  const signIn = () => navigate('/app/fixtures');

  return (
    <div className="screen center">
      <div className="logo">logo</div>
      <p className="app-name">FanCall</p>

      <input
        className="field"
        placeholder="Email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        className="field"
        placeholder="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <button className="btn" onClick={signIn}>
        Sign in
      </button>
      <button className="ghost" onClick={signIn}>
        Create account
      </button>
    </div>
  );
}

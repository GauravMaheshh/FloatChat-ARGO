import './GeminiChatApp.css';
import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, AlertCircle, Database, Activity, Search, MapPin } from 'lucide-react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Icons
const createColoredIcon = (color) => {
  return L.icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
};
const StartIcon = createColoredIcon('green');
const EndIcon = createColoredIcon('red');
const DefaultFloatIcon = createColoredIcon('gold');

// CartoDB Dark Matter Tile Layer
const DARK_MAP_TILES = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

function TrajectoryMap({ sql, data }) {
  let validPoints = data.filter(p => p.latitude && p.longitude);
  if (validPoints.length > 0 && validPoints[0].timestamp) {
    validPoints.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  const [sliderIndex, setSliderIndex] = useState(validPoints.length - 1);

  if (validPoints.length === 0) return null;

  const currentPoint = validPoints[sliderIndex];
  const positions = validPoints.slice(0, sliderIndex + 1).map(p => [parseFloat(p.latitude), parseFloat(p.longitude)]);
  const startPoint = [parseFloat(validPoints[0].latitude), parseFloat(validPoints[0].longitude)];

  return (
    <div className="viz-box map-viz">
      <div className="viz-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Float Trajectory Map</span>
        {currentPoint.timestamp && <span style={{ color: '#2563eb' }}>{new Date(currentPoint.timestamp).toLocaleString()}</span>}
      </div>

      <details className="sql-details">
        <summary><Database className="sql-icon" size={14} /> View Executed SQL</summary>
        <pre><code>{sql}</code></pre>
      </details>

      <MapContainer center={[currentPoint.latitude, currentPoint.longitude]} zoom={5} style={{ height: '500px', width: '100%', borderRadius: '4px', zIndex: 0 }}>
        <TileLayer url={DARK_MAP_TILES} attribution='&copy; OpenStreetMap & CartoDB' />
        {positions.length > 1 && (
          <Polyline positions={positions} color="#eab308" weight={4} opacity={0.8} />
        )}
        <Marker position={startPoint} icon={StartIcon} />
        {positions.length > 1 && (
          <Marker position={[currentPoint.latitude, currentPoint.longitude]} icon={EndIcon} />
        )}
      </MapContainer>

      {validPoints.length > 1 && (
        <div style={{ marginTop: '1.5rem' }}>
          <input
            type="range"
            min="0"
            max={validPoints.length - 1}
            value={sliderIndex}
            onChange={(e) => setSliderIndex(parseInt(e.target.value))}
            style={{ width: '100%' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem' }}>
            <span>Start</span>
            <span>Timeline Scrub</span>
            <span>Current</span>
          </div>
        </div>
      )}
    </div>
  );
}

function DataVisualizer({ toolsDataList, initialMapData }) {
  if (!toolsDataList || toolsDataList.length === 0) {
    if (initialMapData && initialMapData.length > 0) {
      return (
        <div className="data-visualizer">
          <div className="viz-box map-viz">
            <div className="viz-title">Global ARGO Fleet (Initial Sample)</div>
            <MapContainer center={[0, 0]} zoom={2} style={{ height: '600px', width: '100%', zIndex: 0 }}>
              <TileLayer url={DARK_MAP_TILES} attribution='&copy; OpenStreetMap & CartoDB' />
              {initialMapData.map((point, i) => (
                <Marker key={i} position={[point.latitude, point.longitude]} icon={DefaultFloatIcon} />
              ))}
            </MapContainer>
          </div>
        </div>
      );
    }
    return (
      <div style={{ color: '#6b7280', textAlign: 'center', marginTop: '4rem' }}>
        <Activity size={48} style={{ margin: '0 auto', opacity: 0.5 }} />
        <p>No visualizations generated yet.</p>
      </div>
    );
  }

  return (
    <div className="data-visualizer">
      {toolsDataList.map((tool, idx) => {
        const { sql, data } = tool;
        if (!data || data.length === 0) return null;

        const keys = data.length > 0 && typeof data[0] === 'object' ? Object.keys(data[0]) : [];

        if (keys.includes('latitude') && keys.includes('longitude')) {
          return <TrajectoryMap key={idx} sql={sql} data={data} />;
        }

        if (keys.includes('temperature') && keys.includes('pressure')) {
          const chartData = data.map(d => ({
            temperature: parseFloat(d.temperature),
            pressure: parseFloat(d.pressure)
          })).filter(d => !isNaN(d.temperature) && !isNaN(d.pressure));

          return (
            <div key={idx} className="viz-box chart-viz">
              <div className="viz-title">Temperature vs Pressure Profile</div>
              <details className="sql-details">
                <summary><Database className="sql-icon" size={14} /> View Executed SQL</summary>
                <pre><code>{sql}</code></pre>
              </details>
              <div style={{ height: '400px', width: '100%', marginTop: '10px' }}>
                <ResponsiveContainer>
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.5} />
                    <XAxis type="number" dataKey="temperature" name="Temperature" unit="°C" stroke="#111827" />
                    <YAxis type="number" dataKey="pressure" name="Pressure" unit="dbar" reversed stroke="#111827" />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: '#ffffff', color: '#111827', border: '1px solid #e5e7eb' }} />
                    <Scatter name="Profile" data={chartData} fill="#2563eb" />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        }

        return (
          <div key={idx} className="viz-box sql-only">
            <div className="viz-title">Raw Data Query</div>
            <details className="sql-details" open>
              <summary><Database className="sql-icon" size={14} /> View Executed SQL</summary>
              <pre><code>{sql}</code></pre>
            </details>
          </div>
        );
      })}
    </div>
  );
}

export default function GeminiChatApp() {
  const [activeTab, setActiveTab] = useState('directory');
  const [searchTerm, setSearchTerm] = useState('');

  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState([
    { role: 'model', text: 'ARGO Analytics Terminal Initialized. Ready for queries.' }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);

  const [initialMapData, setInitialMapData] = useState([]);
  const [sessionId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    fetch('http://localhost:3001/api/initial-map')
      .then(res => res.json())
      .then(data => {
        if (data.data) {
          setInitialMapData(data.data);
        }
      })
      .catch(err => console.error("Failed to load initial map:", err));
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  useEffect(() => {
    if (activeTab === 'chat') scrollToBottom();
  }, [messages, loading, activeTab]);

  const callGeminiAPI = async (overridePrompt = null) => {
    const userMessage = overridePrompt || prompt;
    if (!userMessage.trim()) return;

    setPrompt('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setLoading(true);
    setError('');
    setActiveTab('chat'); // switch to chat view when sending message

    try {
      const serverResponse = await fetch('http://localhost:3001/api/chat-argo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userMessage, sessionId: sessionId })
      });

      const data = await serverResponse.json();

      if (!serverResponse.ok) {
        throw new Error(data.error || `API Error: ${serverResponse.status}`);
      }

      if (data.response) {
        setMessages(prev => [...prev, { role: 'model', text: data.response, toolsData: data.toolsData }]);
      } else {
        throw new Error('Unexpected response format from the backend server');
      }

    } catch (err) {
      setError(err.message || 'Failed to get response');
      console.error('Error:', err);
      setMessages(prev => [...prev, { role: 'model', text: 'SYSTEM ERROR: Could not connect to database agent.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      callGeminiAPI();
    }
  };

  const handleFloatClick = async (floatId) => {
    setActiveTab('chat');
    setMessages(prev => [...prev, { role: 'user', text: `View trajectory for float ${floatId} (System Override)` }]);
    setLoading(true);

    try {
      const res = await fetch(`http://localhost:3001/api/trajectory/${floatId}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setMessages(prev => [...prev, {
        role: 'model',
        text: `Dashboard loaded trajectory data for float ${floatId} directly from the database to conserve AI quota.`,
        toolsData: [{
          sql: `SELECT * FROM argo_profiles WHERE float_id = '${floatId}' ORDER BY timestamp ASC LIMIT 500`,
          data: data.data
        }]
      }]);
    } catch (err) {
      console.error(err);
      setError("Failed to load trajectory data.");
    } finally {
      setLoading(false);
    }
  };

  const filteredFloats = initialMapData.filter(f => f.float_id.toLowerCase().includes(searchTerm.toLowerCase()));

  const allToolsData = messages
    .filter(m => m.toolsData)
    .flatMap(m => m.toolsData)
    .reverse();

  return (
    <div className="ocean-app">

      {/* Left Pane: Tabbed Interface */}
      <div className="chat-container">
        <div className="tab-header">
          <button
            className={`tab-btn ${activeTab === 'directory' ? 'active' : ''}`}
            onClick={() => setActiveTab('directory')}
          >
            Fleet Directory
          </button>
          <button
            className={`tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            Argo Assistant
          </button>
        </div>

        {activeTab === 'directory' && (
          <div className="directory-tab">
            <div className="search-bar">
              <input
                type="text"
                className="search-input"
                placeholder="Search float ID..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <ul className="float-list">
              {filteredFloats.map((float, idx) => (
                <li key={idx} className="float-item" onClick={() => handleFloatClick(float.float_id)}>
                  <span className="float-id"><Database size={14} style={{ display: 'inline', marginRight: '6px' }} />{float.float_id}</span>
                  <span className="float-coords"><MapPin size={12} style={{ display: 'inline' }} /> {parseFloat(float.latitude).toFixed(2)}, {parseFloat(float.longitude).toFixed(2)}</span>
                </li>
              ))}
              {filteredFloats.length === 0 && <li style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>No floats found.</li>}
            </ul>
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="chat-tab">
            <div className="chat-history">
              {messages.map((msg, index) => (
                <div key={index} className={`message-wrapper ${msg.role === 'user' ? 'message-user' : 'message-model'}`}>
                  <div className="message-icon-wrapper">
                    {msg.role === 'user' ? <User size={20} /> : <Bot size={20} />}
                  </div>
                  <div className="message-content">
                    {msg.text}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="message-wrapper message-model">
                  <div className="message-icon-wrapper"><Bot size={20} /></div>
                  <div className="message-content typing-indicator">
                    <span></span><span></span><span></span>
                  </div>
                </div>
              )}

              {error && (
                <div className="error-banner">
                  <AlertCircle size={20} />
                  <span>{error}</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-section">
              <div className="input-wrapper">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask the ARGO Agent..."
                  rows="2"
                  className="chat-textarea"
                />
                <button
                  onClick={() => callGeminiAPI()}
                  disabled={loading || !prompt.trim()}
                  className={`chat-send-btn ${loading || !prompt.trim() ? 'btn-disabled' : ''}`}
                >
                  <Send size={20} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right Pane: Data Visualizer */}
      <div className="data-pane">
        <DataVisualizer toolsDataList={allToolsData} initialMapData={initialMapData} />
      </div>

    </div>
  );
}

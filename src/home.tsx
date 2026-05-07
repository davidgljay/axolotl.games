
import React from "react";

interface HomeProps {
  onNavigate: (view: 'cake-run' | 'character-creator' | 'axolotl-driving-game' | 'axolotl-clickr' | 'axolotl-painter' | 'axolotl-baseball') => void;
}

const Home: React.FC<HomeProps> = ({ onNavigate }) => {
  return (
    <div>
      <style>{`
        body, .axolotl-home-root {
            margin: 0;
            padding: 0;
            font-family: Arial, sans-serif;
            background-color: #f0f0f0;
        }
        .container {
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: row;
            min-height: 20vh;
            background-color: #ff69b4;
            color: white;
            text-align: center;
            padding: 2rem;
        }
        h1 {
            margin: 0 0 1rem 0;
            font-size: 3rem;
        }
        h2 {
            margin: 0;
            font-size: 1.5rem;
            font-weight: normal;
        }
        .game-menu-wrapper {
            display: flex;
            flex-direction: row;
            align-items: center;
            justify-content: center;
            margin-top: 2rem;
            gap: 2rem;
            flex-wrap: wrap;
        }
        .game-link-wrapper {
            display: flex;
            justify-content: center;
            margin-top: 2rem;
        }
        .game-link {
            text-decoration: none;
            color: inherit;
        }
        .game-preview-img {
            width: 400px;
            max-width: 90vw;
            border-radius: 16px;
            box-shadow: 0 6px 24px rgba(0,0,0,0.15);
            transition: transform 0.2s;
        }
        .game-title {
            text-align: center;
            margin-top: 0.5rem;
            font-size: 1.2rem;
            font-weight: bold;
        }
      `}</style>
      <div className="axolotl-home-root">
        <div className="container">
          <img
            src="/img/axolotlrainbow.png"
            alt="Axolotl Rainbow"
            style={{ height: "120px", marginRight: "2rem" }}
          />
          <div>
            <h1>Axolotl Games</h1>
            <h2>Come play some games about all kinds of stuff.</h2>
            <p>
              <a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ">Click me</a>
            </p>
          </div>
          <img
            src="/img/axolotlrainbow.png"
            alt="Axolotl Rainbow"
            style={{ height: "120px", marginLeft: "2rem" }}
          />
        </div>
        <div className="game-menu-wrapper">
        <div className="game-link-wrapper">
          <button
            onClick={() => onNavigate('cake-run')}
            className="game-link"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <img
              src="/img/game_preview.jpg"
              alt="Axolotl Cake Run Preview"
              className="game-preview-img"
            />
            <div className="game-title">
              Play Axolotl Cake Run
            </div>
          </button>
        </div>
        <div className="game-link-wrapper">
          <button
            onClick={() => onNavigate('character-creator')}
            className="game-link"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <img
              src="/img/character_creator_preview.png"
              alt="Axolotl Character Creator Preview"
              className="game-preview-img"
            />
            <div className="game-title">
              Axolotl Character Creator
            </div>
          </button>
        </div>
        <div className="game-link-wrapper">
          <button
            onClick={() => onNavigate('axolotl-driving-game')}
            className="game-link"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <img
              src="/img/axolotl_driving.png"
              alt="Axolotl Driving Game Preview"
              className="game-preview-img"
            />
            <div className="game-title">
              Axolotl Driving Game
            </div>
          </button>
        </div>
        <div className="game-link-wrapper">
          <button
            onClick={() => onNavigate('axolotl-clickr')}
            className="game-link"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <img
              src="/img/axolotl_clicker.png"
              alt="Axolotl Clickr Preview"
              className="game-preview-img"
            />
            <div className="game-title">
              Axolotl Clickr
            </div>
          </button>
        </div>
        <div className="game-link-wrapper">
          <button
            onClick={() => onNavigate('axolotl-painter')}
            className="game-link"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <img
              src="/img/axolotl_painter.png"
              alt="Axolotl Painter Preview"
              className="game-preview-img"
            />
            <div className="game-title">
              Axolotl Painter
            </div>
          </button>
        </div>
        <div className="game-link-wrapper">
          <button
            onClick={() => onNavigate('axolotl-baseball')}
            className="game-link"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <svg
              width="400"
              height="300"
              className="game-preview-img"
              style={{ background: 'linear-gradient(to bottom, #87CEEB, #90EE90, #228B22)' }}
            >
              <defs>
                <linearGradient id="baseballGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#FFB6C1" />
                  <stop offset="50%" stopColor="#FF69B4" />
                  <stop offset="100%" stopColor="#FF1493" />
                </linearGradient>
              </defs>
              {/* Title */}
              <text
                x="200"
                y="50"
                fontSize="32"
                fontWeight="bold"
                fill="url(#baseballGradient)"
                fontFamily="Arial, sans-serif"
                textAnchor="middle"
              >
                ⚾ Axolotl Baseball
              </text>
              {/* Pitcher */}
              <g transform="translate(80, 120)">
                <ellipse cx="0" cy="0" rx="25" ry="18" fill="#FFB6C1" />
                <circle cx="-8" cy="-5" r="3" fill="#000" />
                <circle cx="8" cy="-5" r="3" fill="#000" />
                <circle cx="-12" cy="5" r="3" fill="#FF69B4" />
                <circle cx="-6" cy="5" r="3" fill="#FF69B4" />
                <circle cx="0" cy="5" r="3" fill="#FF69B4" />
              </g>
              {/* Baseball */}
              <circle cx="200" cy="150" r="12" fill="#FFFFFF" stroke="#C0C0C0" strokeWidth="1" />
              <line x1="188" y1="150" x2="212" y2="150" stroke="#8B4513" strokeWidth="1" />
              <line x1="200" y1="138" x2="200" y2="162" stroke="#8B4513" strokeWidth="1" />
              {/* Batter */}
              <g transform="translate(320, 200)">
                <ellipse cx="0" cy="0" rx="25" ry="18" fill="#FFB6C1" />
                <circle cx="-8" cy="-5" r="3" fill="#000" />
                <circle cx="8" cy="-5" r="3" fill="#000" />
                <circle cx="-12" cy="5" r="3" fill="#FF69B4" />
                <circle cx="-6" cy="5" r="3" fill="#FF69B4" />
                <circle cx="0" cy="5" r="3" fill="#FF69B4" />
                <line x1="25" y1="-10" x2="40" y2="-20" stroke="#8B4513" strokeWidth="4" />
              </g>
              {/* Field lines */}
              <line x1="200" y1="250" x2="50" y2="150" stroke="#FFFFFF" strokeWidth="2" />
              <line x1="200" y1="250" x2="350" y2="150" stroke="#FFFFFF" strokeWidth="2" />
            </svg>
            <div className="game-title">
              Axolotl Baseball
            </div>
          </button>
        </div>
        </div>
      </div>
    </div>
  );
};

export default Home;